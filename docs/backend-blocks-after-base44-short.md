# Backend-блоки после ухода от Base44 (кратко)

## 1. API Gateway / Backend API
- Единая точка входа для фронта (React)
- REST/GraphQL endpoints
- Валидация запросов и версия API

## 2. Auth & Identity
- Регистрация/логин/refresh
- RBAC (admin/teacher/student)
- Профили и привязка внешних идентификаторов (в т.ч. Telegram)

## 3. User Domain
- Управление пользователями, студентами, преподавателями
- Связи user <-> teacher/student
- Статусы активности и lifecycle пользователей

## 4. Scheduling Domain
- Слоты, уроки, повторяющиеся серии
- Правила статусов уроков
- Календарные ограничения (выходные/праздники)

## 5. Billing & Payments
- Баланс занятий как серверный ledger
- Платёжные провайдеры (Alfa Bank и др.)
- Webhook processing, идемпотентность, аудит

## 6. Materials Domain
- Каталог курсов и материалов
- ACL/доступ к материалам
- Версионирование метаданных материалов

## 7. Groups Domain
- Группы, membership, привязка к занятиям
- Массовые операции по группам

## 8. Notifications Domain
- Telegram/Email/SMS адаптеры
- Шаблоны уведомлений
- Очередь, ретраи, отложенные рассылки

## 9. Testing/LMS Domain
- Тесты, блоки, варианты, вопросы
- Попытки, проверка результатов, пороги сдачи

## 10. Analytics & Reporting
- Метрики выручки, загрузки, активности
- Выгрузки и отчёты
- Отделение OLTP и аналитических запросов

## 11. File Storage Service
- Хранение файлов материалов
- Подписи URL / access policies
- Очистка/архивация

## 12. Data Layer
- Основная БД (PostgreSQL)
- Миграции схемы
- Транзакции, блокировки, индексы

## 13. Background Jobs / Scheduler
- Cron-задачи (reminders, автостатусы)
- Worker-процессы и очереди

## 14. Integration Layer
- Внешние API (платежи, Telegram и др.)
- Антикоррупционный слой (адаптеры)
- Secrets/config management

## 15. Observability & Operations
- Централизованные логи
- Метрики и алерты
- Трейсинг, health checks, runbooks

## 16. Security & Compliance
- Политики доступа и аудит действий
- Rate limit, anti-spam, abuse protection
- Резервное копирование и disaster recovery
