// Only public configuration is returned. Secrets remain on the server.
export function paymentConfiguration() {
  const mode = process.env.PAYPAL_ENV || 'sandbox';
  const configured = ['sandbox','live'].includes(mode) && Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.ADMIN_SESSION_SECRET && (mode !== 'live' || (process.env.PAYPAL_WEBHOOK_ID && process.env.PAYPAL_MERCHANT_ID)));
  const recipientType = process.env.ZELLE_RECIPIENT_TYPE === 'phone' ? 'phone' : 'email';
  const recipient = (process.env.ZELLE_RECIPIENT || '').trim();
  const recipientName = (process.env.ZELLE_RECIPIENT_NAME || '').trim().slice(0,160);
  const valid = recipientType === 'phone' ? /^\+1\d{10}$/.test(recipient) : recipient.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
  const zelleConfigured = process.env.ZELLE_ENABLED === 'true' && Boolean(recipientName && valid);
  const zelleMode = process.env.ZELLE_MODE === 'live' ? 'live' : 'test';
  const cashMode = process.env.CASH_APP_MODE === 'live' ? 'live' : 'test';
  const cashTag = (process.env.CASH_APP_CASHTAG || '').trim().replace(/^\$/, '');
  const cashName = (process.env.CASH_APP_RECIPIENT_NAME || '').trim().slice(0,160);
  const cashConfigured = process.env.CASH_APP_ENABLED === 'true' && /^[A-Za-z][A-Za-z0-9]{0,19}$/.test(cashTag) && Boolean(cashName);
  return {
    receiptChurch: {name:'House of Ezra Worldwide Ministries',assembly:'Jehovah Adonai Assembly',address:(process.env.CHURCH_RECEIPT_ADDRESS||'6030 Highway 85, Suite 206\nRiverdale, GA 30274').trim().slice(0,600),contacts:(process.env.CHURCH_RECEIPT_CONTACTS||'850-712-8760 / 850-417-3107').trim().slice(0,200),email:(process.env.CHURCH_RECEIPT_EMAIL||'').trim().slice(0,320)},
    paypal: { configured, mode: configured ? mode : 'unconfigured', clientId: configured ? process.env.PAYPAL_CLIENT_ID : null, applePay: process.env.PAYPAL_APPLE_PAY_ENABLED === 'true', googlePay: process.env.PAYPAL_GOOGLE_PAY_ENABLED === 'true', monthly: configured && process.env.PAYPAL_SUBSCRIPTIONS_ENABLED === 'true' && Boolean(process.env.PAYPAL_PRODUCT_ID && process.env.PAYPAL_WEBHOOK_ID && process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://')) },
    cashApp: {configured:cashConfigured,mode:cashConfigured?cashMode:'manual-setup-required',recipientName:cashConfigured&&cashMode==='live'?cashName:null,recipient:cashConfigured&&cashMode==='live'?'$'+cashTag:null,url:cashConfigured&&cashMode==='live'?'https://cash.app/$'+cashTag:null},
    zelle: { configured:zelleConfigured,mode:zelleConfigured?zelleMode:'manual-setup-required',recipientType,recipientName:zelleConfigured&&zelleMode==='live'?recipientName:null,recipient:zelleConfigured&&zelleMode==='live'?recipient:null },
  };
}
