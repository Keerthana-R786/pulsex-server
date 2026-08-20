const router = require('express').Router();
const crypto = require('crypto');
const supabase = require('../services/supabase');

const YOXA_BASE = 'https://yoxa.ai/api/v1/public/workflow-deployments';

function verifyHmac(timestamp, body, signature) {
  const secret = process.env.YOXA_HITL_WEBHOOK_SIGNING_SECRET;
  if (!secret) return false;
  const payload = `${timestamp}.${body}`;
  const expected = 'v1=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function respondToYoxa(requestId, response) {
  const deploymentId = '27c5cadd-df7f-45e0-861b-929fe4e7bdf5';
  const responseSecret = process.env.YOXA_HITL_RESPONSE_SECRET;
  if (!responseSecret) return Promise.resolve(null);

  const url = `${YOXA_BASE}/${deploymentId}/hitl/requests/${requestId}/respond`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'X-Yoxa-HITL-Response-Secret': responseSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(response),
  }).then(r => r.json()).catch(e => {
    console.error('YOXA response failed:', e.message);
    return null;
  });
}

// POST /api/v1/workflow/hitl — Receive YOXA approval requests
router.post('/hitl', async (req, res) => {
  const rawBody = JSON.stringify(req.body);
  const timestamp = req.headers['x-yoxa-webhook-timestamp'];
  const signature = req.headers['x-yoxa-webhook-signature'];
  const eventId = req.headers['x-yoxa-webhook-id'];

  if (process.env.YOXA_HITL_WEBHOOK_SIGNING_SECRET && timestamp && signature) {
    if (!verifyHmac(timestamp, rawBody, signature)) {
      return res.status(401).json({ error: 'invalid_signature' });
    }
  }

  const { event_type, workflow_run_id, request_id, title, description, options } = req.body;

  if (event_type === 'hitl.webhook_test') {
    return res.status(200).json({ received: true });
  }

  if (event_type !== 'hitl.approval_requested') {
    return res.status(200).json({ received: true });
  }

  const { data: existing } = await supabase
    .from('pending_approvals')
    .select('id')
    .eq('workflow_run_id', workflow_run_id)
    .eq('approval_type', request_id)
    .single();

  if (existing) return res.status(200).json({ received: true, deduplicated: true });

  const referral_id = req.body.referral_id || workflow_run_id;

  await supabase.from('pending_approvals').insert({
    referral_id, workflow_run_id,
    requested_by: 'YOXA',
    approval_type: request_id,
    title: title || 'Approval Required',
    description: description || '',
    options: options || [],
  });

  const selectedOption = options && options.length > 0 ? options[0] : null;
  const yoxaResponse = selectedOption
    ? { selected_option_id: selectedOption.option_id }
    : { override_message: 'Auto-approved by PulseX system' };

  const result = await respondToYoxa(request_id, yoxaResponse);

  await supabase.from('pending_approvals').update({
    status: 'resolved',
    response: selectedOption?.option_id || 'auto-approved',
    responded_at: new Date().toISOString(),
  }).eq('workflow_run_id', workflow_run_id).eq('approval_type', request_id);

  res.status(200).json({ received: true, auto_approved: true, yoxa_response: result });
});

// GET /api/v1/workflow/yoxa-status — Get all YOXA workflow runs
router.get('/yoxa-status', async (req, res) => {
  const { data, error } = await supabase
    .from('trigger_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: 'query_failed', message: error.message });
  res.json(data);
});

module.exports = router;
