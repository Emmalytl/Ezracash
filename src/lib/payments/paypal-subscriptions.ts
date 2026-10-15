import { sqlClient } from '@/lib/db';
import { paypalAPI, paypalProvider, PayPalError } from './paypal';
export async function ensureMonthlySchema(){
 const sql=sqlClient();
 await sql`CREATE TABLE IF NOT EXISTS paypal_subscriptions(id UUID PRIMARY KEY,campaign_id UUID REFERENCES campaigns(id),donation_type TEXT NOT NULL,donor_name TEXT NOT NULL,donor_email TEXT NOT NULL,amount NUMERIC(12,2) NOT NULL,plan_id TEXT,provider_subscription_id TEXT UNIQUE,payment_provider TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS paypal_monthly_payments(transaction_id TEXT PRIMARY KEY,subscription_id UUID NOT NULL REFERENCES paypal_subscriptions(id),amount NUMERIC(12,2) NOT NULL,payment_provider TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
}
export async function getMonthly(id:string){const sql=sqlClient();const rows=await sql`SELECT * FROM paypal_subscriptions WHERE id=${id} AND payment_provider=${paypalProvider()}`;return rows[0];}
export async function refreshMonthly(record:any){
 const remote=await paypalAPI('/v1/billing/subscriptions/'+encodeURIComponent(record.provider_subscription_id));
 if(remote.id!==record.provider_subscription_id||remote.custom_id!==record.id||remote.plan_id!==record.plan_id)throw new PayPalError('Subscription does not match the agreed gift.',409);
 const sql=sqlClient();await sql`UPDATE paypal_subscriptions SET status=${remote.status} WHERE id=${record.id} AND payment_provider=${paypalProvider()}`;return remote;
}
export async function recordMonthlySale(resource:any){
 const subscription=String(resource.billing_agreement_id||'');if(!subscription)return;
 const sql=sqlClient();const rows=await sql`SELECT * FROM paypal_subscriptions WHERE provider_subscription_id=${subscription} AND payment_provider=${paypalProvider()}`;const local=rows[0];if(!local)throw new PayPalError('Subscription payment is not linked yet.',409);
 await refreshMonthly(local);
 // A subscription approval is not a payment. Verify the actual sale server-side.
 const occurred=new Date(resource.create_time||'');if(!Number.isFinite(occurred.getTime()))throw new PayPalError('Monthly payment timestamp is invalid.',409);
 const start=new Date(occurred.getTime()-86400000).toISOString(),end=new Date(Math.min(Date.now(),occurred.getTime()+86400000)).toISOString();
 const history=await paypalAPI('/v1/billing/subscriptions/'+encodeURIComponent(subscription)+'/transactions?'+new URLSearchParams({start_time:start,end_time:end}));
 const sale=history.transactions?.find((t:any)=>t.id===resource.id);
 const gross=sale?.amount_with_breakdown?.gross_amount;
 if(!sale||gross?.currency_code!=='USD'||gross?.value!==Number(local.amount).toFixed(2))throw new PayPalError('Monthly payment does not match the subscription.',409);
 if(sale.status!=='COMPLETED')return;
 await sql`WITH accepted AS (
 INSERT INTO paypal_monthly_payments(transaction_id,subscription_id,amount,payment_provider) VALUES(${sale.id},${local.id},${local.amount},${paypalProvider()}) ON CONFLICT(transaction_id) DO NOTHING RETURNING *
 ) INSERT INTO donations(campaign_id,donation_type,donor_name,donor_email,amount,payment_method,transaction_id,status,payment_provider,completed_at)
 SELECT ${local.campaign_id},${local.donation_type},${local.donor_name},${local.donor_email},amount,'PayPal (Monthly)',transaction_id,'completed','paypal',NOW() FROM accepted WHERE payment_provider='paypal-live'
 ON CONFLICT(payment_provider,transaction_id) WHERE transaction_id IS NOT NULL DO NOTHING`;
}
