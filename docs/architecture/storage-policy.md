# Storage policy (current)

**Status:** active · **Updated:** 2026-07-21

## Rule

PostgreSQL stores **stable business data only in relational tables** (typed columns + FK relations).

| Forbidden for business entities | Allowed |
|----------------------------------|---------|
| `jsonb` / `json` columns | Native typed columns (`uuid`, `text`, `timestamptz`, enums, …) |
| `json_record` / `data jsonb` bag | Join tables for M:N |
| Embedding multiple entities in one JSON document | Prefer relational tables and join entities |

Live verification (must stay empty):

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (data_type IN ('json', 'jsonb') OR udt_name IN ('json', 'jsonb'));
-- expected: 0 rows
```

## CRM entities

All CRM aggregates (`users`, `students`, `teachers`, `lessons`, `payments`, `materials`, …) are **relational**.  
Schema is owned by TypeORM migrations under `apps/api/src/database/migrations/`.  
Registry: `apps/api/src/database/entity-registry.ts`.

## Teacher availability

| Old (removed) | Current |
|---------------|---------|
| `teacher_availability.slots` **jsonb** array | Table `teacher_availability_slots` (`AvailabilitySlotEntity`) |
| — | Bookings: `teacher_availability_bookings` |

One row per weekly interval: `teacher_id`, `day_of_week`, `time_from`, `time_to`.

## Assessment

Exam content at attempt time is stored in **snapshot tables**, not JSON blobs:

- `assessment_question_snapshots`
- `assessment_answer_snapshots`
- `assessment_attempt_answers`
- `assessment_attempt_answer_selections`
- `assessment_result_breakdowns`

Authoring/runtime entities use prefix `assessment_*` with typed columns and FKs.

## Settings

`app_settings` is **key / text value** (`AppSettingEntity`). Welcome page fields are separate keys (`welcome_*`), not a JSON document column.

## Optional future JSONB (policy)

Architecture still *allows* JSONB only for non-stable payloads that cannot be modeled as tables (e.g. raw Telegram Update archive, ephemeral debug metadata).  
**None of these are used for CRM or Assessment business entities today.**

## Related docs

- [Database.md](../Database.md)
- [Architecture.md](../Architecture.md)
- [domain/TeacherAvailability.md](../domain/TeacherAvailability.md)
- [assessment/architecture.md](../assessment/architecture.md)

## Historical docs

Roadmap / refactor / early audit files that mention `data jsonb` or `slots jsonb` describe a **completed** migration. They are marked `HISTORICAL / COMPLETED` and must not be treated as the current schema.
