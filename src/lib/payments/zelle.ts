import { sqlClient } from '@/lib/db';
import type { AuthUser } from '@/lib/auth';
import { paymentConfiguration } from './providers';

export class ZelleError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
// A bank transfer is attested by an authorized human, never by a donor's browser.
export function validateZelleRecord(body: any, user: AuthUser) {
  if (!['administrator', 'developer'].includes(user.role)) throw new ZelleError('Only an administrator or developer can verify a Zelle bank transaction.', 403);
  const config = paymentConfiguration().zelle;
  if (!config.configured || config.mode !== 'live') throw new ZelleError('Zelle is not enabled for real bank receipts. Test previews cannot be recorded as received donations.', 409);
  if (body.bank_verified !== true) throw new ZelleError('Confirm that the gift has arrived in the organizational bank account.');
  if (body.status && body.status !== 'completed') throw new ZelleError('Only a bank-verified received Zelle gift can be recorded.');
  const reference = String(body.transaction_id || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._:-]{3,99}$/.test(reference)) throw new ZelleError('Enter the bank transaction reference (4–100 letters, numbers or . _ : -).');
  const amount = Number(body.amount), cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || cents < 1 || amount > 999999.99 || Math.abs(amount * 100 - cents) > 0.000001) throw new ZelleError('Enter the exact amount received in USD, with no more than two decimal places.');
  const donationType = String(body.donation_type || 'general');
  if (!['tithe', 'general', 'offering', 'campaign'].includes(donationType)) throw new ZelleError('Invalid giving type.');
  const campaignId = donationType === 'campaign' ? String(body.campaign_id || '') : null;
  if (donationType === 'campaign' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId || '')) throw new ZelleError('Choose a campaign.');
  const email = String(body.donor_email || '').trim();
  if (email.length > 320 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new ZelleError('Enter a valid donor email address.');
  return {reference, amount: cents / 100, donationType, campaignId, email: email || null, donorName: String(body.donor_name || 'Anonymous').trim().slice(0, 160) || 'Anonymous'};
}
export async function recordZelleDonation(body: any, user: AuthUser) {
  const gift = validateZelleRecord(body, user);
  const sql = sqlClient();
  if (gift.campaignId) {
    const rows = await sql`SELECT id FROM campaigns WHERE id=${gift.campaignId} AND status='active' LIMIT 1`;
    if (!rows.length) throw new ZelleError('That campaign is not accepting gifts.');
  }
  // Existing provider/reference uniqueness makes repeat submissions safe under concurrency.
  // The ledger entry and audit are committed in one statement, or neither is committed.
  const rows = await sql`WITH received AS (
    INSERT INTO donations(campaign_id,donation_type,donor_name,donor_email,amount,payment_method,transaction_id,status,payment_provider,completed_at)
    VALUES(${gift.campaignId},${gift.donationType},${gift.donorName},${gift.email},${gift.amount},'Zelle',${gift.reference},'completed','zelle-manual',NOW())
    ON CONFLICT (payment_provider,transaction_id) WHERE transaction_id IS NOT NULL DO NOTHING RETURNING *
  ), audited AS (
    INSERT INTO security_audit(action,admin_id,session_id,details)
    SELECT 'zelle_bank_receipt_verified',${user.id},${user.sessionId},id::text || ' · USD ' || amount::text || ' · ' || transaction_id FROM received RETURNING id
  ) SELECT * FROM received`;
  if (!rows.length) throw new ZelleError('This Zelle bank reference has already been recorded. No additional donation was added.', 409);
  return rows[0];
}
