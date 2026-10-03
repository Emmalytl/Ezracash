# Payment processor update — 3 October 2026

## Result
Based on GitHub main commit 42dce241d1ba571cd24441d485593bc59b642f12.
The compact payment method dropdown now includes Card, PayPal, Venmo and Zelle.
Stripe handles cards and eligible Apple Pay/Google Pay; existing monthly Stripe giving is retained. PayPal/Venmo remain sandbox-only, with a separate sandbox ledger. Zelle is a manual bank transfer with administrator verification, not an automated bank connection.
Cash App Pay through Stripe is unavailable for church and charitable fundraising categories. Environment toggles cannot enable it.

## Set up without moving money
In Administrator > payment setup, review each provider status and its instructions. “Configured” means required settings exist; it does not prove provider approval or successful payment.
Keep Stripe test keys paired with test keys and keep the existing webhook/session secrets. Test on compatible wallet devices, including payment domain registration and account eligibility.
Use PayPal sandbox business credentials with a separate sandbox personal buyer. PAYPAL_ENV=sandbox, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and ADMIN_SESSION_SECRET are required; PAYPAL_VENMO_ENABLED=true explicitly enables the Venmo sandbox option. Setting PAYPAL_ENV=live does not enable live PayPal in this version. A separately reviewed live PayPal implementation is still needed before launch.
Link the organizational bank account through Stripe and PayPal's own account settings; the application does not collect bank passwords or bank account numbers. Each provider must approve the receiving organization/account. Donation totals represent gifts, not a reconciled bank balance after fees and payout delays.

## Zelle setup
Confirm that the receiving bank supports Zelle for this organizational account, then enroll its receiving email or US phone through the bank.
Use these environment variables (also in .env.example):

```
ZELLE_ENABLED=true
ZELLE_MODE=test
ZELLE_RECIPIENT_NAME=House of Ezra
ZELLE_RECIPIENT_TYPE=email
ZELLE_RECIPIENT=your-enrolled-email@example.com
```

For phone recipients use ZELLE_RECIPIENT_TYPE=phone and +1 followed by ten digits.
Test mode shows a preview, hides the real recipient and rejects completed ledger entries. It does not simulate a Zelle network payment. Missing/invalid settings leave Zelle unavailable.
Only after bank setup and launch approval, change ZELLE_MODE=live and restart/redeploy. This publishes the recipient to donors and allows recording real received bank gifts. Do not activate it while testing with a real recipient.
Donors send money from their bank app. The donation page cannot confirm a transfer. An administrator/developer records a received gift using Record a donation > Zelle, exact USD amount, unique bank reference, and the bank verification checkbox. Staff and anonymous users cannot verify Zelle receipts. Case/space-normalized repeated references are rejected. The received ledger entry and audit are one database statement. Do not manually re-enter gifts automatically recorded by Stripe/PayPal.

## Installation and preservation
This ZIP contains the complete project source, not a database dump, dependencies, credentials or build cache. Merge/replace project source while preserving your private environment files and existing database. Do not reset the database or copy .env.example over real credentials.
Run npm ci, npm test, and npm run build. For Laragon development use npm run dev; this payment update does not replace the Neon driver with a local PostgreSQL driver.
The existing donation API adds any missing provider/reference columns and the provider/reference uniqueness index. No destructive migration was introduced. Existing conflicting manual references may need review before that existing index can be created; do not delete gift records to bypass an error.

## Evidence and limitations
- Production build and 7 admin route smoke checks passed.
- npm test: 88 checks passed (15 payment security, 10 monthly giving, 21 campaign photos, 21 PayPal sandbox, 21 processor/Zelle checks).
- Final TypeScript check and git diff whitespace check passed.
- Local production HTTP checks: / and /admin returned 200; public configuration marked unconfigured methods accurately; unauthenticated /api/donations returned 401.
- Implementation and security review were separate passes by the same assistant, not independent reviewers.
- Provider/database tests are mocked. Actual Neon transactions, concurrency, provider OAuth/captures, real wallets, payouts and bank receipt verification were not exercised.
- Browser preview was blocked with ERR_BLOCKED_BY_CLIENT. No visual or mobile interaction check is claimed.
- Nothing was pushed to GitHub or deployed; no provider account, keys, bank setup or production settings were changed.

Before launch, verify the actual deployed modal on mobile/desktop, sandbox payments and webhook reconciliation, administrator bank receipt recording and duplicate rejection against a staging database. Complete and review live PayPal support if required. Deployment and real payment activation remain separate approval steps.
Rollback: restore the previous source version and restart/redeploy, preserving the database and gift history. Zelle records already received must remain in the ledger.

## Provider sources
- https://docs.stripe.com/payments/cash-app-pay — restricted categories, including MCC 8398 and 8661.
- https://developer.paypal.com/docs/checkout/pay-with-venmo/ — US account/device eligibility.
- https://www.zellepay.com/faq/small-business-using-zelle — participating bank and account eligibility.
