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
  const paypalLabel=!configuration?'Checking…':!configuration.paypal.configured?'Not connected':configuration.paypal.mode==='live'?'Live credentials configured':'Sandbox configured';
  const manualLabel=(value:any)=>!value?.configured?'Manual setup required':value.mode==='live'?'Live instructions configured':'Test preview · no transfer';
  const cards=[
    ['Cards',paypalLabel,'Direct card fields are hosted by PayPal and require Advanced Checkout approval.'],
    ['Apple Pay',configuration?.paypal.applePay?paypalLabel:'Not enabled','Processed by PayPal. Requires merchant approval, a registered domain and an eligible device.'],
    ['Google Pay',configuration?.paypal.googlePay?paypalLabel:'Not enabled','Processed by PayPal. Requires account approval and eligible device/browser.'],
    ['PayPal',paypalLabel,'One-time orders with server-side capture, confirmation and receipts.'],
    ['Monthly giving',configuration?.paypal.monthly?paypalLabel:'Not configured','PayPal subscriptions. Only verified recurring payments enter donation totals.'],
    ['Cash App',manualLabel(configuration?.cashApp),'Separate Cash App recipient flow. An administrator verifies receipt and records its unique transaction reference.'],
    ['Zelle',manualLabel(configuration?.zelle),'Manual bank transfer. An administrator verifies receipt and records its unique bank reference.'],
  ];
  return <section className={styles.section}>
    <div className={styles.heading}><div><span>PAYMENT CONNECTIONS</span><h2>Configure. Test. Confirm.</h2><p>PayPal processes cards and eligible Apple Pay/Google Pay. Cash App and Zelle receipts are verified manually. Configuration does not prove a successful payment.</p></div><button type="button" className="secondary-button" onClick={() => void refresh()}>Refresh status</button></div>
    <div className={styles.bankGuide}><h3>One organizational bank account</h3><p>Link the same eligible ministry-owned bank account in PayPal and the church’s eligible Cash App account. Enroll the bank account for Zelle through your bank. Names and ownership must match each provider’s requirements.</p><p>Bank linking happens with the providers, not in this dashboard. Never paste online-banking credentials, account numbers or routing numbers into the giving page. Donation totals are records of gifts, not your available bank balance; provider fees and payout timing may differ.</p></div>
    <div className={styles.grid}>{cards.map(([name, label, detail]) => <article className={styles.card} key={name}><div><strong>{name}</strong><span className={label.includes('Live') ? styles.live : styles.badge}>{label}</span></div><p>{detail}</p></article>)}</div>
    <div className={styles.setup}><h3>PayPal · Cards and digital wallets</h3><ol><li>Use the church’s approved Business account. Create a matching Sandbox or Live REST app in the PayPal Developer Dashboard.</li><li>Set <code>PAYPAL_ENV</code> to <code>sandbox</code> or <code>live</code>, then add <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_CLIENT_SECRET</code> securely in the hosting environment.</li><li>For live mode, also set <code>PAYPAL_MERCHANT_ID</code> and <code>PAYPAL_WEBHOOK_ID</code>. Register <code>/api/payments/paypal/webhook</code> for capture, refund, subscription and recurring sale events. See docs/PAYPAL-LIVE-SETUP.md for exact events.</li><li>Activate Advanced Checkout for direct card fields. Enable eligible Apple Pay/Google Pay capabilities in PayPal, then set <code>PAYPAL_APPLE_PAY_ENABLED=true</code> and <code>PAYPAL_GOOGLE_PAY_ENABLED=true</code>. Register the final domain for Apple Pay and complete Google Pay production approval. Buttons appear only when eligible.</li><li>For monthly giving, set <code>PAYPAL_PRODUCT_ID</code>, <code>PAYPAL_SUBSCRIPTIONS_ENABLED=true</code> and the HTTPS <code>NEXT_PUBLIC_APP_URL</code>. Monthly gifts use PayPal subscription approval.</li></ol><button type="button" className="primary-button" disabled={busy||!configuration?.paypal.configured} onClick={()=>void verify()}>{busy?'Checking…':'Check PayPal connection'}</button><a className={styles.testLink} href="/" target="_blank" rel="noreferrer">Open donation page ↗</a></div>
    <div className={styles.setup}><h3>Cash App · Separate recipient account</h3><p>Set <code>CASH_APP_ENABLED=true</code>, <code>CASH_APP_MODE=test</code>, <code>CASH_APP_RECIPIENT_NAME</code> and <code>CASH_APP_CASHTAG</code>. Test mode hides the real recipient. After checking the church’s account eligibility, use <code>CASH_APP_MODE=live</code> and redeploy.</p><p>Donors open Cash App and send their gift separately. Record it in Donations → Record donation → Cash App only after verifying receipt, exact amount and transaction reference. This is not an automated Cash App Pay API integration.</p></div>
    <div className={styles.setup}><h3>Zelle · Recipient and bank verification</h3><ol><li>Ask the ministry’s bank whether its organizational account supports Zelle and enroll the official recipient email or US phone number.</li><li>In your hosting environment, set <code>ZELLE_ENABLED=true</code>, <code>ZELLE_RECIPIENT_NAME</code>, <code>ZELLE_RECIPIENT_TYPE=email</code> or <code>phone</code>, and <code>ZELLE_RECIPIENT</code>. Phone numbers use <code>+1</code> followed by ten digits.</li><li>Keep <code>ZELLE_MODE=test</code> while testing. The modal shows a preview without a real recipient; test transfers cannot be added to donation totals.</li><li>After approval to launch, set <code>ZELLE_MODE=live</code> and redeploy. Confirm the displayed recipient in your bank before accepting gifts.</li><li>After a real transfer arrives, open Donations → Record donation → Zelle. Enter the exact amount and bank reference, then attest that you checked receipt in the organizational bank account. Repeat references are blocked.</li></ol><p>This is a manual bank-reconciliation workflow. Ezracash does not connect to your bank or automatically confirm Zelle transfers.</p></div>
    {message && <p role="status" className={styles.success}>{message}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
