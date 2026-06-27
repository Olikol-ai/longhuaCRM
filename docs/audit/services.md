# Аудит: Services

## Реестр сервисов

| Сервис | Файл | Модуль | Зависимости |
|--------|------|--------|-------------|
| EntityRepositoryService | `entity-repository.service.ts` | Entities | UsersRepository, 16 repos |
| UsersRepository | `users.repository.ts` | Users | UserEntity |
| AuthService | `auth.service.ts` | Auth | UsersRepository |
| SettingsService | `settings.service.ts` | Settings | EntityRepositoryService |
| AlfaBankService | `alfabank.service.ts` | AlfaBank | EntityRepositoryService, Settings, Telegram |
| JobsService | `jobs.service.ts` | Jobs | EntityRepositoryService, Telegram |
| TelegramService | `telegram.service.ts` | Telegram | SettingsService |
| TelegramWebhookLifecycleService | `telegram-webhook.lifecycle.ts` | Telegram | TelegramService, Config |

## God Objects

### EntityRepositoryService (`entity-repository.service.ts`)

- 218 строк, 16 repositories
- `list`/`getById`/`create`/`update` используют `row.data` (строки 102–107, 150–155, 168–175, 184–187)
- Filter в памяти, без `$contains` (AlfaBank ломается)
- **Заменить:** этапы 2a (fix) → 3 (typed services) → 8 (delete)

## Зависимости EntityRepositoryService

```
EntityRepositoryService
├── EntitiesController (CRUD API)
├── SettingsService (AppSettings filter)
├── AlfaBankService (Payment, ShopSettings, Student, Course)
└── JobsService (Lesson, Student, Teacher, MaterialAccess, backup all)
```

## Проблемы по сервисам

| Сервис | Проблема | Файл:строка |
|--------|----------|-------------|
| AlfaBankService | Старые поля Payment | `alfabank.service.ts:35-43` |
| AlfaBankService | `$contains` filter | `alfabank.service.ts:105-107` |
| AlfaBankService | Не использует AlfaBankOrderEntity | — |
| JobsService | snake_case поля lesson | `jobs.service.ts:35,59,76` |
| JobsService | Все через broken repository | весь файл |
| SettingsService | filter AppSettings через broken layer | `settings.service.ts:16-21` |
| AuthService | UpdateMe позволяет менять role | `update-me.dto.ts:20-22` |

## Целевая структура (этап 3)

```
modules/
  students/     StudentsService + StudentsRepository
  teachers/     TeachersService
  lessons/      LessonsService
  payments/     PaymentsService
  courses/      CoursesService
  materials/    MaterialsService + MaterialAccessService
  schedule/     ScheduleSlotsService
  settings/     SettingsService (typed AppSettings repo)
  shop/         ShopItemsService
```

## SOLID

- **SRP:** нарушен EntityRepositoryService
- **OCP:** новая Entity = 4+ файла
- **DIP:** AlfaBank/Jobs зависят от конкретного God Service
