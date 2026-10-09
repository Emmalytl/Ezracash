# Clickable giving marquee

Based on GitHub main commit 78ed79b4ac4c92f50afac7c7ca780b6b29e03782.

The complete round Give with purpose marquee opens the existing Give Now modal. It uses a native button for click, touch, Enter and Space activation, with a visible keyboard focus outline. Its text and animation are preserved.

Changed source files:
- src/app/page.tsx
- src/app/page.module.css

Validation: npm run build passed, including all 7 admin-route checks. git diff --check passed. A separate code review was performed by the implementing assistant; no independent reviewer was used. Browser verification was blocked because the browser could not reach the local preview server; visual and interaction behavior were not verified in a browser.

This archive contains the full tracked project, with the two source changes above. Dependencies, build output and local secrets are excluded. Install with npm ci and use your existing environment configuration. To update an existing checkout without replacing configuration, copy only the two changed source files. To roll back, restore those two files from the base commit.

This update has not been pushed to GitHub or deployed.
