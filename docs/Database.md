# Database

PostgreSQL 17 — единственное хранилище бизнес-данных. JSONB/json_record для стабильных сущностей **не используется**.

## Подключение

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/longhua
```

Dev-стек: `docker compose up -d postgres` (см. `docker-compose.yml`).

## Сущности (28 в v2 registry)

Регистр: `apps/api/src/database/entity-registry.ts`

| Группа | Таблицы / сущности |
|--------|-------------------|
| Пользователи | `users`, `pending_registrations` |
| Профили | `students`, `teachers` |
| Курсы | `course_templates`, `enrollments`, `enrollment_lesson_events` |
| Группы | `groups`, `group_members` |
| Уроки | `lessons`, `attendance_records` |
| Расписание | `availability_slots`, `availability_bookings`, `lesson_series`, `series_students`, `lesson_series_exclusions` |
| Финансы | `payments`, `shop_items`, `teacher_payments` |
| Материалы | `material_folders`, `materials`, `material_access`, `material_links` |
| Сертификаты | `certificates`, `certificate_history` |
| Система | `notifications`, `audit_logs`, `app_settings` |

## Миграции

```bash
npm run migration:run      # применить
npm run migration:revert   # откатить последнюю
```

Файлы: `apps/api/src/database/migrations/`. DataSource: `apps/api/src/database/data-source.ts`.

**Правила:**
- Каждое изменение схемы — новая миграция с timestamp-префиксом.
- В production `synchronize` всегда `false`.
- После изменения entity проверить: relations, repository, service, controller, DTO, migration.

## Целостность

Миграция `1738000000000-IntegrityHardening` добавила:
- FK на legacy-колонки (`lessons.series_id`, `payments.shop_item_id`, …)
- `enrollment_lesson_events` с unique `(lesson_id, student_id, event_type)`
- Partial unique: один active enrollment на student/course; один draft certificate

Проверка живой БД:

```bash
npx ts-node --project apps/api/tsconfig.json apps/api/scripts/integrity-audit.ts
```

## Резервное копирование

```bash
npm run db:backup:docker    # через контейнер longhua-postgres
npm run db:backup           # через pg_dump + DATABASE_URL
```

Восстановление: `scripts/restore-db.sh` или `scripts/restore-db.ps1` (см. [Deployment.md](./Deployment.md)).

## Добавление новой сущности

1. Создать `*.entity.ts` в соответствующем модуле.
2. Добавить в `entity-registry.ts`.
3. Создать migration (`typeorm migration:generate` или вручную).
4. Repository + Service + Controller + DTO + Module.
5. Frontend: `src/api/<domain>.api.js` + страница/форма.
6. `npm run migration:run` → `npm run build` → `npm run test:e2e`.

## Индексы

Индексы объявлены на entity через `@Index`. При росте нагрузки проверять:
- фильтры списков (students by status, lessons by teacher_id + date)
- FK-колонки в JOIN-запросах
- unique constraints для идемпотентности

## Откат схемы

1. `npm run migration:revert` — одна миграция назад.
2. При катастрофе — restore из `.dump` (см. backup scripts).

**Важно:** откат миграции не откатывает данные, изменённые бизнес-логикой после миграции.
