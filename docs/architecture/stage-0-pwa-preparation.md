# Stage 0 — Architecture Preparation for Production PWA

**Status:** Complete (documentation only — no PWA/Push/Offline code)  
**Date:** 2026-08-13  
**Depends on:** [ADR-001](./adr-001-primary-client-pwa.md) · [Design System 2.0](./design-system-2.0.md) · [Event Bus](./event-bus.md) · [Stage −1 report](./stage-minus-1-report.md)

---

## Executive verdict

The Vite React SPA can become a production PWA **without rewriting business domains**, provided Stage 1+ follows the boundaries in this document.

**Blockers before Stage 1 (PWA identity):** none critical — installability seed already exists.

**Blockers before Offline / Push:** Event Bus not implemented; React Query underused; JWT-in-`localStorage`; SW versioning drift; no IndexedDB/outbox.

**Do not rewrite** auth flows, roles, Jitsi, Telegram, payments, materials business logic for Stage 0–1 cosmetics.

---

# 1. Architecture map (current → target)

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser / Installed PWA (primary client — ADR-001)              │
│  React 18 + Vite + RR + Design System 2.0                        │
│  AuthContext · PresenceContext · VideoSessionContext · Theme     │
│  Lazy routes (lazyRetry) · Layout · RoleRouteGuard               │
├───────────────┬─────────────────┬───────────────────────────────┤
│  HTTP /api    │  Socket.IO /chat│  Jitsi (external iframe/SDK)  │
│  JWT Bearer   │  JWT in auth{}  │  Short-lived video tokens     │
├───────────────┴─────────────────┴───────────────────────────────┤
│  NestJS API + TypeORM + PostgreSQL (SSOT)                        │
│  Partial EventEmitter2 · Channel-coupled notifiers · Telegram    │
│  notifications table (telegram|email|in_app) — no web_push yet   │
└─────────────────────────────────────────────────────────────────┘

Target additions (NOT built in Stage 0):
  SW lifecycle v2 · App Shell · IndexedDB caches · Outbox ·
  platform-events module · Web Push · Deep-link router
```

### Layers (keep)

| Layer | Today | PWA target |
|-------|-------|------------|
| UI | `src/pages` + `components` + `@/design-system` | Same; compose DS |
| Client state | Contexts + local `useState` (most pages) | Same + RQ/IDB for offline domains |
| API client | `src/api/*` | Same contracts |
| Realtime | `chat-socket.js` singleton | Same; SW must bypass |
| Video | `VideoSessionContext` + Jitsi | Same; never SW-cache |
| Domain SSOT | PostgreSQL entities | Unchanged |

---

# 2. Module readiness matrix

| Module | Status | Notes |
|--------|--------|-------|
| **React / Vite SPA** | READY | Solid base; chunk splitting careful (`vendor-react`) |
| **React Router** | READY | Role routes + deep paths exist; need formal push deep-link map |
| **RoleRouteGuard / ACL UI** | READY | Keep; push must respect same guards after open |
| **Lazy loading** | READY | `lazyRetry` + chunk recovery (`frontendUpdate.js`) |
| **Design System 2.0** | READY | Stage −1 scaffold; migrate waves ongoing |
| **Manifest / icons / standalone meta** | PARTIAL | Exists; missing shortcuts, screenshots, unified version stamp |
| **Service Worker** | PARTIAL | Installability-only; icons precache; HTML network-first (correct); version query ≠ CACHE id |
| **App Shell strategy** | NOT READY | No versioned shell snapshot protocol yet |
| **React Query** | PARTIAL | `QueryClient` present (`refetchOnWindowFocus: false`) but **almost unused**; most screens manual fetch |
| **Authentication / JWT** | PARTIAL | Works in standalone; `localStorage`; **no refresh-token rotation** on web (7d JWT); query `access_token` for media |
| **Socket.IO chats** | PARTIAL | Reconnect + heartbeat OK; no offline outbox; SW must never intercept |
| **Jitsi / video / Document PiP** | PARTIAL | Online-only by nature; PiP/session careful; **READY to leave alone** for PWA stages |
| **Material uploads / media** | PARTIAL | Large files; auth URLs; need cache-on-demand policy + quota — not implemented |
| **Telegram** | PARTIAL | Delivery channel today; must become **handler** of Event Bus, not parallel business logic |
| **In-app notifications table** | PARTIAL | Channels without `web_push`; no unified emit |
| **Event Bus** | NOT READY | Designed in Stage −1; not coded |
| **Web Push** | NOT READY | No VAPID / subscriptions |
| **Offline read** | NOT READY | No IndexedDB domain store |
| **Background Sync / outbox** | NOT READY | No queue |
| **Install UX** | NOT READY | No `beforeinstallprompt` flow |
| **Mobile / Desktop UX shells** | NOT READY | Adaptive Layout only; separate IA later |
| **Expo `apps/mobile`** | N/A (frozen) | ADR-001 — not a second product |

**Legend:** READY = safe to build atop · PARTIAL = usable but needs contracts before feature stages · NOT READY = must design/implement before that feature stage.

---

# 3. Prepared architectures (contracts for Stage 1+)

## 3.1 App Shell

**Definition:** minimal HTML + critical CSS/JS needed to boot router + auth gate + empty layout chrome.

**Rules:**

1. Never precache bare `index.html` without a **build id** binding (current SW already avoids stale HTML → hashed chunk breakage — **keep this principle**).
2. Stage 1+: introduce `shell-manifest.json` generated at build with `{ buildId, assets[] }`.
3. Navigation: network-first HTML; on failure serve last-known shell **only if** asset hashes match shell-manifest.
4. Auth pages (`/login`, reset) are part of shell-capable routes.

## 3.2 Service Worker lifecycle

| Event | Policy |
|-------|--------|
| `install` | Precache icons + shell-manifest assets; `skipWaiting` only after successful precache |
| `activate` | Delete old CACHE_* except N-1 for rollback window (optional); `clients.claim` |
| `fetch` | Strategy by class (see §5) — **no global cache-first** |
| `message` | `SKIP_WAITING`, `GET_VERSION`, `CLEAR_API_CACHE` (future) |
| Update UX | Integrate with existing `frontendUpdate.js` / `FrontendUpdateScreen` — single update story |

**Version stamp (mandatory before Stage 2):** one `BUILD_ID` shared by:

- hashed assets
- `sw.js` registration query
- `CACHE` name
- `manifest.webmanifest?v=`
- `ICON_V`

Today: `sw.js?v=20260801d` vs `ICON_V=20260802c` — **drift risk; fix in Stage 1**.

## 3.3 Offline boundaries (v1 product scope)

| Offline OK (read) | Online-only (always) |
|-------------------|----------------------|
| Schedule (last successful fetch) | Jitsi / live video / screen share |
| Profile self | Payments initiation / AlfaBank |
| Homework list + last opened assignment metadata | Material **upload** |
| Materials metadata + explicitly pinned files | Socket realtime (degrade to outbox) |
| Recent chats (last N threads + messages) | Admin bulk ops |
| Certificates list metadata | Telegram linking flows |

Write while offline → **outbox only** (messages + allowlisted mutations). No silent fake success on server-authoritative money/attendance.

## 3.4 Cache strategy (by class)

| Class | Strategy | Owner |
|-------|----------|-------|
| **App Shell** | Stale-while-revalidate / versioned precache | SW |
| **Hashed `/assets/*`** | Cache-first immutable (after network success once) | SW (Stage 2+) |
| **HTML navigate** | Network-first; offline fallback shell if compatible | SW |
| **API `/api/*`** | **Network-only in SW**; app may mirror to IndexedDB | App, never SW cache |
| **Media / materials files** | Cache-on-demand + quota LRU; auth-aware | App (± Cache API named `lh-media`) |
| **Uploads POST** | Never cache; outbox retry | App |
| **Jitsi / meet hosts** | **Bypass SW entirely** | SW allowlist exclude |
| **Socket.IO** | Bypass SW | SW |
| **Third-party fonts/CDN** | Optional SWR; failure must not block app | SW |
| **Manifest / icons** | Cache-first with version bump | SW (today) |

## 3.5 Storage strategy

| Store | Data | Notes |
|-------|------|-------|
| `localStorage` | JWT (today) | Document XSS risk; hardening = later ADR, not Stage 1 blocker |
| `sessionStorage` | Frontend update nav recovery | Keep |
| Cache API | Shell, icons, optional media | Versioned names |
| IndexedDB `lh-offline` | Schedule, chats slice, profile, homework list, materials meta | **No business SSOT** — cache of server truth |
| IndexedDB `lh-outbox` | Pending mutations | Idempotency keys |
| PostgreSQL | SSOT | Unchanged |

**Forbidden:** storing authoritative balances, payments, attendance only in IDB.

## 3.6 IndexedDB boundaries

```
lh-offline
  profiles/{userId}
  schedule/{userId}/days/{yyyy-mm-dd}
  chats/{chatId}/messages (cap N)
  homework/assignments (list)
  materials/folders+meta (not full binaries by default)

lh-outbox
  items: { id, type, payload, createdAt, tries, lastError }
```

TTL + max rows enforced. Encrypt-at-rest: not required for v1 if device lock assumed; revisit for E2EE chat plaintext cache (prefer not caching E2EE bodies offline until crypto policy defined).

## 3.7 Push subscription flow (design)

```
User grants permission
  → PushManager.subscribe(VAPID)
  → POST /api/push/subscriptions { endpoint, keys, userAgent, deviceLabel }
  → store relational row (user_id, endpoint unique)
On logout / revoke → DELETE subscription
On push event → notificationclick → clients.openWindow(deepLink) or focus
```

Preferences (mute chat, quiet hours) live in delivery policy — not in domain services.

## 3.8 Deep link + notification routing

SSOT table (freeze in Push stage):

| Event | Path pattern |
|-------|----------------|
| `message.received` | `/Chats?chatId=` |
| `lesson.rescheduled` / `cancelled` | `/StudentLessons` or teacher schedule |
| `lesson.started` | `/LessonVideo/:id` |
| `homework.*` | `/HomeworkViewer` / teacher results |
| `material.published` | `/MaterialsHub` or student materials |
| `certificate.issued` | `/CertificateView/:id` |
| `payment.recorded` | `/Payments` |
| `exam.*` | `/StudentExams` / teacher review |

After open: existing `RoleRouteGuard` decides access; unauthorized → role home.

## 3.9 Versioning protocol

1. Build produces `BUILD_ID` (Vite hash / CI sha).
2. SW registration URL includes `BUILD_ID`.
3. Client compares `navigator.serviceWorker.controller` script URL vs expected.
4. On chunk load error → existing `claimChunkAutoReload` **once** → manual overlay if still failing (**keep** — prevents infinite reload).
5. SW update found → show update screen → reload once with nav snapshot.

## 3.10 Background queue architecture

```
UI action (send message / allowlisted patch)
  → if online: API then done
  → if offline: enqueue lh-outbox + optimistic UI flag "pending"
online / sync event / visibility
  → drain outbox FIFO per type
  → idempotent server endpoints (key header or body)
  → on success: remove + reconcile
  → on 4xx conflict: mark failed + user resolve
```

iOS limitation: Background Sync unreliable → **drain on foreground** is mandatory fallback.

## 3.11 Conflict resolution

| Domain | Policy |
|--------|--------|
| Chat messages | Server id wins; client temp id replaced; duplicates dropped by idempotency key |
| Profile fields | Last-write-wins with `updatedAt` check; 409 → refetch |
| Schedule edits | Online-only in v1 (no offline mutate) |
| Homework submit | Idempotent submit by assignment+attempt |
| Materials rename/move | Online-only v1 |

## 3.12 Reconnect strategy

| Channel | Today | Keep / extend |
|---------|-------|----------------|
| Socket.IO | `reconnection: true`, delay 1–8s, heartbeat 30s | Keep; on reconnect resync presence + unread |
| HTTP | retry 1 (RQ default) | Prefer explicit retry on mutations |
| Jitsi | dispose/rejoin on hard failure; video token refresh exists | Keep; no SW involvement |
| App resume | — | On `visibilitychange`/`online`: drain outbox + light refetch allowlist |

---

# 4. Full event map (SSOT catalog)

Emit **once** after commit → handlers: Telegram · Web Push · In-App · Activity · Analytics · Email(opt).

| Event name | Domain | Emit today? | Notes |
|------------|--------|-------------|-------|
| `lesson.created` | Lessons | Partial / none unified | |
| `lesson.started` | Lessons / video | No | For “join” reminders |
| `lesson.cancelled` | Lessons | Partial | |
| `lesson.rescheduled` | Lessons | **Yes** (`LESSON_RESCHEDULED`) | Migrate to bus |
| `lesson.updated` | Lessons | **Yes** (`LESSON_UPDATED`) | Narrow meaning |
| `lesson.teacher_changed` | Lessons | No | |
| `lesson.completed` | Lessons | No | |
| `homework.assigned` | Homework | Via notifier service | Extract emit |
| `homework.submitted` | Homework | Via notifier | |
| `homework.reviewed` | Homework | Via notifier | |
| `material.published` | Materials | No | |
| `material.access_granted` | Materials | No | |
| `certificate.issued` | Certificates | Via notifier | |
| `payment.recorded` | Payments | No unified | Careful PCI — metadata only |
| `message.received` | Chats | Socket only | Add push when offline recipient |
| `exam.assigned` | Assessment | Via notifier | |
| `exam.completed` | Assessment | Events partial | |
| `exam.reviewed` | Assessment | **Yes** review events | |
| `user.approved` | Auth/onboarding | No | |
| `system.notice` | Ops | Digests/jobs | Jobs ≠ domain events |

**Rule:** cron digests (teacher tomorrow) stay **jobs**; they may emit `system.notice` if push needed, but must not reimplement lesson queries inside Telegram-only code forever.

Detailed envelope: [event-bus.md](./event-bus.md).

---

# 5. Caching strategy summary

See §3.4. **Explicit prohibition:** one strategy for all GETs.

---

# 6. Update strategy (user-facing)

| Trigger | Behavior |
|---------|----------|
| New deploy | New hashed assets; old tabs may hit chunk errors |
| Chunk error | Auto-reload **at most once** (`claimChunkAutoReload`); else manual `FrontendUpdateScreen` |
| SW update | Activate → prompt or coordinated reload with nav restore |
| User idle in lesson | Prefer **defer** reload until leave call (Stage 2+ policy) |
| Infinite reload | Forbidden — already gated; keep gates when extending SW |

---

# 7. Mobile architecture map (no redesign yet)

| Class | Pages / surfaces | Rationale |
|-------|------------------|-----------|
| **Mobile-first** | StudentDashboard, StudentLessons, StudentLessonMaterials, Chats, HomeworkViewer, StudentExams / HSK take, LessonVideo (participant), Profile (student), Login | Phone-primary learners |
| **Desktop-first** | Dashboard (admin), UserManagement, Analytics, Salary, Assessment bank/editors, ExamContent*, MaterialsHub (admin ACL), Schedule (school admin), AdminPanel, ShopSettings, LessonSeriesAdmin | Dense tables / multi-pane |
| **Adaptive (shared)** | TeacherDashboard, TeacherSchedule, TeacherStudents, Materials (teacher), HomeworkList/Editor, Groups/GroupDetail, Certificates, Payments, Settings, TelegramSettings, Tutor* | Both; later role shells |

**Navigation targets (later UX stages):** student bottom nav; teacher today-first bottom nav; admin drawer — see `src/design-system/navigation/README.md`.

---

# 8. Performance findings (audit only)

| Risk | Evidence / note | Guidance for later |
|------|-----------------|-------------------|
| Manual fetch duplication | Most pages `useState`+`api.*`, not RQ | Introduce RQ keys per domain before offline |
| RQ underused | `QueryClient` mounted; almost no `useQuery` | Don't invent second cache |
| Materials tree refresh | Full list reloads | Soft updates (as folder rename) are the pattern |
| Socket singleton | Good — PresenceContext keeps connection | Avoid reconnect on every chat mount |
| Video memory | Jitsi dispose paths exist; PiP reparent critical | Don't cache Jitsi in SW |
| Context breadth | Auth + Presence + Video + Theme + E2EE | Avoid new global contexts for PWA; prefer modules |
| Fonts CDN | Google fonts in `index.html` | Optional self-host later for offline shell |
| Large assessment/exam bundles | Lazy routes help | Keep lazy boundaries |

---

# 9. Security audit (no code changes)

| Topic | Current | Risk | Stage guidance |
|-------|---------|------|----------------|
| JWT storage | `localStorage` | XSS → full session | Hardening ADR later; CSP + DS discipline; **don't block Stage 1** |
| Refresh tokens | Mobile scaffold only; web 7d access JWT | Long-lived bearer | Separate auth ADR; not required for installability |
| Media `?access_token=` | Needed for `<img>/<audio>` | Token in logs/Referer | Prefer cookie/httpOnly long-term; short-lived media tokens ideal |
| SW | Same-origin fetch | Malicious SW = MitM of own origin | Strict deploy integrity; no remote SW |
| Offline IDB | — | Sensitive chat/homework on disk | Cap data; lock screen assumption; no E2EE plaintext cache without policy |
| Push | — | Endpoint abuse / spam | Auth subscribe; server-side rate limits |
| CSRF | Bearer header API | Low for classic CSRF | Keep not relying on cookies alone today |
| XSS | React escaping | High impact with localStorage JWT | Never `dangerouslySetInnerHTML` unsanitized; audit rich text |
| Roles | Guards server+client | Client UI not security boundary | Server ACL remains SSOT |

---

# 10. Deliverables checklist (requested)

## 10.1 Architecture map
→ §1

## 10.2 Readiness matrix
→ §2

## 10.3 Plan Stage 1 (PWA identity — after your confirmation)

1. Unify `BUILD_ID` / SW / manifest / icon versions.  
2. Complete manifest (shortcuts, screenshots, `id`, theme).  
3. Installability QA Android + desktop Chromium + iOS A2HS.  
4. Document update + chunk recovery interaction.  
5. No Offline/Push yet.  
**Gate:** build · install checklist · report PASS.

## 10.4 Plan Stage 2 (Service Worker foundation)

1. SW strategy matrix implemented (shell + hashed assets; bypass API/socket/Jitsi).  
2. Message protocol + controlled `skipWaiting`.  
3. Contract tests: HTML never served as JS.  
4. Align with `frontendUpdate.js`.  
**Gate:** deploy update without infinite reload; Jitsi+chat smoke PASS.

*(Later stages remain: Offline → Push → Background Sync → Install UX → Mobile/Desktop UX → Performance → A11y → Regression — per original roadmap.)*

## 10.5 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| SW caches API by mistake | Critical | Hard bypass `/api` |
| Stale HTML + new chunks | Critical | Keep network-first HTML; version shell |
| Dual notify paths (Telegram + future Push) | High | Implement Event Bus before Push |
| JWT XSS | High | CSP + later auth hardening |
| iOS Push/BgSync limits | Medium | Document capability matrix |
| E2EE + offline cache | High | Don't cache decrypted bodies in v1 |
| RQ + manual state dual caches | Medium | Pick RQ as offline hydrate layer gradually |
| Expo drift | Medium | ADR-001 freeze |

## 10.6 Must change before PWA feature stages

| Before | Change |
|--------|--------|
| Stage 1 | Version stamp unification |
| Stage 2 | Formal SW class strategies |
| Offline | IndexedDB schemas + RQ (or explicit store) for allowlisted reads |
| Push | Event Bus + `web_push` channel + deep-link map |
| Sync | Outbox + idempotent APIs for allowlisted writes |

## 10.7 Categorically must NOT change (in PWA prep)

- Business rules (balance SSOT, recurrence locks, payments, grading)
- API contracts (except additive push/outbox endpoints when those stages start)
- Roles / RoleRouteGuard semantics
- Jitsi join/PiP session host model
- Telegram bot protocol (only become bus handler later)
- Material ACL semantics
- PostgreSQL as SSOT / no `json_record` for business entities

## 10.8 Already correct — keep

- HTML **not** precached blindly; API **not** SW-cached  
- Chunk auto-reload **single-claim** + manual fallback  
- Socket.IO singleton for presence  
- Lazy routes + vendor-react single chunk rule  
- Design System 2.0 as UI SSOT  
- ADR-001 Primary Client = PWA  
- Event Bus design (one event → many handlers)  
- Safe-area / touch tokens already in CSS  
- Video token refresh endpoint pattern  

---

# 11. Stage 0 completion criteria

| Criterion | Status |
|-----------|--------|
| Architecture audited | Done |
| Readiness matrix published | Done |
| SW/cache/offline/push/outbox contracts written | Done |
| Event catalog mapped | Done |
| Mobile/desktop page map | Done |
| Perf + security audit (no code change) | Done |
| Stage 1 & 2 plans | Done |
| **PWA code implemented** | **Not done (correct)** |

**Next step requires your explicit confirmation to start Stage 1 (PWA identity only).**
