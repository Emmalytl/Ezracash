import { sqlClient } from '@/lib/db';
import { paymentConfiguration } from './providers';

export class PayPalError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function requireSandbox() {
  if (!paymentConfiguration().paypal.configured) throw new PayPalError('PayPal sandbox is not configured. Ask the ministry administrator to complete setup.', 503);
}
// All PayPal API traffic is pinned to sandbox; no live endpoint exists in this release.
const base = 'https://api-m.sandbox.paypal.com';
export async function paypalAccessToken() {
  requireSandbox();
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new PayPalError('PayPal sandbox credentials could not be verified. Check the sandbox app Client ID and Secret.', 503);
  return String(data.access_token);
}
export async function paypalRequest(path: string, body?: unknown, requestId?: string) {
  const accessToken = await paypalAccessToken();
  const response = await fetch(`${base}/v2/checkout/orders/${path}`, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new PayPalError('PayPal could not complete this sandbox request. Check confirmation before trying another payment.', 502);
  return data;
}
export function validatePayPalGift(body: any) {
  const amount = Number(body.amount), cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || cents < 50 || amount > 999999.99 || Math.abs(amount * 100 - cents) > 0.000001) throw new PayPalError('Enter a valid gift of at least $0.50 with no more than two decimal places.');
  const donationType = String(body.donation_type || 'general');
  if (!['tithe', 'general', 'offering', 'campaign'].includes(donationType)) throw new PayPalError('Invalid giving type.');
  if (body.frequency && body.frequency !== 'One-time') throw new PayPalError('PayPal and Venmo sandbox currently support one-time gifts only.');
  const method = String(body.payment_method || 'PayPal');
  if (!['PayPal', 'Venmo'].includes(method)) throw new PayPalError('Unsupported payment method.');
  if (method === 'Venmo' && !paymentConfiguration().venmo.configured) throw new PayPalError('Venmo sandbox has not been enabled.', 503);
  const campaignId = donationType === 'campaign' ? String(body.campaign_id || '') : null;
  if (donationType === 'campaign' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId || '')) throw new PayPalError('Choose an available campaign.');
  const email = String(body.donor_email || '').trim();
  if (email.length > 320 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new PayPalError('Enter a valid email address.');
  return { amount: cents / 100, donationType, method, campaignId, donorName: String(body.donor_name || 'Anonymous').trim().slice(0,160) || 'Anonymous', email: email || null };
}
export async function ensurePayPalSchema() {
  const sql = sqlClient();
  // Keep simulated gifts entirely outside the real donation ledger and campaign totals.
  await sql`CREATE TABLE IF NOT EXISTS sandbox_donations (
    id UUID PRIMARY KEY, campaign_id UUID REFERENCES campaigns(id), donation_type TEXT NOT NULL,
    donor_name TEXT NOT NULL, donor_email TEXT, amount NUMERIC(12,2) NOT NULL CHECK(amount>=0.50),
    payment_method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    payment_provider TEXT NOT NULL DEFAULT 'paypal-sandbox', transaction_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ
  )`;
}
// Bind the provider response to the stored gift before capturing or crediting anything.
export function verifyPayPalOrder(order: any, gift: any) {
  const units = order.purchase_units;
  if (order.id !== gift.transaction_id || order.intent !== 'CAPTURE' || !Array.isArray(units) || units.length !== 1) throw new PayPalError('Sandbox order does not match this gift.', 409);
  const unit = units[0];
  if (unit.custom_id !== String(gift.id) || unit.amount?.currency_code !== 'USD' || unit.amount?.value !== Number(gift.amount).toFixed(2)) throw new PayPalError('Sandbox amount or reference does not match this gift.', 409);
  return unit;
}
export function verifiedCapture(order: any, gift: any): string | null {
  const unit = verifyPayPalOrder(order, gift);
  if (order.status !== 'COMPLETED') return null;
  const captures = unit.payments?.captures;
  if (!Array.isArray(captures) || captures.length !== 1) throw new PayPalError('Sandbox capture requires review.', 409);
  const capture = captures[0];
  if (capture.status !== 'COMPLETED') return null;
  if (!capture.id || capture.amount?.currency_code !== 'USD' || capture.amount?.value !== Number(gift.amount).toFixed(2)) throw new PayPalError('Sandbox capture amount does not match this gift.', 409);
  return String(capture.id);
}
export async function reconcilePayPalOrder(order: any, gift: any) {
  const captureId = verifiedCapture(order, gift);
  if (captureId) {
    const sql = sqlClient();
    await sql`UPDATE sandbox_donations SET status='completed',completed_at=COALESCE(completed_at,NOW()) WHERE id=${gift.id} AND payment_provider='paypal-sandbox' AND transaction_id=${gift.transaction_id} AND status='pending'`;
  }
  return captureId;
}
export function paypalErrorResponse(error: unknown) {
  return { error: error instanceof PayPalError ? error.message : 'Sandbox payment is temporarily unavailable. Check confirmation before paying again.', status: error instanceof PayPalError ? error.status : 503 };
}
