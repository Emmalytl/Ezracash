import { NextRequest, NextResponse } from 'next/server';
import { mutationOriginAllowed } from './lib/request-security';
export function middleware(request: NextRequest) {
  if (['POST','PUT','PATCH','DELETE'].includes(request.method) && request.nextUrl.pathname !== '/api/payments/paypal/webhook') {
    if (!mutationOriginAllowed(request)) return NextResponse.json({error:'Request origin is not allowed.'},{status:403});
    const size=Number(request.headers.get('content-length')||0);
    if (!Number.isFinite(size)||size>5*1024*1024) return NextResponse.json({error:'Request is too large.'},{status:413});
  }
  return NextResponse.next();
}
export const config={matcher:'/api/:path*'};
