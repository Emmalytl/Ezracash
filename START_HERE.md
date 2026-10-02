# Final consolidated test build

1. Copy this project's contents into your existing Ezracash repository, replace matching files, then commit and push. Preserve your existing environment variables and Neon database.
2. Keep Stripe TEST keys. Monthly giving additionally needs the test customer portal login URL in NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL, cancellation enabled in Stripe, and subscription/invoice webhook events selected. See MONTHLY_GIVING_SETUP.md for exact steps and API-key permissions.
3. Redeploy after setting the portal environment variable. Test one-time giving, monthly signup, renewal and cancellation using the acceptance checklist. The assistant has not verified completed payments or cancellation in your signed-in Stripe account.

One-time giving uses inline Stripe card fields. Monthly giving uses Stripe-hosted recurring Checkout with explicit recurring consent, an email, and a management/cancellation portal. Paid monthly invoices create separate donation records and display as Monthly subscription in the administrator ledger. Payment dates use Stripe's paid timestamp. Webhook replays do not double-count invoices.

PayPal and Cash App are disabled and remain a separate future integration. No live mode activation is performed. Do not reset or re-import the database.
