# LessonMaterial

Материал урока хранится в таблице `materials` и привязывается к папке курса (`material_folders`).

## Удаление

- **Без связей** (`material_links`, `material_access`) — физическое удаление записи.
- **Со связями** — soft-delete: `status = 'deleted'`.
  - строки `material_links` (история уроков) **сохраняются**;
  - активный доступ в `material_access` отзывается (`access = false`);
  - материал исчезает из списков API (`status = active` по умолчанию).

Жёсткое удаление связанного материала блокируется FK `ON DELETE RESTRICT` на `material_links.material_id`.
