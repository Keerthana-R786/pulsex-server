const router = require('express').Router();
const supabase = require('../services/supabase');

// POST /api/v1/notifications/physician — Tool 3: send_governed_physician_email
router.post('/physician', async (req, res) => {
  const { referral_id, recipient_email, recipient_name, notification_type, subject, body } = req.body;

  if (!recipient_email) {
    return res.status(422).json({
      reason: 'recipient_not_verified',
      message: 'Cannot validate recipient email from case data',
      referral_id,
      escalation_needed: true,
    });
  }

  const notification_id = `DEL-${Date.now()}`;

  const { error } = await supabase
    .from('physician_notifications')
    .insert({
      notification_id, referral_id, recipient_name, recipient_email,
      notification_type, subject, body_preview: body?.substring(0, 200),
      delivery_status: 'delivered', delivery_timestamp: new Date().toISOString(),
    });

  if (error) return res.status(500).json({ error: 'send_failed', message: error.message });

  res.json({
    notification_id, referral_id, recipient_email, recipient_name,
    delivery_status: 'delivered', delivered_at: new Date().toISOString(),
    notification_type,
  });
});

module.exports = router;
