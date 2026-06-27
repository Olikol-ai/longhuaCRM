# Этап 1: Database (PostgreSQL)

**Предшественник:** [Этап 0](../refactor-roadmap.md#этап-0-подготовка-и-фиксация-решений)  
**Следующий:** [02-domain.md](./02-domain.md)  
**Трудоёмкость:** 16–24 ч

---

## Цель

Привести PostgreSQL schema в соответствие с TypeORM Entity: relational columns вместо `data jsonb`.

## Зачем нужен

Без этого этапа production (`migrationsRun`) создаёт JSON-таблицы, а Entity ожидают колонки → 500, пустые данные, невозможность FK.

## Затрагиваемые Entity

Все CRM Entity (16 таблиц) + `users` (уже OK).

## Зависимые сервисы

Все через EntityRepositoryService — пока не заработают до этапа 2a, но schema должна быть готова.

## Риски

| Риск | Митигация |
|------|-----------|
| Потеря данных при migration | Backup; тест на копии |
| Downtime prod | Maintenance window |
| Enum type conflicts | Явные PostgreSQL ENUM в migration |
| teacher_availability name | Унифицировать в migration |

## Как проверить результат

```bash
npm run migration:run --prefix apps/api
npm run build --prefix apps/api
```

```sql
\d students  -- должны быть name, email, lesson_balance, ... NOT data
SELECT COUNT(*) FROM information_schema.columns WHERE column_name='data';
-- ожидание: 0
```

## Критерии завершения

- [ ] `migration:run` на чистой БД создаёт все relational tables
- [ ] Существующие jsonb данные перенесены в columns (если есть prod data)
- [ ] Колонка `data` удалена
- [ ] `teacher_availability` — единое имя таблицы
- [ ] `synchronize: false` в dev (изменение `app.module.ts`)
- [ ] dev и prod используют одну schema через migrations

---

## Задачи

### Этап 1 — database

#### Модуль: config

##### Файл: `apps/api/src/app.module.ts`

###### Изменение: `synchronize: false` для всех env

- **Причина:** dev/prod schema drift (`refactor-plan.md §2.3`)
- **Что может сломаться:** локальная БД без migrations не стартует
- **Как проверить:** `npm run start:dev` после `migration:run`

#### Модуль: database

##### Файл: `apps/api/src/database/migrations/1730000000001-RelationalSchema.ts` (новый)

###### Изменение: CREATE TABLE с колонками по Entity definitions

- **Причина:** замена jsonb schema
- **Что может сломаться:** конфликт с существующими таблицами
- **Как проверить:** migration up на пустой БД; сверка с `Student.entity.ts` и др.

**Подзадачи по таблицам:**

| Таблица | Ключевые колонки | Entity ref |
|---------|------------------|------------|
| students | name, email, lesson_balance, assigned_teacher, user_id, status enum | Student.entity.ts |
| teachers | name, email, hourly_rate, user_id, status enum | Teacher.entity.ts |
| lessons | teacher_id, student_id, date, start_time, status enum, ... | Lesson.entity.ts |
| payments | student_id, amount, status, provider | Payment.entity.ts |
| courses | student_id, course_type enum, total_lessons | Course.entity.ts |
| lesson_materials | title, file_url, course_id | LessonMaterial.entity.ts |
| schedule_slots | teacher_id, date, start_time, status | ScheduleSlot.entity.ts |
| lesson_students | lesson_id, student_id, attendance_status | LessonStudent.entity.ts |
| lesson_balances | student_id unique, lessons_available, lessons_used | LessonBalance.entity.ts |
| teacher_payments | teacher_id, lesson_id, amount, status | TeacherPayment.entity.ts |
| material_access | user_id, material_id, granted_by_role, access | MaterialAccess.entity.ts |
| teacher_availability | teacher_id, slots jsonb (временно) | TeacherAvailability.entity.ts |
| alfa_bank_orders | student_id, order_number, amount, status | alfaBankOrder.entity.ts |
| app_settings | key, value, description, type, is_active | AppSetting.entity.ts |
| shop_settings | key, value (временно, перед этапом 2b) | ShopSetting.entity.ts |
| welcome_page_settings | key, value (временно) | WelcomePageSetting.entity.ts |

##### Файл: `apps/api/src/database/migrations/1730000000002-MigrateJsonbData.ts` (новый)

###### Изменение: UPDATE ... SET col = data->>'col' для каждой таблицы

- **Причина:** сохранить prod data
- **Что может сломаться:** несовпадение ключей json vs column names
- **Как проверить:** COUNT до/после; sample rows

**Маппинг json keys → columns (примеры):**

| json key | column |
|----------|--------|
| student_id | student_id |
| lesson_balance | lesson_balance |
| start_time | start_time |
| course_type | course_type |

##### Файл: `apps/api/src/database/migrations/1730000000003-DropJsonbColumn.ts` (новый)

###### Изменение: ALTER TABLE DROP COLUMN data; DROP INDEX на data->>

- **Причина:** завершение перехода
- **Что может сломаться:** откат без down migration
- **Как проверить:** `\d students` без data

##### Файл: `apps/api/src/database/data-source.ts`

###### Изменение: добавить новые migrations в массив

- **Причина:** CLI migration:run
- **Что может сломаться:** порядок migrations
- **Как проверить:** `npm run migration:run --prefix apps/api`

##### Файл: `apps/api/src/common/constants/entity-names.ts`

###### Изменение: `TeacherAvailability: 'teacher_availability'` (строка 39)

- **Причина:** sync с Entity table name
- **Что может сломаться:** import-json script paths
- **Как проверить:** grep teacher_availabilities = 0

#### Модуль: entities

##### Файл: `apps/api/src/entities/TeacherAvailability.entity.ts`

###### Изменение: подтвердить `@Entity('teacher_availability')` — единый стандарт

- **Причина:** migration rename `teacher_availabilities` → `teacher_availability`
- **Что может сломаться:** existing prod table name
- **Как проверить:** Entity metadata = actual table

---

## Миграции PostgreSQL (этот этап)

1. `1730000000001-RelationalSchema.ts`
2. `1730000000002-MigrateJsonbData.ts`
3. `1730000000003-DropJsonbColumn.ts`

## Изменения API

Нет (schema only).

## Изменения Frontend

Нет.

## Изменения Telegram

Нет (данные Lesson/Student ещё не читаются корректно до этапа 2a).

## Тесты до изменений

См. [07-testing.md](./07-testing.md) — P0 migration integration test.
