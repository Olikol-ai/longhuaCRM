# AS-IS: данные и бизнес-потоки

Назначение: техническая карта сущностей и ключевых потоков в текущей реализации для последующего `gap-analysis`.

## 1. Ключевые сущности (по факту использования)

- `User`
- `Teacher`
- `Student`
- `Lesson`
- `Payment`
- `Course`
- `LessonMaterial`
- `MaterialAccess`
- `AppSettings`
- `ShopSettings`
- `TeacherAvailability`

Источники в коде:
- `src/pages/UserManagement.jsx`
- `src/pages/Schedule.jsx`
- `src/pages/Payments.jsx`
- `src/pages/MaterialsHub.jsx`
- `src/lib/materialAccess.js`
- `src/pages/TelegramSettings.jsx`

## 2. Карта связей (упрощённо)

- `User 1 -> 0..1 Teacher` по `Teacher.user_id`
- `User 1 -> 0..1 Student` по `Student.user_id`
- `Teacher 1 -> N Lesson` по `Lesson.teacher_id`
- `Student 1 -> N Lesson` по `Lesson.student_id` или через `Lesson.student_ids[]`
- `Student 1 -> N Payment` по `Payment.student_id`
- `Course 1 -> N LessonMaterial` по `LessonMaterial.course_id`
- `Lesson N -> N LessonMaterial` через `Lesson.material_ids[]` (денормализованная связь)
- `User/Student/Teacher <-> LessonMaterial` через `MaterialAccess`

## 3. Поток: аутентификация и роль

1. Инициализация app state через public settings.
2. При наличии токена выполняется `base44.auth.me()`.
3. Если роль `user`, система пытается автопроставить `teacher/student` по связанным записям.
4. При отсутствии связей роль локально помечается как `pending`.

Код:
- `src/lib/AuthContext.jsx`

## 4. Поток: управление пользователями

1. Админ меняет роль пользователя.
2. Система обновляет `User.role`.
3. При ролях `teacher/student` создаётся или связывается соответствующая запись (`Teacher/Student`).
4. Для студентов/преподавателей доступны отдельные CRUD-таблицы.

Код:
- `src/pages/UserManagement.jsx`

## 5. Поток: жизненный цикл урока

1. Создание урока (или серии weekly-уроков) через расписание.
2. Урок хранит преподавателя, студента(ов), дату/время/длительность, статус.
3. Преподаватель может отметить урок завершённым/отменённым.
4. Автофункция переводит просроченные `planned` в `completed`.

Код:
- `src/pages/Schedule.jsx`
- `src/components/schedule/LessonFormDialog.jsx`
- `src/pages/TeacherDashboard.jsx`
- `base44/functions/autoCompleteExpiredLessons/entry.ts`

## 6. Поток: баланс ученика

Текущая логика (распределена):
- При `completed`/`missed_no_notice` баланс может уменьшаться на фронте.
- При ручном платеже баланс увеличивается/корректируется из UI.
- При удалении платежа баланс уменьшается.

Код:
- `src/pages/Schedule.jsx`
- `src/pages/TeacherDashboard.jsx`
- `src/pages/Payments.jsx`

Комментарий:
- Правила биллинга не централизованы в одном server-side месте.

## 7. Поток: онлайн-оплата (Alfa Bank)

1. Функция `alfaBankInit` создаёт `Payment` (pending-like сценарий) и регистрирует заказ в Alfa Bank.
2. Платёжный `orderId` фиксируется в комментарии платежа.
3. Webhook `alfaBankWebhook` валидирует checksum.
4. По успешному статусу обновляется платёж и:
- для `package`: начисляется баланс уроков,
- для `course`: создаётся запись курса.
5. Отправляется Telegram-уведомление студенту.

Код:
- `base44/functions/alfaBankInit/entry.ts`
- `base44/functions/alfaBankWebhook/entry.ts`

## 8. Поток: Telegram

1. Админ сохраняет токен бота в `AppSettings`.
2. Регистрируется webhook (`fixWebhook`/`registerTelegramWebhook`).
3. Рассылки и уведомления отправляются через функцию `sendTelegramMessage`.
4. Напоминания за 2 часа запускаются отдельной функцией по окну времени.

Код:
- `src/pages/TelegramSettings.jsx`
- `base44/functions/sendTelegramMessage/entry.ts`
- `base44/functions/sendLessonReminders2h/entry.ts`
- `base44/functions/telegramWebhook/entry.ts`
- `base44/functions/telegramPoller/entry.ts`

## 9. Поток: материалы и доступ

1. Админ/преподаватель управляет курсами и материалами.
2. Материалы привязываются к курсам, поддерживаются операции copy/cut/paste и перенос.
3. Доступ управляется через `MaterialAccess` (grant/revoke, admin override).
4. При завершении урока преподаватель может прикрепить `material_ids` к уроку.
5. Студент видит только материалы, к которым есть доступ и которые связаны с завершёнными уроками.

Код:
- `src/components/materials/WindowsFileBrowser.jsx`
- `src/pages/MaterialsHub.jsx`
- `src/lib/materialAccess.js`
- `src/pages/StudentLessonMaterials.jsx`
- `src/components/materials/MaterialPickerDialog.jsx`

## 10. Поток: аналитика

1. Сбор данных из `Payment`, `Lesson`, `Student`, `Teacher`.
2. Расчёт KPI, графиков и сводок загрузки.
3. Экспорт CSV.

Код:
- `src/pages/Analytics.jsx`

## 11. Обнаруженные несогласованности данных/правил

- Статусы: встречается `missed_no_notice`, в ТЗ задан `missed_without_notice`.
- Биллинг-правила распределены между UI и serverless, нет единой транзакционной точки.
- Ручные изменения платежей/баланса доступны в UI, что противоречит целевому ограничению ТЗ.

## 12. Что использовать как baseline для сравнения

Для сравнения с ТЗ на следующем шаге:
- `docs/tz-technical-structured.md`
- `docs/as-is-system-spec.md`
- этот документ: `docs/as-is-data-and-flows.md`
