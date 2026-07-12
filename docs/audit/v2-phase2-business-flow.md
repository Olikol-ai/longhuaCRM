# LongHuaCRM v2 — Phase 2 Business Flow Completion

**Date:** 2026-07-12  
**Scope:** Lesson pipeline, attendance, teacher payments, certificates, row-level access  
**Build:** `npm run build` — passes

---

## Реализовано

### 1. Lesson creation pipeline

`LessonsService.create()` выполняет полный flow в **DB-транзакции**:

1. Validate teacher exists
2. Validate group exists (если `groupId`) + принадлежность группы преподавателю
3. Validate schedule conflicts (`ScheduleService.assertNoScheduleConflicts`)
4. Validate teacher availability (`ScheduleService.assertAvailableForLesson`)
5. Create lesson
6. Load group students (`group_members`) или `primaryStudentId`
7. Create attendance records (`enrolled`) для каждого студента
8. Create `teacher_availability_bookings` (date, time_from, time_to)

При ошибке — rollback всей транзакции.

### 2. Attendance

- Автоматическое создание attendance при создании урока
- `PATCH /lessons/attendance/:id` — admin + teacher (свои уроки)
- `PATCH /lessons/attendance/:id/present` — статус `attended`
- `PATCH /lessons/attendance/:id/absent` — статус `missed`
- Обновление attendance с проверкой доступа через `LessonAccessService`

### 3. TeacherPayment domain module

Новый модуль `teacher-payments`:

| Field | Column |
|-------|--------|
| id | uuid |
| teacher_id | FK teachers |
| lesson_id | FK lessons (UNIQUE) |
| amount | numeric |
| status | pending / paid |
| paid_at | timestamptz |
| created_at | timestamptz |

**Логика:** при `complete` урока и при `update` со статусом `completed` создаётся `TeacherPayment` (idempotent по `lesson_id`).

`amount = hourly_rate × (duration / 60)`.

REST: `GET`, `POST /filter`, `GET :id`, `PATCH :id` (admin).

### 4. Certificates domain

Обновлённая entity `Certificate`:

- `student_id`, `course_id` (FK `course_templates`)
- `registration_number` (UNIQUE)
- `blank_series`, `blank_number`
- `issue_date`, `status` (draft / issued / revoked)
- `recipient_signature`

**CertificateHistory** — audit trail (created, updated, status_changed).

REST:
- `GET /certificates`, `POST /certificates/filter`
- `GET /certificates/:id`
- `GET /certificates/:id/history`
- `POST /certificates` (admin)
- `PATCH /certificates/:id` (admin)

Migration: `1732000000000-Phase2BusinessFlow.ts`

### 5. Row-level access

| Service | Scope |
|---------|-------|
| `CourseAccessService` | Enrollments: student — свои; teacher — enrollments assigned students; admin — все. Templates — read для всех auth |
| `MaterialsDomainAccessService` | Student — materials с `material_access.access=true`; teacher — materials из course folders assigned students; admin — все |
| `CertificateAccessService` | Student — свои; teacher — certificates assigned students; admin — все |

Интеграция: `courses`, `materials`, `certificates` controllers/services.

### 6. Schedule enhancements

- `assertNoScheduleConflicts` — проверка пересечений с уроками и bookings
- `createLessonBooking` — helper для booking
- `ScheduleRepository` — методы для conflicts + `saveBooking`

---

## Изменённые / новые файлы

### Migration

- `apps/api/src/database/migrations/1732000000000-Phase2BusinessFlow.ts`
- `apps/api/src/database/migrations/1731000000000-InitialSchemaV2.ts` (certificates, teacher_payments, certificate_history для fresh install)
- `apps/api/src/database/entity-registry.ts`

### Teacher payments (new module)

- `apps/api/src/modules/teacher-payments/**`

### Lessons / schedule

- `apps/api/src/modules/lessons/lessons.service.ts`
- `apps/api/src/modules/lessons/lessons.controller.ts`
- `apps/api/src/modules/lessons/lessons.module.ts`
- `apps/api/src/modules/schedule/schedule.service.ts`
- `apps/api/src/modules/schedule/schedule.repository.ts`
- `apps/api/src/modules/schedule/schedule.module.ts`

### Certificates

- `apps/api/src/modules/certificates/entities/certificate.entity.ts`
- `apps/api/src/modules/certificates/entities/certificate-history.entity.ts`
- `apps/api/src/modules/certificates/certificates.service.ts`
- `apps/api/src/modules/certificates/certificates.repository.ts`
- `apps/api/src/modules/certificates/certificates.controller.ts`
- `apps/api/src/modules/certificates/certificates.module.ts`
- `apps/api/src/modules/certificates/dto/*`

### Access control

- `apps/api/src/common/access/course-access.service.ts`
- `apps/api/src/common/access/materials-domain-access.service.ts`
- `apps/api/src/common/access/certificate-access.service.ts`
- `apps/api/src/common/access/domain-access.module.ts`

### Courses / materials

- `apps/api/src/modules/courses/courses.service.ts`
- `apps/api/src/modules/courses/courses.controller.ts`
- `apps/api/src/modules/materials/materials.service.ts`
- `apps/api/src/modules/materials/materials.controller.ts`

### Other

- `apps/api/src/app.module.ts`
- `apps/api/src/common/utils/api-record.util.ts`

---

## Оставшийся технический долг

1. **LessonSeries REST API** — entities есть, controller отсутствует
2. **Enrollment progress** — `completedLessons` не инкрементируется при complete урока
3. **Auto-certificate issuance** — при завершении курса сертификат не создаётся автоматически
4. **Teacher payment access** — teacher не видит свои выплаты (только admin REST)
5. **Lesson cancel** — booking не переводится в `cancelled`
6. **Attendance balance** — per-student deduction при `missed_no_notice` через attendance update упрощён
7. **Frontend** — UI для certificates, teacher-payments, group lessons не подключён
8. **Existing DB** — применить `1732000000000-Phase2BusinessFlow` (DROP старых certificates)

---

## Проверка

```bash
npm run build
npm run migration:run --prefix apps/api   # на dev/staging БД
```

Smoke-test:
- `POST /lessons` с groupId → attendance + booking созданы
- `PATCH /lessons/:id/complete` → TeacherPayment создан
- `GET /certificates` scoped по роли
- `PATCH /lessons/attendance/:id/present` для teacher
