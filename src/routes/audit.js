const router = require('express').Router();
const supabase = require('../services/supabase');

// POST /api/v1/audit/events — Tool 7: append_audit_event
router.post('/events', async (req, res) => {
  const { referral_id, step_number, agent_name, event_type, source_reference, lookup_purpose, result_summary, provenance } = req.body;

  const event_id = `AUD-${referral_id}-${String(Date.now()).slice(-4)}`;

  const { error } = await supabase.from('audit_events').insert({
    event_id, referral_id, step_number, agent_name, event_type,
    source_reference, lookup_purpose, result_summary, provenance: provenance || {},
  });

  if (error) return res.status(500).json({ error: 'insert_failed', message: error.message });

  res.status(201).json({
    event_id, referral_id, step_number, agent_name, event_type,
    source_reference, appended_at: new Date().toISOString(), immutable: true,
  });
});

// GET /api/v1/audit/events/:referral_id — List audit trail (UI endpoint)
router.get('/events/:referral_id', async (req, res) => {
  const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .eq('referral_id', req.params.referral_id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: 'query_failed', message: error.message });
  res.json({ referral_id: req.params.referral_id, total_events: data.length, events: data });
});

module.exports = router;
