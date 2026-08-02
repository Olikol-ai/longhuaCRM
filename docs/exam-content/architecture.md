# Exam Content Platform (ECP) — Architecture

Status: **approved for implementation**  
Module: `apps/api/src/modules/exam-content`  
Tables: `exam_content_*`  
Product skin: HSK Academy (`exam-academy` learner layer)  
Engine: Assessment (attempts, snapshots, scoring)

## Principles

1. Universal exam platform — HSK is the first program, not the architecture.
2. Assessment = grading/runtime engine only.
3. ECP = sole source of bank content, structure, and variant generation rules.
4. Configuration over hard-coding — no `if (hsk)` in generators.
5. Item types via DB registry + plugin handlers (no closed product enums).
6. Versioning + snapshots — published edits never mutate past attempts.
7. Relational PostgreSQL only — no `json_record` for stable business entities.
8. Teachers assemble international exams without engineer involvement.

## Bounded contexts

```text
Exam Content Studio (CRM UI)
        ↓
Exam Content Platform (taxonomy, bank, groups, media, blueprints/editions, generator)
        ↓ materialize
Assessment Engine (pools, attempts, snapshots, results)
        ↑ runtime
HSK Academy (sessions, learner cabinet)
```

## Structure

```text
Blueprint → Edition
  → Section → Block → Slot (rule | fixed groups)
Item Group (shared stimulus) → Items
```

Standalone items are implicit groups of one.

## Lifecycles

Items / Groups / Editions: `draft → in_review → published → archived`  
Published editions are immutable for learners; edits clone a new edition.

## Generator

`ExamContentVariantGenerator` selects published groups by edition slot rules  
(balance, anti-repeat, media dedup), materializes Assessment exam pools,  
pins `blueprint_edition_id` on the Academy session.

## See also

- [database.md](./database.md)
- [api.md](./api.md)
- [lifecycles.md](./lifecycles.md)
- [extension-guide.md](./extension-guide.md)
- [generator.md](./generator.md)
