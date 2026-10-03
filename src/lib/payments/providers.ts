// Public configuration contains no processor secrets or bank-account numbers.
export function paymentConfiguration() {
  const secret = process.env.STRIPE_SECRET_KEY || '';
  const publicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const stripeMode = secret.startsWith('sk_test_') && publicKey.startsWith('pk_test_') ? 'test' : secret.startsWith('sk_live_') && publicKey.startsWith('pk_live_') ? 'live' : 'unconfigured';
  const stripeConfigured = stripeMode !== 'unconfigured' && Boolean(process.env.STRIPE_WEBHOOK_SECRET && process.env.ADMIN_SESSION_SECRET);
  // Preserve sandbox isolation. Merely entering live PayPal keys cannot enable charging.
  const paypalConfigured = (process.env.PAYPAL_ENV || 'sandbox') === 'sandbox' && Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.ADMIN_SESSION_SECRET);
  const recipientName = (process.env.ZELLE_RECIPIENT_NAME || '').trim().slice(0, 160);
  const recipient = (process.env.ZELLE_RECIPIENT || '').trim();
  const recipientType = process.env.ZELLE_RECIPIENT_TYPE === 'phone' ? 'phone' : 'email';
  const validRecipient = recipientType === 'phone' ? /^\+1\d{10}$/.test(recipient) : recipient.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
  const zelleConfigured = process.env.ZELLE_ENABLED === 'true' && Boolean(recipientName && validRecipient);
  const zelleMode = process.env.ZELLE_MODE === 'live' ? 'live' : 'test';
  return {
    receiptChurch: {name:"House of Ezra Worldwide Ministries",assembly:"Jehovah Adonai Assembly",address:(process.env.CHURCH_RECEIPT_ADDRESS||"6030 Highway 85, Suite 206\nRiverdale, GA 30274").trim().slice(0,600),contacts:(process.env.CHURCH_RECEIPT_CONTACTS||"850-712-8760 / 850-417-3107").trim().slice(0,200),email:(process.env.CHURCH_RECEIPT_EMAIL||"").trim().slice(0,320)},
    stripe: { configured: stripeConfigured, mode: stripeConfigured ? stripeMode : 'unconfigured', methods: ['Card', 'Apple Pay', 'Google Pay'] },
    paypal: { configured: paypalConfigured, mode: paypalConfigured ? 'sandbox' : 'unconfigured', clientId: paypalConfigured ? process.env.PAYPAL_CLIENT_ID : null },
    venmo: { configured: paypalConfigured && process.env.PAYPAL_VENMO_ENABLED === 'true', mode: paypalConfigured && process.env.PAYPAL_VENMO_ENABLED === 'true' ? 'sandbox' : 'unconfigured' },
    // Stripe explicitly prohibits MCC 8398 and 8661 for Cash App Pay. No toggle bypasses this.
    cashApp: { configured: false, mode: 'unsupported', reason: 'Cash App Pay through Stripe does not support religious organizations or charitable fundraising.' },
    zelle: {
      configured: zelleConfigured, mode: zelleConfigured ? zelleMode : 'manual-setup-required', recipientType,
      // Do not expose a real recipient in a test preview, where a donor might accidentally send money.
      recipientName: zelleConfigured && zelleMode === 'live' ? recipientName : null,
      recipient: zelleConfigured && zelleMode === 'live' ? recipient : null,
    },
  };
}
