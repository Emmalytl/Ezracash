import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { verifyReceiptToken } from '@/lib/payments/receipt-token';
import { requirePayPal, paypalRequest, verifyPayPalOrder, reconcilePayPalOrder, PayPalError, paypalErrorResponse, paypalProvider, paypalMode } from '@/lib/payments/paypal';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    requirePayPal();
    const id = verifyReceiptToken((request.headers.get('authorization') || '').replace(/^Bearer /, ''));
    if (!id) throw new PayPalError('This payment confirmation link is invalid or expired.', 401);
    const { orderId } = await request.json();
    const sql = sqlClient();
    const rows = await sql`SELECT * FROM paypal_gifts WHERE id=${id} AND payment_provider=${paypalProvider()} LIMIT 1`;
    const gift = rows[0];
    if (!gift || gift.transaction_id !== orderId) throw new PayPalError('Payment order not found for this gift.', 404);
    let order = await paypalRequest(encodeURIComponent(gift.transaction_id));
    verifyPayPalOrder(order, gift);
    if (order.status === 'APPROVED') {
      try { order = await paypalRequest(`${encodeURIComponent(gift.transaction_id)}/capture`, {}, `ezra-capture-${id}`); }
      catch { order = await paypalRequest(encodeURIComponent(gift.transaction_id)); }
    }
    const captureId = await reconcilePayPalOrder(order, gift);
    return NextResponse.json({ mode: paypalMode(), status: captureId ? 'completed' : 'pending' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const failure = paypalErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
