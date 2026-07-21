> **HISTORICAL / COMPLETED (JSONB migration finished).**
> This file describes an earlier plan/audit that mentioned `data jsonb`, `slots jsonb`, or legacy JSON storage.
> **Current architecture:** relational CRM entities; TeacherAvailability via `teacher_availability_slots`; Assessment via snapshot tables; **no JSONB for business entities**.
> See [../Database.md](../Database.md) and [../architecture/storage-policy.md](../architecture/storage-policy.md).

# LongHuaCRM v2 — Post-Migration Audit

**Date:** 2026-07-12  
**Scope:** Controlled Rewrite (generic Entities → domain-driven CRM)  
**Method:** Static code analysis only — no runtime tests, no code changes  
**Build status at audit time:** `npm run build` passes

---

## Executive summary

The v2 rewrite successfully removed the generic `/entities` layer from **AppModule** and introduced domain modules with a consistent Controller → Service → Repository → Entity stack. Core CRUD and several integrations (Alfa Bank webhook, Telegram jobs, material access sync) are present.

However, the audit found **significant functional and security regressions** compared to the legacy CRM:

- Row-level access control (`EntityAccessService`) was **not ported** — any authenticated user can read most domain data.
- Teacher workflows (mark lesson complete/cancel, schedule management) are **blocked by `@Roles('admin')`** on mutation endpoints.
- Entity ↔ migration **schema drift** will cause runtime DB errors on several tables/columns.
- Frontend field naming mismatch (`assigned_teacher` vs `assigned_teacher_id`) breaks teacher/student linking across many pages.
- Several legacy features have **no v2 equivalent** (TeacherPayment, LessonSeries API/cron, group lessons UI, certificates UI).

**Overall verdict:** Architecture target achieved; **production functional parity not achieved**.

---

## 1. PASS

### 1.1 Legacy layer removal (backend wiring)

| Item | Status |
|------|--------|
| `EntitiesModule` removed from `app.module.ts` | ✅ |
| `LegacyModule` removed from `app.module.ts` | ✅ |
| `apps/api/src/modules/entities/` on disk | ✅ absent |
| `apps/api/src/modules/legacy/` on disk | ✅ absent |
| `apps/api/src/entities/` global folder on disk | ✅ absent |
| Old migrations (`173000*`) on disk | ✅ absent — only `1731000000000-InitialSchemaV2.ts` |
| `shared/entity-names.json` on disk | ✅ absent |
| `src/api/entities.js` on disk | ✅ absent |

### 1.2 Domain module stack (all requested domains)

Each listed domain has **module.ts + controller.ts + service.ts + repository.ts + entities/ + dto/** (settings/users use minimal DTOs for some operations).

| Domain | Base path | Controller | Service | Repository | Entity | DTO |
|--------|-----------|------------|---------|------------|--------|-----|
| students | `/students` | ✅ | ✅ | ✅ | ✅ | ✅ |
| teachers | `/teachers` | ✅ | ✅ | ✅ | ✅ | ✅ |
| courses | `/courses` | ✅ | ✅ | ✅ | ✅ (template + enrollment) | ✅ |
| groups | `/groups` | ✅ | ✅ | ✅ | ✅ (+ members) | ✅ |
| lessons | `/lessons` | ✅ | ✅ | ✅ | ✅ (+ attendance) | ✅ |
| payments | `/payments` | ✅ | ✅ | ✅ | ✅ (+ shop_items) | ✅ |
| materials | `/materials` | ✅ | ✅ | ✅ | ✅ (+ folders, access, links) | ✅ |
| certificates | `/certificates` | ✅ | ✅ | ✅ | ✅ | ✅ |
| settings | `/settings` | ✅ | ✅ | ✅ | ✅ (app_settings) | ⚠️ partial (inline bodies) |
| schedule | `/schedule` | ✅ | ✅ | ✅ | ✅ (slots, bookings, series*) | ✅ |
| users | `/users` | ✅ | ✅ | ✅ | ✅ | ⚠️ update only |

\* `lesson_series*` entities exist in DB schema and entity registry but **have no REST controller**.

### 1.3 Domain endpoint map

#### `/students`
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/students` | JWT only | List all |
| GET | `/students/:id` | JWT only | |
| POST | `/students/filter` | JWT only | Body: `{ where: {...} }` |
| POST | `/students` | admin | Create |
| PATCH | `/students/:id` | admin | Update (incl. balance via DTO) |
| DELETE | `/students/:id` | admin | |

#### `/teachers`
| Method | Path | Roles |
|--------|------|-------|
| GET | `/teachers` | JWT |
| GET | `/teachers/:id` | JWT |
| POST | `/teachers/filter` | JWT |
| POST | `/teachers` | admin |
| PATCH | `/teachers/:id` | admin |
| DELETE | `/teachers/:id` | admin |

#### `/courses`
| Method | Path | Roles |
|--------|------|-------|
| GET | `/courses` | JWT |
| POST | `/courses/filter` | JWT |
| GET | `/courses/:id` | JWT |
| POST/PATCH/DELETE | `/courses` / `/:id` | admin |
| GET | `/courses/enrollments` | JWT |
| GET | `/courses/enrollments/:id` | JWT |
| POST | `/courses/enrollments/filter` | JWT |
| POST/PATCH/DELETE | `/courses/enrollments` / `/:id` | admin |

#### `/groups`
| Method | Path | Roles |
|--------|------|-------|
| GET | `/groups` | JWT |
| POST | `/groups/filter` | JWT |
| GET | `/groups/:id` | JWT |
| GET | `/groups/:id/members` | JWT |
| POST | `/groups/:id/members` | admin |
| DELETE | `/groups/:id/members/:memberId` | admin |
| POST/PATCH/DELETE | `/groups` / `/:id` | admin |

#### `/lessons`
| Method | Path | Roles |
|--------|------|-------|
| GET | `/lessons` | JWT |
| POST | `/lessons/filter` | JWT |
| GET | `/lessons/:id` | JWT |
| POST | `/lessons` | admin |
| PATCH | `/lessons/:id` | admin |
| DELETE | `/lessons/:id` | admin |
| PATCH | `/lessons/:id/complete` | admin |
| PATCH | `/lessons/:id/cancel` | admin |
| GET/POST/PATCH/DELETE | `/lessons/attendance/*` | read: JWT / write: admin |

#### `/payments`
| Method | Path | Roles |
|--------|------|-------|
| GET | `/payments` | JWT |
| POST | `/payments/filter` | JWT |
| GET | `/payments/:id` | JWT |
| POST/PATCH/DELETE | `/payments` / `/:id` | admin |
| GET | `/payments/shop-items` | JWT |
| POST | `/payments/shop-items/filter` | JWT |
| CRUD | `/payments/shop-items/:id` | read: JWT / write: admin |

#### `/materials`
| Method | Path | Roles |
|--------|------|-------|
| GET/POST filter | `/materials`, `/materials/filter` | JWT |
| CRUD | `/materials/:id` | read: JWT / write: admin |
| GET/POST filter | `/materials/folders`, `/materials/folders/filter` | JWT |
| CRUD | `/materials/folders/:id` | read: JWT / write: admin |
| POST | `/materials/access/sync` | admin |

#### `/certificates`
| Method | Path | Roles |
|--------|------|-------|
| GET/POST filter/GET by id | `/certificates` | JWT |
| POST/PATCH/DELETE | `/certificates` / `/:id` | admin |

#### `/settings`
| Method | Path | Roles |
|--------|------|-------|
| GET | `/settings` | admin (class-level) |
| PATCH | `/settings/:key` | admin |
| GET/PATCH | `/settings/welcome/page` | admin |

#### `/schedule`
| Method | Path | Roles |
|--------|------|-------|
| GET/POST filter | `/schedule`, `/schedule/filter` | JWT |
| POST | `/schedule/bookings/filter` | JWT |
| GET | `/schedule/teachers/:teacherId/availability` | admin, teacher |
| POST | `/schedule/teachers/:teacherId/check-availability` | admin, teacher |
| CRUD | `/schedule/:id` | read: JWT / write: admin |

#### `/users`
| Method | Path | Roles |
|--------|------|-------|
| GET | `/users` | admin |
| PATCH | `/users/:id` | admin |
| DELETE | `/users/:id` | admin |

### 1.4 Integrations preserved

| Integration | Endpoint | Status |
|-------------|----------|--------|
| Alfa Bank webhook | `POST /webhooks/alfabank` | ✅ (public, signature check inside service) |
| Alfa Bank offline request | `POST /alfabank/offline-payment-request` | ✅ JWT + student access check |
| Alfa init (RPC) | `POST /functions/alfaBankInit` | ✅ via FunctionsModule |
| Telegram webhook | `POST /webhooks/telegram` | ✅ |
| Lesson reminders cron | JobsService | ✅ (24h + 2h) |
| Auto-complete expired lessons | JobsService | ✅ |
| File upload | `POST /uploads` | ✅ admin, teacher |
| Secure file stream | `GET /files/signed/:token` | ✅ token-based |
| API snake_case responses | `ApiSerializeInterceptor` | ✅ global |

### 1.5 Frontend domain API (active `src/`)

Live filesystem scan (`rg "api\.entities|/entities/" src`) → **0 matches**.

`src/api/index.js` exports domain clients: `students`, `teachers`, `courses`, `groups`, `lessons`, `payments`, `materials`, `certificates`, `settings`, `users`, `notifications`, `schedule`, `functions`.

Active pages (`src/pages/`) use domain APIs.

---

## 2. WARNINGS

### 2.1 Guards: JWT present, role matrix incomplete

- All domain controllers use `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **`RolesGuard` allows any authenticated role when `@Roles` is absent** (see `roles.guard.ts`: `if (!requiredRoles?.length) return true`).
- Read endpoints (`GET`, `POST .../filter`) on students, teachers, lessons, payments, materials are **open to student/teacher roles**, not just admin.
- Legacy CRM used `EntityAccessService` + `entity-permissions.ts` for per-entity, per-role, row-level rules — **removed without replacement**.

### 2.2 Teacher / student mutations require admin

Endpoints critical for daily CRM operations are admin-only:

- `PATCH /lessons/:id` (mark completed/cancelled) — **admin**
- `POST /lessons` — **admin**
- `PATCH /students/:id` — **admin** (blocks Profile birthday/telegram update for students)
- `PATCH /teachers/:id` — **admin** (blocks Profile update for teachers)

Frontend still calls these as teacher/student (`TeacherRoleDashboard`, `TeacherDashboard`, `Profile.jsx`).

### 2.3 Frontend ↔ API field naming drift

Backend serializes `assignedTeacherId` → **`assigned_teacher_id`**.  
Frontend (20+ locations) reads **`assigned_teacher`**.

Affected flows: teacher student lists, student dashboard teacher name, export, user management, material access scoping.

Similarly legacy lesson fields not in v2 API responses:

- `student_ids` / `student_id` → replaced by `primary_student_id` + `attendance_records` (no auto-enrichment in list responses)
- `material_ids` → `material_links` table exists but **no API enrichment** on lesson GET/list

### 2.4 Client-side filtering / sorting replaces server features

- `createDomainClient.list(sort, limit)` fetches **full list** then sorts/slices in browser.
- Legacy `/entities/:name?sort=&limit=` had server-side semantics via `EntityRepositoryService`.
- Student/teacher dashboards filter lessons client-side after downloading **all** lessons → security + performance concern.

### 2.5 Settings / Welcome page access

- `GET /settings/welcome/page` requires **admin** JWT.
- `Welcome.jsx` loads welcome text for pending users → fails silently, shows defaults (acceptable fallback).
- Admin welcome editor works only for admin (expected).

### 2.6 Residual RPC layer

`FunctionsModule` (`POST /functions/:name`) remains for alfaBankInit, telegram admin ops, backup export, reminders manual trigger. Not part of domain REST map but still required by frontend.

### 2.7 Audit module

`audit` has service + repository + entity but **no controller** — internal-only (acceptable if intentional).

### 2.8 Stale IDE/grep index

Cursor search index may still show deleted files (`src/api/entities.js`, old components with `api.entities`). **Filesystem verification:** these paths do not exist on disk.

---

## 3. Missing functionality

### Legacy vs v2 comparison

| Функция | Было (legacy) | Стало (v2) | Статус |
|---------|---------------|------------|--------|
| **Students: создание** | `POST /entities/Student` (admin) | `POST /students` (admin) | ✅ Parity |
| **Students: редактирование** | Entity access rules | `PATCH /students/:id` (admin only) | ⚠️ Admin-only; student self-edit broken |
| **Students: поиск/filter** | `/entities/Student/filter` + scoped | `/students/filter` unscoped | ⚠️ Works but no row-level scope |
| **Students: баланс** | PaymentService + StudentBalanceService via entity orchestrator | `PaymentsService` + `StudentBalanceService` on lesson complete | ⚠️ Balance update on payment ✅; manual balance edit admin-only |
| **Students: история занятий** | Lesson filter by student_id / join | Client filters all lessons; attendance API exists but UI doesn't use it | ⚠️ Partial |
| **Teachers: профиль** | CRUD + role sync | CRUD + `RoleEntitySyncService` | ⚠️ Self-update via PATCH blocked for non-admin |
| **Teachers: группы** | Group entity + UI | `/groups` API exists | ❌ No frontend usage found |
| **Teachers: выплаты** | `TeacherPayment` entity + Salary linkage | Salary page computes from lessons × `hourly_rate` only | ❌ TeacherPayment removed; no payout records |
| **Courses: создание** | `Course` JSONB records | `course_templates` + CRUD | ✅ Different model, API present |
| **Courses: enrollment** | Course per student | `enrollments` table + CRUD | ✅ Parity (model change) |
| **Courses: цены** | ShopSettings + course price fields | `shop_items` + `course_templates.price` | ✅ Parity |
| **Schedule: уроки** | Lesson orchestrator (availability check, booking, balance) | Plain CRUD on lessons | ⚠️ No availability validation on create |
| **Schedule: расписание** | TeacherAvailability + slots | `/schedule` availability slots | ✅ Partial |
| **Schedule: посещаемость** | LessonStudent join + statuses | `attendance_records` CRUD | ⚠️ API exists; lesson create doesn't auto-create attendance |
| **Schedule: переносы** | status `rescheduled` + orchestrator | status enum supports `rescheduled` | ⚠️ No dedicated reschedule flow |
| **Schedule: recurring series** | `LessonSeries` + cron maintenance | DB tables exist; orchestrator **deleted**; frontend creates 2 manual lessons | ❌ Regression |
| **Payments: ручная оплата** | Entity Payment + balance rules | `PaymentsService.create/update` | ✅ Parity |
| **Payments: AlfaBank webhook** | `PaymentService.markPaidFromWebhook` | `PaymentsService.markPaidFromWebhook` | ✅ Parity |
| **Payments: статусы** | pending/paid/failed/refunded | Same enum in entity | ✅ Parity |
| **Materials: доступы** | MaterialAccess CRUD + check service | `POST /materials/access/sync` + `MaterialAccessCheckService` | ⚠️ Different API shape; core logic present |
| **Materials: файлы** | SecureFiles + uploads | Same modules wired | ✅ Parity |
| **Certificates: выпуск** | Entity CRUD | `/certificates` admin CRUD | ⚠️ API only |
| **Certificates: история** | filter/list | `/certifications/filter` | ❌ No frontend page references `api.certificates` |
| **Notifications** | Entity API | `/notifications` domain API | ⚠️ API exists; limited frontend use |
| **App settings** | AppSettings entity | `app_settings` + `/settings` | ✅ Parity |
| **Welcome page** | WelcomePageSettings entity | `/settings/welcome/page` (app_settings keys) | ⚠️ Admin-only read |
| **User management** | `/entities/User` + profile relations | `/users` + domain deletes | ✅ Mostly parity |
| **Generic entity export** | `/functions/exportBackup` | JobsService export (subset of tables) | ⚠️ Reduced coverage |

---

## 4. Potential bugs

### 4.1 Entity ↔ migration schema drift (critical)

TypeORM entities and `InitialSchemaV2` **do not match** for several tables. Running migrations then using the app **will fail** on affected columns/constraints.

| Table | Entity expects | Migration has | Impact |
|-------|----------------|---------------|--------|
| `teachers` | `hourly_rate`, `specializations`, enum `status` | Missing columns; `status varchar` | Salary page always 0 rate; inserts may error on enum |
| `teacher_availability_bookings` | `date`, `time_from`, `time_to`, `lesson_id NOT NULL` | Only `teacher_id`, `lesson_id` (nullable), `status` | TypeORM queries fail; booking filter broken |
| `groups` | `onDelete: RESTRICT` | `ON DELETE CASCADE` | Behavioral mismatch on teacher delete |
| `materials` | `folder_id` NOT NULL | `folder_id` nullable | Insert without folder may fail at app layer |
| `material_access` | enum `granted_by_role` | `varchar` + extra `granted_by_user_id` | Possible insert/type issues |
| Various | `@Index` decorators | Few indexes in SQL | Performance degradation, not immediate failure |
| `payments.order_number` | Used for idempotency | No UNIQUE constraint | Duplicate pending payments possible under race |

### 4.2 Lesson create/update gaps

- No call to `ScheduleService.assertAvailableForLesson` on create.
- No automatic `attendance_records` for `primaryStudentId` / group members.
- No `teacher_availability_bookings` creation.
- `StudentBalanceService` runs on complete/update status but multi-student lessons depend on pre-existing attendance rows.

### 4.3 Profile save 403 for students/teachers

`Profile.jsx` calls `api.students.update` / `api.teachers.update` after `auth.updateMe`. Backend requires admin → **403 Forbidden** for non-admin roles.

### 4.4 Teacher lesson actions 403

`TeacherRoleDashboard` and `TeacherDashboard` call `api.lessons.update` with status changes → backend requires admin.

### 4.5 `assigned_teacher` vs `assigned_teacher_id`

Widespread frontend mismatch → teachers see **zero assigned students**, student dashboard missing teacher info.

### 4.6 Groups API unused

Backend ready; frontend never calls `api.groups` → group lesson workflows absent.

### 4.7 Certificates API unused

No UI wired to `/certificates` despite backend module.

### 4.8 Jobs export backup reduced

`JobsService.exportBackup` exports only users, students, teachers, lessons — not payments, materials, enrollments, etc.

### 4.9 Route ordering in settings controller

`PATCH /settings/:key` is registered **before** `PATCH /settings/welcome/page`. NestJS may match `welcome` as `:key` for PATCH requests to welcome path depending on route specificity — verify at runtime.

---

## 5. Recommendations

### Priority 0 — Blockers before any environment testing

1. **Align `InitialSchemaV2` with TypeORM entities** (teachers columns, availability_bookings columns, enums/indexes, payment order_number UNIQUE).
2. **Run migration on clean DB and smoke-test** each domain CRUD path.
3. **Fix API contract for `assigned_teacher`** — either alias in serializer or update frontend to `assigned_teacher_id`.

### Priority 1 — Functional parity

4. **Port row-level access policy** — domain guard/interceptor replacing `EntityAccessService` (student sees own data, teacher sees assigned students/lessons).
5. **Restore teacher permissions** on `PATCH /lessons/:id`, `PATCH /lessons/:id/complete|cancel` for own lessons.
6. **Allow student/teacher self-update** on profile fields (birthday, telegram) without admin role.
7. **Wire lesson create** to schedule validation + attendance creation + optional material links.
8. **Restore LessonSeries maintenance** or document intentional removal and update Schedule UI.

### Priority 2 — Completeness

9. **Frontend for groups and certificates** or remove unused modules.
10. **Replace TeacherPayment** with explicit payout entity or document Salary as canonical replacement.
11. **Expand export backup** to all business tables.
12. **Public read** for welcome page settings (`GET /settings/welcome/page` without admin).

### Priority 3 — Security hardening

13. Add default `@Roles('admin')` on class level for sensitive domains, then explicit exceptions — avoids accidental public reads.
14. Add server-side filter scoping (never return all students to student role).
15. Review `GET /files/signed/:token` — ensure token validation is sufficient (no JWT).

---

## Appendix A — Security baseline detail

| Controller | JWT | Role restrictions | Row-level scope |
|------------|-----|-------------------|-----------------|
| students | ✅ | Mutations: admin | ❌ None |
| teachers | ✅ | Mutations: admin | ❌ None |
| courses | ✅ | Mutations: admin | ❌ None |
| groups | ✅ | Mutations: admin | ❌ None |
| lessons | ✅ | Mutations: admin | ❌ None |
| payments | ✅ | Mutations: admin | ❌ None |
| materials | ✅ | Mutations: admin; sync admin | ❌ None (read all materials) |
| certificates | ✅ | Mutations: admin | ❌ None |
| settings | ✅ | All: admin | N/A |
| schedule | ✅ | Mixed | ❌ None |
| users | ✅ | All: admin | N/A |
| auth | Public login/register | N/A | N/A |
| webhooks | Public | Signature/secret checks | N/A |
| uploads | ✅ | admin, teacher | N/A |
| files | Token/JWT | Partial | Material access check on URL generation |

**Student cannot read other students' data?** ❌ Not enforced — `GET /students` returns all.  
**Teacher sees only own data?** ❌ Not enforced — can list all lessons/students/payments.

---

## Appendix B — Database model (InitialSchemaV2) quick reference

### Core FK graph (present)

```
users ← students, teachers, material_access, notifications, certificates.issued_by
teachers ← students.assigned_teacher_id, groups, lessons, availability_slots
students ← enrollments, payments, attendance, group_members, certificates
course_templates ← enrollments, shop_items, material_folders
groups ← group_members, lessons.group_id
lessons ← attendance, material_links, availability_bookings.lesson_id
shop_items ← payments.shop_item_id
enrollments ← payments.enrollment_id, certificates.enrollment_id
```

### Notable constraints

| Table | UNIQUE | CASCADE |
|-------|--------|---------|
| students.email | ✅ | — |
| students.user_id | ✅ | — |
| group_members (group_id, student_id) | ✅ | CASCADE on group delete |
| attendance (lesson_id, student_id) | ✅ | CASCADE on lesson delete |
| material_access (user_id, material_id) | ✅ | CASCADE |
| material_links (lesson_id, material_id) | ✅ | CASCADE |
| app_settings.key | ✅ | — |

### Missing vs entity expectations

See §4.1 — **teachers**, **teacher_availability_bookings** are highest risk.

---

*End of audit. No code was modified during this analysis.*
