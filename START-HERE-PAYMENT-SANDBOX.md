# Ezracash — PayPal and Venmo sandbox update

Based on GitHub main 8fb5a7e. Keep the approved login, landing page, dashboards, campaign uploads and Stripe flow.

## Install
Replace the project files in your GitHub checkout with this ZIP's files; retain your local secrets and Git configuration. Commit and push using GitHub Desktop. This package has not been pushed or deployed by the assistant.

## Connect sandbox credentials
1. In https://developer.paypal.com/dashboard/ choose Sandbox → Apps & Credentials.
2. Create an app for a sandbox Business merchant account. Use a US merchant if testing Venmo.
3. In Vercel Project Settings → Environment Variables, add:
   - PAYPAL_ENV=sandbox
   - PAYPAL_CLIENT_ID=<the sandbox app Client ID>
   - PAYPAL_CLIENT_SECRET=<the sandbox app Secret>
   - PAYPAL_VENMO_ENABLED=true (optional; false disables Venmo)
4. Keep ADMIN_SESSION_SECRET and the existing Neon and Stripe variables unchanged. Do not commit credential values to GitHub. Redeploy after setting variables.
5. Administrator → Settings shows individual provider status and sandbox setup instructions. Developers can open this same Administration settings page. Staff cannot access its connection-check API.
6. Click Check PayPal sandbox connection. Success means OAuth credentials were accepted, not that a payment capture has passed.

## Test checkout
- On the landing page choose a ONE-TIME gift, then PayPal or Venmo.
- Use a separate sandbox PERSONAL buyer account. Do not use the receiving business account as the buyer.
- Approve the sandbox payment. Confirmation is based on a server-verified capture, matching order ID, donation reference, USD currency and exact amount.
- Download the clearly labelled sandbox test receipt. It is not a real donation or tax receipt.
- Cancel another checkout and verify it is never marked completed.
- If capture/connection is interrupted, use Check confirmation before paying again. The browser session retains the latest signed sandbox receipt token for recovery; it expires after 24 hours.
- Venmo simulation is offered only if enabled and the PayPal SDK reports eligibility. It does not debit a real Venmo account. If unavailable, test PayPal and check the merchant/browser eligibility requirements.

## Financial integrity and limitations
PayPal/Venmo are sandbox ONLY in this release. PAYPAL_ENV=live disables them; no live PayPal API destination is implemented. Credentials are never a way to bypass that restriction.

Simulated PayPal/Venmo gifts use a separate sandbox_donations table, created on the first sandbox checkout. The real donations table, finance ledger, campaign totals and existing accounts are not altered by these test payments. Existing Stripe test behaviour is preserved.

Sandbox receipts use signed, expiring per-gift tokens. Capture uses a stable PayPal request ID, and retries check the existing provider order before capture. The status endpoint reconciles an interrupted completed capture. Full live webhook/refund/subscription integration remains future work. Monthly giving remains on the existing Stripe flow.

Cash App is not connected: Stripe's Cash App Pay eligibility documentation lists religious organizations and charitable fundraising as prohibited. Confirm a provider-approved ministry solution before implementation. Do not misclassify the ministry to enable it.

Zelle is not connected: the ministry needs bank-supported enrollment and verified receiving details. No fake Zelle sandbox or automatic success button is included. Both Cash App and Zelle stay absent from donor checkout until properly supported.

## Verification
See the accompanying validation report for checks actually run. Automated provider/database tests use mocks; they do not establish that your PayPal account, production environment, or authenticated browser checkout works.

Official setup references:
- https://developer.paypal.com/studio/checkout/standard/integrate
- https://developer.paypal.com/venmo/test
- https://docs.stripe.com/payments/cash-app-pay
- https://www.zelle.com/faq/small-business
