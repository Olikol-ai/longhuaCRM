# API Reference

Base URL: `/api` (production — тот же хост при `SERVE_FRONTEND=true`).

Аутентификация: `Authorization: Bearer <JWT>` (кроме public/auth и webhooks).

## Auth

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| POST | `/auth/register` | — | Регистрация |
| POST | `/auth/login` | — | Вход |
| POST | `/auth/verify` | — | Подтверждение кода |
| GET | `/auth/me` | JWT | Текущий пользователь |
| PATCH | `/auth/profile` | JWT | Профиль |
| POST | `/auth/logout` | JWT | Выход (client-side token clear) |

## Users (admin)

| Method | Path | Описание |
|--------|------|----------|
| GET | `/users` | Список аккаунтов |
| GET | `/users/directory` | Аккаунты + профили без user_id |
| PATCH | `/users/:id` | Обновление роли/статуса |
| DELETE | `/users/:id` | Удаление + orphan profiles |

## Students / Teachers

Стандартный CRUD + `POST /<entity>/filter` для списков с фильтрами.

- `/students`, `/teachers`
- Students: баланс уроков, привязка к user по email

## Courses

- `/courses` — шаблоны курсов
- `/courses/enrollments` — зачисления
- `/courses/enrollments/:id/progress` — прогресс

## Groups

`/groups` — CRUD, members

## Lessons

| Path | Описание |
|------|----------|
| `/lessons` | CRUD уроков |
| `/lessons/:id/complete` | Завершение (balance + progress) |
| `/lessons/attendance` | Посещаемость |
| `/lessons/attendance/:id` | PATCH статуса |

## Lesson series

`/lesson-series` — серии с автогенерацией уроков

## Schedule

`/schedule/availability`, `/schedule/bookings` — слоты и бронирования

## Payments

`/payments`, `/payments/shop-items` — платежи и магазин

## Teacher payments

- `GET /teacher-payments` — admin
- `GET /teacher-payments/my` — teacher self-view

## Certificates

`/certificates` — CRUD, `POST /:id/reissue`, history, PDF download

## Materials

`/materials`, folders, access, links

## Settings

`GET/PATCH /settings` — app settings (admin)

## Notifications

`/notifications` — in-app

## Files

`POST /files/upload` — secure upload (admin)
`GET /files/:token` — signed download

## Functions (RPC-style)

`POST /functions/:name` — серверные операции (backup export, …)

## Webhooks

| Path | Описание |
|------|----------|
| POST `/webhooks/telegram` | Telegram updates |
| POST `/webhooks/alfabank` | Alfa Bank callback |

## Health

| Path | Описание |
|------|----------|
| GET `/health/live` | Liveness |
| GET `/health/ready` | Readiness + DB |

## Формат ошибок

```json
{
  "statusCode": 400,
  "message": "Human readable message",
  "error": "Bad Request"
}
```

Validation errors: `message` может быть массивом.

## Формат данных

API interceptor преобразует snake_case ↔ camelCase. Фронтенд работает в camelCase; БД — snake_case.

## Rate limiting

По умолчанию 120 запросов / 60 сек / IP. Webhooks и health не лимитируются.

При 429: заголовок `Retry-After`, тело с `retryAfter`.
