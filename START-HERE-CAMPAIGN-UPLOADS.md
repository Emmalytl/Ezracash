# Campaign picture uploads

## Changes
Administrator and Staff can upload a JPG, PNG or WebP picture up to 3 MB when creating or editing a campaign. A preview shows the selected picture before saving. The optional Image URL field is under "Use an image URL instead". You can save without a picture. Existing images remain selected while editing unless replaced or removed. Selecting an upload takes precedence over the URL.

Small uploaded pictures are stored in your existing Neon database, not the temporary Vercel filesystem. No separate image service or storage credentials are required. The first valid upload creates the campaign_images table and index through CREATE TABLE/INDEX IF NOT EXISTS. The database role must have permission to create tables, as already required by the existing receipt/schema setup. This does not reset campaign records.

The campaign, picture and audit entry are written in one database transaction. Public campaign pages receive the picture's URL; the actual image is served as a separate public image response. Pictures are public campaign assets, so upload images suitable for public display. File type, file signature and size are checked on the server. Existing server-side role checks protect uploads.

## Install the complete update
Copy this ZIP's contents into your actual Ezracash repository folder, replacing matching files while preserving all folder paths. Commit and push to the main branch connected to Vercel. Keep the existing environment values and test payment mode.

New files:
- src/components/CampaignPhotoField.tsx
- src/components/CampaignPhotoField.module.css
- src/lib/campaign-upload.ts
- src/lib/campaign-media.ts
- src/app/api/campaign-images/[id]/route.ts
- tests/campaign-photos.cjs

Updated campaign files:
- src/app/admin/administrator/ui.tsx
- src/app/admin/staff/ui.tsx
- src/app/api/campaigns/route.ts
- package.json

This complete package also carries forward the previous requested single-card login polish in src/app/admin/page.tsx and src/app/admin/signin-card.module.css. Keep both login files together. The login page exports AdminLogin and contains no signed-out self-redirect.

## Validation
Production build and all 7 existing admin-route checks passed. npm test passed all 46 checks: 15 payment-security, 10 monthly-giving and 21 campaign-picture checks. Monthly-giving and campaign-picture checks use mocked services/database; they do not prove a real Neon upload has completed. Picture tests cover optional URL/no-picture saves, multipart create/edit, binary response bytes, invalid/oversized/spoofed/empty files, unauthorized writes, nonexistent campaigns and storage failures. Runtime checks also confirmed signed-out campaign writes return 401 and invalid public picture IDs return 404.

Authenticated browser workflows and a real database upload remain pending after deployment. No production records were created or changed during testing. This update has not been pushed or deployed from this environment.

After deployment: sign in, open New campaign, choose a picture, save, and confirm it appears in the campaign card and public landing page. Edit that campaign without selecting a replacement to confirm the current picture persists. Check an optional URL and a no-picture campaign in test data.

Base: GitHub main f6d40f8, plus the already requested original-login polish.
