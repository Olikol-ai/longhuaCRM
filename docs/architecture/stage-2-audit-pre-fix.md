# Stage 2 — Pre-fix Audit (FOUND / RISK / FIX / TEST)

**Date:** 2026-08-13  
**Code changes in this file:** none (audit only)

| # | FOUND | RISK | FIX | TEST |
|---|--------|------|-----|------|
| 1 | `install` always calls `skipWaiting()` | New SW activates + `clients.claim` mid-lesson | Skip waiting until client `SKIP_WAITING`; first-install exception when no window clients | Lifecycle contract + video defer |
| 2 | Hashed `/assets/*` are network-only | Misses Stage 2 cache-first perf; OK for integrity | Cache-first for hashed assets in BUILD_ID cache; HTML-as-JS guard | Asset strategy contract |
| 3 | HTML never written to cache; offline fallback dead | Offline nav → 503 only | Network-first; put successful navigations into shell cache for offline fallback only | HTML network-first contract |
| 4 | Catch-all may touch same-origin media if not under `/api`/`/uploads` | Accidental cache of large/auth files | Bypass `access_token` query, media extensions, `/files` | Security bypass tests |
| 5 | SW update path auto-reloads after 800ms (`updating`) | Surprises user; conflicts with “Update / Later” UX | Manual confirm for SW updates; Later dismisses; video → deferred | Update UX contract |
| 6 | Classifiers are inline/monolithic | Hard to reason | Named `isApi` / `isSocket` / `isUpload` / `isAuthQuery` / `isVersionedAsset` / `isNavigation` | Rules unit tests |
| 7 | BUILD_ID SSOT (Stage 1) | Low if left alone | Keep; verify dist | Existing stamp tests |
| 8 | Cross-origin bypass present | Low for Jitsi | Keep; never intercept other origins | Jitsi bypass contract |
| 9 | HTML-as-JS 404 guard exists for assets | Medium if weakened | Keep on cache-first path | MIME guard test |
| 10 | Chunk recovery + 30s claim exist | Low | Keep; video gate already | lazyRetry contracts |

**Proceed to implementation after this audit.**
