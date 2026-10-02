# House of Ezra — redesigned workspaces

## Install this complete update
Extract the ZIP. Copy its contents into your existing Ezracash repository, replacing the matching files in their original folders. Do not paste one page file into another page. Keep the new WorkspaceActions.tsx, DeveloperSidebar.tsx, professional.module.css and security/ui.tsx files with the update. Commit and push to the GitHub branch connected to Vercel, then wait for the deployment to succeed.

This package has not been pushed or deployed. The live site will change only after deployment. Preserve your current Vercel environment variables.

## What changed
- Split sign-in page with branded ministry panel and clear account form.
- Dark navigation rail and a consistent visual system for all workspaces.
- Administrator: larger financial summaries, a new destination panel, improved charts, records and campaign cards.
- Staff: focused section headings, overview-only welcome panel, working destination shortcuts and improved forms and records.
- Developer: violet command center, prominent management controls, coordinated security and audit pages.
- Selected Administrator and Staff sections persist on refresh through the view query parameter.
- Security & Audit now uses the developer navigation and checks the role on the server.
- Developer User Management and Administration links open their respective tools.
- Restored the actual sign-in component at /admin. This resolves the self-redirect route in the source this update is based on.
- Scoped styles prevent legacy global dashboard styles from overriding the redesign.
- Existing landing-page rectangle, round marquee, missions feature and youth-magazine image are included; the small duplicate heading stays removed.

## Routes
- /admin — sign in
- /admin/administrator — administrator workspace (also available to developers)
- /admin/staff/dashboard — staff workspace
- /admin/developer — developer workspace
- /admin/security — developer security and audit

## Validation
Production build and type validation passed. The 15 existing payment-security checks and 10 mocked monthly-giving checks passed. Runtime HTTP checks passed for the landing page and login, including an expired-login query. All five privileged routes redirected a signed-out request to /admin. The production server served the new scoped dashboard stylesheet.

Authenticated interactions and graphical desktop/mobile review remain to be checked after deployment; the browser preview was unavailable in this environment. This does not constitute live-provider payment verification. No donation records or accounts were created, and no payment credentials, environment variables or database records were changed.

## After deployment
Sign in with each existing role. Check navigation, refresh a selected section, open the existing campaign/gift/expense forms, and verify Developer User Management, Administration and Security & Audit. Use test mode for payment verification until live configuration is deliberately completed.

Source base: GitHub main 85f97b6, plus the prior complete landing-page and route repairs.
