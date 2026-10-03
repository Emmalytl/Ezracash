# Professional donation receipt — 3 October 2026

Includes the prior donation result popup and corrected login. Implementation base ca80b00 with login matching c3108ee main. No accounts, environment settings, database records, payment status or production deployment were changed by the assistant.

Confirmed one-time Stripe gifts and confirmed PayPal/Venmo sandbox gifts now download a standalone HTML receipt with the official embedded church logo, church name, assembly, donor details, exact USD amount, giving type, UTC confirmation date, receipt reference and processor reference. Open the downloaded file and click Print / Save as PDF to create a PDF using the browser print dialog. No automatic email delivery or direct PDF file generation was added. Monthly hosted giving remains unchanged.

Set the verified church details in your environment:
- CHURCH_RECEIPT_ADDRESS: official church street/city/state/postcode address; newlines supported.
- CHURCH_RECEIPT_CONTACTS: official phone numbers, separated with / or commas.
- CHURCH_RECEIPT_EMAIL: official public contact email, if desired.

These fields are public and are printed on receipts. They are not bank credentials. The project did not contain verified address/phone details, so defaults are blank; never substitute invented details. On Vercel select the website deployment's environment and redeploy after changing variables. On a local machine set .env.local and restart.

Preview: open docs/Receipt-Preview.html. It is clearly labeled a test/design preview, with placeholders for contact details, and is not a real transaction receipt. Actual test payments also remain visibly marked No real money / not a real donation receipt. Live receipts state only a payment acknowledgment and do not claim tax deductibility.

Apply this full project's source into the existing checkout, preserving private environment files, database and dependency setup. Do not nest a second Ezracash directory. Changes: src/lib/payments/donation-receipt.ts; src/lib/payments/providers.ts; src/app/page.tsx; src/app/api/payments/stripe/status/route.ts; src/app/api/payments/paypal/status/route.ts; src/components/PayPalSandboxCheckout.tsx; .env.example; package.json; new receipt tests. The previous popup files and working login are included.

Validation: receipt checks cover exact cents, embedded logo, church contact formatting, HTML escaping, sandbox labels and rejection of unconfirmed gifts or unsafe logo URLs. Existing 88 checks passed with mocked providers/database. Final production build includes seven admin route smoke checks (see delivery response). Same assistant implementation/review; no independent QA. Graphical browser preview was blocked previously, and no mobile print-layout or real donor/provider end-to-end check is claimed. Inspect the preview and deployed receipt before launch.

The earlier webhook rejection showed Webhook not configured. The user reports finishing that setup; successful event redelivery and database confirmation have not been verified by the assistant. This design does not bypass confirmation or mark pending gifts complete.

Rollback: revert receipt/UI source changes and rebuild, preserving the working login, existing environment secrets, and all donation records.
