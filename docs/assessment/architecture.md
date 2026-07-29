# Assessment Architecture

## Hierarchy

```
Question → ExamBlock → Exam → Assignment → Attempt → Result → Certificate
```

ExamBlock is the only composition source for exams. There is no ExamTemplate or Blueprint layer.

## Bounded context

Owns:

- Question banks and questions
- Exam blocks (ordered question sets with metadata)
- Exams (materialized from blocks), sections, exam questions
- Assignments, attempts, snapshots, results
- Assessment change journal (`old_version` / `new_version` as text)

Does not own users, payments, or schedule. ACL lives in `AssessmentAccessService`.

## Content lifecycle

Bank, Question, ExamBlock, Exam: `draft` → `published` (ACTIVE) → `archived`.

Published content is immutable for authoring edits. Delete unused content hard; otherwise archive.

## Roles

- `admin` — full access
- `teacher` / `tutor` — own content (created_by_user_id) and own students' results
- `student` — assigned exams, own attempts/results
