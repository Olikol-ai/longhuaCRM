# Backend

NestJS 11 + TypeORM 0.3 + PostgreSQL. Точка входа: `apps/api/src/main.ts`.

## Запуск

```bash
cd apps/api && npm install
npm run start:dev          # nest --watch
npm run start:prod         # node dist/main.js (после nest build)
```

Из корня:

| Команда | Действие |
|---------|----------|
| `npm run dev` | `migration:run` + API watch + Vite |
| `npm run dev:server` | `migration:run` + API watch |
| `npm run start` | production API |
| `npm run start:production` | `build` + production API |

## Структура модуля

```
modules/<domain>/
  <domain>.module.ts
  <domain>.controller.ts
  <domain>.service.ts
  <domain>.repository.ts   # опционально
  entities/
  dto/
```

## Паттерны

### Контроллер
- `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin'|'teacher'|'student')`
- DTO с `class-validator`
- `@CurrentUser()` → `JwtPayload` для audit и access scope

### Сервис
- `this.dataSource.transaction()` для мульти-табличных изменений
- `lock: { mode: 'pessimistic_write' }` на hot paths (lessons complete, payments, certificates, users, attendance)
- Domain access: `*AccessService` в `common/access/`

### Ответы и ошибки
- `ApiSerializeInterceptor` — snake_case ↔ camelCase
- `AllExceptionsFilter` — `{ statusCode, message, error }`
- `LoggingInterceptor` — method, path, status, duration

### Роли в БД
`admin`, `teacher`, `student`, `pending`, `user` (без роли).  
Onboarding states на клиенте: `needs_verification`, `awaiting_role`, `active`, `blocked`.

## Production middleware

`apps/api/src/bootstrap/http-bootstrap.ts` (только при `NODE_ENV=production` для helmet/compression):

| Feature | Реализация |
|---------|------------|
| Helmet | Security headers (CSP отключён для SPA) |
| Compression | gzip |
| CORS | `CORS_ORIGINS` или `APP_PUBLIC_URL` |
| Trust proxy | `TRUST_PROXY=true` |
| Graceful shutdown | SIGTERM / SIGINT → `app.close()` |
| Rate limit | `@nestjs/throttler` global guard |

Исключения throttler: `@SkipThrottle()` на `HealthController`, `WebhooksController`.

## Health

| Endpoint | Назначение |
|----------|------------|
| `GET /api/health/live` | Liveness |
| `GET /api/health/ready` | Readiness + PostgreSQL |
| `GET /api/health` | = ready |

## Миграции при старте

`TypeOrmModule` в `app.module.ts`:

- `migrationsRun: process.env.E2E_SYNC_SCHEMA !== 'true'` — миграции применяются при каждом старте API
- `synchronize: true` только при `NODE_ENV=test` + `E2E_SYNC_SCHEMA=true`

## Cron (`ENABLE_CRON`, default true)

| Service | Schedule | Задачи |
|---------|----------|--------|
| `JobsService` | `0 12 * * *` | Напоминания за 24ч |
| `JobsService` | `* * * * *` | Напоминания за 2ч, auto-complete expired lessons |
| `PendingRegistrationCleanupService` | `*/15 * * * *` | Очистка `pending_registrations` |

Ручной запуск: `POST /api/jobs/*` или legacy `POST /api/functions/:name`.

## Файлы

`SecureFilesModule`:
- `POST /api/files/upload` — admin, multipart, 50 MB, allowlist расширений
- Диск: `uploads/` (volume в docker-compose.prod)
- Signed URLs: `/api/files/signed/:token`

## Тестирование

```bash
npm run test:e2e    # из корня; 9 suites, 36 tests
```

Требуется `DATABASE_URL`, PostgreSQL, применённые миграции (или `E2E_SYNC_SCHEMA`).

Сьюты: `users-directory`, `certificates-validation`, `business-flows`, `schedule-lessons`, `lesson-series`, `payments-integrity`, `files-upload`, `lesson-completion-idempotency`, `validation`.

## Создание CRUD

1. Entity + migration + `entity-registry.ts`
2. DTOs (`Create`, `Update`, `FilterQuery`)
3. Service с access scope
4. Controller: GET, GET :id, POST, PATCH :id, DELETE :id, POST filter
5. Module → `app.module.ts`
6. `src/api/<domain>.api.js`
7. E2E test при необходимости

## Логирование

NestJS Logger + `LoggingInterceptor`. `LOG_LEVEL` в env (расширение structured logging — в [Technical-Debt.md](./Technical-Debt.md)).
