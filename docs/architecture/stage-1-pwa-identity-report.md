# Stage 1 Report — PWA Identity

**Date:** 2026-08-13  
**Verdict:** **STAGE 1 — PASS** (code + automated contracts + build). Full device install QA requires human Chromium/Android/iOS runs listed below.

---

## 1. What was found (audit)

| Issue | Severity |
|-------|----------|
| `sw.js?v=20260801d` ≠ `ICON_V` / manifest / `index.html` (`20260802c`) | P0 drift |
| No single BUILD_ID SSOT | P0 |
| Manifest missing `id`, `display_override`, shortcuts | P1 |
| No `beforeinstallprompt` / iOS A2HS UX | P1 |
| SW intercepted same-origin `/socket.io` (network-only, but not bypassed) | P1 |
| Update path not video-aware (risk of reload during Jitsi) | P0 for lesson UX |
| Screenshots assets absent | Info — not invented |

---

## 2. What was fixed

- Unified **BUILD_ID** via `computeLhPwaBuildId` + Vite `define` + stamp into `dist/sw.js`, `manifest`, `index.html`, `lh-pwa-build-id.json`
- Manifest: `id`, `display_override`, role-safe shortcuts (Chats / Profile / Settings), versioned icons
- SW: bypass `/api`, `/socket.io`, `/uploads`; cross-origin bypass (Jitsi); no HTML precache; `/assets` network-only; `GET_VERSION` message
- Install UX: Chromium BIP banner + iOS A2HS dialog (Design System)
- Update UX: SW waiting → update screen; **deferred while `VideoSession.active`**
- Chunk auto-reload respects video gate (`claimChunkAutoReloadUnlessVideo`)
- Kept existing chunk recovery / no infinite reload loop (30s claim)

---

## 3. Files changed (primary)

- `vite.config.js`, `scripts/pwa-build-id.mjs`
- `public/sw.js`, `public/manifest.webmanifest`, `index.html`
- `src/lib/pwa/*`, `src/lib/frontendUpdate.js`, `src/lib/lazyRetry.js`
- `src/lib/VideoSessionContext.jsx`
- `src/main.jsx`, `src/App.jsx`
- `src/components/pwa/*`, `src/components/common/FrontendUpdateScreen.jsx`
- `src/lib/pwa/pwa-identity.contract.test.js`, `package.json`, docs

---

## 4. Tests

Passed:

- `src/lib/pwa/pwa-identity.contract.test.js` (incl. dist stamp consistency)
- `src/lib/lazyRetry.contract.test.js`
- `src/lib/lesson-video.contract.test.js`
- `src/lib/document-picture-in-picture.contract.test.js`
- `npm run build` (API + client)
- `npm run test:unit` (full frontend list including new PWA test)

---

## 5. Manual QA (environment limits)

Automated environment has **no** Android/iOS/Chromium GUI for install prompts.

**Required human checklist (still open as process, not code P0):**

| Scenario | Status here |
|----------|-------------|
| Desktop Chromium install / standalone | Needs device |
| Android Chrome install / splash / theme | Needs device |
| iOS A2HS / safe-area | Needs device |
| Live lesson + SW update deferred | Logic covered by gate tests; live Jitsi needs device |
| Document PiP during CRM nav | Unchanged architecture; prior PiP contracts green |

---

## 6. Remaining (next stages — not Stage 1)

- Offline / IndexedDB
- Web Push
- Background Sync
- Aggressive asset caching
- Auth hardening
- Mass RQ migration
- Screenshots in manifest (need real image assets)

---

## 7. Open defects after Stage 1

| ID | Severity | Note |
|----|----------|------|
| — | — | No known P0/P1 code defects blocking Stage 1 |
| M1 | Process | Human install matrix on real devices still recommended before calling product “shipped” |

---

## 8. Verdict

**STAGE 1 — PASS**

Identity, versioning SSOT, install UX, SW lifecycle constraints, and video-safe update deferral are in place. Offline/Push intentionally not implemented.
