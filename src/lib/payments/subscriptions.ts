import { sqlClient } from '@/lib/db';
export async function ensureSubscriptionSchema() {
  const sql=sqlClient();
  await sql`CREATE TABLE IF NOT EXISTS giving_subscriptions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),campaign_id UUID REFERENCES campaigns(id),donation_type TEXT NOT NULL,donor_name TEXT NOT NULL,donor_email TEXT NOT NULL,amount NUMERIC(12,2) NOT NULL,provider_subscription_id TEXT UNIQUE,provider_customer_id TEXT,checkout_session_id TEXT,status TEXT NOT NULL DEFAULT 'pending',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES giving_subscriptions(id)`;
}
// Supports invoice payloads before and after Stripe's subscription_details migration.
export function invoiceSubscriptionId(invoice:any):string|null {
  const value=invoice.parent?.subscription_details?.subscription || invoice.subscription;
  return typeof value==='string'?value:value?.id||null;
}
