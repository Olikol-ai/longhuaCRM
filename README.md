# Longhua Academy

Образовательная платформа **Longhua Academy**: ученики, преподаватели, расписание, платежи, сертификаты, материалы.

| Слой | Стек |
|------|------|
| Frontend | React 18, Vite 6, Tailwind, shadcn/ui |
| Backend | NestJS 11, TypeORM 0.3 |
| Database | PostgreSQL 17 |
| Auth | JWT (Passport) |

## Быстрый старт

```bash
npm install && cd apps/api && npm install && cd ../..
cp .env.example .env          # DATABASE_URL, ADMIN_PASSWORD
docker compose up -d postgres
npm run migration:run
npm run dev
```

| URL | Сервис |
|-----|--------|
| http://localhost:5173 | Frontend (Vite dev, proxy `/api`) |
| http://localhost:3001 | API |
| http://localhost:5050 | pgAdmin |

Вход admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` из `.env`.

## Production

Canonical path on this server (`/opt/longhuaCRM`):

```bash
cd /opt/longhuaCRM
./deploy.sh
```

`deploy.sh` runs backup → migration → build → `NODE_ENV=production` start → health live/ready.

Greenfield Docker VM (do not mix with `./deploy.sh` on the same database):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Подробно: [docs/Deployment.md](docs/Deployment.md).

## Обновление сервера

На bare-metal сервере (`/opt/longhuaCRM`, ветка `refactor/nestjs`) обновление одной командой:

```bash
cd /opt/longhuaCRM
./deploy.sh
```

Скрипт: останавливает только процессы LongHuaCRM → `git pull` → `npm install` → миграции → build → запуск в `screen -S longhua`.

Проверка без запуска:

```bash
CRM_DIR="$(pwd)" ./deploy.sh --dry-run
```

Лог: `logs/deploy.log`. Настройки: `CRM_DIR`, `BRANCH`, `SCREEN_NAME` в `.env.example`.

## Документация

**[docs/README.md](docs/README.md)** — полный индекс.

| Документ | Содержание |
|----------|------------|
| [Architecture](docs/Architecture.md) | Модули, потоки данных |
| [API](docs/API.md) | REST endpoints |
| [Development](docs/Development.md) | Локальная разработка |
| [Deployment](docs/Deployment.md) | Production-деплой |
| [Production-Readiness](docs/Production-Readiness.md) | Готовность к эксплуатации |
| [Release-Checklist](docs/Release-Checklist.md) | Чеклист релиза |

## Команды

```bash
npm run dev                 # migration:run + API + Vite
npm run build               # API + frontend
npm run test:e2e            # 36 API tests (apps/api/test/)
npm run test:browser        # 8 Playwright specs (e2e/browser/)
npm run migration:run       # применить миграции
npm run migration:revert    # откатить последнюю
npm run db:backup:docker    # backup PostgreSQL
```

## Структура

```
apps/api/src/modules/   NestJS доменные модули
apps/api/test/          Jest e2e
src/api/                Единый frontend API-клиент
e2e/browser/            Playwright
scripts/                backup/restore БД
docs/                   Документация
```

## Принципы

- Бизнес-данные только в PostgreSQL (TypeORM entities + relations)
- Без `json_record` для стабильных сущностей
- Схема БД только через migrations (8 файлов)
- Все HTTP-запросы фронтенда через `src/api/`

## Health

```
GET /api/health/live   — liveness
GET /api/health/ready  — readiness + database
```

## Лицензия

Private — Longhua Academy.
