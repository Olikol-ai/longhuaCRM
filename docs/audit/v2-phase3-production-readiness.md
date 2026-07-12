# LongHuaCRM v2 — Phase 3 Production Readiness

**Date:** 2026-07-12  
**Scope:** Frontend migration, LessonSeries, enrollment progress, auto certificate draft, teacher payments self-view  
**Build:** `npm run build` — passes

---

## Реализовано

### 1. Frontend migration

**Аудит:** все domain API (`students`, `teachers`, `courses`, `groups`, `lessons`, `payments`, `materials`, `certificates`) подключены через `src/api/index.js`. Добавлены:

- `api.teacherPayments` (+ `my()`)
- `api.lessonSeries`

**Новые UI (admin):**

| Страница | Маршрут | API |
|----------|---------|-----|
| Groups | `/Groups`, вкладка AdminPanel | `api.groups` |
| Certificates | `/Certificates`, вкладка AdminPanel | `api.certificates` |
| Attendance | `/Attendance`, вкладка AdminPanel | `api.lessons.attendance` |
| Teacher Payments | AdminPanel + `/TeacherPayments` | `api.teacherPayments` |
| Lesson Series | вкладка AdminPanel | `api.lessonSeries` |

**Teacher:** `/TeacherPayments` — просмотр своих выплат (`GET /teacher-payments/my`).

**Navigation:** пункты в `Layout.jsx` (admin: Groups, Certificates, Attendance; teacher: My Payments).

**Routing:** guards в `lib/routing.js`, routes в `App.jsx`.

---

### 2. LessonSeries domain module

Модуль `lesson-series`:

| Field | Column |
|-------|--------|
| id | uuid |
| course_id | FK course_templates |
| group_id | FK groups |
| teacher_id | FK teachers |
| start_date | date |
| frequency | weekly / biweekly |
| total_lessons | int |
| status | active / paused / stopped |

Также: `start_time`, `duration`, `lesson_format`, `meeting_link`, `notes` (для генерации уроков).

**REST:** `GET`, `POST /filter`, `GET :id`, `POST /lesson-series`

**При создании:** автогенерация уроков через `LessonsService.create()` с проверкой:
- выходные (суббота/воскресенье пропускаются)
- доступность преподавателя
- конфликты расписания
- недоступные даты попадают в `skippedDates`

---

### 3. Enrollment progress

- Поле `missed_lessons` в `EnrollmentEntity`
- `EnrollmentProgressService`:
  - `completedLessons` — инкремент при complete урока (если lesson привязан к series с course_id)
  - `missedLessons` — инкремент при attendance `missed` / `missed_no_notice`
  - `remainingLessons` = total − completed − missed
- `GET /courses/enrollments/:id/progress`
- `findEnrollmentById` возвращает `remainingLessons`

---

### 4. Auto certificate draft

При `completedLessons >= totalLessons`:
- enrollment → `status: completed`
- `CertificateDraftService.createDraftForEnrollment()` — создаёт certificate со статусом **draft** (не issued)
- запись в `certificate_history` (`auto_draft_created`)
- idempotent по `(student_id, course_id)`

Выдача вручную: admin UI «Выдать» → `status: issued`.

---

### 5. Teacher payments self-view

- `GET /teacher-payments/my` — teacher видит только свои выплаты
- Admin: `GET /teacher-payments` (полный список) + mark paid

---

## Изменённые / новые файлы

### Backend

- `apps/api/src/database/migrations/1733000000000-Phase3ProductionReadiness.ts`
- `apps/api/src/database/migrations/1731000000000-InitialSchemaV2.ts` (lesson_series, missed_lessons)
- `apps/api/src/modules/lesson-series/**` (new module)
- `apps/api/src/modules/courses/enrollment-progress.service.ts`
- `apps/api/src/modules/courses/courses.service.ts`, `courses.controller.ts`, `courses.module.ts`
- `apps/api/src/modules/certificates/certificate-draft.service.ts`
- `apps/api/src/modules/lessons/lessons.service.ts`, `lessons.module.ts`
- `apps/api/src/modules/teacher-payments/teacher-payments.controller.ts`, `teacher-payments.service.ts`
- `apps/api/src/modules/lesson-series/entities/lesson-series.entity.ts` (moved from schedule)
- `apps/api/src/database/entity-registry.ts`
- `apps/api/src/app.module.ts`
- Deleted: `schedule/entities/lesson-series.entity.ts`

### Frontend

- `src/api/teacher-payments.api.js`, `lesson-series.api.js`, `index.js`
- `src/pages/Groups.jsx`, `Certificates.jsx`, `Attendance.jsx`, `TeacherPayments.jsx`, `LessonSeriesAdmin.jsx`
- `src/pages/AdminPanel.jsx`, `Layout.jsx`, `App.jsx`, `lib/routing.js`

---

## TODO (оставшийся технический долг)

1. **Individual lessons → enrollment progress** — progress обновляется только для уроков из series с `course_id`
2. **Lesson cancel → booking cancelled** — booking остаётся active
3. **Certificate PDF generation** — только CRUD, без файла
4. **LessonSeries UI в Schedule** — только AdminPanel, не в основном календаре
5. **Groups members remove** — UI только add, нет remove
6. **Enrollment progress UI** — endpoint есть, отдельной страницы нет
7. **E2E / smoke tests** — не автоматизированы
8. **Migration on existing DB** — применить `1733000000000-Phase3ProductionReadiness`

---

## Проверка

```bash
npm run build
npm run migration:run --prefix apps/api
```

Smoke-test admin cycle:
1. Создать группу → добавить учеников
2. Создать lesson series → уроки + attendance
3. Complete урок → teacher payment + enrollment progress
4. Завершить курс → certificate draft
5. Выдать certificate (draft → issued)
6. Teacher login → `/TeacherPayments` — свои выплаты
