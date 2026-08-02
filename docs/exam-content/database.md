# ECP Database

Prefix: `exam_content_*`. Migrations via TypeORM (`synchronize=false`).

## Taxonomy

| Table | Purpose |
|-------|---------|
| `exam_content_programs` | HSK, HSKK, YCT, BCT, … |
| `exam_content_program_versions` | e.g. hsk_2_0 |
| `exam_content_levels` | HSK 1…6 |
| `exam_content_sections` | listening / reading / writing per level |
| `exam_content_subsections` | optional |
| `exam_content_topics` / `exam_content_subtopics` | theme taxonomy |

## Registry

| Table | Purpose |
|-------|---------|
| `exam_content_item_types` | code, engine_adapter, renderer_key, editor_key |

## Bank

| Table | Purpose |
|-------|---------|
| `exam_content_items` | metadata + engine_content_id |
| `exam_content_item_vocabulary` / `_grammar` | children |
| `exam_content_item_groups` | shared stimulus |
| `exam_content_group_items` | ordered membership |
| `exam_content_media_assets` | SecureFiles-backed library |
| `exam_content_item_media` / `_group_media` | links |

## Exams

| Table | Purpose |
|-------|---------|
| `exam_content_blueprints` | logical exam |
| `exam_content_blueprint_editions` | Version 1/2/3 + lifecycle |
| `exam_content_edition_sections` | order, duration, weight |
| `exam_content_edition_blocks` | under section |
| `exam_content_edition_block_slots` | rule or fixed |
| `exam_content_selection_rules` | filters + balance |
| `exam_content_selection_rule_topics` | topic filters |
| `exam_content_selection_rule_types` | item type filters |

## Ops

| Table | Purpose |
|-------|---------|
| `exam_content_item_usage` | anti-repeat ledger |
| `exam_content_item_stats` | use rates, discrimination |
| `exam_content_change_log` | audit |
| `exam_content_permissions` | publish capability |
| `exam_content_import_jobs` / `_rows` | import |
| `exam_content_export_jobs` | export |
| `exam_content_bulk_jobs` | bulk ops |

## Migration from Exam Academy

P1 copies catalog + content_items (+ vocab/grammar) from `exam_academy_*` into `exam_content_*`.  
Learner tables (`exam_academy_sessions`, favorites, …) stay on Academy.
