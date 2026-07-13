# LonghuaCRM Documentation

Центральный индекс документации проекта. Аудит системы завершён; этот раздел описывает **эксплуатацию и разработку**, а не поиск новых дефектов.

## Быстрые ссылки

| Документ | Назначение |
|----------|------------|
| [Architecture.md](./Architecture.md) | Архитектура, слои, модули, потоки данных |
| [Database.md](./Database.md) | PostgreSQL, сущности, миграции, целостность |
| [Backend.md](./Backend.md) | NestJS API, модули, паттерны сервисов |
| [Frontend.md](./Frontend.md) | React SPA, маршруты, API-клиент |
| [API.md](./API.md) | REST endpoints и контракты |
| [BusinessLogic.md](./BusinessLogic.md) | Бизнес-процессы школы |
| [Environment.md](./Environment.md) | Переменные окружения |
| [Development.md](./Development.md) | Локальная разработка |
| [Deployment.md](./Deployment.md) | Production-деплой |
| [Production-Readiness.md](./Production-Readiness.md) | Готовность к эксплуатации |
| [Release-Checklist.md](./Release-Checklist.md) | Чеклист релиза |
| [Technical-Debt.md](./Technical-Debt.md) | Осознанный технический долг |

## Дополнительные материалы (исторические)

- `docs/domain/` — доменные заметки по сущностям
- `docs/architecture/` — планы миграции v2
- `docs/system-audit-report.md` — завершённый системный аудит (не расширять)

## Версионирование

- Ветка разработки: `refactor/nestjs`
- Схема БД: только через TypeORM migrations (`npm run migration:run`)
- Релиз: см. [Release-Checklist.md](./Release-Checklist.md)
