import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { sqlClient } from './db';
let ready: Promise<unknown>|undefined;
const WINDOW_SECONDS=900;
export async function consumeLoginBudget(request: Request,email: string) {
  const sql=sqlClient();
  // Shared Postgres counters survive serverless instance restarts. Production can
  // pre-create this table with migrations/security-hardening.sql and grant DML only.
  if (!ready) ready=Promise.resolve(sql`CREATE TABLE IF NOT EXISTS login_rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, reset_at TIMESTAMPTZ NOT NULL)` ).catch(e=>{ready=undefined;throw e;});
  await ready;
  const secret=process.env.ADMIN_SESSION_SECRET;
  if(!secret)throw new Error('LOGIN_SECURITY_UNAVAILABLE');
  const digest=(value:string)=>createHmac('sha256',secret).update('login-limit:'+value).digest('hex');
  const budgets=[{key:digest('account:'+email),limit:10}];
  // Trust forwarding headers only on Vercel, which overwrites x-forwarded-for.
  // Other hosts retain account limits until their trusted proxy is configured.
  const ip=process.env.VERCEL==='1'?request.headers.get('x-forwarded-for')?.split(',')[0]?.trim():undefined;
  if(ip&&isIP(ip))budgets.push({key:digest('ip:'+ip),limit:60});
  for(const budget of budgets){
    const rows=await sql`INSERT INTO login_rate_limits(key,hits,reset_at) VALUES(${budget.key},1,NOW()+INTERVAL '15 minutes') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN login_rate_limits.reset_at<=NOW() THEN 1 ELSE LEAST(login_rate_limits.hits+1,1000000) END, reset_at=CASE WHEN login_rate_limits.reset_at<=NOW() THEN NOW()+INTERVAL '15 minutes' ELSE login_rate_limits.reset_at END RETURNING hits,GREATEST(1,CEIL(EXTRACT(EPOCH FROM(reset_at-NOW()))))::int AS retry_after`;
    if(rows.length!==1||!Number.isFinite(Number(rows[0].hits)))throw new Error('LOGIN_SECURITY_UNAVAILABLE');
    if(Number(rows[0].hits)>budget.limit)return {allowed:false,retryAfter:Number(rows[0]?.retry_after)||WINDOW_SECONDS};
  }
  return {allowed:true,retryAfter:0};
}
