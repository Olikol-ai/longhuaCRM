# Группы (Group)

Группа — набор учеников с преподавателем.

## Модель

```text
Group
 ├── name
 ├── teacher
 └── students (group_members)
```

Занятия создаются только в общем разделе **Расписание**:

```text
Расписание → Создать занятие → Тип «Групповой» → выбрать группу
```

## UI

| Маршрут | Роли | Описание |
|---------|------|----------|
| `/Groups` | admin, teacher | Список групп |
| `/Groups/:groupId` | admin, teacher | Ученики + read-only «Расписание» |

Вкладка **Расписание** внутри группы:

- показывает lessons с `groupId` этой группы (из `GET /groups/:id/workspace`);
- **Предстоящие** / **История**;
- без создания серий, слотов и `lesson-series`;
- кнопка «Открыть в расписании» → общий Schedule.

Участники исторического урока — из attendance snapshot, не из текущего `group_members`.

## API

| Метод | Путь | Описание |
|-------|------|----------|
| CRUD / members | `/api/groups` | Группа и состав |
| Workspace | `/api/groups/:id/workspace` | `lessons` уже отфильтрованы по `groupId` |
| Create lesson | `POST /api/lessons` `lessonType=group` | Только через Schedule UI |
