# Dashboard design update

Based on main commit 85f97b6.

## Changes

- Removed the small House of Ezra Giving label before the larger banner heading. Kept the rectangular invitation, round marquee, featured Missions campaign and approved youth image.
- Administrator: light sidebar, navy welcome panel, refined financial metrics and charts, clearer campaign cards, tables and forms.
- Staff: green operations panel, navigation sidebar, campaign photos, refined giving/expense tables and responsive mobile navigation. Both Staff dashboard URLs use the same UI.
- Developer: violet control panel, new navigation sidebar, refined session cards and audit activity. User Management now opens the existing account-management interface instead of redirecting back to Developer.
- Restored the login form at /admin, which had been replaced in the uploaded repository by a page that redirected signed-out visitors back to /admin.
- Explicit per-request rendering on the protected Developer and Staff pages.

Existing role checks, account permissions, operational API handlers, payment settings and database records are retained. No account, campaign, donation or expense was created while preparing this update.

## Upload

Extract this full project. Replace matching files inside your GitHub Desktop repository folder, keeping every subfolder in place. Replace complete files; do not paste the new contents into the old contents. Commit and push main to trigger Vercel. Keep existing environment variables and database.

Include the new src/app/admin/dashboard-theme.css file. It is imported by the admin layout and provides the dashboard design.

## Validation and remaining checks

Production build passed. All 25 existing payment regression checks passed; monthly checks use mocked provider/database responses. Local HTTP checks passed for the public page and login, and for unauthenticated redirects on Administrator, Developer and both Staff routes.

The cloud browser blocked access to the local preview. Visual verification and signed-in workflow tests for all three roles remain pending after deployment. This file does not claim a live deployment or successful authenticated operations.

After deployment, verify each role with its existing account, open dashboard navigation and record forms, and check Developer User Management and Administration links. Payment mode is unchanged.
