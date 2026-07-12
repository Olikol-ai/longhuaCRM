# Module Boundaries

NestJS backend layout under `apps/api/src/modules/`. This document describes architectural boundaries, not implementation details.

## Core CRM domains

Business features map to dedicated modules and/or the generic entity API.

| Domain | Module(s) | Responsibility |
|--------|-----------|----------------|
| **Students** | `students`, `users`, `entities` | Student balance, user–student profile sync, generic `Student` CRUD |
| **Teachers** | `users`, `entities` | User–teacher profile sync, generic `Teacher` CRUD |
| **Schedule** | `schedule`, `entities` | Lessons, series, availability, bookings, course folders |
| **Payments** | `payments`, `alfabank`, `entities` | Payment records, Alfa-Bank integration, generic `Payment` CRUD |
| **Materials** | `entities`, `files/secure-files` | Courses, folders, lesson materials, material access, signed file URLs |

Supporting mappers without own modules:

- `modules/shop/shop.mapper.ts` — `ShopItem` ↔ API record shape
- `modules/welcome/welcome.mapper.ts` — welcome page settings ↔ API record shape

## System modules

| Module | Responsibility |
|--------|----------------|
| **auth** | Login, registration, JWT, pending registration, verification email |
| **users** | User CRUD, profile relations, role–entity sync |
| **audit** | Audit log (`@Global()`) |
| **telegram** | Bot service, admin settings, webhook lifecycle |
| **alfabank** | Payment gateway orders and callbacks |
| **jobs** | Scheduled/cron-style maintenance tasks |
| **settings** | App settings via entity repository |
| **mail** | SMTP delivery (`@Global()`) |
| **webhooks** | External webhook endpoints (Telegram, Alfa-Bank) |
| **uploads** | Authenticated file upload to disk |
| **health** | Health check endpoint |
| **legacy** | Compatibility routes for older clients |
| **spa** | SPA fallback when serving frontend |
| **functions** | Aggregated “function” endpoints (Telegram, Alfa-Bank, jobs) |

## Shared infrastructure

| Location | Responsibility |
|----------|----------------|
| `common/guards/` | `JwtAuthGuard`, `RolesGuard` via global `GuardsModule` |
| `common/security/` | Rate limiting, password/email validation, client IP |
| `common/constants/` | Entity names, permissions, registry |
| `entities/` | TypeORM entity definitions (kebab-case `*.entity.ts`) |

## EntitiesModule — legacy compatibility layer

`EntitiesModule` exposes a **generic REST API** at `/entities/:entityName` for CRM records defined in `entity-registry.ts` and `shared/entity-names.json`.

It is the compatibility layer for the original JSON-record-style frontend client (`src/api/entities.js`).

**Characteristics:**

- Maps API names (`ShopSettings`, `AppSettings`, …) to TypeORM entities
- Hosts material-access sub-API (`MaterialAccessController`, related services)
- Delegates schedule-specific logic to `ScheduleModule` where needed
- Uses `SecureFilesModule` for file URL signing on material mutations

**Not all TypeORM entities are exposed** through this API. Internal-only tables (e.g. `AuditLog`, `PendingRegistration`, `AlfaBankOrder`, join tables) are registered in `ALL_ENTITIES` but omitted from `CRM_ENTITY_CLASS_MAP`.

Prefer domain modules (`schedule`, `payments`, `users`) for new backend features. Use `EntitiesModule` only when the frontend generic client must remain compatible.

## Module dependency hub

```
EntitiesModule ← SettingsModule, JobsModule, AlfaBankModule
              ↔ SecureFilesModule (forwardRef — shared MaterialAccessCheckService)
TelegramModule → SettingsModule, AuthModule (forwardRef)
FunctionsModule → TelegramModule, AlfaBankModule, JobsModule
WebhooksModule → TelegramModule, AlfaBankModule
```

Avoid introducing new circular imports. When two modules need the same service, export it from one owner module and import with `forwardRef` if necessary.

## Frontend ↔ backend boundary

| Frontend | Backend |
|----------|---------|
| `src/api/entities.js` | `EntitiesController` |
| `src/api/schedule.js` | `ScheduleController` |
| `src/api/auth.js` | `AuthController` |
| `src/api/alfabank.js` | `AlfaBankController` |
| `src/api/functions.js` | `FunctionsController` |

Do not add new generic entity types without updating `shared/entity-names.json` and running `npm run sync:entities`.
