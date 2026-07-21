> **Note:** Earlier versions of this audit described a `data jsonb` schema. That migration is **completed**.  
> Canonical sources: [Database.md](../Database.md), [storage-policy.md](../architecture/storage-policy.md).

# Аудит: Database (current)

## Конфигурация

| Параметр | Значение |
|----------|----------|
| `synchronize` | `false` (dev/prod; test may sync with `E2E_SYNC_SCHEMA`) |
| Migrations | TypeORM files in `apps/api/src/database/migrations/` |
| ORM | TypeORM 0.3, entities via `entity-registry.ts` |

## Схема

- CRM tables are **relational** (typed columns + FK).
- **No** `json` / `jsonb` columns on business tables (verified in live `information_schema`).
- Teacher availability: `teacher_availability_slots` (+ `teacher_availability_bookings`).
- Assessment: `assessment_*` including snapshot tables.

## Native arrays (not JSONB)

| Table | Columns |
|-------|---------|
| `assessment_blueprint_section_rules` | `question_types` (`text[]`), `topic_ids` (`uuid[]`) |

## Проверка

```sql
SELECT COUNT(*) FROM information_schema.columns
WHERE table_schema = 'public'
  AND (data_type IN ('json', 'jsonb') OR udt_name IN ('json', 'jsonb'));
-- expected: 0
```
