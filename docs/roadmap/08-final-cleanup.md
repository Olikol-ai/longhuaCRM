# Этап 8: Final Cleanup

**Предшественник:** [04-api.md](./04-api.md) + [05-frontend.md](./05-frontend.md)  
**Трудоёмкость:** 20–28 ч

Включает: legacy removal, TeacherAvailability slots, balance unification (бывший этап 9 plan).

---

## Цель

Удалить JSON/legacy артефакты; завершить relational modeling (slots, balance).

## Зачем

Definition of Done рефакторинга; чистая кодовая база без технического долга.

## Файлы для удаления/изменения

- `modules/entities/entity-repository.service.ts`
- `modules/entities/entities.controller.ts`
- `modules/entities/entities.module.ts` (или свернуть)
- `common/utils/record.util.ts`
- `database/scripts/import-json.ts`
- `modules/legacy/legacy.module.ts`
- `entities/json-record.entity.ts` (finalize git delete)
- `base44/` folder
- `ShopSetting.entity.ts`, `WelcomePageSetting.entity.ts` (if replaced)
- `entities/Shop.entity.ts`, `WelcomePage.entity.ts` (dead)

## Entity

TeacherAvailabilityEntity (+ new Slot entity), StudentEntity, LessonBalanceEntity.

## Зависимые сервисы

Все должны уже использовать typed services (этапы 3–5).

## Риски

| Риск | Митигация |
|------|-----------|
| Удаление API до frontend migration | grep base44.entities = 0 first |
| slots migration data loss | backup jsonb slots |

## Критерии завершения

- [ ] grep `json_record|row\.data|data jsonb` в apps/api/src = 0
- [ ] `/entities/:entity` удалён
- [ ] `base44/` удалён или в archive/
- [ ] TeacherAvailability slots relational
- [ ] Balance single source of truth
- [ ] README обновлён
- [ ] `npm run build` OK

---

## Часть A: Legacy cleanup

### Этап 8 — entities module

#### Модуль: entities

##### Файл: `entity-repository.service.ts`

###### Изменение: DELETE

- **Причина:** replaced by domain services
- **Что может сломаться:** anything still importing
- **Как проверить:** grep EntityRepositoryService = 0

##### Файл: `entities.controller.ts`

###### Изменение: DELETE

- **Причина:** replaced by v2 controllers
- **Как проверить:** no /entities routes

##### Файл: `entities.module.ts`

###### Изменение: remove or empty module

- **Причина:** AppModule import cleanup
- **Как проверить:** bootstrap

#### Модуль: common

##### Файл: `record.util.ts`

###### Изменение: DELETE if unused

- **Причина:** legacy record abstraction
- **Как проверить:** grep recordFromEntity

#### Модуль: database

##### Файл: `import-json.ts`

###### Изменение: DELETE

- **Причина:** one-time migration done
- **Как проверить:** package.json script removed

#### Модуль: legacy

##### Файл: `legacy.module.ts`, `legacy.controller.ts`

###### Изменение: DELETE if frontend migrated off Base44 public-settings path

- **Причина:** Base44 compat
- **Как проверить:** grep apps/public/prod

#### Repo root

##### Папка: `base44/`

###### Изменение: DELETE or move to `docs/archive/base44/`

- **Причина:** not runtime
- **Как проверить:** no imports

##### Файл: `entities/json-record.entity.ts`

###### Изменение: git rm, commit deletion

- **Причина:** prohibited pattern
- **Как проверить:** file absent

#### Модуль: app

##### Файл: `app.module.ts`

###### Изменение: remove EntitiesModule, LegacyModule imports

- **Как проверить:** build

---

## Часть B: TeacherAvailability slots

### Этап 8 — availability

#### Модуль: entities

##### Файл: `TeacherAvailabilitySlot.entity.ts` (новый)

```typescript
@Entity('teacher_availability_slots')
teacherAvailabilityId, day, from, to
```

- **Причина:** no jsonb for business data
- **Что может сломаться:** TeacherAvailabilityTab UI
- **Как проверить:** CRUD slots per teacher

##### Файл: `TeacherAvailability.entity.ts`

###### Изменение: remove `slots` jsonb; `@OneToMany` → slots

- **Причина:** relational model
- **Как проверить:** migration

#### Модуль: database

##### Файл: `1730000000006-TeacherAvailabilitySlots.ts`

- CREATE teacher_availability_slots
- INSERT FROM jsonb_array_elements(slots)
- DROP COLUMN slots

#### Модуль: frontend

##### Файл: `TeacherAvailabilityTab.jsx`

###### Изменение: API returns slots array (same shape) from relational backend

- **Проверить:** save weekly schedule

---

## Часть C: Balance unification

### Этап 8 — balance

**Решение из ADR-003** (этап 0): рекомендуется `Student.lessonBalance` as source of truth; `LessonBalanceEntity` — deprecated или sync view.

#### Модуль: students

##### Файл: `students.service.ts`

###### Изменение: единый `adjustBalance(studentId, delta, reason)` used by Payments, Lessons, AlfaBank

- **Причина:** DRY, no double balance
- **Что может сломаться:** Payments.jsx duplicate update
- **Как проверить:** payment + lesson complete = correct balance

#### Модуль: entities

##### Файл: `LessonBalance.entity.ts`

###### Изменение: deprecate OR sync trigger from Student.lessonBalance

- **Причина:** duplication
- **Как проверить:** one balance value in UI

#### Модуль: database

##### Файл: `1730000000007-UnifyBalance.ts`

- Migrate lesson_balances data → students.lesson_balance
- Optional: drop lesson_balances table

#### Модуль: frontend

##### Файлы: Payments.jsx, Schedule.jsx, TeacherDashboard.jsx

###### Изменение: remove client-side balance math where server handles it

- **Причина:** single source of truth
- **Как проверить:** payment create doesn't double-add lessons

---

## Часть D: Documentation

##### Файл: `README.md`

###### Изменение: update architecture, migration commands, no base44 references

- **Как проверить:** new developer onboarding

---

## Миграции (этап 8)

- `1730000000006-TeacherAvailabilitySlots.ts`
- `1730000000007-UnifyBalance.ts`

## API changes

- Remove `/api/entities/*`
- TeacherAvailability v2: nested `/api/v2/teachers/:id/availability/slots`

## Frontend changes

- TeacherAvailabilityTab → v2 API
- Remove any remaining base44 imports
- Payments: server-side balance adjustment only

## Telegram

- Payment notification uses unified balance in message text

## Финальная проверка

```bash
# No legacy patterns
rg "json_record|JsonRecord|row\.data|data jsonb|base44\.entities" apps/api/src src

# Build
npm run build --prefix apps/api
npm run build

# Migrations
npm run migration:run --prefix apps/api
```

## Запрещено до этапа 8

| Action | Blocked until |
|--------|---------------|
| Delete EntityRepositoryService | Этап 5 complete |
| Delete /entities routes | grep base44.entities = 0 |
| Drop lesson_balances | ADR-003 + data migration |
| Drop jsonb slots | Slot entity + UI tested |
