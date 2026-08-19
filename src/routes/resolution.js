const router = require('express').Router();
const supabase = require('../services/supabase');

// POST /api/v1/resolution/generate-brief — Tool 9: generate_resolution_brief
router.post('/generate-brief', async (req, res) => {
  const { referral_id, evidence_package, challenge_report, case_age_days } = req.body;

  const authOk = evidence_package?.authorization_status === 'APPROVED' || evidence_package?.authorization_status === 'NOT_REQUIRED';
  const patientOk = evidence_package?.appointment_status === 'CONFIRMED' || evidence_package?.patient_reachability === 'CONTACTABLE';
  const specialistOk = evidence_package?.specialist_receipt_status === 'CONFIRMED';

  const confidence = authOk && patientOk && specialistOk ? 0.98 : authOk ? 0.65 : 0.18;
  const stallRisk = confidence > 0.9 ? 0.04 : confidence > 0.5 ? 0.45 : 0.86;
  const disposition = confidence >= 0.9 ? 'RESOLVED_AWAITING_FINAL_NOTIFICATION' : 'CARE_COORDINATOR_REVIEW_REQUIRED';

  const briefId = `REP-${referral_id}-${Date.now()}`;

  const briefHtml = `<h3>Resolution Brief: ${referral_id}</h3>
<p><strong>Disposition:</strong> ${disposition}</p>
<p><strong>Confidence:</strong> ${(confidence * 100).toFixed(0)}% (threshold: 90%)</p>
<p><strong>Stall Risk:</strong> ${(stallRisk * 100).toFixed(0)}% (${stallRisk < 0.3 ? 'LOW' : stallRisk < 0.7 ? 'MEDIUM' : 'HIGH'})</p>
<p><strong>Authorization:</strong> ${evidence_package?.authorization_status || 'Unknown'}</p>
<p><strong>Patient:</strong> ${evidence_package?.patient_reachability || 'Unknown'}</p>
<p><strong>Specialist:</strong> ${evidence_package?.specialist_receipt_status || 'Unknown'}</p>`;

  const { error } = await supabase.from('resolution_briefs').insert({
    brief_id: briefId, referral_id, evidence_package, challenge_report,
    disposition, confidence_score: confidence, stall_risk_score: stallRisk, brief_html: briefHtml,
  });

  if (error) return res.status(500).json({ error: 'insert_failed', message: error.message });

  res.status(201).json({
    brief_id: briefId, referral_id, disposition,
    confidence_score: confidence, autonomous_resolution_threshold: 0.90,
    confidence_above_threshold: confidence >= 0.9,
    stall_risk_score: stallRisk,
    stall_risk_level: stallRisk < 0.3 ? 'LOW' : stallRisk < 0.7 ? 'MEDIUM' : 'HIGH',
    resolution_evidence: authOk ? { authorization_id: evidence_package?.authorization_response_id } : null,
    required_next_action: confidence >= 0.9 ? 'Send final status to verified physician' : 'Escalate to care coordinator',
    recommended_actions: confidence < 0.9 ? [
      { owner: 'Referring Physician', action: 'Submit treatment documentation', deadline: '2 business days' },
      { owner: 'Care Coordinator', action: 'Retry patient contact', deadline: '2 business days' },
    ] : [],
    brief_html: briefHtml, created_at: new Date().toISOString(),
  });
});

module.exports = router;
