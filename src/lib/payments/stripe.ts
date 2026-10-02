import crypto from 'crypto';

export function stripeSecret() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_NOT_CONFIGURED');
  return key;
}

export function stripePublishableKey() {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
}

export async function stripeRequest(path: string, params: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Stripe request failed.');
  return data;
}

export function verifyStripeSignature(payload: string, signature: string, secret: string) {
  const parts = signature.split(',').reduce<Record<string,string[]>>((acc, item) => {
    const [k,v] = item.split('=',2);
    if (k && v) (acc[k] ||= []).push(v);
    return acc;
  }, {});
  const timestamp = parts.t?.[0];
  const signatures = parts.v1 || [];
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;
  const tolerance = 300;
  if (Math.abs(Math.floor(Date.now()/1000) - Number(timestamp)) > tolerance) return false;
  const signed = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  return signatures.some(s => /^[0-9a-f]{64}$/i.test(s) && crypto.timingSafeEqual(Buffer.from(s, 'hex'), Buffer.from(expected, 'hex')));
}

export async function stripeRetrieve(path: string) {
  const response=await fetch(`https://api.stripe.com/v1/${path}`,{headers:{Authorization:`Bearer ${stripeSecret()}`},cache:'no-store'});
  const data=await response.json();
  if(!response.ok) throw new Error(data?.error?.message || 'Could not retrieve Stripe record.');
  return data;
}
