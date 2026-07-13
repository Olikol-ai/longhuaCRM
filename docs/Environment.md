# Environment Variables

Полный шаблон: [`.env.example`](../.env.example) в корне репозитория.

```bash
cp .env.example .env
```

Файл `.env` не коммитится. В production используйте secrets manager или переменные CI/CD.

## Обязательные

| Variable | Описание |
|----------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | **Обязателен в production** — секрет подписи JWT |

## Core

| Variable | Default | Описание |
|----------|---------|----------|
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `3001` | Порт API |
| `LOG_LEVEL` | `log` | Уровень логирования NestJS |
| `SERVE_FRONTEND` | `true` | Раздавать `dist/` из API |
| `TRUST_PROXY` | `false` | `true` за nginx/traefik |

## Security / HTTP

| Variable | Default | Описание |
|----------|---------|----------|
| `CORS_ORIGINS` | — | CSV origins для CORS (production) |
| `APP_PUBLIC_URL` | — | Публичный URL; fallback для CORS |
| `JWT_EXPIRES_IN` | `7d` | TTL токена |
| `RATE_LIMIT_TTL` | `60` | Окно rate limit (сек) |
| `RATE_LIMIT_MAX` | `120` | Запросов за окно |

## Admin bootstrap

| Variable | Описание |
|----------|----------|
| `ADMIN_EMAIL` | Email первого admin |
| `ADMIN_PASSWORD` | Пароль (если задан — создаётся при старте) |

## Mail

| Variable | Описание |
|----------|----------|
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE` | SMTP |
| `MAIL_USER`, `MAIL_PASS` | Credentials |
| `MAIL_FROM` | From header |

Устаревшие `SMTP_*` — алиасы для `MAIL_*`.

## Telegram

| Variable | Описание |
|----------|----------|
| `TELEGRAM_ENABLED` | `true`/`false` |
| `TELEGRAM_BOT_TOKEN` | Bot token |
| `TELEGRAM_WEBHOOK_URL` | Public webhook URL |
| `TELEGRAM_WEBHOOK_SECRET` | **Обязателен в production** |

## Jobs

| Variable | Default | Описание |
|----------|---------|----------|
| `ENABLE_CRON` | `true` | Фоновые задачи |
| `REMINDER_TIMEZONE` | `Europe/Minsk` | TZ для напоминаний |
| `PENDING_REGISTRATION_TTL_HOURS` | `24` | TTL неподтверждённых регистраций |

## Alfa Bank (optional)

`ALFA_BANK_TOKEN`, `ALFA_BANK_MERCHANT_ID`, `ALFA_BANK_API_URL`

## E2E / CI

| Variable | Описание |
|----------|----------|
| `E2E_SYNC_SCHEMA` | `true` — sync schema in tests |
| `E2E_DROP_SCHEMA` | `true` — drop before tests |

## Docker Compose production

`docker-compose.prod.yml` читает `.env` из корня. Обязателен `JWT_SECRET`.

## Проверка конфигурации

При старте API валидируется через `apps/api/src/config/env.validation.ts`. Ошибки валидации — процесс не запустится.
