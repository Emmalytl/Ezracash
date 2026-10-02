// Report configuration without exposing secret credentials or claiming a completed test.
export function paymentConfiguration() {
  const secret = process.env.STRIPE_SECRET_KEY || '';
  const publicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const stripeMode = secret.startsWith('sk_test_') && publicKey.startsWith('pk_test_') ? 'test' : secret.startsWith('sk_live_') && publicKey.startsWith('pk_live_') ? 'live' : 'unconfigured';
  const stripeConfigured = stripeMode !== 'unconfigured' && Boolean(process.env.STRIPE_WEBHOOK_SECRET && process.env.ADMIN_SESSION_SECRET);
  // This release intentionally supports sandbox only. Live credentials must not enable charging.
  const paypalConfigured = (process.env.PAYPAL_ENV || 'sandbox') === 'sandbox' && Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.ADMIN_SESSION_SECRET);
  return {
    stripe: { configured: stripeConfigured, mode: stripeConfigured ? stripeMode : 'unconfigured' },
    paypal: { configured: paypalConfigured, mode: paypalConfigured ? 'sandbox' : 'unconfigured', clientId: paypalConfigured ? process.env.PAYPAL_CLIENT_ID : null },
    venmo: { configured: paypalConfigured && process.env.PAYPAL_VENMO_ENABLED === 'true', mode: paypalConfigured && process.env.PAYPAL_VENMO_ENABLED === 'true' ? 'sandbox' : 'unconfigured' },
    cashApp: { configured: false, mode: 'eligibility-required' },
    zelle: { configured: false, mode: 'manual-setup-required' },
  };
}
