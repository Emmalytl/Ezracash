import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { verifyReceiptToken } from '@/lib/payments/receipt-token';
import { requirePayPal, paypalRequest, reconcilePayPalOrder, PayPalError, paypalErrorResponse, paypalProvider, paypalMode } from '@/lib/payments/paypal';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    requirePayPal();
    const id = verifyReceiptToken((request.headers.get('authorization') || '').replace(/^Bearer /, ''));
    if (!id) throw new PayPalError('This payment confirmation link is invalid or expired.', 401);
    const sql = sqlClient();
    let rows = await sql`SELECT id,status,amount,donor_name,donor_email,donation_type,payment_method,payment_provider,transaction_id,created_at,completed_at FROM paypal_gifts WHERE id=${id} AND payment_provider=${paypalProvider()} LIMIT 1`;
    if (!rows[0]) throw new PayPalError('Gift not found.', 404);
    if (rows[0].status === 'pending' && rows[0].transaction_id) {
      await reconcilePayPalOrder(await paypalRequest(encodeURIComponent(rows[0].transaction_id)), rows[0]);
      rows = await sql`SELECT id,status,amount,donor_name,donor_email,donation_type,payment_method,payment_provider,transaction_id,created_at,completed_at FROM paypal_gifts WHERE id=${id} AND payment_provider=${paypalProvider()} LIMIT 1`;
    }
    return NextResponse.json({ id:rows[0].id, status:rows[0].status, amount:rows[0].amount, donor_name:rows[0].donor_name, donation_type:rows[0].donation_type, payment_method:rows[0].payment_method, transaction_id:rows[0].transaction_id, created_at:rows[0].created_at, completed_at:rows[0].completed_at, mode: paypalMode() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const failure = paypalErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
