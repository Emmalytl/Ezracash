'use client';
import { useEffect, useState } from 'react';
import styles from './PaymentProviderSettings.module.css';
import type { paymentConfiguration } from '@/lib/payments/providers';
type Configuration = ReturnType<typeof paymentConfiguration>;
export default function PaymentProviderSettings() {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const response = await fetch('/api/admin/payments', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load payment configuration.');
      setConfiguration(await response.json()); setError('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Configuration unavailable.'); }
  }
  useEffect(() => { void refresh(); }, []);
  async function verify() {
    setBusy(true); setMessage(''); setError('');
    try {
      const response = await fetch('/api/admin/payments', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(body.message); await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connection failed.'); }
    finally { setBusy(false); }
  }
  const stripeLabel = !configuration ? 'Checking…' : !configuration.stripe.configured ? 'Not configured' : configuration.stripe.mode === 'test' ? 'Test credentials configured' : 'Live credentials configured';
  const paypalLabel = !configuration ? 'Checking…' : configuration.paypal.configured ? 'Sandbox configured' : 'Not connected';
  const cards = [
    ['Cards', stripeLabel, 'Existing card checkout. Configuration is not proof of a successful payment.'],
    ['Apple Pay', stripeLabel, 'Uses the card provider. Requires an eligible wallet, browser and registered domain.'],
    ['Google Pay', stripeLabel, 'Uses the card provider. Available only when the checkout detects an eligible wallet.'],
    ['PayPal', paypalLabel, 'One-time sandbox orders, server capture, confirmation and test receipts.'],
    ['Venmo', !configuration ? 'Checking…' : configuration.venmo.configured ? 'Sandbox configured' : 'Not enabled', 'Uses PayPal sandbox; eligibility is checked by PayPal in the browser.'],
    ['Cash App Pay', 'Unavailable for this ministry', 'Stripe prohibits religious organizations and charitable fundraising for Cash App Pay. It is not offered in checkout.'],
    ['Zelle', !configuration ? 'Checking…' : !configuration.zelle.configured ? 'Manual setup required' : configuration.zelle.mode === 'test' ? 'Test preview · no transfer' : 'Live instructions configured', 'Gifts go directly to the enrolled bank account. An administrator must verify receipt and record the unique bank reference.'],
  ];
  return <section className={styles.section}>
    <div className={styles.heading}><div><span>PAYMENT CONNECTIONS</span><h2>Configure. Test. Confirm.</h2><p>Stripe handles cards and eligible wallets. PayPal handles PayPal/Venmo. Zelle is verified against bank receipts. Configuration does not prove a successful payment.</p></div><button type="button" className="secondary-button" onClick={() => void refresh()}>Refresh status</button></div>
    <div className={styles.bankGuide}><h3>One organizational bank account</h3><p>Link the same eligible ministry-owned bank account inside Stripe’s payout settings and PayPal’s bank settings. Enroll that account for Zelle through your bank. Names and ownership must match each provider’s requirements.</p><p>Bank linking happens with the providers, not in this dashboard. Never paste online-banking credentials, account numbers or routing numbers into the giving page. Donation totals are records of gifts, not your available bank balance; provider fees and payout timing may differ.</p></div>
    <div className={styles.grid}>{cards.map(([name, label, detail]) => <article className={styles.card} key={name}><div><strong>{name}</strong><span className={label.includes('Live') ? styles.live : styles.badge}>{label}</span></div><p>{detail}</p></article>)}</div>
    <div className={styles.setup}><h3>PayPal & Venmo sandbox setup</h3><ol><li>Open <a href="https://developer.paypal.com/dashboard/" target="_blank" rel="noreferrer">PayPal Developer Dashboard</a>. Choose Sandbox → Apps & Credentials and create an app for a sandbox Business account.</li><li>In your hosting project's environment variables, add <code>PAYPAL_ENV=sandbox</code>, <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_CLIENT_SECRET</code>. Keep the secret server-side.</li><li>For Venmo simulation, add <code>PAYPAL_VENMO_ENABLED=true</code> and use a US sandbox merchant. Redeploy, then refresh this page.</li><li>Check the connection below. Open the landing page, choose a one-time gift and PayPal or Venmo. Use a different sandbox Personal buyer account to approve it.</li><li>Confirm the gift and download its test receipt. Test cancellation and retry as well. Live PayPal payments are disabled in this release.</li></ol><button type="button" className="primary-button" disabled={busy || !configuration?.paypal.configured} onClick={() => void verify()}>{busy ? 'Checking sandbox…' : 'Check PayPal sandbox connection'}</button><a className={styles.testLink} href="/" target="_blank" rel="noreferrer">Open donation page ↗</a></div>
    <div className={styles.setup}><h3>Stripe · Cards, Apple Pay and Google Pay</h3><p>Keep the existing Stripe keys, webhook and monthly-giving integration. Enable the wallet methods in Stripe, register the final domain, and complete any nonprofit approval required for Apple Pay. Wallet buttons appear only on supported devices with eligible wallets.</p><p>Verify a test card gift and a wallet gift, then check the signed webhook, donation record and receipt. Monthly giving continues through Stripe. Switching an environment key does not replace this verification.</p><a href="https://dashboard.stripe.com/settings/payments" target="_blank" rel="noreferrer">Open Stripe payment settings ↗</a></div>
    <div className={styles.setup}><h3>Zelle · Recipient and bank verification</h3><ol><li>Ask the ministry’s bank whether its organizational account supports Zelle and enroll the official recipient email or US phone number.</li><li>In your hosting environment, set <code>ZELLE_ENABLED=true</code>, <code>ZELLE_RECIPIENT_NAME</code>, <code>ZELLE_RECIPIENT_TYPE=email</code> or <code>phone</code>, and <code>ZELLE_RECIPIENT</code>. Phone numbers use <code>+1</code> followed by ten digits.</li><li>Keep <code>ZELLE_MODE=test</code> while testing. The modal shows a preview without a real recipient; test transfers cannot be added to donation totals.</li><li>After approval to launch, set <code>ZELLE_MODE=live</code> and redeploy. Confirm the displayed recipient in your bank before accepting gifts.</li><li>After a real transfer arrives, open Donations → Record donation → Zelle. Enter the exact amount and bank reference, then attest that you checked receipt in the organizational bank account. Repeat references are blocked.</li></ol><p>This is a manual bank-reconciliation workflow. Ezracash does not connect to your bank or automatically confirm Zelle transfers.</p></div>
    {message && <p role="status" className={styles.success}>{message}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
