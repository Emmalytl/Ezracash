import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { ensureSubscriptionSchema } from '@/lib/payments/subscriptions';
import { stripeRequest, stripeSecret } from '@/lib/payments/stripe';
import { createReceiptToken } from '@/lib/payments/receipt-token';
export const runtime='nodejs';
export async function POST(request:Request) {
  let id:string|undefined;
  try {
    const body=await request.json(); const amount=Number(body.amount); const cents=Math.round(amount*100);
    const type=String(body.donation_type||'general'); const email=String(body.donor_email||'').trim();
    const name=String(body.donor_name||'Anonymous').trim().slice(0,160)||'Anonymous';
    const campaign=type==='campaign'?String(body.campaign_id||''):null;
    if(body.recurring_consent!==true) return NextResponse.json({error:'Please agree to the monthly giving terms.'},{status:400});
    if(!Number.isFinite(amount)||cents<50||amount>999999.99||Math.abs(amount*100-cents)>0.000001) return NextResponse.json({error:'Enter at least $0.50 with no more than two decimal places.'},{status:400});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>320) return NextResponse.json({error:'A valid email is required for monthly giving.'},{status:400});
    if(!['tithe','general','offering','campaign'].includes(type)||(type==='campaign'&&!/^[0-9a-f-]{36}$/i.test(campaign||''))) return NextResponse.json({error:'Choose a valid giving destination.'},{status:400});
    stripeSecret();
    const portalUrl=process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL;
    if(!portalUrl || !portalUrl.startsWith('https://billing.stripe.com/')) return NextResponse.json({error:'Monthly giving is not ready yet. The ministry must configure its subscription management portal.'},{status:503});
    const tokenCheck=createReceiptToken('00000000-0000-0000-0000-000000000000'); void tokenCheck;
    await ensureSubscriptionSchema(); const sql=sqlClient();
    if(campaign){const rows=await sql`SELECT id FROM campaigns WHERE id=${campaign} AND status='active'`;if(!rows.length)return NextResponse.json({error:'This campaign is not accepting gifts.'},{status:400});}
    const rows=await sql`INSERT INTO giving_subscriptions(campaign_id,donation_type,donor_name,donor_email,amount) VALUES(${campaign},${type},${name},${email},${amount}) RETURNING id`; id=String(rows[0].id);
    const token=createReceiptToken(id); const origin=new URL(request.url).origin;
    const params=new URLSearchParams({mode:'subscription',customer_email:email,'payment_method_types[0]':'card','line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(cents),'line_items[0][price_data][recurring][interval]':'month','line_items[0][price_data][product_data][name]':`House of Ezra · monthly ${type} giving`,'line_items[0][quantity]':'1','subscription_data[metadata][giving_subscription_id]':id,'metadata[giving_subscription_id]':id,success_url:`${origin}/giving/monthly#${token}`,cancel_url:`${origin}/?monthly=canceled`,'custom_text[submit][message]':`You authorise a ${amount.toFixed(2)} USD donation now and each month until canceled. Manage or cancel through the ministry's Stripe portal.`});
    const session=await stripeRequest('checkout/sessions',params);
    await sql`UPDATE giving_subscriptions SET checkout_session_id=${session.id} WHERE id=${id}`;
    return NextResponse.json({url:session.url});
  } catch {
    if(id){try{const sql=sqlClient();await sql`UPDATE giving_subscriptions SET status='setup_failed' WHERE id=${id}`;}catch{}}
    return NextResponse.json({error:'Monthly checkout could not be prepared. Please try again or contact the ministry.'},{status:503});
  }
}
