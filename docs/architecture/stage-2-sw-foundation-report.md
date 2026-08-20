# STAGE 2 REPORT

**Date:** 2026-08-13  
**Scope:** Service Worker foundation / cache architecture / update safety  
**Out of scope (not started):** Stage 3 Offline, Web Push, Background Sync, auth model changes, API/ACL/Jitsi/Telegram/business logic

---

## 1. Audit

Pre-fix audit: `docs/architecture/stage-2-audit-pre-fix.md`.

| FOUND | RISK | Status after fix |
|--------|------|------------------|
| Unconditional `skipWaiting()` on every install | Mid-lesson claim / reload pressure | Fixed: skipWaiting only on first install (`!registration.active`); updates wait for `SKIP_WAITING` |
| Hashed `/assets` network-only | No BUILD_ID-scoped asset cache | Fixed: CLASS B cache-first + HTML-as-JS guard |
| HTML never cached → dead offline nav fallback | Navigation always 503 offline | Fixed: CLASS A network-first + put on success |
| Possible large/auth media interception | Cache/proxy of materials / tokens | Fixed: uploads, media extensions, `access_token`/`token` query bypass |
| SW update auto-reload (~800ms) | Reload during lesson / surprise UX | Fixed: confirm UI «Обновить сейчас» / «Позже»; video → deferred banner |
| Inline fetch rules | Hard to reason / drift | Fixed: named classifiers + `swResourceRules.js` mirror |
| BUILD_ID SSOT (Stage 1) | Dual CACHE_VERSION risk | Verified intact — single `BUILD_ID` → `longhua-academy-pwa-${BUILD_ID}` |

---

## 2. Fixed

| Area | Change |
|------|--------|
| `public/sw.js` | Class A–G strategies; bypass matrix; conditional skipWaiting; activate cleanup of `longhua-academy-*` except current; `SKIP_WAITING` / `GET_VERSION` |
| `src/lib/pwa/swResourceRules.js` | Testable classifiers (same rules as SW markers) |
| `src/lib/pwa/serviceWorkerClient.js` | Waiting → UI `available` only (no auto-reload); `activateWaitingServiceWorkerAndReload` |
| `src/components/pwa/PwaUpdateController.jsx` | Unified update UX; deferred during VideoSession; after lesson → `available` |
| `FrontendUpdateScreen` | Phase `available` copy for SW updates |
| Tests | `sw-stage2.contract.test.js`; `test:unit` includes Stage 2 |

Not changed: JWT, API, ACL, Jitsi config, Document PiP architecture, lesson/payments/materials business logic.

---

## 3. Cache matrix

| Resource | Strategy | SW intercepted? | Reason |
|----------|----------|-----------------|--------|
| Navigation / `index.html` | Network-first (+ cache put for offline fallback) | Yes (same-origin) | CLASS A — never cache-first HTML |
| Manifest / icons | Network then cache fill | Yes | App identity; BUILD_ID query on precache |
| `/assets/*` hashed | Cache-first (BUILD_ID cache) | Yes | CLASS B — immutable Vite hashes |
| `/api/*` | Network-only | No (bypass) | CLASS C |
| `/socket.io/*` | Full bypass | No | CLASS D |
| Cross-origin (Jitsi CDN, meet, WebRTC deps) | Full bypass | No | CLASS E |
| `/uploads/*`, `/files/upload`, material media paths | Full bypass | No | CLASS F |
| URLs with `access_token` / `token` query | Full bypass | No | CLASS G / security |
| Non-GET | Ignored | No | SW only handles GET |
| Default same-origin GET | Network-only, no cache | Yes (pass-through) | Safe default |

---

## 4. Video safety

How SW does **not** interfere with Jitsi / VideoSession / Document PiP:

1. **Cross-origin bypass** — any `url.origin !== self.location.origin` is not handled; Jitsi iframe, CDN, ICE/WebRTC signaling hosts are never cached or rewritten.
2. **No WebSocket interception** — Socket.IO path bypass; SW does not clone/transform socket traffic.
3. **Update deferral** — `reloadGate` + `VideoSessionContext` set `shouldDeferAppReload()`; `PwaUpdateController` shows deferred banner; `activateWaitingServiceWorkerAndReload` refuses while gated.
4. **No unconditional skipWaiting on update** — waiting SW stays waiting until user confirms after lesson (or non-video session).
5. **Document PiP** — not remounted by SW; SW does not reload the page without client consent. PiP architecture itself was not modified.

**Не проверено в этой среде:** живой Jitsi-урок + Document PiP + deploy mid-call на реальном устройстве (нет медиастенда / браузерной сессии с конференцией). Контракты и код-путь проверены; runtime QA — на устройстве.

---

## 5. Update safety

Lifecycle:

```
INSTALL (precache icons/manifest)
  → first install (!active): skipWaiting
  → update (active exists): stay WAITING
WAITING
  → client notify → UI «Доступна новая версия»
  → if VideoSession: deferred banner
  → «Обновить сейчас» → SKIP_WAITING → clients.claim (activate) → controlled hard reload
  → «Позже»: dismiss UI; worker remains waiting
ACTIVATE
  → delete old longhua-academy-* caches ≠ current BUILD_ID
  → clients.claim()
```

Chunk recovery (Stage 1, preserved): lazyRetry → one controlled recovery → 30s claim/reload protection. Not rewritten in Stage 2.

---

## 6. Security

Checked in SW source + contract tests:

- API responses not cached (bypass before respondWith)
- Uploads / material media not cached
- `access_token` and `token` query URLs bypassed
- Cross-origin authenticated resources not intercepted
- Authorization headers: SW does not store Request headers into a separate auth cache (no API cache exists)
- JWT not moved into SW storage

Auth model (JWT location / cookies) intentionally unchanged.

---

## 7. Tests

| Suite | Result |
|-------|--------|
| `npm run test:unit` (218 tests) | PASS |
| `src/lib/pwa/sw-stage2.contract.test.js` | PASS |
| `src/lib/pwa/pwa-identity.contract.test.js` (incl. dist stamp) | PASS |
| Matrix coverage A–R (install, activate, BUILD_ID, cache naming, API/socket/Jitsi/uploads/media bypass, HTML network-first, assets, cleanup, chunk recovery markers, HTML-as-JS, update deferral wiring, no auto-reload SW path) | Covered by Stage 1+2 contracts |

---

## 8. Build

```
npm run build → PASS
```

Client stamp example: `BUILD_ID = 2d460cf93328-20444b` in `dist/sw.js`, manifest, index, `dist/lh-pwa-build-id.json`.

---

## 9. Runtime verification

Verified in **dist** after build:

- Single stamped `BUILD_ID` / `CACHE = longhua-academy-pwa-${BUILD_ID}`
- Classifiers: `isApiRequest`, `isSocketRequest`, `isUploadRequest`, `access_token`
- Markers: NETWORK FIRST, CACHE FIRST
- Conditional skipWaiting via `!self.registration.active`
- `SKIP_WAITING` message handler
- Bypass paths present in `dist/sw.js`

**Не проверено:** browser DevTools Application → Cache Storage / live update mid-lesson / PiP (no interactive browser session in this environment).

---

## 10. Remaining

1. Manual device QA: install → deploy → Update now / Later; VideoSession + PiP during waiting SW.
2. Stage 3 Offline product (explicitly not started).
3. Optional: keep previous hashed assets on disk for overlapping tabs is already partially handled by client build preserve-assets script; SW cleanup only removes **old cache namespaces**, not disk files.

No open P0/P1 in Stage 2 code path from audit items 1–6.

---

## FINAL VERDICT

**STAGE 2 — PASS**

(with honest caveat: live Jitsi / Document PiP mid-update QA = **не проверено** in this environment; code contracts and dist static audit pass.)
