# Development

## Требования

- Node.js 22+
- npm 10+
- Docker (PostgreSQL) или локальный PostgreSQL 17
- Git

Playwright (опционально): `npx playwright install chromium`

## Первый запуск

```bash
git clone <repo>
cd LongHuaCRM
npm install
cd apps/api && npm install && cd ../..

cp .env.example .env
# DATABASE_URL, ADMIN_PASSWORD (для bootstrap admin)

docker compose up -d postgres
npm run migration:run
npm run dev
```

| URL | Сервис |
|-----|--------|
| http://localhost:5173 | Vite dev (proxy `/api` → :3001) |
| http://localhost:3001 | NestJS API |
| http://localhost:5050 | pgAdmin (`admin@example.com` / `admin123`) |

Admin login: `ADMIN_EMAIL` / `ADMIN_PASSWORD` из `.env` (создаётся при первом старте, если пароль задан).

## Ежедневная работа

```bash
docker compose up -d postgres
npm run dev
```

| Команда | Описание |
|---------|----------|
| `npm run dev:server` | migration:run + API watch (без Vite) |
| `npm run dev:client` | Только Vite |

## Все npm-скрипты (корень)

| Команда | Описание |
|---------|----------|
| `npm run build` | API + frontend production build |
| `npm run build:api` | Только NestJS build |
| `npm run build:client` | Только Vite → `dist/` |
| `npm run clean:api` | Удалить `apps/api/dist` |
| `npm run start` | Production API |
| `npm run start:production` | build + production API |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run typecheck` | `tsc -p jsconfig.json` |
| `npm run preview` | Vite preview |
| `npm run migration:run` | Применить миграции |
| `npm run migration:revert` | Откатить последнюю миграцию |
| `npm run test:e2e` | Jest API e2e (36 tests) |
| `npm run test:browser` | Playwright (8 specs) |
| `npm run test:browser:report` | Merge Playwright issues |
| `npm run db:backup` | pg_dump через DATABASE_URL |
| `npm run db:backup:docker` | Backup через контейнер postgres |
| `npm run db:restore` | restore-db.sh (интерактивно) |

## Миграции

- В dev `npm run dev:server` запускает `migration:run` перед API.
- API также применяет миграции при старте (`migrationsRun: true`), кроме `E2E_SYNC_SCHEMA=true`.
- **Не полагаться на `synchronize`** — схема только через migrations.

## Workflow новой фичи

1. Migration (если меняется схема)
2. Backend: entity → service → controller → e2e
3. Frontend: `src/api/` → page/component
4. `npm run build && npm run test:e2e`
5. Commit

## Отладка

| Что | Как |
|-----|-----|
| API logs | Консоль (`LoggingInterceptor`) |
| DB health | `GET http://localhost:3001/api/health/ready` |
| Test mail | `POST /api/debug/mail` (admin, не production) |
| JWT token | `localStorage.longhua_access_token` |
| Integrity | `npx ts-node --project apps/api/tsconfig.json apps/api/scripts/integrity-audit.ts` |

## IDE

Cursor/VSCode + ESLint. Правила: `.cursor/rules/project-rules.mdc`.

## Частые проблемы

| Проблема | Решение |
|---------|---------|
| `DATABASE_URL` / connection refused | `docker compose up -d postgres` |
| Migration failed | `migration:revert`, исправить, `migration:run` |
| Blank SPA | Console errors; проверить `src/api/index.js` imports |
| E2E fail | PostgreSQL + migrations |
| Playwright fail | `npx playwright install chromium` |
