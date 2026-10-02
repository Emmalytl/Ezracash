# Round marquee and featured campaign restoration

Based on GitHub main commit 722297f.

- Restored the circular giving marquee in the main banner, replacing the rectangular invitation card.
- Restored the featured campaign banner below the main banner. It features the active Missions campaign, with a non-building campaign fallback.
- The featured campaign is excluded from the card grid to prevent a duplicate. It remains selectable in the giving modal.
- Kept the approved African American youths sharing magazines image and the existing giving/payment flow.

Extract the full project, then replace matching files in your GitHub Desktop repository folder, preserving folders. Replace complete files instead of pasting code into existing files. Commit and push main for Vercel to deploy.

No environment variable or database changes are needed.

Validation: local production build passed and all 25 existing payment regression checks passed. Monthly checks use mocked provider/database responses. This ZIP is not a verified live deployment.
