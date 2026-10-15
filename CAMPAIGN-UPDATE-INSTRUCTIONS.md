# Campaign display update

Based on main commit c13ee91.

- Removed the repeated featured campaign card. All five campaigns remain in the main fundraising grid.
- Removed the legacy decorative banner panel retained beside the newer giving invitation.
- Replaced the original youth campaign photo with an illustrative image of African American youths sharing magazines, bundled at public/campaigns/youth-ministry.png. Campaign cards, details, the giving selector and admin previews use the replacement. A new image selected by the administrator will take precedence.

Extract this complete project, then replace matching files in your GitHub Desktop repository folder, preserving all folders. Commit and push main to trigger Vercel. Replace whole files; do not paste one version into another.

Keep the existing environment variables and database. No data migration is needed, and no payment mode changes are included. The old youth URL is replaced for display; existing database records are preserved.

Verification: production build and all 25 existing payment regression checks passed locally. Monthly payment checks use mocked provider/database responses. These changes have not been deployed from this workspace.
