# Аудит: Database

## Текущая конфигурация

| Параметр | Dev | Prod |
|----------|-----|------|
| synchronize | `true` (`app.module.ts:39`) | `false` |
| migrationsRun | `false` | `true` (`app.module.ts:41`) |
| Migration | `InitialSchema1730000000000` | same |

## InitialSchema (`1730000000000-InitialSchema.ts`)

### users — OK

Relational columns: `id`, `email`, `password_hash`, `role`, `first_name`, `last_name`, `phone`, `telegram_id`, dates.

### jsonTables (строки 24–53) — ПРОБЛЕМА

16 таблиц с схемой:

```sql
id uuid, data jsonb DEFAULT '{}', created_date, updated_date
```

Таблицы: students, teachers, lessons, payments, courses, lesson_materials, schedule_slots, lesson_students, lesson_balances, teacher_payments, material_access, **teacher_availabilities**, alfa_bank_orders, app_settings, shop_settings, welcome_page_settings.

### JSONB индексы (строки 55–70)

- `app_settings` → `data->>'key'`
- `shop_settings` → `data->>'item_id'`
- `lessons` → `data->>'date'`, `data->>'status'`
- `payments` → `data->>'student_id'`, `data->>'payment_date'`

Бесполезны после перехода на relational columns.

## Расхождение имён таблиц

| Entity `@Entity()` | Migration table |
|--------------------|-----------------|
| `teacher_availability` | `teacher_availabilities` |

## data-source.ts

- `synchronize: false` (CLI migrations)
- `entities: ALL_ENTITIES`
- `migrations: [InitialSchema1730000000000]`

## import-json.ts

- Путь: `server/data/database.json`
- Generic `...payload` в Entity (`import-json.ts:123-132`)
- **Удалить:** этап 8

## Планируемые миграции

| ID | Файл | Этап |
|----|------|------|
| 1730000000001 | RelationalSchema | 1 |
| 1730000000002 | MigrateJsonbData | 1 |
| 1730000000003 | DropJsonbColumn | 1 |
| 1730000000004 | AddForeignKeys | 2c |
| 1730000000005 | PaymentShopWelcome | 2b |
| 1730000000006 | TeacherAvailabilitySlots | 8 |
| 1730000000007 | UnifyBalance | 8 |

## Рекомендации

1. Отключить `synchronize: true` в dev после этапа 1
2. Единая schema dev = prod через migrations only
3. Backup перед `MigrateJsonbData`
4. Тест migration up/down на копии prod data

## Проверка schema

```sql
-- После этапа 1: не должно быть data jsonb
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'data' AND table_schema = 'public';

-- FK после этапа 2c
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint WHERE contype = 'f';
```
