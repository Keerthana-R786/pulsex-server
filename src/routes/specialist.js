const router = require('express').Router();
const supabase = require('../services/supabase');

// POST /api/v1/specialist/confirm-availability — Tool 6: confirm_specialist_referral_availability
router.post('/confirm-availability', async (req, res) => {
  const { referral_id, specialist_practice, specialist_name, payer_name } = req.body;

  const { data: referral } = await supabase.from('referrals').select('*').eq('referral_id', referral_id).single();
  if (!referral) return res.status(404).json({ error: 'not_found', message: 'Referral not found' });

  const confirmed = true;
  const officeId = `OFF-${Date.now()}`;
  const confirmId = `RCV-${Date.now()}`;

  if (confirmed) {
    res.json({
      referral_id, checked_at: new Date().toISOString(), receipt_status: 'CONFIRMED',
      office_record_id: officeId, confirmation_id: confirmId,
      specialist_accepts_payer: true, specialist_accepts_referral_type: true,
      available_slot: { date: '2025-09-15', time: '14:30', timezone: 'PST', slot_status: 'CONFIRMED' },
      intake_contact: `intake@${(specialist_practice || 'office').toLowerCase().replace(/\s+/g, '')}.example`,
      missing_documents: [], office_note: 'Referral packet includes order and current demographic/contact data',
    });
  } else {
    res.json({
      referral_id, checked_at: new Date().toISOString(), receipt_status: 'UNVERIFIED',
      office_record_id: null, confirmation_id: null,
      specialist_accepts_payer: null, specialist_accepts_referral_type: null,
      available_slot: null, missing_documents: ['No receipt confirmation from specialist office'],
      office_note: 'Office did not respond to receipt confirmation request',
    });
  }
});

module.exports = router;
