# Payment sandbox validation

Base: main commit 8fb5a7e.

- npm run build: passed production compilation, type checking and 7 admin-route checks.
- npm test: passed 67 automated checks (15 signature/receipt, 10 monthly giving, 21 campaign photos, 21 new PayPal/Venmo sandbox checks). Provider/database calls in those tests are mocked.
- git diff --check: passed.
- Built local server, with payment credentials deliberately absent:
- Public config returns 200 and disables unconfigured PayPal/Venmo.
- GET /api/admin/payments: 401, as expected.
- POST /api/admin/payments: 401, as expected.
- POST /api/payments/paypal/create-order: 503, as expected.
- POST /api/payments/paypal/capture: 503, as expected.
- GET /api/payments/paypal/status: 503, as expected.

Not verified: real PayPal OAuth credentials, actual sandbox capture, Venmo account/browser eligibility, authenticated graphical checkout, Neon table creation with the user's database, GitHub push, or Vercel deployment. No account credentials were changed and no real money moved.
