import { cookies } from 'next/headers';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getDatabaseUrl, sqlClient } from './db';

const COOKIE = 'hoez_admin_session';
const SESSION_SECONDS = 60 * 15;
const secret = () => {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error('SESSION_SECRET_MISSING');
  return value;
};
function sign(value: string) { return createHmac('sha256', secret()).update(value).digest('hex'); }
function safeEqual(a: string, b: string) { const left=Buffer.from(a); const right=Buffer.from(b); return left.length === right.length && timingSafeEqual(left,right); }

export type Role = 'developer' | 'administrator' | 'staff';
export function normalizeRole(value: unknown): Role { const role=String(value||'').toLowerCase(); return role==='developer' ? 'developer' : role==='administrator' || role==='admin' ? 'administrator' : 'staff'; }
export type AuthUser = { id:string; email:string; role:Role; displayName:string; sessionId:string };
export type SessionMeta = { ip?:string; userAgent?:string; city?:string; region?:string; country?:string; latitude?:string; longitude?:string };

export function configured() { return Boolean(getDatabaseUrl()); }
export function sessionCookieName() { return COOKIE; }
export function sessionMaxAge() { return SESSION_SECONDS; }

export async function createSession(email: string, meta: SessionMeta = {}) {
  const sql = sqlClient();
  const rows = await sql`SELECT id FROM admin_users WHERE lower(email)=lower(${email}) LIMIT 1`;
  if (!rows[0]) throw new Error('USER_NOT_FOUND');
  const id = String(rows[0].id);
  const sessionId = randomUUID();
  const expires = new Date(Date.now() + SESSION_SECONDS*1000);
  // Serialize login attempts for this account; concurrent requests cannot create two sessions.
  const result = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtext(${id}))`,
    sql`INSERT INTO admin_sessions(id,admin_id,ip_address,user_agent,city,region,country,latitude,longitude,expires_at,last_activity)
      SELECT ${sessionId}::uuid,${id}::uuid,${meta.ip||null},${meta.userAgent||null},${meta.city||null},${meta.region||null},${meta.country||null},${meta.latitude||null},${meta.longitude||null},${expires.toISOString()}::timestamptz,NOW()
      WHERE NOT EXISTS (SELECT 1 FROM admin_sessions WHERE admin_id=${id} AND revoked_at IS NULL AND expires_at>NOW()) RETURNING id`,
    sql`INSERT INTO security_audit(action,admin_id,session_id,ip_address,user_agent,details)
      SELECT 'login',${id}::uuid,${sessionId}::uuid,${meta.ip||null},${meta.userAgent||null},'Successful sign in'
      WHERE EXISTS (SELECT 1 FROM admin_sessions WHERE id=${sessionId})`
  ]);
  if (!result[1].length) throw new Error('ACTIVE_SESSION_EXISTS');
  const payload = `${sessionId}|${email}`;
  return `${payload}|${sign(payload)}`;
}

export async function getAdminUser(refresh = false): Promise<AuthUser|null> {
  if (!configured()) return null;
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const parts = token.split('|');
  if (parts.length !== 3) return null;
  const [sessionId,email,sig] = parts;
  const payload = `${sessionId}|${email}`;
  try {
    if (!safeEqual(sig, sign(payload))) return null;
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
    const sql = sqlClient();
    const rows = await sql`SELECT u.id,u.email,u.role,COALESCE(p.display_name,'') AS display_name,s.id AS session_id
      FROM admin_sessions s JOIN admin_users u ON u.id=s.admin_id
      LEFT JOIN admin_profiles p ON p.admin_id=u.id
      WHERE s.id=${sessionId} AND lower(u.email)=lower(${email}) AND s.revoked_at IS NULL AND s.expires_at>NOW()
      LIMIT 1`;
    if (!rows[0]) return null;
    // Polling only checks the session. An activity heartbeat explicitly renews it.
    if (refresh) await sql`UPDATE admin_sessions SET last_activity=NOW(), expires_at=NOW() + INTERVAL '15 minutes' WHERE id=${sessionId} AND revoked_at IS NULL AND expires_at>NOW()`;
    return {id:String(rows[0].id),email:String(rows[0].email),role:normalizeRole(rows[0].role),displayName:String(rows[0].display_name||''),sessionId:String(rows[0].session_id)};
  } catch { return null; }
}
export async function requireUser() { const user=await getAdminUser(); if(!user) throw new Error('UNAUTHORIZED'); return user; }
export async function requireAdmin() { return requireRole(['developer','administrator']); }
export async function requireRole(roles: Role[]) { const user=await requireUser(); if(!roles.includes(user.role)) throw new Error('FORBIDDEN'); return user; }
export async function revokeCurrentSession(user: AuthUser) { const sql=sqlClient(); await sql`UPDATE admin_sessions SET revoked_at=NOW() WHERE id=${user.sessionId}`; await sql`INSERT INTO security_audit(action,admin_id,session_id,ip_address,user_agent,details) SELECT 'logout',${user.id},${user.sessionId},ip_address,user_agent,'Signed out' FROM admin_sessions WHERE id=${user.sessionId}`; }
