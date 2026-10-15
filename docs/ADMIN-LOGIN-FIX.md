# Admin login regression fix — 2026-10-09

Candidate: GitHub main b5a072a with src/app/admin/page.tsx restored from the working 78ed79b revision. The latest circular marquee change is preserved.

Cause: /admin used the staff-only guard and redirected signed-out visitors to itself, causing HTTP 307 instead of the expected login HTTP 200.
Fix: Restore the original login form and its role-based post-login navigation. Protected dashboard guards and the regression test remain unchanged. No database, credentials, payments or environment changes.

Validation: npm run build passed compilation, type checking and all seven admin-route smoke checks. git diff --check passed. Review was performed in a separate pass by the same assistant; independent-agent QA was not performed. Browser interaction and real sign-in were not verified; the browser could not reach the local preview in this session. No production deployment has been performed.

To fix your existing GitHub project, replace ONLY src/app/admin/page.tsx with the file at the same path in this archive, commit it, and allow Vercel to rebuild. Do not copy src/app/admin/staff/page.tsx into that location. The archive includes the complete tracked source without dependencies, build output or local secrets. Preserve your existing environment configuration.

Rollback: restore src/app/admin/page.tsx from b5a072a, which reintroduces the known redirect failure.
