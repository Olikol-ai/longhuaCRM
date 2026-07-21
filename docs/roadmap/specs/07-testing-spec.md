> **HISTORICAL / COMPLETED (JSONB migration finished).**
> This file describes an earlier plan/audit that mentioned `data jsonb`, `slots jsonb`, or legacy JSON storage.
> **Current architecture:** relational CRM entities; TeacherAvailability via `teacher_availability_slots`; Assessment via snapshot tables; **no JSONB for business entities**.
> See [../../Database.md](../../Database.md) and [../../architecture/storage-policy.md](../../architecture/storage-policy.md).

# Спецификация этапа 7: Testing Strategy

**Roadmap:** [07-testing.md](../07-testing.md)  
**Предшественник:** этап 0 (baseline до этапа 1); пики на границах этапов 1, 2a, 3, 4, 6, 8  
**Следующий:** непрерывно; финальная верификация в [08-final-cleanup-spec.md](./08-final-cleanup-spec.md)  
**Аудит:** [docs/audit/services.md](../../audit/services.md), [api.md](../../audit/api.md), [database.md](../../audit/database.md), [security.md](../../audit/security.md), [telegram.md](../../audit/telegram.md)  
**Трудоёмкость:** 16–24 ч (накопительно)

---

## Цель этапа

Зафиксировать поведение LonghuaCRM **до** рефакторинга (baseline contracts) и предотвратить регрессии при миграции schema, замене `EntityRepositoryService` и введении typed API. Покрыть критические бизнес-потоки: auth, migrations, mappers, payments, jobs/reminders, RBAC, Telegram (mock), cleanup gates.

**Текущее состояние:** в `apps/api` **нет** ни одного `*.spec.ts` / `*.e2e-spec.ts`; в `package.json` **нет** скриптов `test` / `test:e2e` (`apps/api/package.json:5-14`).

---

## Архитектура тестирования (целевая)

```
apps/api/
├── jest.config.js              # unit + integration preset
├── jest-e2e.json               # e2e supertest
├── src/
│   └── **/*.spec.ts            # colocated unit (mappers, services)
└── test/
    ├── setup.ts                # global test DB / mocks
    ├── migration.spec.ts       # schema up + data spot check
    ├── auth.e2e-spec.ts
    ├── entities-student.e2e-spec.ts  # legacy /entities (до этапа 8)
    ├── functions.e2e-spec.ts   # cron auth, telegram functions
    ├── webhooks.e2e-spec.ts    # telegram secret, alfabank checksum
    └── integration/
        ├── alfabank-webhook.spec.ts
        └── jobs-reminders.spec.ts
```

**Инструменты (рекомендация):**

| Инструмент | Назначение |
|------------|------------|
| Jest | runner |
| `@nestjs/testing` | `Test.createTestingModule` |
| `supertest` | HTTP e2e |
| `testcontainers` + PostgreSQL | integration migrations (опционально) |
| `jest.mock('node:fetch')` | Telegram, Alfa Bank API |

---

## Baseline: что тестировать ДО изменений

Создать **до начала этапа 1** — snapshot текущего ожидаемого поведения API contracts (даже если поведение «сломано» — фиксируем фактическое, затем меняем тест при исправлении).

### P0 — обязательно

| # | Тест | Файл | До этапа | Исходник поведения |
|---|------|------|----------|-------------------|
| 1 | Auth login returns token + user snake_case | `test/auth.e2e-spec.ts` | 4 | `auth.controller.ts:14-17`, `auth.service.ts:26-33`, `user.mapper.ts` |
| 2 | Auth register creates user role=pending | `test/auth.e2e-spec.ts` | 4 | `auth.service.ts:35-59` (role `'pending'`, строка 48) |
| 3 | Migration up on empty DB | `test/migration.spec.ts` | 1 | `data-source.ts`, migrations folder |
| 4 | Migration data jsonb → columns sample | `test/migration.spec.ts` | 1 | post-migration row shape |
| 5 | Student mapper round-trip | `src/common/mappers/student.mapper.spec.ts` | 2a | `lessonBalance` ↔ `lesson_balance` |
| 6 | Lesson mapper round-trip | `src/common/mappers/lesson.mapper.spec.ts` | 2a | `startTime` ↔ `start_time`, reminder flags |
| 7 | `matchesFilter` `$contains` | `src/common/utils/record.util.spec.ts` | 2a | `record.util.ts:27-37` |
| 8 | AlfaBank checksum validation | `alfabank.service.spec.ts` | 3 | `alfabank.service.ts:98-103` |

### P1 — важно

| # | Тест | До этапа | Исходник |
|---|------|----------|----------|
| 9 | Jobs `resolveStudentIds` (array vs single) | 3 | `jobs.service.ts:194-198` |
| 10 | PaymentsService `findByCommentContains` / `findByOrderNumber` | 3 | replaces broken `entity-repository filter $contains` |
| 11 | StudentsService `adjustLessonBalance` | 3 | replaces `alfabank.service.ts:123-124`, `Payments.jsx:46-48` |
| 12 | Settings `getTelegramBotToken` env priority | 6 | `settings.service.ts:13-17` |
| 13 | RBAC student cannot PATCH other student | 4 | `entities.controller.ts:86-95` → v2 |
| 14 | RBAC teacher cannot delete payment | 4 | security matrix |

### P2 — желательно

| # | Тест | До этапа |
|---|------|----------|
| 15 | MaterialAccess grant/revoke | 3 |
| 16 | `exportBackup` structure | 3 | `jobs.service.ts:149-179` |
| 17 | Welcome page public read | 4 | `entities.controller.ts:118-121`, `PUBLIC_READ_ENTITIES` |
| 18 | Shop items seed data shape | 2b |
| 19 | Telegram `sendMessage` mock | 6 |
| 20 | Webhook secret enforcement prod | 6 | `webhooks.controller.ts:31-34` |
| 21 | Cron functions admin-only | 6 | `functions.controller.ts:55, 105-110` |
| 22 | TeacherAvailability slots CRUD relational | 8 |
| 23 | Balance unification single source | 8 |

---

## Инфраструктура (создать)

### `apps/api/jest.config.js` (новый)

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/$1' },
};
```

### `apps/api/jest-e2e.json` (новый)

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

### `apps/api/package.json` — изменения

| Script | Значение |
|--------|----------|
| `"test"` | `jest` |
| `"test:watch"` | `jest --watch` |
| `"test:cov"` | `jest --coverage` |
| `"test:e2e"` | `jest --config jest-e2e.json` |

**devDependencies добавить:** `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `@nestjs/testing`.

---

## Unit tests: детальные спецификации

### `record.util.spec.ts`

**Источник:** `apps/api/src/common/utils/record.util.ts` (52 строки)

| Функция | Строки | Test cases |
|---------|--------|------------|
| `nowIso` | 1-3 | ISO string format |
| `recordFromEntity` | 5-18 | strips duplicate id, adds created_date/updated_date ISO |
| `splitRecordPayload` | 20-25 | separates id from payload |
| `matchesFilter` | 27-37 | equality; array includes; **`$contains` substring** |
| `sortRecords` | 40-51 | asc/desc with `-` prefix |

**Критично для этапа 3:** `matchesFilter` `$contains` сейчас **не используется** в `EntityRepositoryService.filter` (строки 132-136 entity-repository) — тест фиксирует утилиту; AlfaBank должен перейти на SQL LIKE в PaymentsService.

**Callers `recordFromEntity`:** только `user.mapper.ts:2` — при удалении `record.util.ts` (этап 8) оставить маппинг в `user.mapper` или перенести.

---

### `student.mapper.spec.ts` (создать на этапе 2a)

| Case | Input | Expected API record |
|------|-------|---------------------|
| toRecord | `lessonBalance: 5` | `lesson_balance: 5` |
| fromRecord | `lesson_balance: 3` | `lessonBalance: 3` |
| dates | Entity Date | `created_date` ISO snake_case |

---

### `lesson.mapper.spec.ts` (создать на этапе 2a)

| Case | Field |
|------|-------|
| toRecord | `startTime` → `start_time`, `reminder24hSent` → `reminder_24h_sent` |
| studentIds | `studentIds[]` → `student_ids` |
| resolveStudentIds parity | same logic as `jobs.service.ts:194-198` |

---

### `settings.service.spec.ts`

**Источник:** `settings.service.ts:12-18`

```typescript
// Case 1: TELEGRAM_BOT_TOKEN env set → return env, no DB call
// Case 2: env empty → AppSettingsRepository.findByKey('telegram_bot_token')
// Case 3: neither → null
```

Mock `AppSettingsRepository` / `EntityRepositoryService` до этапа 3.

---

### `alfabank.service.spec.ts`

**Источник:** `alfabank.service.ts`

| Method | Строки | Cases |
|--------|--------|-------|
| `handleWebhook` checksum | 98-103 | valid MD5 → continue; invalid → `'0'` |
| `handleWebhook` package | 118-130 | balance += lessons_added; mock TelegramService |
| `handleWebhook` course | 131-151 | Course created, TG sent |
| `init` | 17-83 | mock fetch register.do |

**Mock:** `global.fetch` для Alfa Bank API; never real `pay.alfabank.by`.

---

### `jobs.service.spec.ts`

**Источник:** `jobs.service.ts`

| Method | Строки | Cases |
|--------|--------|-------|
| `resolveStudentIds` | 194-198 | `student_ids[]` priority; fallback `student_id`; empty |
| `autoCompleteExpiredLessons` | 28-44 | planned lesson past end → completed |
| `sendLessonReminders24h` | 46-106 | tomorrow lesson, mock sendMessage, flag set |
| `sendLessonReminders2h` | 108-147 | window 110-125 min |
| `getTimezoneNow` | 201-207 | boundary midnight Europe/Minsk |

**Mock:** `TelegramService.sendMessage` → `{ ok: true }`.

---

### `telegram.service.spec.ts` (этап 6)

**Источник:** `telegram.service.ts`

| Method | Строки | Cases |
|--------|--------|-------|
| `sendMessage` | 14-26 | no token → `{ ok: false }`; success; **429 retry** |
| `handleUpdate` | 101-114 | `/start` → welcome; other text → noop |
| `registerWebhook` | 42-74 | calls deleteWebhook then setWebhook |

---

## Integration tests

### `migration.spec.ts`

**Предусловие:** test PostgreSQL (`DATABASE_URL` test) или testcontainers.

```typescript
// 1. dataSource.initialize()
// 2. migration:run all
// 3. Assert: students table has lesson_balance column, NOT data jsonb
// 4. Optional: seed jsonb legacy dump → migrate → spot check counts
// 5. Optional: migration:revert last
```

**Проверки post этап 1:**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'lesson_balance';
-- expect 1 row

SELECT column_name FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'data';
-- expect 0 rows
```

---

### `alfabank-webhook.spec.ts`

```
1. Seed: Payment with comment containing orderNumber
2. Seed: Student with lesson_balance=2
3. POST /api/webhooks/alfabank with valid checksum body
4. Assert: Payment comment updated, student.lesson_balance incremented
5. Assert: TelegramService.sendMessage called (mock)
```

---

### `jobs-reminders.spec.ts`

```
1. Seed: Lesson tomorrow, status planned, reminder_24h_sent=false
2. Seed: Student with telegram_id
3. Call jobsService.sendLessonReminders24h()
4. Assert: reminder_24h_sent=true, sendMessage called once
```

---

## E2E tests (supertest)

### `auth.e2e-spec.ts`

**Bootstrap:**

```typescript
const moduleFixture = await Test.createTestingModule({
  imports: [AppModule],
}).compile();
const app = moduleFixture.createNestApplication();
await app.init();
```

| Test | Request | Assert |
|------|---------|--------|
| login | `POST /api/auth/login` | 200, `token`, `user.email`, snake_case fields |
| register | `POST /api/auth/register` | 200, `user.role === 'pending'` |
| me | `GET /api/auth/me` + Bearer | 200, user shape |
| me unauthorized | `GET /api/auth/me` | 401 |

---

### `entities-student.e2e-spec.ts` (legacy, удалить на этапе 8)

| Test | До этапа | Assert |
|------|----------|--------|
| GET /api/entities/Student | 2a | `lesson_balance` in response |
| POST /api/entities/Lesson | 2a | `start_time` preserved |
| POST filter $contains | 2a | Payment comment search |

После этапа 4: дублировать на `/api/v2/students`.

---

### `functions.e2e-spec.ts`

**Источник:** `functions.controller.ts:41-69`

| Function | No auth | Student JWT | Admin JWT |
|----------|---------|-------------|-----------|
| `sendLessonReminders` | 403 (post fix) | 403 | 200 |
| `sendLessonReminders2h` | 403 | 403 | 200 |
| `autoCompleteExpiredLessons` | 403 | 403 | 200 |
| `checkBotInfo` | 403 | 403 | 200 |
| `tgDebug` | 200 (pre-fix) → 403 (post-fix) | — | — |
| `sendTelegramMessage` | 401 | 200 | 200 |

---

### `webhooks.e2e-spec.ts`

**Источник:** `webhooks.controller.ts:26-43`

| Test | Env | Header | Expected |
|------|-----|--------|----------|
| telegram valid secret | production | matching `x-telegram-bot-api-secret-token` | 200 |
| telegram invalid secret | production + secret set | wrong | 401 |
| telegram no secret configured | development | none | 200 |
| alfabank invalid checksum | any | — | body `'0'` |

---

## Тесты ПОСЛЕ каждого этапа

### После этапа 1 (database)

```bash
npm run migration:run --prefix apps/api
npm run test --prefix apps/api  # migration.spec
```

- [ ] No `data` column in business tables
- [ ] Row counts preserved vs pre-migration backup
- [ ] `teacher_availability` vs `teacher_availabilities` naming resolved

### После этапа 2a (mapper)

- [ ] GET `/api/entities/Student` returns `lesson_balance`
- [ ] POST `/api/entities/Lesson` creates with `start_time`
- [ ] Mapper unit tests green

### После этапа 2b

- [ ] Payment create with `lessons_added`
- [ ] ShopSettings list returns `item_id`
- [ ] WelcomePage save/load `body_text`

### После этапа 2c

- [ ] FK violation on invalid `teacher_id`
- [ ] Cascade policy documented in test comments

### После этапа 3 (services)

- [ ] AlfaBank webhook integration (mock bank)
- [ ] Jobs reminder count > 0 with fixture data
- [ ] `grep EntityRepositoryService` в alfabank/jobs/settings = 0

### После этапа 4 (API + RBAC)

- [ ] v2 students CRUD
- [ ] 403 matrix for roles (student/teacher/admin)
- [ ] `UpdateMe` cannot escalate role

### После этапа 5 (frontend)

- [ ] Manual smoke OR Playwright: login, schedule, payments
- [ ] TelegramSettings webhook register

### После этапа 6 (telegram)

- [ ] Webhook secret prod test
- [ ] Cron admin auth test
- [ ] Mock Telegram sendMessage in jobs test

### После этапа 8 (cleanup)

```bash
rg "json_record|JsonRecord|row\.data|data jsonb|base44\.entities" apps/api/src src
# expect 0 matches in src (docs excluded)

npm run build --prefix apps/api
npm run build
npm run test --prefix apps/api
npm run test:e2e --prefix apps/api
```

---

## Coverage targets

| Layer | Target | Приоритет файлов |
|-------|--------|------------------|
| Mappers | 90%+ | student, lesson, payment, user |
| Domain services | 80%+ | Students, Payments, Lessons, Settings |
| Controllers e2e | Core paths | auth, v2 CRUD, functions, webhooks |
| Migrations | up + data spot check | each new migration file |
| Telegram | mock only | telegram.service, jobs reminders |
| record.util | 100% | until deleted in stage 8 |

---

## CI recommendation

```yaml
# .github/workflows/api.yml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: longhua_test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run build --prefix apps/api
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/longhua_test
      - run: npm run migration:run --prefix apps/api
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/longhua_test
      - run: npm run test --prefix apps/api
      - run: npm run test:e2e --prefix apps/api
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/longhua_test
          JWT_SECRET: ci-test-secret
          NODE_ENV: test
```

---

## Что НЕ тестировать

| Область | Причина | Альтернатива |
|---------|---------|--------------|
| Telegram Bot API real calls | external, flaky | mock `fetch` |
| Alfa Bank real API | external, credentials | mock `register.do` |
| Frontend unit tests | unless requested | manual smoke / Playwright P2 |
| Base44 Deno functions | deleted stage 8 | NestJS parity tests |
| `import-json.ts` one-time script | removed stage 8 | migration tests only |
| Visual regression | out of scope | — |

---

## Таблица изменений (тестовая инфраструктура)

| Файл | Строки | Причина | Результат | Проверка |
|------|--------|---------|-----------|----------|
| `jest.config.js` | NEW | unit runner | `npm test` works | jest --version |
| `jest-e2e.json` | NEW | e2e runner | `npm run test:e2e` | auth e2e |
| `package.json` | 5-14 | scripts | test, test:e2e, test:cov | npm test |
| `test/setup.ts` | NEW | DB bootstrap | consistent env | migration spec |
| `test/auth.e2e-spec.ts` | NEW | baseline auth | 4 cases | CI green |
| `test/migration.spec.ts` | NEW | schema gate | stage 1 blocker | column asserts |
| `student.mapper.spec.ts` | NEW | contract | round-trip | stage 2a |
| `record.util.spec.ts` | NEW | $contains | 5 functions | stage 2a |
| `alfabank.service.spec.ts` | NEW | revenue path | checksum + webhook | stage 3 |
| `jobs.service.spec.ts` | NEW | reminders | resolveStudentIds | stage 3 |
| `telegram.service.spec.ts` | NEW | stage 6 | mock send | stage 6 |
| `functions.e2e-spec.ts` | NEW | cron auth | admin 403 | stage 6 |

---

## Проблемы покрываемые тестами

| # | Проблема | Источник | Тест |
|---|----------|----------|------|
| P1 | `$contains` не работает в EntityRepository | `entity-repository.service.ts:132-136` | payments.service + record.util |
| P2 | AlfaBank webhook не находит Payment | `alfabank.service.ts:105-107` | integration webhook |
| P3 | Cron functions публичны | `functions.controller.ts:55` | functions.e2e |
| P4 | Webhook secret optional | `webhooks.controller.ts:31-34` | webhooks.e2e prod |
| P5 | Privilege escalation role | `auth.service.ts:75-76` | auth e2e PATCH me |
| P6 | reminder flag before send | `jobs.service.ts:73` | jobs unit assert behavior |
| P7 | Dual balance update | `Payments.jsx:43-48` | students.service integration |
| P8 | row.data legacy path | `entity-repository.service.ts:104` | migration + mapper e2e |

---

## Checklist

- [ ] Jest + ts-jest + @nestjs/testing installed
- [ ] `npm test` и `npm run test:e2e` в package.json
- [ ] `migration.spec.ts` — stage 1 gate
- [ ] `auth.e2e-spec.ts` — baseline
- [ ] `record.util.spec.ts` — $contains
- [ ] Mapper specs (student, lesson) — stage 2a
- [ ] `alfabank.service.spec.ts` — checksum
- [ ] `jobs.service.spec.ts` — resolveStudentIds + reminders
- [ ] `functions.e2e-spec.ts` — cron auth (post stage 6)
- [ ] `webhooks.e2e-spec.ts` — telegram secret (post stage 6)
- [ ] CI workflow with PostgreSQL service
- [ ] Coverage report on mappers ≥ 90%

---

## Definition of Done (этап 7)

1. Baseline tests созданы **до** этапа 1 (или в первые дни этапа 1)
2. Каждый этап roadmap имеет явный «gate» test list (см. выше)
3. `npm run test` и `npm run test:e2e` проходят в CI
4. Критические пути покрыты: auth, migration, payment webhook, balance, reminders
5. Нет real external API calls в CI
6. После этапа 8: grep legacy patterns = 0 + full test suite green

---

## Зависимости

| Этап | Тесты блокируют |
|------|-----------------|
| 1 | migration.spec MUST pass before 2a |
| 2a | mapper specs before 3 |
| 3 | service specs before 4 refactor |
| 4 | e2e RBAC before 5 frontend cutover |
| 6 | telegram/webhook e2e |
| 8 | final grep + delete legacy e2e |

---

## Запрещено

- Пропускать `npm run build` после добавления тестов с импортом AppModule
- Коммитить `.env` с реальными `TELEGRAM_BOT_TOKEN` / `ALFA_BANK_TOKEN` в CI
- Использовать production DATABASE_URL в тестах
- Удалять baseline tests без замены на v2 contract tests
- Тестировать через реальный Telegram в CI

---

## Порядок внедрения

1. Jest infra + `auth.e2e-spec.ts` (минимальный AppModule boot)  
2. `migration.spec.ts` — **блокер этапа 1**  
3. `record.util.spec.ts` + mapper specs — блокер 2a  
4. `alfabank.service.spec.ts` + `jobs.service.spec.ts` — блокер 3  
5. RBAC e2e — блокер 4  
6. `telegram.service.spec.ts` + `functions.e2e` + `webhooks.e2e` — этап 6  
7. Slots + balance integration tests — этап 8  
8. CI workflow  
9. Playwright smoke (optional P2)

---

*Документ основан на исходниках; номера строк актуальны для `apps/api/src/` и `apps/api/package.json`.*
