# Restore the admin login — c9bf22e

Cause: src/app/admin/page.tsx was overwritten with a staff-only page that redirects signed-out users to itself. The route test correctly blocked deployment with 307 instead of 200.

Fix: restore the existing AdminLogin from af92154, using the unchanged signin-card.module.css. The form submits to /api/auth/login and opens the correct developer, administrator or staff workspace after authentication. Protected dashboard guards and all payment tiles remain unchanged.

INSTALL THIS SMALL PATCH
1. Extract this ZIP.
2. In the existing GitHub repository, open src/app/admin/page.tsx and replace its entire contents with the extracted src/app/admin/page.tsx; alternatively upload that file while inside src/app/admin.
3. Commit the change to main. Vercel should build the new commit automatically through the existing connection.
4. Do not redeploy the older failed c9bf22e commit. Do not remove test:routes or replace other files.

Rollback: restore this one file from the prior revision if needed, knowing c9bf22e itself has the redirect loop. No data or environment changes.

Review: same assistant; independent-agent QA and browser sign-in not verified. No production deployment performed.

Validation: npm run build passed locally against c9bf22e plus this one-file restoration, including all 7 admin route checks. git diff --check passed.
