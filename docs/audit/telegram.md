# Аудит: Telegram

## Компоненты

| Компонент | Файл |
|-----------|------|
| TelegramService | `telegram.service.ts` |
| TelegramWebhookLifecycleService | `telegram-webhook.lifecycle.ts` |
| WebhooksController | `webhooks.controller.ts` |
| FunctionsController (send, webhook fix) | `functions.controller.ts` |

## Зависимости

```
TelegramModule → SettingsModule → EntitiesModule → EntityRepositoryService
JobsModule → TelegramModule + EntityRepositoryService
AlfaBankModule → TelegramModule (payment notifications)
WebhooksModule → TelegramModule
FunctionsModule → TelegramModule
```

## Функциональность

### TelegramService

- `getBotToken()` → SettingsService → AppSettings `telegram_bot_token` или env
- `sendMessage(chatId, text)` → Telegram Bot API
- `registerWebhook` / `deleteWebhook` / `getWebhookInfo`
- `handleUpdate` — только `/start` welcome message

### TelegramWebhookLifecycleService

- `onApplicationBootstrap` — register webhook if `TELEGRAM_ENABLED`
- `beforeApplicationShutdown` — delete webhook
- `@Cron('*/5 * * * *')` — health check webhook URL

### JobsService (зависит от Telegram)

- `sendLessonReminders24h` — читает Lesson/Student через EntityRepositoryService
- `sendLessonReminders2h` — то же
- Использует `student.telegram_id`, `lesson.start_time`, `lesson.teacher_id`

### AlfaBankService

- После оплаты: `telegramService.sendMessage(student.telegram_id, ...)`

## Проблемы

| # | Проблема | Влияние |
|---|----------|---------|
| 1 | Jobs читает Lesson через broken mapper | Пустые reminders |
| 2 | SettingsService → broken AppSettings filter | Token не находится |
| 3 | Cron functions без auth | Spoof reminders |
| 4 | Webhook secret optional | Unauthorized updates if not set |
| 5 | `handleUpdate` не привязывает telegram_id к User | Manual linking only |

## Изменения по этапам

| Этап | Изменение |
|------|-----------|
| 2a | Mapper fix → reminders получат данные Lesson/Student |
| 3 | JobsService → LessonsService, StudentsService |
| 4 | Protect cron functions (admin/internal) |
| 6 | Typed SettingsRepository; webhook hardening; optional auto-link /start |
| 8 | — |

## Env variables

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_URL` / `APP_PUBLIC_URL`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_ENABLED`
- `ENABLE_CRON`

## Проверка

```bash
# Bot info (admin function)
POST /api/functions/checkBotInfo

# Webhook status
POST /api/functions/registerTelegramWebhook

# Manual reminder
POST /api/functions/sendLessonReminders
```

Ожидание: сообщения уходят студентам с `telegram_id` и planned lessons на завтра/через 2ч.
