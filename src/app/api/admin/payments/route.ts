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
    return NextResponse.json({ ok: true, message: 'PayPal credentials verified for the configured environment. This check moved no money; checkout, capture and webhook still need verification.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'PayPal connection failed. Check the selected environment, matching credentials and required live configuration.' }, { status: 503 }); }
}
