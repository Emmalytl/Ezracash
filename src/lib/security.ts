import { sqlClient } from './db';
import { Role } from './auth';

export async function ensureSecuritySchema() {
  const sql = sqlClient();
  await sql`CREATE TABLE IF NOT EXISTS admin_sessions (
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
  )`;
  await sql`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS city TEXT`;
  await sql`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS region TEXT`;
  await sql`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS country TEXT`;
  await sql`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS latitude TEXT`;
  await sql`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS longitude TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS admin_sessions_active_idx ON admin_sessions(admin_id,expires_at,revoked_at)`;
  await sql`CREATE TABLE IF NOT EXISTS security_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,
    session_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE security_audit ADD COLUMN IF NOT EXISTS session_id UUID`;
  await sql`CREATE INDEX IF NOT EXISTS security_audit_created_idx ON security_audit(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS security_audit_admin_idx ON security_audit(admin_id,created_at DESC)`;
  await sql`ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check`;
  await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'administrator'`;
  await sql`ALTER TABLE admin_users ALTER COLUMN role SET DEFAULT 'administrator'`;
  await sql`UPDATE admin_users SET role='administrator' WHERE role='admin'`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='admin_users'::regclass AND conname='admin_users_role_check') THEN ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK (role IN ('developer','administrator','staff')) NOT VALID; END IF; END $$`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS one_developer_account_idx ON admin_users((role)) WHERE role='developer'`;
  await sql`CREATE TABLE IF NOT EXISTS admin_profiles (
    admin_id UUID PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', ministry_role TEXT NOT NULL DEFAULT 'Administrator', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

export function roleLabel(role: Role) { return role==='developer'?'System Developer':role==='administrator'?'Administrator':'Staff'; }
export function roleAllows(role: Role, action: string) {
  if (role==='developer') return true;
  if (role==='administrator') return !['security','manage_roles','system_config'].includes(action);
  return ['dashboard','fundraising','donations','donors','expenses','analytics','profile','change_password'].includes(action);
}
