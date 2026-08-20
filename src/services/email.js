const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'pulsex-workflow@demo.com';

async function sendEmail(to, subject, html) {
  try {
    await sgMail.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    return { success: true, sent_at: new Date().toISOString() };
  } catch (e) {
    console.error('Email send failed:', e.message);
    return { success: false, error: e.message };
  }
}

function eligibilityEmail(referral, eligibilityResult, authorizationResult) {
  const subject = `Eligibility Decision: ${referral.patient_name} — Referral ${referral.referral_id}`;
  const html = `
    <h2>PulseX Referral Eligibility Update</h2>
    <p><strong>Referral ID:</strong> ${referral.referral_id}</p>
    <p><strong>Patient:</strong> ${referral.patient_name}</p>
    <p><strong>Specialty:</strong> ${referral.specialty}</p>
    <p><strong>Network Status:</strong> ${eligibilityResult.network_result}</p>
    <p><strong>Payer Fit:</strong> ${eligibilityResult.payer_fit_result}</p>
    <p><strong>Authorization:</strong> ${authorizationResult.authorization_status}</p>
    ${authorizationResult.authorization_status === 'APPROVED'
      ? `<p style="color:green"><strong>Status: APPROVED</strong> — ${authorizationResult.approved_visits} visit(s) authorized</p>`
      : `<p style="color:red"><strong>Status: ${authorizationResult.authorization_status}</strong></p>`
    }
    <p>Referral is ready for scheduling.</p>
  `;
  return { subject, html };
}

function appointmentEmail(referral, schedulingResult) {
  const patientEmail = referral.patient_contact_email;
  const subject = `Appointment Confirmation — ${referral.referral_id}`;
  const html = `
    <h2>Your Appointment is Confirmed</h2>
    <p><strong>Referral ID:</strong> ${referral.referral_id}</p>
    <p><strong>Patient:</strong> ${referral.patient_name}</p>
    <p><strong>Date:</strong> ${schedulingResult.appointment?.date || 'TBD'}</p>
    <p><strong>Time:</strong> ${schedulingResult.appointment?.time || 'TBD'} ${schedulingResult.appointment?.timezone || ''}</p>
    <p><strong>Provider:</strong> ${referral.specialist_name}</p>
    <p><strong>Location:</strong> ${schedulingResult.appointment?.address || referral.specialist_practice}</p>
    <hr/>
    <p>If you need to reschedule, contact ${referral.specialist_practice}.</p>
  `;
  return { to: patientEmail, subject, html };
}

function physicianNotificationEmail(referral, message) {
  const subject = `Referral Update: ${referral.referral_id} — ${referral.patient_name}`;
  const html = `
    <h2>PulseX Referral Notification</h2>
    <p><strong>Referral ID:</strong> ${referral.referral_id}</p>
    <p><strong>Patient:</strong> ${referral.patient_name}</p>
    <p><strong>Status:</strong> ${referral.status}</p>
    <p>${message}</p>
  `;
  return { subject, html };
}

function resolutionEmail(referral, brief) {
  const subject = `Referral Resolved: ${referral.referral_id} — ${brief.disposition}`;
  const html = `
    <h2>Referral Resolution Summary</h2>
    <p><strong>Referral ID:</strong> ${referral.referral_id}</p>
    <p><strong>Patient:</strong> ${referral.patient_name}</p>
    <p><strong>Disposition:</strong> ${brief.disposition}</p>
    <p><strong>Confidence:</strong> ${(brief.confidence_score * 100).toFixed(0)}%</p>
    <p><strong>Stall Risk:</strong> ${(brief.stall_risk_score * 100).toFixed(0)}%</p>
    <hr/>
    <p>This referral has been processed through the PulseX closed-loop workflow.</p>
  `;
  return { subject, html };
}

module.exports = { sendEmail, eligibilityEmail, appointmentEmail, physicianNotificationEmail, resolutionEmail };
