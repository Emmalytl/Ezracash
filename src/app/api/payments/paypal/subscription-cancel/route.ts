import { NextResponse } from 'next/server';
import { verifyReceiptToken } from '@/lib/payments/receipt-token';
import { getMonthly, refreshMonthly } from '@/lib/payments/paypal-subscriptions';
import { paypalAPI, paypalErrorResponse, PayPalError } from '@/lib/payments/paypal';
export async function POST(request:Request){try{
 const id=verifyReceiptToken((request.headers.get('authorization')||'').replace(/^Bearer /,''));if(!id)throw new PayPalError('Invalid or expired confirmation. Cancel directly in PayPal.',401);
 const local=await getMonthly(id);if(!local?.provider_subscription_id)throw new PayPalError('Subscription not found.',404);
 const remote=await refreshMonthly(local);if(remote.status!=='CANCELLED')await paypalAPI('/v1/billing/subscriptions/'+encodeURIComponent(local.provider_subscription_id)+'/cancel',{reason:'Donor requested cancellation'});
 const updated=await refreshMonthly(local);return NextResponse.json({status:updated.status},{headers:{'Cache-Control':'no-store'}});
}catch(e){const f=paypalErrorResponse(e);return NextResponse.json({error:f.error},{status:f.status});}}
