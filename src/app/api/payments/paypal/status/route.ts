import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { verifyReceiptToken } from '@/lib/payments/receipt-token';
import { requireSandbox, paypalRequest, reconcilePayPalOrder, PayPalError, paypalErrorResponse } from '@/lib/payments/paypal';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    requireSandbox();
    const id = verifyReceiptToken((request.headers.get('authorization') || '').replace(/^Bearer /, ''));
    if (!id) throw new PayPalError('This sandbox confirmation link is invalid or expired.', 401);
    const sql = sqlClient();
    let rows = await sql`SELECT id,status,amount,donor_name,donor_email,donation_type,payment_method,payment_provider,transaction_id,created_at,completed_at FROM sandbox_donations WHERE id=${id} AND payment_provider='paypal-sandbox' LIMIT 1`;
    if (!rows[0]) throw new PayPalError('Sandbox gift not found.', 404);
    if (rows[0].status === 'pending' && rows[0].transaction_id) {
      await reconcilePayPalOrder(await paypalRequest(encodeURIComponent(rows[0].transaction_id)), rows[0]);
      rows = await sql`SELECT id,status,amount,donor_name,donor_email,donation_type,payment_method,payment_provider,transaction_id,created_at,completed_at FROM sandbox_donations WHERE id=${id} AND payment_provider='paypal-sandbox' LIMIT 1`;
    }
    return NextResponse.json({ ...rows[0], mode: 'sandbox' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const failure = paypalErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
