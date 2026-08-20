# STAGE 4 REPORT — Final verification / hardening

**Date:** 2026-07-29  
**Scope:** Web Push + unified notification delivery — production hardening  
**Depends on:** Stage 0–3 · `stage-4-push-audit.md` · prior Stage 4 implementation

---

## Verdict (honest)

**STAGE 4 — CODE VERIFIED, DEVICE QA REQUIRED**

Not **STAGE 4 — VERIFIED**: no live browser/device Push receive+click was executed in this environment.  
VAPID keys are **not** set in current `.env` → Web Push delivery is intentionally disabled at runtime (pipeline continues for in_app / Telegram).

---

## Hardening fixes applied this pass

| Fix | Why |
|-----|-----|
| Logout revokes **current endpoint only** (`revokeCurrentDevicePushSubscription` + `DELETE .../by-endpoint`) | P0: previous logout deleted **all** user device subscriptions |
| SW `notificationclick` uses soft `NOTIFICATION_NAVIGATE` (no `Client.navigate` hard reload) | Protect Jitsi / Document PiP via `shouldDeferAppReload()` |
| `bindNotificationNavigate` no-ops navigation while video gate is active | Focus only; session stays mounted |
| Structured logs (`notification_event_created`, `channel_*`, `push_*`) without secrets | Observability |
| Safe payload + `assertNoSecretsInPushPayload` | Secret hygiene |
| Channel failure isolation in fan-out | One channel/recipient cannot abort others |
| `.env.example` VAPID placeholders | Ops clarity |
| Notification Center safe-area + design tokens | Mobile UX |
| Expanded contract/hardening tests | Regression matrix |

---

## AREA \| STATUS \| EVIDENCE \| REMAINING RISK

| AREA | STATUS | EVIDENCE | REMAINING RISK |
|------|--------|----------|----------------|
| 1 Migration / DB | **CODE + DB VERIFIED** | Migration file `1746300000000` present; applied as `WebPushAndNotificationEvents1746300000000`; tables `push_subscriptions`, `notification_preferences`; indexes `UQ_PUSH_SUBSCRIPTION_ENDPOINT`, `UQ_NOTIFICATION_EVENT_USER_CHANNEL`; FK `ON DELETE CASCADE` | Ops must run migration on every environment |
| 2 VAPID | **CODE VERIFIED** | Keys only via `configuration.ts` env; public key API only; private never in controller responses; dist grep **NONE**; VAPID unset → push skipped, no pipeline crash | **LIVE:** keys not configured in this `.env` — Push cannot send until ops sets VAPID |
| 3 Subscription lifecycle | **CODE VERIFIED** | Upsert merge + UNIQUE endpoint; multi-device list; device-scoped logout; 404/410 revoke helpers; temp failure retry without revoke | Device multi-login/logout not exercised live |
| 4 Notification fan-out | **CODE VERIFIED** | `fanoutToRecipient` + `createIdempotent` + UNIQUE; prefs filter; chat viewing suppress; channel try/catch | Not all legacy notifiers migrated (assessment etc.) |
| 5 Deep links | **CODE VERIFIED** | Role-aware `notification-deep-links.ts`; RoleRouteGuard contract; deep link is route hint only | Live ACL click paths not device-tested |
| 6 Service Worker | **CODE VERIFIED** | Push display-only; no caches.open/skipWaiting in push path; Stage 2 bypass markers in `dist/sw.js` | Standalone PWA click not device-tested |
| 7 PWA / offline | **CODE VERIFIED** | Push does not write SSOT to IDB; offline Stage 3 remains separate | Offline+push delivery not live-tested |
| 8 Jitsi / PiP | **CODE VERIFIED** | Soft nav + `shouldDeferAppReload` / VideoSession gate | **LIVE mid-lesson push NOT VERIFIED** |
| 9 Notification Center | **CODE VERIFIED** | Bell, groups, mark read/all, tokens, min-h-11, safe-area | Keyboard a11y / visual QA partial |
| 10 Permission UX | **CODE VERIFIED** | Settings progressive enable; no `requestPermission` on login; sync only if already granted | Browser UX variants not live-tested |
| 11 Telegram regression | **CODE VERIFIED** | Tomorrow digest service has no `fanoutToRecipient` / `web_push` | Full digest send not re-run live |
| 12 Event taxonomy | **CODE VERIFIED** | Catalog covers chat/lesson/homework/cert/payment/material/system | Emitters missing for some reserved types |
| 13 Observability | **CODE VERIFIED** | Structured logs; no private key logging | Log volume in prod TBD |
| 14 Test matrix | **TEST VERIFIED** | `stage4-push.contract.test.js` + `stage4-push.hardening.test.js`; `npm run test:unit` **272 pass** | Integration/e2e Push absent |
| 15 Build / static security | **TEST VERIFIED** | `npm run build` PASS; dist secret scan NONE; SW bypass markers present | — |
| 16 Live smoke | **NOT VERIFIED** | No VAPID; no browser Push receive in this session | Required before production claim |

---

## P0 / P1 / P2 / P3

### P0
- *(resolved)* Logout revoked all devices → fixed to current endpoint only.

### P1
- **VAPID not configured in this deployment** → Web Push cannot deliver until `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` are set and API restarted. In-app + Telegram unaffected. Blocks **LIVE DEVICE VERIFIED**.

### P2
- Some taxonomy events (payment/material/assessment) lack emitters → reserved, not dead security holes.
- Notification Center keyboard navigation / screen-reader polish incomplete.

### P3
- Certificate push copy remains generic (intentional).
- Digest timezone remains school `REMINDER_TIMEZONE` (frozen policy).

---

## Verification labels

| Label | Meaning | This run |
|-------|---------|----------|
| CODE VERIFIED | Source + architecture contracts inspected / fixed | Yes |
| TEST VERIFIED | Automated unit/contract + build + dist grep | Yes (272 unit) |
| LIVE DEVICE VERIFIED | Real browser/OS Push received + clicked | **No** |
| DB VERIFIED | Migration present in live PostgreSQL | Yes |

---

## How to complete DEVICE QA (ops)

1. Generate keys: `npx web-push generate-vapid-keys`
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in `.env`
3. Restart API; confirm `GET /api/notifications/vapid-public-key` → `configured: true`
4. Settings → «Включить уведомления» on HTTPS client
5. Trigger chat/homework event from another account → OS notification → click → deep link + ACL
6. Repeat during active Jitsi / Document PiP (expect display only; no session destroy)
7. Two devices: logout one → other still receives push

---

## FINAL GATE

**STAGE 4 — CODE VERIFIED, DEVICE QA REQUIRED**

Not elevated to **STAGE 4 — VERIFIED** without live Push + VAPID.
