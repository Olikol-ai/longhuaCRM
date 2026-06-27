# Технические спецификации этапов рефакторинга

Подробные spec-документы для каждого этапа из [refactor-roadmap.md](../refactor-roadmap.md).

| Spec | Этап | Файл roadmap |
|------|------|--------------|
| [01-database-spec.md](./01-database-spec.md) | PostgreSQL schema | [01-database.md](../01-database.md) |
| [02-domain-spec.md](./02-domain-spec.md) | Mapper, Entity, Relations | [02-domain.md](../02-domain.md) |
| [03-services-spec.md](./03-services-spec.md) | Typed domain services | [03-services.md](../03-services.md) |
| [04-api-spec.md](./04-api-spec.md) | Typed API + RBAC | [04-api.md](../04-api.md) |
| [05-frontend-spec.md](./05-frontend-spec.md) | Frontend migration | [05-frontend.md](../05-frontend.md) |
| [06-telegram-spec.md](./06-telegram-spec.md) | Telegram module | [06-telegram.md](../06-telegram.md) |
| [07-testing-spec.md](./07-testing-spec.md) | Testing strategy | [07-testing.md](../07-testing.md) |
| [08-final-cleanup-spec.md](./08-final-cleanup-spec.md) | Legacy cleanup | [08-final-cleanup.md](../08-final-cleanup.md) |

**Правило:** перед работой по этапу читать только соответствующий spec + audit-файлы из [docs/audit/](../../audit/).
