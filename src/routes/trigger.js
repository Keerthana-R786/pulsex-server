const router = require('express').Router();
const crypto = require('crypto');
const supabase = require('../services/supabase');

// POST /api/v1/trigger — YOXA workflow trigger endpoint
router.post('/', async (req, res) => {
  const secret = req.headers['x-yoxa-deployment-secret'];
  if (secret !== process.env.YOXA_DEPLOYMENT_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { trigger_text, metadata } = req.body;
  const idempotencyKey = req.headers['idempotency-key'];

  // Idempotency check
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from('trigger_events')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existing) {
      return res.json({ status: 'already_processed', workflow_run_id: existing.workflow_run_id });
    }
  }

  // Parse trigger text to extract referral info
  const referralId = trigger_text?.match(/RF-\d+/)?.[0];
  if (!referralId) {
    return res.status(400).json({ error: 'no_referral_id', message: 'Could not extract referral ID from trigger text' });
  }

  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('referral_id', referralId)
    .single();

  if (!referral) {
    return res.status(404).json({ error: 'not_found', message: `Referral ${referralId} not found` });
  }

  const workflowRunId = `WR-${Date.now()}`;

  // Store trigger event for idempotency
  if (idempotencyKey) {
    await supabase.from('trigger_events').insert({
      idempotency_key: idempotencyKey,
      workflow_run_id: workflowRunId,
      referral_id: referralId,
      trigger_text: trigger_text?.substring(0, 500),
    });
  }

  res.json({
    status: 'accepted',
    workflow_run_id: workflowRunId,
    referral_id: referralId,
    message: `Workflow started for ${referralId}`,
  });
});

module.exports = router;
