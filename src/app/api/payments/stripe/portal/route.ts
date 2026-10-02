import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { verifyReceiptToken } from '@/lib/payments/receipt-token';
import { stripeRequest } from '@/lib/payments/stripe';
export async function POST(request:Request){
  try{const id=verifyReceiptToken((request.headers.get('authorization')||'').replace(/^Bearer /,''));if(!id)return NextResponse.json({error:'Link expired. Use the ministry’s Manage monthly giving link.'},{status:401});const sql=sqlClient();const rows=await sql`SELECT provider_customer_id FROM giving_subscriptions WHERE id=${id}`;
    if(!rows[0]?.provider_customer_id)return NextResponse.json({error:'Subscription setup is still being confirmed. Please try again shortly.'},{status:409});
    const session=await stripeRequest('billing_portal/sessions',new URLSearchParams({customer:rows[0].provider_customer_id,return_url:new URL('/',request.url).toString()}));return NextResponse.json({url:session.url});
  }catch{return NextResponse.json({error:'The subscription portal is temporarily unavailable.'},{status:503});}
}
