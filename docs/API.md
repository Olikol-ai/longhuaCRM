# API Reference

Base URL: `/api` (префикс задан в `main.ts`).

В production при `SERVE_FRONTEND=true` SPA и API на одном хосте. В dev Vite проксирует `/api` → `:3001`.

**Аутентификация:** `Authorization: Bearer <JWT>` для защищённых маршрутов.

**Формат тела:** JSON. `ApiSerializeInterceptor` преобразует snake_case ↔ camelCase между API и фронтендом.

**Ошибки:**

```json
{
  "statusCode": 400,
  "message": "Human readable message",
  "error": "Bad Request"
}
```

**Rate limiting:** 120 запросов / 60 сек / IP (`RATE_LIMIT_MAX`, `RATE_LIMIT_TTL`). Исключения: `/health/*`, `/webhooks/*`.

---

## Общий паттерн доменных CRUD

Большинство модулей (`students`, `teachers`, `groups`, `lessons`, …):

| Method | Path | Описание |
|--------|------|----------|
| GET | `/<domain>` | Список (с access scope по роли) |
| GET | `/<domain>/:id` | Одна запись |
| POST | `/<domain>` | Создание (часто `@Roles('admin')`) |
| PATCH | `/<domain>/:id` | Обновление |
| DELETE | `/<domain>/:id` | Удаление |
| POST | `/<domain>/filter` | Фильтр: `{ "where": { ... } }` |

---

## Auth (`/auth`)

Публичные (без JWT):

| Method | Path | Описание |
|--------|------|----------|
| POST | `/auth/login` | Вход |
| POST | `/auth/register` | Регистрация → `pending_registrations` + email-код |
| POST | `/auth/verify-registration` | Подтверждение кода → создание `users` + JWT |
| POST | `/auth/resend-registration-code` | Повторная отправка кода |
| GET | `/auth/public-settings` | Публичные настройки (auth required flag) |

С JWT:

| Method | Path | Описание |
|--------|------|----------|
| GET | `/auth/me` | Текущий пользователь |
| PATCH | `/auth/me` | Обновление профиля |
| POST | `/auth/telegram-link` | Токен привязки Telegram |

Legacy (deprecated, до PendingRegistration):

| Method | Path | Описание |
|--------|------|----------|
| POST | `/auth/verify-code` | JWT + код верификации |
| POST | `/auth/resend-code` | JWT + повтор кода |

**Logout:** серверного endpoint нет — `auth.logout()` на клиенте очищает token и редиректит на `/login`.

---

## Users (`/users`, admin)

| Method | Path | Описание |
|--------|------|----------|
| GET | `/users` | Список аккаунтов |
| GET | `/users/directory` | Аккаунты + CRM-профили без `user_id` |
| PATCH | `/users/:id` | Роль, статус, имя, телефон |
| DELETE | `/users/:id` | Удаление + orphan student profiles |

---

## Students (`/students`)

Стандартный CRUD + `POST /students/filter`.  
`PATCH /students/:id` — `admin` или `student` (свой профиль).  
При создании с email — автолинковка к `users` по email.

---

## Teachers (`/teachers`)

Стандартный CRUD + `POST /teachers/filter`.  
`PATCH /teachers/:id` — `admin` или `teacher`.

---

## Courses (`/courses`)

| Method | Path | Роли | Описание |
|--------|------|------|----------|
| GET | `/courses` | all | Шаблоны курсов |
| POST | `/courses/filter` | all | Фильтр шаблонов |
| GET | `/courses/:id` | all | Шаблон по id |
| POST | `/courses` | admin | Создать шаблон |
| PATCH | `/courses/:id` | admin | Обновить шаблон |
| DELETE | `/courses/:id` | admin | Удалить шаблон |
| GET | `/courses/enrollments` | all | Все зачисления |
| POST | `/courses/enrollments/filter` | all | Фильтр зачислений |
| GET | `/courses/enrollments/:id` | all | Зачисление |
| GET | `/courses/enrollments/:id/progress` | all | Прогресс |
| POST | `/courses/enrollments` | admin | Создать зачисление |
| PATCH | `/courses/enrollments/:id` | admin | Обновить |
| DELETE | `/courses/enrollments/:id` | admin | Удалить |

---

## Groups (`/groups`)

| Method | Path | Роли | Описание |
|--------|------|------|----------|
| GET, POST filter | `/groups` | admin, teacher | Список / фильтр |
| GET | `/groups/:id` | admin, teacher | Группа |
| GET | `/groups/:id/members` | admin, teacher | Участники |
| POST | `/groups/:id/members` | admin | Добавить участника |
| DELETE | `/groups/:id/members/:memberId` | admin | Удалить участника |
| POST, PATCH, DELETE | `/groups`, `/:id` | admin | CRUD |

---

## Lessons (`/lessons`)

| Method | Path | Роли | Описание |
|--------|------|------|----------|
| GET, POST filter | `/lessons` | all | Список / фильтр |
| GET | `/lessons/:id` | all | Урок |
| POST | `/lessons` | admin | Создать |
| PATCH | `/lessons/:id` | admin, teacher | Обновить |
| DELETE | `/lessons/:id` | admin | Удалить |
| PATCH | `/lessons/:id/complete` | admin, teacher | Завершить (balance + progress) |
| PATCH | `/lessons/:id/cancel` | admin, teacher | Отменить |
| GET | `/lessons/attendance` | all | Все записи посещаемости |
| POST | `/lessons/attendance/filter` | all | Фильтр |
| GET | `/lessons/attendance/:id` | all | Одна запись |
| POST | `/lessons/attendance` | admin | Создать |
| PATCH | `/lessons/attendance/:id` | admin, teacher | Обновить статус |
| PATCH | `/lessons/attendance/:id/present` | admin, teacher | Отметить присутствие |
| PATCH | `/lessons/attendance/:id/absent` | admin, teacher | Отметить пропуск |
| DELETE | `/lessons/attendance/:id` | admin | Удалить |

---

## Lesson series (`/lesson-series`, admin)

| Method | Path | Описание |
|--------|------|----------|
| GET | `/lesson-series` | Список |
| POST | `/lesson-series/filter` | Фильтр |
| GET | `/lesson-series/:id` | Серия |
| POST | `/lesson-series` | Создать (+ автогенерация уроков) |

---

## Schedule (`/schedule`)

Слоты доступности преподавателей (`teacher_availability_slots`):

| Method | Path | Роли | Описание |
|--------|------|------|----------|
| GET, POST filter | `/schedule` | admin, teacher | Слоты |
| GET | `/schedule/:id` | admin, teacher | Слот по id |
| POST | `/schedule` | admin | Создать слот |
| PATCH | `/schedule/:id` | admin | Обновить |
| DELETE | `/schedule/:id` | admin | Удалить |
| POST | `/schedule/bookings/filter` | admin, teacher | Фильтр бронирований |
| GET | `/schedule/teachers/:teacherId/availability` | admin, teacher, student | Расписание преподавателя |
| POST | `/schedule/teachers/:teacherId/check-availability` | admin, teacher, student | Проверка слота |

---

## Payments (`/payments`)

| Method | Path | Роли | Описание |
|--------|------|------|----------|
| GET, POST filter | `/payments` | all | Платежи |
| GET, PATCH, DELETE | `/payments/:id` | admin | CRUD платежа |
| POST | `/payments` | admin | Создать |
| GET | `/payments/shop-items` | all | Магазин |
| POST | `/payments/shop-items/filter` | all | Фильтр товаров |
| GET, POST, PATCH, DELETE | `/payments/shop-items/:id` | admin | CRUD товара |

---

## Teacher payments (`/teacher-payments`)

| Method | Path | Роли | Описание |
|--------|------|------|----------|
| GET | `/teacher-payments/my` | admin, teacher | Свои выплаты |
| GET, POST filter | `/teacher-payments` | admin | Все выплаты |
| GET, PATCH | `/teacher-payments/:id` | admin | Просмотр / отметка выплаты |

---

## Certificates (`/certificates`)

| Method | Path | Роли | Описание |
|--------|------|------|----------|
| GET, POST filter | `/certificates` | scoped | Список |
| GET | `/certificates/:id` | scoped | Сертификат |
| GET | `/certificates/:id/history` | scoped | История |
| GET | `/certificates/:id/pdf` | scoped | PDF (issued+) |
| POST | `/certificates` | admin | Создать |
| PATCH | `/certificates/:id` | admin | Обновить / выдать |
| POST | `/certificates/:id/reissue` | admin | Перевыпуск |
| DELETE | `/certificates/:id` | admin | Только draft |

---

## Materials (`/materials`)

| Method | Path | Роли | Описание |
|--------|------|------|----------|
| GET, POST filter | `/materials` | scoped | Материалы |
| GET, POST, PATCH, DELETE | `/materials`, `/:id` | admin | CRUD |
| GET, POST filter | `/materials/folders` | scoped | Папки |
| GET, POST, PATCH, DELETE | `/materials/folders/:id` | admin | CRUD папок |
| POST | `/materials/access/sync` | admin | Синхронизация доступов |

---

## Settings (`/settings`, admin)

| Method | Path | Описание |
|--------|------|----------|
| GET | `/settings` | Все настройки |
| PATCH | `/settings/:key` | Upsert `{ value, description? }` |
| GET | `/settings/welcome/page` | Welcome page content |
| PATCH | `/settings/welcome/page` | Сохранить welcome page |

---

## Notifications (`/notifications`)

Стандартный CRUD + `POST /notifications/filter`. Создание/изменение — admin.

---

## Files (`/files`)

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| POST | `/files/upload` | admin JWT | Multipart `file`, max 50 MB |
| GET | `/files/signed/:token` | — | Скачивание по signed token |
| GET | `/files/material/:materialId/url` | JWT | Signed URL для материала |

Фронтенд: `apiUpload()` в `src/api/http.js` → `POST /files/upload`.

---

## Jobs (`/jobs`, admin)

Ручной запуск фоновых задач (дублируют cron):

| Method | Path | Описание |
|--------|------|----------|
| POST | `/jobs/export-backup` | JSON backup |
| POST | `/jobs/auto-complete-lessons` | Автозавершение просроченных |
| POST | `/jobs/send-lesson-reminders` | Напоминания за 24ч |
| POST | `/jobs/send-lesson-reminders-2h` | Напоминания за 2ч |
| POST | `/jobs/revoke-all-access` | Отзыв material access |

---

## Telegram admin (`/telegram/admin`, admin)

| Method | Path | Описание |
|--------|------|----------|
| POST | `/telegram/admin/register-webhook` | Регистрация webhook |
| POST | `/telegram/admin/fix-webhook` | Перерегистрация |
| POST | `/telegram/admin/clear-updates` | Очистка + перерегистрация |
| POST | `/telegram/admin/check-bot-info` | Информация о боте |

---

## Alfa Bank (`/alfabank`)

| Method | Path | Описание |
|--------|------|----------|
| POST | `/alfabank/offline-payment-request` | JWT — заявка на офлайн-оплату |

Онлайн-оплата также через legacy `POST /functions/alfaBankInit`.

---

## Functions — legacy RPC (`/functions`)

`POST /functions/:name` — опциональный JWT, список имён в `functions.controller.ts`.

**Admin:** `exportBackup`, `checkBotInfo`, `registerTelegramWebhook`, `revokeAllAccess`, `autoCompleteExpiredLessons`, `sendLessonReminders`, `sendLessonReminders2h`, `fixWebhook`, `clearTelegramUpdates`, `sendTelegramMessage`, `tgDebug`

**Student:** `alfaBankInit`, `checkPaymentStatus`

Предпочтительно использовать REST: `/jobs/*`, `/telegram/admin/*`.

---

## Webhooks

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| POST | `/webhooks/telegram` | `X-Telegram-Bot-Api-Secret-Token` | Telegram updates |
| POST | `/webhooks/alfabank` | — | Alfa Bank callback (text/plain) |

---

## Debug (non-production)

| Method | Path | Описание |
|--------|------|----------|
| POST | `/debug/mail` | admin — тестовое письмо (отключено в production) |

---

## Health

| Method | Path | Описание |
|--------|------|----------|
| GET | `/health/live` | Liveness |
| GET | `/health/ready` | Readiness + `SELECT 1` к PostgreSQL |
| GET | `/health` | Alias для `/health/ready` |
