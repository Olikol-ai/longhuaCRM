# Release Checklist

Использовать перед каждым production-релизом LonghuaCRM.

## Версия и код

- [ ] Все изменения в feature branches смержены
- [ ] `npm run build` — успешно
- [ ] `npm run test:e2e` — 36/36 PASS
- [ ] `npm run test:browser` — 8/8 PASS (если менялся UI)
- [ ] Нет незакоммиченных миграций
- [ ] Changelog / release notes подготовлены

## База данных

- [ ] Миграции протестированы на staging
- [ ] `npm run migration:run` выполнен на production (или в CI pre-deploy)
- [ ] Backup БД сделан перед миграцией: `npm run db:backup:docker`
- [ ] План отката миграции документирован (`migration:revert` или restore)

## Окружение (production env)

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` — уникальный, не из dev
- [ ] `DATABASE_URL` — production PostgreSQL
- [ ] `ADMIN_PASSWORD` — сильный пароль (или admin уже создан)
- [ ] `APP_PUBLIC_URL` — корректный HTTPS URL
- [ ] `CORS_ORIGINS` — только production домены
- [ ] `TRUST_PROXY=true` (если за reverse proxy)
- [ ] `SERVE_FRONTEND` — согласовано с архитектурой (true / false)

## SMTP

- [ ] `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` заданы
- [ ] Тестовое письмо (регистрация / код) отправлено на staging
- [ ] SPF/DKIM настроены на домене отправителя

## Telegram

- [ ] `TELEGRAM_BOT_TOKEN` валиден
- [ ] `TELEGRAM_WEBHOOK_URL` указывает на production `/api/webhooks/telegram`
- [ ] `TELEGRAM_WEBHOOK_SECRET` задан (обязателен в production)
- [ ] Webhook зарегистрирован (`setWebhook`)
- [ ] Тестовое напоминание / команда бота

## Cron

- [ ] `ENABLE_CRON=true` на production инстансе (только один инстанс если несколько реплик!)
- [ ] `REMINDER_TIMEZONE` корректен
- [ ] Pending registration cleanup работает

## Backup & Restore

- [ ] Автоматический backup по cron настроен
- [ ] Restore протестирован на staging (не на production!)
- [ ] Retention policy для `.dump` файлов (30+ дней)

## SSL и домен

- [ ] DNS A/AAAA запись на сервер
- [ ] SSL сертификат валиден (Let's Encrypt / commercial)
- [ ] HTTP → HTTPS redirect
- [ ] `APP_PUBLIC_URL` совпадает с доменом

## Health & Monitoring

- [ ] `GET /api/health/live` — 200
- [ ] `GET /api/health/ready` — 200, `database: up`
- [ ] Uptime monitoring на health endpoint
- [ ] Алерты на 5xx / ready failures

## Логирование

- [ ] Логи приложения собираются (docker logs / journald / Loki)
- [ ] Ротация логов настроена
- [ ] Нет секретов в логах

## Файлы

- [ ] Volume `uploads/` persistent
- [ ] Backup uploads (если критично) — rsync / snapshot
- [ ] Лимит 50 MB upload достаточен

## Роли и доступ

- [ ] Admin аккаунт проверен
- [ ] Тестовые аккаунты удалены или деактивированы
- [ ] Teacher/student flows проверены вручную

## Деплой

- [ ] `docker compose -f docker-compose.prod.yml up -d --build` (или CI/CD pipeline)
- [ ] Smoke test: login → dashboard → один CRUD
- [ ] Webhooks доставляются (Telegram, Alfa Bank если используется)

## Rollback

- [ ] Предыдущий Docker image / git tag известен
- [ ] Команда rollback: checkout tag → rebuild → up
- [ ] При breaking migration — restore DB из backup
- [ ] Коммуникация с пользователями при downtime

## Post-release

- [ ] Мониторинг 24–48 ч после релиза
- [ ] Проверка cron jobs на следующий день
- [ ] Документация обновлена при изменении API/env
