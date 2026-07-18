# LongHua Assessment — Architecture Boundaries

Status: scaffold (no exam domain entities yet)  
Context: bounded module inside LongHuaCRM NestJS API (`apps/api`)

## Decision

LongHua Assessment is a **bounded context** inside the existing LongHuaCRM NestJS application.

It is **not**:

- a separate git repository;
- a separate NestJS deployable service (for now);
- an owner of CRM identity or school operations.

Extract to a standalone service remains possible later if boundaries below are respected.

## Ownership

### Assessment owns

- Exam templates, blueprints, exams, sections, questions, answers
- **Assessment banks** (`assessment_banks`)
- Question attachments (media metadata; bytes via SecureFiles)
- Topics / taxonomy for questions
- Assessment rules (**single** relational store for all exam conduct settings)
- Assignments (polymorphic target; **status** SM — no `active` boolean)
- Attempts, snapshots, attempt answers + **answer selections**, results + **breakdowns**

Future PostgreSQL tables **must** use the prefix:

```text
assessment_
```

Examples (not created yet): `assessment_exams`, `assessment_questions`, `assessment_attempts`.

Content lifecycle (Question, ExamTemplate, Blueprint, Exam): `draft` → `published` (immutable) → `archived`.

Attempt lifecycle: `created` → `started` → `submitted` (`submit_reason`: `manual` \| `timeout` \| `system`; **no** `expired`).  
Result lifecycle: `processing` → optional `pending_review` → `passed` \| `failed` \| `invalidated` (`evaluation_type`: `automatic` \| `manual` \| `mixed`).  
Assignment cancel forbidden if any Attempt is `started` (`409`).

Full entity graph, snapshot strategy, and assignment model:  
**[domain-model.md](./domain-model.md)** (approved for Entity design).

Public REST contract (design only):  
**[api-contract.md](./api-contract.md)**.

Lifecycle / state machines (official):  
**[state-machine.md](./state-machine.md)**.

### Assessment does not own

- Users / authentication / password hashes
- Student or teacher profile CRUD
- Courses, groups, enrollments (as source of truth)
- Lessons, schedule, availability
- Payments, AlfaBank
- Telegram bots / lesson confirmations
- Materials library (beyond referencing SecureFiles for exam media)
- Certificate issuance workflow (optional bridge later)

## Identity & references

Assessment **uses** CRM identifiers; it does not redefine people:

| Reference | Source of truth | Usage in Assessment |
|-----------|-----------------|---------------------|
| `user_id` | `users` | Audit / actor on attempts |
| `student_id` | `students` | Who takes an exam / owns a result |
| `teacher_id` | `teachers` | Author / reviewer / assignment target (teacher attestation) |
| `course_template_id` | `course_templates` | Optional assignment scope |
| `group_id` | `groups` | Optional assignment scope |

Rules:

- Prefer foreign keys to CRM tables for referential integrity while co-located in one DB.
- Do **not** copy student/teacher name/email into Assessment as the system of record.
- Do **not** update CRM entities from Assessment services (no “fix lesson status from attempt”, etc.).

## Access control

- HTTP auth: existing `JwtAuthGuard` + `RolesGuard` + app roles `admin` | `teacher` | `student`.
- Domain rules: `AssessmentAccessService` in global `DomainAccessModule` (same pattern as certificates / materials).
- Assessment must not invent a parallel login or role system.

## Forbidden coupling

Assessment code **must not**:

- mutate User / Student / Teacher / Lesson / Payment / Material aggregates;
- start TypeORM transactions that write Assessment + CRM domain tables together for convenience;
- import CRM service methods to “reach through” and change foreign domain state;
- store stable business exam data in JSON/JSONB (`json_record` is forbidden project-wide).

Allowed:

- read CRM repositories/services for **authorization scope** (e.g. resolve `student_id` from JWT);
- call SecureFiles for upload/signed URLs of question media;
- emit notifications via existing NotificationsModule with Assessment as the event source (later phases).

## Module layout

```text
apps/api/src/modules/assessment/
  assessment.module.ts
  controllers/
  services/
  repositories/   (empty until entities)
  entities/       (empty until entities)
  dto/            (empty until APIs)
  enums/          (QuestionType, AttemptStatus — vocabulary only)
  guards/         (empty; use global JWT/roles unless domain-specific needed)
  types/
```

Access service:

```text
apps/api/src/common/access/assessment-access.service.ts
```

## Current scaffold

- `GET /api/assessment/health` → `{ "module": "assessment", "status": "ok" }` (JWT required)
- Enums prepared: `QuestionType`, `AttemptStatus`
- No TypeORM entities, no migrations, no exam business logic

## Next phases

1. Relational entities + migrations (`assessment_*`) — **ready to start** (architecture frozen)
2. Authoring APIs
3. Assignment + attempts
4. Scoring + results
5. Frontend surfaces

Do not add Exam / Question / Attempt entities until explicitly requested.
