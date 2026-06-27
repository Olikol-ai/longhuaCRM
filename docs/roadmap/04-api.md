# Этап 4: Typed API + RBAC

**Предшественник:** [03-services.md](./03-services.md)  
**Следующий:** [05-frontend.md](./05-frontend.md)  
**Трудоёмкость:** 56–84 ч (API 40–60 + RBAC 16–24)

---

## Цель

Ввести typed REST API с DTO и role-based access; deprecate generic `/entities/:entity`.

## Зачем

Типизация, валидация, безопасность, основа для frontend migration.

## Файлы

- Новые: `modules/*/controllers/*.controller.ts`, `dto/*.dto.ts`
- Изменения: `common/guards/`, `auth/dto/update-me.dto.ts`, `functions.controller.ts`
- Deprecate: `entities.controller.ts`, `entity-repository.service.ts` (после этапа 5)

## Entity

Все — через domain services.

## Зависимые сервисы

Все domain services из этапа 3.

## Риски

| Риск | Митигация |
|------|-----------|
| Breaking API | Parallel v2 routes |
| RBAC gaps | Security test matrix |

## Критерии завершения

- [ ] `/api/v2/*` endpoints для core aggregates
- [ ] DTO validation на всех write operations
- [ ] RBAC: teacher/student ограничения работают
- [ ] Cron functions защищены
- [ ] UpdateMe не меняет role для non-admin
- [ ] Generic `/entities/*` помечен deprecated (headers)

---

## Задачи

### Этап 4 — common/guards

#### Модуль: common

##### Файл: `common/guards/roles.guard.ts` (новый)

###### Изменение: `@Roles('admin', 'teacher')` decorator + guard

- **Причина:** centralized RBAC
- **Что может сломаться:** existing auth flows
- **Как проверить:** role matrix tests

##### Файл: `common/decorators/roles.decorator.ts` (новый)

###### Изменение: SetMetadata ROLES_KEY

- **Причина:** guard support
- **Как проверить:** unit test

### Этап 4 — students API

#### Модуль: students

##### Файл: `students.controller.ts` (новый)

###### Изменение: REST `/api/v2/students` GET, POST, PATCH, DELETE

- **Причина:** typed API
- **Что может сломаться:** UserManagement, Schedule
- **Как проверить:** Postman/curl CRUD

##### Файл: `dto/create-student.dto.ts`, `update-student.dto.ts`

###### Изменение: class-validator, snake_case `@Expose` or custom pipe

- **Причина:** validation
- **Как проверить:** 400 on invalid email

### Этап 4 — lessons API

##### Файл: `lessons.controller.ts`

- GET list with filters (date, status, teacher_id)
- PATCH status
- **Guards:** teacher owns lesson or admin

### Этап 4 — payments API

##### Файл: `payments.controller.ts`

- CRUD + admin only for delete
- **Проверить:** Payments.jsx parallel client

### Этап 4 — materials, courses, schedule, shop, welcome

Аналогичные controllers по [audit/api.md](../audit/api.md).

### Этап 4 — auth security

##### Файл: `auth/dto/update-me.dto.ts`

###### Изменение: убрать `role` или admin-only endpoint `PATCH /auth/users/:id/role`

- **Причина:** privilege escalation
- **Что может сломаться:** UserManagement role change
- **Как проверить:** student cannot set role=admin

### Этап 4 — functions

##### Файл: `functions.controller.ts`

###### Изменение: JwtAuthGuard + AdminGuard на cron functions; use AdminGuard instead of inline

- **Причина:** `functions.controller.ts:55`, unused AdminGuard import
- **Что может сломаться:** external cron triggers
- **Как проверить:** no auth → 401 on sendLessonReminders

### Этап 4 — entities (deprecation)

##### Файл: `entities.controller.ts`

###### Изменение: add `Deprecation: true` header; log warnings

- **Причина:** migration path
- **Как проверить:** header present

---

## API changes summary

| Resource | v2 Path | Methods |
|----------|---------|---------|
| Students | `/api/v2/students` | GET, POST, PATCH, DELETE |
| Teachers | `/api/v2/teachers` | GET, POST, PATCH, DELETE |
| Lessons | `/api/v2/lessons` | GET, POST, PATCH, DELETE |
| Payments | `/api/v2/payments` | GET, POST, PATCH, DELETE |
| Courses | `/api/v2/courses` | GET, POST, PATCH, DELETE |
| Materials | `/api/v2/materials` | GET, POST, PATCH, DELETE |
| Schedule | `/api/v2/schedule-slots` | GET, POST, PATCH, DELETE |
| Shop | `/api/v2/shop-items` | GET, POST, PATCH, DELETE |
| Welcome | `/api/v2/welcome-page` | GET, PUT |
| Settings | `/api/v2/settings` | GET, PATCH (admin) |

## RBAC matrix implementation

См. [audit/security.md](../audit/security.md).

## Frontend

Параллельно начать [05-frontend.md](./05-frontend.md) после первых v2 endpoints.

## Telegram

Cron protection — см. [06-telegram.md](./06-telegram.md).

## Тесты

E2E per controller — [07-testing.md](./07-testing.md).
