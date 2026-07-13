# Materials — доступ к материалам

## Сущности

| Сущность | Таблица | Назначение |
|----------|---------|------------|
| **Material** | `materials` | Файл/материал (`status`: `active` \| `deleted`) |
| **MaterialFolder** | `material_folders` | Папка курса (`course_template_id`) |
| **LessonMaterial** | `material_links` | Связь материал ↔ урок (история) |
| **MaterialAccess** | `material_access` | Персональный грант: `user_id` + `material_id` + `access` |
| **MaterialCourseGrant** | `material_course_grants` | Явный грант курсу (`course_template_id` + `material_id`) |
| **MaterialGroupGrant** | `material_group_grants` | Явный грант группе (`group_id` + `material_id`) |
| **Enrollment** | `enrollments` | Ученик зачислен на курс (`student_id`, `course_template_id`) |
| **Group / GroupMember** | `groups`, `group_members` | Группа и участники |

Доступ **не** хранится в JSON. Права живут в реляционных таблицах с уникальными ограничениями:

- `material_access (user_id, material_id)` — UNIQUE
- `material_course_grants (course_template_id, material_id)` — UNIQUE
- `material_group_grants (group_id, material_id)` — UNIQUE

## Кто видит материалы

### Администратор
Видит все активные материалы (`status = active`). Soft-deleted скрыты из списков.

### Ученик
Объединение источников (OR). Материал доступен, если он **active** и выполняется хотя бы одно:

1. **Персональный грант** — `material_access.access = true` для `user_id` учётки ученика  
   (`students.user_id` → `material_access.user_id`; не путать `student.id` с `user.id`).
2. **Грант курсу** — есть строка в `material_course_grants` на курс, на который ученик зачислен (`enrollments`).
3. **Папка курса** — материал лежит в `material_folders` курса, на который ученик зачислен  
   (библиотека курса без отдельного гранта на каждый файл).
4. **Грант группе** — есть строка в `material_group_grants` и ученик состоит в группе (`group_members`).

### Преподаватель
1. Персональные гранты своей учётки.
2. Материалы с грантами на группы, где `groups.teacher_id` = профиль преподавателя.
3. Материалы курсов (грант курсу + папки курса), на которые зачислены:
   - ученики с `assigned_teacher_id` = этот преподаватель;
   - участники его групп.

## Выдача доступа (админ / преподаватель)

API:

- `POST /api/materials/access/grant` — аддитивная выдача  
  `targetType`: `user` \| `student` \| `group` \| `course`
- `POST /api/materials/access/revoke` — отзыв того же типа
- `GET /api/materials/access/material/:id` — явные гранты материала (список получателей)
- `GET /api/materials/access/check/:id` / `GET /api/material-access/check/:id` — есть ли доступ у **текущего** пользователя
- `PUT /api/material-access/user/:userId` — sync персональных грантов редактора (полная замена персонального набора)

Поведение grant:

- повторная выдача **не создаёт дубль** (skip при уже существующей активной записи);
- `student` → резолвится в `students.user_id`, затем пишется в `material_access`;
- `group` / `course` → строки в `material_group_grants` / `material_course_grants` (не копируются на каждого ученика).

Поведение revoke:

- персональный: `material_access.access = false` (строка сохраняется — история);
- группа/курс: удаление строки гранта (уникальный ключ позволяет выдать снова).

UI:

- **Предоставить доступ** (`GrantAccessModal`) — ученик / группа / курс.
- **Управление доступом** (`AccessControlModal`) — персональные чекбоксы учеников по `material_access`.

## Приоритеты / порядок разрешения

Нет «отменяющего» приоритета между источниками: доступ = **true**, если любой источник даёт true.  
Админ обходит фильтры списка. Soft-deleted (`status = deleted`) никогда не попадают в список и не открываются по файлу.

## Источники доступа в UI

Рядом с материалом показываются бейджи:

- **Персональный доступ** — запись в `material_access`
- **Доступ через курс** — `material_course_grants` или материал в папке зачисленного курса
- **Доступ через группу** — `material_group_grants` + членство в группе

Админ в «Управление доступом» видит текущие гранты, источник и может отозвать явные права.

## Удалённые материалы

См. также `docs/domain/LessonMaterial.md`:

- без связей — hard delete;
- со связями — soft-delete, активный `material_access` отключается;
- гранты курсу/группе каскадно удаляются FK `ON DELETE CASCADE` при hard delete материала.

## Идентификаторы (частые ошибки)

| Контекст | Правильный ID |
|----------|----------------|
| `material_access.user_id` | `users.id` (= `students.user_id`) |
| Грант ученику в API (`targetType=student`) | `students.id` |
| Грант курсу | `course_templates.id` (не путать с enrollment id) |
| Папка / автодоступ библиотеки | `material_folders.course_template_id` |
