# Этап 5: Frontend Migration

**Предшественник:** [04-api.md](./04-api.md) (parallel после первых v2 endpoints)  
**Следующий:** [08-final-cleanup.md](./08-final-cleanup.md)  
**Трудоёмкость:** 24–40 ч

---

## Цель

Перевести React UI с `base44.entities.*` на typed `/api/v2/*` clients.

## Зачем

Убрать зависимость от generic legacy API; включить типизацию и RBAC на UI.

## Файлы

- `src/api/base44Client.js` — refactor или replace
- `src/api/clients/*.js` (новые)
- 40+ страниц/компонентов (см. [audit/frontend.md](../audit/frontend.md))

## Entity (через UI)

Все — по мере миграции страниц.

## Backend зависимости

Соответствующие v2 endpoints из этапа 4.

## Риски

| Риск | Митигация |
|------|-----------|
| Partial migration | Feature flags per page |
| Field name drift | Shared API types / OpenAPI |

## Критерии завершения

- [ ] Нет `base44.entities` в src (grep = 0)
- [ ] Все P0 страницы на v2 API
- [ ] Auth flow работает
- [ ] `npm run build` (vite) OK

---

## Задачи по приоритету

### P0 — блокирует бизнес

#### Модуль: api

##### Файл: `src/api/clients/students.js` (новый)

###### Изменение: list, get, create, update, delete → `/api/v2/students`

- **Причина:** foundation client
- **Что может сломаться:** все Student pages
- **Как проверить:** UserManagement list

##### Файл: `src/api/clients/lessons.js` (новый)

- **Причина:** Schedule core
- **Проверить:** Schedule.jsx load

##### Файл: `src/api/clients/payments.js` (новый)

- **Причина:** Payments.jsx
- **Проверить:** create payment + balance update

##### Файл: `src/api/index.js` (новый)

###### Изменение: export clients; deprecate base44.entities

- **Причина:** single import point
- **Как проверить:** tree-shaking build

#### Модуль: pages

##### Файл: `src/pages/Payments.jsx`

###### Изменение: `base44.entities.Payment` → `paymentsClient`

- **Причина:** P0 business
- **Что может сломаться:** balance sync on create/delete
- **Как проверить:** manual payment flow

##### Файл: `src/pages/Schedule.jsx`

###### Изменение: lessons + students clients

- **Проверить:** create lesson, complete, balance deduct

##### Файл: `src/pages/ShopSettingsAdmin.jsx`

###### Изменение: shop items client

- **Проверить:** seed + CRUD packages

##### Файл: `src/pages/WelcomePageEditor.jsx`, `Welcome.jsx`

###### Изменение: welcome page client

- **Проверить:** public read + admin edit

##### Файл: `src/pages/UserManagement.jsx`

###### Изменение: students, teachers, users clients

- **Проверить:** role assignment, delete cascade

### P1 — materials & access

##### Файлы: `MaterialsHub.jsx`, `WindowsFileBrowser.jsx`, `lib/materialAccess.js`, `BulkAccessModal.jsx`

###### Изменение: materials + material-access v2

- **Причина:** MaterialAccess model fix (user_id based)
- **Что может сломаться:** BulkAccessModal student_ids logic
- **Как проверить:** grant/revoke access

### P2 — dashboards & analytics

##### Файлы: `Analytics.jsx`, `ExportData.jsx`, `AdminDashboard.jsx`, `TeacherDashboard.jsx`, `StudentDashboard.jsx`, ...

###### Изменение: batch replace base44.entities

- **Проверить:** smoke test each page

### P3 — auth client

##### Файл: `src/api/base44Client.js`

###### Изменение: keep `base44.auth` temporarily OR migrate to `authClient`

- **Причина:** auth already typed on backend
- **Проверить:** login/logout/me

---

## Порядок миграции страниц

```
1. Auth (login/me) — уже typed backend
2. Payments + ShopSettings + Welcome
3. Schedule + TeacherSchedule
4. UserManagement
5. Materials hub
6. Dashboards, Analytics, Export
7. Student/Teacher portals
8. Remove base44.entities factory
```

## Параллельная работа

Разные страницы — разные агенты после готовности соответствующего v2 endpoint.

## API changes required

Все из [04-api.md](./04-api.md) для затрагиваемых страниц.

## Telegram

Без прямых изменений UI; reminders зависят от Lessons/Students API correctness.

## Тесты

- Cypress/Playwright smoke: login → schedule → payment (опционально)
- Manual checklist per page

## Запрещено

Удалять `/entities/*` backend до grep `base44.entities` = 0.
