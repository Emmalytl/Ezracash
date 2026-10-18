import { NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { configured, createSession, sessionCookieName, sessionMaxAge, normalizeRole } from '@/lib/auth';
import { sqlClient } from '@/lib/db';
import { ensureSecuritySchema } from '@/lib/security';
import { consumeLoginBudget } from '@/lib/login-security';
import { mutationOriginAllowed } from '@/lib/request-security';
// Missing accounts still perform a cost-12 password check; no real account secret.
const dummyHash=hash('ezracash-non-account-dummy-password',12);
const invalid=()=>NextResponse.json({ok:false,code:'INVALID_CREDENTIALS',error:'Email or password is incorrect.'},{status:401});
export async function POST(request:Request){
 try{
  if(!mutationOriginAllowed(request))return NextResponse.json({error:'Request origin is not allowed.'},{status:403});
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return NextResponse.json({error:'Use a JSON request.'},{status:415});
  // Limit streamed bytes, including requests without Content-Length.
  const reader=request.body?.getReader();let raw='',bytes=0;const decoder=new TextDecoder();
  if(reader)for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>8192){await reader.cancel();return NextResponse.json({error:'Request is too large.'},{status:413});}raw+=decoder.decode(part.value,{stream:true});}
  raw+=decoder.decode();let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid request.'},{status:400});}
  const email=String(body?.email||'').trim().toLowerCase(),password=String(body?.password||'');
  if(!email||email.length>320||!password||password.length>1024)return invalid();
  if(!configured())return NextResponse.json({error:'Sign-in is temporarily unavailable.'},{status:503});
  const budget=await consumeLoginBudget(request,email);
  if(!budget.allowed)return NextResponse.json({ok:false,error:'Too many sign-in attempts. Please try again later.'},{status:429,headers:{'Retry-After':String(budget.retryAfter),'Cache-Control':'no-store'}});
  await ensureSecuritySchema();const sql=sqlClient();
  const rows=await sql`SELECT id,email,password_hash,role FROM admin_users WHERE lower(email)=lower(${email}) LIMIT 1`;
  const match=await compare(password,rows[0]?String(rows[0].password_hash):await dummyHash);
  if(!rows[0]||!match){
   await sql`INSERT INTO security_audit(action,admin_id,details,ip_address,user_agent) VALUES('failed_login',${rows[0]?.id||null},'Invalid credentials',${process.env.VERCEL==='1'?request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||null:null},${request.headers.get('user-agent')?.slice(0,512)||null})`;
   return invalid();
  }
  const location=(name:string)=>process.env.VERCEL==='1'?request.headers.get(name)?.slice(0,128)||'':'';
  const meta={city:location('x-vercel-ip-city'),region:location('x-vercel-ip-country-region'),country:location('x-vercel-ip-country'),latitude:location('x-vercel-ip-latitude'),longitude:location('x-vercel-ip-longitude'),ip:process.env.VERCEL==='1'?request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'':'',userAgent:request.headers.get('user-agent')?.slice(0,512)||''};
  try{
   const token=await createSession(String(rows[0].email),meta);
   const response=NextResponse.json({ok:true,role:normalizeRole(rows[0].role)},{headers:{'Cache-Control':'no-store'}});
   response.cookies.set(sessionCookieName(),token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:sessionMaxAge()});return response;
  }catch(e){if(e instanceof Error&&e.message==='ACTIVE_SESSION_EXISTS')return NextResponse.json({ok:false,code:'ACTIVE_SESSION_EXISTS',error:'This account already has an active session. Sign out there or contact the System Developer.'},{status:409});throw e;}
 }catch{return NextResponse.json({ok:false,code:'SIGN_IN_UNAVAILABLE',error:'Sign-in is temporarily unavailable. Please try again later.'},{status:503});}
}
