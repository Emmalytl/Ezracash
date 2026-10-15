# Separate payment tiles — Ezracash

Prepared 2026-10-15 from GitHub main af92154 on review branch ui/separate-payment-wallets.

## What changed
- Six payment tiles: Card, Google Pay, Apple Pay, PayPal, Cash App and Zelle.
- Three columns on larger screens; two columns on phones.
- Local wallet logos, selected indicator, keyboard focus, native radio selection.
- Each online method initializes only its own checkout panel. Card no longer includes wallets.
- Disabled/ineligible wallets show a useful explanation instead of silently showing an empty area.
- PayPal remains the online processor for cards and wallets. Existing receipt, confirmation, manual transfer and monthly giving flows are retained.

App changes: src/app/page.tsx, src/app/page.module.css, src/components/PayPalCheckout.tsx, src/components/PayPalCheckout.module.css, public/branding/payments/googlepay.svg, public/branding/payments/applepay.svg.

## Validation
- npm run build: passed, including 7 signed-out admin route checks.
- node tests/payment-method-panels.cjs: passed 10 cases using SDK doubles: separate panel initialization, wallet disabled, merchant ineligible and device unsupported. Initialization never creates a donation.
- npm test: 27 payment boundary cases, 21 campaign-image checks and receipt checks passed with mocks.
- git diff --check and SVG XML parsing: passed.
- Review performed by the same assistant in a separate pass; no independent-agent QA.
- Browser preview failed with ERR_CONNECTION_REFUSED at localhost:3079. Responsive layout is implemented but not visually verified here.
- No provider settings, Vercel configuration, live charges, database changes or deployment performed.

## Install
This ZIP contains the complete project, excluding dependencies, build output, Git metadata and local credentials.
Keep a backup. Copy the project contents into your existing local repository, preserving its .git folder and .env.local. Do not delete the GitHub repository or Vercel project. Install dependencies with npm ci, run npm run build, commit and push through your normal workflow.
For a minimal update, copy only the six app files listed above and optionally the new test.

Existing wallet environment variables and PayPal/domain approvals still apply. Provider enablement and SDK eligibility are required for the payment buttons; a tile alone does not prove approval or a successful payment. Monthly giving has not been configured as part of this change.

Rollback: restore the six changed app files from af92154. No financial records need alteration.
