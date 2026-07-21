> **Note:** Earlier entity audits listed `TeacherAvailability.slots` jsonb and missing relations. That work is **done**.  
> Canonical sources: [Database.md](../Database.md), [TeacherAvailability.md](../domain/TeacherAvailability.md), [storage-policy.md](../architecture/storage-policy.md).

# Аудит: Entity (current)

## Сводка

- Entities live under `apps/api/src/modules/*/entities/`.
- Registry: `apps/api/src/database/entity-registry.ts`.
- CRM + Assessment use **relational** columns and TypeORM relations where modeled.
- **No** `@Column({ type: 'jsonb' })` on business entities.

## Availability

| Entity | Table |
|--------|-------|
| `AvailabilitySlotEntity` | `teacher_availability_slots` |
| `AvailabilityBookingEntity` | `teacher_availability_bookings` |

There is **no** `slots jsonb` field.

## Assessment snapshots

| Entity | Table |
|--------|-------|
| `AssessmentQuestionSnapshotEntity` | `assessment_question_snapshots` |
| `AssessmentAnswerSnapshotEntity` | `assessment_answer_snapshots` |
| … attempt answers / selections / result breakdowns | `assessment_*` |

Snapshots are rows with FKs — not JSON documents.

## Legacy

`apps/api/src/entities/alfaBankOrder.entity.ts` — legacy file, **not** in the active entity registry (payments flow uses `PaymentEntity`).
