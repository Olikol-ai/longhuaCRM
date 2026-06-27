# Аудит: API

## Endpoints

### Generic entities (`EntitiesController`)

| Method | Path | Guard | Проблема |
|--------|------|-------|----------|
| GET | `/api/entities/:entity` | OptionalJwt | Public: WelcomePageSettings only |
| POST | `/api/entities/:entity/filter` | JwtAuth | Любой user = filter all |
| POST | `/api/entities/:entity` | JwtAuth | Любой user = create all |
| PATCH | `/api/entities/:entity/:id` | JwtAuth | Любой user = update all |
| DELETE | `/api/entities/:entity/:id` | JwtAuth | Любой user = delete all |

Файл: `entities.controller.ts`. DTO: **нет** (`Record<string, unknown>`).

### Auth (`AuthController`)

| Method | Path | Guard | DTO |
|--------|------|-------|-----|
| POST | `/api/auth/login` | — | LoginDto |
| POST | `/api/auth/register` | — | RegisterDto |
| GET | `/api/auth/me` | JwtAuth | — |
| PATCH | `/api/auth/me` | JwtAuth | UpdateMeDto |
| GET | `/api/auth/public-settings` | — | — |

### Functions (`FunctionsController`)

| Function | Auth | Проблема |
|----------|------|----------|
| tgDebug | public | OK for debug |
| autoCompleteExpiredLessons | **none** | Cron callable by anyone |
| sendLessonReminders* | **none** | Cron callable by anyone |
| exportBackup, revokeAllAccess | admin inline | AdminGuard imported, unused |
| alfaBankInit, sendTelegramMessage | auth user | OK |

### Webhooks (`WebhooksController`)

| Path | Auth |
|------|------|
| POST `/api/webhooks/telegram` | secret header (optional) |
| POST `/api/webhooks/alfabank` | checksum in service |

### Legacy

| Path | Назначение |
|------|------------|
| GET `/api/apps/public/prod/public-settings/by-id/longhua-crm` | Base44 compat |

### Health

| Path | Auth |
|------|------|
| GET `/api/health` | none |

## Цепочка API (текущая, сломанная)

```
Frontend snake_case
  → POST/PATCH /api/entities/:entity
    → EntitiesController (no DTO)
      → EntityRepositoryService (row.data)
        → TypeORM
          → PostgreSQL (jsonb OR columns)
```

## Целевая цепочка (этап 4)

```
Frontend
  → /api/v2/students (DTO)
    → StudentsController
      → StudentsService
        → StudentsRepository
          → StudentEntity (relations)
            → PostgreSQL
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
