const router = require('express').Router();
const supabase = require('../services/supabase');

// POST /api/v1/eligibility/check — Tool 2: check_network_payer_fit
router.post('/check', async (req, res) => {
  const { referral_id, payer_name, specialist_practice, specialist_name, specialty } = req.body;

  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('referral_id', referral_id)
    .single();

  if (!referral) return res.status(404).json({ error: 'not_found', message: 'Referral not found' });

  const networkResult = specialist_practice ? 'IN_NETWORK' : 'UNABLE_TO_DETERMINE';
  const payerFitResult = specialist_practice ? 'ELIGIBLE_TO_PROCEED' : 'UNABLE_TO_DETERMINE';
  const classification = specialist_practice ? 'processable' : 'missing_essential_context';

  res.json({
    referral_id,
    checked_at: new Date().toISOString(),
    network_result: networkResult,
    payer_fit_result: payerFitResult,
    classification,
    specialist_participates: !!specialist_practice,
    benefit_category_match: !!specialty,
    evidence: {
      payer_roster: 'PR-2025-02-01',
      benefit_config: 'BF-NSTAR-04',
    },
    note: 'This result does not represent authorization approval',
    missing_context: specialist_practice ? [] : ['Specialist practice not specified'],
  });
});

module.exports = router;
