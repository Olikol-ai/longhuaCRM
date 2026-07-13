# Development

## Требования

- Node.js 22+
- npm 10+
- Docker (для PostgreSQL) или локальный PostgreSQL 17
- Git

Опционально: Playwright browsers (`npx playwright install chromium`)

## Первый запуск

```bash
git clone <repo>
cd LongHuaCRM
npm install
cd apps/api && npm install && cd ../..

cp .env.example .env
# Отредактируйте DATABASE_URL, ADMIN_PASSWORD

docker compose up -d postgres
npm run migration:run
npm run dev
```

- Frontend: http://localhost:5173 (Vite proxy → API)
- API: http://localhost:3001
- pgAdmin: http://localhost:5050 (из docker-compose)

## Ежедневная работа

```bash
docker compose up -d postgres   # если не запущен
npm run dev                     # API + frontend
```

Только API: `npm run dev:server`  
Только frontend: `npm run dev:client`

## Команды

| Команда | Описание |
|---------|----------|
| `npm run build` | API + frontend production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | JS/TS check (frontend) |
| `npm run migration:run` | Применить миграции |
| `npm run migration:revert` | Откатить последнюю |
| `npm run test:e2e` | API E2E (36 tests) |
| `npm run test:browser` | Playwright UI E2E |
| `npm run db:backup:docker` | Backup БД |

## Структура веток

- `main` / `refactor/nestjs` — основная разработка
- Feature branches → PR → merge

## Добавление фичи (workflow)

1. Миграция (если меняется схема)
2. Backend: entity → service → controller → e2e test
3. Frontend: api client → page/component
4. `npm run build && npm run test:e2e`
5. Commit с понятным сообщением

## Отладка API

- Логи в консоли (`LoggingInterceptor`)
- `GET /api/health/ready` — проверка БД
- Mail debug: `debug/mail` (только non-production)

## Отладка frontend

- React DevTools
- Network tab — все запросы на `/api/*`
- Token: `localStorage.longhua_access_token`

## IDE

Рекомендуется Cursor/VSCode с ESLint extension. Правила проекта: `.cursor/rules/project-rules.mdc`.

## Частые проблемы

| Проблема | Решение |
|---------|---------|
| `DATABASE_URL` invalid | Проверить docker postgres, порт 5432 |
| Миграция failed | `migration:revert`, исправить, `migration:run` |
| Blank page | Проверить console, импорты в `src/api/index.js` |
| E2E fail | PostgreSQL запущен, миграции применены |
