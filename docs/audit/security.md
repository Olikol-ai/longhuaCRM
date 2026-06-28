# Аудит: Security

> **Обновлено (2026-06):** RBAC через `ENTITY_PERMISSIONS`, rate limits на auth, audit log, webhook secrets в production, payment idempotency (partial unique index + transaction lock).

## JWT

| Компонент | Файл | Детали |
|-----------|------|--------|
| Strategy | `jwt.strategy.ts` | Bearer + `x-access-token`; role из DB |
| Sign | `auth.service.ts` | payload: sub, email, role |
| Secret | `configuration.ts` | dev fallback; prod requires JWT_SECRET |
| Expiry | default 7d | |

## Guards

| Guard | Файл | Использование |
|-------|------|---------------|
| JwtAuthGuard | `jwt-auth.guard.ts` | Required auth |
| OptionalJwtAuthGuard | `jwt-auth.guard.ts` | entities GET, functions |
| RolesGuard | `roles.guard.ts` | `/api/users`, `/api/telegram/admin` |

Frontend `AdminRoute` / `TeacherRoute` — только UX; backend RBAC обязателен.

## Матрица доступа (текущая)

| Resource | Anonymous | Student | Teacher | Admin |
|----------|-----------|---------|---------|-------|
| GET /entities/WelcomePageSettings | ✅ | ✅ | ✅ | ✅ |
| POST/PATCH/DELETE /entities/* | ❌ | scoped | scoped | ✅ |
| POST /functions/admin | ❌ | ❌ | ❌ | ✅ |
| POST /functions/alfaBankInit | ❌ | own student | ❌ | ✅ |
| PATCH /auth/me (role) | ❌ | ❌ blocked | ❌ blocked | ❌ blocked |
| POST /webhooks/telegram | secret | — | — | — |
| POST /webhooks/alfabank | checksum | — | — | — |

## Закрытые ранее риски

1. ~~Full CRUD для всех auth users~~ → `ENTITY_PERMISSIONS` + ownership
2. ~~Self-assign admin via PATCH /auth/me~~ → rejected in `AuthService.updateMe`
3. ~~Cron functions public~~ → admin-only in `FunctionsController`
4. ~~No rate limiting~~ → `RateLimitService` on login/register/resend-code
5. ~~Teacher sees all students~~ → `readOwn` / assigned scope where configured

## Оставшиеся риски (архитектурные, не блокеры)

1. Generic entity API без typed DTOs — ошибки payload возможны, RBAC смягчает
2. `AppSettings` secrets editable via admin generic CRUD — audited, no vault
3. Legacy `/api/functions/*` дублирует dedicated controllers

## Audit log

Таблица `audit_logs`: role changes, payments, balance, telegram link, material access, offline payment requests, sensitive AppSettings.

## Рекомендации (без смены архитектуры)

1. Заполнить `telegram_id` у admin users для offline payment notifications
2. Запустить migration `1730000000009` (pending payment unique + lesson_student unique)
3. `TELEGRAM_WEBHOOK_SECRET` и `JWT_SECRET` обязательны в production
