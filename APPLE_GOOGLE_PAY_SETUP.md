# Apple Pay and Google Pay

The one-time donation form now includes Stripe Express Checkout for Apple Pay and Google Pay alongside the existing card form. Only eligible wallets appear; other Express Checkout methods are disabled. Both use the existing card PaymentIntent and server-confirmed receipt flow.

## Before testing
1. Deploy this build to https://ezracash.vercel.app with the existing Stripe test keys.
2. In Stripe Dashboard, open Settings → Payment methods → Payment method domains. Register ezracash.vercel.app in test mode and confirm Apple Pay/Google Pay are enabled. Register your final custom domain too when you use one.
3. Test Apple Pay with a supported browser/device and a configured Apple Wallet. Test Google Pay with a supported browser/device and a configured Google wallet. Missing wallet buttons on an unsupported device are expected; the card form remains available.
4. Complete a test donation and verify the Stripe payment, webhook, donation ledger and receipt agree. Cancel a wallet sheet and check you can retry without a duplicate donation.

Monthly donations continue through Stripe hosted Checkout. Wallet availability there is controlled by Stripe and device eligibility; verify monthly wallet setup and cancellation separately.

Before launch, register the domain in live mode, use the corresponding live Stripe keys and webhook signing secret, and complete real payment verification. This build does not activate a merchant account or verify payouts.

Code checks are separate from wallet testing. No real Apple Pay or Google Pay transaction has been performed by Codex.

Official instructions: https://docs.stripe.com/elements/express-checkout-element

## Display update
The floating Stripe testing assistant and card Link autofill are disabled through supported SDK options. Wallet display uses always on supported platforms, including wallet setup flows. The wallet area stays mounted while availability is checked and explains when no wallet is available. Payment processing remains with Stripe.
