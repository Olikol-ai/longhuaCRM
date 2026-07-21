# LongHua Assessment — Architecture Boundaries

Status: **implemented** (entities, migrations, services, HTTP API)  
Context: bounded module inside LongHuaCRM NestJS API (`apps/api`)  
Storage: [../architecture/storage-policy.md](../architecture/storage-policy.md)

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
- Attempts, **relational snapshots**, attempt answers + **answer selections**, results + **breakdowns**

All PostgreSQL tables use the prefix:

```text
assessment_
```

Content lifecycle (Question, ExamTemplate, Blueprint, Exam): `draft` → `published` (immutable) → `archived`.

Attempt lifecycle: `created` → `started` → `submitted` (`submit_reason`: `manual` \| `timeout` \| `system`; **no** `expired`).  
Result lifecycle: `processing` → optional `pending_review` → `passed` \| `failed` \| `invalidated` (`evaluation_type`: `automatic` \| `manual` \| `mixed`).  
Assignment cancel forbidden if any Attempt is `started` (`409`).

Full entity graph and snapshot strategy:  
**[domain-model.md](./domain-model.md)**.

Public REST contract:  
**[api-contract.md](./api-contract.md)**.

Lifecycle / state machines:  
**[state-machine.md](./state-machine.md)**.

### Assessment does not own

- Users / authentication / password hashes
- Student or teacher profile CRUD
- Courses, groups, enrollments (as source of truth)
- Lessons, schedule, availability
- Payments, AlfaBank
- Telegram bots / lesson confirmations
- Materials library (beyond referencing SecureFiles for exam media)
- Certificate issuance workflow (bridge via `assessment_result_id` when issued)

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

## Storage (no business JSONB)

Assessment **must not** store stable exam / attempt / result payloads in JSON/JSONB (`json_record` forbidden project-wide).

Attempt content is persisted as **snapshot tables**:

| Table | Role |
|-------|------|
| `assessment_question_snapshots` | Frozen question for an attempt |
| `assessment_answer_snapshots` | Frozen answer options |
| `assessment_attempt_answers` | Participant response |
| `assessment_attempt_answer_selections` | Selected options (normalized rows) |
| `assessment_result_breakdowns` | Per-section scores |

Allowed non-business integrations:

- read CRM repositories/services for **authorization scope**;
- call SecureFiles for upload/signed URLs of question media;
- emit notifications via NotificationsModule / certificate bridge after pass.

## Module layout

```text
apps/api/src/modules/assessment/
  assessment.module.ts
  controllers/
  services/
  repositories/
  entities/
  dto/
  enums/
  guards/
  types/
```

Access service lives under `apps/api/src/common/access/` (DomainAccessModule), consistent with other domains.
