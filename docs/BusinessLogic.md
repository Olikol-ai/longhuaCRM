# Business Logic

Описание ключевых бизнес-процессов языковой школы Longhua. Логика реализована в NestJS services; этот документ — ориентир для разработчиков и операторов.

## Роли

| Роль | Возможности |
|------|-------------|
| **admin** | Полный доступ: пользователи, финансы, сертификаты, настройки |
| **teacher** | Расписание, посещаемость, материалы, свои выплаты |
| **student** | Курсы, уроки, материалы, профиль |
| **pending** | Регистрация до подтверждения email/назначения роли |

## Регистрация и onboarding

1. Пользователь регистрируется → `pending_registrations` + код на email.
2. Подтверждение кода → создание `users` со статусом pending role.
3. Admin назначает роль → `RoleEntitySyncService` создаёт/связывает student или teacher profile.
4. При создании student с email — автолинковка к существующему user.

## Учебный цикл

```
Course template → Enrollment (student + course)
       ↓
Lesson series / manual lessons
       ↓
Attendance (enrolled → attended / missed)
       ↓
Lesson complete → lesson balance −1, progress +1
       ↓
Enrollment completed → auto draft certificate
       ↓
Admin issues certificate (issued status)
```

## Баланс уроков

- `students.lesson_balance` — оплаченные уроки
- Списание при завершении урока (`balance_deducted` на attendance)
- Пополнение через `payments` (admin) или Alfa Bank (опционально)
- Операции идемпотентны (locks + flags)

## Посещаемость

Статусы: `enrolled`, `attended`, `missed`, `missed_no_notice`, `cancelled`.

`missed` / `missed_no_notice` → инкремент `enrollment.missed_lessons`.

## Сертификаты

Жизненный цикл: `draft` → `issued` → `sent` / `revoked` / `duplicate` (при reissue).

Выдача только при завершённом enrollment. Unique: registration number, blank series+number.

## Платежи

- Связь с student (обязательно)
- Опционально: shop_item, enrollment
- Update/delete с pessimistic lock — защита от двойного зачисления баланса

## Расписание преподавателя

- Availability slots + bookings
- При создании урока: проверка доступности и конфликтов
- Lesson series пропускает выходные

## Уведомления

- In-app notifications
- Email (SMTP) — коды верификации
- Telegram — напоминания (cron), bot commands

## Аудит

`audit_logs` — смена ролей, статусов, критичные admin-действия.

## Инварианты (не нарушать)

1. Один active enrollment на пару student/course.
2. Один draft certificate на пару student/course.
3. Один active issued/sent certificate на пару student/course.
4. Бизнес-данные только в реляционных таблицах.
5. Критические PATCH — в транзакциях с блокировками.

Подробности доменных сущностей: `docs/domain/*.md`.
