import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { paypalAccessToken } from '@/lib/payments/paypal';
import { paymentConfiguration } from '@/lib/payments/providers';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await requireRole(['administrator', 'developer']);
    return NextResponse.json(paymentConfiguration(), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
export async function POST() {
  try { await requireRole(['administrator', 'developer']); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  try {
    await paypalAccessToken();
    return NextResponse.json({ ok: true, message: 'Sandbox credentials verified. Complete a test checkout to verify capture and the donation record. No money was moved.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Sandbox connection failed. Check PAYPAL_ENV=sandbox, the sandbox Client ID and Secret, and ADMIN_SESSION_SECRET.' }, { status: 503 }); }
}
