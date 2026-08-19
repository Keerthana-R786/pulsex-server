-- Run this in Supabase Dashboard → SQL Editor → New Query → Run

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id TEXT UNIQUE NOT NULL,
  patient_name TEXT NOT NULL,
  patient_dob DATE,
  patient_contact_phone TEXT,
  patient_contact_email TEXT,
  patient_preferred_channel TEXT,
  referring_physician_name TEXT NOT NULL,
  referring_physician_email TEXT NOT NULL,
  referring_physician_npi TEXT,
  physician_email_verified BOOLEAN DEFAULT false,
  order_id TEXT,
  specialty TEXT NOT NULL,
  specialist_name TEXT,
  specialist_practice TEXT,
  payer_name TEXT NOT NULL,
  payer_member_id TEXT,
  coverage_id TEXT,
  coverage_active BOOLEAN DEFAULT false,
  coverage_active_until DATE,
  reason_for_referral TEXT,
  status TEXT DEFAULT 'intake',
  disposition TEXT,
  confidence_score DECIMAL(3,2),
  stall_risk_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  referral_id TEXT NOT NULL REFERENCES referrals(referral_id),
  step_number INTEGER,
  agent_name TEXT,
  event_type TEXT NOT NULL,
  source_reference TEXT,
  lookup_purpose TEXT,
  result_summary TEXT NOT NULL,
  provenance JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS physician_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id TEXT UNIQUE NOT NULL,
  referral_id TEXT NOT NULL REFERENCES referrals(referral_id),
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  subject TEXT,
  body_preview TEXT,
  delivery_status TEXT DEFAULT 'pending',
  delivery_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care_coordinator_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id TEXT UNIQUE NOT NULL,
  referral_id TEXT NOT NULL REFERENCES referrals(referral_id),
  escalation_reason TEXT NOT NULL,
  review_brief TEXT NOT NULL,
  recommended_actions JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  assigned_coordinator TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS resolution_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id TEXT UNIQUE NOT NULL,
  referral_id TEXT NOT NULL REFERENCES referrals(referral_id),
  evidence_package JSONB NOT NULL,
  challenge_report JSONB,
  disposition TEXT NOT NULL,
  confidence_score DECIMAL(3,2),
  stall_risk_score DECIMAL(3,2),
  brief_html TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_referral ON audit_events(referral_id);
CREATE INDEX IF NOT EXISTS idx_notif_referral ON physician_notifications(referral_id);
CREATE INDEX IF NOT EXISTS idx_review_referral ON care_coordinator_reviews(referral_id);
CREATE INDEX IF NOT EXISTS idx_brief_referral ON resolution_briefs(referral_id);
