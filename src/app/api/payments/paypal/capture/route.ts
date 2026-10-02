import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { verifyReceiptToken } from '@/lib/payments/receipt-token';
import { requireSandbox, paypalRequest, verifyPayPalOrder, reconcilePayPalOrder, PayPalError, paypalErrorResponse } from '@/lib/payments/paypal';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    requireSandbox();
    const id = verifyReceiptToken((request.headers.get('authorization') || '').replace(/^Bearer /, ''));
    if (!id) throw new PayPalError('This sandbox confirmation link is invalid or expired.', 401);
    const { orderId } = await request.json();
    const sql = sqlClient();
    const rows = await sql`SELECT * FROM sandbox_donations WHERE id=${id} AND payment_provider='paypal-sandbox' LIMIT 1`;
    const gift = rows[0];
    if (!gift || gift.transaction_id !== orderId) throw new PayPalError('Sandbox order not found for this gift.', 404);
    let order = await paypalRequest(encodeURIComponent(gift.transaction_id));
    verifyPayPalOrder(order, gift);
    if (order.status === 'APPROVED') {
      try { order = await paypalRequest(`${encodeURIComponent(gift.transaction_id)}/capture`, {}, `ezra-capture-${id}`); }
      catch { order = await paypalRequest(encodeURIComponent(gift.transaction_id)); }
    }
    const captureId = await reconcilePayPalOrder(order, gift);
    return NextResponse.json({ mode: 'sandbox', status: captureId ? 'completed' : 'pending' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const failure = paypalErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
