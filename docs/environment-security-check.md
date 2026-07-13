# Environment & Security Check

Аудит разделения окружений **development / test / production** после внедрения email policy (`isAllowedEmailDomain`).

Дата проверки: 2026-07-13.

## Сводная таблица

| Проверка | Dev | Test | Production | Статус |
|----------|-----|------|------------|--------|
| **JWT_SECRET** | Fallback `longhua-dev-secret-change-in-production` (`configuration.ts`) | `test-jwt-secret` (`setup-env.ts`) | Обязателен, без fallback (`env.validation.ts`) | OK |
| **DATABASE_URL** | `.env` → `localhost:5432/longhua` | Изолированная БД `longhua_e2e` (`setup-env.ts`) | Только production PostgreSQL (`docker-compose.prod.yml`) | OK |
| **SMTP (MAIL_*)** | Опционально из `.env` | Не настроен → mock в `createTestApp()` | Обязателен для отправки писем; без MAIL_* письма не уходят | OK |
| **ADMIN_PASSWORD** | Из `.env` (напр. `admin123`) | `TestAdmin123!` (`setup-env.ts`) | Только из secrets; пустой → admin не создаётся | OK |
| **ADMIN_EMAIL** | Default `admin@longhua.local` | `admin@test.local` (`setup-env.ts`) | Запрещены `*.local` / `test.local` (`env.validation.ts`) | OK |
| **APP_PUBLIC_URL** | Не обязателен | Не обязателен | **Обязателен**, без `localhost` (`env.validation.ts`) | OK |
| **CORS_ORIGINS** | `origin: true` (все origins) | N/A (supertest) | Только явные origins / `APP_PUBLIC_URL`; `localhost` запрещён | OK |
| **Регистрация `@test.local`** | Запрещена | Разрешена (`isAllowedEmailDomain`) | Запрещена | OK |
| **Регистрация `*.local`** | Разрешена (кроме disposable) | Разрешена | Запрещена (`*.local` в production) | OK |
| **Sender email (MAIL_FROM)** | Из `.env` или SMTP user | Mock mail | Должен быть реальный домен; `localhost` в From запрещён | WARN¹ |
| **Verification emails** | `MailService.sendVerificationCode` | Mock → always sent | Реальный SMTP; ошибка → HTTP 500, pending удаляется | OK |
| **Password reset emails** | Не реализовано | — | — | N/A |
| **Email notifications** | Канал `email` в entity; отправка не реализована | — | — | N/A |
| **Seed / bootstrap** | `UsersRepository.seedDefaultAdmin()` при старте | Тот же механизм + `admin@test.local` | Только 1 admin при `ADMIN_PASSWORD`; тестовые пользователи не создаются | OK |
| **`npm run seed`** | Скрипт отсутствует | — | — | N/A |
| **Frontend: тестовые логины** | Нет hardcoded credentials | — | — | OK |
| **Frontend: admin123** | Нет в коде | — | — | OK |
| **Frontend: localhost URL** | Vite proxy → `localhost:3001` (только dev server) | Playwright helpers | Production build использует относительный `/api` | OK |
| **Frontend: demo accounts** | Нет | — | — | OK |
| **Docker prod: test env** | — | — | `NODE_ENV=production`, без test defaults | OK |
| **Docker prod: dev volumes** | — | — | Только `uploads_data`, `backups_data` | OK |
| **Docker prod: debug** | — | — | Нет pgAdmin, нет dev mount | OK |
| **`POSTGRES_PASSWORD` default** | `postgres` в dev compose | test DB | Default `postgres` в prod compose — **сменить в .env** | WARN² |
| **Debug endpoint `/api/debug/mail`** | Admin + JWT; отправка работает | — | Возвращает `disabled in production` | OK |
| **Swagger** | Не подключён | — | — | OK |
| **Verbose errors** | HttpException body as-is | — | 500 → `Internal server error` (без stack в ответе) | OK |
| **TypeORM synchronize** | `false` | Только `E2E_SYNC_SCHEMA=true` | `false`, только migrations | OK |
| **Helmet / compression** | Выключены | — | Включены (`http-bootstrap.ts`) | OK |
| **Certificate PDF verify URL** | Fallback `http://localhost:PORT` | — | Требует `APP_PUBLIC_URL` | OK³ |

¹ Если `MAIL_FROM` не задан, `MailService` использует `noreply@localhost` — в production задайте `MAIL_FROM` явно.  
² `docker-compose.prod.yml` допускает `${POSTGRES_PASSWORD:-postgres}` — для production задайте сильный пароль.  
³ При заданном `APP_PUBLIC_URL` localhost в QR не используется.

---

## 1. Environment variables — defaults

| Variable | Dev default | Test default | Production |
|----------|-------------|--------------|------------|
| `JWT_SECRET` | `longhua-dev-secret-change-in-production` | `test-jwt-secret` | **Required** (no default) |
| `DATABASE_URL` | `.env` / `localhost:5432/longhua` | `…/longhua_e2e` | From secrets / compose |
| `MAIL_HOST` etc. | unset → mail disabled | unset → mocked in e2e | Must configure |
| `ADMIN_PASSWORD` | user `.env` | `TestAdmin123!` | secrets only |
| `ADMIN_EMAIL` | `admin@longhua.local` | `admin@test.local` | real domain required |
| `APP_PUBLIC_URL` | optional | optional | **required** |
| `CORS_ORIGINS` | open CORS | N/A | explicit list |

Источники: `apps/api/src/config/configuration.ts`, `apps/api/test/setup-env.ts`, `playwright.config.ts`, `docker-compose.prod.yml`.

---

## 2. Email policy

### Регистрация (`validateRegistrationEmail` → `isAllowedEmailDomain`)

| Домен | Dev | Test | Production |
|-------|-----|------|--------------|
| `@test.local` | ❌ | ✅ | ❌ |
| `@longhua.local` | ✅ | ✅ | ❌ (registration) |
| disposable | ❌ | ❌ | ❌ |
| real domains | ✅ | ✅ | ✅ |

### Отправка писем

| Тип | Файл | Примечание |
|-----|------|------------|
| Verification code | `mail.templates.ts` → `verificationCodeEmail` | Получатель = email пользователя |
| SMTP test | `smtpTestEmail` | Только `/api/debug/mail` (non-prod) |
| Password reset | — | Не реализовано |
| Notifications | `notification.entity.ts` | Канал `email` в модели; SMTP-отправки нет |

### Где встречается `@test.local`

Только **test tooling** (не production runtime):

- `apps/api/test/setup-env.ts`, `e2e-helpers.ts`
- E2E specs (`business-flows`, `schedule-lessons`, …)
- `playwright.config.ts`, `e2e/browser/api-helpers.ts`
- `e2e/browser/registration-email-failure.spec.ts`

### Где встречается `@longhua.local`

- Dev defaults: `configuration.ts`, `users.repository.ts` (bootstrap admin)
- **Не** в frontend
- **Запрещён** в production через `env.validation.ts` для `ADMIN_EMAIL`

### Где встречается `localhost`

| Место | Dev | Production |
|-------|-----|--------------|
| `vite.config.js` proxy | ✅ | N/A (static build) |
| `mail.service.ts` From fallback | если нет MAIL_FROM | задать MAIL_FROM |
| `certificate-pdf.service.ts` | fallback verify URL | задать APP_PUBLIC_URL |
| `docker-compose.yml` pgAdmin | `admin123` | не используется в prod |

---

## 3. Seed data

**`npm run seed` — отсутствует** в `package.json`.

Bootstrap при старте API (`UsersRepository.onModuleInit`):

| Окружение | Поведение |
|-----------|-----------|
| Development | Создаёт **одного** admin, если `ADMIN_PASSWORD` задан и email ещё нет |
| Test | То же; email обычно `admin@test.local` из `setup-env.ts` |
| Production | Создаёт **одного** admin с реальным `ADMIN_EMAIL`; тестовые ученики/учителя **не** сидятся |

Тестовые пользователи в E2E создаются явно в spec-файлах через API.

---

## 4. Frontend

| Проверка | Результат |
|----------|-----------|
| Hardcoded admin/password | ❌ не найдено (`Login.jsx` — пустые поля) |
| `admin123` | ❌ только `docker-compose.yml` pgAdmin (dev) |
| localhost в коде | ❌ только dev proxy / test helpers |
| Demo accounts | ❌ не найдено |

API base: относительный `/api` (`src/api/http.js`) — корректно для production same-origin.

---

## 5. Docker production (`docker-compose.prod.yml`)

| Проверка | Результат |
|----------|-----------|
| `NODE_ENV=production` | ✅ |
| `JWT_SECRET` required | ✅ `${JWT_SECRET:?…}` |
| `ADMIN_EMAIL` required | ✅ `${ADMIN_EMAIL:?…}` (без `longhua.local` default) |
| Dev-only services | ❌ pgAdmin отсутствует |
| Source bind mounts | ❌ только data volumes |
| `SERVE_FRONTEND=true` | ✅ intentional (SPA from API) |

---

## 6. Security surface

| Item | Dev | Test | Production |
|------|-----|------|------------|
| `/api/debug/mail` | enabled (admin JWT) | — | returns disabled |
| Swagger / OpenAPI | нет | нет | нет |
| Stack traces to client | только HttpException payload | — | generic 500 |
| Dev banner in API log | `http://localhost:PORT` in stdout | — | production log line |
| Rate limiting | on | on | on |
| Throttle skip | `/health/*`, webhooks | same | same |

---

## 7. Рекомендации перед production deploy

1. Задать в `.env`: `JWT_SECRET`, `ADMIN_EMAIL` (реальный домен), `ADMIN_PASSWORD`, `APP_PUBLIC_URL`, `CORS_ORIGINS`, `MAIL_*`, `POSTGRES_PASSWORD`.
2. Убедиться, что `MAIL_FROM` — реальный адрес (не `noreply@localhost`).
3. Проверить QR/verify URL сертификатов с production `APP_PUBLIC_URL`.
4. Не использовать `docker-compose.yml` (dev) на production — только `docker-compose.prod.yml`.

---

## 8. Проверки после изменений

```bash
npm run build
npm run test:e2e
```

Дополнительно (browser):

```bash
npx playwright test e2e/browser/registration-email-failure.spec.ts
```

---

## Связанные файлы

- `apps/api/src/common/security/email-validation.ts` — `isAllowedEmailDomain()`
- `apps/api/src/config/env.validation.ts` — production guards
- `apps/api/test/setup-env.ts` — test isolation
- `apps/api/test/email-domain.e2e-spec.ts` — automated policy tests
