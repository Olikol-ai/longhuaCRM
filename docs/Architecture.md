# Architecture

LonghuaCRM — монорепозиторий CRM для языковой школы. В production один процесс NestJS может обслуживать REST API и собранный SPA (`SERVE_FRONTEND=true`).

## Высокоуровневая схема

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                        │
│  src/ — Vite 6, React Router 6, TanStack Query, Tailwind    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP /api/*
┌──────────────────────────▼──────────────────────────────────┐
│  NestJS 11 API (apps/api)                                     │
│  JWT + Roles │ Domain access services │ Throttler             │
└──────────────────────────┬──────────────────────────────────┘
                           │ TypeORM 0.3
┌──────────────────────────▼──────────────────────────────────┐
│  PostgreSQL 17                                               │
└─────────────────────────────────────────────────────────────┘

Интеграции: SMTP (Nodemailer), Telegram Bot (webhook), Alfa Bank (опционально)
```

## Хранение данных

- CRM entities — **relational** (PostgreSQL + TypeORM migrations).
- Teacher availability — таблица `teacher_availability_slots` (не `slots jsonb`).
- Assessment — snapshot-таблицы `assessment_*_snapshots` (не JSON blob).
- **JSONB не используется** для бизнес-сущностей.

Подробно: [architecture/storage-policy.md](./architecture/storage-policy.md), [Database.md](./Database.md).

## Структура репозитория

```
LongHuaCRM/
├── apps/api/
│   ├── src/
│   │   ├── modules/       # Доменные NestJS-модули
│   │   ├── database/      # migrations, entity-registry, data-source
│   │   ├── config/        # configuration.ts, env.validation.ts
│   │   ├── common/        # guards, filters, interceptors, access/
│   │   └── bootstrap/     # http-bootstrap.ts (CORS, helmet, shutdown)
│   ├── test/              # Jest e2e (9 suites, 36 tests)
│   └── scripts/           # integrity-audit.ts
├── src/                   # React frontend
├── e2e/browser/           # Playwright (8 specs)
├── scripts/               # backup-db, restore-db
├── docs/                  # Документация
├── docker-compose.yml     # Dev: postgres + pgadmin
├── docker-compose.prod.yml
├── Dockerfile
└── .env.example
```

## Backend-модули (app.module.ts)

| Модуль | Назначение |
|--------|------------|
| `auth` | JWT, регистрация, `pending_registrations`, onboarding |
| `users` | Аккаунты, `GET /users/directory` |
| `students` / `teachers` | CRM-профили, баланс уроков |
| `courses` | `course_templates`, `enrollments`, прогресс |
| `groups` | Группы и участники |
| `lessons` | Уроки, `attendance_records`, complete/cancel |
| `lesson-series` | Серии с автогенерацией уроков |
| `schedule` | `teacher_availability_slots`, bookings |
| `payments` | Платежи, `shop_items` |
| `teacher-payments` | Выплаты преподавателям |
| `certificates` | Сертификаты, history, PDF |
| `materials` | Папки, материалы, access, links |
| `notifications` | In-app уведомления |
| `settings` | `app_settings`, welcome page |
| `files` (`SecureFilesModule`) | Upload + signed URLs |
| `mail` | SMTP |
| `telegram` | Bot service + `telegram/admin` REST |
| `webhooks` | Telegram + Alfa Bank callbacks |
| `alfabank` | Offline payment request |
| `jobs` | Cron + `POST /jobs/*` |
| `functions` | Legacy RPC `POST /functions/:name` |
| `audit` | `audit_logs` |
| `health` | `/health/live`, `/health/ready` |
| `spa` | SPA fallback routing (если `SERVE_FRONTEND`) |

## Потоки данных

### Аутентификация
`POST /auth/login` → JWT в `localStorage` (`longhua_access_token`) → `Authorization: Bearer`.

Регистрация: `register` → email-код → `verify-registration` → `users` (onboarding) → admin назначает роль → `RoleEntitySyncService`.

### Урок и прогресс
`PATCH /lessons/:id/complete` → `finalizeLessonCompletion()` (transaction, row lock) → balance → `EnrollmentProgressService` → при завершении курса — draft certificate.

### Платёж
`PaymentsService` с pessimistic lock → `students.lesson_balance`.

### Cron (`ENABLE_CRON=true`)
- `JobsService`: 24h reminders (12:00), 2h reminders + auto-complete (каждую минуту)
- `PendingRegistrationCleanupService`: каждые 15 мин

## Принципы

1. Реляционная модель — без `json_record` для бизнес-сущностей
2. Один module на домен; access в `common/access/`
3. Единый API-клиент фронтенда: `src/api/`
4. Миграции, не `synchronize` (кроме test e2e)
5. Критические операции — transaction + pessimistic locks

## Масштабирование

См. [Production-Readiness.md](./Production-Readiness.md).
