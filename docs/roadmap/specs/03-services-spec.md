# Спецификация этапа 3: Typed Domain Services

**Roadmap:** [03-services.md](../03-services.md)  
**Предшественник:** [02-domain-spec.md](./02-domain-spec.md) (этап 2 — Entity/Mapper)  
**Следующий:** [04-api-spec.md](./04-api-spec.md)  
**Аудит:** [docs/audit/services.md](../../audit/services.md), [entities.md](../../audit/entities.md)  
**Трудоёмкость:** 32–48 ч

---

## Цель этапа

Заменить прямую зависимость бизнес-сервисов от `EntityRepositoryService` (God Object, 218 строк) на typed domain services с TypeORM-репозиториями по aggregate. Сохранить **всю существующую бизнес-логику**; не вводить `json_record` / JSON-хранилище для стабильных сущностей.

---

## Архитектура (текущее состояние)

```
AppModule (app.module.ts:54-61)
├── SettingsModule ──► SettingsService ──► EntityRepositoryService.filter('AppSettings')
├── AlfaBankModule ──► AlfaBankService ──► EntityRepositoryService + SettingsService + TelegramService
├── JobsModule ──────► JobsService ──────► EntityRepositoryService + TelegramService + ConfigService
├── AuthModule ──────► AuthService ──────► UsersRepository (typed ✓)
└── UsersModule ─────► UsersRepository ──► UserEntity (TypeORM ✓)

EntityRepositoryService (entity-repository.service.ts)
├── list/filter/create/update — CRM entities через row.data (jsonb legacy path, строки 102-107, 168-175)
├── filter — in-memory equality only (строки 132-136), НЕ поддерживает $contains
└── callers: EntitiesController, SettingsService, AlfaBankService, JobsService
```

### Целевая архитектура (после этапа 3)

```
AlfaBankService
  ├── PaymentsService
  ├── ShopItemsService
  ├── StudentsService
  ├── CoursesService
  └── SettingsService (typed AppSettingsRepository)

JobsService
  ├── LessonsService
  ├── StudentsService
  ├── TeachersService
  ├── MaterialAccessService
  └── TelegramService

SettingsService
  └── AppSettingsRepository (TypeORM, key-value)
```

---

## Классы (текущий код)

### `SettingsService`

| Свойство | Тип | Строка |
|----------|-----|--------|
| `entityRepository` | `EntityRepositoryService` | 8 |
| `config` | `ConfigService` | 9 |

**Файл:** `apps/api/src/modules/settings/settings.service.ts` (26 строк)  
**Модуль:** `settings.module.ts:6-9` — imports `EntitiesModule`, exports `SettingsService`

### `AlfaBankService`

| Свойство | Тип | Строка |
|----------|-----|--------|
| `entityRepository` | `EntityRepositoryService` | 11 |
| `settingsService` | `SettingsService` | 12 |
| `telegramService` | `TelegramService` | 13 |
| `config` | `ConfigService` | 14 |

**Файл:** `apps/api/src/modules/alfabank/alfabank.service.ts` (185 строк)  
**Модуль:** `alfabank.module.ts:7-11` — imports Entities, Settings, Telegram

### `JobsService`

| Свойство | Тип | Строка |
|----------|-----|--------|
| `entityRepository` | `EntityRepositoryService` | 11 |
| `telegramService` | `TelegramService` | 12 |
| `config` | `ConfigService` | 13 |

**Файл:** `apps/api/src/modules/jobs/jobs.service.ts` (208 строк)  
**Модуль:** `jobs.module.ts:6-10`

### `AuthService`

| Свойство | Тип | Строка |
|----------|-----|--------|
| `usersRepository` | `UsersRepository` | 21 |
| `jwtService` | `JwtService` | 22 |
| `config` | `ConfigService` | 23 |

**Файл:** `apps/api/src/modules/auth/auth.service.ts` (91 строк)  
**Интерфейс:** `JwtPayload` — строки 12-16 (`sub`, `email`, `role`)

### `UsersRepository`

| Метод | Строки | Описание |
|-------|--------|----------|
| `onModuleInit` | 19-21 | seed default admin |
| `findAll` | 23-25 | все UserEntity |
| `findByEmail` | 27-29 | unique index email |
| `findById` | 31-33 | by UUID |
| `save` | 35-37 | upsert |
| `delete` | 39-41 | hard delete |
| `seedDefaultAdmin` (private) | 43-68 | ADMIN_EMAIL/PASSWORD из config |

**Файл:** `apps/api/src/modules/users/users.repository.ts` (69 строк)

### `userToRecord` / `recordToUser`

**Файл:** `apps/api/src/modules/users/user.mapper.ts` (23 строки)  
Маппинг camelCase Entity → snake_case API record (`first_name`, `created_date`, `full_name`).

---

## Методы (детальный разбор)

### SettingsService

#### `getTelegramBotToken(): Promise<string | null>` — строки 12-18

1. `config.get('telegram.botToken')` — env `TELEGRAM_BOT_TOKEN` (`configuration.ts:19`)
2. Fallback: `entityRepository.filter('AppSettings', { key: 'telegram_bot_token' })` — строка 16
3. Return `settings[0]?.value` или null

**Caller:** `TelegramService.getBotToken()` (`telegram.service.ts:10-12`)

#### `getAlfaCredentials(): Promise<{ token?, merchantId? }>` — строки 20-25

1. Token: env `ALFA_BANK_TOKEN` (`configuration.ts:25`) ИЛИ AppSettings `alfa_bank_token` — строки 21-22
2. MerchantId: **только env** `ALFA_BANK_MERCHANT_ID` — строка 23 (не из БД)

**Callers:** `AlfaBankService.init` (25), `handleWebhook` (87), `checkPaymentStatus` (157)

---

### AlfaBankService

#### `init(params)` — строки 17-83

**Входные параметры:**

| Поле | Тип | Источник (caller) |
|------|-----|-------------------|
| `type` | string | `'package'` \| `'course'` — `functions.controller.ts:88`, `TopUpModal.jsx:47` |
| `itemId` | string | ShopSettings.item_id |
| `studentId` | string | Student.id |
| `amount` | number | ShopSettings.price |
| `returnUrl` | string? | frontend URL |
| `origin` | string? | `req.protocol://host` — `functions.controller.ts:80,93` |

**Алгоритм:**

1. **Строки 25-28:** credentials check → `Error('Alfa Bank credentials not configured')`
2. **Строки 30-32:** `filter('ShopSettings', { item_id })` → `lessonsAdded`
3. **Строка 33:** `orderNumber = ALF-${Date.now()}`
4. **Строки 35-43:** `create('Payment', {...})` — поля snake_case в input:
   - `student_id`, `amount`, `lessons_added`, `package_type`, `payment_date`, `comment`, `order_number`
5. **Строки 45-56:** payload для Alfa Bank API (`register.do`):
   - `amount * 100` (копейки), `returnUrl`, `expirationDate` +24h, `language: 'RU'`
6. **Строки 58-66:** POST `application/x-www-form-urlencoded`
7. **Строки 68-71:** errorCode !== 0 → throw
8. **Строки 73-75:** update Payment comment с `orderId`
9. **Строки 77-82:** return `{ ok, orderId, redirectUrl: formUrl, paymentId }`

#### `handleWebhook(bodyText: string): Promise<string>` — строки 85-154

**Caller:** `WebhooksController.alfaBankWebhook` (`webhooks.controller.ts:45-58`)

**Алгоритм:**

1. Parse URLSearchParams — строка 86
2. Credentials — строки 87-88; no token → `'0'`
3. Validate `orderId`, `orderNumber`, `status === '1'` — строка 96
4. **Строки 98-103:** MD5 checksum: `${orderId};${amount};810;${alfaToken}`
5. **Строки 105-108:** `filter('Payment', { comment: { $contains: orderNumber } })` — **СЛОМАНО**: EntityRepository filter не поддерживает `$contains` (entity-repository.service.ts:132-136)
6. **Строки 114-116:** update comment «Оплачено через Alfa Bank»
7. **type === 'package'** (строки 118-130):
   - filter Student, `lesson_balance += lessons_added`
   - Telegram notify student
8. **type === 'course'** (строки 131-151):
   - create Course: `course_type` из comment includes 'basic' → `'basic_beginner'` else `'advanced'`
   - `total_lessons: 35`, `status: 'active'`
   - Telegram notify
9. Return `'1'` (plain text, Alfa Bank protocol)

#### `checkPaymentStatus(orderId: string)` — строки 156-184

POST `getOrderStatusExtended.do` → map status labels, `isPaid` for status `'1'` or `'5'`, amount /100.

**Caller:** `FunctionsController` case `checkPaymentStatus` — строка 104

---

### JobsService

#### Cron: `run24hReminders` — строки 16-20

- `@Cron('0 12 * * *')` — ежедневно 12:00 UTC (не MSK!)
- Guard: `jobs.enabled` (`ENABLE_CRON !== 'false'`, `configuration.ts:30`)
- Delegates: `sendLessonReminders24h()`

#### Cron: `runMinuteJobs` — строки 22-26

- `@Cron('* * * * *')` — каждую минуту
- Parallel: `sendLessonReminders2h()` + `autoCompleteExpiredLessons()`

#### `autoCompleteExpiredLessons()` — строки 28-44

1. filter Lesson `status: 'planned'`, slice 1000 — строка 29
2. Parse `date` + `start_time` + `duration` (default 60) — строки 34-36
3. If `endTime < now` → update status `'completed'` — строки 37-39
4. Return `{ success, message, count }`

**Проблема:** поля `lesson.date`, `lesson.start_time` — snake_case в record; после этапа 2 Entity должны быть typed columns.

**Manual trigger:** `FunctionsController` case `autoCompleteExpiredLessons` — строка 106 (**без auth!**)

#### `sendLessonReminders24h()` — строки 46-106

1. Bot token check — строки 47-48
2. `getTimezoneNow()` — MSK/Europe/Minsk — строки 50-53
3. filter lessons tomorrow `date`, `status: 'planned'` — строки 55-58
4. Filter `!reminder_24h_sent` — строка 59
5. Load all Student + Teacher → maps — строки 65-68
6. **Строка 73:** mark `reminder_24h_sent: true` **до отправки** (at-most-once, потеря при crash)
7. `resolveStudentIds` — student_ids[] или student_id — строки 76, 194-198
8. Messages to students (balance, meeting_link) — строки 83-92
9. Message to teacher — строки 94-102

#### `sendLessonReminders2h()` — строки 108-147

- Window: diffMin 110–125 от `getTimezoneNow()` — строки 115-122
- Mark `reminder_2h_sent: true` — строка 132
- Shorter message to students only (no teacher) — строки 138-143

#### `exportBackup()` — строки 149-179

- Entities: `ENTITY_NAMES + 'User'` — строка 150
- list each with limit 1000 — строка 156
- JSON → base64 — строки 170-171
- **Caller:** `FunctionsController` admin `exportBackup` — строка 96; frontend `Settings.jsx:18`

#### `revokeAllAccess()` — строки 181-192

- list MaterialAccess, delete where `granted_by_role !== 'ADMIN'` — строки 182-186
- Uses `deleteRecordById` — entity-repository.service.ts:205-211 (scan all tables by id)

#### `resolveStudentIds(lesson)` (private) — строки 194-198

#### `getTimezoneNow()` (private) — строки 201-207

Offset через `toLocaleString('en-US', { timeZone })` — эвристика, не `Intl`/`luxon`.

---

### AuthService

#### `login(dto: LoginDto)` — строки 26-33

- Email normalize: trim + lowercase — строка 27
- bcrypt.compareSync — строка 28
- Return `{ token: signToken(user), user: userToRecord(row) }`

#### `register(dto: RegisterDto)` — строки 35-59

- role: `'pending'` — строка 48
- bcrypt.hashSync rounds 10 — строка 47
- Auto-login with token

#### `getMe(userId)` — строки 61-65

#### `updateMe(userId, dto)` — строки 67-80

- **Уязвимость:** `dto.role` применяется без проверки — строки 75-76
- Partial update first_name, last_name, phone, telegram_id

#### `signToken(user)` — строки 82-89

Payload: sub, email, role. Secret from JwtModule (`auth.module.ts:16-17`).

---

## DTO (связанные с сервисным слоем)

| DTO | Файл | Поля | Использование в сервисах |
|-----|------|------|--------------------------|
| `LoginDto` | `auth/dto/login.dto.ts:3-10` | email, password | AuthService.login |
| `RegisterDto` | `auth/dto/login.dto.ts:12-27` (re-export register.dto.ts:1) | email, password, first_name?, last_name? | AuthService.register |
| `UpdateMeDto` | `auth/dto/update-me.dto.ts:3-23` | first_name?, last_name?, phone?, telegram_id?, **role?** | AuthService.updateMe |

**Новые DTO этапа 3** (создать):

| Сервис | DTO | Назначение |
|--------|-----|------------|
| StudentsService | `AdjustBalanceDto`, `CreateStudentDto` | balance ops |
| PaymentsService | `CreatePaymentDto`, `MarkPaidDto` | AlfaBank + manual |
| LessonsService | `UpdateLessonStatusDto`, `ReminderFlagsDto` | jobs |
| ShopItemsService | — (read-only для AlfaBank) | findByItemId |

---

## Entity (задействованные aggregates)

| API name | Entity class | Таблица | Использование в сервисах |
|----------|--------------|---------|--------------------------|
| User | UserEntity | users | AuthService, JobsService.exportBackup |
| Student | StudentEntity | students | AlfaBank webhook, Jobs reminders |
| Teacher | TeacherEntity | teachers | Jobs reminders |
| Lesson | LessonEntity | lessons | Jobs auto-complete, reminders |
| Payment | PaymentEntity | payments | AlfaBank init/webhook |
| Course | CourseEntity | courses | AlfaBank course payment |
| ShopSettings | ShopSettingEntity | shop_settings | AlfaBank init (lessons count) |
| AppSettings | AppSettingEntity | app_settings | SettingsService credentials |
| MaterialAccess | MaterialAccessEntity | material_access | Jobs revokeAllAccess |

**UserEntity** (`user.entity.ts:4-35`): typed columns — эталон для миграции CRM entities.

**AlfaBankOrderEntity:** существует в ENTITY_CLASS_MAP (`entity-repository.service.ts:41`) но **не используется** AlfaBankService.

---

## Зависимости (DI graph)

```
SettingsService
  └── EntityRepositoryService (заменить → AppSettingsRepository)

AlfaBankService
  ├── EntityRepositoryService (заменить → Payments, Shop, Students, Courses)
  ├── SettingsService
  ├── TelegramService
  └── ConfigService (alfaBank.apiUrl)

JobsService
  ├── EntityRepositoryService (заменить → Lessons, Students, Teachers, MaterialAccess)
  ├── TelegramService
  └── ConfigService (jobs.enabled, jobs.reminderTimezone)

AuthService
  ├── UsersRepository ✓
  ├── JwtService
  └── ConfigService

TelegramService
  └── SettingsService (циклической зависимости нет)
```

**Конфигурация** (`configuration.ts`):

| Key | Env | Строка | Consumer |
|-----|-----|--------|----------|
| `telegram.botToken` | TELEGRAM_BOT_TOKEN | 19 | SettingsService |
| `alfaBank.token` | ALFA_BANK_TOKEN | 25 | SettingsService |
| `alfaBank.merchantId` | ALFA_BANK_MERCHANT_ID | 26 | SettingsService |
| `alfaBank.apiUrl` | ALFA_BANK_API_URL | 27 | AlfaBankService |
| `jobs.enabled` | ENABLE_CRON | 30 | JobsService |
| `jobs.reminderTimezone` | REMINDER_TIMEZONE | 31 | JobsService |
| `admin.email/password` | ADMIN_EMAIL/PASSWORD | 15-16 | UsersRepository seed |

---

## Callers (кто вызывает сервисы)

| Caller | Файл:строка | Callee | Метод |
|--------|-------------|--------|-------|
| AuthController | auth.controller.ts:16,21,27,33 | AuthService | login, register, getMe, updateMe |
| FunctionsController | functions.controller.ts:87,104,96,106-112 | AlfaBankService, JobsService | init, checkPaymentStatus, exportBackup, jobs |
| WebhooksController | webhooks.controller.ts:53 | AlfaBankService | handleWebhook |
| TelegramService | telegram.service.ts:11 | SettingsService | getTelegramBotToken |
| AlfaBankService | alfabank.service.ts:25,87,157 | SettingsService | getAlfaCredentials |
| JobsService | jobs.service.ts:47,109 | TelegramService | getBotToken, sendMessage |
| Cron scheduler | jobs.service.ts:16-26 | JobsService | run24hReminders, runMinuteJobs |
| Frontend (via functions) | TopUpModal.jsx:46 | alfaBankInit → AlfaBankService.init | |
| Frontend | Settings.jsx:18 | exportBackup → JobsService | |

---

## Callees (от кого зависят сервисы)

| Service | Callee | Операции |
|---------|--------|----------|
| SettingsService | EntityRepositoryService.filter | AppSettings by key |
| AlfaBankService | EntityRepositoryService | filter/create/update Payment, ShopSettings, Student, Course |
| AlfaBankService | fetch (Alfa Bank API) | register.do, getOrderStatusExtended.do |
| AlfaBankService | TelegramService.sendMessage | payment/course notifications |
| JobsService | EntityRepositoryService | filter/list/update Lesson, Student, Teacher, MaterialAccess; list all for backup |
| JobsService | TelegramService | sendMessage reminders |
| AuthService | UsersRepository | findByEmail, findById, save |
| AuthService | bcrypt, JwtService | hash, sign |

---

## Data flow

### Поток 1: Инициализация оплаты Alfa Bank

```
TopUpModal.jsx:46
  → POST /api/functions/alfaBankInit (JWT required, functions.controller.ts:65-68)
    → AlfaBankService.init:25-83
      → SettingsService.getAlfaCredentials:20-25
      → EntityRepositoryService.filter ShopSettings:30-32
      → EntityRepositoryService.create Payment:35-43
      → fetch alfaBank.apiUrl/register.do:58-66
      → EntityRepositoryService.update Payment:73-75
    ← { redirectUrl, orderId, paymentId }
  → window.location.href = redirectUrl (TopUpModal.jsx:56)
```

### Поток 2: Webhook оплаты (package)

```
Alfa Bank POST /api/webhooks/alfabank (webhooks.controller.ts:45-58)
  → AlfaBankService.handleWebhook:85-154
    → MD5 checksum verify:98-103
    → filter Payment by comment $contains:105-108 ⚠️ BROKEN
    → update Payment:114-116
    → filter Student, update lesson_balance:118-124
    → TelegramService.sendMessage:127-128
  ← '1' | '0'
```

### Поток 3: Cron напоминание 24h

```
@Cron 12:00 UTC (jobs.service.ts:16-20)
  → sendLessonReminders24h:46-106
    → getTimezoneNow (Europe/Minsk):50-53
    → filter Lesson date=tomorrow:55-58
    → list Student, Teacher:65-66
    → update reminder_24h_sent:73
    → TelegramService.sendMessage per student/teacher:90-101
```

### Поток 4: Ручной платёж + баланс (frontend, до typed service)

```
Payments.jsx:43-48 (не сервис — UI logic)
  → entities Payment.create + Student.update lesson_balance
```

**Цель этапа 3:** перенести balance adjustment в `StudentsService.adjustLessonBalance` + `PaymentsService.create`, вызываемые из UI через этап 4 API.

### Поток 5: Auth login

```
POST /api/auth/login (auth.controller.ts:14-17)
  → AuthService.login:26-33
    → UsersRepository.findByEmail:27
    → userToRecord + signToken:31-32
```

---

## Проблемы (с номерами строк)

| # | Файл | Строки | Проблема | Severity |
|---|------|--------|----------|----------|
| P1 | entity-repository.service.ts | 132-136 | `filter` — только equality; `$contains` в AlfaBank не работает | **Critical** |
| P2 | alfabank.service.ts | 105-107 | Зависит от `$contains` для match Payment by orderNumber | **Critical** |
| P3 | entity-repository.service.ts | 102-107, 168-175 | CRM data через `row.data` jsonb merge | High |
| P4 | alfabank.service.ts | 35-43 | Payment fields snake_case в generic create; после typed Entity — column mapping | High |
| P5 | alfabank.service.ts | 138 | course_type из `payment.comment.includes('basic')` — хрупкая эвристика | Medium |
| P6 | alfabank.service.ts | 140 | `total_lessons: 35` hardcoded; ShopSettings.lessons игнорируется для course | Medium |
| P7 | jobs.service.ts | 16 | Cron 12:00 UTC vs reminderTimezone Europe/Minsk — рассинхрон | Medium |
| P8 | jobs.service.ts | 73, 132 | reminder flag set before send — потеря напоминания при ошибке Telegram | Medium |
| P9 | jobs.service.ts | 29 | slice(0,1000) без pagination — пропуск уроков при >1000 planned | Medium |
| P10 | jobs.service.ts | 201-207 | getTimezoneNow — неточная TZ arithmetic | Low |
| P11 | settings.service.ts | 16-17 | AppSettings через broken EntityRepository | High |
| P12 | settings.service.ts | 23 | merchantId только из env, не из AppSettings | Low |
| P13 | auth.service.ts | 75-76 | updateMe позволяет смену role любому user | **Critical** (fix в этапе 4, но затрагивает сервис) |
| P14 | auth/dto/update-me.dto.ts | 20-22 | role в DTO без guard | **Critical** |
| P15 | user.mapper.ts | 5-6 | fullName = lastName + firstName (русский порядок) | OK by design |
| P16 | alfabank.service.ts | — | AlfaBankOrderEntity не используется | Medium |
| P17 | jobs.service.ts | 183-186 | revokeAllAccess: granted_by_role `'ADMIN'` vs frontend `'ADMIN'`/`'TEACHER'` — case must match | Medium |

---

## Legacy

| Компонент | Статус | Действие этапа 3 |
|-----------|--------|------------------|
| EntityRepositoryService | Legacy God Object | **Не удалять** — ещё нужен EntitiesController |
| row.data jsonb path | Legacy storage | Новые services → typed columns (post этап 2) |
| snake_case в service inputs | Base44 compat | Services return API records via mapper |
| AlfaBankOrder entity unused | Dead schema | Опционально: AlfaBankOrdersService в init |
| deleteRecordById scan | Legacy hack | MaterialAccessService.deleteById typed |

---

## Delete / Replace

| Удалить (после миграции) | Заменить на | Когда |
|--------------------------|-------------|-------|
| EntityRepository import в AlfaBankService | PaymentsService, etc. | Этап 3 |
| EntityRepository import в JobsService | LessonsService, etc. | Этап 3 |
| EntityRepository import в SettingsService | AppSettingsRepository | Этап 3 |
| In-memory filter $contains usage | PaymentsService.findByOrderNumber | Этап 3 |
| Frontend balance logic Payments.jsx:31-48 | PaymentsService.create with balance tx | Этап 3+4 |

**Запрещено на этапе 3:** удаление `EntityRepositoryService`, `EntitiesModule`.

---

## Риски

| Риск | Вероятность | Impact | Митигация |
|------|-------------|--------|-----------|
| Regression AlfaBank webhook | High | Revenue | Integration test init+webhook; fix $contains first |
| Duplicate balance adjustment (UI + webhook) | Medium | Data | Idempotent payment marking |
| Cron + manual function double-run | Medium | Duplicate TG msgs | reminder flags (already exist) |
| Transaction boundaries missing | High | Inconsistent balance | TypeORM transaction в PaymentsService |
| Mapper field drift post этап 2 | Medium | Silent bugs | Contract tests snake_case API |

---

## Tests

### Unit (создать)

| Test file | Covers | Cases |
|-----------|--------|-------|
| `settings.service.spec.ts` | getTelegramBotToken, getAlfaCredentials | env priority, DB fallback |
| `students.service.spec.ts` | adjustLessonBalance | +N, -N, floor at 0 |
| `payments.service.spec.ts` | findByOrderNumber, markPaid | order number in comment |
| `lessons.service.spec.ts` | filterTomorrowPlanned, resolveStudentIds | multi student_ids |
| `alfabank.service.spec.ts` | handleWebhook checksum | valid/invalid MD5 |
| `jobs.service.spec.ts` | autoCompleteExpiredLessons | past end time |

### Integration

| Scenario | Steps |
|----------|-------|
| AlfaBank init | mock fetch register.do → Payment row exists |
| Webhook package | POST body → balance incremented |
| Reminder 24h | seed lesson tomorrow → sent flag true |

### Manual verification

```bash
npm run build
# Trigger: POST /api/functions/sendLessonReminders (needs auth fix in stage 4)
# Settings: getTelegramBotToken returns value
```

---

## Таблица изменений

| Файл | Строки | Причина | Результат | Побочные эффекты | Проверка |
|------|--------|---------|-----------|------------------|----------|
| `modules/students/students.repository.ts` | NEW | Изоляция data access | TypeORM wrapper | — | unit mock |
| `modules/students/students.service.ts` | NEW | Balance logic centralized | adjustLessonBalance, findByUserId | Payments.jsx может вызывать v2 | unit + integration |
| `modules/students/students.module.ts` | NEW | Nest DI | export StudentsService | app.module import | build |
| `modules/lessons/lessons.service.ts` | NEW | Jobs dependency | filterByDate, updateStatus, markReminderSent | Cron behavior unchanged | filter tomorrow test |
| `modules/payments/payments.service.ts` | NEW | AlfaBank flow | create, findByOrderNumber, markPaid | Fixes $contains | webhook test |
| `modules/shop/shop-items.service.ts` | NEW | AlfaBank init | findByItemId | — | item_id lookup |
| `modules/courses/courses.service.ts` | NEW | Course activation | createFromPayment | course_type logic preserved | integration |
| `modules/materials/material-access.service.ts` | NEW | revokeAllAccess | revokeAllNonAdmin | BulkAccess compat | count deleted |
| `modules/settings/app-settings.repository.ts` | NEW | Typed settings | findByKey | — | token lookup |
| `alfabank/alfabank.service.ts` | 11, 30-43, 105-124 | Remove EntityRepository | Inject typed services | Entire payment flow | init+webhook E2E |
| `jobs/jobs.service.ts` | 11, 29-186 | Remove EntityRepository | Inject Lessons/Students/Teachers/MaterialAccess | Cron unchanged | manual cron trigger |
| `settings/settings.service.ts` | 8, 16-17 | Remove EntityRepository | AppSettingsRepository | Telegram token | getTelegramBotToken |
| `app.module.ts` | 54-61 | Register new modules | DI graph complete | bootstrap time | npm run build |

---

## Checklist

- [ ] `StudentsService` + repository с `adjustLessonBalance`
- [ ] `LessonsService` с `resolveStudentIds`, reminder flags
- [ ] `PaymentsService` с `findByOrderNumber` (SQL LIKE, не $contains)
- [ ] `ShopItemsService.findByItemId`
- [ ] `CoursesService.createFromPayment` (логика alfabank.service.ts:131-144)
- [ ] `MaterialAccessService.revokeAllNonAdmin`
- [ ] `AppSettingsRepository` + refactor SettingsService
- [ ] AlfaBankService без import EntityRepositoryService
- [ ] JobsService без import EntityRepositoryService
- [ ] Unit tests: Students, Lessons, Payments (minimum)
- [ ] `npm run build` OK

---

## Definition of Done

1. Grep `EntityRepositoryService` в `alfabank/`, `jobs/`, `settings/` = **0 imports**
2. AlfaBank webhook находит Payment по orderNumber через typed query
3. Cron jobs работают с typed Lesson/Student entities (post этап 2 columns)
4. Все новые services покрыты unit tests для critical paths
5. `npm run build` без ошибок
6. Существующая бизнес-логика сохранена (balance, reminders, backup format)

---

## Зависимости этапа

| Требуется до начала | Блокирует |
|---------------------|-----------|
| Этап 2: typed Entity columns + mapper | Все CRM repositories |
| PaymentEntity typed fields | PaymentsService |
| LessonEntity reminder_24h_sent, reminder_2h_sent columns | LessonsService |
| MaterialAccessEntity granted_by_role, access | MaterialAccessService |

---

## Параллельная работа

| Track A | Track B | Условие |
|---------|---------|---------|
| StudentsService + PaymentsService | LessonsService + TeachersService | После этапа 2a |
| ShopItemsService + CoursesService | MaterialAccessService + AppSettingsRepository | Независимо |
| Refactor AlfaBankService | Refactor JobsService | **После** всех domain services готовы |

---

## Запрещено

- Удалять `EntityRepositoryService` / `EntitiesModule` (нужны для `/api/entities/*` до этапа 5)
- Вводить JSON storage / `json_record` для business entities
- Менять контракт webhook Alfa Bank (ответ `'0'`/`'1'`, checksum algorithm)
- Менять формат exportBackup base64 JSON без миграционного плана
- Пропускать `npm run build` после significant refactor

---

## Порядок реализации

1. AppSettingsRepository → SettingsService refactor  
2. StudentsService + PaymentsService (+ transactions)  
3. ShopItemsService, CoursesService  
4. LessonsService, TeachersService, MaterialAccessService  
5. Refactor AlfaBankService (integration test)  
6. Refactor JobsService  
7. app.module.ts imports  
8. Full build + test suite  

---

*Документ основан на исходниках по состоянию репозитория; номера строк актуальны для файлов в `apps/api/src/modules/`.*
