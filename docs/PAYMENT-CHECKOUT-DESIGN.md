# Payment screen design update — 2026-10-15

Based on GitHub main a849d75af963a8980ea3b2a3553e1c9865ce3de2. Scope: the payment modal presentation and scroll position only.

## Changes

- Dedicated card-field blocks with explicit host/iframe heights and spacing replace the overlapping inline labels.
- Clean card section heading, compact sandbox notice, softer borders, muted security note and a full-width dark-green Donate button.
- Expiry and security-code fields use equal flexible columns with no fixed minimum widths. Smaller-screen spacing, keyboard focus and reduced-motion styles are included.
- Previous-payment recovery remains available as a quieter secondary link.
- The payment modal opens at its top instead of retaining the previous form's scroll position.

## Update your existing project

This is a full source ZIP. For the smallest update, copy exactly these FOUR files into the same paths in your existing repository:

1. src/components/PayPalCheckout.tsx
2. src/components/PayPalCheckout.module.css (new — include this file)
3. src/app/page.tsx
4. src/app/page.module.css

Commit these files together. Do not replace src/app/admin/page.tsx with a staff dashboard file. This archive retains the working login from the base commit. Keep existing environment variables, PayPal credentials, webhook configuration and database unchanged. No new dependencies or database changes are needed.

## Verification

npm test passed: 27 payment boundary checks using mocked provider/auth/database, 21 campaign-picture checks and receipt rendering/safety checks. npm run build passed production compilation, type checking and all seven actual-server admin-route checks. git diff --check passed.

A separate review by the same assistant verified the payment creation/capture/error functions, script loader, login and receipt/result components were unchanged. No independent-agent review was performed. PayPal SDK styling was checked against https://developer.paypal.com/docs/checkout/advanced/customize/card-field-style/.

The candidate could not be opened by the cloud browser because it could not reach the local server (ERR_CONNECTION_REFUSED). Visual layout, actual PayPal-hosted iframe appearance, responsive behavior and wallet rendering remain unverified in a browser. No payment or live account test was performed and this update does not resolve the earlier generic card failure by itself. Test the rendered fields in sandbox after uploading these files.

No GitHub push or deployment was performed. Roll back by restoring these files from the base commit and removing the new module CSS; preserve all payment records and environment values.
