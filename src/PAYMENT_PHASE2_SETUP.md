# House of Ezra Giving — Payment Phase 2

This build adds the secure Stripe test-mode payment layer without resetting the existing Neon database or administrator accounts.

## 1. Vercel environment variables

Add these to **Production** and **Preview** as needed:

- `STRIPE_SECRET_KEY` — Stripe **test** secret key (`sk_test_...`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe **test** publishable key (`pk_test_...`)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (`whsec_...`)

Do not put the secret key in client-side code.

## 2. Stripe webhook

Create a Stripe webhook endpoint pointing to:

`https://ezracash.vercel.app/api/payments/stripe/webhook`

For the initial test phase, subscribe to:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.

## 3. Wallets

Card, Apple Pay and Google Pay use Stripe's secure Payment Element. Wallet availability is determined by Stripe, the donor's device/browser, and the ministry's Stripe account/domain configuration.

## 4. Donation accounting

A donation is created as `pending` before the provider transaction starts. Only the verified Stripe webhook changes it to `completed`. Campaign totals continue to count completed donations only, so pending/failed payments do not inflate fundraising progress.

Tithe, General Offering and Special Offering are stored without a campaign. Campaign Gifts carry the selected campaign ID.

## 5. Card security

House of Ezra does not store card numbers, expiration dates or CVV. Payment details are entered into Stripe's hosted Payment Element.

## 6. Other payment providers

The unified payment UI reserves PayPal, Cash App, Venmo and Zelle. They should only be enabled after their merchant credentials and server-side verification flows are added. Zelle should use a ministry-approved manual verification workflow rather than a fake instant API checkout.

## 7. Test before live mode

Use Stripe test cards in test mode, confirm the PaymentIntent succeeds, verify the webhook changes the donation from `pending` to `completed`, and confirm the campaign total updates only after webhook confirmation. Do not switch to live keys until these checks pass.
