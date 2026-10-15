import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { configured, createSession, sessionCookieName, sessionMaxAge, normalizeRole } from '@/lib/auth';
import { getDatabaseEnvStatus, sqlClient } from '@/lib/db';
import { ensureSecuritySchema } from '@/lib/security';

export async function POST(request: Request) {
  try {
    if (!configured()) return NextResponse.json({ok:false,code:'DATABASE_NOT_CONFIGURED',error:'No database connection is available.',environment:getDatabaseEnvStatus()},{status:503});
    await ensureSecuritySchema();
    const body=await request.json(); const email=String(body?.email||'').trim().toLowerCase(); const password=String(body?.password||'');
    if(!email||!password) return NextResponse.json({ok:false,code:'MISSING_CREDENTIALS',error:'Enter your email and password.'},{status:400});
    const sql=sqlClient();
    const rows=await sql`SELECT id,email,password_hash,role FROM admin_users WHERE lower(email)=lower(${email}) LIMIT 1`;
    if(!rows[0]) { const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||null; const ua=request.headers.get('user-agent')||null; await sql`INSERT INTO security_audit(action,details,ip_address,user_agent) VALUES('failed_login',${email},${ip},${ua})`.catch(()=>{}); return NextResponse.json({ok:false,code:'ADMIN_NOT_FOUND',error:'No account was found for that email.'},{status:401}); }
    const match=await compare(password,String(rows[0].password_hash));
    if(!match){ const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||null; const ua=request.headers.get('user-agent')||null; await sql`INSERT INTO security_audit(action,admin_id,details,ip_address,user_agent) VALUES('failed_login',${rows[0].id},'Incorrect password',${ip},${ua})`; return NextResponse.json({ok:false,code:'PASSWORD_MISMATCH',error:'The password does not match.'},{status:401}); }
    if(!process.env.ADMIN_SESSION_SECRET) return NextResponse.json({ok:false,code:'SESSION_SECRET_MISSING',error:'ADMIN_SESSION_SECRET is not available to this deployment.'},{status:500});
    const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||'';
    const ua=request.headers.get('user-agent')||'';
    const city=request.headers.get('x-vercel-ip-city')||'';
    const region=request.headers.get('x-vercel-ip-country-region')||'';
    const country=request.headers.get('x-vercel-ip-country')||'';
    const latitude=request.headers.get('x-vercel-ip-latitude')||'';
    const longitude=request.headers.get('x-vercel-ip-longitude')||'';
    try { const token=await createSession(String(rows[0].email),{ip,userAgent:ua,city,region,country,latitude,longitude}); const response=NextResponse.json({ok:true,role:normalizeRole(rows[0].role)}); response.cookies.set(sessionCookieName(),token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:sessionMaxAge()}); return response; }
    catch(e:any){ if(e.message==='ACTIVE_SESSION_EXISTS') return NextResponse.json({ok:false,code:'ACTIVE_SESSION_EXISTS',error:'This account already has an active session on another device. Sign out there or ask the System Developer to terminate the active session.'},{status:409}); throw e; }
  } catch(error){ console.error('ADMIN LOGIN ERROR',error); return NextResponse.json({ok:false,code:'SERVER_ERROR',error:error instanceof Error?error.message:'Unable to sign in.'},{status:500}); }
}
