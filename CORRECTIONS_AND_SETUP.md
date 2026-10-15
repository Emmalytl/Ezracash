# Ezracash corrected project — 1 October 2026

## What changed
- Protected admin routes are dynamic, preventing build-time sign-in redirects from becoming permanent.
- Restored Developer/Administrator access to the user management page; Staff retain their own dashboard.
- Administrators cannot demote other administrators through the account API.
- Unknown roles receive Staff privileges instead of Administrator privileges.
- Session signatures require ADMIN_SESSION_SECRET; malformed cookies do not crash authentication.
- Login session creation is serialized per account to enforce the existing single-device policy.
- Activity heartbeats renew both server sessions and browser cookies. Background polling does not extend inactivity. A shared activity component covers all admin workspaces with the existing 15-minute timeout.
- Stripe signatures reject invalid timestamps and malformed signatures safely.
- Stripe webhook updates match donation ID, provider, intent, USD currency and amount. Deduplication and status updates use one atomic statement. Older failure events cannot overwrite completed donations.
- Checkout rejects invalid campaign IDs, unsupported methods, sub-$0.50 gifts and fractional cents.
- Campaign, donation and expense inputs receive stronger validation.
- Receipt downloads decode PostgreSQL BYTEA responses; uploaded receipts are limited to common raster images and PDFs.
- Public campaign failures no longer show invented raised amounts. Empty campaign lists are supported and featured campaign text comes from the actual campaign.
- Removed the Monthly option because the existing integration creates one-time PaymentIntents. Recurring billing has not been implemented.
- Missing root public assets were copied from src/public.
- Added package-lock.json, test and typecheck commands, and regression checks.

## Replace files in your existing GitHub Desktop repository
1. Extract this ZIP.
2. Open your existing Ezracash repository using GitHub Desktop > Repository > Show in Explorer.
3. Copy the CONTENTS of the extracted Ezracash folder into that existing repository folder. Replace matching files. Do not put an additional Ezracash folder inside it.
4. Keep your existing .git folder and local environment files. This ZIP excludes Git metadata, secrets, node_modules and build output.
5. Review the changes in GitHub Desktop, commit, and push when you are ready. No commit, push or deployment was performed for you.
6. Keep the existing Neon database and existing Vercel/Stripe environment variables. Do not reset the database or rerun seed scripts.

## Local use
Run npm ci, npm test, npm run typecheck, and npm run build.
Copy .env.example to .env.local and supply your existing Neon URL, ADMIN_SESSION_SECRET and Stripe configuration, then run npm run dev.
Use a stable, strong ADMIN_SESSION_SECRET. Do not change an existing production secret unnecessarily, since that signs users out.

## Validation and limits
- Production build and TypeScript validation passed with Next.js 15.5.27.
- Nine regression checks passed for valid/tampered/expired/malformed Stripe signatures and receipt decoding.
- No live database, account credentials or Stripe secrets were supplied. Authenticated database workflows, SQL concurrency behavior, live/test payments and webhook delivery still require verification against your configured environment.
- PayPal, Cash App, bank transfer and Zelle setup placeholders remain as provided. No new payment provider was added.
- This is a targeted correction of the supplied project, not a certification that every production requirement is implemented.
