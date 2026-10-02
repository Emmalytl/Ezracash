# Ezracash consolidated testing build

Keep your existing Neon database and Stripe test environment variables. This ZIP does not contain your secrets and does not switch payments to live mode. Copy the project files into the existing GitHub repository, commit and push, then wait for Vercel Ready. Do not delete the database or re-run the base schema.

## Included

- Correct admin login and developer access to Administration and User Management.
- Modern campaign, giving and payment dialogs with responsive styles.
- Card, PayPal and Cash App shown once. Unconnected providers are disabled.
- A card-only Stripe form with a Send payment button enabled once details are complete.
- Amount, email and campaign validation before checkout; server validates again.
- Escape dismissal and dialog keyboard focus handling.
- Confirmation checks the database record updated by the signed webhook. A short-lived signed bearer token restricts access to the individual donation.
- A downloadable text receipt becomes available only for completed donations. This is a donation record, not a tax-deductibility certification.
- Unavailable campaign data is distinguished from an empty campaign list.
- Protected administrator roles are no longer offered editable controls to another administrator.
- Existing payment signature validation, atomic event deduplication, idle logout and role enforcement are retained.

## Test setup

Use matching Stripe test keys from the intended receiving Stripe account. Register a TEST webhook destination:

https://ezracash.vercel.app/api/payments/stripe/webhook

Select payment_intent.succeeded, payment_intent.payment_failed and payment_intent.canceled. Put that destination's signing secret in STRIPE_WEBHOOK_SECRET in Vercel. Redeploy whenever variables change. Test and live webhook secrets are different.

## Acceptance checks requiring your signed-in systems

1. Developer: open User Management and Administration; return to the developer dashboard.
2. Create a temporary Staff account; verify its role routing and denied privileged access. Preserve existing accounts.
3. Create a clearly named test campaign with a positive goal and check it on the landing page. Pause it and verify checkout refuses new gifts for it.
4. Enter zero, negative values, more than two decimals, malformed email and no campaign for Campaign Gift: stay on the gift form with a useful error.
5. In Stripe test mode only, use Stripe's documented test cards to exercise success and declined payments. Never enter test cards into live mode.
6. Successful test payment: Stripe webhook delivers HTTP 200; donation becomes completed; totals update; confirmation view offers a receipt.
7. Resend the same Stripe webhook event: donation amount is counted once.
8. Expense: create a test expense with a raster receipt image; verify authorised viewing and net totals.
9. Mobile phone: check navigation, giving dialog, keyboard/input sizing and the Send payment button. Desktop build validation does not prove phone behaviour.
10. Confirm logout and idle expiry; preserve the single-active-session policy.

## Still external or not implemented

- PayPal and Cash App merchant integrations are not implemented. Their disabled choices cannot receive money. Connecting them needs account-specific provider setup and a separate implementation.
- Stripe receipt_email is passed to Stripe. Automated receipt email delivery depends on Stripe settings and mode; the app does not claim to run its own email service.
- Live keys, verified receiving entity, payout bank, live webhook and wallet domain registration are deliberately not changed.
- Refund handling and reconciliation beyond the existing statuses are not implemented by this build.
- No signed-in database actions, completed test charge, receipt-email delivery or live payout have been verified in this environment.

## Validation

Production build and TypeScript checks passed during development. Twenty-five regression checks cover signature handling, receipt bytes and confirmation-token tampering/expiry/rotation. These do not replace the acceptance checks above.

## Monthly giving
This build also includes monthly subscriptions. Read MONTHLY_GIVING_SETUP.md before testing them. The extra Stripe portal, webhook and restricted-key configuration is required.
