> **HISTORICAL / COMPLETED (JSONB migration finished).**
> This file describes an earlier plan/audit that mentioned `data jsonb`, `slots jsonb`, or legacy JSON storage.
> **Current architecture:** relational CRM entities; TeacherAvailability via `teacher_availability_slots`; Assessment via snapshot tables; **no JSONB for business entities**.
> See [../Database.md](../Database.md) and [../architecture/storage-policy.md](../architecture/storage-policy.md).

# Этап 7: Testing

**Когда:** Непрерывно; пики на границах этапов 1, 2a, 3, 4  
**Трудоёмкость:** 16–24 ч (накопительно)

---

## Цель

Зафиксировать поведение до рефакторинга и предотвратить регрессии.

## Зачем

Без тестов миграция schema и замена God Service приведут к silent data loss.

## Файлы

```
apps/api/test/           # или src/**/*.spec.ts
apps/api/test/integration/
```

## Инструменты (рекомендация)

- Jest + @nestjs/testing
- supertest для HTTP
- testcontainers PostgreSQL (integration)

---

## Тесты ДО изменений (baseline)

Создать **до начала этапа 1** — snapshot текущего ожидаемого поведения API contracts.

### P0 — обязательно

| # | Тест | Файл | До этапа |
|---|------|------|----------|
| 1 | Auth login returns token + user snake_case | `auth.e2e-spec.ts` | 4 |
| 2 | Auth register creates user role=pending | `auth.e2e-spec.ts` | 4 |
| 3 | Migration up on empty DB | `migration.spec.ts` | 1 |
| 4 | Migration data jsonb → columns sample | `migration.spec.ts` | 1 |
| 5 | Student mapper round-trip | `student.mapper.spec.ts` | 2a |
| 6 | Lesson mapper round-trip | `lesson.mapper.spec.ts` | 2a |
| 7 | matchesFilter $contains | `record.util.spec.ts` | 2a |
| 8 | AlfaBank checksum validation | `alfabank.service.spec.ts` | 3 |

### P1 — важно

| # | Тест | До этапа |
|---|------|----------|
| 9 | Jobs resolveStudentIds (array vs single) | 3 |
| 10 | PaymentsService findByCommentContains | 3 |
| 11 | StudentsService adjustLessonBalance | 3 |
| 12 | Settings getTelegramBotToken env priority | 6 |
| 13 | RBAC student cannot PATCH other student | 4 |
| 14 | RBAC teacher cannot delete payment | 4 |

### P2 — желательно

| # | Тест | До этапа |
|---|------|----------|
| 15 | MaterialAccess grant/revoke | 3 |
| 16 | exportBackup structure | 3 |
| 17 | Welcome page public read | 4 |
| 18 | Shop items seed data shape | 2b |

---

## Тесты ПОСЛЕ каждого этапа

### После этапа 1

```bash
npm run migration:run --prefix apps/api
npm run test --prefix apps/api  # migration.spec
```

- [ ] No `data` column in any table
- [ ] Row counts preserved

### После этапа 2a

- [ ] GET /entities/Student returns `lesson_balance`
- [ ] POST /entities/Lesson creates with `start_time`
- [ ] Filter Payment with `$contains`

### После этапа 2b

- [ ] Payment create with `lessons_added`
- [ ] ShopSettings list returns `item_id`
- [ ] WelcomePage save/load `body_text`

### После этапа 2c

- [ ] FK violation on invalid teacher_id
- [ ] Cascade policy documented

### После этапа 3

- [ ] AlfaBank webhook integration (mock bank)
- [ ] Jobs reminder count > 0 with fixture data

### После этапа 4

- [ ] v2 students CRUD
- [ ] 403 matrix for roles

### После этапа 5

- [ ] Frontend smoke (manual or Playwright)

### После этапа 8

```bash
rg "json_record|row\.data|data jsonb" apps/api/src  # expect 0
```

---

## Задачи

### Этап 7 — setup

#### Модуль: api test infra

##### Файл: `apps/api/jest.config.js` (новый)

###### Изменение: NestJS jest preset

- **Причина:** run unit tests
- **Как проверить:** `npm test`

##### Файл: `apps/api/package.json`

###### Изменение: `"test": "jest"`, `"test:e2e": "jest --config jest-e2e.json"`

- **Причина:** scripts
- **Как проверить:** npm test

### Этап 7 — mapper tests

##### Файл: `apps/api/src/common/mappers/student.mapper.spec.ts`

- toRecord: lessonBalance → lesson_balance
- fromRecord: reverse
- dates ISO format

### Этап 7 — migration tests

##### Файл: `apps/api/test/migration.spec.ts`

- Use test DB or testcontainers
- up → verify schema → down (optional)

### Этап 7 — e2e

##### Файл: `apps/api/test/auth.e2e-spec.ts`

- login, me, register

##### Файл: `apps/api/test/entities-student.e2e-spec.ts`

- CRUD through /entities/Student (phase 2a)
- Later: /api/v2/students (phase 4)

---

## Coverage targets

| Layer | Target |
|-------|--------|
| Mappers | 90%+ |
| Domain services | 80%+ |
| Controllers e2e | Core paths |
| Migrations | up + data spot check |

## CI recommendation

```yaml
# .github/workflows/api.yml
- npm run build --prefix apps/api
- npm run test --prefix apps/api
- npm run migration:run (test DB)
```

## Что НЕ тестировать

- Telegram Bot API real calls (mock fetch)
- Alfa Bank real API (mock)
- Frontend unit tests (unless requested) — manual smoke OK for phase 5
