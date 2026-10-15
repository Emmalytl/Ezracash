import { NextResponse } from 'next/server';
import { paymentConfiguration } from '@/lib/payments/providers';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json(paymentConfiguration(), { headers: { 'Cache-Control': 'no-store' } });
}
