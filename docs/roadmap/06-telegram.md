# Этап 6: Telegram Module

**Предшественник:** [03-services.md](./03-services.md) (Jobs на typed services)  
**Можно параллельно с:** [04-api.md](./04-api.md)  
**Трудоёмкость:** 8–12 ч

---

## Цель

Стабилизировать Telegram-интеграцию после миграции data layer; hardening webhooks и cron triggers.

## Зачем

Reminders и payment notifications критичны для бизнеса; модуль зависит от Lesson/Student data и Settings.

## Файлы

- `modules/telegram/telegram.service.ts`
- `modules/telegram/telegram-webhook.lifecycle.ts`
- `modules/webhooks/webhooks.controller.ts`
- `modules/functions/functions.controller.ts` (cron auth — часть этапа 4)
- `modules/jobs/jobs.service.ts` (косвенно)

## Entity

Student (telegram_id), Lesson (date, start_time, status), User (telegram_id), AppSettings (bot token).

## Зависимые сервисы

TelegramService ← SettingsService, JobsService, AlfaBankService, WebhooksController, FunctionsController.

## Риски

| Риск | Митигация |
|------|-----------|
| Token not found | Fallback env TELEGRAM_BOT_TOKEN |
| Webhook URL mismatch | Lifecycle cron + manual fix function |
| Spam reminders | Idempotent reminder_24h_sent flags |

## Критерии завершения

- [ ] Reminders 24h/2h отправляются при наличии данных
- [ ] AlfaBank success → telegram message to student
- [ ] Webhook secret enforced in production
- [ ] Cron functions require admin auth
- [ ] `/start` handler documented (linking strategy)

---

## Задачи

### Этап 6 — telegram

#### Модуль: telegram

##### Файл: `telegram.service.ts`

###### Изменение: улучшить error logging; retry on 429

- **Причина:** silent failures в reminders
- **Что может сломаться:** —
- **Как проверить:** mock 429 response

###### Изменение (опционально): `/start` сохраняет telegram_id в User по email deep link

- **Причина:** manual linking burden
- **Что может сломаться:** security if no verification
- **Как проверить:** E2E link flow

##### Файл: `telegram-webhook.lifecycle.ts`

###### Изменение: fail loud if TELEGRAM_ENABLED but no webhook URL in prod

- **Причина:** silent misconfiguration
- **Как проверить:** prod env validation

#### Модуль: settings

##### Файл: `settings.service.ts`

###### Изменение: после этапа 3 — typed AppSettingsRepository

- **Причина:** token lookup reliability
- **Как проверить:** getTelegramBotToken with DB token

#### Модуль: jobs

##### Файл: `jobs.service.ts`

###### Изменение: использовать LessonsService.resolveStudentIds; TeachersService.getById

- **Причина:** корректные имена/telegram_id после typed layer
- **Что может сломаться:** empty recipient list
- **Как проверить:** sendLessonReminders24h with test data

###### Изменение: timezone handling — document REMINDER_TIMEZONE behavior

- **Причина:** `jobs.service.ts:201-206` custom offset
- **Как проверить:** lesson at boundary times

#### Модуль: webhooks

##### Файл: `webhooks.controller.ts`

###### Изменение: require TELEGRAM_WEBHOOK_SECRET in production (throw 401 if missing)

- **Причина:** `webhooks.controller.ts:31-34` optional secret
- **Что может сломаться:** dev without secret
- **Как проверить:** prod env + invalid secret → 401

#### Модуль: functions

##### Файл: `functions.controller.ts`

###### Изменение: AdminGuard on sendLessonReminders*, autoCompleteExpiredLessons

- **Причина:** public cron trigger
- **Как проверить:** см. этап 4

#### Модуль: alfabank

##### Файл: `alfabank.service.ts`

###### Изменение: после PaymentsService — student.telegramId via StudentsService

- **Причина:** reliable notification after payment
- **Как проверить:** webhook test payment → message

---

## API changes

| Endpoint | Change |
|----------|--------|
| POST `/api/functions/sendLessonReminders` | Admin only |
| POST `/api/functions/sendLessonReminders2h` | Admin only |
| POST `/api/functions/autoCompleteExpiredLessons` | Admin only |
| POST `/api/webhooks/telegram` | Mandatory secret in prod |

## Frontend changes

| File | Change |
|------|--------|
| `TelegramSettings.jsx` | Может остаться на AppSettings v2 API |
| Admin UI | Test webhook button → admin function |

## Env checklist

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_URL=  # or APP_PUBLIC_URL
TELEGRAM_WEBHOOK_SECRET=  # required prod
TELEGRAM_ENABLED=true
ENABLE_CRON=true
REMINDER_TIMEZONE=Europe/Minsk
```

## Проверка end-to-end

1. Настроить bot token в AppSettings или env
2. `POST /api/functions/registerTelegramWebhook` (admin)
3. Создать Lesson на завтра, status=planned, student с telegram_id
4. `POST /api/functions/sendLessonReminders` (admin)
5. Проверить сообщение в Telegram

## Зависимости

| Заблокировано до | Причина |
|------------------|---------|
| Этап 2a | Lesson/Student data readable |
| Этап 3 | Jobs uses typed services |
| Этап 4 | Cron auth |
