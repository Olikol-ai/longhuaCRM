# Variant generator

Service: `ExamContentVariantGenerator`

## Input

- `blueprintEditionId`
- optional `learnerUserId` (anti-repeat)
- optional `seed` (QA reproducibility)

## Per block slot

1. Resolve selection rule (or fixed group ids).
2. Candidate pool = published groups/items matching taxonomy, types, difficulty.
3. Exclude learner usage within `exclude_recent_days`.
4. Exclude media assets already used in this variant if `deny_duplicate_media`.
5. Apply balance constraints (`max_topic_share_percent`, `min_mid_difficulty_share_percent`, …).
6. Sample groups wholly until `select_count` / `select_group_count`.
7. If pool short: honor `allow_reuse_if_pool_short` or throw.

## Output

Ordered parts for Assessment materialization:

```ts
{ partKind, title, selectCount, pool: [{ questionId, readingTaskId, listeningTaskId, groupId }] }
```

## Side effects

- Write `exam_content_item_usage`
- Pin edition on Academy session
