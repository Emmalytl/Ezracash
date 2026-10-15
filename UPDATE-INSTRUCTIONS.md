# Landing page and giving modal update

This is the complete Ezracash project, with the repaired home and admin routes.

## Upload with GitHub Desktop

1. Extract this ZIP into a temporary folder.
2. Copy the extracted project contents into your existing Ezracash repository folder. Replace matching files and preserve all subfolders. Do not upload all the page.tsx files into one folder.
3. Check that package.json is at the repository root, and that src/app/page.tsx and src/app/admin/page.tsx are in their separate folders.
4. Commit the changes and push main. Your connected Vercel project should then deploy them to your existing address.

Keep your existing Vercel environment variables. This update does not migrate or reset the database, add duplicate campaigns, or switch payments to live mode.

## What changed

- Navy, cream and gold landing page with a new hero, ministry focus strip and responsive campaign cards.
- Visual giving selector with campaign thumbnails, separate tithes and offerings, selected states and keyboard controls.
- Refined gift amount and frequency controls, properly labelled donor inputs and a required email label for monthly giving.
- Safe progress display for campaigns without a goal.
- Ministry checkout loading text no longer displays the provider name.

## Validation

Production build and all 25 existing payment security/monthly giving regression checks passed. The monthly checks use mocked provider/database responses; they do not execute real payments. Apple Pay and Google Pay still depend on provider configuration and browser eligibility. No live payment or subscription was created for this update.
