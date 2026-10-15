import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { paypalAPI, paypalProvider, paypalMode, paypalRequest, reconcilePayPalOrder, ensurePayPalSchema } from '@/lib/payments/paypal';
import { recordMonthlySale, refreshMonthly, ensureMonthlySchema } from '@/lib/payments/paypal-subscriptions';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!process.env.PAYPAL_WEBHOOK_ID)return NextResponse.json({error:'Webhook not configured.'},{status:503});
 try{
  const text=await request.text();if(text.length>1000000)return NextResponse.json({error:'Payload too large.'},{status:413});
  const event=JSON.parse(text);
  const fields=['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'];if(fields.some(k=>!request.headers.get(k)))return NextResponse.json({error:'Missing signature.'},{status:400});
  // PayPal verifies its own transmission signature against this environment's webhook ID.
  const verified=await paypalAPI('/v1/notifications/verify-webhook-signature',{auth_algo:request.headers.get(fields[0]),cert_url:request.headers.get(fields[1]),transmission_id:request.headers.get(fields[2]),transmission_sig:request.headers.get(fields[3]),transmission_time:request.headers.get(fields[4]),webhook_id:process.env.PAYPAL_WEBHOOK_ID,webhook_event:event});
  if(verified.verification_status!=='SUCCESS')return NextResponse.json({error:'Invalid signature.'},{status:400});
  await ensurePayPalSchema();await ensureMonthlySchema();const sql=sqlClient();const resource=event.resource||{};
  if(event.event_type==='PAYMENT.CAPTURE.COMPLETED'){
   const orderId=resource.supplementary_data?.related_ids?.order_id;
   if(!orderId)throw new Error('Missing order reference');
   const gifts=await sql`SELECT * FROM paypal_gifts WHERE transaction_id=${orderId} AND payment_provider=${paypalProvider()}`;
   if(!gifts[0])throw new Error('Gift not linked yet');
   await reconcilePayPalOrder(await paypalRequest(encodeURIComponent(orderId)),gifts[0]);
  }else if(event.event_type==='PAYMENT.SALE.COMPLETED')await recordMonthlySale(resource);
  else if(event.event_type?.startsWith('BILLING.SUBSCRIPTION.')){
   const rows=await sql`SELECT * FROM paypal_subscriptions WHERE provider_subscription_id=${resource.id} AND payment_provider=${paypalProvider()}`;
   if(rows[0])await refreshMonthly(rows[0]);
  }else if(event.event_type==='PAYMENT.CAPTURE.REFUNDED'||event.event_type==='PAYMENT.SALE.REFUNDED'){
   // Fully refunded gifts leave income totals; partial refunds are retained for review.
   const capture=resource.supplementary_data?.related_ids?.capture_id||resource.sale_id;
   if(!capture)throw new Error('Missing refund reference');
   if(resource.status!=='COMPLETED'&&resource.state!=='completed')throw new Error('Refund not completed');
   const value=resource.amount?.value||resource.amount?.total;const currency=resource.amount?.currency_code||resource.amount?.currency;
   if(currency!=='USD'||!Number.isFinite(Number(value)))throw new Error('Invalid refund amount');
   if(paypalMode()==='live')await sql`UPDATE donations SET status='refunded' WHERE payment_provider='paypal' AND transaction_id=${capture} AND amount=${value} AND status='completed'`;
   await sql`UPDATE paypal_gifts SET status='refunded' WHERE capture_id=${capture} AND payment_provider=${paypalProvider()} AND amount=${value} AND status='completed'`;
  }
  await sql`CREATE TABLE IF NOT EXISTS paypal_webhook_events(event_id TEXT PRIMARY KEY,event_type TEXT NOT NULL,payment_provider TEXT NOT NULL,payload JSONB NOT NULL,received_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`INSERT INTO paypal_webhook_events(event_id,event_type,payment_provider,payload) VALUES(${event.id},${event.event_type},${paypalProvider()},${JSON.stringify(event)}) ON CONFLICT(event_id) DO NOTHING`;
  return NextResponse.json({received:true});
 }catch{return NextResponse.json({error:'Webhook could not be reconciled. It will need retry or review.'},{status:503});}
}
