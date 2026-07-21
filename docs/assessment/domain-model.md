# LongHua Assessment — Domain Model

Status: **implemented** (`1740500000000-AssessmentSchema` + follow-up migrations)  
Module: `apps/api/src/modules/assessment`  
Related: [architecture.md](./architecture.md), [state-machine.md](./state-machine.md), [api-contract.md](./api-contract.md)  
Storage policy: [../architecture/storage-policy.md](../architecture/storage-policy.md)

Snapshot strategy uses **relational tables** (`assessment_question_snapshots`, `assessment_answer_snapshots`, …) — not JSONB documents.

---

## 1. Назначение продукта

LongHua Assessment — bounded context внутри LongHuaCRM для:

- банка вопросов и шаблонов экзаменов;
- генерации конкретных экзаменов по правилам (Blueprint);
- назначения экзаменов аудитории (ученики, группы, курсы, преподаватели, публичные тесты);
- прохождения попыток с неизменяемым **реляционным** снимком содержания;
- **персистентного** хранения итогов (Result не пересчитывается «на лету» как единственный источник правды).

CRM остаётся источником правды о людях, курсах, группах и платежах.

---

## 2. Границы владения данными

### 2.1. Assessment владеет

| Сущность | Таблица | Ответственность |
|----------|--------|-----------------|
| Topic | `assessment_topics` | Таксономия / теги навыков |
| **AssessmentBank** | `assessment_banks` | Контейнер банка вопросов (API `/banks`) |
| Question | `assessment_questions` | Вопрос банка (stem, тип, баллы, сложность) |
| Answer | `assessment_answers` | Варианты / ключи правильных ответов |
| QuestionAttachment | `assessment_question_attachments` | Единые вложения (image/audio/pdf/document) |
| ExamTemplate | `assessment_exam_templates` | Авторский каркас экзамена |
| Blueprint | `assessment_blueprints` | Правила набора вопросов в экзамен |
| BlueprintSectionRule | `assessment_blueprint_section_rules` | Правила + **weight** по разделам |
| AssessmentRule | `assessment_rules` | **Единственное** хранилище правил проведения |
| Exam | `assessment_exams` | Опубликованный экземпляр экзамена |
| Section | `assessment_sections` | Раздел материализованного Exam |
| ExamAssignment | `assessment_exam_assignments` | Кому назначен Exam |
| Attempt | `assessment_attempts` | Одна сдача |
| QuestionSnapshot | `assessment_question_snapshots` | Снимок вопроса на момент Attempt |
| AnswerSnapshot | `assessment_answer_snapshots` | Снимок вариантов ответа |
| AttemptAnswer | `assessment_attempt_answers` | Ответ участника в попытке |
| AttemptAnswerSelection | `assessment_attempt_answer_selections` | Выбранные варианты (нормализованно, не jsonb) |
| Result | `assessment_results` | Полный сохранённый итог попытки |
| ResultBreakdown | `assessment_result_breakdowns` | Разбивка итога по секциям |

### 2.2. CRM владеет (Assessment только ссылается)

| CRM-сущность | Assessment **не** управляет |
|--------------|-----------------------------|
| User | auth, роли, пароли |
| Student | профиль ученика |
| Teacher | профиль преподавателя |
| CourseTemplate (Course) | каталог курсов |
| Group | учебные группы |
| Enrollment | зачисление на курс |
| Certificate | выдача сертификатов CRM |
| Payments | оплаты |

### 2.3. Внешние ссылки

| Поле в Assessment | Источник | Правило |
|-------------------|----------|---------|
| `user_id` | `users.id` | Актёр. Только ссылка. |
| `student_id` | `students.id` | Attempt/Result ученика. Только ссылка. |
| `teacher_id` | `teachers.id` | Автор / проверяющий / **target Assignment**. Только ссылка. |
| `created_by_user_id` | `users.id` | Аудит. Только ссылка. |
| Assignment `target_id` | зависит от `target_type` | См. §6. Не владение CRM-сущностью. |
| `storage_key` на attachment | SecureFiles | Байты в CRM storage. |
| `certificate_id` (позже) | `certificates.id` | Опциональный bridge после pass. |

---

## 3. Единый lifecycle (публикация)

Для контентных сущностей Assessment используется **один** жизненный цикл:

| Статус | Смысл |
|--------|--------|
| `draft` | Редактируется свободно |
| `published` | Опубликовано; **неизменяемо** (in-place edit запрещён) |
| `archived` | Снято с использования; новые назначения/попытки по политике закрыты |

### Где применяется

| Сущность | Поле статуса | Примечание |
|----------|--------------|------------|
| **Question** (банк) | `status` | Банк = AssessmentBank + набор Question (+ Topic) |
| **AssessmentBank** | `status` | Контейнер вопросов |
| **ExamTemplate** | `status` | |
| **Blueprint** | `status` | Ранее допускался `active` — **заменён** на `published` для единообразия |
| **Exam** | `status` | |

### Политика после `published`

- Редактирование опубликованной версии **не предполагается**.
- Изменения = **clone** → новый `draft` → снова `published` (новый id).
- Уже созданные Attempt / Snapshot / Result **не** переписываются при archive старого Exam.
- Exam с `published`: набор `assessment_exam_questions` immutable; `AssessmentRule`, привязанный к Exam, тоже считается замороженным вместе с Exam (правки только через новый Exam + новый Rule).

Attempt использует отдельный lifecycle сдачи: `created` → `started` → `submitted` (+ поле `submit_reason`).  
Состояний `expired` / `abandon` / `void` **нет**. См. [state-machine.md](./state-machine.md).

---

## 4. Цепочка экзамена

```text
Question Bank (Topic, Question, Answer, QuestionAttachment)
        ↓
ExamTemplate
        ↓
Blueprint (+ BlueprintSectionRule.weight)
        ↓
Exam (+ Section + AssessmentRule)     ← единственный источник правил проведения
        ↓
ExamAssignment                        ← student | group | course | teacher | …
        ↓
Attempt
        ↓
QuestionSnapshot / AnswerSnapshot
        ↓
AttemptAnswer
        ↓
Result                                ← полный персистентный итог
```

| Уровень | Зачем |
|---------|--------|
| Question Bank | Переиспользуемые задания |
| ExamTemplate | Каркас / бренд экзамена |
| Blueprint | Сколько и каких вопросов + **вес секций** |
| Exam | Конкретный экземпляр + замороженный Rule |
| ExamAssignment | Кому доступен |
| Attempt | Факт сдачи |
| Snapshot | Неизменяемое содержание попытки |
| Result | Зафиксированный итог |

---

## 5. Сущности подробно

### 5.1. Topic / Question / Answer

Без изменений по смыслу. Question: lifecycle `draft | published | archived`.  
Типы v1: `single_choice`, `multiple_choice`, `short_text`, `listening`.

### 5.2. QuestionAttachment — единая модель media

**Отдельные сущности Audio / Image / Video не создаём.**

Одна сущность `QuestionAttachment`:

| Поле | Смысл |
|------|--------|
| `question_id` | Владелец |
| `kind` | `image` \| `audio` \| `pdf` \| `document` |
| `storage_key` | Ключ SecureFiles |
| `mime` | MIME |
| `sort_order` | Порядок |
| `original_filename` | Опционально |

Все медиа вопроса — через эту сущность и SecureFiles CRM.

### 5.3. ExamTemplate / Blueprint

Lifecycle: `draft | published | archived`.

### 5.4. BlueprintSectionRule (+ weight)

| Поле | Смысл | Пример |
|------|--------|--------|
| `section_key` | Ключ раздела | listening |
| `title` | Название | Listening |
| `question_count` | Сколько вопросов выбрать | 10 |
| `question_types` | Допустимые типы | listening |
| `difficulty_min` / `difficulty_max` | Диапазон сложности | 1–2 |
| `topic_filter` | Фильтр Topic | HSK1 Listening |
| **`weight`** | **Вклад секции в итог (доля, %)** | **30** |

Пример HSK1:

| section_key | question_count | weight |
|-------------|----------------|--------|
| listening | 10 | 30 |
| reading | 15 | 40 |
| writing | 10 | 30 |

Сумма `weight` по Blueprint должна быть 100 (валидация при publish Blueprint/Exam).  
При расчёте Result: баллы секции нормализуются с учётом `weight` (и копируются в breakdown / учитываются в `percent`).

При материализации Exam вес копируется в `Section.weight`, чтобы Attempt/Result не зависели от поздних правок Blueprint (Blueprint после publish и так immutable; копирование — защита + ясность в Exam).

### 5.5. AssessmentRule — единственное хранилище правил проведения

**Все** правила поведения экзамена живут только в `assessment_rules`.  
Не дублировать флаги на Exam / Assignment / Attempt (кроме snapshot фактов времени на Result/Attempt).

Привязка: `exam_id` (обязательно для published Exam).  
Опциональный override на Assignment — только ссылка на **другой** полный `AssessmentRule`, не разрозненные поля.

| Поле | Тип / значения | Назначение |
|------|----------------|------------|
| `duration_minutes` | int | Лимит времени попытки |
| `max_attempts` | int | Макс. попыток |
| `allow_retake` | bool | Разрешена пересдача |
| `retake_policy` | `best` \| `last` | Какая попытка «официальная» |
| `allow_review` | bool | Можно ли пересматривать сданные ответы (UI review) |
| `show_result_after_submit` | bool | Показывать итог сразу после submit |
| `show_correct_answers` | `never` \| `after_submit` \| `after_pass` \| `always` | Политика показа ключей |
| `auto_submit_on_timeout` | bool | **Всегда true по инварианту:** при окончании времени система выполняет submit (`submit_reason=timeout`). Поле может остаться для явного хранения политики = always on. |
| `allow_pause` | bool | Разрешена пауза попытки |
| `randomize_questions` | bool | Перемешивать порядок вопросов (ранее shuffle_questions) |
| `randomize_answers` | bool | Перемешивать варианты (ранее shuffle_answers) |
| `passing_mode` | `score` \| `percent` | Как интерпретировать порог |
| `pass_score` | number? | Порог при `passing_mode=score` |
| `pass_score_percent` | number? | Порог при `passing_mode=percent` |
| `allow_navigation` | bool | Свободная навигация по вопросам |

Именование: канонические имена — `randomize_*` (не параллельные `shuffle_*` в схеме).

### 5.6. Exam / Section

Exam lifecycle: `draft | published | archived`.  
Section: `title`, `section_key`, `sort_order`, **`weight`** (из Blueprint при материализации).

### 5.7. Attempt

Статусы сдачи (официально): `created` → `started` → `submitted`.  
**Нет** состояний `expired` / `abandon` / `void`.

| Поле | Назначение |
|------|------------|
| `status` | `created` \| `started` \| `submitted` |
| `submit_reason` | `manual` \| `timeout` \| `system` — заполняется при submit; ровно одно значение |
| `started_at` / `expires_at` / `submitted_at` | Временные метки |
| `attempt_number` | Номер попытки |
| `student_id` / `teacher_id` | Участник (ровно один заполнен) — внешние CRM id |
| `user_id` | Кто логинился — внешняя ссылка |

При истечении времени: статус остаётся путём `started` → `submitted` с `submit_reason=timeout` (не отдельный expired).

Детали переходов: [state-machine.md](./state-machine.md).

### 5.8. Result — полный персистентный итог

Result **создаётся при submit Attempt** и является источником правды для сертификатов, отчётов, UI.  
Автоматический фоновый пересчёт после финального статуса запрещён.

**Статусы Result:** `processing` → (`pending_review`?) → `passed` \| `failed` \| `invalidated`.

| Поле | Назначение |
|------|------------|
| `status` | См. state machine |
| `evaluation_type` | `automatic` \| `manual` \| `mixed` — ровно одно |
| `score` | Набранные баллы |
| `max_score` | Максимум баллов |
| `percent` | Процент (с учётом section weights) |
| `passed` | Денормализованный флаг (согласуется со status passed/failed) |
| `started_at` | Старт попытки |
| `finished_at` | Завершение |
| `duration` | Длительность |
| `attempt_number` | Номер попытки |
| `attempt_id` | 1:1 с Attempt |
| `exam_id` | Денормализация для отчётов |

`pending_review` — только если есть задания, требующие проверки преподавателем; иначе `processing` → `passed`/`failed` сразу и `evaluation_type=automatic`.

Рекомендуется `assessment_result_breakdowns` вместо JSONB.

---

## 6. Assignment — универсальная модель

| Поле | Смысл |
|------|--------|
| `exam_id` | Экзамен |
| `target_type` | См. ниже |
| `target_id` | ID в CRM / спец. значение |
| `status` | `draft` \| `scheduled` \| `active` \| `completed` \| `cancelled` (канон SM) |
| `assessment_rule_override_id` | Опционально другой полный Rule |
| `assigned_by_user_id` | Кто назначил (ссылка CRM) |
| `valid_from` / `valid_to` | Временное окно |

Поле `active` boolean **не используется**. API-фильтр `active?` = `status = 'active'`.

### `target_type`

| Значение | `target_id` | Сценарий |
|----------|-------------|----------|
| `student` | `students.id` | Персонально ученику |
| `teacher` | `teachers.id` | **Внутренняя аттестация преподавателей** |
| `group` | `groups.id` | Учебная группа |
| `course` | `course_templates.id` | Зачисленные на курс |
| `corporate_group` | будущий id | Корпоративная когорта |
| `public` | константа / nil uuid | Публичный входной тест |

Архитектура Assignment **не меняется** — только расширяется enum.  
`AssessmentAccessService` для `teacher`: сопоставить JWT → Teacher profile → совпадение с `target_id`.

**Отмена Assignment:** запрещена, если существует хотя бы один Attempt в состоянии `started` → backend **`409`**.  
Отмена допустима только **до начала первой попытки** (`started`).  
История уже `submitted` Attempt/Result при отмене не удаляется; новые start после `cancelled` запрещены.  
Детали: [state-machine.md §5.5](./state-machine.md).

---

## 7. Snapshot-стратегия (без изменений)

**Вариант A:** при start Attempt копировать вопросы/ответы в snapshot-таблицы.  
Пул вопросов Exam фиксируется при publish Exam (Blueprint → `assessment_exam_questions`).  
`randomize_questions` / `randomize_answers` влияют на порядок в Snapshot, не на состав (v1).

---

## 8. Версионирование

Отдельные Version-таблицы **не** в v1.  
Иммутабельность: единый lifecycle `draft | published | archived` + clone + Attempt snapshots.

---

## 9. Сценарии

| Сценарий | Покрытие |
|----------|----------|
| HSK prep | Blueprint + weights; Rule; Assignment group/course |
| Финал курса | Assignment `course`; Result → Certificate bridge |
| Корпоративная аттестация | `corporate_group`; строгий Rule |
| Публичный входной тест | `public` |
| Сертификат после сдачи | Result.passed → CRM Certificate |
| **Аттестация преподавателей** | Assignment `target_type=teacher` |

---

## 10. Checklist таблиц БД

1. `assessment_banks`  
2. `assessment_topics`  
3. `assessment_questions`  
4. `assessment_question_topics`  
5. `assessment_answers`  
6. `assessment_question_attachments`  
7. `assessment_exam_templates`  
8. `assessment_blueprints`  
9. `assessment_blueprint_section_rules` (**incl. weight**)  
10. `assessment_rules`  
11. `assessment_exams`  
12. `assessment_sections` (**incl. weight**)  
13. `assessment_exam_questions`  
14. `assessment_exam_assignments` (**status**, target_type incl. teacher)  
15. `assessment_attempts`  
16. `assessment_question_snapshots`  
17. `assessment_answer_snapshots`  
18. `assessment_attempt_answers`  
19. `assessment_attempt_answer_selections`  
20. `assessment_results`  
21. `assessment_result_breakdowns`

---

## 11. Диаграмма

```text
Topic ←N:M→ Question ←1:N→ Answer
                ↑
         QuestionAttachment (image|audio|pdf|document)

ExamTemplate 1──N Blueprint 1──N BlueprintSectionRule (weight)
       │
       └── materialize → Exam 1──1 AssessmentRule  (единственный store правил)
                            │
                            ├──1:N Section (weight)
                            ├── exam_questions
                            └──1:N ExamAssignment (…|teacher|…)

Exam 1──N Attempt (created→started→submitted, submit_reason)
              │
              ├── snapshots ── AttemptAnswer
              └──1 Result (status SM, evaluation_type, score, …)
```

---

## 12. Архитектурные решения (summary)

| # | Решение |
|---|---------|
| D1–D6, D9–D10 | Без изменений по смыслу (bounded context, snapshot A, polymorphic assignment, …) |
| **D7** | AssessmentRule — **единственное** место всех правил проведения; расширенный набор полей |
| **D8** | Единый lifecycle `draft\|published\|archived` для Question, ExamTemplate, Blueprint, Exam; published = immutable |
| **D11** | BlueprintSectionRule.`weight` (+ копирование в Section) для взвешенного итога |
| **D12** | QuestionAttachment only; kinds: image, audio, pdf, document |
| **D13** | Result — полный персистентный итог + status SM + `evaluation_type` |
| **D14** | Assignment `target_type` включает `teacher` |
| **D15** | Attempt: только `created`→`started`→`submitted`; поле `submit_reason` (`manual`\|`timeout`\|`system`); нет `expired` |
| **D16** | Timeout всегда = auto-submit (`submit_reason=timeout`) |
| **D17** | Assignment cancel запрещён при наличии Attempt `started` |
| **D18** | Result: `pending_review` при ручной проверке; иначе сразу passed/failed |
| **D19** | Assignment: канон `status` (нет boolean `active`); filter active = status=active |
| **D20** | AssessmentBank — реальная таблица под `/assessment/banks` |
| **D21** | ResultBreakdown + AttemptAnswerSelection (нормализованные связи) |

---

## 13. Changelog этой ревизии (до Entity)

| Раздел | Что изменилось |
|--------|----------------|
| §3 Lifecycle | Единые статусы для Bank(Question)/Template/Blueprint/Exam; published immutable |
| §5.2 Attachment | kinds: image, audio, pdf, document |
| §5.4 BlueprintSectionRule | `weight` |
| §5.5 AssessmentRule | Централизация + `auto_submit_on_timeout` = always on (инвариант) |
| §5.7 Attempt | Только `created`→`started`→`submitted`; `submit_reason`; нет `expired` |
| §5.8 Result | SM + `evaluation_type` (`automatic`\|`manual`\|`mixed`); `pending_review` |
| §6 Assignment | `target_type=teacher` + правило cancel при Attempt `started` → `409` |
| §12 | Решения D11–D18 |

### Подтверждение готовности к Entity

- Bounded context Assessment **сохранён**.
- State machines Attempt / Assignment / Result **официально зафиксированы** в [state-machine.md](./state-machine.md).
- Цепочка Bank → Blueprint → Exam → Assignment → Attempt → Snapshot → Result **не ломается**.
- Код Entity / миграции / API **не менялись** в этом этапе.
- **Архитектура Assessment полностью зафиксирована** — можно проектировать Entity и миграции `assessment_*`.
