> **HISTORICAL / COMPLETED (JSONB migration finished).**
> This file describes an earlier plan/audit that mentioned `data jsonb`, `slots jsonb`, or legacy JSON storage.
> **Current architecture:** relational CRM entities; TeacherAvailability via `teacher_availability_slots`; Assessment via snapshot tables; **no JSONB for business entities**.
> See [../Database.md](../Database.md) and [../architecture/storage-policy.md](../architecture/storage-policy.md).

# Этап 2: Domain (Mapper, Entity fix, Relations)

**Предшественник:** [01-database.md](./01-database.md)  
**Следующий:** [03-services.md](./03-services.md)  
**Трудоёмкость:** 56–92 ч (2a + 2b + 2c)

Три подэтапа: **2a** mapper, **2b** domain entities, **2c** relations.

---

# Подэтап 2a: Entity Mapper + EntityRepositoryService

## Цель

Сделать generic `/entities/*` временно рабочим без `row.data`.

## Зачем

Frontend и AlfaBank/Jobs/Settings зависят от EntityRepositoryService. Это fastest path к working app.

## Файлы

- `modules/entities/entity-repository.service.ts`
- `common/mappers/*.ts` (новые)
- `common/utils/record.util.ts`

## Entity

Все 16 CRM + User (list).

## Зависимые сервисы

EntityRepositoryService, SettingsService, AlfaBankService, JobsService, EntitiesController.

## Риски

Средние: неполный mapper → частично пустые поля.

## Критерии завершения

- [ ] list/create/update/filter без `row.data`
- [ ] API возвращает snake_case (`lesson_balance`, `created_date`)
- [ ] `$contains` filter работает (AlfaBank webhook)
- [ ] `npm run build` OK

---

### Этап 2a — common

#### Модуль: common/mappers

##### Файл: `apps/api/src/common/mappers/entity-record.mapper.ts` (новый)

###### Изменение: `toRecord(entity, entityName)`, `fromRecord(input, entityName)`

- **Причина:** центральный snake_case ↔ camelCase
- **Что может сломаться:** поля без маппинга
- **Как проверить:** unit test round-trip Student

##### Файл: `apps/api/src/common/mappers/student.mapper.ts` (новый)

###### Изменение: StudentEntity ↔ API record

- **Причина:** lesson_balance, assigned_teacher, user_id
- **Что может сломаться:** Payments, Schedule UI
- **Как проверить:** GET /entities/Student → lesson_balance present

##### Файл: `apps/api/src/common/mappers/lesson.mapper.ts` (новый)

###### Изменение: LessonEntity ↔ record (start_time, student_ids arrays)

- **Причина:** Jobs reminders, Schedule
- **Что может сломаться:** simple-array serialization
- **Как проверить:** filter Lesson by status=planned

##### Файл: `apps/api/src/common/mappers/payment.mapper.ts` (новый)

###### Изменение: временный mapper; часть полей — stubs до 2b

- **Причина:** подготовка к Payment redesign
- **Что может сломаться:** Payments page
- **Как проверить:** после 2b — full round-trip

*(Аналогичные mappers: teacher, course, lesson-material, schedule-slot, lesson-student, lesson-balance, teacher-payment, material-access, teacher-availability, alfa-bank-order, app-setting, shop-setting, welcome-page-setting, user)*

#### Модуль: common/utils

##### Файл: `apps/api/src/common/utils/record.util.ts`

###### Изменение: использовать `matchesFilter` в EntityRepositoryService.filter

- **Причина:** AlfaBank `$contains` (`alfabank.service.ts:105-107`)
- **Что может сломаться:** exact match filters
- **Как проверить:** AlfaBank webhook находит payment by order_number

#### Модуль: entities

##### Файл: `apps/api/src/modules/entities/entity-repository.service.ts`

###### Изменение: list — `toRecord(row, entity)` вместо `...r.data`

- **Причина:** `entity-repository.service.ts:102-107`
- **Что может сломаться:** все list endpoints
- **Как проверить:** GET /entities/Student

###### Изменение: create — `repo.create(fromRecord(input))` + save

- **Причина:** `entity-repository.service.ts:168-175`
- **Что может сломаться:** create с unknown fields
- **Как проверить:** POST /entities/Student

###### Изменение: update — merge fromRecord partial

- **Причина:** `entity-repository.service.ts:184-187`
- **Что может сломаться:** partial updates
- **Как проверить:** PATCH lesson status

###### Изменение: output `created_date`/`updated_date` ISO strings

- **Причина:** frontend ожидает snake_case dates
- **Что может сломаться:** sort by -created_date
- **Как проверить:** list with sort

---

# Подэтап 2b: Domain Entity fix (Payment, Shop, Welcome)

## Цель

Согласовать Entity с frontend-контрактами.

## Зачем

Payment, ShopSettingsAdmin, WelcomePageEditor полностью сломаны на уровне модели.

## Entity

PaymentEntity, ShopItemEntity (new), WelcomePageContentEntity (new), удалить дубли.

## Зависимые сервисы

AlfaBankService, EntitiesController, frontend pages.

## Критерии завершения

- [ ] Payments CRUD с lessons_added, payment_date, comment
- [ ] ShopSettingsAdmin seed/create работает
- [ ] WelcomePageEditor save/load работает
- [ ] Migration 1730000000005 applied

---

### Этап 2b — entities

#### Модуль: entities

##### Файл: `apps/api/src/entities/Payment.entity.ts`

###### Изменение: добавить columns

```typescript
studentName, lessonsAdded, paymentDate, comment, orderNumber, packageType, studentName
```

- **Причина:** frontend `Payments.jsx`, AlfaBank service
- **Что может сломаться:** существующие Payment rows
- **Как проверить:** create payment via UI

##### Файл: `apps/api/src/entities/ShopItem.entity.ts` (новый)

###### Изменение: `@Entity('shop_items')` с полями item_id, label, lessons, price, sort_order, is_active, type, description

- **Причина:** `ShopSettingsAdmin.jsx:5-18`
- **Что может сломаться:** AlfaBank filter by item_id
- **Как проверить:** seed defaults

##### Файл: `apps/api/src/entities/WelcomePageContent.entity.ts` (новый)

###### Изменение: `@Entity('welcome_pages')` — school_name, title, subtitle, body_text, info_text

- **Причина:** `WelcomePageEditor.jsx:7-12`
- **Что может сломаться:** public Welcome page
- **Как проверить:** GET WelcomePageSettings list (mapper alias)

##### Файл: `apps/api/src/entities/Shop.entity.ts`

###### Изменение: удалить или deprecate

- **Причина:** конфликт table name
- **Что может сломаться:** imports в crm.entities.ts
- **Как проверить:** build

##### Файл: `apps/api/src/entities/ShopSetting.entity.ts`

###### Изменение: оставить только для App-level KV если нужно; иначе удалить после миграции shop_items

- **Причина:** разделение shop catalog vs settings
- **Что может сломаться:** entity name ShopSettings в API
- **Как проверить:** ENTITY_NAMES points to ShopItemEntity

##### Файл: `apps/api/src/entities/index.ts`, `crm.entities.ts`

###### Изменение: ALL_ENTITIES, exports — ShopItemEntity, WelcomePageContentEntity

- **Причина:** регистрация TypeORM
- **Что может сломаться:** forFeature list
- **Как проверить:** app bootstrap

##### Файл: `apps/api/src/common/constants/entity-names.ts`

###### Изменение: ShopSettings → shop_items table mapping; WelcomePageSettings → welcome_pages

- **Причина:** ENTITY_TABLE_MAP sync
- **Что может сломаться:** backup export keys
- **Как проверить:** exportBackup entity list

##### Файл: `apps/api/src/modules/entities/entities.module.ts`

###### Изменение: forFeature новые Entity, убрать старые shop/welcome key-value

- **Причина:** DI repositories
- **Что может сломаться:** EntityRepositoryService repoMap
- **Как проверить:** inject ShopItem repo

#### Модуль: database

##### Файл: `apps/api/src/database/migrations/1730000000005-PaymentShopWelcome.ts` (новый)

###### Изменение: ALTER payments; CREATE shop_items, welcome_pages; data migration from json/key-value

- **Причина:** schema sync
- **Что может сломаться:** prod shop data
- **Как проверить:** migration up/down

#### Модуль: alfabank

##### Файл: `apps/api/src/modules/alfabank/alfabank.service.ts`

###### Изменение: filter ShopSettings → ShopItem by item_id; create Payment с новыми полями; использовать AlfaBankOrderEntity

- **Причина:** `alfabank.service.ts:30-43`
- **Что может сломаться:** payment flow
- **Как проверить:** alfaBankInit function E2E

---

# Подэтап 2c: TypeORM Relations + FK

## Цель

Добавить `@ManyToOne` / `@OneToMany` / FK constraints.

## Зачем

Referential integrity, joins, удаление orphan data.

## Entity

Все с FK columns (см. [audit/entities.md](../audit/entities.md)).

## Критерии завершения

- [ ] Migration 1730000000004 applied
- [ ] TypeORM metadata без errors
- [ ] Orphan audit clean или documented

---

### Этап 2c — entities (порядок)

#### 1. User ↔ Student ↔ Teacher

##### `Student.entity.ts`, `Teacher.entity.ts`, `user.entity.ts`

- `@ManyToOne(() => TeacherEntity)` on assignedTeacher
- `@OneToOne(() => UserEntity)` on userId
- **Проверить:** cannot assign invalid teacher_id

#### 2. Lesson ↔ Teacher ↔ ScheduleSlot

##### `Lesson.entity.ts`

- `@ManyToOne(() => TeacherEntity)`
- `@ManyToOne(() => ScheduleSlotEntity)`
- **Проверить:** lesson create with teacher_id

#### 3. LessonStudent

##### `LessonStudent.entity.ts`

- `@ManyToOne(() => LessonEntity)`, `@ManyToOne(() => StudentEntity)`
- UNIQUE(lesson_id, student_id)
- **Проверить:** group lesson enrollment

#### 4. Course, Payment, Materials

##### `Course.entity.ts`, `Payment.entity.ts`, `LessonMaterial.entity.ts`, `MaterialAccess.entity.ts`

- Standard ManyToOne chains
- **Проверить:** delete student blocked if payments exist (onDelete policy)

#### Модуль: database

##### Файл: `1730000000004-AddForeignKeys.ts`

- ADD CONSTRAINT FK_* REFERENCES
- **Проверить:** `\d lessons` shows FK

---

## Параллельная работа в этапе 2

| 2a mappers | 2b Payment/Shop | 2c relations |
|------------|---------------|--------------|
| Можно начать сразу после этапа 1 | После ADR этапа 0 | После этапа 1; параллельно с 2b на разных файлах |

**Запрещено:** удалять ShopSettingEntity до готовности ShopItemEntity + migration.

## Frontend / Telegram / API

| Слой | Этап 2 |
|------|--------|
| Frontend | Без изменений (mapper чинит) |
| Telegram | Jobs reminders заработают после 2a |
| API | Тот же `/entities/*`, но корректные данные |
