# LonghuaCRM — System Audit Report

**Date:** 2026-07-13  
**Scope:** Full stack (NestJS API, PostgreSQL/TypeORM, React frontend, integrations)  
**Baseline:** `npm run build` PASS · API e2e **32/32** PASS · browser e2e **4/4** PASS · migrations **7** applied on dev `longhua`

---

## Executive Summary

LonghuaCRM v2 backend is architecturally sound: relational entities, no JSONB for business data, modular NestJS structure, JWT + role guards on most endpoints. Main risks found:

1. **Security:** unauthenticated debug mail endpoint (fixed)
2. **Schema drift:** migrations vs entities on auxiliary tables (fixed via migration)
3. **Business logic:** non-idempotent lesson completion / attendance missed (fixed)
4. **Frontend/backend contract gaps:** materials hub grouping, shop settings, lesson series (**fixed** HIGH-001–005)
5. **Dev ops:** schema now auto-applies via migrations on startup (fixed earlier in session)
6. **UI boot failure:** missing `users` API import caused blank SPA (**fixed** CRIT-007)

---

## 1. Critical Issues

### CRIT-001 — Unauthenticated debug mail endpoint

| Field | Detail |
|-------|--------|
| **File** | `apps/api/src/modules/mail/debug-mail.controller.ts` |
| **Cause** | `POST /api/debug/mail` had no guards; anyone could trigger outbound email |
| **Risk** | Abuse / spam / credential probing in dev-like deployments |
| **Fix** | JWT + `@Roles('admin')`; disabled response body in production |
| **Status** | **Fixed** |

### CRIT-002 — Entity vs migration schema drift

| Field | Detail |
|-------|--------|
| **Files** | `1731000000000-InitialSchemaV2.ts`, `series-exclusion.entity.ts`, `material-link.entity.ts`, `series-student.entity.ts` |
| **Cause** | `CREATE TABLE IF NOT EXISTS` skipped altering legacy/existing tables; entities expect columns migrations never added |
| **Missing columns** | `lesson_series_exclusions.recurrence_index`, `reason`, `created_at`; `material_links.created_at/updated_at`; `lesson_series_students.created_at/updated_at` |
| **Risk** | SQL errors on insert/select for materials links, series exclusions |
| **Fix** | Migration `1736000000000-SchemaEntityAlign.ts` |
| **Status** | **Fixed** |

### CRIT-003 — Lesson completion not idempotent

| Field | Detail |
|-------|--------|
| **File** | `apps/api/src/modules/lessons/lessons.service.ts` (`complete`, `update`) |
| **Cause** | Re-calling complete or PATCH status→completed re-ran balance deduction side effects and incremented enrollment progress |
| **Risk** | Inflated `completed_lessons`, duplicate certificate drafts, incorrect balances |
| **Fix** | Early return if already `completed`; only run side effects on status transition |
| **Status** | **Fixed** |

### CRIT-004 — Attendance “missed” not idempotent

| Field | Detail |
|-------|--------|
| **File** | `apps/api/src/modules/lessons/lessons.service.ts` (`updateAttendance`) |
| **Cause** | Every PATCH to `missed` incremented `enrollment.missed_lessons` |
| **Risk** | Progress corruption |
| **Fix** | Only increment when transitioning into missed from non-missed status |
| **Status** | **Fixed** |

### CRIT-005 — Payment student reassignment after balance credit

| Field | Detail |
|-------|--------|
| **File** | `apps/api/src/modules/payments/payments.service.ts` |
| **Cause** | `updatePayment` allowed `studentId` change after balance applied; delta applied only to new student |
| **Risk** | Wrong student balances, silent data corruption |
| **Fix** | `BadRequestException` when reassigning student on paid/credited payment |
| **Status** | **Fixed** |

### CRIT-006 — Frontend upload endpoint missing on backend

| Field | Detail |
|-------|--------|
| **Files** | `src/api/http.js`, `secure-files.controller.ts`, `secure-files.service.ts`, `MaterialFormDialog.jsx` |
| **Cause** | `UploadsModule` removed in v2 refactor; frontend still called `POST /api/uploads` |
| **Risk** | Material file upload broken in UI |
| **Fix** | `POST /api/files/upload` in `SecureFilesModule` (admin-only, JWT); frontend → `/api/files/upload`; folder resolution + create payload aligned with v2 DTOs; e2e `files-upload.e2e-spec.ts` |
| **Status** | **Fixed** |

### CRIT-007 — SPA blank screen (missing API import)

| Field | Detail |
|-------|--------|
| **File** | `src/api/index.js` |
| **Cause** | `users` exported and referenced in `api` object but never imported — runtime `ReferenceError: users is not defined` on module load |
| **Risk** | Entire React app fails to render (white screen); all browser flows blocked |
| **Fix** | `import { users } from './users.api'` |
| **Status** | **Fixed** (Playwright guest/admin/student/teacher flows) |

---

## 2. High Priority Issues

### HIGH-001 — Materials frontend/backend contract mismatch

| **Files** | `MaterialFormDialog.jsx`, `MaterialsHub.jsx`, `CreateMaterialDto` |
| **Cause** | Frontend sends `course_id`, `external_link`, `block_name`; backend requires `folderId`, `title`, `fileUrl` |
| **Risk** | 400 errors, materials not categorized by course |
| **Status** | **Fixed** — `attachCourseIds()` + `courseTemplateId`→`course_id` in API responses; MaterialsHub grouping works |

### HIGH-002 — Shop settings payload mismatch

| **Files** | `ShopSettingsAdmin.jsx`, `CreateShopItemDto`, `domain-client.js` |
| **Cause** | Frontend sends `item_id`, `label`, `lessons`; backend expects `name`, `lessonsCount`, `price` |
| **Risk** | Shop item creation fails |
| **Fix** | `domain-client.js` aliases `label`→`name`, `lessons`→`lessonsCount`; ShopSettingsAdmin save/display aligned |
| **Status** | **Fixed** |

### HIGH-003 — Lesson series course field mapping (frontend)

| **Files** | `LessonSeriesAdmin.jsx`, `CreateLessonSeriesDto`, `lesson-series.api.js` |
| **Cause** | Client maps `course_id` → `courseTemplateId`; API expects `courseId` |
| **Risk** | Series creation fails from admin UI |
| **Fix** | Custom `lessonSeries.create()` maps `courseTemplateId` → `courseId` |
| **Status** | **Fixed** |

### HIGH-004 — Settings update requires key on PATCH

| **Files** | `src/api/settings.api.js`, `AdminSettings.jsx` |
| **Cause** | `update()` validates `data.key` but callers send only `{ value }` |
| **Risk** | Cannot update existing settings |
| **Fix** | `AdminSettings.jsx` passes `key: 'alfa_bank_token'` on update |
| **Status** | **Fixed** |

### HIGH-005 — Nested filter double-wrap

| **Files** | `StudentDetail.jsx`, generic filter client |
| **Cause** | `{ where: { student_id } }` wrapped twice → `{ where: { where: ... } }` |
| **Risk** | Enrollment list empty/wrong on student page |
| **Fix** | Filter `{ student_id: studentId }` directly |
| **Status** | **Fixed** |

### HIGH-006 — Lesson update skips schedule revalidation

| **Files** | `lessons.service.ts` |
| **Cause** | Create checks availability/bookings; update does not |
| **Risk** | Double-booked teachers, stale availability bookings |
| **Fix** | Revalidate on schedule field changes; sync `availability_bookings` |
| **Status** | **Fixed** |

### HIGH-007 — Schedule endpoints lack role scoping

| **Files** | `schedule.controller.ts`, `schedule-access.service.ts` |
| **Cause** | Any authenticated user could filter all slots/bookings; teacher could check any teacherId |
| **Risk** | Schedule data leak between teachers |
| **Fix** | `ScheduleAccessService`; admin/teacher roles on list/filter; teacher scoped to own `teacherId` |
| **Status** | **Fixed** |

### HIGH-008 — Auto-complete cron every minute

| **Files** | `jobs.service.ts` |
| **Cause** | `* * * * *` completes all expired planned lessons |
| **Risk** | Mass completion side effects if misconfigured timezone/data |
| **Status** | Open (mitigated by CRIT-003 idempotency) |

### HIGH-CERT — Certificates validation & lifecycle (audit block 4)

| **Files** | `certificates.service.ts`, `certificate-lifecycle.ts`, `1737000000000-CertificateUniquenessAlign.ts` |
| **Cause** | No uniqueness on blank series/number; no status transition guards; issuance without enrollment check; PDF open to any readable cert; no reissue flow |
| **Fix** | Statuses `draft/issued/sent/duplicate/revoked`; unique indexes; issuance validation; immutable issued fields; `POST :id/reissue`; PDF guard; history on all mutations; e2e `certificates-validation.e2e-spec.ts` |
| **Status** | **Fixed** |

---

## 3. Medium Issues

| ID | Issue | File | Status |
|----|-------|------|--------|
| MED-001 | Generic filter DTOs pass arbitrary keys to TypeORM `where` | `filter-query.dto.ts`, `api-record.util.ts` | Open |
| MED-002 | Date/time DTO fields are plain strings without format validation | `create-lesson.dto.ts`, schedule DTOs | Open |
| MED-003 | `UpdatePaymentDto.amount` lacks `@Min(0.01)` | `update-payment.dto.ts` | **Fixed** |
| MED-004 | `audit_logs.summary` nullable mismatch entity/migration | `audit-log.entity.ts` | Open |
| MED-005 | `notifications.reference_id` uuid vs varchar(128) | `notification.entity.ts` | Open |
| MED-006 | Orphan entity `AlfaBankOrderEntity` not in registry | `entities/alfaBankOrder.entity.ts` | Open |
| MED-007 | CORS `origin: true` with credentials | `main.ts` | Open |
| MED-008 | Telegram webhook swallows errors, always `{ ok: true }` | `webhooks.controller.ts` | Open |
| MED-009 | Material URLs use raw `file_url` not signed route | `src/lib/materialUrl.js` | Open |
| MED-010 | Unregistered admin pages (only via AdminPanel tabs) | `App.jsx`, various pages | Open |

---

## 4. Low Priority Issues

| ID | Issue | Status |
|----|-------|--------|
| LOW-001 | Unnecessary `forwardRef` in telegram/files modules | Open |
| LOW-002 | `TelegramService.getBotInfo()` exposes `token_last5` | Open |
| LOW-003 | Legacy `FunctionsController` RPC surface | Open |
| LOW-004 | Weak client-side form validation on several dialogs | Open |
| LOW-005 | `teacher_payments` legacy columns (`note`, `created_date`) coexist with v2 | Accepted (bridge migrations) |

---

## 5. Architecture Problems

| Problem | Assessment |
|---------|------------|
| Dual schema history (legacy 1730* + v2 1731–1736) | Managed via idempotent migrations + bridge; acceptable |
| Entity registry explicit list vs glob migrations in runtime | Correct pattern; CLI uses explicit list in `data-source.ts` |
| `synchronize` only for E2E | Correct; dev/prod use migrations (`migrationsRun` when not E2E) |
| Frontend still partially on legacy field names | Needs contract alignment layer or frontend fixes |
| No JSONB for business entities | **Compliant** — verified no jsonb/json_record in API src |

---

## 6. Database Problems

| Table | Issue | Resolution |
|-------|-------|------------|
| `users` | Was missing on empty DB | Fixed via migrationsRun + InitialSchemaV2 |
| `teacher_payments` | Missing `paid_at`, `created_at` on legacy | Fixed: `1735000000000` |
| `lesson_series_exclusions` | Column model mismatch | Fixed: `1736000000000` |
| `material_links` | Missing timestamps | Fixed: `1736000000000` |
| `lesson_series_students` | Missing timestamps | Fixed: `1736000000000` |
| `certificates` | Missing blank/student-course uniqueness | Fixed: `1737000000000` |
| Legacy `courses` table vs v2 `course_templates` | Coexist on upgraded DB | Document; no auto-drop |

**FK/cascade:** Core relations use RESTRICT/CASCADE appropriately on v2 schema. Legacy tables may lack some v2 FKs until bridge runs.

---

## 7. Security Problems

| Item | Severity | Status |
|------|----------|--------|
| Debug mail unauthenticated | Critical | **Fixed** |
| JWT on most mutating endpoints | OK | — |
| IDOR guards (student/teacher scope) | Present in access services | Verified in QA |
| Webhook Telegram secret enforced in prod | OK | — |
| AlfaBank checksum validation | OK | — |
| Open CORS all origins | Medium | Open |
| Filter injection via generic where | Medium | Open |

---

## 8. Frontend Problems

See CRIT-006, HIGH-001–005, MED-009, MED-010. Frontend builds successfully but several admin workflows send payloads incompatible with v2 DTOs.

---

## 9. Testing Problems

| Gap | Recommendation |
|-----|----------------|
| No unit tests for enrollment progress idempotency | Add after HIGH fixes |
| E2E covers auth, flows, validation, lesson-series, files upload, schedule/lessons, payments, certificates | **32 tests passing** |
| No frontend integration tests | Add Playwright/Cypress for shop/materials/series |
| QA runner exists (`test/qa-full-runner.ts`) | Re-run after frontend contract fixes |

### Recommended test scenarios (backend)

1. ✅ New user registration + verify  
2. ✅ Student + enrollment + group + lesson + attendance  
3. ✅ Payment webhook idempotency  
4. ✅ Certificate draft → issue → PDF  
5. ✅ Lesson cancel  
6. ⬜ Idempotent lesson complete (add explicit e2e)  
7. ✅ Materials upload via files API
8. ✅ Certificate validation suite (`certificates-validation.e2e-spec.ts`)

---

## 10. Fix Log (this session)

| ID | Change | Verification |
|----|--------|--------------|
| CRIT-001 | Secured `DebugMailController` | build PASS |
| CRIT-002 | `1736000000000-SchemaEntityAlign.ts` | migration PASS |
| CRIT-003 | Idempotent `complete()` / `update()` | build PASS, e2e PASS |
| CRIT-004 | Missed attendance transition guard | build PASS, e2e PASS |
| CRIT-005 | Block payment student reassignment | build PASS |
| CRIT-006 | `POST /api/files/upload` + frontend contract | build PASS, e2e **25/25** |
| HIGH-006 | Lesson update schedule revalidation + booking sync | e2e `schedule-lessons.e2e-spec.ts` |
| HIGH-007 | Schedule role scoping via `ScheduleAccessService` | e2e PASS |
| PAY-INT | Payment shop-item guard + balance floor on reversal | e2e `payments-integrity.e2e-spec.ts` |
| HIGH-CERT | Certificate lifecycle, uniqueness, reissue, PDF guard | e2e **32/32** |
| CRIT-007 | Missing `users` import — SPA blank screen | browser e2e **4/4** |
| HIGH-001–005 | Materials API contract, shop, lesson series, settings, enrollments filter | build PASS, browser e2e |
| PLAYWRIGHT | Browser E2E: guest, student, admin, teacher flows | `npm run test:browser` **4/4** |
| (prior) | `migrationsRun` in dev | startup schema OK |
| (prior) | `UploadsModule` dead import removed | build PASS |

---

## Next Iteration Plan

**High priority (recommended order):**

1. ~~CRIT-006~~ — Materials upload via SecureFilesModule ✅
2. ~~HIGH-006 / HIGH-007~~ — Schedule/Lessons consistency ✅
3. ~~Payments integrity~~ — balance guards + DTO validation ✅
4. ~~Certificates validation~~ — lifecycle + uniqueness + e2e ✅
5. ~~HIGH-001–005~~ — Frontend/backend contract fixes ✅
6. HIGH-008 (remaining)

**Do not:** mass refactor, reintroduce JSONB, auto-drop legacy tables, enable `synchronize` in dev/prod.

---

## Commands

```bash
npm run migration:run   # apply pending migrations
npm run build           # api + frontend
npm run test:e2e        # backend e2e (32 tests)
npm run test:browser    # Playwright browser e2e (4 flows)
npm run test:browser:report  # merge ui-issues.json → this report
cd apps/api && npx ts-node --project tsconfig.json test/qa-full-runner.ts
```

---

## 11. Playwright UI/UX Issues (Browser E2E)

| Flow | Step | Severity | Issue | Status |
|------|------|----------|-------|--------|
| all | boot | critical | `users is not defined` in `src/api/index.js` — blank white SPA | **Fixed** (CRIT-007) |
| guest | registration | — | Registration → `/auth/pending-approval` → verification code input | **Pass** |
| student | login | medium | Dedicated student account provisioning not in API; test uses admin session for navigation | Open (test limitation) |
| teacher | login | medium | Teacher entity created without linked user — no teacher UI login without manual user assignment | Open (product gap) |
| admin | certificates | — | Student dropdown lists API-created students after reload | **Pass** |

*Generated from Playwright browser tests (`npm run test:browser`). Last run: **4/4 PASS**.*

*Report updated after HIGH-001–005 fixes, CRIT-007 SPA boot fix, and Playwright browser E2E.*
