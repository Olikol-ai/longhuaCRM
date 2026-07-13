# Technical Debt

Осознанные компромиссы и улучшения «на потом». Не является активным аудитом — пункты из завершённого system audit, перенесённые в backlog.

## Намеренно оставлено

| Item | Причина |
|------|---------|
| `FunctionsController` RPC surface | Legacy admin operations; работает, миграция на REST по мере необходимости |
| Generic filter DTOs | Гибкость списков; риск controlled через whitelist в сервисах |
| `origin: true` CORS в development | Удобство локальной разработки |
| Admin pages вне `pages.config` | Историческая структура маршрутов; работает стабильно |
| Нет `@VersionColumn` | Optimistic locking отложен; pessimistic locks на hot paths |

## Улучшить в ближайшие 3–6 месяцев

| Priority | Item | Impact |
|----------|------|--------|
| High | Exclusion constraint / in-tx check для overlapping `availability_bookings` | Двойное бронирование слота |
| High | Dedicated endpoint для `lessonBalance` (не через PATCH student) | Случайная перезапись баланса |
| Medium | Structured logging (pino) + correlation IDs | Отладка production |
| Medium | Object storage (S3) для uploads | Масштабирование файлов |
| Medium | Pagination на всех list endpoints | Performance при росте данных |
| Medium | `alfa_bank_orders` entity + migration | Полнота payment audit trail |
| Low | Убрать deprecated `SMTP_*` env aliases | Чистота конфигурации |
| Low | Signed material URLs everywhere | Security hardening |

## Может стать проблемой при росте

| Scale | Risk | Mitigation path |
|-------|------|-----------------|
| 1k+ students | Full table scans в list без pagination | Добавить `limit/offset` в API + UI |
| 1k+ lessons/month | Cron reminders sequential | Queue (BullMQ) |
| Multi-instance API | Duplicate cron execution | Leader election или отдельный worker |
| Large uploads volume | Disk on app server | S3 + CDN |
| 10k+ users | Single PostgreSQL write node | Read replicas, connection pooling (PgBouncer) |

## Желательно переписать через ~1 год

- **`auth.service.ts` (~850 строк)** — разбить на registration, verification, token, profile sub-services
- **`UserManagement.jsx` (~720 строк)** — tabs как отдельные компоненты
- **`MaterialsHub.jsx` (~630 строк)** — folder tree + file list components
- **Legacy entities RPC** → REST resources с OpenAPI spec

## Архитектурные ограничения сейчас

1. **Monolith** — API + SPA + cron в одном процессе (упрощает ops, ограничивает horizontal cron)
2. **Local file storage** — `uploads/` на диске приложения
3. **JWT stateless** — нет server-side revoke list (кроме смены secret)
4. **No event bus** — синхронные side effects в services (достаточно для текущего масштаба)
5. **Single region** — нет multi-DC

## Не трогать без необходимости

- Рабочие транзакции и locks на lesson complete / payments / certificates
- Миграции уже применённые на production
- Бизнес-правила enrollment progress и certificate lifecycle

## Связанные документы

- Завершённый аудит: `docs/system-audit-report.md` (не расширять)
- Production gaps: `docs/Production-Readiness.md`
