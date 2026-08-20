# LonghuaCRM Documentation

Индекс документации проекта. Описывает **текущее состояние** кодовой базы (ветка `refactor/nestjs`, июль 2026).

**Хранение:** CRM и Assessment — реляционные таблицы; **JSONB не используется** для бизнес-сущностей.  
См. [architecture/storage-policy.md](./architecture/storage-policy.md).

## Основные документы

| Документ | Назначение |
|----------|------------|
| [Architecture.md](./Architecture.md) | Архитектура, модули, потоки данных |
| [Database.md](./Database.md) | PostgreSQL, entities, migrations |
| [architecture/storage-policy.md](./architecture/storage-policy.md) | Политика хранения (no business JSONB) |
| [domain/TeacherAvailability.md](./domain/TeacherAvailability.md) | Свободный график → `teacher_availability_slots` |
| [assessment/architecture.md](./assessment/architecture.md) | Assessment + snapshot tables |
| [Backend.md](./Backend.md) | NestJS API, паттерны, cron, middleware |
| [Frontend.md](./Frontend.md) | React SPA, маршруты, API-клиент |
| [frontend-routing.md](./frontend-routing.md) | Детали маршрутизации (App.jsx, pages.config) |
| [architecture/adr-001-primary-client-pwa.md](./architecture/adr-001-primary-client-pwa.md) | ADR: Primary Client = PWA |
| [architecture/design-system-2.0.md](./architecture/design-system-2.0.md) | Design System 2.0 + UI audit |
| [architecture/event-bus.md](./architecture/event-bus.md) | Unified Event Bus (design) |
| [architecture/stage-minus-1-report.md](./architecture/stage-minus-1-report.md) | Stage −1 deliverables report |
| [architecture/stage-0-pwa-preparation.md](./architecture/stage-0-pwa-preparation.md) | Stage 0 — PWA architecture prep (full) |
| [architecture/stage-0-report.md](./architecture/stage-0-report.md) | Stage 0 — executive report |
| [architecture/stage-1-pwa-identity-report.md](./architecture/stage-1-pwa-identity-report.md) | Stage 1 — PWA Identity (PASS) |
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
| Storage | Relational only for business entities (no `data jsonb` / `slots jsonb`) |
| Availability | `teacher_availability_slots` |
| Assessment | `assessment_*` + snapshot tables |
| Upload | `POST /api/files/upload`, signed download |
| Cron env | `ENABLE_CRON` (default true) |

## Исторические материалы (не дублировать / не считать актуальными)

Документы ниже часто упоминают **уже завершённый** переход с JSONB. Они помечены `HISTORICAL / COMPLETED`.

| Путь | Примечание |
|------|------------|
| `docs/domain/` | Заметки по сущностям (см. TeacherAvailability.md — актуален) |
| `docs/architecture/longhua-crm-v2-migration-plan.md` | План миграции v2 — **завершён** |
| `docs/roadmap/`, `docs/roadmap/specs/` | Roadmap рефакторинга — исторический |
| `docs/refactor-plan.md`, `docs/refactor-roadmap.md`, `docs/План.txt` | Планы с `data jsonb` — **не текущая схема** |
| `docs/audit/` | Ранние аудиты — сверять с Database.md |
| `docs/system-audit-report.md` | Завершённый аудит — **не расширять** |

## Версионирование

- Схема БД: только TypeORM migrations
- Релиз: [Release-Checklist.md](./Release-Checklist.md)
- Откат: `migration:revert` или restore из backup
