# Database

PostgreSQL 17 — единственное хранилище бизнес-данных. JSONB / `json_record` для стабильных сущностей **не используется**.

## Подключение

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/longhua
```

Dev: `docker compose up -d postgres` (`docker-compose.yml`).

## Сущности (28 в registry)

Регистр: `apps/api/src/database/entity-registry.ts`  
Entities лежат в `apps/api/src/modules/*/entities/`, не в отдельной папке `entities/` (кроме legacy `apps/api/src/entities/alfaBankOrder.entity.ts` — **не в registry**).

| Группа | Entity | Таблица PostgreSQL |
|--------|--------|-------------------|
| Пользователи | `UserEntity` | `users` |
| | `PendingRegistrationEntity` | `pending_registrations` |
| Профили | `StudentEntity` | `students` |
| | `TeacherEntity` | `teachers` |
| Курсы | `CourseTemplateEntity` | `course_templates` |
| | `EnrollmentEntity` | `enrollments` |
| | `EnrollmentLessonEventEntity` | `enrollment_lesson_events` |
| Группы | `GroupEntity` | `groups` |
| | `GroupMemberEntity` | `group_members` |
| Уроки | `LessonEntity` | `lessons` |
| | `AttendanceEntity` | `attendance_records` |
| Расписание | `AvailabilitySlotEntity` | `teacher_availability_slots` |
| | `AvailabilityBookingEntity` | `teacher_availability_bookings` |
| | `LessonSeriesEntity` | `lesson_series` |
| | `SeriesStudentEntity` | `lesson_series_students` |
| | `SeriesExclusionEntity` | `lesson_series_exclusions` |
| Финансы | `PaymentEntity` | `payments` |
| | `ShopItemEntity` | `shop_items` |
| | `TeacherPaymentEntity` | `teacher_payments` |
| Материалы | `MaterialFolderEntity` | `material_folders` |
| | `MaterialEntity` | `materials` |
| | `MaterialAccessEntity` | `material_access` |
| | `MaterialLinkEntity` | `material_links` |
| Сертификаты | `CertificateEntity` | `certificates` |
| | `CertificateHistoryEntity` | `certificate_history` |
| Система | `NotificationEntity` | `notifications` |
| | `AuditLogEntity` | `audit_logs` |
| | `AppSettingEntity` | `app_settings` |

## Миграции (8 файлов)

```bash
npm run migration:run      # применить
npm run migration:revert   # откатить последнюю
```

Каталог: `apps/api/src/database/migrations/`  
DataSource: `apps/api/src/database/data-source.ts`

| Migration | Назначение |
|-----------|------------|
| `1731000000000-InitialSchemaV2` | Базовая v2 схема |
| `1732000000000-Phase2BusinessFlow` | Бизнес-потоки |
| `1733000000000-Phase3ProductionReadiness` | Lesson series, progress |
| `1734000000000-LegacyV2Bridge` | Legacy bridge |
| `1735000000000-TeacherPaymentsSchemaAlign` | Teacher payments |
| `1736000000000-SchemaEntityAlign` | Entity alignment |
| `1737000000000-CertificateUniquenessAlign` | Certificate uniques |
| `1738000000000-IntegrityHardening` | FK, idempotency, partial uniques |

**Правила:**
- `synchronize: false` в production и development (кроме `NODE_ENV=test` + `E2E_SYNC_SCHEMA=true`).
- При старте API миграции применяются автоматически (`migrationsRun: true`), если не задан `E2E_SYNC_SCHEMA=true`.
- `npm run dev:server` дополнительно вызывает `migration:run` перед `start:dev`.

## Целостность

Миграция `1738000000000-IntegrityHardening`:
- FK на legacy-колонки (`lessons.series_id`, `payments.shop_item_id`, …)
- `enrollment_lesson_events` — unique `(lesson_id, student_id, event_type)`
- Partial unique: один active enrollment на student/course; один draft certificate

Проверка живой БД:

```bash
npx ts-node --project apps/api/tsconfig.json apps/api/scripts/integrity-audit.ts
```

## Резервное копирование

```bash
npm run db:backup:docker    # docker exec longhua-postgres
npm run db:backup             # pg_dump + DATABASE_URL
```

Восстановление: `scripts/restore-db.sh` / `scripts/restore-db.ps1`.

## Добавление новой сущности

1. `*.entity.ts` в модуле домена
2. Запись в `entity-registry.ts`
3. Новая migration
4. Repository → Service → Controller → DTO → Module
5. `src/api/<domain>.api.js` + UI
6. `npm run migration:run` → `npm run build` → `npm run test:e2e`

## Откат

1. `npm run migration:revert` — одна миграция
2. Restore из `.dump` при катастрофе

Откат миграции не откатывает данные, изменённые после её применения.
