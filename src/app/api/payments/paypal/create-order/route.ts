import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { createReceiptToken } from '@/lib/payments/receipt-token';
import { requireSandbox, validatePayPalGift, ensurePayPalSchema, paypalRequest, paypalErrorResponse, PayPalError } from '@/lib/payments/paypal';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    requireSandbox();
    const gift = validatePayPalGift(await request.json());
    const id = randomUUID(), receiptToken = createReceiptToken(id);
    await ensurePayPalSchema();
    const sql = sqlClient();
    if (gift.campaignId) {
      const rows = await sql`SELECT id FROM campaigns WHERE id=${gift.campaignId} AND status='active' LIMIT 1`;
      if (!rows.length) throw new PayPalError('That campaign is not accepting gifts.');
    }
    await sql`INSERT INTO sandbox_donations(id,campaign_id,donation_type,donor_name,donor_email,amount,payment_method,status,payment_provider) VALUES(${id},${gift.campaignId},${gift.donationType},${gift.donorName},${gift.email},${gift.amount},${gift.method + ' (Sandbox)'},'pending','paypal-sandbox')`;
    try {
      const order = await paypalRequest('', { intent: 'CAPTURE', purchase_units: [{ custom_id: id, description: 'House of Ezra sandbox gift — no real money', amount: { currency_code: 'USD', value: gift.amount.toFixed(2) } }], application_context: { shipping_preference: 'NO_SHIPPING' } }, `ezra-create-${id}`);
      if (!/^[A-Z0-9]{10,32}$/.test(order.id || '')) throw new PayPalError('Invalid sandbox order response.', 502);
      await sql`UPDATE sandbox_donations SET transaction_id=${order.id} WHERE id=${id} AND payment_provider='paypal-sandbox'`;
      return NextResponse.json({ orderId: order.id, receiptToken, mode: 'sandbox' }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      await sql`UPDATE sandbox_donations SET status='failed' WHERE id=${id} AND transaction_id IS NULL`;
      throw error;
    }
  } catch (error) {
    const failure = paypalErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
