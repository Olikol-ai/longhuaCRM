# Product polish report

## Удаление материалов

**Проблема:**
При удалении материала в UI возникал Internal Server Error / сбой ответа (Maximum call stack size exceeded при сериализации). Жёсткое удаление при CASCADE на `material_links`/`material_access` могло стереть историю привязок к урокам.

**Причина:**
1. `DELETE /api/materials/:id` делал hard delete через TypeORM без учёта связей и бизнес-правила «не ломать историю».
2. Ответ/списки материалов обогащались через `Object.create(prototype)` TypeORM-сущностей → циклическая сериализация в `entityToApiRecord` (stack overflow) → клиент видел Internal Server Error.
3. Понятного сообщения пользователю не было — только общее «Ошибка при удалении».

**Исправление:**
1. Soft-delete: поле `materials.status` (`active` | `deleted`), миграция `1739300000000-MaterialSoftDelete`.
2. При наличии `material_links` или `material_access` — статус `deleted`, связи уроков сохраняются, доступ отзывается (`access=false`).
3. Без связей — hard delete после очистки access.
4. FK `material_links.material_id` → `ON DELETE RESTRICT` (защита истории на уровне БД).
5. `entityToApiRecord` — защита от циклов; `attachCourseIds` отдаёт plain-объекты.
6. UI показывает сообщение из API вместо Internal Server Error.

**Тесты:**
- API E2E: `apps/api/test/materials-deletion.e2e-spec.ts`
  - удаление без связей (hard);
  - удаление с `material_links` (soft + links persist);
  - удаление с access (soft + revoke).
- Playwright: `e2e/browser/materials-deletion.spec.ts` — удаление через UI на `/MaterialsHub`.
