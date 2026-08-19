const router = require('express').Router();
const supabase = require('../services/supabase');

// GET /api/v1/workflow/:referral_id/steps — Get workflow steps for a referral
router.get('/:referral_id/steps', async (req, res) => {
  const { data, error } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('referral_id', req.params.referral_id)
    .order('step_number', { ascending: true });

  if (error) return res.status(500).json({ error: 'query_failed', message: error.message });
  res.json({ referral_id: req.params.referral_id, steps: data });
});

// POST /api/v1/workflow/steps — Record a workflow step
router.post('/steps', async (req, res) => {
  const { referral_id, workflow_run_id, step_number, step_name, agent_name, status, input_summary, output_summary } = req.body;

  const { data, error } = await supabase
    .from('workflow_steps')
    .insert({
      referral_id, workflow_run_id, step_number, step_name, agent_name,
      status: status || 'completed', input_summary, output_summary,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'insert_failed', message: error.message });
  res.status(201).json(data);
});

// GET /api/v1/workflow/approvals/pending — List pending HITL approvals
router.get('/approvals/pending', async (req, res) => {
  const { data, error } = await supabase
    .from('pending_approvals')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: 'query_failed', message: error.message });
  res.json(data);
});

// GET /api/v1/workflow/approvals/:referral_id — Get approvals for a referral
router.get('/approvals/:referral_id', async (req, res) => {
  const { data, error } = await supabase
    .from('pending_approvals')
    .select('*')
    .eq('referral_id', req.params.referral_id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: 'query_failed', message: error.message });
  res.json(data);
});

// POST /api/v1/workflow/approvals — Create a HITL approval request
router.post('/approvals', async (req, res) => {
  const { referral_id, workflow_run_id, requested_by, approval_type, title, description, options } = req.body;

  const { data, error } = await supabase
    .from('pending_approvals')
    .insert({
      referral_id, workflow_run_id, requested_by, approval_type, title, description,
      options: options || [],
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'insert_failed', message: error.message });
  res.status(201).json(data);
});

// PATCH /api/v1/workflow/approvals/:id/respond — Respond to a HITL approval
router.patch('/approvals/:id/respond', async (req, res) => {
  const { response } = req.body;

  const { data, error } = await supabase
    .from('pending_approvals')
    .update({ status: 'resolved', response, responded_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'update_failed', message: error.message });
  if (!data) return res.status(404).json({ error: 'not_found', message: 'Approval not found or already resolved' });
  res.json(data);
});

// POST /api/v1/workflow/webhook — YOXA webhook receiver
router.post('/webhook', async (req, res) => {
  const secret = req.headers['x-yoxa-deployment-secret'];
  if (secret !== process.env.YOXA_DEPLOYMENT_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { referral_id, workflow_run_id, event_type, step_name, agent_name, details } = req.body;

  if (event_type === 'step_completed') {
    const { count } = await supabase
      .from('workflow_steps')
      .select('*', { count: 'exact', head: true })
      .eq('referral_id', referral_id);

    await supabase.from('workflow_steps').insert({
      referral_id, workflow_run_id, step_number: (count || 0) + 1,
      step_name, agent_name, status: 'completed',
      input_summary: details?.input || '',
      output_summary: details?.output || '',
      completed_at: new Date().toISOString(),
    });
  }

  if (event_type === 'approval_requested') {
    await supabase.from('pending_approvals').insert({
      referral_id, workflow_run_id, requested_by: agent_name,
      approval_type: details?.type || 'general',
      title: details?.title || 'Approval Required',
      description: details?.description || '',
      options: details?.options || [],
    });
  }

  res.json({ received: true });
});

module.exports = router;
