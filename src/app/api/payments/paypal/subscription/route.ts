import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { paymentConfiguration } from '@/lib/payments/providers';
import { validatePayPalGift, paypalAPI, paypalProvider, paypalErrorResponse, PayPalError, ensurePayPalSchema } from '@/lib/payments/paypal';
import { ensureMonthlySchema } from '@/lib/payments/paypal-subscriptions';
import { createReceiptToken } from '@/lib/payments/receipt-token';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  if(!paymentConfiguration().paypal.monthly)throw new PayPalError('Monthly giving is not configured yet. Please use a one-time gift or contact the ministry.',503);
  const body=await request.json();if(body.recurring_consent!==true)throw new PayPalError('Please agree to the monthly giving terms.');
  const gift=validatePayPalGift({...body,frequency:'One-time',payment_method:'PayPal'});if(!gift.email)throw new PayPalError('An email is required for monthly giving.');
  const origin=new URL(process.env.NEXT_PUBLIC_APP_URL||'');if(origin.protocol!=='https:')throw new PayPalError('Monthly return URL is not configured.',503);
  await ensurePayPalSchema();await ensureMonthlySchema();const sql=sqlClient();
  if(gift.campaignId){const active=await sql`SELECT id FROM campaigns WHERE id=${gift.campaignId} AND status='active'`;if(!active.length)throw new PayPalError('This campaign is not accepting gifts.');}
  const id=randomUUID(),token=createReceiptToken(id);
  await sql`INSERT INTO paypal_subscriptions(id,campaign_id,donation_type,donor_name,donor_email,amount,payment_provider) VALUES(${id},${gift.campaignId},${gift.donationType},${gift.donorName},${gift.email},${gift.amount},${paypalProvider()})`;
  const plan=await paypalAPI('/v1/billing/plans',{product_id:process.env.PAYPAL_PRODUCT_ID,name:'House of Ezra monthly giving',status:'ACTIVE',billing_cycles:[{frequency:{interval_unit:'MONTH',interval_count:1},tenure_type:'REGULAR',sequence:1,total_cycles:0,pricing_scheme:{fixed_price:{value:gift.amount.toFixed(2),currency_code:'USD'}}}],payment_preferences:{auto_bill_outstanding:true,setup_fee_failure_action:'CANCEL',payment_failure_threshold:3}},'ezra-plan-'+id);
  if(!plan.id)throw new PayPalError('Monthly plan could not be prepared.',502);
  await sql`UPDATE paypal_subscriptions SET plan_id=${plan.id} WHERE id=${id}`;
  const subscription=await paypalAPI('/v1/billing/subscriptions',{plan_id:plan.id,custom_id:id,subscriber:{email_address:gift.email},application_context:{brand_name:'House of Ezra Giving',shipping_preference:'NO_SHIPPING',user_action:'SUBSCRIBE_NOW',return_url:origin.origin+'/giving/monthly#'+token,cancel_url:origin.origin+'/?monthly=canceled'}},'ezra-subscribe-'+id);
  const url=subscription.links?.find((l:any)=>l.rel==='approve')?.href;
  const host=new URL(url||'').hostname;if(!['www.paypal.com','www.sandbox.paypal.com'].includes(host)||new URL(url).protocol!=='https:')throw new PayPalError('Invalid subscription destination.',502);
  await sql`UPDATE paypal_subscriptions SET provider_subscription_id=${subscription.id} WHERE id=${id}`;
  return NextResponse.json({url},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const f=paypalErrorResponse(e);return NextResponse.json({error:f.error},{status:f.status});}
}
