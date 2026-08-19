const router = require('express').Router();
const supabase = require('../services/supabase');

// POST /api/v1/scheduling/contact-and-book — Tool 5: contact_patient_and_book_slot
router.post('/contact-and-book', async (req, res) => {
  const { referral_id, patient_name, patient_phone, preferred_channel, specialist_practice, specialist_name, requested_date, max_contact_attempts } = req.body;

  const { data: referral } = await supabase.from('referrals').select('*').eq('referral_id', referral_id).single();
  if (!referral) return res.status(404).json({ error: 'not_found', message: 'Referral not found' });

  const reachable = patient_phone && Math.random() > 0.3;
  const appointmentId = `SCH-${Date.now()}`;

  if (reachable) {
    res.json({
      referral_id, outcome: 'APPOINTMENT_BOOKED', patient_reachable: true,
      contact_attempts: 1, contact_channel: preferred_channel || 'phone',
      contact_timestamp: new Date().toISOString(), patient_confirmed: true,
      appointment: {
        confirmation_id: appointmentId, date: requested_date || '2025-09-15',
        time: '14:30', timezone: 'PST', specialist_name: specialist_name || specialist_practice,
        practice_name: specialist_practice, address: '1200 Pine Street, Suite 600, Seattle',
        slot_status: 'CONFIRMED',
      },
      reminder_scheduled: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      reachability_status: 'CONTACTABLE', follow_up_recommendation: '',
    });
  } else {
    res.json({
      referral_id, outcome: 'PATIENT_UNREACHABLE', patient_reachable: false,
      contact_attempts: max_contact_attempts || 3, contact_channel: preferred_channel || 'phone',
      patient_confirmed: false, appointment: {},
      reachability_status: 'UNREACHABLE',
      follow_up_recommendation: 'One additional outreach attempt within two business days after authorization clarification',
    });
  }
});

module.exports = router;
