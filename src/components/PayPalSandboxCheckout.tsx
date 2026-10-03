'use client';
import { useEffect, useRef, useState } from 'react';
import { downloadDonationReceipt } from '@/lib/payments/donation-receipt';

type Gift = { amount: number; donation_type: string; campaign_id: string | null; donor_name: string; donor_email: string; frequency: string };
// SDK-owned fields keep account credentials out of House of Ezra's forms.
let sdkPromise: Promise<any> | null = null;
let sdkClientId = '';
function loadSandboxSDK(clientId: string) {
  if (sdkPromise && sdkClientId === clientId) return sdkPromise;
  sdkClientId = clientId;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const params = new URLSearchParams({ 'client-id': clientId, currency: 'USD', intent: 'capture', components: 'buttons', 'enable-funding': 'venmo', 'disable-funding': 'card,credit,paylater', 'buyer-country': 'US' });
    script.src = `https://www.paypal.com/sdk/js?${params}`;
    script.setAttribute('data-namespace', 'ezraPayPalSandbox');
    script.onload = () => resolve((window as any).ezraPayPalSandbox);
    script.onerror = () => { script.remove(); sdkPromise = null; reject(new Error('Could not load PayPal sandbox. Check your connection and try again.')); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
export default function PayPalSandboxCheckout({ clientId, method, gift, onBusyChange, onSubmitted }: { clientId: string; method: 'PayPal' | 'Venmo'; gift: Gift; onBusyChange?: (busy:boolean)=>void; onSubmitted?: ()=>void }) {
  const container = useRef<HTMLDivElement>(null);
  const receipt = useRef('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('Preparing sandbox checkout…');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusyState] = useState(false);
  const busyCallback = useRef(onBusyChange); busyCallback.current = onBusyChange;
  const submittedCallback = useRef(onSubmitted); submittedCallback.current = onSubmitted;
  function setBusy(value:boolean) { setBusyState(value); busyCallback.current?.(value); }
  const [submitted, setSubmitted] = useState(false);
  const currentGift = useRef(gift); currentGift.current = gift;
  async function check() {
    if (!receipt.current) return;
    setBusy(true);
    try {
      const response = await fetch('/api/payments/paypal/status', { cache: 'no-store', headers: { Authorization: `Bearer ${receipt.current}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not confirm the sandbox gift.');
      setResult(data); setError('');
      setMessage(data.status === 'completed' ? 'Sandbox gift confirmed. No real money was moved.' : 'Awaiting sandbox confirmation. Check again before starting another payment.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not check confirmation.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let stopped = false, buttons: any;
    setError(''); setResult(null); setMessage('Preparing sandbox checkout…');
    void loadSandboxSDK(clientId).then(async sdk => {
      if (stopped || !container.current) return;
      buttons = sdk.Buttons({
        fundingSource: method === 'Venmo' ? sdk.FUNDING.VENMO : sdk.FUNDING.PAYPAL,
        style: { layout: 'vertical', shape: 'pill', height: 48 },
        createOrder: async () => {
          setBusy(true); setError('');
          try {
            const response = await fetch('/api/payments/paypal/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...currentGift.current, payment_method: method }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not prepare sandbox gift.');
            receipt.current = data.receiptToken;
            sessionStorage.setItem('ezra-paypal-sandbox-receipt', data.receiptToken);
            return data.orderId;
          } catch (failure) { if (!stopped) setBusy(false); throw failure; }
        },
        onApprove: async (data: { orderID: string }) => {
          if (!stopped) { setSubmitted(true); submittedCallback.current?.(); setBusy(true); setMessage('Confirming sandbox payment…'); }
          try {
            const response = await fetch('/api/payments/paypal/capture', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receipt.current}` }, body: JSON.stringify({ orderId: data.orderID }) });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'Check confirmation before trying again.');
            if (!stopped) await check();
          } catch (failure) { if (!stopped) setError(failure instanceof Error ? failure.message : 'Check confirmation before paying again.'); }
          finally { if (!stopped) setBusy(false); }
        },
        onCancel: () => { if (!stopped) { setBusy(false); setMessage('Sandbox checkout cancelled. No gift is marked completed.'); } },
        onError: () => { if (!stopped) { setBusy(false); setError('Sandbox checkout could not finish. If you approved payment, use Check confirmation before trying again.'); } },
      });
      if (!buttons.isEligible()) { setMessage(method === 'Venmo' ? 'Venmo is unavailable for this sandbox account or browser. Use PayPal to test the shared payment flow.' : 'PayPal is unavailable in this browser.'); return; }
      setMessage(method === 'Venmo' ? 'Venmo sandbox simulates payment. It does not charge a real Venmo account.' : 'Sign in using a PayPal sandbox PERSONAL buyer account, separate from the receiving business account.');
      await buttons.render(container.current);
    }).catch(failure => { if (!stopped) setError(failure.message || 'Could not load sandbox checkout.'); });
    return () => { stopped = true; busyCallback.current?.(false); if (buttons) void buttons.close().catch(() => {}); };
  }, [clientId, method]);
  async function download() {
    if (result?.status !== 'completed') return;
    try {
      const response=await fetch('/api/payments/config',{cache:'no-store'});
      if(!response.ok) throw new Error('Could not load receipt details. Please try again.');
      const config=await response.json();
      await downloadDonationReceipt(result,config.receiptChurch,true);
      setError('');
    } catch(failure) { setError(failure instanceof Error ? failure.message : 'Could not download your receipt.'); }
  }

  return <section aria-label={`${method} sandbox checkout`} style={{ padding: '20px', border: '1px solid #d9e2ee', borderRadius: 18, background: '#f8fafc' }}>
    <strong style={{ color: '#92400e' }}>TEST MODE · No real money</strong>
    <p aria-live="polite">{message}</p>
    <div ref={container} hidden={submitted || result?.status === 'completed'} />
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {result?.status === 'completed' ? <button type="button" className="primary-button" onClick={download}>Download test receipt</button> : <button type="button" className="secondary-button" disabled={busy} onClick={() => { receipt.current ||= sessionStorage.getItem('ezra-paypal-sandbox-receipt') || ''; if (receipt.current) void check(); else setMessage('Complete a sandbox checkout first.'); }}>Check confirmation</button>}
  </section>;
}
