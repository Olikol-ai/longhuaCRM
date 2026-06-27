# Этап 3: Typed Domain Services

**Предшественник:** [02-domain.md](./02-domain.md)  
**Следующий:** [04-api.md](./04-api.md)  
**Трудоёмкость:** 32–48 ч

---

## Цель

Заменить бизнес-логику в EntityRepositoryService на typed domain services per aggregate.

## Зачем

SRP, тестируемость, подготовка к typed API, убрать God Object.

## Файлы (новые модули)

```
apps/api/src/modules/
  students/
    students.module.ts
    students.service.ts
    students.repository.ts
    dto/
  teachers/
  lessons/
  payments/
  courses/
  materials/
  schedule/
  shop/
```

## Файлы (рефакторинг)

- `alfabank.service.ts`
- `jobs.service.ts`
- `settings.service.ts`

## Entity

Все CRM aggregates.

## Зависимые сервисы (миграция с EntityRepositoryService)

| Сервис | Переключить на |
|--------|----------------|
| AlfaBankService | PaymentsService, ShopItemsService, StudentsService, CoursesService |
| JobsService | LessonsService, StudentsService, TeachersService, MaterialAccessService |
| SettingsService | AppSettingsRepository (typed) |
| EntitiesController | пока EntityRepositoryService (до этапа 4) |

## Риски

| Риск | Митигация |
|------|-----------|
| Дублирование логики mapper vs service | Service returns API records или DTO |
| Regression в Jobs/AlfaBank | Integration tests до переключения |

## Критерии завершения

- [ ] AlfaBankService не импортирует EntityRepositoryService
- [ ] JobsService не импортирует EntityRepositoryService
- [ ] SettingsService использует typed repository
- [ ] Unit tests для StudentsService, LessonsService, PaymentsService
- [ ] `npm run build` OK

---

## Задачи

### Этап 3 — students

#### Модуль: students (новый)

##### Файл: `students.repository.ts`

###### Изменение: TypeORM repo wrapper — find, findById, save, updateBalance

- **Причина:** изолировать data access
- **Что может сломаться:** —
- **Как проверить:** unit test with mock repo

##### Файл: `students.service.ts`

###### Изменение: getById, list, create, update, adjustLessonBalance, findByUserId

- **Причина:** бизнес-логика баланса в одном месте
- **Что может сломаться:** Payments.jsx manual balance update
- **Как проверить:** adjustBalance +1, -1

##### Файл: `students.module.ts`

###### Изменение: TypeOrmModule.forFeature([StudentEntity]), exports StudentsService

- **Причина:** NestJS DI
- **Как проверить:** module compiles

### Этап 3 — lessons

#### Модуль: lessons (новый)

##### Файл: `lessons.service.ts`

###### Изменение: list, filterByStatus, filterByDate, updateStatus, resolveStudentIds, markReminderSent

- **Причина:** JobsService dependency
- **Что может сломаться:** reminders, auto-complete
- **Как проверить:** filter planned lessons tomorrow

### Этап 3 — payments

#### Модуль: payments (новый)

##### Файл: `payments.service.ts`

###### Изменение: create, findByOrderNumber, findByCommentContains, markPaid

- **Причина:** AlfaBank flow
- **Что может сломаться:** webhook payment matching
- **Как проверить:** $contains search test

### Этап 3 — shop

#### Модуль: shop (новый)

##### Файл: `shop-items.service.ts`

###### Изменение: findByItemId, listActive, listByType

- **Причина:** AlfaBank init
- **Как проверить:** filter item_id=pack_8

### Этап 3 — materials

#### Модуль: materials (новый)

##### Файл: `material-access.service.ts`

###### Изменение: grant, revoke, listByUser, revokeAllNonAdmin

- **Причина:** JobsService.revokeAllAccess
- **Как проверить:** revokeAllAccess count

### Этап 3 — alfabank

##### Файл: `alfabank.service.ts`

###### Изменение: inject PaymentsService, ShopItemsService, StudentsService, CoursesService, AlfaBankOrdersService

- **Причина:** убрать EntityRepositoryService
- **Что может сломаться:** entire payment flow
- **Как проверить:** init + webhook integration test

### Этап 3 — jobs

##### Файл: `jobs.service.ts`

###### Изменение: inject LessonsService, StudentsService, TeachersService, MaterialAccessService

- **Причина:** убрать EntityRepositoryService
- **Что может сломаться:** cron reminders, backup
- **Как проверить:** sendLessonReminders24h manual trigger

### Этап 3 — settings

##### Файл: `settings.service.ts`

###### Изменение: inject AppSettingsRepository directly (TypeORM)

- **Причина:** убрать filter через God Service
- **Что может сломаться:** Telegram token lookup
- **Как проверить:** getTelegramBotToken()

### Этап 3 — app

##### Файл: `app.module.ts`

###### Изменение: import новые modules

- **Причина:** DI graph
- **Как проверить:** bootstrap

---

## Порядок реализации

1. StudentsService + repository
2. LessonsService
3. PaymentsService + ShopItemsService
4. CoursesService, TeachersService
5. MaterialAccessService, AppSettingsRepository
6. Refactor AlfaBankService
7. Refactor JobsService
8. Refactor SettingsService

## Параллельно

StudentsService и LessonsService — разные разработчики/агенты после этапа 2a.

## Запрещено до этапа 3

Удаление EntityRepositoryService (ещё нужен EntitiesController).
