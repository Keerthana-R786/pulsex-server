const supabase = require('./supabase');
const { sendEmail, eligibilityEmail, appointmentEmail, physicianNotificationEmail, resolutionEmail } = require('./email');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

async function saveStep(referral_id, run_id, step_number, step_name, agent_name, status, input, output) {
  await supabase.from('workflow_steps').insert({
    referral_id, workflow_run_id: run_id, step_number, step_name, agent_name,
    status, input_summary: JSON.stringify(input).substring(0, 500),
    output_summary: JSON.stringify(output).substring(0, 500),
    started_at: new Date().toISOString(),
    ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
  });
}

async function apiCall(method, path, body) {
  const url = `${API_BASE}${path}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  return resp.json();
}

async function runWorkflow(referral) {
  const run_id = `WR-${referral.referral_id}-${Date.now()}`;
  const steps = [];

  // Step 1: Context Retrieval
  await saveStep(referral.referral_id, run_id, 1, 'Context Retrieval', 'IntakeAgent', 'running', { referral_id: referral.referral_id }, null);
  const context = await apiCall('GET', `/api/v1/referrals/${referral.referral_id}/context`);
  await saveStep(referral.referral_id, run_id, 1, 'Context Retrieval', 'IntakeAgent', 'completed', { referral_id: referral.referral_id }, context);
  steps.push({ step: 1, name: 'Context Retrieval', agent: 'IntakeAgent', status: 'completed', result: context });

  // Step 2: Network & Payer Fit
  await saveStep(referral.referral_id, run_id, 2, 'Network & Payer Fit', 'EligibilityAgent', 'running', { payer: referral.payer_name }, null);
  const eligibility = await apiCall('POST', '/api/v1/eligibility/check', {
    referral_id: referral.referral_id, payer_name: referral.payer_name,
    specialist_practice: referral.specialist_practice, specialty: referral.specialty,
  });
  await saveStep(referral.referral_id, run_id, 2, 'Network & Payer Fit', 'EligibilityAgent', 'completed', { payer: referral.payer_name }, eligibility);
  steps.push({ step: 2, name: 'Network & Payer Fit', agent: 'EligibilityAgent', status: 'completed', result: eligibility });

  // Step 3: Payer Authorization
  await saveStep(referral.referral_id, run_id, 3, 'Payer Authorization', 'AuthorizationAgent', 'running', { member_id: referral.payer_member_id }, null);
  const authorization = await apiCall('POST', '/api/v1/authorization/check', {
    referral_id: referral.referral_id, payer_name: referral.payer_name,
    member_id: referral.payer_member_id, specialist_practice: referral.specialist_practice, cpt_code: '99213',
  });
  await saveStep(referral.referral_id, run_id, 3, 'Payer Authorization', 'AuthorizationAgent', 'completed', { member_id: referral.payer_member_id }, authorization);
  steps.push({ step: 3, name: 'Payer Authorization', agent: 'AuthorizationAgent', status: 'completed', result: authorization });

  // Step 4: Send eligibility email to referring physician
  await saveStep(referral.referral_id, run_id, 4, 'Physician Notification', 'CommsAgent', 'running', { to: referral.referring_physician_email }, null);
  const email1 = eligibilityEmail(referral, eligibility, authorization);
  const emailResult1 = await sendEmail(referral.referring_physician_email, email1.subject, email1.html);
  await supabase.from('physician_notifications').insert({
    notification_id: `DEL-${Date.now()}`, referral_id: referral.referral_id,
    recipient_name: referral.referring_physician_name, recipient_email: referral.referring_physician_email,
    notification_type: 'eligibility_decision', subject: email1.subject,
    body_preview: email1.html.substring(0, 200),
    delivery_status: emailResult1.success ? 'delivered' : 'failed',
    delivery_timestamp: new Date().toISOString(),
  });
  await saveStep(referral.referral_id, run_id, 4, 'Physician Notification', 'CommsAgent', 'completed', { to: referral.referring_physician_email }, { sent: emailResult1.success });
  steps.push({ step: 4, name: 'Physician Notification', agent: 'CommsAgent', status: 'completed', result: { sent: emailResult1.success } });

  // Step 5: Patient Scheduling
  await saveStep(referral.referral_id, run_id, 5, 'Patient Scheduling', 'SchedulingAgent', 'running', { patient: referral.patient_name }, null);
  const scheduling = await apiCall('POST', '/api/v1/scheduling/contact-and-book', {
    referral_id: referral.referral_id, patient_name: referral.patient_name,
    patient_phone: referral.patient_contact_phone, preferred_channel: referral.patient_preferred_channel,
    specialist_practice: referral.specialist_practice, specialist_name: referral.specialist_name,
  });
  await saveStep(referral.referral_id, run_id, 5, 'Patient Scheduling', 'SchedulingAgent', 'completed', { patient: referral.patient_name }, scheduling);
  steps.push({ step: 5, name: 'Patient Scheduling', agent: 'SchedulingAgent', status: 'completed', result: scheduling });

  // Step 6: Send appointment confirmation to patient
  if (scheduling.patient_reachable && scheduling.appointment?.date) {
    await saveStep(referral.referral_id, run_id, 6, 'Patient Confirmation', 'CommsAgent', 'running', { to: referral.patient_contact_email }, null);
    const email2 = appointmentEmail(referral, scheduling);
    const emailResult2 = await sendEmail(referral.patient_contact_email, email2.subject, email2.html);
    await saveStep(referral.referral_id, run_id, 6, 'Patient Confirmation', 'CommsAgent', 'completed', { to: referral.patient_contact_email }, { sent: emailResult2.success });
    steps.push({ step: 6, name: 'Patient Confirmation', agent: 'CommsAgent', status: 'completed', result: { sent: emailResult2.success } });
  } else {
    await saveStep(referral.referral_id, run_id, 6, 'Patient Confirmation', 'CommsAgent', 'completed', {}, { sent: false, reason: 'patient_unreachable' });
    steps.push({ step: 6, name: 'Patient Confirmation', agent: 'CommsAgent', status: 'completed', result: { sent: false, reason: 'patient_unreachable' } });
  }

  // Step 7: Specialist Availability
  await saveStep(referral.referral_id, run_id, 7, 'Specialist Confirmation', 'SpecialistAgent', 'running', { specialist: referral.specialist_name }, null);
  const specialist = await apiCall('POST', '/api/v1/specialist/confirm-availability', {
    referral_id: referral.referral_id, specialist_practice: referral.specialist_practice,
    specialist_name: referral.specialist_name, payer_name: referral.payer_name,
  });
  await saveStep(referral.referral_id, run_id, 7, 'Specialist Confirmation', 'SpecialistAgent', 'completed', { specialist: referral.specialist_name }, specialist);
  steps.push({ step: 7, name: 'Specialist Confirmation', agent: 'SpecialistAgent', status: 'completed', result: specialist });

  // Step 8: Resolution Brief + Final Notification
  await saveStep(referral.referral_id, run_id, 8, 'Resolution', 'ResolutionAgent', 'running', {}, null);
  const brief = await apiCall('POST', '/api/v1/resolution/generate-brief', {
    referral_id: referral.referral_id,
    evidence_package: {
      authorization_status: authorization.authorization_status,
      patient_reachability: scheduling.reachability_status,
      specialist_receipt_status: specialist.receipt_status,
      appointment_status: scheduling.outcome,
    },
    case_age_days: 0,
  });

  const disposition = brief.confidence_above_threshold ? 'RESOLVED_AUTONOMOUS' : 'RESOLVED_AWAITING_REVIEW';
  await apiCall('PATCH', `/api/v1/referrals/${referral.referral_id}/state`, {
    new_state: 'closed', disposition, confidence_score: brief.confidence_score, stall_risk_score: brief.stall_risk_score,
  });

  const email3 = resolutionEmail(referral, brief);
  await sendEmail(referral.referring_physician_email, email3.subject, email3.html);

  await saveStep(referral.referral_id, run_id, 8, 'Resolution', 'ResolutionAgent', 'completed', {}, brief);
  steps.push({ step: 8, name: 'Resolution', agent: 'ResolutionAgent', status: 'completed', result: brief });

  await supabase.from('audit_events').insert({
    event_id: `AUD-${referral.referral_id}-${Date.now()}`, referral_id: referral.referral_id,
    step_number: 8, agent_name: 'ResolutionAgent', event_type: 'state_change',
    source_reference: run_id, lookup_purpose: 'workflow-complete',
    result_summary: `${disposition} — confidence ${(brief.confidence_score * 100).toFixed(0)}%`,
  });

  return { run_id, steps, disposition, confidence_score: brief.confidence_score };
}

module.exports = { runWorkflow };
