import { NextResponse } from 'next/server';
import { getAdminUser, revokeCurrentSession, sessionCookieName } from '@/lib/auth';
export async function POST(){ const r=NextResponse.json({ok:true}); try{const u=await getAdminUser(); if(u) await revokeCurrentSession(u);}catch{} r.cookies.delete(sessionCookieName()); return r; }
