> **HISTORICAL / COMPLETED (JSONB migration finished).**
> This file describes an earlier plan/audit that mentioned `data jsonb`, `slots jsonb`, or legacy JSON storage.
> **Current architecture:** relational CRM entities; TeacherAvailability via `teacher_availability_slots`; Assessment via snapshot tables; **no JSONB for business entities**.
> See [../../Database.md](../../Database.md) and [../../architecture/storage-policy.md](../../architecture/storage-policy.md).

# Спецификация этапа 6: Telegram Module

**Roadmap:** [06-telegram.md](../06-telegram.md)  
**Предшественник:** [03-services-spec.md](./03-services-spec.md) (Jobs на typed services), [04-api-spec.md](./04-api-spec.md) (cron auth — частично)  
**Следующий:** [08-final-cleanup-spec.md](./08-final-cleanup-spec.md) (balance в тексте уведомлений)  
**Аудит:** [docs/audit/telegram.md](../../audit/telegram.md), [security.md](../../audit/security.md)  
**Трудоёмкость:** 8–12 ч

---

## Цель этапа

Стабилизировать Telegram-интеграцию после миграции data layer (этапы 1–3): надёжное получение bot token, hardening webhooks, защита cron-триггеров, корректные reminders и payment notifications через typed services. Сохранить **всю существующую бизнес-логику** сообщений; не вводить `json_record` / JSON-хранилище.

---

## Архитектура (текущее состояние)

```
AppModule (app.module.ts:58-62)
├── TelegramModule
│   ├── TelegramService (telegram.service.ts:115 строк)
│   └── TelegramWebhookLifecycleService (telegram-webhook.lifecycle.ts:82 строки)
├── WebhooksModule (webhooks.module.ts:10)
│   └── WebhooksController — POST /api/webhooks/telegram (строки 26-43)
├── FunctionsModule (functions.module.ts:7-10)
│   └── FunctionsController — POST /api/functions/:name (строки 33-119)
├── JobsModule (jobs.module.ts:6-10)
│   └── JobsService — cron + reminders (строки 16-207)
├── SettingsModule
│   └── SettingsService.getTelegramBotToken (settings.service.ts:12-18)
└── AlfaBankModule
    └── AlfaBankService — payment TG notify (alfabank.service.ts:126-128, 146-148)

Legacy Base44 (не runtime, справочник):
base44/functions/telegramWebhook/entry.ts
base44/functions/registerTelegramWebhook/entry.ts
base44/functions/telegramPoller/entry.ts
base44/functions/sendTelegramMessage/entry.ts
base44/functions/clearTelegramUpdates/entry.ts
base44/functions/fixWebhook/entry.ts
base44/functions/checkBotInfo/entry.ts
base44/functions/tgDebug/entry.ts
```

### Целевая архитектура (после этапа 6)

```
TelegramService
  └── SettingsService → AppSettingsRepository (typed, post этап 3)

JobsService (post этап 3)
  ├── LessonsService.resolveStudentIds
  ├── StudentsService / TeachersService (telegramId, lessonBalance)
  └── TelegramService.sendMessage (с retry на 429)

WebhooksController
  └── mandatory TELEGRAM_WEBHOOK_SECRET в production

FunctionsController
  ├── admin: sendLessonReminders*, autoCompleteExpiredLessons, registerTelegramWebhook
  └── auth: sendTelegramMessage, fixWebhook, clearTelegramUpdates

TelegramWebhookLifecycleService
  └── fail loud в prod если TELEGRAM_ENABLED && нет webhook URL
```

---

## Конфигурация

**Файл:** `apps/api/src/config/configuration.ts`

| Key | Env | Строка | Consumer |
|-----|-----|--------|----------|
| `telegram.botToken` | `TELEGRAM_BOT_TOKEN` | 19 | SettingsService → TelegramService |
| `telegram.webhookUrl` | `TELEGRAM_WEBHOOK_URL` | 20 | TelegramWebhookLifecycleService |
| `telegram.webhookSecret` | `TELEGRAM_WEBHOOK_SECRET` | 21 | WebhooksController, lifecycle registerWebhook |
| `telegram.enabled` | `TELEGRAM_ENABLED` (default true) | 22 | Lifecycle bootstrap/shutdown/cron |
| `jobs.enabled` | `ENABLE_CRON` (default true) | 30 | JobsService cron, lifecycle health check |
| `jobs.reminderTimezone` | `REMINDER_TIMEZONE` (default `Europe/Minsk`) | 31 | JobsService.getTimezoneNow |
| `appPublicUrl` | `APP_PUBLIC_URL` | 34 | Lifecycle resolveWebhookUrl fallback |

**Валидация env:** `env.validation.ts:37-51` — все Telegram-поля `@IsOptional()`; **нет** prod-требования `TELEGRAM_WEBHOOK_SECRET`.

---

## Классы (текущий код)

### `TelegramModule`

**Файл:** `apps/api/src/modules/telegram/telegram.module.ts` (11 строк)

| Строка | Содержание |
|--------|------------|
| 7 | `imports: [SettingsModule]` |
| 8 | `providers: [TelegramService, TelegramWebhookLifecycleService]` |
| 9 | `exports: [TelegramService]` |

Lifecycle **не экспортируется** — используется только внутри модуля.

---

### `TelegramService`

**Файл:** `apps/api/src/modules/telegram/telegram.service.ts` (115 строк)

| Свойство | Тип | Строка |
|----------|-----|--------|
| `logger` | `Logger` | 6 |
| `settingsService` | `SettingsService` | 8 (constructor) |

#### `getBotToken(): Promise<string | null>` — строки 10-12

Делегирует `settingsService.getTelegramBotToken()`.

**Приоритет token:** env `TELEGRAM_BOT_TOKEN` → AppSettings `telegram_bot_token` (`settings.service.ts:13-17`).

#### `sendMessage(chatId, text)` — строки 14-26

1. Строки 15-18: нет token → `{ ok: false, error: 'TELEGRAM_BOT_TOKEN not set' }` (без throw)
2. Строки 20-24: `fetch` POST `https://api.telegram.org/bot${botToken}/sendMessage`
3. Строка 25: `return res.json()` — **нет** проверки `res.ok`, **нет** retry на 429, **нет** structured logging ошибок

**Callers:** `JobsService` (строки 90, 100, 141), `AlfaBankService` (128, 148), `FunctionsController` (85), `handleUpdate` (112).

#### `getBotInfo()` — строки 28-40

1. Строка 30: нет token → `throw new Error`
2. Строки 32-35: parallel `getMe` + `getWebhookInfo`
3. Строка 39: return `{ bot, webhook, token_last5 }`

**Caller:** `FunctionsController` case `checkBotInfo` (строка 102).

#### `registerWebhook(webhookUrl, secretToken?)` — строки 42-74

1. Строки 48-54: `deleteWebhook` с `drop_pending_updates: true`
2. Строки 56-59: payload `url`, `allowed_updates: ['message']`, optional `secret_token`
3. Строки 62-68: `setWebhook`
4. Строки 70-73: `getWebhookInfo` для верификации
5. Return `{ delete, set, webhook, target_url }`

**Callers:** `TelegramWebhookLifecycleService.ensureWebhook` (66), `FunctionsController` cases `fixWebhook`, `registerTelegramWebhook`, `clearTelegramUpdates` (97-100).

**Баг:** `FunctionsController` case `clearTelegramUpdates` (строка 99) вызывает `registerWebhook`, а не отдельный clear — имя функции вводит в заблуждение.

#### `deleteWebhook()` — строки 76-92

`drop_pending_updates: false`. Вызывается при shutdown lifecycle (строка 30).

#### `getWebhookInfo()` — строки 94-99

Return `null` если нет token.

#### `handleUpdate(update)` — строки 101-114

1. Строки 102-107: парсит `update.message`; если не `/start` или нет `chat.id` → `{ ok: true }`
2. Строки 109-110: welcome message (идентичен base44 `telegramWebhook/entry.ts:40`)
3. Строка 112: `sendMessage` без сохранения `telegram_id` в User/Student
4. Строка 113: `{ ok: true }`

**Критично:** `/start` **не привязывает** chat_id к аккаунту — пользователь вручную копирует ID в профиль (`TelegramSettings.jsx:311-315`).

---

### `TelegramWebhookLifecycleService`

**Файл:** `apps/api/src/modules/telegram/telegram-webhook.lifecycle.ts` (82 строки)

| Метод | Строки | Описание |
|-------|--------|----------|
| `onApplicationBootstrap` | 20-26 | Если `telegram.enabled` → `ensureWebhook()` |
| `beforeApplicationShutdown` | 28-31 | Если enabled → `deleteWebhook()` |
| `verifyWebhookHealth` | 33-55 | `@Cron('*/5 * * * *')` — каждые 5 мин |
| `ensureWebhook` (private) | 57-71 | register с secret из config |
| `resolveWebhookUrl` (private) | 73-81 | `TELEGRAM_WEBHOOK_URL` → fallback `APP_PUBLIC_URL/api/webhooks/telegram` |

#### `verifyWebhookHealth` — строки 33-55

Guards:
- `telegram.enabled` — строка 35
- `jobs.enabled` — строка 36 (health check **не работает** если cron отключён)
- `expectedUrl` из `resolveWebhookUrl` — строки 38-39

Строки 42-50: сравнивает `info.result.url` с expected; при mismatch или `last_error_date` → re-register.

**Отличие от Base44:** legacy `telegramPoller` (base44) использовал long-polling; NestJS — только webhook.

---

### `WebhooksController`

**Файл:** `apps/api/src/modules/webhooks/webhooks.controller.ts` (61 строка)

**Модуль:** `webhooks.module.ts:6-9` — imports `TelegramModule`, `AlfaBankModule`.

#### `POST /api/webhooks/telegram` — строки 26-43

| Строка | Поведение |
|--------|-----------|
| 29 | Header `x-telegram-bot-api-secret-token` |
| 31-34 | Если `expectedSecret` задан И `secretToken !== expectedSecret` → `401 Unauthorized` |
| 31-34 | Если `expectedSecret` **не задан** — secret **не проверяется** (дыра в prod) |
| 37 | `telegramService.handleUpdate(body)` |
| 39-41 | catch → log error, return `{ ok: true }` (всегда 200 для Telegram) |

**Сравнение с Base44 `telegramWebhook/entry.ts`:** нет secret token; тот же welcome text.

---

### `FunctionsController` (Telegram-related)

**Файл:** `apps/api/src/modules/functions/functions.controller.ts` (120 строк)

#### Матрица auth — строки 41-69

| Группа | Функции | Auth |
|--------|---------|------|
| `publicFunctions` | `tgDebug` | **Нет** |
| `adminFunctions` | `exportBackup`, `checkBotInfo`, `registerTelegramWebhook`, `revokeAllAccess` | `user.role === 'admin'` |
| `authFunctions` | `sendTelegramMessage`, `alfaBankInit`, `fixWebhook`, `checkPaymentStatus`, `clearTelegramUpdates` | JWT required |
| *(не в списках)* | `autoCompleteExpiredLessons`, `sendLessonReminders`, `sendLessonReminders2h` | **Только known check, auth НЕТ** |

#### Dispatch (Telegram) — строки 79-118

| Case | Строка | Реализация |
|------|--------|------------|
| `sendTelegramMessage` | 84-85 | `telegramService.sendMessage(body.chat_id, body.text)` |
| `fixWebhook` | 97-100 | `registerWebhook(\`${origin}/api/webhooks/telegram\`)` — **без secret** |
| `registerTelegramWebhook` | 98-100 | то же |
| `clearTelegramUpdates` | 99-100 | то же (не clear) |
| `checkBotInfo` | 101-102 | `getBotInfo()` |
| `sendLessonReminders` | 107-108 | `jobsService.sendLessonReminders24h()` |
| `sendLessonReminders2h` | 109-110 | `jobsService.sendLessonReminders2h()` |
| `autoCompleteExpiredLessons` | 105-106 | `jobsService.autoCompleteExpiredLessons()` |
| `tgDebug` | 113-115 | log headers/body, `{ ok: true }` |

**Строка 81:** `webhookUrl = \`${origin}/api/webhooks/telegram\`` — динамический URL из request host (может не совпадать с `TELEGRAM_WEBHOOK_URL` / lifecycle).

---

### `JobsService` (Telegram-части)

**Файл:** `apps/api/src/modules/jobs/jobs.service.ts` (208 строк)

**Зависимости:** `EntityRepositoryService` (11), `TelegramService` (12), `ConfigService` (13).

#### Cron

| Метод | Cron | Строки | Действие |
|-------|------|--------|----------|
| `run24hReminders` | `0 12 * * *` (12:00 UTC) | 16-20 | `sendLessonReminders24h` |
| `runMinuteJobs` | `* * * * *` | 22-26 | `sendLessonReminders2h` + `autoCompleteExpiredLessons` |

Guard: `jobs.enabled` (`ENABLE_CRON !== 'false'`).

#### `sendLessonReminders24h()` — строки 46-106

1. **47-48:** bot token check
2. **50-53:** `getTimezoneNow()` + tomorrow date string
3. **55-59:** filter Lesson `date=tomorrowStr`, `status=planned`, `!reminder_24h_sent`
4. **65-68:** list ALL Student + Teacher → in-memory maps
5. **73:** `update` `reminder_24h_sent: true` **до** отправки (at-most-once)
6. **76:** `resolveStudentIds(lesson)` — строки 194-198
7. **83-92:** student message с `lesson_balance`, `meeting_link`
8. **94-102:** teacher message (без balance)

**Шаблон student message (строка 86):**
```
📅 Напоминание об уроке!

Завтра в ${timeStr} (${duration} мин, ${formatStr})
👩‍🏫 Преподаватель: ${teacherName}
💡 Баланс уроков: ${student.lesson_balance || 0}
[+ ссылка если online]
```

#### `sendLessonReminders2h()` — строки 108-147

- Window: `diffMin >= 110 && diffMin <= 125` (строки 119-121)
- **132:** mark `reminder_2h_sent` до send
- **138-143:** только students, короткое сообщение
- **Нет** уведомления teacher (в отличие от base44 `sendLessonReminders2h/entry.ts:99-106`)

#### `getTimezoneNow()` — строки 201-207

```typescript
const localized = new Date(now.toLocaleString('en-US', { timeZone: tz }));
const offsetMs = localized.getTime() - now.getTime();
return new Date(now.getTime() + offsetMs);
```

Эвристика; не эквивалентна `Europe/Minsk` через luxon/date-fns-tz.

**Сравнение с Base44 24h** (`base44/functions/sendLessonReminders/entry.ts:14-18`): Base44 использует фиксированный `UTC+3`; NestJS — `REMINDER_TIMEZONE`.

**Сравнение с Base44 2h** (`base44/functions/sendLessonReminders2h/entry.ts:14-46`): Base44 парсит `lesson.dateTstart_time+03:00` и окно 110–125 мин UTC; NestJS — local Date arithmetic через `getTimezoneNow`.

---

### `SettingsService` (token path)

**Файл:** `apps/api/src/modules/settings/settings.service.ts:12-18`

```
1. config.get('telegram.botToken')  // TELEGRAM_BOT_TOKEN
2. entityRepository.filter('AppSettings', { key: 'telegram_bot_token' })
3. settings[0]?.value
```

**Проблема до этапа 3:** filter через broken `EntityRepositoryService` (equality only); после typed AppSettingsRepository — исправляется.

---

### `AlfaBankService` (Telegram notifications)

**Файл:** `apps/api/src/modules/alfabank/alfabank.service.ts`

| Сценарий | Строки | Сообщение |
|----------|--------|-----------|
| Package payment | 126-128 | сумма, lessons_added, **newBalance** |
| Course payment | 146-148 | курс активирован, 35 часов |

Строка 128: `.catch(() => undefined)` — silent failure.

**После этапа 8:** `newBalance` должен браться из единого `StudentsService.adjustBalance` (ADR-003).

---

## Frontend: `TelegramSettings.jsx`

**Файл:** `src/pages/TelegramSettings.jsx` (326 строк)

| Блок | Строки | API |
|------|--------|-----|
| Load token | 23-36 | `base44.entities.AppSettings.filter({ key: "telegram_bot_token" })` |
| Save token | 38-55 | AppSettings create/update |
| Load students/teachers | 26-27 | `base44.entities.Student.list()`, `Teacher.list()` |
| Register webhook | 113-128 | `base44.functions.invoke("fixWebhook", {})` |
| Test send | 86-107 | **Прямой** `fetch` к `api.telegram.org` с token из state (не через backend) |
| Auto notifications list | 284-306 | Статический UI (документация для админа) |
| Linking instructions | 309-316 | Manual telegram_id в профиле |

**Проблемы UI:**

1. **Строки 96-99:** тестовое сообщение идёт **с клиента** с полным bot token в браузере — security risk; должен использовать `sendTelegramMessage` function.
2. **Строка 99:** `parse_mode: "HTML"` — backend `sendMessage` не передаёт parse_mode.
3. **Строки 117-120:** ожидает `data.set.ok`, `data.webhook.url` — совпадает с `registerWebhook` return shape.
4. После этапа 5: миграция на v2 Settings API; token CRUD через admin endpoint.

---

## Legacy Base44: структура `base44/`

```
base44/
├── entities/           # JSON Schema (17 файлов) — не runtime
│   ├── Student.jsonc
│   ├── Teacher.jsonc
│   ├── Lesson.jsonc
│   ├── TeacherAvailability.jsonc  # slots: array jsonb
│   ├── LessonBalance.jsonc
│   └── ...
└── functions/          # Deno edge functions (15 entry.ts)
    ├── telegramWebhook/entry.ts      # /start handler
    ├── registerTelegramWebhook/entry.ts
    ├── telegramPoller/entry.ts       # long-poll + offset в AppSettings
    ├── sendTelegramMessage/entry.ts
    ├── clearTelegramUpdates/entry.ts
    ├── fixWebhook/entry.ts
    ├── checkBotInfo/entry.ts
    ├── tgDebug/entry.ts
    ├── sendLessonReminders/entry.ts
    ├── sendLessonReminders2h/entry.ts
    └── ...
```

**Маппинг Base44 → NestJS:**

| Base44 function | NestJS endpoint | Статус |
|-----------------|-----------------|--------|
| `telegramWebhook` | `POST /api/webhooks/telegram` | ✅ Портирован |
| `registerTelegramWebhook` | `POST /api/functions/registerTelegramWebhook` | ✅ (admin) |
| `fixWebhook` | `POST /api/functions/fixWebhook` | ✅ (auth) |
| `clearTelegramUpdates` | `POST /api/functions/clearTelegramUpdates` | ⚠️ Имя ≠ поведение |
| `telegramPoller` | — | ❌ Заменён webhook lifecycle |
| `sendTelegramMessage` | `POST /api/functions/sendTelegramMessage` | ✅ |
| `checkBotInfo` | `POST /api/functions/checkBotInfo` | ✅ (admin) |
| `tgDebug` | `POST /api/functions/tgDebug` | ✅ (public!) |
| `sendLessonReminders` | Cron + `POST /api/functions/sendLessonReminders` | ✅ |
| `sendLessonReminders2h` | Cron + `POST /api/functions/sendLessonReminders2h` | ✅ (упрощён teacher notify) |

---

## Entity (задействованные)

| Поле | Entity | Колонка | Использование в Telegram |
|------|--------|---------|--------------------------|
| `telegramId` | StudentEntity | `telegram_id` | reminders, payment notify |
| `telegramId` | TeacherEntity | `telegram_id` | 24h reminder teacher |
| `telegramId` | UserEntity | `telegram_id` | profile (не auto-link) |
| `lessonBalance` | StudentEntity | `lesson_balance` | текст 24h reminder (строка 86 jobs) |
| `reminder24hSent` | LessonEntity | `reminder_24h_sent` | idempotency |
| `reminder2hSent` | LessonEntity | `reminder_2h_sent` | idempotency |
| `value` | AppSettingEntity | key `telegram_bot_token` | bot token DB storage |
| `date`, `startTime`, `status` | LessonEntity | typed columns | reminder filters |

---

## Data flows

### Поток 1: Bootstrap webhook

```
App start (telegram.enabled=true)
  → TelegramWebhookLifecycleService.onApplicationBootstrap:20-26
    → resolveWebhookUrl:73-81
      → TELEGRAM_WEBHOOK_URL OR APP_PUBLIC_URL/api/webhooks/telegram
    → ensureWebhook:57-71
      → TelegramService.registerWebhook(url, TELEGRAM_WEBHOOK_SECRET):42-74
```

### Поток 2: Incoming /start

```
Telegram POST /api/webhooks/telegram
  → WebhooksController.telegramWebhook:26-43
    → secret check (optional):31-34
    → TelegramService.handleUpdate:101-114
      → sendMessage welcome
  ← { ok: true }
```

### Поток 3: Cron 24h reminder

```
@Cron 12:00 UTC (jobs.service.ts:16-20)
  → sendLessonReminders24h:46-106
    → EntityRepository filter/list (→ post этап 3: LessonsService)
    → TelegramService.sendMessage × N
```

### Поток 4: Payment → Telegram

```
Alfa Bank webhook → AlfaBankService.handleWebhook:118-130
  → entityRepository.update Student lesson_balance
  → telegramService.sendMessage(student.telegram_id, msg):127-128
```

### Поток 5: Admin manual webhook fix (UI)

```
TelegramSettings.jsx:113-128
  → base44.functions.invoke("fixWebhook")
    → FunctionsController:97-100
      → registerWebhook(origin/api/webhooks/telegram)  // без secret!
```

---

## Проблемы (с номерами строк)

| # | Файл | Строки | Проблема | Severity |
|---|------|--------|----------|----------|
| T1 | webhooks.controller.ts | 31-34 | Secret optional — prod без secret = открытый webhook | **Critical** |
| T2 | functions.controller.ts | 55, 105-110 | Cron functions без auth | **Critical** |
| T3 | functions.controller.ts | 41, 113-115 | `tgDebug` публичный | High |
| T4 | functions.controller.ts | 97-100 | `fixWebhook` без `secret_token` | High |
| T5 | telegram.service.ts | 14-26 | Нет error logging, нет retry 429 | High |
| T6 | telegram.service.ts | 101-114 | `/start` не сохраняет telegram_id | Medium |
| T7 | jobs.service.ts | 73, 132 | reminder flag до send — потеря при TG error | Medium |
| T8 | jobs.service.ts | 16 | Cron 12:00 UTC vs REMINDER_TIMEZONE | Medium |
| T9 | jobs.service.ts | 108-147 | 2h reminder без teacher notify (regression vs base44) | Low |
| T10 | alfabank.service.ts | 128 | silent catch на sendMessage | Medium |
| T11 | telegram-webhook.lifecycle.ts | 36 | Health check требует jobs.enabled | Low |
| T12 | TelegramSettings.jsx | 96-99 | Client-side direct Telegram API | High |
| T13 | settings.service.ts | 16-17 | Token через EntityRepository (до этап 3) | High |
| T14 | entity-repository.service.ts | 102-107 | Jobs читает Lesson через row.data path | **Critical** (до этап 2) |

---

## Таблица изменений

| Файл | Строки | Причина | Изменение | Побочные эффекты | Проверка |
|------|--------|---------|-----------|------------------|----------|
| `telegram.service.ts` | 14-26 | silent failures | log errors; retry 429 с backoff | задержка при rate limit | mock 429 |
| `telegram.service.ts` | 101-114 | optional | deep link `/start email_xxx` → save User.telegramId | security: verify token | E2E link |
| `telegram-webhook.lifecycle.ts` | 57-61 | silent misconfig | prod: throw/warn loud if enabled && !webhookUrl | dev OK без URL | prod env test |
| `webhooks.controller.ts` | 31-34 | security | prod: `TELEGRAM_WEBHOOK_SECRET` required, else 401 | dev без secret OK | invalid secret → 401 |
| `functions.controller.ts` | 55, 105-110 | auth | AdminGuard / role admin для cron functions | breaking for anonymous cron | 403 без token |
| `functions.controller.ts` | 97-100 | secret | pass `config.telegram.webhookSecret` to registerWebhook | — | getWebhookInfo has secret |
| `functions.controller.ts` | 99 | naming | `clearTelegramUpdates` → deleteWebhook + register OR rename | API compat | invoke clear |
| `jobs.service.ts` | 46-147 | typed data | LessonsService, StudentsService, TeachersService | empty recipients if mapper broken | fixture lesson tomorrow |
| `jobs.service.ts` | 201-207 | TZ | document REMINDER_TIMEZONE; optional luxon | behavior change at DST | boundary test |
| `settings.service.ts` | 12-18 | reliability | AppSettingsRepository (post этап 3) | — | DB token lookup |
| `alfabank.service.ts` | 118-128 | typed | StudentsService.adjustBalance + telegramId | unified balance msg | webhook test |
| `env.validation.ts` | 37-51 | prod safety | require TELEGRAM_WEBHOOK_SECRET if NODE_ENV=production && TELEGRAM_ENABLED | deploy checklist | boot validation |
| `TelegramSettings.jsx` | 96-107 | security | use `sendTelegramMessage` function, not direct API | needs JWT | admin test send |
| `TelegramSettings.jsx` | 25-55 | API | v2 settings endpoint (post этап 5) | — | save/load token |

---

## API changes

| Endpoint | Текущий auth | Целевой auth | Другое |
|----------|--------------|--------------|-------|
| `POST /api/webhooks/telegram` | optional secret | **mandatory secret in prod** | — |
| `POST /api/functions/sendLessonReminders` | none | **admin** | — |
| `POST /api/functions/sendLessonReminders2h` | none | **admin** | — |
| `POST /api/functions/autoCompleteExpiredLessons` | none | **admin** | — |
| `POST /api/functions/registerTelegramWebhook` | admin | admin | pass secret_token |
| `POST /api/functions/fixWebhook` | auth user | admin recommended | pass secret_token |
| `POST /api/functions/tgDebug` | public | **remove or admin-only** | — |
| `POST /api/functions/sendTelegramMessage` | auth | auth | — |
| `POST /api/functions/checkBotInfo` | admin | admin | — |

---

## Env checklist

```bash
TELEGRAM_BOT_TOKEN=           # или AppSettings telegram_bot_token
TELEGRAM_WEBHOOK_URL=         # явный URL; иначе APP_PUBLIC_URL/api/webhooks/telegram
TELEGRAM_WEBHOOK_SECRET=      # ОБЯЗАТЕЛЕН в production
TELEGRAM_ENABLED=true         # false — skip lifecycle
ENABLE_CRON=true              # false — skip cron + webhook health
REMINDER_TIMEZONE=Europe/Minsk
APP_PUBLIC_URL=https://crm.example.com
```

---

## Tests (этап 6 + этап 7)

| Test | Файл | Cases |
|------|------|-------|
| getTelegramBotToken priority | `settings.service.spec.ts` | env > DB |
| sendMessage 429 retry | `telegram.service.spec.ts` | mock fetch 429→200 |
| webhook secret prod | `webhooks.e2e-spec.ts` | no secret → 401 in prod |
| cron auth | `functions.e2e-spec.ts` | sendLessonReminders без admin → 403 |
| reminder 24h | `jobs.service.spec.ts` | tomorrow lesson, flag set, mock TG |
| handleUpdate /start | `telegram.service.spec.ts` | welcome sent, no DB write |

**Mock:** никогда не вызывать реальный `api.telegram.org` в CI.

---

## Checklist

- [ ] `TelegramService.sendMessage` — structured logging + 429 retry
- [ ] `WebhooksController` — mandatory secret в production
- [ ] `FunctionsController` — admin guard на cron functions
- [ ] `fixWebhook` / `registerTelegramWebhook` — передают `secret_token`
- [ ] `JobsService` — typed Lessons/Students/Teachers (post этап 3)
- [ ] `SettingsService` — typed AppSettingsRepository
- [ ] `TelegramWebhookLifecycleService` — fail loud prod misconfig
- [ ] `REMINDER_TIMEZONE` задокументирован в README
- [ ] E2E: lesson tomorrow + manual sendLessonReminders → TG message
- [ ] E2E: AlfaBank package payment → TG message с балансом
- [ ] `npm run build` OK

---

## Definition of Done

1. Reminders 24h/2h отправляются при наличии `telegram_id` и planned lessons
2. AlfaBank success → telegram message student с корректным балансом
3. `TELEGRAM_WEBHOOK_SECRET` enforced в production (401 без valid secret)
4. Cron functions `sendLessonReminders*`, `autoCompleteExpiredLessons` — admin only
5. `/start` handler задокументирован (manual linking или optional auto-link)
6. Webhook health cron перерегистрирует при mismatch
7. Нет silent failures в `sendMessage` (логируются ошибки API)
8. `npm run build` без ошибок

---

## Зависимости этапа

| Требуется до начала | Блокирует |
|---------------------|-----------|
| Этап 2a: Lesson/Student typed columns + mapper | Jobs reminders data |
| Этап 3: LessonsService, StudentsService, Settings typed | Jobs + AlfaBank notify |
| Этап 4: AdminGuard на functions | Cron auth |
| Этап 5 (частично): TelegramSettings v2 API | UI token management |

**Можно параллельно с:** этап 4 (API), этап 5 (frontend) после этапа 3.

---

## Запрещено

- Вызывать Telegram API без mock в automated tests
- Хранить bot token в frontend state для production test sends
- Удалять welcome message text без согласования с UX
- Вводить `json_record` для telegram_id / reminder flags
- Отключать idempotent `reminder_*_sent` flags без замены

---

## Порядок реализации

1. Settings typed repository → token lookup reliable  
2. JobsService → typed services (reminders data path)  
3. `TelegramService.sendMessage` hardening (log + retry)  
4. `WebhooksController` prod secret enforcement  
5. `FunctionsController` admin guard + secret in registerWebhook  
6. `TelegramWebhookLifecycleService` prod validation  
7. Optional: `/start` deep link auto-link  
8. Frontend: test send через backend function  
9. Manual E2E checklist  
10. `npm run build`

---

## End-to-end проверка

```bash
# 1. Token
# AppSettings telegram_bot_token ИЛИ TELEGRAM_BOT_TOKEN в .env

# 2. Webhook (admin JWT)
curl -X POST http://localhost:3001/api/functions/registerTelegramWebhook \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{}'

# 3. Bot info
curl -X POST http://localhost:3001/api/functions/checkBotInfo \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Seed: Lesson date=tomorrow, status=planned, student.telegram_id set

# 5. Trigger 24h (admin)
curl -X POST http://localhost:3001/api/functions/sendLessonReminders \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 6. /start в @LonghuaChinese_bot → welcome message

# 7. AlfaBank test webhook → payment TG notify
```

---

*Документ основан на исходниках по состоянию репозитория; номера строк актуальны для файлов в `apps/api/src/modules/` и `src/pages/TelegramSettings.jsx`.*
