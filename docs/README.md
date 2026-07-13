# LonghuaCRM Documentation

Индекс документации проекта. Описывает **текущее состояние** кодовой базы (ветка `refactor/nestjs`, июль 2026).

## Основные документы

| Документ | Назначение |
|----------|------------|
| [Architecture.md](./Architecture.md) | Архитектура, модули, потоки данных |
| [Database.md](./Database.md) | PostgreSQL, 28 entities, 8 migrations |
| [Backend.md](./Backend.md) | NestJS API, паттерны, cron, middleware |
| [Frontend.md](./Frontend.md) | React SPA, маршруты, API-клиент |
| [frontend-routing.md](./frontend-routing.md) | Детали маршрутизации (App.jsx, pages.config) |
| [API.md](./API.md) | Полный справочник REST endpoints |
| [BusinessLogic.md](./BusinessLogic.md) | Бизнес-процессы школы |
| [Environment.md](./Environment.md) | Переменные окружения (см. `.env.example`) |
| [Development.md](./Development.md) | Локальная разработка, npm-скрипты |
| [Deployment.md](./Deployment.md) | Production-деплой, Docker, nginx |
| [Production-Readiness.md](./Production-Readiness.md) | Оценка готовности к эксплуатации |
| [Release-Checklist.md](./Release-Checklist.md) | Чеклист релиза |
| [Technical-Debt.md](./Technical-Debt.md) | Осознанный технический долг |

## Быстрые факты

| Параметр | Значение |
|----------|----------|
| API prefix | `/api` |
| Dev frontend | `:5173` (Vite proxy) |
| Dev API | `:3001` |
| Entities | 28 в `entity-registry.ts` |
| Migrations | 8 в `apps/api/src/database/migrations/` |
| API e2e | 36 tests / 9 suites |
| Browser e2e | 8 Playwright specs |
| Upload | `POST /api/files/upload`, 50 MB, admin |
| Cron env | `ENABLE_CRON` (default true) |

## Исторические материалы (не дублировать)

| Путь | Примечание |
|------|------------|
| `docs/domain/` | Заметки по отдельным сущностям |
| `docs/architecture/` | Планы миграции v2 |
| `docs/roadmap/` | Roadmap рефакторинга |
| `docs/system-audit-report.md` | Завершённый аудит — **не расширять** |

## Версионирование

- Схема БД: только TypeORM migrations
- Релиз: [Release-Checklist.md](./Release-Checklist.md)
- Откат: `migration:revert` или restore из backup
