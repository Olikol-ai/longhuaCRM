# AS-IS спецификация текущей реализации (Base44)

Цель: зафиксировать текущее состояние системы для последующего сравнения с `docs/tz-technical-structured.md`.

Статусы:
- `Реализовано`
- `Частично`
- `Не реализовано`

---

## 1. Платформа и архитектура

Статус: `Реализовано`

- Клиентская интеграция через `@base44/sdk` и `createClient`.
- Основные контуры: `auth`, `entities`, `functions`, `integrations`.
- Serverless-функции в `base44/functions/*`.

Код:
- `src/api/base44Client.js`
- `src/lib/app-params.js`

## 2. Пользователи и роли

Статус: `Реализовано`

- Управление аккаунтами, ролями, студентами и преподавателями.
- Автосвязывание ролей с записями `Teacher/Student`.
- Фильтры/поиск/CRUD в админке.
- Привязка `telegram_id` через профиль.

Код:
- `src/pages/UserManagement.jsx`
- `src/lib/AuthContext.jsx`
- `src/pages/Profile.jsx`

## 3. Расписание и уроки

Статус: `Частично`

Что есть:
- Календарные представления (день/неделя/месяц), создание/редактирование/удаление уроков.
- Повторяющиеся занятия (weekly series).
- Роли в интерфейсе (админ/преподаватель/студентские представления).
- Авто-перевод `planned -> completed` по времени в функции.

Что расходится с ТЗ:
- В проекте используется статус `missed_no_notice`, в ТЗ: `missed_without_notice`.
- Нет явной реализации правил «выходные/праздники» и запретов назначения в эти дни.
- Нет реализованной логики удаления серии в вариантах: одно/все последующие/вся серия.

Код:
- `src/pages/Schedule.jsx`
- `src/components/schedule/LessonFormDialog.jsx`
- `src/pages/TeacherDashboard.jsx`
- `src/pages/StudentLessons.jsx`
- `base44/functions/autoCompleteExpiredLessons/entry.ts`

## 4. UX уроков (отмены/напоминания)

Статус: `Частично`

Что есть:
- Отмена/завершение уроков преподавателем.
- Telegram-напоминания за 2 часа (функция + флаг `reminder_2h_sent`).
- Telegram-уведомления при завершении урока и событиях оплаты.

Чего нет/не подтверждено в коде:
- Отмена учеником с правилом `>=2ч без списания`, `<2ч со списанием`.
- Явная реализация UX-кнопки отмены ученика, которая исчезает после нажатия.

Код:
- `src/pages/TeacherDashboard.jsx`
- `base44/functions/sendLessonReminders2h/entry.ts`
- `base44/functions/sendLessonReminders/entry.ts`

## 5. Баланс и оплаты

Статус: `Частично`

Что есть:
- Ручное CRUD управление платежами в UI.
- Изменение `lesson_balance` при создании/редактировании/удалении платежей.
- Интеграция с Alfa Bank: инициация платежа + webhook обработки.

Расхождения с ТЗ:
- В ТЗ запрещены ручные начисления, а в текущей реализации они доступны из UI (`Payments`).
- Начисление/списание реализовано в нескольких местах (UI и функции), есть риск рассинхронизации правил.

Код:
- `src/pages/Payments.jsx`
- `src/components/payments/PaymentModal.jsx`
- `base44/functions/alfaBankInit/entry.ts`
- `base44/functions/alfaBankWebhook/entry.ts`

## 6. Telegram интеграция

Статус: `Реализовано`

- Настройка токена и тестовые отправки из админ-экрана.
- Регистрация/фиксация webhook.
- Функции отправки сообщений, reminders, webhook/poller/debug.
- Привязка Telegram к пользователям через профиль.

Код:
- `src/pages/TelegramSettings.jsx`
- `src/pages/Profile.jsx`
- `base44/functions/sendTelegramMessage/entry.ts`
- `base44/functions/registerTelegramWebhook/entry.ts`
- `base44/functions/fixWebhook/entry.ts`
- `base44/functions/telegramWebhook/entry.ts`
- `base44/functions/telegramPoller/entry.ts`

## 7. Материалы

Статус: `Реализовано`

- Библиотека материалов и курсов (Windows-like browser).
- CRUD материалов/курсов, drag-and-drop, copy/cut/paste.
- Выдача/отзыв доступа к материалам (в т.ч. массово), управление правами.
- Просмотр доступных материалов студентом.
- Поддержка `file_url`, `file_type`, названия/описания.

Код:
- `src/components/materials/WindowsFileBrowser.jsx`
- `src/pages/MaterialsHub.jsx`
- `src/pages/AdminLessonMaterials.jsx`
- `src/pages/StudentLessonMaterials.jsx`
- `src/lib/materialAccess.js`
- `src/components/materials/GrantAccessModal.jsx`
- `src/components/materials/BulkAccessModal.jsx`
- `src/components/materials/AccessControlModal.jsx`

## 8. Группы

Статус: `Частично`

- В уроках поддерживаются `student_ids` для групповых сценариев.
- Явного отдельного модуля «группы» (CRUD групп как самостоятельной сущности) в коде не зафиксировано.

Код:
- `src/pages/Schedule.jsx`
- `src/pages/TeacherDashboard.jsx`

## 9. Модуль тестирования (LMS tests)

Статус: `Не реализовано`

- В кодовой базе не найдена реализация сущностей/экранов/логики тестирования по модели `Test -> Blocks -> Variants -> Groups -> Questions`.

Проверка:
- поиск по `src/*`, `base44/functions/*` (нет доменных сущностей/страниц тестирования).

## 10. Аналитика

Статус: `Реализовано`

- Метрики выручки, активности, загрузки преподавателей.
- График выручки по месяцам.
- Экспорт CSV.

Код:
- `src/pages/Analytics.jsx`
- `src/pages/Salary.jsx`
- `src/pages/ExportData.jsx`

## 11. Миграция и тестирование

Статус: `Частично`

- Есть функция экспорта бэкапа.
- Явного модуля миграции расписания из Excel не выявлено.
- Автоматизированные сценарии тестирования по требованиям ТЗ в коде не зафиксированы.

Код:
- `base44/functions/exportBackup/entry.ts`
- `src/pages/Settings.jsx` (вызов `exportBackup`)

## 12. Ограничения и безопасность

Статус: `Частично`

Что есть:
- Контроль ролей в UI/доступах.
- Частично enforced-логика через serverless (`asServiceRole`, webhook/checksums).
- Проверка прав по материалам (admin/teacher policy).

Риски/пробелы:
- Часть критичных бизнес-правил реализована на фронте (баланс, статусы), а не только на backend-функциях.
- Есть прямые вызовы Telegram API из клиентского UI (`TelegramSettings.jsx`).

Код:
- `src/lib/AuthContext.jsx`
- `src/lib/materialAccess.js`
- `base44/functions/alfaBankWebhook/entry.ts`
- `src/pages/TelegramSettings.jsx`

## 13. Нефункциональные требования

Статус: `Частично`

- Адаптивный UI и современная компонентная структура присутствуют.
- Минималистичный дизайн в целом соблюдён.
- Формальных метрик производительности/нагрузочного профиля в репозитории нет.

Код:
- `src/pages/*`
- `src/components/*`

---

## Короткое резюме для следующего шага (gap-analysis)

- Сильные зоны: пользователи/роли, расписание базового уровня, материалы, Telegram, аналитика.
- Основные гэпы к ТЗ: модуль тестирования, формализация групп, строгие правила отмены учеником, единая серверная модель биллинга без ручных начислений.
- Технический долг: унификация статусов уроков (`missed_no_notice` vs `missed_without_notice`) и перенос критичных правил из UI в backend-функции.
