# Backend

NestJS 11 + TypeORM + PostgreSQL. Точка входа: `apps/api/src/main.ts`.

## Запуск

```bash
cd apps/api && npm install
npm run start:dev          # watch mode
npm run start:prod         # production (после build)
```

Из корня: `npm run dev` (миграции + API + Vite).

## Слои модуля

Типичная структура доменного модуля:

```
modules/<domain>/
  <domain>.module.ts
  <domain>.controller.ts   # REST, guards, DTO
  <domain>.service.ts      # бизнес-логика
  <domain>.repository.ts   # TypeORM queries (опционально)
  entities/
  dto/
```

## Паттерны

### Контроллер
- `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin'|'teacher'|'student')`
- DTO с `class-validator`
- `@CurrentUser()` для actor в audit

### Сервис
- Транзакции для мульти-табличных изменений: `this.dataSource.transaction()`
- Блокировки для race-sensitive операций: `lock: { mode: 'pessimistic_write' }`
- Access checks через `*AccessService` из `common/access/`

### Ответ API
- `ApiSerializeInterceptor` — camelCase ↔ snake_case для фронтенда
- Ошибки: `AllExceptionsFilter` — единый JSON `{ statusCode, message, ... }`

### Аутентификация
- JWT Passport strategy
- Роли: `admin`, `teacher`, `student`, `pending`
- `RoleEntitySyncService` — синхронизация профилей при смене роли

## Production middleware

`apps/api/src/bootstrap/http-bootstrap.ts`:
- **Helmet** + **compression** (только `NODE_ENV=production`)
- **CORS** из `CORS_ORIGINS` или `APP_PUBLIC_URL`
- **Graceful shutdown** на SIGTERM/SIGINT
- **Rate limiting** — `@nestjs/throttler` (webhooks и health исключены)

## Health endpoints

| Endpoint | Назначение |
|----------|------------|
| `GET /api/health/live` | Liveness — процесс жив |
| `GET /api/health/ready` | Readiness — + проверка PostgreSQL |
| `GET /api/health` | Alias для ready |

## Cron jobs

`ENABLE_CRON=true` (по умолчанию):
- `JobsService` — напоминания об уроках
- `PendingRegistrationCleanupService` — очистка неподтверждённых регистраций

## Файлы

`SecureFilesModule` — загрузка в `uploads/`, signed URLs, лимит 50 MB, allowlist расширений.

## Тестирование

```bash
npm run test:e2e    # 36 тестов, Jest + supertest
```

Требуется `DATABASE_URL` и применённые миграции.

## Создание CRUD (чеклист)

1. Entity + migration
2. `CreateDto`, `UpdateDto`, `FilterDto` (если нужен filter endpoint)
3. Service: `findAll`, `findById`, `create`, `update`, `delete` + access scope
4. Controller: REST paths согласно существующим модулям (`GET`, `POST`, `PATCH`, `DELETE`, `POST filter`)
5. Зарегистрировать module в `app.module.ts`
6. Frontend API client
7. E2E test для критичного flow

## Логирование

- NestJS Logger в bootstrap и сервисах
- `LoggingInterceptor` — HTTP method, path, status, duration
- `LOG_LEVEL` в env (планируется расширение structured logging)
