'use client';
import { useEffect, useState } from 'react';
import styles from './PaymentProviderSettings.module.css';
type Configuration = { stripe: {configured: boolean; mode: string}; paypal: {configured: boolean; mode: string}; venmo: {configured: boolean; mode: string} };
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
    ['Cash App', 'Eligibility required', 'Stripe Cash App Pay excludes religious organizations and charitable fundraising. Confirm a supported ministry solution first.'],
    ['Zelle', 'Manual setup required', 'Enroll an eligible ministry bank account. Bank transfers require manual verification; this release does not simulate a Zelle payment.'],
  ];
  return <section className={styles.section}>
    <div className={styles.heading}><div><span>PAYMENT CONNECTIONS</span><h2>Configure. Test. Confirm.</h2><p>Each method shows its own configuration status. Sandbox checkout stays separate from real donation totals.</p></div><button type="button" className="secondary-button" onClick={() => void refresh()}>Refresh status</button></div>
    <div className={styles.grid}>{cards.map(([name, label, detail]) => <article className={styles.card} key={name}><div><strong>{name}</strong><span className={label.includes('Live') ? styles.live : styles.badge}>{label}</span></div><p>{detail}</p></article>)}</div>
    <div className={styles.setup}><h3>PayPal & Venmo sandbox setup</h3><ol><li>Open <a href="https://developer.paypal.com/dashboard/" target="_blank" rel="noreferrer">PayPal Developer Dashboard</a>. Choose Sandbox → Apps & Credentials and create an app for a sandbox Business account.</li><li>In your hosting project's environment variables, add <code>PAYPAL_ENV=sandbox</code>, <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_CLIENT_SECRET</code>. Keep the secret server-side.</li><li>For Venmo simulation, add <code>PAYPAL_VENMO_ENABLED=true</code> and use a US sandbox merchant. Redeploy, then refresh this page.</li><li>Check the connection below. Open the landing page, choose a one-time gift and PayPal or Venmo. Use a different sandbox Personal buyer account to approve it.</li><li>Confirm the gift and download its test receipt. Test cancellation and retry as well. Live PayPal payments are disabled in this release.</li></ol><button type="button" className="primary-button" disabled={busy || !configuration?.paypal.configured} onClick={() => void verify()}>{busy ? 'Checking sandbox…' : 'Check PayPal sandbox connection'}</button><a className={styles.testLink} href="/" target="_blank" rel="noreferrer">Open donation page ↗</a></div>
    {message && <p role="status" className={styles.success}>{message}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
