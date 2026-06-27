# Этап 2: Domain (Mapper, Entity fix, Relations) — Техническая спецификация

## Мета

| Поле | Значение |
|------|----------|
| **Цель** | (2a) Сделать generic `/entities/*` рабочим без `row.data`; (2b) Согласовать Payment/Shop/Welcome Entity с frontend; (2c) Добавить TypeORM relations + FK |
| **Зачем** | Frontend, AlfaBankService, JobsService, SettingsService зависят от EntityRepositoryService — сейчас list/create/update читают/пишут несуществующую колонку `data` (entity-repository.service.ts:102-107, 168-175, 184-187). Payment/Shop/Welcome имеют полный разрыв контракта с UI |
| **Трудоёмкость** | 56–92 ч: 2a 20–32 ч, 2b 12–20 ч, 2c 24–40 ч (roadmap `02-domain.md`) |
| **Предшественники** | [01-database-spec.md](./01-database-spec.md) — реляционные колонки, migrations 0001–0003 |
| **Следующий этап** | [03-services-spec.md](./03-services-spec.md) — typed domain services |

**Три подэтапа:**

| Подэтап | Фокус | Критерий готовности |
|---------|-------|---------------------|
| **2a** | Mappers + EntityRepositoryService | list/create/update без `row.data`, snake_case API |
| **2b** | Payment, ShopItem, WelcomePageContent | Payments/Shop/Welcome UI работают |
| **2c** | @ManyToOne / @OneToMany / FK | Migration 0004, referential integrity |

---

## Файлы этапа (таблица)

| Файл | Подэтап | Тип | Приоритет |
|------|---------|-----|-----------|
| `modules/entities/entity-repository.service.ts` | 2a | Изменение | P0 |
| `modules/entities/entities.controller.ts` | 2a | Минимальное / без изменений | P2 |
| `modules/entities/entities.module.ts` | 2a, 2b | Изменение | P0 |
| `common/utils/record.util.ts` | 2a | Изменение (использование) | P0 |
| `modules/users/user.mapper.ts` | 2a | Образец / расширение | P1 |
| `common/mappers/entity-record.mapper.ts` | 2a | **Новый** | P0 |
| `common/mappers/*.mapper.ts` (17 файлов) | 2a, 2b | **Новые** | P0 |
| `modules/alfabank/alfabank.service.ts` | 2b | Изменение | P0 |
| `entities/Payment.entity.ts` | 2b | Изменение | P0 |
| `entities/ShopItem.entity.ts` | 2b | **Новый** | P0 |
| `entities/WelcomePageContent.entity.ts` | 2b | **Новый** | P0 |
| `entities/Shop.entity.ts` | 2b | Удалить/deprecate | P1 |
| `entities/WelcomePage.entity.ts` | 2b | Удалить/deprecate | P1 |
| `entities/ShopSetting.entity.ts` | 2b | Deprecate после миграции | P2 |
| `entities/WelcomePageSetting.entity.ts` | 2b | Deprecate после миграции | P2 |
| `entities/index.ts`, `crm.entities.ts` | 2b | Изменение | P0 |
| `common/constants/entity-names.ts` | 2b | Изменение | P0 |
| `database/migrations/1730000000004-AddForeignKeys.ts` | 2c | **Новый** | P0 |
| `database/migrations/1730000000005-PaymentShopWelcome.ts` | 2b | **Новый** | P0 |
| Все `entities/*.entity.ts` с FK | 2c | Изменение (relations) | P0 |

---

### `apps/api/src/modules/entities/entity-repository.service.ts`

#### Текущая архитектура

God Service: единая точка generic CRUD для 16 CRM Entity + User list. Инжектирует 16 TypeORM Repository через constructor (строки 51–68), строит `repoMap` (70–85) и `ENTITY_CLASS_MAP` (28–45). **Все CRM операции предполагают JSON-record модель** с полем `data`.

#### Классы / методы / DTO / Entity

| Метод | Строки | Текущее поведение | Целевое (2a) |
|-------|--------|-------------------|--------------|
| `constructor` | 51–86 | Inject 16 repos + UsersRepository | + inject/use mappers |
| `isKnownEntity` | 88–90 | User + ENTITY_NAMES | Без изменений |
| `list` | 92–110 | User: userToRecord; CRM: `{ id, ...r.data }` | CRM: `toRecord(row, entity)` |
| `applySortAndLimit` | 112–130 | localeCompare sort, slice limit | Использовать `sortRecords` из record.util |
| `filter` | 132–137 | In-memory `==` match | `matchesFilter` из record.util.ts:27-37 |
| `getById` | 139–156 | User OK; CRM: `...row.data` | `toRecord(row, entity)` |
| `create` | 158–176 | `repo.create({ id, data: input })` | `fromRecord(input)` → repo.create → save → toRecord |
| `update` | 178–188 | `row.data = { ...row.data, ...input }` | merge fromRecord partial on entity fields |
| `delete` | 190–193 | repo.delete | Без изменений |
| `bulkCreate` | 195–203 | loop create | Без изменений (uses fixed create) |
| `deleteRecordById` | 205–211 | scan all ENTITY_NAMES | Без изменений |
| `getRepo` | 213–217 | repoMap lookup | Без изменений |

**ENTITY_CLASS_MAP (28–45):** маппинг API name → Entity class (используется вне сервиса — export строка 220).

DTO отсутствуют — `Record<string, any>` everywhere.

#### Зависимости (импорты)

| Импорт | Строки | Назначение |
|--------|--------|------------|
| `@nestjs/typeorm`, `Repository` | 2–4 | DI repos |
| `ENTITY_NAMES`, `EntityName` | 5 | validation |
| 16 Entity from crm.entities | 7–23 | TypeORM classes |
| `userToRecord` | 25 | User mapper |
| `UsersRepository` | 26 | User list/get |

**Добавить (2a):**

```typescript
import { toRecord, fromRecord } from '../../common/mappers/entity-record.mapper';
import { matchesFilter, sortRecords } from '../../common/utils/record.util';
```

#### Кто вызывает

| Caller | Файл:строки | Operations |
|--------|-------------|------------|
| EntitiesController | entities.controller.ts:51,54,68,80,83,94,105 | list, filter, create, update, delete |
| AlfaBankService | alfabank.service.ts:30,35,73,105,114,119,124,132,135 | filter ShopSettings/Payment/Student, create/update Payment/Course |
| JobsService | jobs.service.ts:29,38,55,65-66,73,113,124-125,132,156,182,185 | filter/list/update Lesson, Student, Teacher, backup |
| SettingsService | settings.service.ts:16,21 | filter AppSettings |

#### Кого вызывает

- TypeORM `Repository.find/findOne/create/save/delete`
- `UsersRepository.findAll/findById`
- `userToRecord` для User

#### Поток данных (текущий — сломанный)

```
GET /entities/Student
  → list('Student')
    → repo.find() → StudentEntity rows (relational columns)
      → map r => ({ id, ...r.data })  // r.data undefined
        → { id, createdDate, updatedDate }  // пустой business payload
```

#### Поток данных (целевой — 2a)

```
GET /entities/Student
  → list('Student')
    → repo.find()
      → rows.map(r => toRecord(r, 'Student'))
        → { id, name, lesson_balance, ..., created_date, updated_date }  // snake_case
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 102–107 | Spread `r.data` — поле не существует после этапа 1 |
| P2 | 150–155 | getById — та же проблема |
| P3 | 168–173 | create пишет `data: input` — column dropped |
| P4 | 184–187 | update мутирует `row.data` |
| P5 | 105–106, 153–154 | Output `createdDate` camelCase — frontend ожидает `created_date` |
| P6 | 132–136 | filter не поддерживает `$contains` — ломает alfabank.service.ts:105-107 |
| P7 | 119–122 | applySortAndLimit не поддерживает `-created_date` desc sort |
| P8 | 28–45, 70–85 | Новая Entity = 4 места правки (SRP violation) |

#### Legacy

- Паттерн JsonRecord: `data` blob — наследие Base44
- `ENTITY_CLASS_MAP` export — compatibility

#### Удалить / Заменить

| Удалить | Заменить |
|---------|----------|
| `...r.data` (102-107, 150-155) | `toRecord(r, entity)` |
| `data: input` create (168-173) | `fromRecord(input, entity)` |
| `row.data` update (184-187) | Object.assign entity fields from fromRecord |
| Inline filter (132-136) | `matchesFilter(record, query)` |
| Inline sort (119-122) | `sortRecords(records, sortField)` |

#### Риски при изменении

- Неполный mapper → частично пустые поля в UI
- simple-array fields (student_ids) — comma serialization
- numeric columns returned as strings from PostgreSQL
- create/update must strip `id`, `created_date`, `updated_date` from input

#### Тесты после изменения

```bash
npm run build --prefix apps/api
# Manual / integration:
# GET /api/entities/Student → lesson_balance present
# POST /api/entities/Student { name, email, lesson_balance: 5 }
# PATCH /api/entities/Lesson/:id { status: 'completed' }
# POST /api/entities/Payment/filter { comment: { $contains: 'ALF-' } }
```

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| 102–107 | `rows.map(r => toRecord(r, entity))` | Relational Entity | Полные records | Mapper must cover all fields | GET Student |
| 132–136 | `matchesFilter(record, query)` | AlfaBank $contains | Webhook finds payment | Stricter type coercion | alfabank webhook test |
| 119–122 | `sortRecords` + limit slice | Frontend `-created_date` | Correct sort order | — | list?sort=-created_date |
| 150–155 | `toRecord(row, entity)` | getById parity | Single record complete | — | GET by id |
| 168–175 | `fromRecord` + save + return toRecord | create relational | INSERT into columns | Unknown fields ignored/stripped | POST Student |
| 184–187 | load entity, merge fromRecord partial | update relational | PATCH works | Partial update semantics | PATCH Lesson |

---

### `apps/api/src/modules/entities/entities.controller.ts`

#### Текущая архитектура

Generic REST controller `@Controller('entities')` (строка 29). Маршруты: list/filter/create/update/delete для `:entity` path param. Guards: OptionalJwt для GET (public WelcomePageSettings), JwtAuth для mutations.

#### Классы / методы / DTO / Entity

| Method | HTTP | Строки | Guard | Body/Query |
|--------|------|--------|-------|------------|
| `list` | GET `:entity` | 33–59 | OptionalJwt | query: sort, limit, filters |
| `filter` | POST `:entity/filter` | 61–69 | JwtAuth | body: filter object |
| `create` | POST `:entity` | 71–84 | JwtAuth | body or array |
| `update` | PATCH `:entity/:id` | 86–95 | JwtAuth | body partial |
| `remove` | DELETE `:entity/:id` | 97–108 | JwtAuth | — |
| `ensureEntity` | private | 110–116 | — | NotFound if unknown |
| `isPublicRead` | private | 118–122 | — | WelcomePageSettings |

DTO: **отсутствуют** — `Record<string, unknown>`.

#### Зависимости (импорты)

- `@nestjs/common` decorators — строки 1–13
- `EntityName`, `PUBLIC_READ_ENTITIES` — 15–18
- `JwtAuthGuard`, `OptionalJwtAuthGuard` — 20–23
- `CurrentUser`, `JwtPayload` — 25–26
- `EntityRepositoryService` — 27, 31

#### Кто вызывает

- Frontend `base44Client.js` — `/api/entities/:entity`
- Прямые HTTP clients (admin UI)

#### Кого вызывает

- `EntityRepositoryService.list/filter/create/update/delete`

#### Поток данных

```
Frontend snake_case JSON
  → EntitiesController (no transform)
    → EntityRepositoryService
      → (after 2a) toRecord snake_case JSON response
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 33–107 | Любой authenticated user — full CRUD all entities |
| P2 | 46–51 | Query string filters — no `$contains` in GET (only POST filter body) |
| P3 | — | Нет DTO validation |
| P4 | 118–122 | PUBLIC_READ WelcomePageSettings returns key/value until 2b |

#### Legacy

- Base44-compatible generic API — временный compatibility layer до этапа 6

#### Удалить / Заменить

- Этап 2: **без изменений контроллера** (mapper fix в service достаточно)
- Этап 6: deprecate → typed controllers

#### Риски при изменении

- Изменение response shape breaks frontend if mapper
 snake_case consistent

#### Тесты после изменения

- E2E через frontend pages: Schedule, Payments, ShopSettingsAdmin
- Unauthorized GET non-public entity → 401

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| — | Без изменений (2a) | Fix at service layer | Same routes, fixed data | — | UI smoke test |
| 46–51 | (опционально) parse `$contains` in query | GET filter parity | Rare | Security review | — |

---

### `apps/api/src/modules/entities/entities.module.ts`

#### Текущая архитектура

NestJS module: imports UsersModule + TypeOrmModule.forFeature(16 CRM entities), provides EntityRepositoryService, exports service for AlfaBank/Jobs/Settings.

#### Классы / методы / DTO / Entity

| Элемент | Строки | Содержимое |
|---------|--------|------------|
| `imports` | 26–45 | UsersModule, forFeature[16 entities] |
| `controllers` | 47 | EntitiesController |
| `providers` | 48 | EntityRepositoryService |
| `exports` | 49 | EntityRepositoryService |

**forFeature entities (28–44):** Student, Teacher, Lesson, Payment, Course, LessonMaterial, ScheduleSlot, LessonStudent, LessonBalance, TeacherPayment, MaterialAccess, TeacherAvailability, AlfaBankOrder, AppSetting, ShopSetting, WelcomePageSetting

#### Зависимости (импорты)

- `@nestjs/common`, `@nestjs/typeorm`
- 16 Entity from crm.entities — строки 3–20
- UsersModule, controller, service — 21–23

#### Кто вызывает

- `AppModule` — imports EntitiesModule (app.module.ts:55)

#### Кого вызывает

- TypeORM forFeature registration
- UsersModule (forward)

**Consumers of exported service:**

- AlfaBankModule, JobsModule, SettingsModule

#### Поток данных

```
Module bootstrap
  → Register 16 repositories in DI
    → EntityRepositoryService constructor injection
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 43–44 | ShopSettingEntity, WelcomePageSettingEntity — wrong domain model |
| P2 | — | ShopItemEntity, WelcomePageContentEntity not registered (2b) |
| P3 | — | UserEntity not in forFeature (OK — UsersModule) |

#### Legacy

- ShopSetting/WelcomePageSetting key-value entities

#### Удалить / Заменить (2b)

| Убрать | Добавить |
|--------|----------|
| ShopSettingEntity (после migration) | ShopItemEntity |
| WelcomePageSettingEntity (после migration) | WelcomePageContentEntity |

#### Риски при изменении

- EntityRepositoryService repoMap must sync with forFeature list
- AlfaBank filter `'ShopSettings'` — API name unchanged, maps to shop_items table

#### Тесты после изменения

```bash
npm run build --prefix apps/api
# Bootstrap test — app starts, inject ShopItem repo
```

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| 28–44 | 2a: без изменений | — | — | — | — |
| 43 | 2b: ShopItemEntity replaces ShopSettingEntity | Frontend catalog | Shop CRUD works | Update repoMap | ShopSettingsAdmin |
| 44 | 2b: WelcomePageContentEntity | Welcome editor | Public page content | PUBLIC_READ still works | WelcomePageEditor |

---

### `apps/api/src/common/utils/record.util.ts`

#### Текущая архитектура

Utility functions для record abstraction (legacy Base44 terminology). **matchesFilter и sortRecords реализованы, но EntityRepositoryService их не использует.**

#### Классы / методы / DTO / Entity

| Function | Строки | Signature | Описание |
|----------|--------|-----------|----------|
| `nowIso` | 1–3 | `(): string` | ISO timestamp |
| `recordFromEntity` | 5–18 | `(id, data, created, updated)` | Flatten json `data` + snake dates |
| `splitRecordPayload` | 20–25 | strip id/dates from input | For create/update |
| `matchesFilter` | 27–38 | `$contains`, array includes, strict === | Filter engine |
| `sortRecords` | 40–51 | `-field` desc support | Sort engine |

#### Зависимости (импорты)

- Нет — pure functions

#### Кто вызывает

| Caller | Строки | Usage |
|--------|--------|-------|
| `user.mapper.ts` | 2 | import recordFromEntity (unused in userToRecord body) |

**Должен вызывать (2a):**

- `entity-repository.service.ts` — filter, sort

#### Кого вызывает

- Никого

#### Поток данных

```
filter query { comment: { $contains: 'ALF-123' } }
  → matchesFilter(record, query)
    → String(record.comment).includes('ALF-123')
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 27–38 | Не используется в EntityRepositoryService.filter (132-136) |
| P2 | 40–51 | Не используется в applySortAndLimit (119-122) |
| P3 | 5–18 | `recordFromEntity` expects nested `data` — legacy |
| P4 | 36 | `==` vs `===` in old filter vs `===` in matchesFilter — behavior change |

#### Legacy

- `recordFromEntity` / `splitRecordPayload` — json_record era
- Terminology "record" — Base44

#### Удалить / Заменить

- Этап 2a: **использовать** matchesFilter, sortRecords
- Этап 8: удалить recordFromEntity если unused

#### Риски при изменении

- `$contains` case sensitivity
- Array filter: `record[key].includes(value)` — value type coercion

#### Тесты после изменения

```typescript
// Unit tests:
matchesFilter({ comment: 'Alfa Bank - ALF-1' }, { comment: { $contains: 'ALF-1' } }) === true
sortRecords([{ created_date: '2024-01-02' }, { created_date: '2024-01-01' }], '-created_date')
```

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| — | Wire into entity-repository.service | alfabank.service.ts:105-107 | Webhook works | Filter semantics change | integration test |
| 20–25 | Use in fromRecord / create | Strip meta fields | Clean inserts | — | POST create |
| 5–18 | Keep for transition or deprecate | — | — | — | grep usage |

---

### `apps/api/src/modules/users/user.mapper.ts`

#### Текущая архитектура

**Единственный рабочий mapper** в проекте. Преобразует UserEntity → snake_case API record. Используется EntityRepositoryService для User list/get (entity-repository.service.ts:95, 142).

#### Классы / методы / DTO / Entity

| Function | Строки | Input → Output |
|----------|--------|----------------|
| `userToRecord` | 4–19 | UserEntity → `{ id, email, role, first_name, last_name, phone, telegram_id, full_name, created_date, updated_date }` |
| `recordToUser` | 21–23 | Alias to userToRecord (misnamed — returns record, not UserEntity) |

#### Зависимости (импорты)

- `UserEntity` — строка 1
- `recordFromEntity` — строка 2 (**imported but unused**)

#### Кто вызывает

- `EntityRepositoryService.list/getById` для entity === 'User'

#### Кого вызывает

- Pure mapping — no I/O

#### Поток данных

```
UserEntity (camelCase columns)
  → userToRecord
    → snake_case API record with ISO date strings
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 21–23 | `recordToUser` returns Record, not UserEntity — dead/wrong name |
| P2 | 2 | Unused import recordFromEntity |
| P3 | — | No inverse mapper userFromRecord for generic create (User blocked anyway) |

#### Legacy

- Pattern template for all entity mappers

#### Удалить / Заменить

- Keep userToRecord as reference implementation
- New mappers should follow same date ISO pattern (строки 16–17)

#### Риски при изменении

- Low — User path already works

#### Тесты после изменения

- Auth login returns user with first_name, created_date
- GET /entities/User list

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| 2 | Remove unused import | Lint | Clean | — | build |
| — | Optional: integrate into entity-record.mapper dispatch | Consistency | Central registry | — | — |

---

### `apps/api/src/modules/alfabank/alfabank.service.ts`

#### Текущая архитектура

Payment gateway integration: init payment (register with Alfa API), webhook handler (checksum + balance update), check status. **Полностью зависит от EntityRepositoryService** с frontend field names (snake_case).

#### Классы / методы / DTO / Entity

| Method | Строки | Описание |
|--------|--------|----------|
| `constructor` | 10–15 | Inject EntityRepository, Settings, Telegram, Config |
| `init` | 17–83 | Create Payment, call Alfa register.do |
| `handleWebhook` | 85–154 | Verify checksum, update Payment, credit Student / create Course |
| `checkPaymentStatus` | 156–184 | Alfa getOrderStatusExtended |

#### Зависимости (импорты)

- `@nestjs/common`, `@nestjs/config`
- `crypto` — MD5 checksum
- `EntityRepositoryService` — строка 4
- `SettingsService`, `TelegramService` — 5–6

#### Кто вызывает

| Caller | Route/Context |
|--------|---------------|
| FunctionsController | `/api/functions/alfaBankInit` |
| WebhooksController | `/api/webhooks/alfabank` |
| FunctionsController | checkPaymentStatus |

#### Кого вызывает

| Call | Строки | Entity | Fields used |
|------|--------|--------|-------------|
| filter ShopSettings | 30 | ShopSettings | `item_id` — **missing in ShopSettingEntity** |
| create Payment | 35–43 | Payment | student_id, lessons_added, package_type, payment_date, comment, order_number — **missing in PaymentEntity** |
| filter Payment | 105–107 | Payment | comment `$contains` orderNumber |
| update Payment | 73-75, 114-116 | Payment | comment |
| filter/update Student | 119-124 | Student | lesson_balance, telegram_id |
| create Course | 135-144 | Course | snake_case fields |

#### Поток данных

```
alfaBankInit(itemId, studentId, amount)
  → filter ShopSettings by item_id  // FAIL: no item_id column
  → create Payment with lessons_added, order_number  // FAIL: columns missing
  → Alfa API register.do
  → update Payment comment

Webhook(orderNumber)
  → filter Payment { comment: { $contains: orderNumber } }  // FAIL: $contains not in repository
  → update Student lesson_balance
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 30 | ShopSettings filter by item_id — Entity has key/value only |
| P2 | 35–43 | Payment create uses non-existent Entity columns |
| P3 | 105–107 | `$contains` filter unsupported in repository |
| P4 | — | AlfaBankOrderEntity unused — should store order registry |
| P5 | 111–112 | Reads payment.student_id, payment.package_type from record — need mapper |
| P6 | 138 | course_type derived from comment string hack |

#### Legacy

- Payment as json blob with arbitrary fields
- ShopSettings as product catalog

#### Удалить / Заменить (2b)

| Текущее | Целевое |
|---------|---------|
| filter ShopSettings by item_id | filter ShopSettings → ShopItemEntity by item_id |
| create Payment ad-hoc fields | PaymentEntity columns + mapper |
| comment stores orderNumber for lookup | order_number column + optional AlfaBankOrderEntity.create |
| filter $contains on comment | filter by order_number exact or keep $contains on comment |

#### Риски при изменении

- In-flight pending payments during migration
- Webhook idempotency — double credit lesson_balance

#### Тесты после изменения

- E2E alfaBankInit → Payment row with lessons_added, order_number
- Webhook with valid checksum → Student lesson_balance incremented
- Telegram notification sent

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| 30 | filter ShopItem by item_id (API name ShopSettings) | 2b ShopItemEntity | shopItem.lessons | Entity name mapping | init flow |
| 35–43 | create Payment via mapper with new columns | PaymentEntity 2b | Persisted relational | Migration 0005 | DB inspect |
| 105–107 | filter by order_number OR $contains after 2a | Reliable lookup | Webhook match | — | webhook test |
| 45–75 | (optional) create AlfaBankOrderEntity row | Normalized orders | Audit trail | — | orders table |
| 111–124 | Use mapped fields lessons_added, package_type | Type safety | Balance update | — | integration |

---

### `apps/api/src/entities/Payment.entity.ts` (2b)

#### Текущая архитектура

Relational Payment entity — **не совпадает с frontend/AlfaBank контрактом**.

#### Текущие поля (строки 14–64)

studentId, lessonId, courseId, amount, currency, status, provider, externalId, paidAt, notes + timestamps

#### Frontend ожидает (Payments.jsx, PaymentFormDialog.jsx)

`student_name`, `lessons_added`, `payment_date`, `comment`, `amount`, `student_id`

#### AlfaBank ожидает (alfabank.service.ts:35-43)

`lessons_added`, `package_type`, `payment_date`, `comment`, `order_number`, `student_id`, `amount`

#### Планируемые новые колонки (2b)

| Property | Column | Type | Строки (новые) |
|----------|--------|------|----------------|
| studentName | student_name | text nullable | ~after studentId |
| lessonsAdded | lessons_added | int default 0 | |
| paymentDate | payment_date | date nullable | |
| comment | comment | text nullable | |
| orderNumber | order_number | text nullable, index | |
| packageType | package_type | text nullable | |

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| new | Add 6 columns | Frontend + AlfaBank | Full CRUD | Migration 0005 data backfill | Payments UI |
| 56–57 | Keep notes OR merge into comment | Duplication | Document mapping notes↔comment | — | — |

---

### `apps/api/src/entities/ShopItem.entity.ts` (2b — новый)

#### Планируемая архитектура

Замена key/value ShopSettingEntity для API name `ShopSettings`.

```typescript
@Entity('shop_items')
export class ShopItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'item_id', type: 'text' }) itemId: string;  // logical id for AlfaBank
  @Column({ type: 'text' }) label: string;
  @Column({ type: 'int', default: 0 }) lessons: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) price: number;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder: number;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @Column({ type: 'text', nullable: true }) type: string;  // package | course
  @Column({ type: 'text', nullable: true }) description: string;
  @CreateDateColumn({ name: 'created_date' }) createdDate: Date;
  @UpdateDateColumn({ name: 'updated_date' }) updatedDate: Date;
}
```

**Frontend ref:** ShopSettingsAdmin.jsx fields item_id, label, lessons, price, sort_order, is_active, type, description

#### Зависимости

- typeorm decorators
- Register in index.ts, crm.entities.ts, entities.module.ts, entity-repository repoMap

#### ENTITY_TABLE_MAP change (2b)

`ShopSettings: 'shop_items'` (entity-names.ts:42)

---

### `apps/api/src/entities/WelcomePageContent.entity.ts` (2b — новый)

#### Планируемая архитектура

Single-row (or keyed) welcome page content for API `WelcomePageSettings`.

```typescript
@Entity('welcome_pages')
export class WelcomePageContentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'school_name', type: 'text', nullable: true }) schoolName: string;
  @Column({ type: 'text' }) title: string;
  @Column({ type: 'text', nullable: true }) subtitle: string;
  @Column({ name: 'body_text', type: 'text', nullable: true }) bodyText: string;
  @Column({ name: 'info_text', type: 'text', nullable: true }) infoText: string;
  @CreateDateColumn({ name: 'created_date' }) createdDate: Date;
  @UpdateDateColumn({ name: 'updated_date' }) updatedDate: Date;
}
```

**Frontend ref:** WelcomePageEditor.jsx:7-12

#### ENTITY_TABLE_MAP change (2b)

`WelcomePageSettings: 'welcome_pages'`

---

### `apps/api/src/entities/Shop.entity.ts` / `WelcomePage.entity.ts` (deprecate)

#### Текущая архитектура

| File | Table | ALL_ENTITIES | Строки |
|------|-------|--------------|--------|
| Shop.entity.ts | shop_settings | **No** | 11–48 |
| WelcomePage.entity.ts | welcome_page_settings | **No** | 9–37 |

**Конфликт:** оба `@Entity` на те же таблицы что ShopSettingEntity / WelcomePageSettingEntity.

#### Планируемые изменения

- Удалить или stop exporting from crm.entities.ts:6-7
- Replace with ShopItemEntity / WelcomePageContentEntity

---

## Новые файлы — Mappers (2a)

### `apps/api/src/common/mappers/entity-record.mapper.ts`

#### Планируемая архитектура

Central dispatch registry:

```typescript
export function toRecord(entity: unknown, entityName: EntityName): Record<string, unknown>;
export function fromRecord(input: Record<string, unknown>, entityName: EntityName): Partial<unknown>;
```

Switch/map on entityName → delegate to per-entity mapper.

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| — | toRecord/fromRecord dispatch | DRY | Single import in repository | — | unit test |
| — | Handle User → userToRecord | Existing | Reuse | — | User list |

---

### Per-entity mappers (все новые)

| Файл | Entity | Критичные поля snake_case |
|------|--------|---------------------------|
| `student.mapper.ts` | Student | lesson_balance, assigned_teacher, user_id, first_name, telegram_id |
| `teacher.mapper.ts` | Teacher | hourly_rate, user_id, telegram_id |
| `lesson.mapper.ts` | Lesson | start_time, teacher_id, student_id, student_ids, lesson_format, reminder_24h_sent |
| `payment.mapper.ts` | Payment | student_id, amount; **2b:** lessons_added, payment_date, comment, order_number |
| `course.mapper.ts` | Course | course_type, total_lessons, completed_lessons, student_name |
| `lesson-material.mapper.ts` | LessonMaterial | file_url, file_type, course_id |
| `schedule-slot.mapper.ts` | ScheduleSlot | start_time, teacher_id, lesson_type |
| `lesson-student.mapper.ts` | LessonStudent | lesson_id, student_id, attendance_status |
| `lesson-balance.mapper.ts` | LessonBalance | student_id, lessons_available, lessons_used |
| `teacher-payment.mapper.ts` | TeacherPayment | teacher_id, lesson_id |
| `material-access.mapper.ts` | MaterialAccess | user_id, material_id, granted_by_role |
| `teacher-availability.mapper.ts` | TeacherAvailability | teacher_id, slots (array as-is) |
| `alfa-bank-order.mapper.ts` | AlfaBankOrder | order_number, alfa_order_id, item_id |
| `app-setting.mapper.ts` | AppSettings | key, value, is_active |
| `shop-setting.mapper.ts` | ShopSettings | **2a:** key,value; **2b:** replace with shop-item.mapper |
| `welcome-page-setting.mapper.ts` | WelcomePageSettings | **2b:** welcome-page-content.mapper |
| `user.mapper.ts` | User | already in modules/users — re-export or wrap |

#### Общий контракт mapper

**toRecord:**

- camelCase Entity property → snake_case API key
- Date → ISO string для created_date, updated_date, paid_at, payment_date
- numeric string → number where frontend expects number
- simple-array → string[] (split comma)

**fromRecord:**

- snake_case input → camelCase partial Entity
- Ignore unknown keys
- Strip id, created_date, updated_date on create (use splitRecordPayload)

#### Пример: `student.mapper.ts` (план)

```typescript
export function studentToRecord(row: StudentEntity): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    first_name: row.firstName ?? '',
    last_name: row.lastName ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    telegram_id: row.telegramId ?? '',
    assigned_teacher: row.assignedTeacher ?? null,
    lesson_balance: row.lessonBalance ?? 0,
    start_date: row.startDate ?? null,
    birthday: row.birthday ?? null,
    notes: row.notes ?? '',
    status: row.status,
    user_id: row.userId ?? null,
    created_date: row.createdDate.toISOString(),
    updated_date: row.updatedDate.toISOString(),
  };
}
```

#### Тесты после изменения (каждый mapper)

- Round-trip: fromRecord(toRecord(entity)) ⊆ entity fields
- Student lesson_balance integer
- Lesson student_ids array
- Payment 2b full round-trip

---

## План Relations (2c) — все Entity

Источник: `refactor-plan.md §7.2`, `02-domain.md` подэтап 2c.

### 1. User ↔ Student ↔ Teacher

| Entity | Relation | Decorator | FK Column | Строки (текущие) | onDelete |
|--------|----------|-----------|-----------|------------------|----------|
| StudentEntity | → TeacherEntity | @ManyToOne | assigned_teacher | 36–38 | SET NULL |
| StudentEntity | → UserEntity | @OneToOne | user_id | 59–60 | SET NULL |
| TeacherEntity | → UserEntity | @OneToOne | user_id | 46–47 | SET NULL |
| UserEntity | → StudentEntity | @OneToOne (inverse) | — | new | — |
| UserEntity | → TeacherEntity | @OneToOne (inverse) | — | new | — |
| TeacherEntity | → StudentEntity[] | @OneToMany | — | new | — |

**Migration 0004:** FK_students_assigned_teacher, FK_students_user_id, FK_teachers_user_id

**Проверка:** cannot assign invalid teacher_id; orphan audit before FK

### 2. Lesson ↔ Teacher ↔ ScheduleSlot

| Entity | Relation | FK Column | Строки |
|--------|----------|-----------|--------|
| LessonEntity | @ManyToOne → TeacherEntity | teacher_id | 30–32 |
| LessonEntity | @ManyToOne → ScheduleSlotEntity | schedule_slot_id | 26–28 |
| ScheduleSlotEntity | @OneToMany → LessonEntity | — | new |
| TeacherEntity | @OneToMany → LessonEntity | — | new |

### 3. LessonStudent

| Entity | Relation | FK | Constraint |
|--------|----------|-----|------------|
| LessonStudentEntity | @ManyToOne → LessonEntity | lesson_id | 22–24 |
| LessonStudentEntity | @ManyToOne → StudentEntity | student_id | 26–28 |
| — | UNIQUE(lesson_id, student_id) | — | new migration |

**Проблема:** Lesson.studentIds (56–57) дублирует — 2c документировать, удаление simple-array в этапе 8

### 4. Course, Payment, Materials

| Entity | Relation | FK Column | Строки |
|--------|----------|-----------|--------|
| CourseEntity | @ManyToOne → StudentEntity | student_id | 18–20 |
| PaymentEntity | @ManyToOne → StudentEntity | student_id | 18–20 |
| PaymentEntity | @ManyToOne → LessonEntity | lesson_id | 22–24 |
| PaymentEntity | @ManyToOne → CourseEntity | course_id | 26–28 |
| LessonMaterialEntity | @ManyToOne → CourseEntity | course_id | 39–41 |
| MaterialAccessEntity | @ManyToOne → UserEntity | user_id | 17–19 |
| MaterialAccessEntity | @ManyToOne → LessonMaterialEntity | material_id | 21–23 |
| CourseEntity | @OneToMany → LessonMaterialEntity | — | new |

**onDelete policy (ADR):**

- Payment → Student: RESTRICT (preserve financial records)
- LessonMaterial → Course: CASCADE or RESTRICT (TBD)
- MaterialAccess → User: CASCADE on user delete (TBD)

### 5. LessonBalance, TeacherPayment, TeacherAvailability, AlfaBankOrder, ScheduleSlot

| Entity | Relation | FK Column | Строки |
|--------|----------|-----------|--------|
| LessonBalanceEntity | @OneToOne → StudentEntity | student_id UNIQUE | 15–17 |
| TeacherPaymentEntity | @ManyToOne → TeacherEntity | teacher_id | 17–19 |
| TeacherPaymentEntity | @ManyToOne → LessonEntity | lesson_id | 21–23 |
| LessonEntity | @ManyToOne → TeacherPaymentEntity | teacher_payment_id | 122–123 |
| TeacherAvailabilityEntity | @ManyToOne → TeacherEntity | teacher_id | 15–17 |
| AlfaBankOrderEntity | @ManyToOne → StudentEntity | student_id | 18–20 |
| ScheduleSlotEntity | @ManyToOne → TeacherEntity | teacher_id | 19–21 |

### 6. ShopItem (2b) — relations опционально

- ShopItem — standalone catalog, no FK initially
- AlfaBankOrder.itemId — logical reference, FK to shop_items.id optional in 2c

### Migration `1730000000004-AddForeignKeys.ts`

```sql
-- Example:
ALTER TABLE students ADD CONSTRAINT FK_students_assigned_teacher
  FOREIGN KEY (assigned_teacher) REFERENCES teachers(id) ON DELETE SET NULL;
-- Repeat for all relations above
-- Pre-migration: SELECT orphan rows, fix or delete
```

**down():** DROP CONSTRAINT FK_*

---

## Migration `1730000000005-PaymentShopWelcome.ts` (2b)

| Действие | Описание |
|----------|----------|
| ALTER payments | ADD student_name, lessons_added, payment_date, comment, order_number, package_type |
| CREATE shop_items | Full catalog schema |
| CREATE welcome_pages | Content schema |
| Data migration | shop_settings json/key-value → shop_items rows; welcome key-value → welcome_pages |
| (optional) | Migrate Payment fields from old json data column if 0002 missed legacy keys |

---

## Чек-лист выполнения

### 2a — Mapper + Repository

- [ ] `common/mappers/entity-record.mapper.ts` создан
- [ ] 16 CRM mappers + User integration
- [ ] entity-repository.service.ts: list/get/create/update без `row.data`
- [ ] matchesFilter подключён (alfabank $contains)
- [ ] sortRecords поддерживает `-created_date`
- [ ] API returns snake_case including created_date, updated_date
- [ ] `npm run build` OK

### 2b — Payment / Shop / Welcome

- [ ] Payment.entity.ts — новые колонки
- [ ] ShopItem.entity.ts, WelcomePageContent.entity.ts созданы
- [ ] index.ts, crm.entities.ts, entities.module.ts, entity-names.ts обновлены
- [ ] entity-repository repoMap + forFeature sync
- [ ] payment.mapper.ts, shop-item.mapper.ts, welcome-page-content.mapper.ts
- [ ] Migration 0005 applied
- [ ] alfabank.service.ts использует новые поля / ShopItem
- [ ] ShopSettingsAdmin, Payments, WelcomePageEditor smoke test

### 2c — Relations

- [ ] All @ManyToOne/@OneToMany/@OneToOne per plan
- [ ] Migration 0004 FK constraints
- [ ] Orphan data audit clean
- [ ] TypeORM metadata без errors
- [ ] `\d lessons` shows FK references

---

## Definition of Done

1. **2a:** `GET /api/entities/Student` возвращает `lesson_balance`, `created_date`; `POST`/`PATCH` persist relational columns; AlfaBank webhook находит payment by `$contains` or order_number
2. **2b:** Payments CRUD с lessons_added, payment_date, comment; Shop seed/create; Welcome save/load; нет key/value для catalog/content
3. **2c:** PostgreSQL FK constraints на всех planned relations; TypeORM relations load without error
4. **Build:** `npm run build --prefix apps/api` green
5. **No regression:** User auth path still works (userToRecord)
6. **Jobs:** Lesson reminders read teacher_id, start_time, lesson_balance correctly

---

## Зависимости от других этапов

| Этап | Зависимость |
|------|-------------|
| **1 Database** | **BLOCKER** — columns must exist before mapper |
| **0 ADR** | Payment/Shop/Welcome field decisions for 2b |
| **3 Services** | Consumes fixed repository; replaces God Service later |
| **4 API** | Typed controllers replace generic |
| **7 Testing** | Mapper unit tests, migration integration |

---

## Параллельная работа

| Параллельно | Условие |
|-------------|---------|
| 2a mappers per entity | После этапа 1 migration 0001 |
| 2b Payment Entity + 2c relations on different files | После этапа 1; не same file |
| 2a student/lesson mappers | Independent files |

| **Запрещено параллельно** | Причина |
|---------------------------|---------|
| 2b удалить ShopSettingEntity | До ShopItemEntity + migration 0005 |
| 2c FK before 0001 relational columns | FK targets must exist |
| 2a on prod without migration | Columns missing → runtime errors |

---

## Запрещено начинать раньше

1. **Любой подэтап 2** — до завершения [01-database-spec.md](./01-database-spec.md) migration 0001 (минимум)
2. **2b migration 0005** — до 0003 drop data (или explicit handling)
3. **2c migration 0004** — до relational schema stable
4. **Удаление ShopSettingEntity / WelcomePageSettingEntity** — до ShopItem + WelcomePageContent + mappers + data migration
5. **Production deploy** mapper-only без database stage — partial fix insufficient on jsonb prod
