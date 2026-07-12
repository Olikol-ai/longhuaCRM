# LongHuaCRM v2 — Hardening Phase 1

**Date:** 2026-07-12  
**Scope:** P0 database consistency, P0 API contract, P1 security (row-level access), P1 role fixes  
**Build:** `npm run build` — passes

---

## Исправлено

### P0 — Database consistency

- **`InitialSchemaV2` синхронизирована с domain entities:**
  - `teachers`: добавлены `hourly_rate`, `specializations`
  - `teacher_availability_bookings`: добавлены `date`, `time_from`, `time_to`; `lesson_id NOT NULL` + `ON DELETE CASCADE`
  - `groups.teacher_id`: `ON DELETE RESTRICT` (как в entity)
  - `materials.folder_id`: `NOT NULL` + `ON DELETE CASCADE`
  - `material_access`: убран лишний `granted_by_user_id` (нет в entity)
  - `payments.order_number`: `UNIQUE` constraint (`UQ_PAYMENTS_ORDER_NUMBER`)
  - Добавлены индексы из entity-декораторов (teachers, students, lessons, bookings, payments, materials, material_access)

- **`PaymentEntity`:** индекс `IDX_PAYMENT_ORDER_NUMBER` помечен как `unique: true`

### P0 — API contract

- Единый контракт: **`assigned_teacher`** (snake_case в JSON API)
  - Сериализация: `assignedTeacherId` → `assigned_teacher` в `entityToApiRecord`
  - Фильтры: алиас `assigned_teacher` → `assignedTeacherId` в `filterToEntityWhere`
  - Frontend `domain-client.js` уже отправляет `assigned_teacher` — без изменений

### P1 — Row-level access

Создан и подключён **`DomainAccessModule`** (global):

| Service | Правила |
|---------|---------|
| `StudentAccessService` | Student: только себя, свои payments; Teacher: студенты с `assigned_teacher`; Admin: полный доступ |
| `TeacherAccessService` | Teacher: свой профиль, свои groups; Student: read teachers; Admin: полный доступ |
| `LessonAccessService` | Student: свои уроки (attendance + primary); Teacher: свои уроки; Admin: полный доступ |

Интеграция в сервисы: `students`, `teachers`, `lessons`, `payments`, `groups`.

### P1 — Role fixes

- **Lessons:** `PATCH /lessons/:id`, `/complete`, `/cancel` — `@Roles('admin', 'teacher')` + проверка владения уроком
- **Teacher lesson updates:** ограничены полями `status`, `notes`, `meetingLink`, `reminder24hSent`, `reminder2hSent`
- **Student profile:** `PATCH /students/:id` — `@Roles('admin', 'student')` + self-update (`telegramId`, `birthday`, `phone`, names)
- **Teacher profile:** `PATCH /teachers/:id` — `@Roles('admin', 'teacher')` + self-update
- **`UpdateStudentDto`:** добавлено поле `telegramId` (Profile.jsx)

### Прочее

- **`JobsService`:** cron-задачи используют `SYSTEM_ACTOR` (admin) для вызовов `LessonsService` после смены сигнатур

---

## Изменённые файлы

### Новые

- `apps/api/src/common/access/domain-access.types.ts`
- `apps/api/src/common/access/access.constants.ts`
- `apps/api/src/common/access/student-access.service.ts`
- `apps/api/src/common/access/teacher-access.service.ts`
- `apps/api/src/common/access/lesson-access.service.ts`
- `apps/api/src/common/access/domain-access.module.ts`

### Backend

- `apps/api/src/app.module.ts`
- `apps/api/src/common/utils/api-record.util.ts`
- `apps/api/src/database/migrations/1731000000000-InitialSchemaV2.ts`
- `apps/api/src/modules/payments/entities/payment.entity.ts`
- `apps/api/src/modules/students/dto/update-student.dto.ts`
- `apps/api/src/modules/students/students.controller.ts`
- `apps/api/src/modules/students/students.service.ts`
- `apps/api/src/modules/teachers/teachers.controller.ts`
- `apps/api/src/modules/teachers/teachers.service.ts`
- `apps/api/src/modules/lessons/lessons.controller.ts`
- `apps/api/src/modules/lessons/lessons.service.ts`
- `apps/api/src/modules/payments/payments.controller.ts`
- `apps/api/src/modules/payments/payments.service.ts`
- `apps/api/src/modules/groups/groups.controller.ts`
- `apps/api/src/modules/groups/groups.service.ts`
- `apps/api/src/modules/jobs/jobs.service.ts`

### Frontend

- Без изменений (контракт `assigned_teacher` закрыт на стороне API serializer)

---

## Оставшийся долг (не Phase 1)

1. **Lesson create pipeline** — нет `ScheduleService.assertAvailableForLesson`, auto-attendance, availability bookings
2. **LessonSeries REST API** — entities есть, controller отсутствует
3. **Teacher group students scope** — teacher видит только `assigned_teacher` студентов, не всех из group_members
4. **Courses / materials / certificates / enrollments** — row-level access не портирован
5. **Attendance mutations** — по-прежнему admin-only
6. **Payment mutations** — admin-only (read scoped для student)
7. **Enum columns в migration** — status-поля остаются `varchar`, entities используют TypeORM enum (работает, но не идентично)
8. **Groups / certificates UI** — frontend не подключён к API
9. **TeacherPayment domain** — отсутствует
10. **Jobs backup** — урезанный набор таблиц
11. **Существующие БД** — нужен отдельный patch-migration, если `InitialSchemaV2` уже применялась до Phase 1

---

## Проверка

```bash
npm run build
```

Рекомендуется на чистой БД:

```bash
npm run migration:run --prefix apps/api
```

Smoke-test: student/teacher login, profile update, teacher complete/cancel own lesson, student payments list, assigned_teacher в ответах `/students`.
