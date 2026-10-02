import { NextResponse } from 'next/server';
import { sqlClient } from '@/lib/db';
import { createReceiptToken } from '@/lib/payments/receipt-token';
import { stripeRequest } from '@/lib/payments/stripe';

export const runtime = 'nodejs';

const allowedTypes = new Set(['tithe','general','offering','campaign']);

async function ensurePaymentSchema() {
  const sql = sqlClient();
  await sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'manual'`;
  await sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS provider_event_id TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS donations_provider_txn_idx ON donations(payment_provider,transaction_id) WHERE transaction_id IS NOT NULL`;
  await sql`CREATE TABLE IF NOT EXISTS payment_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL, processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), payload JSONB)`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const amount = Number(body.amount);
    const donationType = String(body.donation_type || 'general');
    const donorName = String(body.donor_name || 'Anonymous').trim().slice(0,160) || 'Anonymous';
    const donorEmail = String(body.donor_email || '').trim().slice(0,320) || null;
    const requestedMethod = String(body.payment_method || 'Card');
    const campaignId = donationType === 'campaign' ? String(body.campaign_id || '') : null;

    if (!Number.isFinite(amount) || amount <= 0 || amount > 999999.99) return NextResponse.json({error:'Enter a valid gift amount.'},{status:400});
    const cents = Math.round(amount * 100);
    if (cents < 50 || Math.abs(amount * 100 - cents) > 0.000001) return NextResponse.json({error:'Enter at least $0.50, with no more than two decimal places.'},{status:400});
    if (requestedMethod !== 'Card') return NextResponse.json({error:'Unsupported checkout method.'},{status:400});
    if (campaignId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId)) return NextResponse.json({error:'Choose an available campaign.'},{status:400});
    if (!allowedTypes.has(donationType)) return NextResponse.json({error:'Invalid giving type.'},{status:400});
    if (donationType === 'campaign' && !campaignId) return NextResponse.json({error:'Choose a campaign for a Campaign Gift.'},{status:400});

    if (donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) return NextResponse.json({error:'Enter a valid email address.'},{status:400});
    // Fail configuration checks before inserting an unpaid record.
    const receiptSecret = process.env.ADMIN_SESSION_SECRET;
    if (!receiptSecret) throw new Error('SESSION_SECRET_MISSING');
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_NOT_CONFIGURED');
    await ensurePaymentSchema();
    const sql = sqlClient();
    if (campaignId) {
      const rows = await sql`SELECT id,title,status FROM campaigns WHERE id=${campaignId} LIMIT 1`;
      if (!rows.length || rows[0].status !== 'active') return NextResponse.json({error:'That campaign is not currently accepting gifts.'},{status:400});
    }

    const donationRows = await sql`
      INSERT INTO donations(campaign_id,donation_type,donor_name,donor_email,amount,payment_method,transaction_id,status,payment_provider)
      VALUES(${campaignId},${donationType},${donorName},${donorEmail},${amount},${requestedMethod},NULL,'pending','stripe')
      RETURNING id
    `;
    const donationId = donationRows[0].id;
    const params = new URLSearchParams();
    params.set('amount', String(cents));
    params.set('currency','usd');
    // Limit this checkout to cards; unrelated methods must not appear automatically.
    params.set('payment_method_types[]','card');
    params.set('metadata[donation_id]', String(donationId));
    params.set('metadata[donation_type]', donationType);
    if (campaignId) params.set('metadata[campaign_id]', campaignId);
    if (donorEmail) params.set('receipt_email', donorEmail);
    params.set('description', `House of Ezra ${donationType} gift`);

    try {
      const intent = await stripeRequest('payment_intents', params);
      await sql`UPDATE donations SET transaction_id=${intent.id} WHERE id=${donationId}`;
      return NextResponse.json({clientSecret:intent.client_secret,paymentIntentId:intent.id,donationId,receiptToken:createReceiptToken(String(donationId))});
    } catch (e:any) {
      await sql`UPDATE donations SET status='failed' WHERE id=${donationId}`;
      throw e;
    }
  } catch (e:any) {
    const code = e?.message === 'STRIPE_NOT_CONFIGURED' ? 'STRIPE_NOT_CONFIGURED' : 'PAYMENT_ERROR';
    return NextResponse.json({error: code === 'STRIPE_NOT_CONFIGURED' ? 'Payments are temporarily unavailable. Please contact the ministry.' : (e?.message || 'Could not start payment.')},{status:code==='STRIPE_NOT_CONFIGURED'?503:500});
  }
}
