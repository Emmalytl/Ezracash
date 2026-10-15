import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { verifyReceiptToken } from '@/lib/payments/receipt-token';
import { getMonthly, refreshMonthly } from '@/lib/payments/paypal-subscriptions';
import { paypalErrorResponse, PayPalError, paypalMode } from '@/lib/payments/paypal';
export const runtime='nodejs';
export async function GET(request:Request){try{
 const id=verifyReceiptToken((request.headers.get('authorization')||'').replace(/^Bearer /,''));if(!id)throw new PayPalError('Confirmation link is invalid or expired. Manage your subscription directly in PayPal.',401);
 const record=await getMonthly(id);if(!record?.provider_subscription_id)throw new PayPalError('Subscription not found.',404);
 const remote=await refreshMonthly(record);const sql=sqlClient();const payments=await sql`SELECT transaction_id FROM paypal_monthly_payments WHERE subscription_id=${id} LIMIT 1`;
 return NextResponse.json({status:remote.status,amount:record.amount,first_payment_confirmed:payments.length>0,mode:paypalMode()},{headers:{'Cache-Control':'no-store'}});
}catch(e){const f=paypalErrorResponse(e);return NextResponse.json({error:f.error},{status:f.status});}}
