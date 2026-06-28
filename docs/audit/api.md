# Аудит: API

> **Обновлено (2026-06):** RBAC через `ENTITY_PERMISSIONS` + `EntityAccessService`. Generic CRUD не даёт полный доступ всем ролям. Auth: verify-code, resend-code, telegram-link. AlfaBank: idempotent init + `POST /api/alfabank/offline-payment-request`. Lesson: `student_ids` → sync `LessonStudent`.

## Endpoints

### Generic entities (`EntitiesController`)

| Method | Path | Guard | Примечание |
|--------|------|-------|------------|
| GET | `/api/entities/:entity` | OptionalJwt | Public: WelcomePageSettings only |
| POST | `/api/entities/:entity/filter` | JwtAuth | RBAC + ownership filter |
| POST | `/api/entities/:entity` | JwtAuth | RBAC; Lesson syncs LessonStudent |
| PATCH | `/api/entities/:entity/:id` | JwtAuth | RBAC; Payment PATCH — admin only |
| DELETE | `/api/entities/:entity/:id` | JwtAuth | RBAC |

Файл: `entities.controller.ts`. DTO: **нет** (`Record<string, unknown>`) — по-прежнему generic payload.

### Auth (`AuthController`)

| Method | Path | Guard | DTO |
|--------|------|-------|-----|
| POST | `/api/auth/login` | rate limit | LoginDto |
| POST | `/api/auth/register` | rate limit | RegisterDto |
| POST | `/api/auth/verify-code` | JwtAuth | VerifyCodeDto |
| POST | `/api/auth/resend-code` | JwtAuth | — |
| POST | `/api/auth/telegram-link` | JwtAuth | — |
| GET | `/api/auth/me` | JwtAuth | — |
| PATCH | `/api/auth/me` | JwtAuth | UpdateMeDto |
| GET | `/api/auth/public-settings` | — | — |

### AlfaBank (`AlfaBankController`)

| Method | Path | Guard |
|--------|------|-------|
| POST | `/api/alfabank/offline-payment-request` | JwtAuth (student/admin) |

Init по-прежнему через `POST /api/functions/alfaBankInit`.

### Functions (`FunctionsController`)

| Function | Auth | Примечание |
|----------|------|------------|
| exportBackup, revokeAllAccess, cron jobs | admin inline | Prefer `/api/jobs`, `/api/telegram/admin` |
| alfaBankInit, checkPaymentStatus | auth user | Student ownership check in service |
| sendTelegramMessage | admin | Не для student flows |

### Webhooks (`WebhooksController`)

| Path | Auth |
|------|------|
| POST `/api/webhooks/telegram` | secret header (required in production) |
| POST `/api/webhooks/alfabank` | checksum in service |

### Material access

| Path | Guard |
|------|-------|
| GET `/api/material-access/check/:materialId` | JwtAuth |

### Legacy

| Path | Назначение |
|------|------------|
| GET `/api/apps/public/prod/public-settings/by-id/longhua-crm` | Base44 compat |

### Health

| Path | Auth |
|------|------|
| GET `/api/health` | none |

## Цепочка API (текущая)

```
Frontend snake_case
  → /api/entities/:entity | /api/users | /api/auth/* | /api/alfabank/*
    → Controller + JwtAuth + RBAC
      → EntityRepositoryService | dedicated services
        → TypeORM entities
          → PostgreSQL (relational columns)
```

## Entity names (API param → Entity class)

Источник: `entity-names.ts`, `ENTITY_CLASS_MAP` в `entity-repository.service.ts`.

| API name | Entity class | Table |
|----------|--------------|-------|
| User | UserEntity | users |
| Student | StudentEntity | students |
| Teacher | TeacherEntity | teachers |
| Lesson | LessonEntity | lessons |
| Payment | PaymentEntity | payments |
| Course | CourseEntity | courses |
| LessonMaterial | LessonMaterialEntity | lesson_materials |
| ScheduleSlot | ScheduleSlotEntity | schedule_slots |
| LessonStudent | LessonStudentEntity | lesson_students |
| LessonBalance | LessonBalanceEntity | lesson_balances |
| TeacherPayment | TeacherPaymentEntity | teacher_payments |
| MaterialAccess | MaterialAccessEntity | material_access |
| TeacherAvailability | TeacherAvailabilityEntity | teacher_availability |
| AlfaBankOrder | AlfaBankOrderEntity | alfa_bank_orders |
| AppSettings | AppSettingEntity | app_settings |
| ShopSettings | ShopSettingEntity | shop_settings |
| WelcomePageSettings | WelcomePageSettingEntity | welcome_page_settings |

## Breaking changes (этап 4+)

- Deprecation `/api/entities/*`
- Новые REST resources с множественным числом
- Pagination, validation errors в стандартном формате
