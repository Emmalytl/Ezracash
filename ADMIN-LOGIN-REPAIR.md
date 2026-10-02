# Admin login repair — current GitHub version b826609

## Verified cause
The deployed /admin route returns HTTP 307 with Location: /admin. Current GitHub src/app/admin/page.tsx contains a Staff dashboard server wrapper; its signed-out branch redirects to its own URL. This causes ERR_TOO_MANY_REDIRECTS before the login form can appear.

## Apply the repair
The complete project in this ZIP retains the current main-branch dashboard redesign. Extract it and replace matching repository files in their existing folders. The three functional changes are:

1. src/app/admin/page.tsx — replace the ENTIRE file with this ZIP's version. It must start with "use client" and export AdminLogin. This is the single /admin sign-in page. Do not substitute a Staff, Administrator or Developer page.tsx here.
2. package.json — build now runs the admin route checks after next build.
3. tests/admin-route-smoke.cjs — new regression check used by the build command.

Commit and push to the GitHub main branch connected to Vercel. Wait for its production deployment to succeed. Then open https://ezracash.vercel.app/admin. The sign-in page should show "Welcome back." with email and password fields. Authentication selects the correct role dashboard.

This repair has not been uploaded to GitHub or deployed: GitHub write access returned 403 Resource not accessible by integration.

## Validation
Production build passed on current main plus this repair. Seven production-server route checks passed: two signed-out login URLs show email/password forms without redirect, and five privileged routes redirect to /admin. All 25 existing payment checks passed (10 monthly checks use mocked provider/database). Authenticated and graphical UI verification remain pending. No accounts, records, payment modes or environment values were changed.

Clearing browser cookies cannot fix this server-side self-redirect. Deploying the corrected login file is necessary.
