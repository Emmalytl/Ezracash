import { sqlClient } from '@/lib/db';
import { stripeRetrieve } from './stripe';
import { ensureSubscriptionSchema, invoiceSubscriptionId } from './subscriptions';

// Each paid invoice produces one ledger entry. Checkout completion never counts money.
export async function handleSubscriptionEvent(event:any):Promise<boolean> {
  const type=String(event.type); const obj=event.data?.object||{};
  if(!['checkout.session.completed','invoice.paid','invoice.payment_failed','customer.subscription.updated','customer.subscription.deleted'].includes(type)) return false;
  const subscriptionId=type.startsWith('invoice.')?invoiceSubscriptionId(obj):type.startsWith('customer.subscription.')?obj.id:obj.subscription;
  if(!subscriptionId || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) return true;
  // Read current Stripe state so delayed events cannot revive a canceled subscription.
  const subscription=await stripeRetrieve(`subscriptions/${subscriptionId}`);
  const localId=subscription.metadata?.giving_subscription_id;
  if(!localId || !/^[0-9a-f-]{36}$/i.test(localId)) return true;
  await ensureSubscriptionSchema(); const sql=sqlClient();
  const records=await sql`SELECT * FROM giving_subscriptions WHERE id=${localId}`;
  if(!records[0]) throw new Error('Monthly giving record not found.');
  const record=records[0]; const customer=typeof subscription.customer==='string'?subscription.customer:subscription.customer?.id;
  if(record.provider_subscription_id && record.provider_subscription_id!==subscription.id) throw new Error('Subscription record mismatch.');
  await sql`UPDATE giving_subscriptions SET provider_subscription_id=${subscription.id},provider_customer_id=${customer||null},status=${subscription.cancel_at_period_end?'canceling':subscription.status} WHERE id=${localId}`;
  if(type!=='invoice.paid') return true;
  if(!/^in_[A-Za-z0-9]+$/.test(obj.id||'')) throw new Error('Invalid invoice.');
  const invoice=await stripeRetrieve(`invoices/${obj.id}`);
  if(invoiceSubscriptionId(invoice)!==subscriptionId || invoice.customer!==customer || invoice.currency!=='usd' || invoice.status!=='paid' || !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid<=0 || invoice.amount_paid!==Math.round(Number(record.amount)*100)) throw new Error('Monthly payment does not match agreed giving amount.');
  const paidAt = Number.isSafeInteger(invoice.status_transitions?.paid_at) ? new Date(invoice.status_transitions.paid_at*1000).toISOString() : new Date().toISOString();
  await sql`WITH accepted AS (
    INSERT INTO payment_events(provider,event_id,event_type,payload) VALUES('stripe',${event.id},${type},${JSON.stringify(event)})
    ON CONFLICT(event_id) DO NOTHING RETURNING event_id
  ) INSERT INTO donations(campaign_id,donation_type,donor_name,donor_email,amount,payment_method,transaction_id,status,payment_provider,provider_event_id,completed_at,created_at,subscription_id)
    SELECT ${record.campaign_id},${record.donation_type},${record.donor_name},${record.donor_email},${invoice.amount_paid/100},'Card',${invoice.id},'completed','stripe',${event.id},${paidAt}::timestamptz,${paidAt}::timestamptz,${localId}
    WHERE EXISTS(SELECT 1 FROM accepted)
    ON CONFLICT(payment_provider,transaction_id) WHERE transaction_id IS NOT NULL DO NOTHING`;
  return true;
}
