# Monthly giving — test setup

Keep test keys. This build adds monthly Stripe subscriptions alongside existing one-time giving. Monthly uses Stripe-hosted Checkout; one-time keeps the inline card form. PayPal and Cash App remain unconnected.

## Stripe configuration required

1. In your TEST Stripe account, open Settings → Billing → Customer portal. Enable cancellation and payment-method updates, then activate the portal login link. Choose cancellation at the end of the billing period if that is your ministry policy. Do not enable subscription price changes or discounts for this fixed-amount giving flow.
2. Add that test login URL to Vercel as NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL. It starts with https://billing.stripe.com/. It is a public login link, not a secret. Keep this URL in the same test/live mode and receiving Stripe account as the keys.
3. Update the existing webhook destination https://ezracash.vercel.app/api/payments/stripe/webhook to include:
   - payment_intent.succeeded
   - payment_intent.payment_failed
   - payment_intent.canceled
   - checkout.session.completed
   - invoice.paid
   - invoice.payment_failed
   - customer.subscription.updated
   - customer.subscription.deleted
4. If you are using a restricted Stripe key configured only for Payment Intents, expand its permissions in your Stripe dashboard to support this implementation. The code now creates Checkout Sessions, retrieves Subscriptions and Invoices, and creates Customer Portal Sessions. Inline recurring price/product and customer creation may require additional dependent permissions in Stripe. Keep financial transfer and payout permissions disabled. Do not paste keys into chat or GitHub.
5. Redeploy after changing environment variables. No database reset or base schema import is required. Runtime schema additions preserve existing records.

The app refuses to create a monthly checkout until the public management link is configured. Portal cancellation itself must be enabled in Stripe; the app cannot verify that setting without access to your account.

## Behaviour

- Monthly giving requires an email and explicit consent to the amount now and monthly until canceled.
- Stripe collects the card and creates the recurring subscription. This app does not store card data.
- Checkout success shows a confirmation page, not a fabricated receipt.
- Only a paid invoice matching the expected USD amount, subscription and customer produces a completed donation ledger row. Unique invoice IDs and webhook event IDs prevent double counting.
- Stripe subscription status is retrieved when handling events, preventing older webhook events from overwriting newer provider state.
- Failed invoice attempts do not create completed donations. Stripe handles retry settings.
- Every paid renewal is recorded separately and included in existing donation, campaign and finance totals.
- A short-lived signed confirmation token permits opening the correct customer's portal. The permanent footer link lets the donor authenticate by email later. Token is passed through a URL fragment, then removed from the address bar.
- Paid invoices and invoice PDFs are available in the Stripe portal according to its settings.
- Pausing or archiving a campaign prevents new subscriptions, but does not cancel existing subscriptions. Existing subscriptions must be canceled separately in Stripe when a campaign ends.

## Required acceptance tests

Use Stripe test mode only:
1. Monthly with no email or unchecked consent is rejected.
2. Change the amount after checking consent: consent resets.
3. Complete one monthly test checkout. Confirm first invoice creates exactly one donation and the confirmation page reports paid.
4. Replay invoice.paid: totals remain unchanged.
5. Simulate a renewal using Stripe test clocks or the documented subscription test workflow: a second paid invoice creates a second donation.
6. Fail a renewal: no new completed donation is counted.
7. Open Manage monthly giving, update the card, and cancel. Confirm subscription status changes and later billing stops according to the portal cancellation policy.
8. One-time giving continues through the inline card form.

Local validation includes production build, TypeScript and 25 checks, including mocked monthly provider/database tests. Actual Stripe Checkout, renewal, email login, cancellation and database webhook execution still require the test-account checks above. No live subscription has been created by the assistant.
