# Unified Event Architecture (Event Bus)

**Status:** Designed (Stage −1) — **not implemented in this stage**  
**Constraint:** No API / Telegram / business-logic changes until a dedicated implementation stage after DS acceptance.  
**Related:** [ADR-001](./adr-001-primary-client-pwa.md) · [Stage −1 report](./stage-minus-1-report.md)

---

## 1. Problem

Today notifications are **channel-coupled**:

| Pattern | Examples |
|---------|----------|
| Direct notifier services | `HomeworkNotifierService`, `CertificateIssuedNotifier`, lesson reschedule/update notifiers |
| Partial Nest events | `lesson.rescheduled`, `lesson.updated`, `assessment.result.*` via `EventEmitter2` |
| Chat realtime | Socket.IO fan-out (not the same as notification channels) |
| Persistence | `notifications` table with channels `telegram` \| `email` \| `in_app` — **no `web_push` yet** |
| Telegram digests/jobs | Cron + `TelegramGateway` — separate from domain emit |

Result: **one business fact → duplicated notify logic** per channel. Push / Activity Feed / Audit cannot plug in cleanly.

---

## 2. Decision

**One domain event → many handlers.**

```
Domain Service (transaction commits)
        │
        ▼
  DomainEventBus.emit(PlatformEvent)
        │
        ├─► InAppNotificationHandler
        ├─► TelegramDeliveryHandler
        ├─► WebPushHandler          (future PWA stage)
        ├─► EmailHandler            (optional later)
        ├─► ActivityFeedHandler
        └─► AuditLogHandler
```

Rules:

1. Domain services **emit once** after successful commit (or outbox row).
2. Handlers **never** contain create-lesson / grade-homework business rules.
3. Delivery failures must not roll back the domain transaction (async / outbox).
4. Deep links are derived from a **single route map** (`event.type` + refs → path).

---

## 3. Platform event shape

Relational-friendly envelope (no JSON entity storage for business data — refs only):

```ts
type PlatformEventName =
  | 'lesson.started'
  | 'lesson.cancelled'
  | 'lesson.rescheduled'
  | 'lesson.teacher_changed'
  | 'homework.assigned'
  | 'homework.submitted'
  | 'homework.reviewed'
  | 'material.published'
  | 'certificate.issued'
  | 'payment.recorded'
  | 'message.received'
  | 'exam.assigned'
  | 'exam.completed'
  | 'exam.reviewed'
  | 'system.notice';

interface PlatformEvent {
  id: string;              // uuid, idempotency key
  name: PlatformEventName;
  occurredAt: string;      // ISO
  actorUserId: string | null;
  subjectUserIds: string[]; // recipients / concerned users
  referenceType: string;   // 'lesson' | 'homework' | …
  referenceId: string;
  schoolId?: string | null;
  payload: Record<string, string | number | boolean | null>; // small, non-authoritative
}
```

Authoritative state always stays in PostgreSQL entities. Payload is for templates only.

---

## 4. Catalog (v1)

| Event | Typical subjects | Channels (target) |
|-------|------------------|-------------------|
| `lesson.started` | participants | push, in-app |
| `lesson.cancelled` | participants + teachers | telegram, push, in-app |
| `lesson.rescheduled` | participants + teachers | telegram, push, in-app |
| `lesson.teacher_changed` | participants | telegram, push, in-app |
| `homework.assigned` | learner | telegram, push, in-app |
| `homework.submitted` | teacher | telegram, push, in-app |
| `homework.reviewed` | learner | telegram, push, in-app |
| `material.published` | entitled users | push, in-app |
| `certificate.issued` | learner | telegram, push, in-app, email? |
| `payment.recorded` | learner / admin | push, in-app |
| `message.received` | recipient | push (if background), in-app |
| `exam.assigned` | learner | telegram, push, in-app |
| `exam.completed` | teacher/admin | in-app |
| `exam.reviewed` | learner | telegram, push, in-app |

Existing Nest string events should **alias/migrate** into this catalog (e.g. `LESSON_RESCHEDULED` → `lesson.rescheduled`).

---

## 5. Module layout (future implementation)

```
apps/api/src/modules/platform-events/
  platform-events.module.ts
  platform-event.types.ts
  platform-event.bus.ts          # emit + optional transactional outbox
  handlers/
    in-app.handler.ts
    telegram.handler.ts
    web-push.handler.ts          # Stage Push
    activity-feed.handler.ts
    audit-log.handler.ts
  templates/
    event-copy.ts                # title/body SSOT
  deep-links/
    event-routes.ts              # path SSOT for all channels
```

### Outbox (recommended)

Table `platform_event_outbox` (relational columns + small payload), claim-before-send (same pattern as digests). Guarantees at-least-once delivery; handlers idempotent on `event.id` + channel.

### Existing code migration

| Current | Target |
|---------|--------|
| `HomeworkNotifierService` notify* | emit `homework.*` → handlers |
| `CertificateIssuedNotifier` | emit `certificate.issued` |
| `lesson-*.notifier.ts` | already `@OnEvent` — become thin or replace with bus handlers |
| Assessment notifiers | emit `exam.*` / keep assessment.* aliases |
| Chat `message.created` socket | keep realtime; **also** emit `message.received` for push when recipient offline |
| Telegram digests | scheduled **jobs**, not domain events (remain jobs; may emit `system.notice` if needed) |

---

## 6. Channel matrix (SSOT)

| Channel | Handler owns | Must not own |
|---------|--------------|--------------|
| In-app | Insert `notifications` row (`in_app`) | Domain writes |
| Telegram | Format + `TelegramGateway` | Duplicate recipient resolution beyond preferences |
| Web Push | Subscriptions + payload + deep link | Separate business rules |
| Email | Template send | — |
| Activity feed | Append feed row | — |
| Audit | Append audit row | PII beyond policy |

User preferences (mute chat push, etc.) live in handlers or a shared `DeliveryPolicyService`.

---

## 7. Deep link map (contract)

Examples:

| Event | Path |
|-------|------|
| `homework.assigned` | `/HomeworkViewer?assignmentId=` |
| `lesson.rescheduled` | `/StudentLessons` or lesson detail |
| `message.received` | `/Chats?chatId=` |
| `certificate.issued` | `/CertificateView/:id` |
| `payment.recorded` | `/Payments` |
| `exam.assigned` | `/StudentExams` |

Exact paths freeze when Push stage starts; frontend router remains SSOT for path strings via shared constants if needed.

---

## 8. What Stage −1 does **not** do

- No new Nest module code
- No Telegram refactor
- No Web Push
- No schema migration for outbox
- No change to Socket.IO chat protocol

Stage −1 only **locks the architecture** so PWA Push later plugs into handlers, not into domain services.

---

## 9. Implementation order (after Stage −1 / DS)

1. Introduce `platform-events` module + outbox migration.
2. Migrate one vertical end-to-end (`homework.*`) — prove fan-out.
3. Migrate certificates, lessons, assessment.
4. Add Web Push handler in Push stage.
5. Deprecate direct `TelegramService` calls from domain notifiers.
