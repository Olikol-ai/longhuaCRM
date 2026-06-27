# Спецификация этапа 4: Typed API + RBAC

**Roadmap:** [04-api.md](../04-api.md)  
**Предшественник:** [03-services-spec.md](./03-services-spec.md)  
**Следующий:** [05-frontend-spec.md](./05-frontend-spec.md)  
**Аудит:** [docs/audit/api.md](../../audit/api.md), [security.md](../../audit/security.md)  
**Трудоёмкость:** 56–84 ч

---

## Цель этапа

Ввести typed REST API (`/api/v2/*`) с DTO, class-validator и role-based access control. Закрыть критические уязвимости generic `/api/entities/*`. Подготовить deprecate path для legacy API без удаления до этапа 5 frontend migration.

---

## Архитектура (текущее состояние)

```
HTTP Request
├── /api/auth/*           → AuthController → AuthService → UsersRepository ✓ typed
├── /api/entities/:entity → EntitiesController → EntityRepositoryService (no DTO, no RBAC)
├── /api/functions/:name  → FunctionsController → AlfaBank/Jobs/Telegram (partial auth)
├── /api/webhooks/*       → WebhooksController → AlfaBank/Telegram
└── /api/health           → HealthController

Guards:
├── JwtAuthGuard          jwt-auth.guard.ts:4-12
├── OptionalJwtAuthGuard  jwt-auth.guard.ts:14-33
└── AdminGuard            admin.guard.ts:4-13 (IMPORTED but UNUSED in FunctionsController)
```

### Целевая архитектура

```
/api/v2/students     → StudentsController  → StudentsService  → @Roles admin|teacher
/api/v2/lessons      → LessonsController   → LessonsService   → ownership checks
/api/v2/payments     → PaymentsController  → PaymentsService  → admin write
/api/auth/*          → AuthController (hardened UpdateMe)
/api/functions/*     → FunctionsController (AdminGuard on cron)
/api/entities/*      → DEPRECATED (Deprecation: true header)
```

---

## Классы

### AuthController

**Файл:** `apps/api/src/modules/auth/auth.controller.ts` (44 строки)  
**Prefix:** `@Controller('auth')` — строка 10  
**DI:** `AuthService` — строка 12

| Decorator | Route | Guard | Handler | Строки |
|-----------|-------|-------|---------|--------|
| POST | `login` | — | login | 14-17 |
| POST | `register` | — | register | 19-22 |
| GET | `me` | JwtAuthGuard | me | 24-28 |
| PATCH | `me` | JwtAuthGuard | updateMe | 30-34 |
| GET | `public-settings` | — | publicSettings | 36-42 |

### AuthService

См. [03-services-spec.md](./03-services-spec.md). API-relevant: `JwtPayload` interface (auth.service.ts:12-16), `signToken` (82-89).

### AuthModule

**Файл:** `auth.module.ts` (28 строк)

- PassportModule defaultStrategy `'jwt'` — строка 12
- JwtModule.registerAsync — secret `jwt.secret`, expiresIn `7d` default — строки 13-20
- Exports: AuthService, JwtModule — строка 26

### JwtStrategy

**Файл:** `jwt.strategy.ts` (23 строки)

| Config | Строки | Значение |
|--------|--------|----------|
| jwtFromRequest | 11-14 | Bearer + header `x-access-token` |
| ignoreExpiration | 15 | false |
| secretOrKey | 16 | same as JwtModule |
| validate | 20-22 | returns payload as-is (no DB lookup) |

### FunctionsController

**Файл:** `functions.controller.ts` (120 строк)  
**Prefix:** `@Controller('functions')` — строка 23

**DI:** TelegramService, AlfaBankService, JobsService — строки 27-31

#### Function registry (строки 41-55)

| Category | Functions | Auth rule | Строки |
|----------|-----------|-----------|--------|
| publicFunctions | `tgDebug` | none | 41, 113-115 |
| adminFunctions | `exportBackup`, `checkBotInfo`, `registerTelegramWebhook`, `revokeAllAccess` | user.role === 'admin' inline | 42, 61-64 |
| authFunctions | `sendTelegramMessage`, `alfaBankInit`, `fixWebhook`, `checkPaymentStatus`, `clearTelegramUpdates` | user required | 43-48, 65-68 |
| cron-like | `autoCompleteExpiredLessons`, `sendLessonReminders`, `sendLessonReminders2h` | **NONE** ⚠️ | 55, 105-110 |

**Note:** `AdminGuard` imported строка 15 — **не используется**; inline check строки 61-64.

#### dispatch switch (строки 79-118)

| case | Callee | Строка |
|------|--------|--------|
| sendTelegramMessage | telegramService.sendMessage(body.chat_id, body.text) | 84-85 |
| alfaBankInit | alfaBankService.init({...origin from req}) | 86-94 |
| exportBackup | jobsService.exportBackup() | 95-96 |
| fixWebhook/registerTelegramWebhook/clearTelegramUpdates | telegramService.registerWebhook(webhookUrl) | 97-100 |
| checkBotInfo | telegramService.getBotInfo() | 101-102 |
| checkPaymentStatus | alfaBankService.checkPaymentStatus(body.orderId) | 103-104 |
| autoCompleteExpiredLessons | jobsService.autoCompleteExpiredLessons() | 105-106 |
| sendLessonReminders | jobsService.sendLessonReminders24h() | 107-108 |
| sendLessonReminders2h | jobsService.sendLessonReminders2h() | 109-110 |
| revokeAllAccess | jobsService.revokeAllAccess() | 111-112 |

**Error handling:** строки 71-76 — catch → InternalServerErrorException(message)

### EntitiesController (legacy, контекст для deprecate)

**Файл:** `entities.controller.ts` (123 строки)

| Method | Path | Guard | Строки |
|--------|------|-------|--------|
| GET | `:entity` | OptionalJwtAuthGuard | 33-59 |
| POST | `:entity/filter` | JwtAuthGuard | 61-69 |
| POST | `:entity` | JwtAuthGuard | 71-84 |
| PATCH | `:entity/:id` | JwtAuthGuard | 86-95 |
| DELETE | `:entity/:id` | JwtAuthGuard | 97-108 |

Public read: только `WelcomePageSettings` (`PUBLIC_READ_ENTITIES`, entity-names.ts:22-24) — entities.controller.ts:118-122.

### WebhooksController

**Файл:** `webhooks.controller.ts` (60 строк)

| Route | Auth | Handler | Строки |
|-------|------|---------|--------|
| POST telegram | optional `x-telegram-bot-api-secret-token` | handleUpdate | 26-43 |
| POST alfabank | checksum in service | handleWebhook → plain text | 45-58 |

### Guards

#### JwtAuthGuard (`jwt-auth.guard.ts:4-12`)

Extends `AuthGuard('jwt')`. `handleRequest`: throw UnauthorizedException if !user.

#### OptionalJwtAuthGuard (`jwt-auth.guard.ts:14-33`)

- No Authorization and no x-access-token → `request.user = null`, allow — строки 23-25
- Else validate JWT
- `handleRequest`: return user ?? null (no throw)

#### AdminGuard (`admin.guard.ts:4-13`)

`request.user.role !== 'admin'` → ForbiddenException. **Не подключён к FunctionsController cron endpoints.**

### CurrentUser decorator

**Файл:** `current-user.decorator.ts:4-9` — extracts `request.user` as `JwtPayload | null`.

---

## Методы (API handlers детально)

### POST /api/auth/login

**Input:** `LoginDto` — email (IsEmail), password (MinLength 1)  
**Output:** `{ token: string, user: Record }`  
**Errors:** 401 UnauthorizedException — auth.service.ts:29  
**Rate limit:** none ⚠️

### POST /api/auth/register

**Input:** `RegisterDto` — email, password, first_name?, last_name?  
**Output:** `{ token, user }` with role `'pending'`  
**Errors:** 409 ConflictException — auth.service.ts:39

### GET /api/auth/me

**Guard:** JwtAuthGuard  
**Output:** user record (snake_case via userToRecord)  
**Errors:** 401 if user not found — auth.service.ts:63

### PATCH /api/auth/me

**Guard:** JwtAuthGuard  
**Input:** `UpdateMeDto` — **includes optional `role`** — update-me.dto.ts:20-22  
**Vulnerability:** любой authenticated user может установить `role: 'admin'` — auth.service.ts:75-76  
**Used by frontend:** AuthContext.jsx:48-51 (role auto-detect), UserManagement не использует auth/me для role change

### GET /api/auth/public-settings

**Output:** hardcoded `{ id: 'longhua-crm', public_settings: { auth_required: true } }` — auth.controller.ts:38-41  
**Legacy compat:** also `GET /api/apps/public/prod/public-settings/by-id/longhua-crm` (LegacyModule)

### POST /api/functions/:name

**Guard:** OptionalJwtAuthGuard — строка 34  
**Body:** `Record<string, unknown>` — **no DTO validation**  
**Flow:** invoke → auth matrix → dispatch → try/catch — строки 35-76

### Generic entities endpoints

**Body/query:** `Record<string, unknown>` — no validation  
**Authorization:** any JWT user = full CRUD on all 17 entities ⚠️

---

## DTO

### Существующие

#### LoginDto — `auth/dto/login.dto.ts`

```3:10:apps/api/src/modules/auth/dto/login.dto.ts
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
```

#### RegisterDto — re-export from login.dto.ts

`register.dto.ts:1` → `export { RegisterDto } from './login.dto'`  
Fields: email, password, first_name?, last_name? — login.dto.ts:12-27

#### UpdateMeDto — `auth/dto/update-me.dto.ts`

```3:23:apps/api/src/modules/auth/dto/update-me.dto.ts
export class UpdateMeDto {
  @IsOptional() @IsString() first_name?: string;
  @IsOptional() @IsString() last_name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() telegram_id?: string;
  @IsOptional() @IsString() role?: string;  // ⚠️ REMOVE or admin-only
}
```

### Новые DTO (этап 4 — создать)

| Resource | DTO files | Key validations |
|----------|-----------|-----------------|
| Students | create-student.dto.ts, update-student.dto.ts | email, lesson_balance >= 0 |
| Teachers | create-teacher.dto.ts, update-teacher.dto.ts | hourly_rate >= 0 |
| Lessons | create-lesson.dto.ts, update-lesson.dto.ts | date ISO, status enum |
| Payments | create-payment.dto.ts, update-payment.dto.ts | amount > 0, student_id UUID |
| Shop | create-shop-item.dto.ts | item_id unique, type enum |
| Welcome | update-welcome.dto.ts | school_name, title, body_text |
| Auth admin | update-user-role.dto.ts | role enum, admin only |

**Naming convention:** API принимает snake_case (frontend compat) — использовать `@Transform` или custom ValidationPipe.

### Functions DTO (рекомендуется)

| Function | DTO | Fields |
|----------|-----|--------|
| alfaBankInit | AlfaBankInitDto | type, itemId, studentId, amount, returnUrl? |
| sendTelegramMessage | SendTelegramDto | chat_id, text |
| checkPaymentStatus | CheckPaymentDto | orderId |

---

## Entity (API mapping)

Полная таблица: [audit/api.md](../../audit/api.md) § Entity names.

**Критичные для RBAC:**

| Entity | Sensitive operations | Target v2 policy |
|--------|---------------------|------------------|
| User | role change, delete | admin only |
| Student | lesson_balance | admin; teacher read own |
| Payment | create/delete | admin; student read self |
| Lesson | status change | admin; teacher own lessons |
| MaterialAccess | grant/revoke | admin; teacher own students |
| ShopSettings | CRUD | admin |
| WelcomePageSettings | public GET, admin PUT | |

**User entity** — единственная полностью typed (`UserEntity`, не через row.data). User CRUD через `/api/entities/User` использует UsersRepository в EntityRepositoryService.list/filter — entity-repository.service.ts:93-97, 140-142.

---

## Зависимости

```
AuthController → AuthService → UsersRepository
FunctionsController → AlfaBankModule, JobsModule, TelegramModule
EntitiesController → EntityRepositoryService → 16 CRM repos + UsersRepository
WebhooksController → AlfaBankService, TelegramService, ConfigService

Global:
├── ValidationPipe (ensure enabled in main.ts)
├── JwtStrategy registered via AuthModule
└── ConfigModule (jwt, telegram, alfaBank secrets)
```

**Frontend dependency:** `base44Client.js` — all entity calls → `/api/entities/*`; functions → `/api/functions/*`; auth → `/api/auth/*`.

---

## Callers (clients → API)

| Client | File:строка | Endpoint |
|--------|-------------|----------|
| base44.auth.login | base44Client.js:112-117 | POST /auth/login |
| base44.auth.register | base44Client.js:120-127 | POST /auth/register |
| base44.auth.me | base44Client.js:96 | GET /auth/me |
| base44.auth.updateMe | base44Client.js:99 | PATCH /auth/me |
| base44.entities.* | base44Client.js:36-72 | /entities/:name/* |
| base44.functions.invoke | base44Client.js:136-140 | POST /functions/:name |
| AuthContext | AuthContext.jsx:32,48-51 | me, updateMe(role) |
| TopUpModal | TopUpModal.jsx:46 | functions/alfaBankInit |
| Settings | Settings.jsx:18 | functions/exportBackup |
| TelegramSettings | TelegramSettings.jsx:117 | functions/fixWebhook |
| TeacherSchedule/Dashboard | TeacherSchedule.jsx:113, TeacherDashboard.jsx:62 | sendTelegramMessage |
| Profile | Profile.jsx:59 | sendTelegramMessage |

---

## Callees (API → services)

| Controller | Service methods |
|------------|-----------------|
| AuthController | AuthService.login/register/getMe/updateMe |
| FunctionsController | AlfaBankService.init/checkPaymentStatus, JobsService.*, TelegramService.* |
| EntitiesController | EntityRepositoryService.list/filter/create/update/delete |
| WebhooksController | AlfaBankService.handleWebhook, TelegramService.handleUpdate |

---

## Data flow

### Auth flow (frontend)

```
Login.jsx → base44.auth.login (base44Client.js:111-117)
  → POST /api/auth/login + LoginDto validation
  → setToken(localStorage 'longhua_access_token') — base44Client.js:116
  → AuthContext.checkUserAuth (AuthContext.jsx:29-73)
    → GET /api/auth/me
    → if role==='user': infer teacher/student from entities — lines 42-55
    → PATCH /api/auth/me { role } — privilege escalation path ⚠️
```

### Entity CRUD (legacy — Payments example)

```
Payments.jsx:18-19 → base44.entities.Payment.list("-payment_date", 200)
  → GET /api/entities/Payment?sort=-payment_date&limit=200
    → OptionalJwtAuthGuard (must be authed for non-public)
    → EntityRepositoryService.list
```

```
Payments.jsx:43 → base44.entities.Payment.create(data)
  → POST /api/entities/Payment + JwtAuthGuard
    → ANY authenticated user can create ⚠️
```

### Functions alfaBankInit

```
TopUpModal.jsx:46-52
  → POST /api/functions/alfaBankInit + Bearer token
  → authFunctions check user (functions.controller.ts:65-68)
  → AlfaBankService.init
  ← { data: { redirectUrl, orderId, paymentId } }  // wrapped by base44Client invoke
```

**Note:** base44.functions.invoke returns `{ data }` — base44Client.js:140; TopUpModal reads `res.data.redirectUrl` — TopUpModal.jsx:54.

### RBAC target flow (v2)

```
PATCH /api/v2/students/:id
  → JwtAuthGuard + RolesGuard('admin','teacher')
  → OwnershipGuard (teacher → assigned students only)
  → StudentsService.update(UpdateStudentDto)
  → 403 if teacher modifies foreign student
```

---

## Проблемы (с номерами строк)

| # | Файл | Строки | Проблема | Fix (этап 4) |
|---|------|--------|----------|--------------|
| A1 | entities.controller.ts | 71-108 | Any JWT = CRUD all entities | v2 + RBAC; deprecate |
| A2 | auth.service.ts | 75-76 | updateMe applies role | Remove role from DTO or admin endpoint |
| A3 | update-me.dto.ts | 20-22 | role field exposed | Delete field |
| A4 | functions.controller.ts | 55, 105-110 | Cron functions no auth | AdminGuard or internal secret |
| A5 | functions.controller.ts | 15, 61-64 | AdminGuard imported unused | Use @UseGuards(AdminGuard) |
| A6 | functions.controller.ts | 37, 79 | Body untyped Record | Function-specific DTOs |
| A7 | jwt.strategy.ts | 20-22 | No user existence check | Optional: validate user in DB on each request |
| A8 | auth.module.ts | 16-17 | Dev JWT secret fallback | Fail in production (partially done configuration.ts:9-11) |
| A9 | entities.controller.ts | — | No Deprecation header | Add on all responses |
| A10 | functions.controller.ts | 74-75 | Error message leaked to client | Sanitize production errors |
| A11 | webhooks.controller.ts | 40-41 | Telegram errors swallowed | OK for TG retry semantics |
| A12 | AuthContext.jsx | 48-51 | Client-side role elevation via updateMe | Server-side role assignment only |
| A13 | UserManagement.jsx | 156 | User.update role via entities API | Move to PATCH /api/v2/users/:id/role admin |
| A14 | base44Client.js | 28 | Error parsing assumes data.error | NestJS returns message array |

---

## Legacy

| Endpoint | Статус | Migration |
|----------|--------|-----------|
| `/api/entities/*` | Primary frontend path | Deprecate → v2 |
| `/api/functions/*` | Serverless compat (Base44) | Keep; tighten auth |
| `/api/auth/public-settings` | Static stub | Keep |
| LegacyModule public-settings | Base44 URL compat | Keep until frontend migrated |
| `x-access-token` header | Alt JWT transport | Keep in JwtStrategy |

---

## Delete / Replace

| Компонент | Замена | Когда |
|-----------|--------|-------|
| Inline admin check functions.controller.ts:61-64 | `@UseGuards(JwtAuthGuard, AdminGuard)` | Этап 4 |
| UpdateMeDto.role | `PATCH /api/v2/admin/users/:id/role` | Этап 4 |
| Entities write for core aggregates | v2 controllers | Этап 4-5 |
| EntityRepositoryService in controllers | Domain services | После этап 3 |
| Generic filter POST body operators | Typed query params / repository methods | Этап 4 |

**Не удалять до этапа 8:** `EntitiesController`, `EntityRepositoryService`.

---

## Риски

| Риск | Mitigation |
|------|------------|
| Breaking frontend on RBAC | Parallel v2; feature flags |
| UserManagement role change breaks | Ship admin endpoint before removing DTO role |
| External cron hits functions | AdminGuard + rotate secrets |
| OpenAPI drift | Generate from DTOs |
| Teacher/student data leak on list endpoints | Service-layer filters by ownership |

---

## Tests

### Security matrix (E2E)

| Test | Token | Request | Expected |
|------|-------|---------|----------|
| S1 | none | POST /functions/sendLessonReminders | 401/403 after fix |
| S2 | student | PATCH /entities/Student/other-id | 403 after RBAC |
| S3 | student | PATCH /auth/me {role:admin} | 403 after fix |
| S4 | teacher | PATCH /v2/lessons/foreign-id | 403 |
| S5 | admin | POST /functions/exportBackup | 200 |
| S6 | none | GET /entities/WelcomePageSettings | 200 |

### Controller unit tests

- AuthController: login validation 400 on bad email
- FunctionsController: unknown function 404 — line 57-58
- RolesGuard: metadata roles enforcement

### Contract tests

- v2 response snake_case fields match frontend Payments.jsx, ShopSettingsAdmin.jsx expectations

---

## RBAC matrix (целевая реализация)

| Role | GET students | POST payment | PATCH lesson status | ShopSettings | functions cron |
|------|--------------|--------------|---------------------|--------------|----------------|
| anonymous | — | — | — | — | deny |
| pending | self read | — | — | — | deny |
| student | self | — | — | — | deny |
| teacher | assigned | — | own lessons | — | deny |
| admin | all | all | all | all | allow |

---

## v2 API surface (создать)

| Resource | Path | Methods | Controller guard |
|----------|------|---------|------------------|
| Students | `/api/v2/students` | GET, POST, PATCH, DELETE | Roles + ownership |
| Teachers | `/api/v2/teachers` | GET, POST, PATCH, DELETE | admin; teacher self read |
| Lessons | `/api/v2/lessons` | GET, POST, PATCH, DELETE | admin; teacher scoped |
| Payments | `/api/v2/payments` | GET, POST, PATCH, DELETE | admin write |
| Courses | `/api/v2/courses` | GET, POST, PATCH, DELETE | admin |
| Materials | `/api/v2/materials` | GET, POST, PATCH, DELETE | admin, teacher |
| Material access | `/api/v2/material-access` | GET, POST, DELETE | admin, teacher |
| Shop items | `/api/v2/shop-items` | GET, POST, PATCH, DELETE | admin |
| Welcome page | `/api/v2/welcome-page` | GET, PUT | GET public; PUT admin |
| Users (admin) | `/api/v2/users` | GET, PATCH role, DELETE | admin |

---

## Таблица изменений

| Файл | Строки | Причина | Результат | Побочные эффекты | Проверка |
|------|--------|---------|-----------|------------------|----------|
| `common/decorators/roles.decorator.ts` | NEW | RBAC metadata | @Roles() | — | unit |
| `common/guards/roles.guard.ts` | NEW | Centralized RBAC | Reflector + JwtPayload | — | matrix E2E |
| `common/guards/admin.guard.ts` | 4-13 | Use on functions | Cron protected | External cron breaks | 401 test |
| `functions.controller.ts` | 15, 55, 61-64, 105-110 | Security | @UseGuards Admin on cron | — | S1 test |
| `auth/dto/update-me.dto.ts` | 20-22 | Privilege escalation | Remove role field | AuthContext.jsx:48-51 needs new API | S3 test |
| `auth/auth.controller.ts` | NEW | PATCH users/:id/role | Admin role assignment | UserManagement.jsx:156 | manual |
| `auth/auth.service.ts` | 75-76 | Strip role from updateMe | — | — | unit |
| `modules/students/students.controller.ts` | NEW | Typed API | v2 CRUD | Payments, Schedule, UserManagement | Postman |
| `modules/payments/payments.controller.ts` | NEW | Typed API | balance in service | Payments.jsx migration | integration |
| `modules/lessons/lessons.controller.ts` | NEW | Typed API | Schedule.jsx | — | integration |
| `modules/shop/shop.controller.ts` | NEW | Shop CRUD | ShopSettingsAdmin | — | CRUD test |
| `modules/welcome/welcome.controller.ts` | NEW | Public GET | Welcome.jsx | — | public GET |
| `entities.controller.ts` | all handlers | Deprecation | Deprecation: true header | Monitoring | curl -I |
| `functions.controller.ts` | 84-94 | DTO | AlfaBankInitDto validation | 400 on bad body | validation test |
| `main.ts` | — | ValidationPipe global | whitelist, transform | Stricter 400s | — |

---

## Checklist

- [ ] RolesGuard + @Roles decorator
- [ ] AdminGuard на cron functions (autoComplete, sendLessonReminders*)
- [ ] Remove `role` from UpdateMeDto + admin role endpoint
- [ ] v2 Students, Lessons, Payments controllers
- [ ] v2 Shop, Welcome controllers
- [ ] DTO validation all v2 write ops
- [ ] Deprecation header on `/api/entities/*`
- [ ] Security matrix tests S1-S6 pass
- [ ] `npm run build` OK

---

## Definition of Done

1. `/api/v2/*` endpoints для P0 aggregates (students, lessons, payments, shop, welcome)
2. Любой authenticated user **не может** CRUD чужие entities через v2
3. Cron functions требуют admin auth
4. PATCH /auth/me **не принимает** role
5. UserManagement role change работает через admin API
6. Generic entities помечены deprecated
7. E2E security matrix green
8. `npm run build` OK

---

## Зависимости этапа

| Требуется | Источник |
|-----------|----------|
| Domain services этап 3 | StudentsService, PaymentsService, etc. |
| Typed entities этап 2 | Column mapping |
| Audit security matrix | security.md |

---

## Параллельная работа

| Track A | Track B |
|---------|---------|
| Guards + auth hardening | v2 Students + Lessons controllers |
| Functions security | v2 Payments + Shop controllers |
| Deprecation headers | Welcome public endpoint |

Frontend migration ([05-frontend-spec.md](./05-frontend-spec.md)) может начаться после первых v2 endpoints (students, payments).

---

## Запрещено

- Удалять `/api/entities/*` до grep `base44.entities` = 0 в frontend
- Открывать cron functions без auth «для удобства»
- Оставлять `role` в UpdateMeDto после shipping admin endpoint
- Возвращать stack traces в InternalServerErrorException (production)
- Пропускать ValidationPipe на v2 controllers

---

*Номера строк соответствуют файлам в `apps/api/src/modules/auth/`, `functions/`, `common/guards/`, `entities/`.*
