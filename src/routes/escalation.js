const router = require('express').Router();
const supabase = require('../services/supabase');

// POST /api/v1/escalation/review — Tool 8: request_care_coordinator_review
router.post('/review', async (req, res) => {
  const { referral_id, escalation_reason, review_brief, recommended_actions, linked_evidence } = req.body;

  const review_id = `REV-${referral_id}-${Date.now()}`;

  const { error } = await supabase.from('care_coordinator_reviews').insert({
    review_id, referral_id, escalation_reason, review_brief,
    recommended_actions: recommended_actions || [], status: 'pending',
  });

  if (error) return res.status(500).json({ error: 'insert_failed', message: error.message });

  res.status(201).json({
    review_id, referral_id, escalation_reason, status: 'pending',
    created_at: new Date().toISOString(), assigned_coordinator: null,
  });
});

module.exports = router;
