# Longhua CRM

CRM-платформа для языковой школы Longhua Chinese. Фронтенд — React + Vite, бэкенд — NestJS + PostgreSQL + TypeORM.

## Быстрый старт

```bash
npm install
cd apps/api && npm install && cd ../..
cp .env.example .env
# Настройте DATABASE_URL и другие переменные в .env
npm run dev
```

- Фронтенд: http://localhost:5173
- API: http://localhost:3001

## Вход по умолчанию

После первого запуска создаётся администратор (если задан `ADMIN_PASSWORD`):

- **Email:** `admin@longhua.local` (или `ADMIN_EMAIL`)
- **Пароль:** значение `ADMIN_PASSWORD` из `.env`

## Архитектура

| Слой | Технологии |
|------|------------|
| Frontend | React 18, Vite, Tailwind, shadcn/ui |
| Backend | NestJS, TypeORM, PostgreSQL |
| Auth | JWT (Passport) |
| Платежи | Alfa Bank Belarus (опционально) |
| Уведомления | Telegram Bot через Webhook |

## API

Фронтенд обращается к локальному API через прокси Vite (`/api` → `:3001`).

- `POST /api/auth/login` — вход
- `POST /api/auth/register` — регистрация
- `GET /api/auth/me` — текущий пользователь
- `GET/POST/PATCH/DELETE /api/entities/:entity` — CRUD сущностей
- `POST /api/functions/:name` — серверные функции
- `POST /api/webhooks/telegram` — Telegram webhook
- `POST /api/webhooks/alfabank` — Alfa Bank webhook

## Переменные окружения

См. `.env.example`.

## Сборка и запуск

```bash
npm run build        # фронтенд
npm run build:api    # NestJS API
npm start            # production API
```

## Миграции БД

```bash
# Production: только миграции (synchronize: false)
npm run migration:run

# Development: synchronize: true (авто-схема)
npm run dev:server
```

## Импорт данных из JSON

```bash
npm run import:json -- path/to/database.json
```

## Структура backend

```
apps/api/src/
  modules/     # NestJS modules (auth, entities, telegram, jobs, ...)
  entities/    # TypeORM entities
  database/    # migrations, import scripts
  config/      # ConfigModule
  common/      # guards, filters, interceptors
```

Папка `base44/` сохранена как документация исходной схемы данных.
