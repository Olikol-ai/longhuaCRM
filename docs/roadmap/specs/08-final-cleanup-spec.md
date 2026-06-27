# Спецификация этапа 8: Final Cleanup

**Roadmap:** [08-final-cleanup.md](../08-final-cleanup.md)  
**Предшественник:** [04-api-spec.md](./04-api-spec.md) + [05-frontend-spec.md](./05-frontend-spec.md)  
**Следующий:** — (Definition of Done всего рефакторинга)  
**Аудит:** [entities.md](../../audit/entities.md), [api.md](../../audit/api.md), [frontend.md](../../audit/frontend.md), [database.md](../../audit/database.md)  
**Трудоёмкость:** 20–28 ч

---

## Цель этапа

Удалить JSON/legacy артефакты; завершить реляционное моделирование (**TeacherAvailability slots**, **balance unification**); привести кодовую базу к Definition of Done рефакторинга. Сохранить бизнес-логику; **запрещено** вводить `json_record` / JSON-хранилище для стабильных сущностей.

**Включает:** бывший «этап 9 plan» — slots + balance в одном финальном этапе.

---

## Предусловия (gate checklist)

Выполнить **до** любого удаления:

```bash
# 1. Frontend off generic entities
rg "base44\.entities" src --count
# TARGET: 0 (сейчас ~40 файлов, ~200+ вхождений)

# 2. Typed services in use
rg "EntityRepositoryService" apps/api/src --count
# TARGET: 0 imports outside deleted files

# 3. v2 API covers all pages
# Manual: Schedule, Payments, UserManagement, Materials, Settings, TelegramSettings

# 4. Full backup
npm run migration:run --prefix apps/api
# pg_dump production before balance/slots migrations

# 5. Tests green
npm run test --prefix apps/api
npm run test:e2e --prefix apps/api
```

| Gate | Блокирует |
|------|-----------|
| `base44.entities` = 0 в `src/` | Delete `/api/entities/*`, `base44/` |
| Этап 5 frontend complete | Delete legacy module |
| ADR-003 signed | Drop `lesson_balances` |
| Slot entity + UI tested | DROP `slots` jsonb column |
| `npm run build` OK | Deploy |

---

## Архитектура (текущее legacy)

```
AppModule (app.module.ts:54-64)
├── EntitiesModule (entities.module.ts:25-50)
│   ├── EntitiesController (entities.controller.ts:29-123)
│   └── EntityRepositoryService (entity-repository.service.ts:48-218)
├── LegacyModule (legacy.module.ts:4-7)
│   └── LegacyController (legacy.controller.ts:3-9)
└── ... typed modules (post этапы 3-5)

Frontend:
src/api/base44Client.js (144 строки)
  └── createEntityClient → /api/entities/:entity (строки 36-72)

Common:
apps/api/src/common/utils/record.util.ts (52 строки)

Database:
apps/api/src/database/scripts/import-json.ts (144 строки)

Repo root:
base44/ (29 файлов — entities JSON Schema + Deno functions)

Dead / inconsistent:
apps/api/src/entities/json-record.entity.ts — удалён с диска (refactor-plan §4.20)
EntityRepositoryService всё ещё использует row.data (строки 104, 152, 184) при typed Entity columns
```

### Целевая архитектура (после этапа 8)

```
AppModule
├── v2 modules only (students, lessons, teachers, ...)
├── NO EntitiesModule
├── NO LegacyModule
└── NO import-json script

StudentEntity.lessonBalance  ← единственный source of truth
TeacherAvailabilityEntity
  └── @OneToMany TeacherAvailabilitySlotEntity

grep "json_record|row\.data|data jsonb|base44\.entities" → 0
```

---

## Часть A: Legacy cleanup — спецификация удаления

### A.1 `EntityRepositoryService` — DELETE

**Файл:** `apps/api/src/modules/entities/entity-repository.service.ts` (218 строк)

| Строки | Содержание | Причина удаления |
|--------|------------|------------------|
| 28-45 | `ENTITY_CLASS_MAP` | Дублирует TypeORM repos в domain modules |
| 48-86 | constructor + repoMap | God Object |
| 88-90 | `isKnownEntity` | Перенести в constants если нужно |
| 92-110 | `list` — `...r.data` | Legacy jsonb path (строка 104) |
| 132-136 | `filter` — equality only | Заменён typed queries |
| 158-176 | `create` — `data: input` | Legacy |
| 178-188 | `update` — `row.data` merge | Legacy |
| 205-211 | `deleteRecordById` — scan all tables | Заменён MaterialAccessService |

**Текущие importers (удалить до DELETE):**

| Модуль | Файл | Строка |
|--------|------|--------|
| Entities | `entities.module.ts` | 23, 48-49 |
| Entities | `entities.controller.ts` | 27, 31 |
| Jobs | `jobs.service.ts` | 5, 11 |
| Settings | `settings.service.ts` | 3, 8 |
| AlfaBank | `alfabank.service.ts` | import ERS |
| App | `app.module.ts` | 55 (EntitiesModule) |

**Проверка после удаления:**

```bash
rg "EntityRepositoryService|entity-repository.service" apps/api/src
# expect 0
```

---

### A.2 `EntitiesController` — DELETE

**Файл:** `apps/api/src/modules/entities/entities.controller.ts` (123 строки)

| Route | Метод | Строки | Auth |
|-------|-------|--------|------|
| `GET /api/entities/:entity` | list/filter | 33-59 | OptionalJwt |
| `POST /api/entities/:entity/filter` | filter body | 61-69 | JwtAuthGuard |
| `POST /api/entities/:entity` | create/bulk | 71-84 | JwtAuthGuard |
| `PATCH /api/entities/:entity/:id` | update | 86-95 | JwtAuthGuard |
| `DELETE /api/entities/:entity/:id` | delete | 97-108 | JwtAuthGuard |

**Публичное чтение:** только `WelcomePageSettings` (`entity-names.ts:22-24`, controller `118-121`).

**Проверка:**

```bash
rg "@Controller\('entities'\)" apps/api/src
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/entities/Student
# expect 404
```

---

### A.3 `EntitiesModule` — REMOVE or EMPTY

**Файл:** `apps/api/src/modules/entities/entities.module.ts` (51 строка)

**Действие:** удалить файл и import из `app.module.ts:12, 55`.

**TypeOrmModule.forFeature([...])` (строки 28-45):** сущности уже зарегистрированы в domain modules — перенос не нужен.

---

### A.4 `record.util.ts` — DELETE (conditional)

**Файл:** `apps/api/src/common/utils/record.util.ts` (52 строки)

| Функция | Строки | Единственный caller |
|---------|--------|---------------------|
| `recordFromEntity` | 5-18 | `user.mapper.ts:2` |
| `matchesFilter` | 27-37 | тесты / удалить с entities |
| `splitRecordPayload` | 20-25 | grep before delete |
| `sortRecords` | 40-51 | grep before delete |
| `nowIso` | 1-3 | grep before delete |

**План:**

1. Inline `recordFromEntity` logic в `user.mapper.ts` OR keep minimal mapper-only util
2. `rg "record\.util|recordFromEntity|matchesFilter|splitRecordPayload|sortRecords" apps/api/src`
3. DELETE file if 0 imports

---

### A.5 `import-json.ts` — DELETE

**Файл:** `apps/api/src/database/scripts/import-json.ts` (144 строки)

| Секция | Строки | Описание |
|--------|--------|----------|
| ENTITY_REPO_MAP | 26-43 | 16 entity classes |
| import users | 66-91 | UserEntity direct save |
| import records | 96-134 | generic loop `store.records` |
| CLI | 46-49 | `IMPORT_JSON_PATH` or `server/data/database.json` |

**Также удалить:**

| Файл | Строка | Содержание |
|------|--------|------------|
| `apps/api/package.json` | 13 | `"import:json": "ts-node ..."` |

**Проверка:** one-time migration completed; `database.json` archived externally.

---

### A.6 `LegacyModule` — DELETE

**Файл:** `apps/api/src/modules/legacy/legacy.controller.ts` (9 строк)

```typescript
@Controller('apps/public/prod/public-settings/by-id')
@Get('longhua-crm')
// return { id: 'longhua-crm', public_settings: { auth_required: true } }
```

**Назначение:** Base44 compat path для старого frontend bootstrap.

**Файл:** `apps/api/src/modules/legacy/legacy.module.ts` (7 строк)

**Удалить:** оба файла + `app.module.ts:16, 64`.

**Проверка:**

```bash
rg "apps/public/prod/public-settings" src apps/api
# expect 0
```

---

### A.7 `json-record.entity.ts` — finalize git deletion

**Статус:** файл отсутствует на диске (`apps/api/src/entities/json-record.entity.ts`); возможно удалён локально, не закоммичен.

**Действие:** `git rm` если tracked; убедиться нет imports:

```bash
rg "json-record|JsonRecordEntity" apps/api/src
```

---

### A.8 Папка `base44/` — DELETE or ARCHIVE

**Структура (29 файлов):**

```
base44/
├── entities/                    # 17 × *.jsonc — JSON Schema definitions
│   ├── Student.jsonc
│   ├── Teacher.jsonc
│   ├── Lesson.jsonc
│   ├── Payment.jsonc
│   ├── Course.jsonc
│   ├── LessonMaterial.jsonc
│   ├── ScheduleSlot.jsonc
│   ├── LessonStudent.jsonc
│   ├── LessonBalance.jsonc      # balance model reference
│   ├── TeacherPayment.jsonc
│   ├── MaterialAccess.jsonc
│   ├── TeacherAvailability.jsonc  # slots jsonb schema
│   ├── AlfaBankOrder.jsonc
│   ├── User.jsonc
│   └── (Shop/Course variants)
└── functions/                   # 15 × entry.ts — Deno edge (NOT runtime)
    ├── telegramWebhook/
    ├── registerTelegramWebhook/
    ├── telegramPoller/
    ├── sendTelegramMessage/
    ├── clearTelegramUpdates/
    ├── fixWebhook/
    ├── checkBotInfo/
    ├── tgDebug/
    ├── sendLessonReminders/
    ├── sendLessonReminders2h/
    ├── autoCompleteExpiredLessons/
    ├── alfaBankInit/
    ├── alfaBankWebhook/
    ├── checkPaymentStatus/
    ├── exportBackup/
    └── revokeAllAccess/
```

**Рекомендация:** `git mv base44/ docs/archive/base44/` (сохранить историю схем) ИЛИ полный DELETE если audit docs достаточно.

**Проверка:**

```bash
rg "base44/" apps/api src --glob "!docs/**"
# expect 0 runtime imports
```

---

### A.9 `base44Client.js` — DELETE or gut

**Файл:** `src/api/base44Client.js` (144 строки)

| Секция | Строки | Замена |
|--------|--------|--------|
| `createEntityClient` | 36-72 | typed API clients (`src/api/v2/`) |
| `ENTITY_NAMES` | 75-81 | удалить |
| `entities` factory | 83-86 | удалить |
| `base44.auth` | 89-131 | `authClient.js` (уже на `/api/auth/*`) |
| `base44.functions` | 134-141 | `functionsClient.js` или прямые fetch |

**Импортируют base44Client (47 файлов):** grep `from "@/api/base44Client"` — все должны мигрировать на этапе 5.

---

### A.10 Dead entities (опционально)

| Entity | Файл | Проблема | Действие |
|--------|------|----------|----------|
| `ShopEntity` | `entities/Shop.entity.ts` | не в ALL_ENTITIES | DELETE |
| `WelcomePageEntity` | `entities/WelcomePage.entity.ts` | дублирует WelcomePageSettingEntity | DELETE |
| `ShopSettingEntity` | активна | заменена ShopItemEntity (этап 2b) | DROP table after migration |

---

### A.11 `app.module.ts` — cleanup imports

**Файл:** `apps/api/src/app.module.ts`

| Строка | Удалить |
|--------|---------|
| 12 | `import { EntitiesModule }` |
| 16 | `import { LegacyModule }` |
| 55 | `EntitiesModule,` |
| 64 | `LegacyModule,` |

---

## Часть B: TeacherAvailability slots migration

### B.1 Текущее состояние

**Entity:** `apps/api/src/entities/TeacherAvailability.entity.ts` (38 строк)

| Поле | Строки | Тип |
|------|--------|-----|
| `teacherId` | 15-17 | uuid column |
| `slots` | 26-31 | **jsonb array** `{ day, from, to }[]` |

**Base44 schema:** `base44/entities/TeacherAvailability.jsonc:9-28` — тот же shape.

**Frontend:** `src/components/schedule/TeacherAvailabilityTab.jsx`

| Операция | Строки | API |
|----------|--------|-----|
| load | 27-38 | `TeacherAvailability.filter({ teacher_id })` → `records[0].slots` |
| save flatSlots | 65-78 | `update(id, { slots: flatSlots })` или `create({ teacher_id, slots })` |
| day index | 32-35 | `slot.day` 0=Mon … 6=Sun (`DAYS` array строка 6) |

**Таблица БД:** `teacher_availability` (Entity) vs `teacher_availabilities` (migration map `entity-names.ts:39`) — **разрешить имя** в миграции этапа 1/8.

---

### B.2 Целевая модель

**Новый файл:** `apps/api/src/entities/TeacherAvailabilitySlot.entity.ts`

```typescript
@Entity('teacher_availability_slots')
export class TeacherAvailabilitySlotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TA_SLOT_AVAILABILITY_ID')
  @Column({ name: 'teacher_availability_id', type: 'uuid' })
  teacherAvailabilityId: string;

  @ManyToOne(() => TeacherAvailabilityEntity, (a) => a.slots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_availability_id' })
  teacherAvailability: TeacherAvailabilityEntity;

  @Column({ type: 'smallint' })  // 0=Mon .. 6=Sun
  day: number;

  @Column({ type: 'time' })
  from: string;  // HH:MM — column name quoted or `time_from`

  @Column({ type: 'time' })
  to: string;    // `time_to`
}
```

**Изменить `TeacherAvailability.entity.ts`:**

- Удалить `@Column jsonb slots` (строки 26-31)
- Добавить `@OneToMany(() => TeacherAvailabilitySlotEntity, (s) => s.teacherAvailability) slots: TeacherAvailabilitySlotEntity[]`

---

### B.3 Миграция `1730000000006-TeacherAvailabilitySlots.ts`

```sql
-- UP
CREATE TABLE teacher_availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_availability_id UUID NOT NULL
    REFERENCES teacher_availability(id) ON DELETE CASCADE,
  day SMALLINT NOT NULL CHECK (day >= 0 AND day <= 6),
  time_from TIME NOT NULL,
  time_to TIME NOT NULL,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ta_slot_availability_id
  ON teacher_availability_slots(teacher_availability_id);

-- Migrate from jsonb (adjust table name if teacher_availabilities)
INSERT INTO teacher_availability_slots
  (teacher_availability_id, day, time_from, time_to, created_date, updated_date)
SELECT
  ta.id,
  (elem->>'day')::smallint,
  (elem->>'from')::time,
  (elem->>'to')::time,
  ta.created_date,
  ta.updated_date
FROM teacher_availability ta
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ta.slots, '[]'::jsonb)) AS elem
WHERE ta.slots IS NOT NULL AND jsonb_array_length(ta.slots) > 0;

-- Verify row count
-- SELECT COUNT(*) FROM teacher_availability_slots;

ALTER TABLE teacher_availability DROP COLUMN slots;

-- DOWN (manual plan)
-- ALTER TABLE teacher_availability ADD COLUMN slots JSONB;
-- aggregate slots back; DROP TABLE teacher_availability_slots;
```

**Pre-migration backup:**

```sql
COPY (
  SELECT id, teacher_id, slots::text
  FROM teacher_availability
  WHERE slots IS NOT NULL
) TO '/tmp/ta_slots_backup.csv' CSV HEADER;
```

---

### B.4 API (v2)

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/v2/teachers/:teacherId/availability` | availability header + nested slots |
| PUT | `/api/v2/teachers/:teacherId/availability/slots` | replace all slots (transaction) |
| POST | `/api/v2/teachers/:teacherId/availability/slots` | add single slot |
| DELETE | `/api/v2/teachers/:teacherId/availability/slots/:slotId` | remove slot |

**Response shape (совместимость с UI):**

```json
{
  "id": "uuid",
  "teacher_id": "uuid",
  "slots": [
    { "day": 0, "from": "10:00", "to": "12:00" }
  ]
}
```

Mapper собирает `slots` из `@OneToMany` — **frontend `TeacherAvailabilityTab.jsx` менять минимально** (только API client).

---

### B.5 Frontend changes

| Файл | Строки | Изменение |
|------|--------|-----------|
| `TeacherAvailabilityTab.jsx` | 27-28 | v2 API вместо `base44.entities.TeacherAvailability` |
| `TeacherAvailabilityTab.jsx` | 73-77 | PUT slots endpoint |
| `TeacherAvailabilityView.jsx` | load | read-only v2 |
| `TeacherSchedule.jsx` | availability read | v2 |

**Проверка:** save weekly schedule → reload → slots identical.

---

## Часть C: Balance unification (ADR-003)

### C.1 Текущее дублирование

| Источник | Поле | Файл |
|----------|------|------|
| `StudentEntity` | `lessonBalance` / `lesson_balance` | `Student.entity.ts:40-41` |
| `LessonBalanceEntity` | `lessonsAvailable`, `lessonsUsed` | `LessonBalance.entity.ts:19-23` |
| Base44 schema | `lessons_available`, `lessons_used` | `base44/entities/LessonBalance.jsonc` |

**Frontend использует только `student.lesson_balance`** — grep ~30 файлов в `src/`; `LessonBalance` entity client в `base44Client.js:78` но UI не primary.

**Серверные writers баланса:**

| Writer | Файл | Строки | Логика |
|--------|------|--------|--------|
| AlfaBank webhook | `alfabank.service.ts` | 123-124 | `lesson_balance += lessons_added` |
| Manual payment UI | `Payments.jsx` | 43-48, 36-38, 60+ | client-side `Student.update` |
| Lesson complete UI | `Schedule.jsx` | 86 | `-1` client-side |
| Teacher complete | `TeacherDashboard.jsx` | 58-59 | `-1` client-side |
| Teacher schedule | `TeacherSchedule.jsx` | 107-108 | `-1` client-side |
| Jobs 24h reminder | `jobs.service.ts` | 86 | read-only display |
| Telegram test template | `TelegramSettings.jsx` | 76 | read `lesson_balance` |

---

### C.2 Решение ADR-003

**Source of truth:** `StudentEntity.lessonBalance` (column `students.lesson_balance`).

**`LessonBalanceEntity`:** deprecate → migrate data → drop table `lesson_balances`.

**Единая точка записи:** `StudentsService.adjustBalance(studentId, delta, reason, metadata?)` в транзакции.

```typescript
async adjustBalance(studentId: string, delta: number, reason: BalanceAdjustmentReason) {
  return this.dataSource.transaction(async (em) => {
    const student = await em.findOne(StudentEntity, {
      where: { id: studentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!student) throw new NotFoundException();
    const next = Math.max(0, student.lessonBalance + delta);
    student.lessonBalance = next;
    await em.save(student);
    // optional: balance_audit_log table (P2)
    return student;
  });
}
```

**Callers перевести на adjustBalance:**

| Caller | Было | Станет |
|--------|------|--------|
| AlfaBankService.handleWebhook | direct update | `studentsService.adjustBalance(+lessonsAdded)` |
| PaymentsService.create/update/delete | — | adjustBalance в той же TX что Payment |
| LessonsService.complete / miss | — | adjustBalance(-1) |
| Frontend Payments.jsx | dual write | только PaymentsService API |
| Frontend Schedule/TeacherDashboard | client `-1` | LessonsService status endpoint |

---

### C.3 Миграция `1730000000007-UnifyBalance.ts`

```sql
-- UP
-- 1. Reconcile: for each lesson_balances row, set students.lesson_balance
--    IF lesson_balances.lessons_available differs from students.lesson_balance, log conflict

UPDATE students s
SET lesson_balance = GREATEST(0, lb.lessons_available)
FROM lesson_balances lb
WHERE lb.student_id = s.id
  AND (s.lesson_balance IS NULL OR s.lesson_balance = 0)
  AND lb.lessons_available > 0;

-- 2. Conflict report (run manually before apply)
SELECT s.id, s.name, s.lesson_balance, lb.lessons_available, lb.lessons_used
FROM students s
JOIN lesson_balances lb ON lb.student_id = s.id
WHERE s.lesson_balance != lb.lessons_available;

-- 3. Policy: prefer students.lesson_balance if both non-zero (document in ADR)

-- 4. Drop lesson_balances
DROP TABLE IF EXISTS lesson_balances;

-- DOWN
-- Recreate lesson_balances from students.lesson_balance (loss of lessons_used history)
```

**Удалить после миграции:**

| Файл | Действие |
|------|----------|
| `LessonBalance.entity.ts` | DELETE |
| `entity-names.ts` | remove `'LessonBalance'` |
| `crm.entities.ts` | remove export |
| `base44Client.js` | remove LessonBalance client |
| Domain module | remove LessonBalance repository |

---

### C.4 Telegram / notifications

После unification текст сообщений использует `student.lessonBalance` из единого источника:

| Место | Строка | Поле |
|-------|--------|------|
| `jobs.service.ts` | 86 | `student.lesson_balance` в API record |
| `alfabank.service.ts` | 127 | `newBalance` после adjustBalance |
| `TelegramSettings.jsx` | 76 | preview template |

**Тест:** payment + lesson complete → один баланс в UI и TG message.

---

### C.5 Frontend balance cleanup

| Файл | Строки | Удалить client-side math |
|------|--------|--------------------------|
| `Payments.jsx` | 28-53, 55-62 | `Student.update lesson_balance` |
| `PaymentFormDialog.jsx` | 86 | balance bump |
| `Schedule.jsx` | 86 | `-1` on complete |
| `TeacherDashboard.jsx` | 58-59 | `-1` |
| `TeacherSchedule.jsx` | 107-108 | `-1` |

**Заменить на:** API response возвращает обновлённый `lesson_balance` после server-side adjustment.

---

## Часть D: Documentation

| Файл | Изменение |
|------|-----------|
| `README.md` | architecture без base44; migration commands; env vars |
| `docs/refactor-roadmap.md` | mark stage 8 complete |
| `docs/audit/*.md` | archive note |

---

## Полная таблица DELETE

| # | Path | Lines | Replacement | Verify command |
|---|------|-------|-------------|----------------|
| 1 | `modules/entities/entity-repository.service.ts` | 218 | domain services | `rg EntityRepositoryService` |
| 2 | `modules/entities/entities.controller.ts` | 123 | v2 controllers | no /entities routes |
| 3 | `modules/entities/entities.module.ts` | 51 | — | app bootstrap |
| 4 | `common/utils/record.util.ts` | 52 | user.mapper inline | `rg record.util` |
| 5 | `database/scripts/import-json.ts` | 144 | — | no import:json script |
| 6 | `modules/legacy/legacy.controller.ts` | 9 | — | `rg LegacyController` |
| 7 | `modules/legacy/legacy.module.ts` | 7 | — | `rg LegacyModule` |
| 8 | `entities/json-record.entity.ts` | — | git rm | `rg JsonRecord` |
| 9 | `base44/` | 29 files | `docs/archive/` or delete | `rg base44/` |
| 10 | `src/api/base44Client.js` | 144 | v2 clients | `rg base44Client` |
| 11 | `LessonBalance.entity.ts` | 30 | Student.lessonBalance | table dropped |
| 12 | `entities/Shop.entity.ts` | dead | ShopItemEntity | grep ShopEntity |
| 13 | `entities/WelcomePage.entity.ts` | dead | WelcomePageSettingEntity | grep |

---

## API changes (summary)

| Removed | Added / kept |
|---------|--------------|
| `GET/POST/PATCH/DELETE /api/entities/*` | `/api/v2/*` |
| `GET /apps/public/prod/public-settings/by-id/longhua-crm` | removed |
| — | `GET/PUT /api/v2/teachers/:id/availability/slots` |
| — | `POST /api/v2/payments` (server balance adjust) |
| — | `PATCH /api/v2/lessons/:id/status` (server balance adjust) |

---

## Риски

| Риск | Вероятность | Impact | Митигация |
|------|-------------|--------|-----------|
| Delete API before frontend migration | High | Outage | `rg base44.entities = 0` gate |
| slots migration data loss | Medium | Wrong schedule | jsonb backup + COUNT verify |
| balance conflict lesson_balances vs students | Medium | Wrong balance | pre-migration conflict SQL |
| Missed EntityRepository import | Medium | Build fail | grep + build |
| TeacherAvailability table name mismatch | Medium | Migration fail | align migration 1 + 8 |

---

## Tests (этап 8)

| Test | File | Assert |
|------|------|--------|
| Slots round-trip | `teacher-availability.e2e-spec.ts` | PUT 3 slots → GET same |
| Slots migration | `migration.spec.ts` | jsonb count = relational count |
| Balance single source | `students.service.spec.ts` | payment + lesson = correct balance |
| No legacy routes | `smoke.e2e-spec.ts` | /entities/Student → 404 |
| Grep gate | CI script | legacy patterns = 0 |

---

## Checklist

### Часть A — Legacy
- [ ] `rg base44.entities src` = 0
- [ ] DELETE EntityRepositoryService + EntitiesController + EntitiesModule
- [ ] DELETE record.util.ts (after user.mapper refactor)
- [ ] DELETE import-json.ts + package.json script
- [ ] DELETE LegacyModule
- [ ] git rm json-record.entity.ts if tracked
- [ ] DELETE or archive base44/
- [ ] DELETE or gut base44Client.js
- [ ] app.module.ts — remove Entities + Legacy imports

### Часть B — Slots
- [ ] Create TeacherAvailabilitySlotEntity
- [ ] Migration 1730000000006 up/down tested
- [ ] v2 availability API
- [ ] TeacherAvailabilityTab on v2
- [ ] DROP slots jsonb column

### Часть C — Balance
- [ ] StudentsService.adjustBalance transactional
- [ ] All writers migrated (AlfaBank, Payments, Lessons)
- [ ] Frontend client-side balance math removed
- [ ] Migration 1730000000007 + DROP lesson_balances
- [ ] DELETE LessonBalanceEntity
- [ ] TG messages show unified balance

### Финал
- [ ] `rg "json_record|JsonRecord|row\.data|data jsonb|base44\.entities" apps/api/src src` = 0
- [ ] README updated
- [ ] `npm run build` OK (api + frontend)
- [ ] `npm run test` + `npm run test:e2e` OK

---

## Definition of Done

1. `grep json_record|row\.data|data jsonb` в `apps/api/src` = **0**
2. `/api/entities/:entity` **удалён**
3. `base44/` **удалён** или в `docs/archive/base44/`
4. `TeacherAvailability.slots` — relational `teacher_availability_slots`
5. Balance — **single source** `students.lesson_balance`
6. `lesson_balances` table **dropped**
7. README обновлён
8. `npm run build` OK
9. Integration tests green
10. Новый разработчик может onboard без знания Base44

---

## Запрещено до этапа 8

| Action | Blocked until |
|--------|---------------|
| Delete EntityRepositoryService | Этап 5 frontend complete |
| Delete /entities routes | `rg base44.entities = 0` |
| Drop lesson_balances | ADR-003 + conflict SQL + data migration |
| Drop slots jsonb | Slot entity + UI tested on staging |
| Delete base44/ | NestJS parity verified |

---

## Порядок реализации

1. **Gate:** frontend migration complete (`base44.entities` = 0)  
2. **Balance:** StudentsService.adjustBalance + migrate writers (Payments, AlfaBank, Lessons)  
3. **Balance migration:** 1730000000007 + drop LessonBalance entity  
4. **Slots:** TeacherAvailabilitySlotEntity + migration 1730000000006  
5. **Slots API + UI:** v2 endpoints, TeacherAvailabilityTab  
6. **Delete backend legacy:** EntityRepository → EntitiesController → EntitiesModule  
7. **Delete:** record.util, import-json, LegacyModule  
8. **Delete:** base44/, base44Client.js  
9. **app.module.ts** cleanup  
10. **README** + final grep + full build + e2e  
11. **Optional:** ShopEntity, WelcomePageEntity dead code removal  

---

## Финальная проверка

```bash
# No legacy patterns
rg "json_record|JsonRecord|row\.data|data jsonb|base44\.entities|EntityRepositoryService" apps/api/src src

# Build
npm run build --prefix apps/api
npm run build

# Migrations
npm run migration:run --prefix apps/api

# Tests
npm run test --prefix apps/api
npm run test:e2e --prefix apps/api

# Smoke
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/entities/Student  # 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v2/students -H "Authorization: Bearer $TOKEN"  # 200
```

---

*Документ основан на исходниках по состоянию репозитория; номера строк актуальны для перечисленных файлов.*
