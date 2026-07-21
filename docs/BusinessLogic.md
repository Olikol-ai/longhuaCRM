# Business Logic

Ключевые бизнес-процессы Longhua Academy. Реализация — в NestJS services (`apps/api/src/modules/`).

## Роли

| Роль DB | UI / onboarding | Возможности |
|---------|-----------------|-------------|
| `admin` | `active` | Пользователи, финансы, сертификаты, настройки, все CRUD |
| `teacher` | `active` | Расписание, посещаемость, материалы, `/teacher-payments/my` |
| `student` | `active` | Курсы, уроки, материалы, свой профиль |
| `pending` / `user` | `awaiting_role` | Ожидание назначения роли админом |
| — | `needs_verification` | Регистрация, код на email (`/auth/pending-approval`) |

## Регистрация и onboarding

1. `POST /auth/register` → запись в `pending_registrations` + код на email (SMTP).
2. `POST /auth/verify-registration` → `verifyAndCreateUser()` → `users` + JWT. Пользователь в onboarding (`awaiting_role`).
3. Admin в «Пользователи» назначает роль (`PATCH /users/:id`) → `RoleEntitySyncService` создаёт/связывает student или teacher profile.
4. `POST /students` с email → автолинковка к `users` по email (если аккаунт существует).
5. `GET /users/directory` — аккаунты + профили без `user_id` («Профиль без аккаунта»).

## Учебный цикл

```
course_templates → enrollments (student + course)
       ↓
lesson_series / POST /lessons
       ↓
attendance_records (enrolled → attended / missed / missed_no_notice)
       ↓
PATCH /lessons/:id/complete → lesson_balance −1, enrollment progress
       ↓
completedLessons >= totalLessons → enrollment completed → draft certificate
       ↓
Admin PATCH /certificates/:id (status: issued)
```

## Баланс уроков

- `students.lesson_balance` — оплаченные уроки
- Списание при complete урока (`attendance_records.balance_deducted`)
- Пополнение: `POST /payments` (admin) или Alfa Bank (`functions/alfaBankInit`)
- Идемпотентность: locks + flags в `StudentBalanceService`, `LessonsService`

## Посещаемость

Статусы: `enrolled`, `attended`, `missed`, `missed_no_notice`, `cancelled`.

`missed` / `missed_no_notice` → `enrollments.missed_lessons++` через `EnrollmentProgressService`.

Shortcuts: `PATCH .../present`, `PATCH .../absent`.

## Сертификаты

Статусы: `draft` → `issued` → `sent` | `revoked` | `duplicate` (reissue).

Выдача (`draft` → `issued`) требует завершённого enrollment.  
Unique: `registration_number`, `(blank_series, blank_number)`.  
PDF: `GET /certificates/:id/pdf` (не для draft/revoked).

## Платежи

- FK на `students`; опционально `shop_items`, `enrollments`
- Update/delete с pessimistic lock — защита от двойного зачисления баланса

## Расписание

- `teacher_availability_slots` + `teacher_availability_bookings`
- При `POST /lessons`: `assertAvailableForLesson`, `assertNoScheduleConflicts`
- Lesson series пропускает субботу/воскресенье

## Уведомления и напоминания

- In-app: `notifications`
- Email: коды регистрации (`MailService`)
- Telegram: cron reminders (`JobsService`), bot webhook

## Cron (при `ENABLE_CRON=true`)

| Задача | Когда |
|--------|-------|
| Напоминания 24ч | Ежедневно 12:00 (`REMINDER_TIMEZONE`) |
| Напоминания 2ч + auto-complete | Каждую минуту |
| Cleanup pending registrations | Каждые 15 мин |

## Аудит

`audit_logs` — смена ролей, верификация регистрации, критичные admin-действия.

## Инварианты

1. Один active enrollment на пару student/course (partial unique).
2. Один draft certificate на пару student/course.
3. Один active issued/sent certificate на пару student/course.
4. Бизнес-данные только в реляционных таблицах.
5. Критические PATCH — transaction + row locks.

Доменные заметки: `docs/domain/*.md`.
