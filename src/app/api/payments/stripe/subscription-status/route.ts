import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { verifyReceiptToken } from '@/lib/payments/receipt-token';
export async function GET(request:Request){
  try{const id=verifyReceiptToken((request.headers.get('authorization')||'').replace(/^Bearer /,''));if(!id)return NextResponse.json({error:'Confirmation link expired. Use Manage monthly giving to access your subscription.'},{status:401});
    const sql=sqlClient();const rows=await sql`SELECT s.id,s.amount,s.status,EXISTS(SELECT 1 FROM donations d WHERE d.subscription_id=s.id AND d.status='completed') AS first_payment_confirmed FROM giving_subscriptions s WHERE s.id=${id}`;
    if(!rows[0])return NextResponse.json({error:'Subscription not found.'},{status:404});return NextResponse.json(rows[0],{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Confirmation is temporarily unavailable.'},{status:503});}
}
