const router = require('express').Router();
const supabase = require('../services/supabase');

// POST /api/v1/authorization/check — Tool 4: check_explicit_payer_authorization
router.post('/check', async (req, res) => {
  const { referral_id, payer_name, member_id, specialist_practice, cpt_code } = req.body;

  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('referral_id', referral_id)
    .single();

  if (!referral) return res.status(404).json({ error: 'not_found', message: 'Referral not found' });

  // Demo logic: approve if in-network, deny if out-of-network
  const isApproved = specialist_practice && specialist_practice.toLowerCase().includes('harbor');
  const authId = `AUTH-${member_id || 'NS'}-${Date.now()}`;
  const responseId = `NSR-${Date.now()}`;

  if (isApproved) {
    res.json({
      referral_id, queried_at: new Date().toISOString(),
      authorization_status: 'APPROVED', authorization_id: authId,
      payer_response_id: responseId, approved_visits: 1,
      cpt_code: cpt_code || '99204', valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      servicing_provider: `${specialist_practice} / ${specialist_practice}`,
      denial_reason: null, denial_code: null,
      response_source: 'explicit_payer_response', next_action: null,
      note: 'Response is explicit and does not rely on coverage or network inference',
    });
  } else {
    res.json({
      referral_id, queried_at: new Date().toISOString(),
      authorization_status: 'DENIED', authorization_id: authId,
      payer_response_id: responseId, approved_visits: 0,
      cpt_code: cpt_code || '99205', valid_from: null, valid_until: null,
      servicing_provider: null,
      denial_reason: 'Submitted record did not document required conservative-treatment trial',
      denial_code: 'NS-CONSERVATIVE-TRIAL-MISSING',
      response_source: 'explicit_payer_response',
      next_action: 'Appeal or clinical documentation review required',
    });
  }
});

module.exports = router;
