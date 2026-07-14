# Lesson notifications (Telegram)

## 24h reminder (informational)

```
Cron every 10 minutes (send-lesson-reminders-24h)
  → window: lesson start in 23h50m … 24h10m
  → send Telegram text only (no buttons)
  → set lessons.reminder_24h_sent
  → does NOT create LessonConfirmation
```

Text:

```
Напоминаем, завтра у вас занятие китайским языком.

Дата:
Время:
Преподаватель:
```

## 3h confirmation

```
Cron every 5 minutes (send-lesson-confirmations-3h)
  → window: lesson start in 2h50m … 3h10m
  → create lesson_confirmations (PENDING) if missing
  → Telegram inline: confirm / decline
  → CONFIRMED or DECLINED (+ reason)
```

Text:

```
Через 3 часа у вас занятие.

Дата:
Время:
Преподаватель:

Подтвердите участие:
```

## Entity `lesson_confirmations`

UNIQUE `(lesson_id, student_id)`. Status: PENDING / CONFIRMED / DECLINED.

## Deep-link binding

- Source of truth: `users.telegram_id`
- Sync to `students.telegram_id` / `teachers.telegram_id`
- `POST /api/telegram/link/create`, `GET /api/telegram/status`, `POST /api/telegram/unlink`
- Bot: `/start {token}`

## Callbacks (polling + webhook → TelegramUpdateHandler)

- `lesson_confirm:{confirmationId}`
- `lesson_decline:{confirmationId}` then free-text reason
