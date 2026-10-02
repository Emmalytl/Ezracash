import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { handleSubscriptionEvent } from '@/lib/payments/subscription-webhook';
import { verifyStripeSignature } from '@/lib/payments/stripe';

export const runtime = 'nodejs';

async function ensurePaymentSchema() {
  const sql = sqlClient();
  await sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'manual'`;
  await sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS provider_event_id TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS donations_provider_txn_idx ON donations(payment_provider,transaction_id) WHERE transaction_id IS NOT NULL`;
  await sql`CREATE TABLE IF NOT EXISTS payment_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL, processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), payload JSONB)`;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!secret || !signature) return NextResponse.json({error:'Webhook not configured.'},{status:400});
  const payload = await request.text();
  if (!verifyStripeSignature(payload, signature, secret)) return NextResponse.json({error:'Invalid signature.'},{status:400});

  try {
    await ensurePaymentSchema();
    const event = JSON.parse(payload);
    const sql = sqlClient();
    if (typeof event.id !== 'string' || typeof event.type !== 'string') return NextResponse.json({error:'Invalid event.'},{status:400});
    if (await handleSubscriptionEvent(event)) return NextResponse.json({received:true});
    const obj = event.data?.object || {};
    const donationId = obj.metadata?.donation_id;
    const paymentEvent = ['payment_intent.succeeded','payment_intent.payment_failed','payment_intent.canceled'].includes(event.type);
    if (paymentEvent && donationId) {
      if (!/^[0-9a-f-]{36}$/i.test(donationId) || typeof obj.id !== 'string' || obj.currency !== 'usd' || !Number.isSafeInteger(obj.amount)) {
        return NextResponse.json({error:'Invalid payment details.'},{status:400});
      }
      const rows = await sql`SELECT id FROM donations WHERE id=${donationId} AND payment_provider='stripe'
        AND (transaction_id=${obj.id} OR transaction_id IS NULL) AND ROUND(amount*100)=${obj.amount}`;
      if (!rows.length || (event.type === 'payment_intent.succeeded' && obj.amount_received !== obj.amount)) {
        return NextResponse.json({error:'Payment does not match the donation record.'},{status:400});
      }
    }
    const completed = event.type === 'payment_intent.succeeded';
    const status = completed ? 'completed' : 'failed';
    // A single SQL statement is atomic. Duplicate events cannot apply an update twice.
    await sql`WITH accepted AS (
      INSERT INTO payment_events(provider,event_id,event_type,payload)
      VALUES('stripe',${event.id},${event.type},${JSON.stringify(event)})
      ON CONFLICT(event_id) DO NOTHING RETURNING event_id
    )
    UPDATE donations SET status=${status},
      completed_at=CASE WHEN ${completed} THEN COALESCE(completed_at,NOW()) ELSE completed_at END,
      provider_event_id=${event.id},transaction_id=COALESCE(transaction_id,${obj.id || null})
    WHERE id::text=${paymentEvent ? donationId || null : null} AND payment_provider='stripe'
      AND (transaction_id=${obj.id || null} OR transaction_id IS NULL)
      AND ROUND(amount*100)=${Number.isSafeInteger(obj.amount) ? obj.amount : null}
      AND (status='pending' OR (${completed} AND status='failed'))
      AND EXISTS(SELECT 1 FROM accepted)`;
    return NextResponse.json({received:true});
  } catch (e:any) {
    return NextResponse.json({error:e?.message||'Webhook processing failed.'},{status:500});
  }
}
