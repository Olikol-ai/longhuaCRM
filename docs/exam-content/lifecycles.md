# Lifecycles

## Content item / group

```text
draft → in_review → published → archived
```

- Teachers/tutors create and edit **draft**.
- Submit → **in_review**.
- Publish requires `exam_content.publish` (or admin).
- Editing a **published** item creates a new revision (clone engine content + new meta row with `supersedes_item_id`). Old attempts keep old Assessment ids + snapshots.

## Blueprint edition

```text
draft → in_review → published → archived
```

- Learners only see **published** editions.
- Structure of a published edition is immutable.
- “Edit” = clone to new draft edition (`supersedes_edition_id`).
- Session start stores `blueprint_edition_id` permanently.

## Attempt reproducibility

Assessment snapshots freeze stems/answers/media keys at start.  
Bank edits never rewrite historical results.
