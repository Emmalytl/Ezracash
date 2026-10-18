# Ezracash security hardening candidate — 18 October 2026

Based on GitHub main 086062e193c701236f077e2ee577dc6865f91e08. Local review branch fix/security-hardening-20261018. Not pushed, merged or deployed. No production database or payment settings changed.

## Changes
- PostgreSQL-backed atomic login counters: at most 10 attempts per normalized account and 60 per Vercel client IP during each 15-minute window. Works across serverless instances. Keys are HMAC digests; raw emails/IPs are not used as limiter keys. Invalid/unavailable counters fail closed. Vercel forwarding headers are trusted only when VERCEL=1; other hosts retain account limits and need an explicit trusted-IP adapter before launch.
- Uniform unknown-account/wrong-password responses and a dummy cost-12 password comparison for missing accounts. Login requires JSON, bounds streamed request bytes to 8 KiB and masks internal exceptions.
- Same-origin mutation checks in middleware and login; rejects cross-site Fetch Metadata. Uses actual destination Host to tolerate Next internal hostname normalization. External PayPal webhook is exempt from browser-origin checks and remains protected by provider signature verification.
- Online-method labels cannot be created through manual donation entry. Only Manual, Cash, Check and Bank Transfer use the generic path; Zelle/Cash App retain their dedicated verification flows. Existing ledger records are not changed. Legitimate offline entry remains an authorized staff function; no new finance approval policy was silently introduced.
- Generic offline donation and its server audit now use a single SQL statement, so an audit failure prevents partial credit. Other generic expense/account operations still need a separate transactional review.
- Expense uploads validate byte signatures for allowed image/PDF types, in addition to existing size/MIME checks. Documents download as attachments with restrictive sandbox/nosniff headers. Signature checks are not image decoding/re-encoding, antivirus or PDF content disarm.
- Browser-reported events are prefixed client_; they cannot use the exact reserved server event names. Server actor/session attribution remains intact.
- Added anti-framing CSP, DENY framing, nosniff, referrer and restricted camera/microphone/geolocation headers; disabled X-Powered-By. CSP intentionally limits frame ancestors, objects and base URLs without guessing payment script allowlists; it is not a full nonce-based anti-XSS policy.
- Removed public health configuration details and sanitized diagnostic responses across the reviewed APIs. Anonymous security API now returns 401.
- PostCSS pinned through an npm override to 8.5.23. Next remains 15.5.27; no major framework upgrade. npm audit reports zero known vulnerabilities at test time.
- Added .gitignore exclusions for credentials, dependencies and build output. Retained existing login design, dashboard design and payment SDK flows. Manual-method controls reflect the new server allowlist.

## Verification completed locally
- npm run test:security: 23 passed (mocked credentials, database and auth; no real users changed).
- npm test: 27 payment-boundary cases, 21 campaign-picture checks and receipt checks passed with doubles.
- node tests/payment-method-panels.cjs: 10 passed.
- npm run build: passed, including 7 admin-route checks.
- node tests/security-http.cjs: 6 built-server scenarios passed (security headers, cross-origin rejection, JSON-only login, webhook exemption and minimal health). Real localhost HTTP, no provider/database calls.
- node tests/payment-routes.cjs: 6 built-server payment checks passed.
- npm audit: 0 reported vulnerabilities. This is a point-in-time dependency check, not a security guarantee.
- git diff --check passed.
- Same assistant performed implementation and a separate review pass. Independent-agent QA not performed.
- Browser could not reach localhost:3212 (ERR_CONNECTION_REFUSED). Visual and real-device wallet regression on this candidate remain unverified.

## Install and preview first
This is the complete project ZIP, excluding .git, node_modules, .next and local credentials.

1. Back up the repository and current deployment configuration. Create a review branch from the existing GitHub repository; do not delete the repository or Vercel project.
2. Merge the extracted Ezracash contents into the project, preserving the existing .git folder and local .env.local. All path structure matters, especially src/app/admin/page.tsx versus staff pages.
3. Run npm ci (or let Vercel install from the included package-lock.json). Use an isolated Neon test database/branch for preview, never production donation fixtures.
4. The additive migration is migrations/security-hardening.sql. The login helper also initializes this limiter table if the runtime role permits it; no existing records are deleted. Inspect and apply to the preview database first. Login requires the existing ADMIN_SESSION_SECRET and database variables. No new secret value is included or required in this ZIP.
5. Run npm run test:security, npm test, npm run build, node tests/security-http.cjs and node tests/payment-routes.cjs locally.
6. Verify real Neon login success, account/IP throttling across parallel requests, session revocation and the new table permissions on the preview deployment. Local tests used doubles, not a real PostgreSQL server. Verify admin forms and sandbox payment capture/webhook/ledger/receipt, including Apple/Google Pay on eligible devices.
7. Request approval for the exact production release only after preview results and database rollout are reviewed. Deployment is a separate step; no live launch is authorized by this file.

## Operations and remaining gaps
- Review provider MFA (GitHub, Vercel, Neon, Namecheap, PayPal), least-privilege database roles, WAF rules, log alerts, secret entropy/history/rotation and isolated backup restoration with the account owner. None is configured by this code ZIP.
- Existing runtime schema migrations still require broader permissions; migrating all DDL into a deployment migration pipeline is not completed here. Existing first-time setup behavior is not redesigned. Do not expose a fresh production database for unauthenticated bootstrap.
- The limiter has no scheduled cleanup configured. Maintenance can prune expired limiter rows using the commented query in the migration; hashes still count as security telemetry and need a retention policy. Thresholds can temporarily delay legitimate users after repeated attempts.
- A full nonce-based payment-compatible CSP, antivirus/image decoding and deeper transactional review remain follow-up work.
- Staff can still record intentionally offline income, as before. If every offline staff gift should require administrator approval, that is a separate policy/workflow decision requiring an approval UI and corresponding tests.
- No passwords, accounts, provider settings, live records, Stripe history or subscription settings were changed. Monthly configuration remains a separate task.

## Rollback
Restore the previous application revision and lockfile through the normal release workflow. The additive limiter table can remain; no data deletion is required. Do not restore the older vulnerable behavior as a permanent solution. Preserve current financial records and provider reconciliation evidence.
