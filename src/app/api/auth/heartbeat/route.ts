import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminUser, sessionCookieName, sessionMaxAge } from '@/lib/auth';
export async function POST(request: Request) {
  const active = request.headers.get('x-session-activity') === '1';
  const user = await getAdminUser(active);
  if (!user) return NextResponse.json({ok:false,error:'SESSION_EXPIRED'},{status:401});
  const response = NextResponse.json({ok:true,email:user.email,role:user.role});
  if (active) {
    const token = (await cookies()).get(sessionCookieName())?.value;
    if (token) response.cookies.set(sessionCookieName(),token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:sessionMaxAge()});
  }
  return response;
}
