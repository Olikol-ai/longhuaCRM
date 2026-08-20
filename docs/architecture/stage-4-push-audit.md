# Stage 4 — Web Push / Notification System Audit (pre-implementation)

**Date:** 2026-08-13  
**Code changes in this document:** none  
**Depends on:** [event-bus.md](./event-bus.md) · Stage 0–3 · ADR-001

---

## Verdict of audit

Longhua already has **channel-coupled notifiers** and an `notifications` table (`telegram` | `email` | `in_app`), but **no Web Push**, **no VAPID**, **no push_subscriptions**, **no unified Event Bus module**, and **no notification center UI**.

Stage 4 must introduce a **single event → policy → multi-channel delivery** path without deleting Telegram digests/jobs or breaking Stage 1–3 SW / offline / VideoSession.

---

## 1. Inventory — where notifications are created today

| Source | Mechanism | Channels today | Event-ish type strings |
|--------|-----------|----------------|------------------------|
| `HomeworkNotifierService` | Direct call after assign/submit/review | `in_app` + Telegram | `homework_assigned`, submit/review variants |
| `CertificateIssuedNotifier` | Direct after issue | `in_app` + Telegram | certificate congratulation |
| `LessonRescheduledNotifier` | `@OnEvent(LESSON_RESCHEDULED)` | `in_app` + Telegram | `lesson_rescheduled` |
| `LessonUpdatedNotifier` | `@OnEvent(LESSON_UPDATED)` | similar | lesson update |
| `AssessmentAssignmentNotifier` | Direct after assignment | `in_app` (+ Telegram?) | exam/assignment |
| `AssessmentReviewNotifier` | `@OnEvent(ASSESSMENT_RESULT_*)` | `in_app` (+ Telegram) | review/pending |
| `ChatMessagesService.notifyOfflineMembers` | After message persist; skips online presence + lesson-scoped chats | `in_app` only | `chat_message` |
| `DirectChatRequestService` | DM request | `in_app` + Telegram | DM request |
| `LessonConfirmationJobsService` | Cron 24h / 3h / 15m | **Telegram only** (flags `reminder24hSent` / `reminder15mSent`) | reminders |
| `TeacherTomorrowDigestJobsService` | Cron 19:00 school TZ | **Telegram only** + digest claim table | tomorrow digest |
| Payments / materials | **No notifier found** | — | — |
| Socket.IO chat | Realtime fan-out (`message.created`, `chat.unread`) | Not persisted as push | — |

**Frontend:**

| Surface | Finding |
|---------|---------|
| `api.notifications` | Generic domain client; list/filter/update |
| UI | **No** Notification Center / bell; Layout only has **chat unread** badge |
| Toasts | `use-toast` for local UX errors — not a delivery channel |
| Certificates | StudentCertificates may mark celebration notifs read |
| Permission / PushManager | **Absent** |
| `web-push` npm / VAPID env | **Absent** |
| SW (`public/sw.js`) | Stage 2 cache/lifecycle only — **no `push` / `notificationclick`** |

---

## 2. Persistence SSOT gaps

### `notifications` entity (today)

Fields: `id`, `userId`, `channel` ∈ {telegram,email,in_app}, `type`, `title`, `body`, `status`, `readAt`, `sentAt`, `referenceType`, `referenceId`, `createdAt`.

**Missing for Stage 4:**

- `eventId` (idempotency)
- UNIQUE `(event_id, user_id, channel)`
- `deepLink`
- `web_push` channel
- retry / attempt counters (or separate delivery attempts)
- preference-aware delivery metadata

### Push subscriptions

**None.** Must create `push_subscriptions` (multi-device, UNIQUE endpoint, revoke on 404/410).

### Preferences

Only Telegram reminder toggles on `users`: `telegram_notify_24h`, `telegram_notify_3h`.  
**No** CRM-wide Push / In-App / Telegram matrix per category.

---

## 3. Event Bus status

| Item | Status |
|------|--------|
| Design doc `event-bus.md` | Complete (Stage −1) |
| Nest `platform-events` module | **NOT implemented** |
| Outbox table | **NOT implemented** |
| Partial `EventEmitter2` | Lessons + assessment results only |
| Channel handlers | Coupled inside notifier classes |

**Implication:** Stage 4 must implement a minimal real bus (or DeliveryOrchestrator) that existing notifiers call, not invent a second parallel notify system.

---

## 4. Taxonomy — map current → target

| Target event | Exists today? | Notes |
|--------------|---------------|-------|
| `message.received` | Partial (`chat_message` in_app + socket) | Add push when not viewing chat; keep presence skip |
| `lesson.created` | Weak / none as notif | Optional V1 if create path emits |
| `lesson.updated` | Yes (`LESSON_UPDATED`) | Normalize name |
| `lesson.rescheduled` | Yes | Normalize + idempotency |
| `lesson.cancelled` | Partial via update | Explicit event preferred |
| `lesson.reminder` | Telegram cron only | Do **not** duplicate tomorrow digest as push spam; 15m/24h policy TBD |
| `lesson.tomorrow` | Teacher digest Telegram | Keep as **job**, not multi-push duplicate |
| `homework.*` | Yes via HomeworkNotifier | Map assigned/submitted/reviewed |
| `material.shared` / `updated` | **No** | Defer emit until product hook exists; taxonomy reserved |
| `payment.created` / `updated` | **No** | Taxonomy reserved; privacy-safe copy when wired |
| `certificate.issued` / `revoked` | issued yes; revoked? | issued exists |
| `exam.*` | Assessment notifiers | Alias to catalog |
| `system.announcement` | None | Reserved |

---

## 5. Proposed channel matrix (defaults)

| Event | Web Push | In-App | Telegram | User configurable |
|-------|----------|--------|----------|-------------------|
| `message.received` | Yes (if not in that chat) | Yes | Optional | Yes |
| `lesson.rescheduled` / `cancelled` / `updated` | Yes | Yes | Yes (existing) | Yes |
| `lesson.reminder` (15m/24h) | Optional V1 | Optional | **Yes (existing)** | Partial (existing TG prefs) |
| `lesson.tomorrow` digest | **No** (avoid spam) | No | **Yes job** | TG side |
| `homework.*` | Yes | Yes | Yes (existing) | Yes |
| `certificate.issued` | Yes | Yes | Yes | Yes |
| `exam.*` | Yes | Yes | Yes where today | Yes |
| `payment.*` | Yes (generic copy) | Yes | Optional | Yes |
| `material.*` | Yes when emitted | Yes | Optional | Yes |
| `system.announcement` | Yes | Yes | Optional | Limited (cannot fully mute critical system) |

**Dedup rule:** one `eventId` → at most one row per `(recipientId, channel)`.

---

## 6. Deep links (role-aware; ACL last line)

| Event | Student / tutor_student | Teacher / tutor | Admin |
|-------|-------------------------|-----------------|-------|
| `message.received` | `/Chats?chatId=` | same | same |
| `lesson.*` | `/StudentLessons` (+ lesson query) | `/TeacherSchedule` or `/TutorSchedule` | `/Schedule` |
| `homework.assigned` | `/HomeworkViewer?assignmentId=` | — | — |
| `homework.submitted` / review needed | — | `/HomeworkResults?...` | same |
| `certificate.issued` | `/StudentCertificates` or `/CertificateView/:id` | — | `/Certificates` |
| `exam.*` | `/StudentExams` | teacher review routes | admin assessment |
| `payment.*` | student top-up/return as applicable | `/Payments` | `/Payments` |
| `material.*` | `/StudentLessonMaterials` | `/MaterialsHub` | `/MaterialsHub` |

`ROUTE_ACCESS` + `RoleRouteGuard` remain mandatory. Push is **not** ACL.

Notable: `/Payments` is admin+teacher only in `ROUTE_ACCESS` — student payment deep links must use student-safe paths.

---

## 7. Timezone policy (reminders)

**Today:** `jobs.reminderTimezone` / `REMINDER_TIMEZONE` default **`Europe/Minsk`** (school default). Digests and reminder crons use this.

**Stage 4 policy (freeze):**

1. Prefer **user preference timezone** when column exists (future).
2. Else **account/school default** = `REMINDER_TIMEZONE` (Europe/Minsk).
3. Never use “teacher browser TZ” for recipients.

Do **not** add Web Push for tomorrow digest in V1 (Telegram job remains sole channel) to avoid triple spam.

---

## 8. Chat spam policy

Today: `notifyOfflineMembers` skips if `presence.isOnline(userId)` — **any** CRM presence, not “in this chat”.

**Stage 4 tighten:**

- Socket/presence already delivers live messages when online.
- Web Push: only if recipient **not** focused on that `chatId` (client heartbeat / server presence room) **or** offline.
- Never push lesson-scoped video chats (already skipped).
- E2EE: body preview stays generic («Новое зашифрованное сообщение») — no ciphertext in push.

---

## 9. Security / privacy

| Risk | Mitigation |
|------|------------|
| JWT / tokens in push | Forbidden in payload |
| Payment amounts / PII | Generic titles; details after open |
| Cross-user delivery after account switch | Rebind subscription `user_id` on login; revoke previous association |
| Admin `GET /notifications` returns all | Keep admin list; non-admin scoped to self (already) |
| Deep link ACL bypass | RoleRouteGuard + API auth |
| VAPID private key | Server env only |
| Offline IDB | May snapshot notification center; never store VAPID private |

---

## 10. Service Worker / PWA constraints

- Extend **existing** `public/sw.js` only.
- Do not break BUILD_ID, cache classes, update deferral, Jitsi/PiP bypass.
- Handlers: `push`, `notificationclick`, `notificationclose`.
- Click → `clients.openWindow(deepLink)` or focus existing client; **no** forced reload during VideoSession (prefer focus).

---

## 11. UX gaps

| Need | Today |
|------|-------|
| Progressive permission | Missing |
| Notification settings page | Missing (only Telegram reminder toggles in bot/menu) |
| Notification Center (Today/Yesterday/Earlier) | Missing |
| Unread badge (in-app notifs) | Missing (chat unread only) |
| Desktop: avoid toast+OS notif spam | Toasts are local; policy = OS push OR in-app center, not both for same event by default |
| Mobile safe-area / 44px | Must follow DS |

---

## 12. Risks (FOUND → FIX)

| # | FOUND | RISK | FIX |
|---|--------|------|-----|
| 1 | No eventId / unique delivery | Duplicate Push+TG+in_app storms | Add eventId + UNIQUE (event,user,channel) |
| 2 | Channel-coupled notifiers | Dual systems | DeliveryOrchestrator / platform-events; migrate emitters |
| 3 | No push_subscriptions | Cannot deliver Web Push | New table + API |
| 4 | No VAPID | Cannot subscribe | Env + public key endpoint |
| 5 | SW without push handlers | Browser cannot show OS notifs | Extend sw.js |
| 6 | Presence ≠ “in chat” | Spam while reading another page | Chat focus signal for push skip |
| 7 | Digest + reminder + push overlap | Triple notify | Matrix: digest TG-only |
| 8 | Account switch on shared device | Wrong user gets push | Reassign/revoke subscription on login/logout |
| 9 | Sensitive payment/chat content | Privacy leak | Safe templates |
| 10 | Live device QA | May be unavailable | Report NOT VERIFIED honestly |

---

## 13. Explicitly out of Stage 4

- Offline mutations / outbox product (Stage 5)
- Full React Query migration
- E2EE changes / auth migration / Jitsi changes
- Deleting Telegram
- Rewriting all business logic for “tests green”

---

## 14. Implementation order (after this audit)

1. Migrations: `web_push` channel, `event_id`, `deep_link`, attempts; `push_subscriptions`; notification preferences  
2. `platform-events` types + DeliveryOrchestrator + idempotent create  
3. Web Push sender (web-push lib) + 410 revoke + retries  
4. Migrate existing notifiers to emit/orchestrate (preserve Telegram behavior)  
5. SW push + click  
6. Frontend: VAPID public, subscribe UX, Notification Center, settings, badge, deep links  
7. Tests + build + report with honest Manual QA section  

---

## 15. Proceed

Audit complete → implementation may start.
