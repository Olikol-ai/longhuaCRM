# Extension guide

## Add a new international exam (e.g. YCT)

1. Insert `exam_content_programs` row (`code=yct`).
2. Add program versions and levels.
3. Add section templates (listening/reading/…).
4. Register allowed item types on sections if needed.
5. Create blueprint + edition with Section→Block→Slots/rules.
6. Import or author bank items tagged to YCT taxonomy.
7. Publish edition.
8. Point product UI (or Academy catalog filter) at the new program — **no generator rewrite**.

## Add a new item type

1. Insert `exam_content_item_types` (`code`, `engine_adapter`, `renderer_key`, `editor_key`).
2. Implement backend `ItemTypeHandler` registered by `code`.
3. Add FE editor + runtime components in registries.
4. No changes to session lifecycle or generator core (only filters by type codes).

## Do not

- Add HSK-specific branches in generator.
- Store stable business entities in JSONB/`json_record`.
- Auto-publish AI drafts.
