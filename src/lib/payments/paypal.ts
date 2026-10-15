import { sqlClient } from '@/lib/db';
import { paymentConfiguration } from './providers';
export class PayPalError extends Error { constructor(message:string,public status=400){super(message);} }
export function paypalMode(){ return process.env.PAYPAL_ENV || 'sandbox'; }
export function paypalProvider(){ return 'paypal-'+paypalMode(); }
export function requirePayPal(){if(!paymentConfiguration().paypal.configured)throw new PayPalError('PayPal is not configured for this environment. Please contact the ministry.',503);}
export function paypalBase(){ requirePayPal();return paypalMode()==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com'; }
export async function paypalAccessToken(){
 const response=await fetch(`${paypalBase()}/v1/oauth2/token`,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Authorization:`Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
 const data=await response.json();if(!response.ok||!data.access_token)throw new PayPalError('PayPal credentials could not be verified for the selected environment.',503);return String(data.access_token);
}
export async function paypalAPI(path:string,body?:unknown,requestId?:string){
 if(!/^\/v[12]\//.test(path))throw new Error('Invalid provider API path');
 const token=await paypalAccessToken();const response=await fetch(paypalBase()+path,{method:body===undefined?'GET':'POST',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation',...(requestId?{'PayPal-Request-Id':requestId}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const data=response.status===204?{}:await response.json();if(!response.ok)throw new PayPalError('PayPal could not confirm this request. Check confirmation before trying another payment.',502);return data;
}
export function paypalRequest(path:string,body?:unknown,requestId?:string){return paypalAPI('/v2/checkout/orders/'+path,body,requestId);}
export function validatePayPalGift(body: any) {
  const amount = Number(body.amount), cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || cents < 50 || amount > 999999.99 || Math.abs(amount * 100 - cents) > 0.000001) throw new PayPalError('Enter a valid gift of at least $0.50 with no more than two decimal places.');
  const donationType = String(body.donation_type || 'general');
  if (!['tithe', 'general', 'offering', 'campaign'].includes(donationType)) throw new PayPalError('Invalid giving type.');
  if (body.frequency && body.frequency !== 'One-time') throw new PayPalError('This endpoint accepts one-time gifts only.');
  const method = String(body.payment_method || 'PayPal');
  if (!['PayPal', 'Card', 'Apple Pay', 'Google Pay'].includes(method)) throw new PayPalError('Unsupported payment method.');
  const c = paymentConfiguration().paypal;
  if ((method === 'Apple Pay' && !c.applePay) || (method === 'Google Pay' && !c.googlePay)) throw new PayPalError('This wallet is not enabled.',503);
  const campaignId = donationType === 'campaign' ? String(body.campaign_id || '') : null;
  if (donationType === 'campaign' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId || '')) throw new PayPalError('Choose an available campaign.');
  const email = String(body.donor_email || '').trim();
  if (email.length > 320 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new PayPalError('Enter a valid email address.');
  return { amount: cents / 100, donationType, method, campaignId, donorName: String(body.donor_name || 'Anonymous').trim().slice(0,160) || 'Anonymous', email: email || null };
}
export async function ensurePayPalSchema(){
 const sql=sqlClient();
 await sql`CREATE TABLE IF NOT EXISTS paypal_gifts(id UUID PRIMARY KEY,campaign_id UUID REFERENCES campaigns(id),donation_type TEXT NOT NULL,donor_name TEXT NOT NULL,donor_email TEXT,amount NUMERIC(12,2) NOT NULL CHECK(amount>=0.50),payment_method TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',payment_provider TEXT NOT NULL,transaction_id TEXT UNIQUE,capture_id TEXT UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),completed_at TIMESTAMPTZ)`;
 await sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'manual'`;
 await sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`;
 await sql`CREATE UNIQUE INDEX IF NOT EXISTS donations_provider_txn_idx ON donations(payment_provider,transaction_id) WHERE transaction_id IS NOT NULL`;
}
export async function findPayPalGift(id:string){const sql=sqlClient();const rows=await sql`SELECT * FROM paypal_gifts WHERE id=${id} AND payment_provider=${paypalProvider()} LIMIT 1`;return rows[0];}
// Never trust approval in the browser: bind amount, recipient, currency and reference.
export function verifyPayPalOrder(order:any,gift:any){
 if(order.id!==gift.transaction_id||order.intent!=='CAPTURE'||!Array.isArray(order.purchase_units)||order.purchase_units.length!==1)throw new PayPalError('Order does not match this gift.',409);
 const u=order.purchase_units[0];
 if(u.custom_id!==String(gift.id)||u.amount?.currency_code!=='USD'||u.amount?.value!==Number(gift.amount).toFixed(2))throw new PayPalError('Order amount or reference does not match this gift.',409);
 if(paypalMode()==='live'&&u.payee?.merchant_id!==process.env.PAYPAL_MERCHANT_ID)throw new PayPalError('Payment recipient does not match the ministry.',409);
 return u;
}
export function verifiedCapture(order:any,gift:any):string|null{
 const unit=verifyPayPalOrder(order,gift);if(order.status!=='COMPLETED')return null;
 const captures=unit.payments?.captures;
 if(!Array.isArray(captures)||captures.length!==1)throw new PayPalError('Capture requires review.',409);
 const c=captures[0];if(c.status!=='COMPLETED')return null;
 if(!c.id||c.amount?.currency_code!=='USD'||c.amount?.value!==Number(gift.amount).toFixed(2))throw new PayPalError('Capture amount does not match this gift.',409);
 return String(c.id);
}
export async function reconcilePayPalOrder(order:any,gift:any){
 const unit=verifyPayPalOrder(order,gift);
 const rejected=order.status==='VOIDED'||unit.payments?.captures?.some((c:any)=>c.status==='DECLINED');
 const refunded=unit.payments?.captures?.some((c:any)=>c.status==='REFUNDED');
 if(rejected||refunded){const sql=sqlClient();await sql`UPDATE paypal_gifts SET status=${refunded?'refunded':'failed'} WHERE id=${gift.id} AND payment_provider=${paypalProvider()} AND status='pending'`;return null;}
 const capture=verifiedCapture(order,gift);if(!capture)return null;const sql=sqlClient();
 // One atomic statement: simulated payments never enter the real donation ledger.
 await sql`WITH confirmed AS (
 UPDATE paypal_gifts SET status='completed',capture_id=${capture},completed_at=COALESCE(completed_at,NOW()) WHERE id=${gift.id} AND payment_provider=${paypalProvider()} AND transaction_id=${gift.transaction_id} AND status IN ('pending','completed') RETURNING *
 ) INSERT INTO donations(id,campaign_id,donation_type,donor_name,donor_email,amount,payment_method,transaction_id,status,payment_provider,completed_at)
 SELECT id,campaign_id,donation_type,donor_name,donor_email,amount,payment_method,${capture},'completed','paypal',completed_at FROM confirmed WHERE payment_provider='paypal-live'
 ON CONFLICT (payment_provider,transaction_id) WHERE transaction_id IS NOT NULL DO NOTHING`;
 return capture;
}
export function paypalErrorResponse(error:unknown){return {error:error instanceof PayPalError?error.message:'Payment is temporarily unavailable. Check confirmation before paying again.',status:error instanceof PayPalError?error.status:503};}
