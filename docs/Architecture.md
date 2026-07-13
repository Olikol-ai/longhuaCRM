# Architecture

LonghuaCRM — монорепозиторий CRM для языковой школы. Один процесс API в production может обслуживать и REST API, и собранный SPA.

## Высокоуровневая схема

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                        │
│  src/ — Vite, React Router, TanStack Query, Tailwind        │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP /api/*
┌──────────────────────────▼──────────────────────────────────┐
│  NestJS API (apps/api)                                        │
│  Modules: auth, users, students, lessons, payments, …         │
│  Guards: JWT + Roles │ Access services per domain             │
└──────────────────────────┬──────────────────────────────────┘
                           │ TypeORM
┌──────────────────────────▼──────────────────────────────────┐
│  PostgreSQL 17                                               │
│  Relational entities only (no json_record for business data) │
└─────────────────────────────────────────────────────────────┘

Внешние интеграции: SMTP, Telegram Bot, Alfa Bank (опционально)
```

## Структура репозитория

```
LongHuaCRM/
├── apps/api/           # NestJS backend
│   └── src/
│       ├── modules/    # Доменные модули
│       ├── database/   # Миграции, entity registry
│       ├── config/     # Env validation
│       ├── common/     # Guards, filters, interceptors, access
│       └── bootstrap/  # HTTP middleware (CORS, helmet, shutdown)
├── src/                # React frontend
│   ├── api/            # Единый HTTP-клиент
│   ├── pages/          # Страницы
│   ├── components/     # UI-компоненты
│   └── lib/            # Auth, routing, query client
├── e2e/browser/        # Playwright E2E
├── apps/api/test/      # Jest API E2E
├── scripts/            # backup/restore БД
├── docs/               # Документация
├── docker-compose.yml  # Dev: PostgreSQL + pgAdmin
└── docker-compose.prod.yml + Dockerfile
```

## Backend-модули

| Модуль | Назначение |
|--------|------------|
| `auth` | JWT, регистрация, верификация email, onboarding |
| `users` | Аккаунты, directory (профили без user_id) |
| `students` / `teachers` | CRM-профили, баланс уроков |
| `courses` | Шаблоны курсов, enrollments, прогресс |
| `groups` | Учебные группы |
| `lessons` | Уроки, посещаемость, завершение |
| `lesson-series` | Серии уроков с автогенерацией |
| `schedule` | Слоты доступности, бронирования |
| `payments` | Платежи учеников, магазин |
| `teacher-payments` | Выплаты преподавателям |
| `certificates` | Сертификаты, история, PDF |
| `materials` | Материалы, папки, доступы |
| `notifications` | In-app уведомления |
| `settings` | Настройки приложения |
| `files` | Защищённая загрузка файлов |
| `telegram` / `webhooks` | Telegram и Alfa Bank webhooks |
| `jobs` | Cron: напоминания, backup export |
| `mail` | SMTP |
| `audit` | Audit log |
| `health` | Liveness / readiness |

## Потоки данных (ключевые)

### Аутентификация
`Login` → `POST /api/auth/login` → JWT в localStorage → `Authorization: Bearer` на всех запросах.

### Урок и прогресс
`Lesson complete` → `LessonsService.finalizeLessonCompletion()` (transaction) → списание баланса → `EnrollmentProgressService` → при завершении курса — draft сертификата.

### Платёж
`Payment create/update` → `PaymentsService` (lock) → обновление `students.lesson_balance`.

### Пользователи
`GET /api/users/directory` объединяет `users`, `students`, `teachers` для вкладки «Аккаунты».

## Принципы архитектуры

1. **Реляционная модель** — бизнес-сущности только в PostgreSQL через TypeORM relations.
2. **Модульные границы** — один NestJS module на домен; access services в `common/access/`.
3. **Единый API-клиент** — фронтенд не вызывает fetch напрямую, только `src/api/`.
4. **Миграции обязательны** — `synchronize: false` в production.
5. **Идемпотентность** — критические операции (complete lesson, payment, progress) в транзакциях с блокировками.

## Масштабирование (кратко)

| Масштаб | Подход |
|---------|--------|
| до 1 000 студентов | Один инстанс API + PostgreSQL, индексы, пагинация |
| до 10 000 | Read replicas, CDN для static, отдельный worker для cron |
| до 100 000 | Шардирование не требуется на старте; горизонтальное масштабирование stateless API, managed PostgreSQL, object storage для файлов |

Подробнее: [Production-Readiness.md](./Production-Readiness.md).
