# Этап 1: Database (PostgreSQL) — Техническая спецификация

## Мета

| Поле | Значение |
|------|----------|
| **Цель** | Привести PostgreSQL schema в полное соответствие с TypeORM Entity: реляционные колонки вместо `data jsonb`, единое имя таблицы `teacher_availability`, отключение `synchronize` в dev |
| **Зачем** | Без этого этапа production (`migrationsRun: true`, `app.module.ts:41`) создаёт JSON-таблицы (`InitialSchema.ts:44-52`), а Entity ожидают 15+ колонок на таблицу → TypeORM INSERT/SELECT падает с 500, API возвращает пустые records, FK невозможны |
| **Трудоёмкость** | 16–24 ч (roadmap `01-database.md`) |
| **Предшественники** | [Этап 0: Подготовка](../refactor-roadmap.md#этап-0-подготовка-и-фиксация-решений) — утверждённые ADR для Payment/Shop/Welcome (временные колонки shop/welcome допустимы до этапа 2b) |
| **Следующий этап** | [02-domain-spec.md](./02-domain-spec.md) — Entity Mapper + EntityRepositoryService |

---

## Файлы этапа (таблица)

| Файл | Тип изменения | Приоритет | Блокирует |
|------|---------------|-----------|-----------|
| `apps/api/src/app.module.ts` | Изменение | P0 | Единая schema dev/prod |
| `apps/api/src/database/data-source.ts` | Изменение | P0 | CLI `migration:run` |
| `apps/api/src/database/migrations/1730000000000-InitialSchema.ts` | Без изменений (историческая) | — | База для up/down chain |
| `apps/api/src/database/migrations/1730000000001-RelationalSchema.ts` | **Новый** | P0 | Реляционные таблицы |
| `apps/api/src/database/migrations/1730000000002-MigrateJsonbData.ts` | **Новый** | P0 | Сохранение prod data |
| `apps/api/src/database/migrations/1730000000003-DropJsonbColumn.ts` | **Новый** | P0 | Удаление legacy `data` |
| `apps/api/src/common/constants/entity-names.ts` | Изменение (строка 39) | P0 | Синхронизация имён таблиц |
| `apps/api/src/entities/TeacherAvailability.entity.ts` | Подтверждение (без изменений) | P1 | Имя таблицы |
| `apps/api/src/entities/index.ts` | Без изменений на этапе 1 | — | Регистрация Entity |
| Все `apps/api/src/entities/*.entity.ts` | Справочник колонок (см. сводку) | P0 | DDL в migration 0001 |
| `apps/api/src/database/scripts/import-json.ts` | Косвенно затронут | P2 | После drop `data` — переписать импорт |

---

### `apps/api/src/app.module.ts`

#### Текущая архитектура

Корневой NestJS-модуль. Регистрирует `TypeOrmModule.forRootAsync` (строки 33–44) с `ALL_ENTITIES` из `entities/index.ts:24-42`. В development `synchronize: true` (строка 39), в production `migrationsRun: true` (строка 41). Migrations подключаются glob-паттерном (строка 40), но `data-source.ts` для CLI использует явный массив — **расхождение CLI vs runtime**.

#### Классы / методы / DTO / Entity

| Элемент | Строки | Описание |
|---------|--------|----------|
| `AppModule` | 25–68 | `@Module` с imports: Config, TypeORM, Schedule, ServeStatic, feature modules |
| `TypeOrmModule.forRootAsync.useFactory` | 35–43 | Фабрика подключения PostgreSQL |
| `ALL_ENTITIES` | 9, 38 | Массив из 18 Entity-классов (User + 17 CRM) |
| `serveFrontend` | 23,  ("serveFrontend") | Условный ServeStaticModule |

DTO на этом этапе не затрагиваются.

#### Зависимости (импорты)

| Импорт | Строка | Назначение |
|--------|--------|------------|
| `@nestjs/config` | 2 | ConfigModule, ConfigService |
| `@nestjs/typeorm` | 5 | TypeOrmModule |
| `./entities` → `ALL_ENTITIES` | 9 | Entity metadata |
| `./config/configuration` | 7 | databaseUrl, nodeEnv |
| Feature modules | 10–21 | Users, Entities, Auth, … |

#### Кто вызывает

- `main.ts` — bootstrap NestJS application
- NestJS DI container — инициализация TypeORM при старте

#### Кого вызывает

- `ConfigService.get('databaseUrl')` — строка 37
- `ConfigService.get('nodeEnv')` — строки 39, 41, 42
- TypeORM — auto-load migrations из `database/migrations/*`

#### Поток данных

```
process.env / .env
  → ConfigModule (configuration.ts)
    → TypeOrmModule.forRootAsync
      → PostgreSQL connection
        → dev: synchronize создаёт/alter columns по Entity
        → prod: migrationsRun выполняет InitialSchema (jsonb)
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 39 | `synchronize: nodeEnv !== 'production'` — dev создаёт реляционные колонки поверх JSON-схемы или наоборот |
| P2 | 40–41 | Glob migrations в runtime vs явный массив в `data-source.ts:10` — разный набор migrations для CLI и prod |
| P3 | 41 | `migrationsRun: true` только в prod → InitialSchema создаёт `data jsonb`, Entity ожидают columns |

#### Legacy

- Паттерн «dev synchronize / prod migrations» — наследие Base44 migration
- `ServeStaticModule` (46–52) — не относится к database, но в том же модуле

#### Удалить / Заменить

| Что | Заменить на |
|-----|-------------|
| `synchronize: true` (строка 39) | `synchronize: false` для **всех** env |
| Implicit reliance on synchronize | Обязательный `npm run migration:run` локально |

#### Риски при изменении

- Локальная БД без migrations не стартует — документировать в README
- Разработчики с «грязной» dev-БД от synchronize — нужен `migration:revert` или recreate DB

#### Тесты после изменения

```bash
npm run migration:run --prefix apps/api
npm run start:dev --prefix apps/api
npm run build --prefix apps/api
```

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| 39 | `synchronize: false` | `refactor-plan.md §2.3`, §8.4 | dev/prod одна schema через migrations | Локальный старт только после migration:run | `start:dev` после migration:run |
| 39–41 | (опционально) `migrationsRun: true` и в dev | Единообразие | Автоприменение migrations при старте | Медленнее cold start | Лог TypeORM «Migration X has been executed» |

---

### `apps/api/src/database/data-source.ts`

#### Текущая архитектура

Standalone TypeORM `DataSource` для CLI (`typeorm migration:run`, `import-json.ts:5`). Явно импортирует только `InitialSchema1730000000000` (строки 4, 10). `synchronize: false` (строка 11) — **корректно**, но расходится с `app.module.ts:39`.

#### Классы / методы / DTO / Entity

| Элемент | Строки | Описание |
|---------|--------|----------|
| `default DataSource` | 6–12 | Экспорт для TypeORM CLI |
| `ALL_ENTITIES` | 3, 9 | Entity metadata |
| `InitialSchema1730000000000` | 4, 10 | Единственная migration |

#### Зависимости (импорты)

- `reflect-metadata` — строка 1
- `typeorm/DataSource` — строка 2
- `../entities` — ALL_ENTITIES
- `./migrations/1730000000000-InitialSchema` — InitialSchema class

#### Кто вызывает

- TypeORM CLI (`package.json` scripts migration:*)
- `database/scripts/import-json.ts:5` — `import dataSource from '../data-source'`

#### Кого вызывает

- PostgreSQL через `process.env.DATABASE_URL` (строка 8)

#### Поток данных

```
DATABASE_URL
  → DataSource.initialize()
    → migrations: [InitialSchema only]
      → CREATE TABLE users + jsonb tables
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 10 | Только InitialSchema — migrations 0001–0003 не будут выполнены CLI |
| P2 | 11 vs app.module.ts:39 | data-source synchronize false, app dev synchronize true |

#### Legacy

- Явный import одной migration вместо glob — legacy от первой итерации

#### Удалить / Заменить

- Добавить imports и entries для `RelationalSchema1730000000001`, `MigrateJsonbData1730000000002`, `DropJsonbColumn1730000000003`

#### Риски при изменении

- Неверный порядок в массиве `migrations` → FK/column errors
- Забыть `.js` compiled paths в production CLI

#### Тесты после изменения

```bash
npm run migration:run --prefix apps/api
npm run migration:show --prefix apps/api  # если есть script
```

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| 4 | import RelationalSchema, MigrateJsonbData, DropJsonbColumn | CLI parity | 4 migrations в chain | — | migration:show 4 entries |
| 10 | `migrations: [Initial, 0001, 0002, 0003]` | Порядок up | Полный pipeline | — | migration:run на чистой БД |

---

### `apps/api/src/database/migrations/1730000000000-InitialSchema.ts`

#### Текущая архитектура

Первая migration. Создаёт `users` с реляционными колонками (строки 7–21) и 16 CRM-таблиц в формате `id + data jsonb + timestamps` (строки 24–53). JSON-индексы на `data->>'...'` (строки 55–70). Down (73–97) DROP всех таблиц.

#### Классы / методы / DTO / Entity

| Элемент | Строки | Описание |
|---------|--------|----------|
| `InitialSchema1730000000000` | 3–4 | implements MigrationInterface |
| `up()` | 6–71 | CREATE users + jsonTables loop |
| `down()` | 73–97 | DROP tables reverse order |
| `jsonTables` | 24–41, 74–91 | 16 имён таблиц |

#### Зависимости (импорты)

- `typeorm` — MigrationInterface, QueryRunner

#### Кто вызывает

- TypeORM migrations runner (prod `migrationsRun`, CLI)
- Записана в `data-source.ts:10`

#### Кого вызывает

- `queryRunner.query()` — raw SQL DDL

#### Поток данных

```
migration:run (prod first deploy)
  → CREATE users (relational)
  → CREATE students..welcome_page_settings (id, data jsonb)
  → CREATE INDEX on data->>'key' etc.
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 36 | `'teacher_availabilities'` — Entity `@Entity('teacher_availability')` TeacherAvailability.entity.ts:10 |
| P2 | 44–52 | `data jsonb NOT NULL DEFAULT '{}'` — противоречит всем CRM Entity |
| P3 | 55–70 | Индексы на json path — бесполезны после relational migration |
| P4 | 26–40 | Нет таблицы `users` в jsonTables — OK, users уже relational |

#### Legacy

- Полная JSON-record schema — архитектура Base44
- Имя `teacher_availabilities` — legacy plural

#### Удалить / Заменить

- **Не удалять** migration 0000 — историческая цепочка; новые 0001–0003 **ALTER** существующие таблицы
- Альтернатива (не рекомендуется): replace 0000 — ломает уже применённые prod DB

#### Риски при изменении

- Изменение 0000 на deployed prod — checksum mismatch TypeORM migrations table

#### Тесты после изменения

- 0000 остаётся без изменений; тестировать 0001–0003 **после** 0000

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| — | **Без изменений** | Migration immutability | Chain integrity | — | — |

---

### `apps/api/src/common/constants/entity-names.ts`

#### Текущая архитектура

Константы API-имён сущностей (`ENTITY_NAMES`), публичное чтение (`PUBLIC_READ_ENTITIES`), маппинг API name → table name (`ENTITY_TABLE_MAP`).

#### Классы / методы / DTO / Entity

| Элемент | Строки | Описание |
|---------|--------|----------|
| `ENTITY_NAMES` | 1–18 | 16 CRM names (без User) |
| `EntityName` | 20 | union type |
| `PUBLIC_READ_ENTITIES` | 22–24 | `WelcomePageSettings` |
| `ENTITY_TABLE_MAP` | 26–44 | Record EntityName → table |

#### Зависимости (импорты)

- Нет внешних импортов — чистый constants file

#### Кто вызывает

| Файл | Использование |
|------|---------------|
| `entity-repository.service.ts:5,89` | ENTITY_NAMES, EntityName |
| `entities.controller.ts:15-18` | EntityName, PUBLIC_READ_ENTITIES |
| `jobs.service.ts:4,156` | ENTITY_NAMES (backup export) |
| `database/scripts/import-json.ts` | Косвенно через entity names |

#### Кого вызывает

- Никого (данные)

#### Поток данных

```
HTTP /entities/:entity
  → ensureEntity → EntityName
    → ENTITY_TABLE_MAP[entity] → SQL table (не используется напрямую в repository — TypeORM Entity metadata)
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 39 | `TeacherAvailability: 'teacher_availabilities'` ≠ Entity table `teacher_availability` |
| P2 | 42–43 | `ShopSettings: 'shop_settings'`, `WelcomePageSettings: 'welcome_page_settings'` — key/value schema до этапа 2b |

#### Legacy

- Plural `teacher_availabilities` — от InitialSchema.ts:36

#### Удалить / Заменить

| Строка | Было | Станет (этап 1) |
|--------|------|-----------------|
| 39 | `'teacher_availabilities'` | `'teacher_availability'` |

Этап 2b: строки 42–43 → `shop_items`, `welcome_pages` (не в scope этапа 1).

#### Риски при изменении

- `import-json.ts`, backup scripts grep по table name
- Jobs backup (`jobs.service.ts:156`) — entity list, не table name

#### Тесты после изменения

```bash
rg teacher_availabilities apps/api/src  # ожидание: 0 (кроме InitialSchema, down migration)
```

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| 39 | `'teacher_availability'` | Sync с Entity + migration 0001 rename | Единое имя | import-json если hardcoded | grep + migration:run |

---

### `apps/api/src/entities/TeacherAvailability.entity.ts`

#### Текущая архитектура

TypeORM Entity для доступности преподавателя. Таблица `teacher_availability` (строка 10). Колонки: `teacher_id`, `slots` (jsonb), timestamps.

#### Классы / методы / DTO / Entity

| Property | Column | Строки | Type |
|----------|--------|--------|------|
| `id` | id | 12–13 | uuid PK |
| `teacherId` | teacher_id | 15–17 | uuid, indexed |
| `slots` | slots | 26–31 | jsonb array `{day, from, to}[]` |
| `createdDate` | created_date | 33–34 | timestamptz |
| `updatedDate` | updated_date | 36–37 | timestamptz |

#### Зависимости (импорты)

- `typeorm` decorators — строки 1–8

#### Кто вызывает

- `EntityRepositoryService` — TeacherAvailability repo (entity-repository.service.ts:63,81)
- `entities.module.ts:40` — forFeature
- `ALL_ENTITIES` — index.ts:37

#### Кого вызывает

- TypeORM → PostgreSQL table `teacher_availability`

#### Поток данных

```
GET /entities/TeacherAvailability
  → EntityRepositoryService.list (broken: r.data)
  → TeacherAvailabilityEntity metadata → table teacher_availability
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 10 vs InitialSchema:36 | Table name mismatch: Entity `teacher_availability`, migration `teacher_availabilities` |
| P2 | 26–31 | `slots` jsonb — временно допустимо на этапе 1 (roadmap); нарушение long-term no-JSON policy |
| P3 | entity-names.ts:39 | Constants map wrong table name |

#### Legacy

- JSONB slots — компромисс до нормализации `TeacherAvailabilitySlotEntity` (post-refactor)

#### Удалить / Заменить

- На этапе 1: **подтвердить** `@Entity('teacher_availability')` без изменений
- Migration 0001: `ALTER TABLE teacher_availabilities RENAME TO teacher_availability` + ADD columns

#### Риски при изменении

- Prod data в `teacher_availabilities.data` → migration 0002 must map slots from json

#### Тесты после изменения

```sql
\d teacher_availability
SELECT column_name FROM information_schema.columns WHERE table_name='teacher_availability';
```

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| 10 | Без изменений | Стандарт имени | Entity metadata = DB | — | TypeORM sync metadata |
| 26–31 | Без изменений (этап 1) | slots jsonb временно | DDL includes jsonb column | — | INSERT slots array |

---

### `apps/api/src/entities/index.ts`

#### Текущая архитектура

Barrel export + массив `ALL_ENTITIES` для TypeORM registration (24–42). Импортирует 17 CRM entities из `crm.entities.ts` + `UserEntity`.

#### Классы / методы / DTO / Entity

| Элемент | Строки | Содержимое |
|---------|--------|------------|
| `ALL_ENTITIES` | 24–42 | 18 classes |
| re-exports | 21–22 | user.entity, crm.entities |

**Зарегистрированные Entity (18):**

UserEntity, StudentEntity, TeacherEntity, LessonEntity, PaymentEntity, CourseEntity, LessonMaterialEntity, ScheduleSlotEntity, LessonStudentEntity, LessonBalanceEntity, TeacherPaymentEntity, MaterialAccessEntity, TeacherAvailabilityEntity, AlfaBankOrderEntity, AppSettingEntity, ShopSettingEntity, WelcomePageSettingEntity

**Не зарегистрированы (конфликт):**

- `ShopEntity` (Shop.entity.ts:11 — `@Entity('shop_settings')`)
- `WelcomePageEntity` (WelcomePage.entity.ts:9 — `@Entity('welcome_page_settings')`)

#### Зависимости (импорты)

- `./user.entity`, `./crm.entities` — строки 1–19

#### Кто вызывает

- `app.module.ts:9,38`
- `data-source.ts:3,9`

#### Кого вызывает

- Экспортирует классы Entity

#### Поток данных

```
ALL_ENTITIES → TypeORM metadata builder → PostgreSQL DDL (synchronize) OR validation against DB
```

#### Проблемы (с номерами строк)

| # | Строки | Проблема |
|---|--------|----------|
| P1 | 24–42 | ShopEntity/WelcomePageEntity отсутствуют — дубли table name в crm.entities exports |
| P2 | — | ALL_ENTITIES не включает будущие ShopItemEntity, WelcomePageContentEntity (этап 2b) |

#### Legacy

- Dual exports в crm.entities.ts:6–7 ShopEntity, WelcomePageEntity — мёртвый код

#### Удалить / Заменить

- Этап 1: **без изменений**
- Этап 2b: добавить ShopItemEntity, WelcomePageContentEntity

#### Риски при изменении

- Любое изменение ALL_ENTITIES требует sync entities.module.ts forFeature

#### Тесты после изменения

```bash
npm run build --prefix apps/api
```

#### Планируемые изменения (таблица)

| Строка | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|--------|-----------|---------|---------------------|------------------|----------|
| — | Без изменений на этапе 1 | Schema-only stage | — | — | build OK |

---

## Сводка: определения колонок всех Entity (целевая DDL для migration 0001)

Ниже — **целевая** реляционная schema по текущим Entity-файлам. Migration `1730000000001-RelationalSchema.ts` должна создать эти колонки (ADD COLUMN или CREATE при greenfield). PostgreSQL ENUM types создавать явно там, где Entity использует `type: 'enum'`.

### `users` — `user.entity.ts` (строки 3–35)

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 5–6 |
| email | email | varchar | NO | — | 8–10, UNIQUE index |
| passwordHash | password_hash | varchar | NO | — | 12–13 |
| role | role | varchar | NO | pending | 15–16 |
| firstName | first_name | varchar | NO | '' | 18–19 |
| lastName | last_name | varchar | NO | '' | 21–22 |
| phone | phone | varchar | NO | '' | 24–25 |
| telegramId | telegram_id | varchar | NO | '' | 27–28 |
| createdDate | created_date | timestamptz | NO | now() | 30–31 |
| updatedDate | updated_date | timestamptz | NO | now() | 33–34 |

**Примечание:** InitialSchema уже создаёт users correctly (InitialSchema.ts:8–20).

### `students` — `Student.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | gen | 14–15 |
| name | name | text | NO | — | 17–18 |
| firstName | first_name | text | YES | — | 20–21 |
| lastName | last_name | text | YES | — | 23–24 |
| email | email | text | YES | UNIQUE | 26–28 |
| phone | phone | text | YES | — | 30–31 |
| telegramId | telegram_id | text | YES | — | 33–34 |
| assignedTeacher | assigned_teacher | uuid | YES | IDX | 36–38 |
| lessonBalance | lesson_balance | int | NO | 0 | 40–41 |
| startDate | start_date | date | YES | — | 43–44 |
| birthday | birthday | date | YES | — | 46–47 |
| notes | notes | text | YES | — | 49–50 |
| status | status | enum | NO | active | 52–57 |
| userId | user_id | uuid | YES | — | 59–60 |
| createdDate | created_date | timestamptz | NO | — | 62–63 |
| updatedDate | updated_date | timestamptz | NO | — | 65–66 |

**ENUM `students_status`:** `active`, `inactive`, `paused`

### `teachers` — `Teacher.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 14–15 |
| name | name | text | NO | — | 17–18 |
| firstName | first_name | text | YES | — | 20–21 |
| lastName | last_name | text | YES | — | 23–24 |
| email | email | text | YES | UNIQUE | 26–28 |
| hourlyRate | hourly_rate | numeric | YES | — | 30–31 |
| telegramId | telegram_id | text | YES | — | 33–34 |
| status | status | enum | NO | active | 36–41 |
| specializations | specializations | text | YES | — | 43–44 |
| userId | user_id | uuid | YES | — | 46–47 |
| createdDate | created_date | timestamptz | NO | — | 49–50 |
| updatedDate | updated_date | timestamptz | NO | — | 52–53 |

**ENUM `teachers_status`:** `active`, `inactive`

### `lessons` — `Lesson.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 23–24 |
| scheduleSlotId | schedule_slot_id | uuid | YES | IDX | 26–28 |
| teacherId | teacher_id | uuid | NO | IDX | 30–32 |
| teacherName | teacher_name | text | YES | — | 34–35 |
| teacherFirstName | teacher_first_name | text | YES | — | 37–38 |
| teacherLastName | teacher_last_name | text | YES | — | 40–41 |
| studentId | student_id | uuid | YES | IDX | 43–45 |
| studentName | student_name | text | YES | — | 47–48 |
| studentFirstName | student_first_name | text | YES | — | 50–51 |
| studentLastName | student_last_name | text | YES | — | 53–54 |
| studentIds | student_ids | text (simple-array) | YES | — | 56–57 |
| studentNames | student_names | text (simple-array) | YES | — | 59–60 |
| date | date | date | NO | — | 62–63 |
| startTime | start_time | time | NO | — | 65–66 |
| duration | duration | int | NO | 60 | 68–69 |
| meetingLink | meeting_link | text | YES | — | 71–72 |
| status | status | enum | NO | planned | 74–86 |
| lessonFormat | lesson_format | enum | NO | online | 88–94 |
| lessonType | lesson_type | enum | NO | individual | 96–102 |
| lessonTopic | lesson_topic | text | YES | — | 104–105 |
| notes | notes | text | YES | — | 107–108 |
| isRecurring | is_recurring | boolean | NO | false | 110–111 |
| recurringGroupId | recurring_group_id | uuid | YES | — | 113–114 |
| materialIds | material_ids | text (simple-array) | YES | — | 116–117 |
| balanceDeducted | balance_deducted | boolean | NO | false | 119–120 |
| teacherPaymentId | teacher_payment_id | uuid | YES | — | 122–123 |
| reminder24hSent | reminder_24h_sent | boolean | NO | false | 125–126 |
| reminder2hSent | reminder_2h_sent | boolean | NO | false | 128–129 |
| createdDate | created_date | timestamptz | NO | — | 131–132 |
| updatedDate | updated_date | timestamptz | NO | — | 134–135 |

**ENUMs:** `lessons_status`, `lessons_lesson_format`, `lessons_lesson_type`

**Индекс (замена InitialSchema:64-66):** `(date, status)`

### `payments` — `Payment.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 15–16 |
| studentId | student_id | uuid | NO | IDX | 18–20 |
| lessonId | lesson_id | uuid | YES | IDX | 22–24 |
| courseId | course_id | uuid | YES | IDX | 26–28 |
| amount | amount | numeric(10,2) | NO | — | 30–31 |
| currency | currency | text | YES | — | 33–34 |
| status | status | enum | NO | pending | 36–41 |
| provider | provider | enum | NO | manual | 43–48 |
| externalId | external_id | text | YES | — | 50–51 |
| paidAt | paid_at | timestamptz | YES | — | 53–54 |
| notes | notes | text | YES | — | 56–57 |
| createdDate | created_date | timestamptz | NO | — | 59–60 |
| updatedDate | updated_date | timestamptz | NO | — | 62–63 |

**ENUMs:** `payments_status`, `payments_provider`  
**Этап 2b добавит:** student_name, lessons_added, payment_date, comment, order_number, package_type

### `courses` — `Course.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 15–16 |
| studentId | student_id | uuid | YES | IDX | 18–20 |
| studentName | student_name | text | YES | — | 22–23 |
| courseType | **course_type** | enum | NO | — | 25–26 ⚠️ migration MUST use snake_case |
| courseName | course_name | text | YES | — | 28–29 |
| totalLessons | total_lessons | int | NO | 35 | 31–32 |
| completedLessons | completed_lessons | int | NO | 0 | 34–35 |
| startDate | start_date | date | YES | — | 37–38 |
| status | status | enum | NO | active | 40–45 |
| notes | notes | text | YES | — | 47–48 |
| createdDate | created_date | timestamptz | NO | — | 50–51 |
| updatedDate | updated_date | timestamptz | NO | — | 53–54 |

**⚠️ Строка 25:** `@Column({ type: 'enum', ...})` без `name` — при synchronize TypeORM создаёт `courseType`. Migration 0001 **обязана** использовать `course_type`.

### `lesson_materials` — `LessonMaterial.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 19–20 |
| title | title | text | NO | — | 22–23 |
| description | description | text | YES | — | 25–26 |
| fileUrl | file_url | text | NO | — | 28–29 |
| fileType | file_type | enum | NO | other | 31–37 |
| courseId | course_id | uuid | NO | IDX | 39–41 |
| blockName | block_name | text | YES | — | 43–44 |
| tags | tags | text (simple-array) | YES | — | 46–47 |
| createdDate | created_date | timestamptz | NO | — | 49–50 |
| updatedDate | updated_date | timestamptz | NO | — | 52–53 |

### `schedule_slots` — `ScheduleSlot.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 16–17 |
| teacherId | teacher_id | uuid | NO | IDX | 19–21 |
| date | date | date | NO | — | 23–24 |
| startTime | start_time | time | NO | — | 26–27 |
| duration | duration | int | NO | 60 | 29–30 |
| lessonType | lesson_type | enum | NO | individual | 32–38 |
| format | format | enum | NO | online | 40–45 |
| status | status | enum | NO | open | 47–52 |
| recurringGroupId | recurring_group_id | uuid | YES | — | 54–55 |
| meetingLink | meeting_link | text | YES | — | 57–58 |
| createdDate | created_date | timestamptz | NO | — | 60–61 |
| updatedDate | updated_date | timestamptz | NO | — | 63–64 |

### `lesson_students` — `LessonStudent.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 19–20 |
| lessonId | lesson_id | uuid | NO | IDX | 22–24 |
| studentId | student_id | uuid | NO | IDX | 26–28 |
| attendanceStatus | attendance_status | enum | NO | enrolled | 30–36 |
| balanceDeducted | balance_deducted | boolean | NO | false | 38–43 |
| createdDate | created_date | timestamptz | NO | — | 45–46 |
| updatedDate | updated_date | timestamptz | NO | — | 48–49 |

**UNIQUE (этап 2c):** `(lesson_id, student_id)`

### `lesson_balances` — `LessonBalance.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 12–13 |
| studentId | student_id | uuid | NO | UNIQUE | 15–17 |
| lessonsAvailable | lessons_available | int | NO | 0 | 19–20 |
| lessonsUsed | lessons_used | int | NO | 0 | 22–23 |
| createdDate | created_date | timestamptz | NO | — | 25–26 |
| updatedDate | updated_date | timestamptz | NO | — | 28–29 |

### `teacher_payments` — `TeacherPayment.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 14–15 |
| teacherId | teacher_id | uuid | NO | IDX | 17–19 |
| lessonId | lesson_id | uuid | YES | IDX | 21–23 |
| amount | amount | numeric(10,2) | NO | — | 25–26 |
| status | status | enum | NO | pending | 28–33 |
| note | note | text | YES | — | 35–36 |
| createdDate | created_date | timestamptz | NO | — | 38–39 |
| updatedDate | updated_date | timestamptz | NO | — | 41–42 |

### `material_access` — `MaterialAccess.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 14–15 |
| userId | user_id | uuid | NO | IDX | 17–19 |
| materialId | material_id | uuid | NO | IDX | 21–23 |
| grantedByRole | granted_by_role | enum | NO | — | 25–30 |
| access | access | boolean | NO | — | 32–33 |
| notes | notes | text | YES | — | 35–36 |
| createdDate | created_date | timestamptz | NO | — | 38–39 |
| updatedDate | updated_date | timestamptz | NO | — | 41–42 |

### `teacher_availability` — `TeacherAvailability.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 12–13 |
| teacherId | teacher_id | uuid | NO | IDX | 15–17 |
| slots | slots | jsonb | YES | — | 26–31 |
| createdDate | created_date | timestamptz | NO | — | 33–34 |
| updatedDate | updated_date | timestamptz | NO | — | 36–37 |

**Migration rename:** `teacher_availabilities` → `teacher_availability`

### `alfa_bank_orders` — `alfaBankOrder.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 15–16 |
| studentId | student_id | uuid | NO | IDX | 18–20 |
| orderNumber | order_number | varchar | NO | UNIQUE | 22–24 |
| alfaOrderId | alfa_order_id | varchar | YES | UNIQUE | 26–28 |
| type | type | enum | NO | — | 30–31 |
| itemId | item_id | uuid | NO | — | 33–34 |
| amount | amount | numeric(10,2) | NO | — | 36–37 |
| status | status | enum | NO | pending | 39–44 |
| paymentDate | payment_date | timestamptz | YES | — | 46–47 |
| notes | notes | text | YES | — | 49–50 |
| createdDate | created_date | timestamptz | NO | — | 52–53 |
| updatedDate | updated_date | timestamptz | NO | — | 55–56 |

### `app_settings` — `AppSetting.entity.ts`

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 11–12 |
| key | key | text | NO | — | 14–15 |
| value | value | text | YES | — | 17–18 |
| description | description | text | YES | — | 20–21 |
| type | type | text | YES | — | 23–24 |
| isActive | **is_active** | boolean | NO | true | 26–27 ⚠️ migration snake_case |
| createdDate | created_date | timestamptz | NO | — | 29–30 |
| updatedDate | updated_date | timestamptz | NO | — | 32–33 |

**Индекс:** UNIQUE или INDEX на `key` (замена InitialSchema:56-58)

### `shop_settings` — `ShopSetting.entity.ts` (временная schema этапа 1)

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 11–12 |
| key | key | text | NO | — | 14–15 |
| value | value | text | YES | — | 17–18 |
| description | description | text | YES | — | 20–21 |
| type | type | text | YES | — | 23–24 |
| isActive | **is_active** | boolean | NO | true | 26–27 |
| createdDate | created_date | timestamptz | NO | — | 29–30 |
| updatedDate | updated_date | timestamptz | NO | — | 32–33 |

### `welcome_page_settings` — `WelcomePageSetting.entity.ts` (временная schema этапа 1)

| Property | DB Column | Type | Nullable | Default | Строки |
|----------|-----------|------|----------|---------|--------|
| id | id | uuid PK | NO | — | 11–12 |
| key | key | text | NO | — | 14–15 |
| value | value | text | YES | — | 17–18 |
| description | description | text | YES | — | 20–21 |
| type | type | text | YES | — | 23–24 |
| isActive | **is_active** | boolean | NO | true | 26–27 |
| createdDate | created_date | timestamptz | NO | — | 29–30 |
| updatedDate | updated_date | timestamptz | NO | — | 32–33 |

---

## Новые файлы

### `apps/api/src/database/migrations/1730000000001-RelationalSchema.ts`

#### Текущая архитектура

**Файл не существует.** Планируется как вторая migration в chain после InitialSchema.

#### Классы / методы / DTO / Entity

```typescript
export class RelationalSchema1730000000001 implements MigrationInterface {
  name = 'RelationalSchema1730000000001';
  async up(queryRunner: QueryRunner): Promise<void>;
  async down(queryRunner: QueryRunner): Promise<void>;
}
```

#### Зависимости (импорты)

- `typeorm` — MigrationInterface, QueryRunner

#### Кто вызывает

- TypeORM migration runner (после 0000)

#### Кого вызывает

- Raw SQL: CREATE TYPE, ALTER TABLE ADD COLUMN, RENAME TABLE, CREATE INDEX

#### Поток данных

```
InitialSchema (jsonb tables exist)
  → 0001 up:
    1. CREATE TYPE ... AS ENUM (per entity enums)
    2. For each jsonTable: ADD COLUMN per Entity definition
    3. RENAME teacher_availabilities → teacher_availability
    4. ADD teacher_id, slots jsonb to teacher_availability
    5. CREATE relational indexes (replace json indexes)
```

#### Проблемы (с номерами строк)

- N/A (новый файл)

#### Legacy

- Колонка `data` **остаётся** до 0003

#### Удалить / Заменить

- N/A

#### Риски при изменении

- ADD COLUMN на больших таблицах — lock; maintenance window
- Enum type name collision если dev synchronize уже создал types
- `course_type` vs `courseType` naming

#### Тесты после изменения

```sql
\d students  -- columns: name, email, lesson_balance, ... AND data (still)
\d teacher_availability  -- exists, not teacher_availabilities
```

#### Планируемые изменения (таблица)

| Блок | Изменение | Причина | Ожидаемый результат | Побочные эффекты | Проверка |
|------|-----------|---------|---------------------|------------------|----------|
| ENUMs | CREATE TYPE для всех enum columns | PostgreSQL native enums | TypeORM enum sync | Conflict with synchronize types | `\dT+` |
| students..welcome | ADD ~15-30 columns each | Entity parity | Columns exist | Wider rows | information_schema |
| teacher_avail | RENAME + ADD teacher_id, slots | Name + Entity | Single table name | FK scripts update | `\dt teacher_*` |
| indexes | CREATE on student_id, date+status, key | Query perf | Relational indexes | Drop json indexes in 0003 | `\di` |

**Подзадачи по таблицам (из roadmap):**

| Таблица | Ключевые колонки | Entity ref |
|---------|------------------|------------|
| students | name, email, lesson_balance, assigned_teacher, user_id, status | Student.entity.ts |
| teachers | name, email, hourly_rate, user_id, status | Teacher.entity.ts |
| lessons | teacher_id, student_id, date, start_time, status, … | Lesson.entity.ts:26-129 |
| payments | student_id, amount, status, provider | Payment.entity.ts |
| courses | student_id, course_type, total_lessons | Course.entity.ts |
| lesson_materials | title, file_url, course_id | LessonMaterial.entity.ts |
| schedule_slots | teacher_id, date, start_time, status | ScheduleSlot.entity.ts |
| lesson_students | lesson_id, student_id, attendance_status | LessonStudent.entity.ts |
| lesson_balances | student_id UNIQUE, lessons_available, lessons_used | LessonBalance.entity.ts |
| teacher_payments | teacher_id, lesson_id, amount, status | TeacherPayment.entity.ts |
| material_access | user_id, material_id, granted_by_role, access | MaterialAccess.entity.ts |
| teacher_availability | teacher_id, slots jsonb | TeacherAvailability.entity.ts |
| alfa_bank_orders | student_id, order_number, amount, status | alfaBankOrder.entity.ts |
| app_settings | key, value, description, type, is_active | AppSetting.entity.ts |
| shop_settings | key, value (temp) | ShopSetting.entity.ts |
| welcome_page_settings | key, value (temp) | WelcomePageSetting.entity.ts |

---

### `apps/api/src/database/migrations/1730000000002-MigrateJsonbData.ts`

#### Текущая архитектура

**Файл не существует.** Data migration: перенос `data->>'field'` → typed columns.

#### Классы / методы

```typescript
export class MigrateJsonbData1730000000002 implements MigrationInterface;
```

#### Зависимости (импорты)

- typeorm MigrationInterface

#### Кто вызывает

- Migration runner после 0001

#### Кого вызывает

- `UPDATE students SET name = data->>'name', email = data->>'email', ... WHERE data IS NOT NULL`
- Аналогично для всех 16 таблиц

#### Поток данных

```
Row { id, data: { name, lesson_balance, ... }, created_date }
  → UPDATE SET name = data->>'name', lesson_balance = (data->>'lesson_balance')::int, ...
  → Row { id, name, lesson_balance, ..., data: {...} }  // data still present
```

#### Проблемы

- JSON keys в prod могут быть snake_case (Base44 export) — совпадает с frontend
- Boolean/int casts: `(data->>'lesson_balance')::int`
- simple-array fields: comma-separated string in json
- `teacher_availabilities` → после rename в 0001: map `data->>'teacher_id'`, `data->'slots'`

#### Legacy

- Читает legacy jsonb `data` column

#### Риски при изменении

- NULL/invalid casts → migration fail; нужны COALESCE defaults
- Partial migration — transactional per table recommended

#### Тесты после изменения

```sql
SELECT COUNT(*) FROM students WHERE name IS NULL AND data->>'name' IS NOT NULL;  -- expect 0
SELECT id, name, lesson_balance FROM students LIMIT 5;
```

#### Планируемые изменения (таблица)

| Таблица | json key → column | Строка SQL pattern |
|---------|-------------------|-------------------|
| students | lesson_balance → lesson_balance | `(data->>'lesson_balance')::int` |
| students | assigned_teacher → assigned_teacher | `data->>'assigned_teacher'` |
| lessons | start_time → start_time | `data->>'start_time'` |
| lessons | student_ids → student_ids | `data->>'student_ids'` |
| payments | student_id → student_id | `data->>'student_id'` |
| courses | course_type → course_type | `data->>'course_type'` |
| app_settings | key → key | `data->>'key'` |
| shop_settings | item_id → **N/A until 2b** | store in key/value or skip |

**Маппинг (roadmap примеры):**

| json key | column |
|----------|--------|
| student_id | student_id |
| lesson_balance | lesson_balance |
| start_time | start_time |
| course_type | course_type |

---

### `apps/api/src/database/migrations/1730000000003-DropJsonbColumn.ts`

#### Текущая архитектура

**Файл не существует.** Final cleanup migration.

#### Классы / методы

```typescript
export class DropJsonbColumn1730000000003 implements MigrationInterface;
```

#### Зависимости

- typeorm

#### Кто вызывает

- Migration runner после 0002

#### Кого вызывает

- `ALTER TABLE ... DROP COLUMN data`
- `DROP INDEX IF EXISTS IDX_app_settings_key` (json expression indexes from InitialSchema:55-70)

#### Поток данных

```
Relational columns populated, data redundant
  → DROP COLUMN data
  → DROP json expression indexes
  → Schema = pure relational
```

#### Проблемы

- Irreversible without down migration restoring data from columns → json

#### Legacy

- Removes last JSON-record artifact from CRM tables

#### Риски

- Application still referencing `row.data` (EntityRepositoryService) — **still broken until stage 2**, but DB correct
- Rollback requires down() rebuilding json from columns

#### Тесты после изменения

```sql
SELECT COUNT(*) FROM information_schema.columns WHERE column_name='data';  -- expect 0
\d students  -- no data column
```

#### Планируемые изменения (таблица)

| Действие | Таблицы | Причина | Проверка |
|----------|---------|---------|----------|
| DROP COLUMN data | 16 CRM tables | Policy: no jsonb business data | information_schema |
| DROP INDEX | IDX_* on data->> | Obsolete | pg_indexes |

---

## Чек-лист выполнения

- [ ] Backup production DB (pg_dump) перед migration на prod
- [ ] Создан `1730000000001-RelationalSchema.ts` со всеми колонками из сводки Entity
- [ ] Создан `1730000000002-MigrateJsonbData.ts` с UPDATE для каждой таблицы
- [ ] Создан `1730000000003-DropJsonbColumn.ts`
- [ ] `data-source.ts:10` — все 4 migrations в массиве
- [ ] `app.module.ts:39` — `synchronize: false`
- [ ] `entity-names.ts:39` — `teacher_availability`
- [ ] `migration:run` на чистой БД: users + 16 relational tables, 0 columns named `data`
- [ ] `migration:run` на копии prod с jsonb data: row counts preserved, sample fields correct
- [ ] `npm run build --prefix apps/api` — OK
- [ ] `\d teacher_availability` — таблица существует, `teacher_availabilities` — нет
- [ ] Документирован локальный workflow: migrate → start:dev

---

## Definition of Done

1. **Schema parity:** PostgreSQL columns match Entity definitions (сводка выше) для всех 17 CRM tables + users
2. **No `data` column:** `SELECT COUNT(*) FROM information_schema.columns WHERE column_name='data'` = 0
3. **Table naming:** `teacher_availability` единственное имя; ENTITY_TABLE_MAP синхронизирован
4. **Dev/prod unity:** `synchronize: false` everywhere; migrations — единственный источник schema
5. **Build green:** `npm run build --prefix apps/api` без ошибок
6. **Data safety:** Existing jsonb prod data migrated with verified sample checks (documented in migration PR)
7. **API note:** Generic API всё ещё сломан до этапа 2 — это ожидаемо; этап 1 не требует working `/entities/*`

---

## Зависимости от других этапов

| Этап | Зависимость |
|------|-------------|
| Этап 0 | ADR для enum values, shop/welcome temporary KV OK |
| Этап 2 (domain) | **Блокируется** этапом 1 — mapper useless без columns |
| Этап 2b | Migration 0005 для Payment/Shop/Welcome — **после** 0001–0003 |
| Этап 2c | Migration 0004 FK — **после** 0001–0003 |
| Этап 7 (testing) | P0 migration integration test validates this stage |

---

## Параллельная работа

| Можно параллельно | Нельзя параллельно |
|-------------------|-------------------|
| Написание draft migration SQL offline | Изменение Entity column definitions без sync migration |
| Документация, тест-план | Этап 2a mapper на prod без 0001–0003 |
| Этап 0 ADR финализация | DROP `data` до 0002 data migration |

---

## Запрещено начинать раньше

1. **Этап 2a (mapper)** — до завершения migration 0001 минимум (columns must exist)
2. **Этап 2b Payment columns** — до этапа 1 base schema
3. **Этап 2c FK migration 0004** — до relational columns (0001) и желательно до drop data (0003)
4. **Production deploy** нового API кода с Entity fields **без** migration run — гарантированные 500
5. **Изменение InitialSchema1730000000000** на уже deployed environments
