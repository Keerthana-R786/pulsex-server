const router = require('express').Router();
const supabase = require('../services/supabase');
const { generateReferralId, generateOrderId, generateCoverageId, generateContactVerificationId } = require('../utils/id-generators');

// POST /api/v1/referrals — Create new referral (UI endpoint)
router.post('/', async (req, res) => {
  const {
    patient_name, patient_dob, patient_contact_phone, patient_contact_email,
    patient_preferred_channel, referring_physician_name, referring_physician_email,
    referring_physician_npi, specialty, specialist_name, specialist_practice,
    payer_name, payer_member_id, reason_for_referral
  } = req.body;

  const referral_id = generateReferralId();
  const order_id = generateOrderId();
  const coverage_id = payer_member_id ? generateCoverageId(payer_member_id) : null;
  const contact_verification_id = generateContactVerificationId();

  const { data, error } = await supabase
    .from('referrals')
    .insert({
      referral_id, patient_name, patient_dob, patient_contact_phone, patient_contact_email,
      patient_preferred_channel, referring_physician_name, referring_physician_email,
      referring_physician_npi, physician_email_verified: false, order_id, specialty,
      specialist_name, specialist_practice, payer_name, payer_member_id, coverage_id,
      coverage_active: true, coverage_active_until: '2025-12-31', reason_for_referral,
      status: 'intake'
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'insert_failed', message: error.message });
  res.status(201).json(data);
});

// GET /api/v1/referrals — List all referrals (UI endpoint)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'query_failed', message: error.message });
  res.json(data);
});

// GET /api/v1/referrals/:id — Get single referral (UI endpoint)
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referral_id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'not_found', message: 'Referral not found' });
  res.json(data);
});

// GET /api/v1/referrals/:id/resolution — Get resolution brief (UI endpoint)
router.get('/:id/resolution', async (req, res) => {
  const { data, error } = await supabase
    .from('resolution_briefs')
    .select('*')
    .eq('referral_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return res.status(404).json({ error: 'not_found', message: 'No resolution brief found' });
  res.json(data);
});

// GET /api/v1/referrals/:id/context — Tool 1: retrieve_referral_context
router.get('/:id/context', async (req, res) => {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referral_id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'not_found', message: 'Referral not found' });

  res.json({
    referral_id: data.referral_id,
    retrieved_at: data.created_at,
    patient: {
      name: data.patient_name,
      dob: data.patient_dob,
      preferred_contact_channel: data.patient_preferred_channel,
      phone: data.patient_contact_phone,
      email: data.patient_contact_email,
      contact_verification_id: generateContactVerificationId(),
    },
    referring_physician: {
      name: data.referring_physician_name,
      practice: data.specialist_practice || '',
      email: data.referring_physician_email,
      npi: data.referring_physician_npi,
      email_verified: data.physician_email_verified,
      verification_source: generateContactVerificationId(),
    },
    order: {
      order_id: data.order_id,
      specialty: data.specialty,
      reason: data.reason_for_referral,
      requested_specialist_name: data.specialist_name,
      requested_specialist_practice: data.specialist_practice,
    },
    payer: {
      payer_name: data.payer_name,
      member_id: data.payer_member_id,
      coverage_id: data.coverage_id,
      coverage_active: data.coverage_active,
      coverage_active_until: data.coverage_active_until,
    },
    authorization_status: 'unassessed',
    case_age_days: Math.floor((Date.now() - new Date(data.created_at).getTime()) / 86400000),
    urgency: '',
    source_identifiers: {
      intake_order: data.order_id,
      coverage_record: data.coverage_id,
      contact_verification: generateContactVerificationId(),
    },
    missing_fields: [],
    unknowns: ['Authorization status pending', 'Patient reachability unconfirmed'],
  });
});

// PATCH /api/v1/referrals/:id/state — Tool 10: update_referral_state
router.patch('/:id/state', async (req, res) => {
  const { new_state, disposition, confidence_score, stall_risk_score, reason } = req.body;

  const { data: current } = await supabase
    .from('referrals')
    .select('status')
    .eq('referral_id', req.params.id)
    .single();

  const updates = { status: new_state, updated_at: new Date().toISOString() };
  if (disposition) updates.disposition = disposition;
  if (confidence_score !== undefined) updates.confidence_score = confidence_score;
  if (stall_risk_score !== undefined) updates.stall_risk_score = stall_risk_score;

  const { data, error } = await supabase
    .from('referrals')
    .update(updates)
    .eq('referral_id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'update_failed', message: error.message });

  res.json({
    transaction_id: `STM-${req.params.id}-${Date.now()}`,
    referral_id: req.params.id,
    previous_state: current?.status || 'unknown',
    new_state: new_state,
    updated_at: updates.updated_at,
    closure_prerequisites_satisfied: new_state === 'closed',
    message: reason || `State updated to ${new_state}`,
  });
});

module.exports = router;
