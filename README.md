# Longhua CRM

CRM-платформа для языковой школы **Longhua Chinese**: ученики, преподаватели, расписание, платежи, сертификаты, материалы.

| Слой | Стек |
|------|------|
| Frontend | React 18, Vite, Tailwind, shadcn/ui |
| Backend | NestJS 11, TypeORM |
| Database | PostgreSQL 17 |
| Auth | JWT |

## Быстрый старт

```bash
npm install && cd apps/api && npm install && cd ../..
cp .env.example .env          # настройте DATABASE_URL, ADMIN_PASSWORD
docker compose up -d postgres
npm run migration:run
npm run dev
```

| URL | Сервис |
|-----|--------|
| http://localhost:5173 | Frontend (dev) |
| http://localhost:3001 | API |
| http://localhost:5050 | pgAdmin |

Вход admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` из `.env`.

## Production

```bash
npm run build
docker compose -f docker-compose.prod.yml up -d --build
```

Подробно: [docs/Deployment.md](docs/Deployment.md) · [docs/Production-Readiness.md](docs/Production-Readiness.md)

## Документация

Полный индекс: **[docs/README.md](docs/README.md)**

| | |
|--|--|
| [Architecture](docs/Architecture.md) | Модули, потоки данных |
| [Development](docs/Development.md) | Локальная разработка |
| [API](docs/API.md) | REST endpoints |
| [Release Checklist](docs/Release-Checklist.md) | Чеклист релиза |

## Команды

```bash
npm run dev              # API + frontend
npm run build            # production build
npm run test:e2e         # API tests (36)
npm run test:browser     # Playwright (8)
npm run migration:run    # DB migrations
npm run db:backup:docker # backup PostgreSQL
```

## Структура

```
apps/api/     NestJS backend
src/          React frontend
docs/         Documentation
e2e/          Playwright tests
scripts/      DB backup/restore
```

## Принципы

- Бизнес-данные только в PostgreSQL (реляционные entities)
- Без `json_record` для стабильных сущностей
- Миграции обязательны в production
- Единый API-клиент: `src/api/`

## Health

- `GET /api/health/live` — liveness
- `GET /api/health/ready` — readiness + database

## Лицензия

Private — Longhua Chinese.
