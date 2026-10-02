# Restore the floating Install app control

Based on GitHub main commit 636f98a.

## Install this patch
Copy the two files from this ZIP into the matching paths in your existing GitHub checkout:
- src/app/PwaRegister.tsx
- src/app/pwa.module.css
Commit and push, then wait for Vercel deployment. No database or environment-variable changes are required.

## Behaviour
The floating Install app button appears on the landing page for visitors using browser mode. An old permanent dismissal flag no longer hides it. It stays above the mobile navigation and below giving/payment overlays. It is hidden inside the installed standalone app and after installation is accepted. It is absent from administrator, staff and developer pages.

On iPhone/iPad (including iPad desktop mode and iOS third-party browsers), installation instructions open ONLY after the visitor taps the button. They explain Safari → Share → Add to Home Screen → Add, keeping Open as Web App enabled when available. No instructions appear automatically.

Other devices use the browser's native prompt when it is available. If the browser does not provide one, the click opens general browser-menu instructions, never the iOS guide. A declined prompt does not permanently remove the control.

## Verify after deployment
1. Normal browser: load the landing page and confirm the floating button is visible.
2. iPhone/iPad: no automatic guide; tap the button and check the iOS steps. Close using Got it, X, outside the dialog or Escape where available.
3. Android/desktop Chrome or Edge: tap Install app and complete the native prompt when offered. If unavailable, check the general instructions.
4. Launch from an installed app icon: the button should be hidden in standalone mode.
5. Open /admin: the install button should be absent and the approved login unchanged.

## Validation actually completed
Production build, type checking, and all 7 admin-route checks passed. git diff --check passed. Existing manifest, icons, service worker and payments are unchanged.

Graphical verification could not run: the browser rejected the local preview with ERR_BLOCKED_BY_CLIENT. Real iOS/Android installation and deployed appearance remain unverified. This patch has not been pushed or deployed by the assistant.

Official installation guidance:
https://support.apple.com/en-eg/guide/iphone/iphea86e5236/ios
https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent/prompt
