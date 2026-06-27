# Аудит: Security

## JWT

| Компонент | Файл | Детали |
|-----------|------|--------|
| Strategy | `jwt.strategy.ts` | Bearer + `x-access-token` header |
| Sign | `auth.service.ts:82-88` | payload: sub, email, role |
| Secret | `configuration.ts:7-11` | dev fallback; prod requires JWT_SECRET |
| Expiry | default 7d | |

## Guards

| Guard | Файл | Использование |
|-------|------|---------------|
| JwtAuthGuard | `jwt-auth.guard.ts` | Required auth |
| OptionalJwtAuthGuard | `jwt-auth.guard.ts` | entities GET, functions |
| AdminGuard | `admin.guard.ts` | **импортирован, не используется** в FunctionsController |

## Матрица доступа (текущая)

| Resource | Anonymous | Auth user | Admin |
|----------|-----------|-----------|-------|
| GET /entities/WelcomePageSettings | ✅ | ✅ | ✅ |
| GET /entities/* (other) | ❌ | ✅ | ✅ |
| POST/PATCH/DELETE /entities/* | ❌ | ✅ **все entities** | ✅ |
| POST /functions/cron jobs | ✅ **⚠️** | ✅ | ✅ |
| POST /functions/admin | ❌ | ❌ | ✅ |
| PATCH /auth/me (role) | ❌ | ✅ **⚠️** | ✅ |
| POST /webhooks/telegram | ✅ (secret opt) | — | — |
| POST /webhooks/alfabank | ✅ (checksum) | — | — |

## Критические уязвимости

1. **Любой auth user = full CRUD** всех business entities
2. **Privilege escalation:** `UpdateMeDto.role` без проверки
3. **Cron functions публичны:** autoComplete, sendReminders
4. **Нет rate limiting** на login/register
5. **Нет row-level security:** teacher видит всех students

## Целевая RBAC (этап 4)

| Role | Students | Lessons | Payments | Materials | Settings |
|------|----------|---------|----------|-----------|----------|
| admin | CRUD all | CRUD all | CRUD all | CRUD all | CRUD |
| teacher | R own students | CRUD own | R | CRUD own | R |
| student | R self | R self | R self | R granted | — |
| pending | — | — | — | — | — |

## Задачи этапа 4 (security)

1. `RolesGuard` + `@Roles('admin')` decorator
2. Убрать `role` из UpdateMeDto или admin-only endpoint
3. `AdminGuard` на cron functions
4. Resource ownership checks в services
5. Optional: rate limit `@nestjs/throttler` on auth

## Проверка

- Student token → PATCH /entities/Student/:id → 403
- Teacher token → PATCH чужого Lesson → 403
- No token → POST /functions/sendLessonReminders → 401/403
- User PATCH /auth/me { role: admin } → 403 for non-admin
