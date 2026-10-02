# House of Ezra Giving — Neon/Vercel database fix

This build keeps the existing landing page and admin UI, and makes the server-side Neon connection detect the common Vercel/Neon environment variable names:

- DATABASE_URL
- POSTGRES_URL_NO_SSL
- POSTGRES_URL
- POSTGRES_PRISMA_URL
- POSTGRES_URL_NON_POOLING
- DATABASE_URL_UNPOOLED
- NEON_DATABASE_URL

After deploying, keep the existing Neon variables and ADMIN_SESSION_SECRET. No SQL or terminal commands are required for the first admin setup.

Open `/admin/setup`, create the first admin, then use `/admin/login`.

## New finance/security updates
- Administrator profile can be edited from Profile & Payment Connections.
- Expenses & Audit ledger records withdrawals, purpose, category, payment method, reference, approver, status and date.
- Dashboard shows received gifts, recorded expenses and net position.
- Notification bell polls for new gifts and surfaces new-gift alerts in the admin UI.
- Admin sessions expire after 15 minutes of inactivity; active sessions refresh while the administrator is working.
- Payment provider layer includes Cards, PayPal, Venmo, Cash App, Apple Pay, Google Pay and Zelle as integration-ready providers. No provider credentials are hard-coded or connected yet.


## Public landing page and runtime database check
- `/` is the public House of Ezra Giving landing page. It is not redirected to Admin.
- `/admin/login` is the administrator sign-in page.
- `/admin` is the administrator dashboard.
- `/api/health` safely reports which supported database variable names are visible to the current deployment; it never returns database secrets.
- The public landing page remains available with fallback campaign content if the database is temporarily unavailable.
- Admin authentication and live campaign totals require a working Neon/Postgres connection.

### Vercel database requirement
The Ezracash Vercel project must have at least one of the supported server-side database variables enabled for the deployment, preferably `DATABASE_URL`. After adding/changing a variable, create a new deployment. Do not paste database credentials into source code.
