CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'administrator' CHECK (role IN ('developer','administrator','staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'GENERAL',
  description TEXT NOT NULL DEFAULT '',
  goal NUMERIC(12,2) NOT NULL CHECK (goal > 0),
  image TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','closed','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  donation_type TEXT NOT NULL DEFAULT 'general' CHECK (donation_type IN ('general','tithe','offering','campaign')),
  donor_name TEXT NOT NULL DEFAULT 'Anonymous',
  donor_email TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'Manual',
  payment_provider TEXT NOT NULL DEFAULT 'manual',
  transaction_id TEXT,
  provider_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS donations_campaign_status_idx ON donations(campaign_id,status);
CREATE INDEX IF NOT EXISTS donations_created_at_idx ON donations(created_at DESC);

-- Create an admin after generating a bcrypt hash for the password.
-- Example (do NOT use this example password in production):
-- INSERT INTO admin_users(email,password_hash) VALUES('admin@example.com','$2b$12$...');

-- Finance and administrator profile extensions (created automatically by the app too)
CREATE TABLE IF NOT EXISTS admin_profiles (
  admin_id UUID PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  ministry_role TEXT NOT NULL DEFAULT 'Administrator',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'Ministry',
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
  reference TEXT,
  approved_by TEXT,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','pending','voided')),
  expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date DESC);

-- Security / access-control extensions. The app also runs these migrations automatically.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  latitude TEXT,
  longitude TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS admin_sessions_active_idx ON admin_sessions(admin_id,expires_at,revoked_at);
CREATE TABLE IF NOT EXISTS security_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), action TEXT NOT NULL, admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  ip_address TEXT, user_agent TEXT, details TEXT, session_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS security_audit_created_idx ON security_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_session_idx ON security_audit(session_id,created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS donations_provider_txn_idx ON donations(payment_provider,transaction_id) WHERE transaction_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS payment_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL, processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), payload JSONB);
