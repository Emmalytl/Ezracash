# PayPal, Cash App and Zelle payment update

This guide supersedes the older Stripe and PayPal-sandbox-only setup documents. The supplied application stays in sandbox/test mode until you explicitly configure live accounts. No credentials have been added and nothing has been deployed.

## What changed

- PayPal is the only online checkout processor. Cards use PayPal-hosted fields; Apple Pay and Google Pay use PayPal's wallet integrations when enabled and eligible.
- The dropdown offers Card (with eligible wallets), PayPal, Cash App and Zelle. Venmo and Stripe are no longer checkout options.
- Cash App opens the configured church $Cashtag. Zelle displays the bank-enrolled recipient. These are manual recipient flows, not payment APIs, and opening them never marks a donation paid.
- Administrators/developers can record a received Cash App or Zelle gift only with an exact amount, unique transaction reference and receipt-verification attestation. Staff cannot approve these receipts. Duplicate provider/reference pairs are blocked and verification is audited atomically.
- Monthly gifts use PayPal subscriptions, with separate consent and cancellation. Monthly wallet/card entry through the one-time selector is not offered. Activation alone never counts as income: a verified recurring payment is required.
- The existing landing-page design, circular marquee interaction, login page, roles, images, campaign management and receipt design are preserved. Payment settings text and payment-related fields have been updated.

## Preserve your existing configuration

Keep the existing Neon database connection, ADMIN_SESSION_SECRET, administrator accounts and all data. Do not replace your local environment file with the empty example. New payment tables are created non-destructively on first use; the original donations table must already exist. This package does not reset or migrate away historical donations.

Install with `npm ci`, then use `npm run dev` locally or `npm run build` for production validation. The setup requires a PostgreSQL/Neon connection and the existing database schema. Local wallet checkout generally also requires HTTPS and an approved domain.

## PayPal account and environment

1. Use the church's approved PayPal Business account. Confirm that its country, organization type and receiving capabilities are supported, and obtain Advanced Checkout approval for direct card fields.
2. In PayPal Developer Dashboard, create/select the REST app in the intended environment. Sandbox buyer accounts must be different from the sandbox receiving Business account.
3. Set these values securely in Vercel's intended environment; never commit secrets:

| Variable | Value |
| --- | --- |
| PAYPAL_ENV | sandbox for testing; live only for production launch |
| PAYPAL_CLIENT_ID | Matching REST app client ID |
| PAYPAL_CLIENT_SECRET | Matching REST app secret, server-side only |
| PAYPAL_MERCHANT_ID | Receiving Business account's merchant ID; required live |
| PAYPAL_WEBHOOK_ID | Matching REST app/environment webhook ID; required live |
| NEXT_PUBLIC_APP_URL | Final HTTPS site origin, without a trailing path |
| ADMIN_SESSION_SECRET | Preserve the existing secret |

Live mode fails closed if the merchant ID or webhook ID is missing. Configuration and the dashboard connection check do not prove account approval or a successful charge.

## Webhook

Register `https://YOUR-DOMAIN/api/payments/paypal/webhook` on the SAME PayPal app and environment. Add its webhook ID to the environment. Subscribe to:

- PAYMENT.CAPTURE.COMPLETED
- PAYMENT.CAPTURE.REFUNDED
- PAYMENT.SALE.COMPLETED
- PAYMENT.SALE.REFUNDED
- BILLING.SUBSCRIPTION.CREATED
- BILLING.SUBSCRIPTION.ACTIVATED
- BILLING.SUBSCRIPTION.UPDATED
- BILLING.SUBSCRIPTION.CANCELLED
- BILLING.SUBSCRIPTION.SUSPENDED
- BILLING.SUBSCRIPTION.EXPIRED
- BILLING.SUBSCRIPTION.PAYMENT.FAILED

Every event is checked with PayPal's signature-verification API. One-time captures are re-read from PayPal and bound to the stored USD amount, local reference, provider order and live merchant. Monthly sales are checked against the subscription and its transaction history. Provider failures return a retryable error; replaying a completed payment cannot create a second ledger entry.

Full refund events mark matching completed gifts refunded. Partial refunds and disputes require reconciliation in PayPal and finance review; automatic partial-refund accounting/dispute management is not implemented. Verified events are retained in paypal_webhook_events for review. Do not treat this app's gross donation totals as your available PayPal or bank balance.

## Apple Pay and Google Pay

1. Enable the appropriate wallet capabilities for this merchant in PayPal.
2. Set PAYPAL_APPLE_PAY_ENABLED=true and/or PAYPAL_GOOGLE_PAY_ENABLED=true only after approval.
3. Register each exact production hostname/subdomain for Apple Pay through PayPal. Follow the dashboard's domain association instructions; if it supplies an association file, place the official unmodified file under public/.well-known/apple-developer-merchantid-domain-association before registration. No merchant-specific file has been fabricated in this ZIP.
4. Complete Google Pay production approval/domain requirements for this merchant as directed by PayPal/Google. The Google SDK uses TEST in sandbox and PRODUCTION in live mode.
5. Check wallet buttons on real eligible devices. Unsupported devices/accounts fall back to card entry or PayPal. Card fields also require PayPal eligibility; their presence is not guaranteed in every country or browser.

## Monthly giving

Create a PayPal catalog product for recurring ministry giving in the same environment and set PAYPAL_PRODUCT_ID to its ID. Set PAYPAL_SUBSCRIPTIONS_ENABLED=true only after configuring the webhook and final HTTPS NEXT_PUBLIC_APP_URL.

The app creates a fixed-amount monthly plan for the donor's agreed USD gift and sends them to PayPal for subscription approval. Recurring payment webhooks create one donation per verified transaction. The confirmation page can cancel future charges using a short-lived signed link (24 hours); donors can always manage/cancel directly in their PayPal account's automatic payments. Failure or delay of a webhook means payment stays unconfirmed in the app; review and resend failed events from PayPal.

The old giving_subscriptions table is retained, and existing Stripe subscriptions are NOT migrated or automatically canceled. Before removing the old live Stripe deployment/webhook, check for any active subscriptions or outstanding charges/refunds in Stripe. Resolve them with donor consent and explicit owner authorization, or keep the legacy deployment handling them until settled. New donors should use the new PayPal flow only.

## Cash App

Use an eligible church-owned receiving account and verify the exact recipient in Cash App. This release does NOT implement an automated Cash App Pay Partner API integration or assert that this account has been approved for it.

Set CASH_APP_ENABLED=true, CASH_APP_RECIPIENT_NAME and CASH_APP_CASHTAG (with or without the leading $). CASH_APP_MODE=test hides the recipient and blocks receipt records. After account/recipient verification and launch approval, set CASH_APP_MODE=live and redeploy. The only outgoing payment link is constructed under https://cash.app/ using the validated $Cashtag.

The donor sends the gift in Cash App. After funds actually arrive, an administrator opens Donations → Record donation → Cash App, enters the exact amount/reference and confirms receipt. A promise, screenshot or opening Cash App is not proof of received funds. No automatic success receipt is issued for an unverified manual transfer.

## Zelle

Confirm that the ministry's organizational bank account supports Zelle and enroll its official recipient. Configure ZELLE_ENABLED=true, ZELLE_RECIPIENT_NAME, ZELLE_RECIPIENT_TYPE=email (or phone), ZELLE_RECIPIENT and ZELLE_MODE=test. A phone must use +1 followed by ten digits. Test mode hides real recipients and blocks records.

After bank/recipient verification and launch approval, set ZELLE_MODE=live and redeploy. After the transfer arrives in the church's bank account, record it as Zelle with the exact amount, unique bank reference and verification attestation. Never enter bank login credentials, account numbers or routing numbers in this application.

## Validation and launch

- Run npm test and npm run build.
- In sandbox, test card approval, decline, cancellation, PayPal approval, interrupted capture, duplicate confirmation, receipt download, webhook retry and subscription payment/cancellation.
- Verify sandbox transactions never increase live donations/campaign totals.
- Confirm the recipient names and manually verified records for Cash App and Zelle.
- Switch only matching provider environment/credentials after approval. A real donation test requires owner authorization. Check provider transaction, webhook, exact ledger entry, campaign total and receipt together.
- Keep receipts/confirmations from the provider and monitor failed webhook deliveries.

Rollback: restore the original uploaded ZIP/application and its previous environment configuration. New tables may remain; do not delete financial records. Reconcile any real PayPal transactions before rollback. Restoring code alone does not cancel subscriptions or reverse money.

## Provider references

- https://developer.paypal.com/v5/expanded/integrate/
- https://developer.paypal.com/v5/apple-pay/integrate/
- https://developer.paypal.com/v5/google-pay/integrate/
- https://developer.paypal.com/docs/api/webhooks/v1/
- https://developer.paypal.com/docs/api/subscriptions/v1/
- https://developer.paypal.com/subscriptions/webhooks
- https://developers.cash.app/cash-app-pay-partner-api/guides/product-overview/how-cash-app-pay-works
