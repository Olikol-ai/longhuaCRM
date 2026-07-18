# LongHua Assessment — Public API Contract

Status: **design only** (no controllers / services / entities / migrations)  
Base path: `/api/assessment`  
Auth: `Authorization: Bearer <JWT>` unless noted  
Serialization: snake_case JSON (как в остальном CRM)  
Related: [domain-model.md](./domain-model.md), [state-machine.md](./state-machine.md), [architecture.md](./architecture.md)

---

## 0. Conventions

### URL style

- Resource-oriented REST under `/assessment/...`
- Collections: plural nouns (`exams`, `questions`, `attempts`)
- Actions that are state transitions: `POST /resource/:id/<action>`  
  (`publish`, `archive`, `start`, `submit`) — не `/createExam`
- No GraphQL, no RPC (`/getExam`, `/startExam`)

### Roles

| Role | Meaning |
|------|---------|
| `admin` | Полный доступ Assessment |
| `teacher` | Авторство банка/шаблонов/экзаменов в своём scope; просмотр результатов учеников |
| `student` | Прохождение назначенных экзаменов; свои Attempt/Result |
| `system` | Внутренние/фоновые вызовы (jobs); не публичный JWT-роль — зарезервировано |

Если не указано иное: требуется один из перечисленных ролей.

### Common errors

| HTTP | Когда |
|------|--------|
| `400` | Валидация тела / query |
| `401` | Нет / невалидный JWT |
| `403` | Роль или ACL не позволяют |
| `404` | Ресурс не найден / скрыт ACL |
| `409` | Конфликт состояния (уже published, попытка исчерпана, …) |
| `422` | Бизнес-правило (недостаточно вопросов в банке для Blueprint preview) |

### Lifecycle actions

Для контента со статусом `draft | published | archived`:

- `POST .../publish` — только из `draft`
- `POST .../archive` — из `published` (или `draft` по политике)
- `PATCH` на `published` → **`409`** (immutable; нужен clone)

### Bank note

В domain-model отдельной таблицы Bank нет (банк = Questions + Topics).  
В API вводим ресурс **`banks`** (`QuestionBank`) как контейнер банка вопросов (HSK1, Entrance, …).  
Перед Entity: согласовать добавление `assessment_banks` в domain-model (см. спорные места).

---

## 1. Health

### `GET /assessment/health`

| | |
|--|--|
| **Назначение** | Проверка регистрации модуля |
| **Доступ** | любой аутентифицированный (`admin` \| `teacher` \| `student`) |
| **Параметры** | — |
| **Тело запроса** | — |
| **Ответ `200`** | `{ "module": "assessment", "status": "ok" }` |
| **Ошибки** | `401` |
| **Примечания** | Уже есть в scaffold |

---

## 2. Banks (`/assessment/banks`)

Контейнер банка вопросов.

### `POST /assessment/banks`

| | |
|--|--|
| **Назначение** | Создать банк (`draft`) |
| **Доступ** | `admin`, `teacher` |
| **Тело** | `{ "name": string, "description"?: string, "locale"?: string }` |
| **Ответ `201`** | Bank object |
| **Ошибки** | `400`, `401`, `403` |

### `GET /assessment/banks`

| | |
|--|--|
| **Назначение** | Список банков |
| **Доступ** | `admin`, `teacher` (свои / все для admin) |
| **Query** | `status?`, `search?`, `limit?`, `offset?` |
| **Ответ `200`** | `{ "items": Bank[], "total": number }` |
| **Ошибки** | `401`, `403` |

### `GET /assessment/banks/:bankId`

| | |
|--|--|
| **Назначение** | Получить банк |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | Bank |
| **Ошибки** | `401`, `403`, `404` |

### `PATCH /assessment/banks/:bankId`

| | |
|--|--|
| **Назначение** | Изменить банк (только `draft`) |
| **Доступ** | `admin`, `teacher` (владелец) |
| **Тело** | частичные поля Bank |
| **Ответ `200`** | Bank |
| **Ошибки** | `400`, `401`, `403`, `404`, `409` если не draft |

### `POST /assessment/banks/:bankId/publish`

| | |
|--|--|
| **Назначение** | Опубликовать банк |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | Bank (`status: published`) |
| **Ошибки** | `401`, `403`, `404`, `409` |

### `POST /assessment/banks/:bankId/archive`

| | |
|--|--|
| **Назначение** | Архивировать банк |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | Bank (`status: archived`) |
| **Ошибки** | `401`, `403`, `404`, `409` |

---

## 3. Questions (`/assessment/questions`)

### `POST /assessment/questions`

| | |
|--|--|
| **Назначение** | Создать вопрос в банке |
| **Доступ** | `admin`, `teacher` |
| **Тело** | см. ниже |
| **Ответ `201`** | Question (с answers) |
| **Ошибки** | `400`, `401`, `403`, `404` (bank) |

```json
{
  "bank_id": "uuid",
  "type": "single_choice | multiple_choice | short_text | listening",
  "stem": "string",
  "points": 1,
  "difficulty": 1,
  "explanation": "string?",
  "topic_ids": ["uuid"],
  "answers": [
    { "text": "string", "is_correct": true, "sort_order": 0 }
  ]
}
```

### `GET /assessment/questions`

| | |
|--|--|
| **Назначение** | Поиск / фильтрация / список |
| **Доступ** | `admin`, `teacher` |
| **Query** | `bank_id?`, `status?`, `type?`, `topic_id?`, `difficulty_min?`, `difficulty_max?`, `search?` (stem), `limit?`, `offset?` |
| **Ответ `200`** | `{ "items": Question[], "total": number }` |
| **Ошибки** | `400`, `401`, `403` |
| **Примечания** | Основной endpoint поиска и фильтрации |

### `GET /assessment/questions/:questionId`

| | |
|--|--|
| **Назначение** | Получить вопрос (+ answers, attachments meta) |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | Question detail |
| **Ошибки** | `401`, `403`, `404` |
| **Примечания** | `is_correct` в answers доступен authoring-ролям |

### `PATCH /assessment/questions/:questionId`

| | |
|--|--|
| **Назначение** | Изменить вопрос (только `draft`) |
| **Доступ** | `admin`, `teacher` |
| **Тело** | частичные поля + optional `answers` (полная замена набора, если передано) |
| **Ответ `200`** | Question |
| **Ошибки** | `400`, `401`, `403`, `404`, `409` |

### `DELETE /assessment/questions/:questionId`

| | |
|--|--|
| **Назначение** | Удалить вопрос (только `draft`, не используемый в published Exam) |
| **Доступ** | `admin`, `teacher` |
| **Ответ `204`** | — |
| **Ошибки** | `401`, `403`, `404`, `409` |

### `POST /assessment/questions/:questionId/archive`

| | |
|--|--|
| **Назначение** | Архивировать вопрос |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | Question |
| **Ошибки** | `401`, `403`, `404`, `409` |

### `POST /assessment/questions/:questionId/attachments`

| | |
|--|--|
| **Назначение** | Загрузить вложение (multipart) |
| **Доступ** | `admin`, `teacher` |
| **Тело** | `multipart/form-data`: `file`, `kind` = `image\|audio\|pdf\|document` |
| **Ответ `201`** | QuestionAttachment `{ id, kind, storage_key, mime, sort_order, url? }` |
| **Ошибки** | `400`, `401`, `403`, `404`, `413` |
| **Примечания** | Хранение через SecureFiles; вопрос должен быть `draft` |

### `DELETE /assessment/questions/:questionId/attachments/:attachmentId`

| | |
|--|--|
| **Назначение** | Удалить вложение |
| **Доступ** | `admin`, `teacher` |
| **Ответ `204`** | — |
| **Ошибки** | `401`, `403`, `404`, `409` |

---

## 4. Exam templates (`/assessment/exam-templates`)

### `POST /assessment/exam-templates`

| | |
|--|--|
| **Назначение** | Создать шаблон |
| **Доступ** | `admin`, `teacher` |
| **Тело** | `{ "name", "description?", "locale?", "level_label?" }` |
| **Ответ `201`** | ExamTemplate |
| **Ошибки** | `400`, `401`, `403` |

### `GET /assessment/exam-templates`

| | |
|--|--|
| **Назначение** | Список шаблонов |
| **Доступ** | `admin`, `teacher` |
| **Query** | `status?`, `search?`, `limit?`, `offset?` |
| **Ответ `200`** | `{ "items", "total" }` |
| **Ошибки** | `401`, `403` |

### `GET /assessment/exam-templates/:templateId`

| | |
|--|--|
| **Назначение** | Получить шаблон |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | ExamTemplate |
| **Ошибки** | `401`, `403`, `404` |

### `PATCH /assessment/exam-templates/:templateId`

| | |
|--|--|
| **Назначение** | Изменить (только `draft`) |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | ExamTemplate |
| **Ошибки** | `400`, `401`, `403`, `404`, `409` |

### `DELETE /assessment/exam-templates/:templateId`

| | |
|--|--|
| **Назначение** | Удалить (только `draft` без связанных published Exam) |
| **Доступ** | `admin`, `teacher` |
| **Ответ `204`** | — |
| **Ошибки** | `401`, `403`, `404`, `409` |

### `POST /assessment/exam-templates/:templateId/publish`

| | |
|--|--|
| **Назначение** | Опубликовать шаблон |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | ExamTemplate |
| **Ошибки** | `401`, `403`, `404`, `409` |

### `POST /assessment/exam-templates/:templateId/archive`

| | |
|--|--|
| **Назначение** | Архивировать шаблон |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | ExamTemplate |
| **Ошибки** | `401`, `403`, `404`, `409` |

---

## 5. Blueprints (`/assessment/blueprints`)

### `POST /assessment/blueprints`

| | |
|--|--|
| **Назначение** | Создать Blueprint |
| **Доступ** | `admin`, `teacher` |
| **Тело** | |
| **Ответ `201`** | Blueprint (+ section_rules) |
| **Ошибки** | `400`, `401`, `403`, `404` |

```json
{
  "exam_template_id": "uuid",
  "bank_id": "uuid",
  "name": "HSK1 Standard",
  "section_rules": [
    {
      "section_key": "listening",
      "title": "Listening",
      "question_count": 10,
      "question_types": ["listening"],
      "difficulty_min": 1,
      "difficulty_max": 2,
      "topic_ids": ["uuid"],
      "weight": 30
    }
  ]
}
```

### `GET /assessment/blueprints`

| | |
|--|--|
| **Назначение** | Список |
| **Доступ** | `admin`, `teacher` |
| **Query** | `exam_template_id?`, `status?`, `limit?`, `offset?` |
| **Ответ `200`** | `{ "items", "total" }` |
| **Ошибки** | `401`, `403` |

### `GET /assessment/blueprints/:blueprintId`

| | |
|--|--|
| **Назначение** | Детали Blueprint |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | Blueprint + section_rules |
| **Ошибки** | `401`, `403`, `404` |

### `PATCH /assessment/blueprints/:blueprintId`

| | |
|--|--|
| **Назначение** | Изменить (только `draft`) |
| **Доступ** | `admin`, `teacher` |
| **Тело** | поля + optional полная замена `section_rules` |
| **Ответ `200`** | Blueprint |
| **Ошибки** | `400`, `401`, `403`, `404`, `409` |

### `DELETE /assessment/blueprints/:blueprintId`

| | |
|--|--|
| **Назначение** | Удалить draft |
| **Доступ** | `admin`, `teacher` |
| **Ответ `204`** | — |
| **Ошибки** | `401`, `403`, `404`, `409` |

### `POST /assessment/blueprints/:blueprintId/publish`

| | |
|--|--|
| **Назначение** | Опубликовать (валидация: сумма weight = 100, пул вопросов достаточен) |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | Blueprint |
| **Ошибки** | `401`, `403`, `404`, `409`, `422` |

### `POST /assessment/blueprints/:blueprintId/archive`

| | |
|--|--|
| **Назначение** | Архивировать |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | Blueprint |
| **Ошибки** | `401`, `403`, `404`, `409` |

### `POST /assessment/blueprints/:blueprintId/preview`

| | |
|--|--|
| **Назначение** | Предпросмотр генерации: сколько вопросов найдено / пример состава **без** создания Exam |
| **Доступ** | `admin`, `teacher` |
| **Тело** | optional `{ "seed"?: number }` |
| **Ответ `200`** | `{ "ok": boolean, "sections": [{ "section_key", "requested", "available", "sample_question_ids": [] }], "errors": [] }` |
| **Ошибки** | `401`, `403`, `404`, `422` |
| **Примечания** | Не пишет в БД Exam; идемпотентный read-like |

---

## 6. Exams (`/assessment/exams`)

### `POST /assessment/exams`

| | |
|--|--|
| **Назначение** | Создать Exam из Blueprint (материализация вопросов → draft Exam) |
| **Доступ** | `admin`, `teacher` |
| **Тело** | см. ниже |
| **Ответ `201`** | Exam detail (sections, question count, embedded `rule`) |
| **Ошибки** | `400`, `401`, `403`, `404`, `422` |

```json
{
  "blueprint_id": "uuid",
  "name": "HSK1 Mock — March",
  "available_from": "ISO-8601?",
  "available_to": "ISO-8601?",
  "rule": {
    "duration_minutes": 60,
    "max_attempts": 2,
    "allow_retake": true,
    "retake_policy": "best",
    "allow_review": false,
    "show_result_after_submit": true,
    "show_correct_answers": "never",
    "auto_submit_on_timeout": true,
    "allow_pause": false,
    "randomize_questions": true,
    "randomize_answers": true,
    "passing_mode": "percent",
    "pass_score_percent": 60,
    "allow_navigation": true
  }
}
```

### `GET /assessment/exams`

| | |
|--|--|
| **Назначение** | Список экзаменов |
| **Доступ** | `admin`, `teacher`; `student` — только назначенные published |
| **Query** | `status?`, `search?`, `limit?`, `offset?` |
| **Ответ `200`** | `{ "items", "total" }` |
| **Ошибки** | `401`, `403` |

### `GET /assessment/exams/:examId`

| | |
|--|--|
| **Назначение** | Получить Exam (+ rule, sections meta; **без** ключей ответов для student) |
| **Доступ** | `admin`, `teacher`; `student` если есть Assignment |
| **Ответ `200`** | Exam |
| **Ошибки** | `401`, `403`, `404` |

### `PATCH /assessment/exams/:examId`

| | |
|--|--|
| **Назначение** | Изменить draft Exam (имя, окно, rule) |
| **Доступ** | `admin`, `teacher` |
| **Тело** | частичные поля; `rule` — полная замена объекта правил |
| **Ответ `200`** | Exam |
| **Ошибки** | `400`, `401`, `403`, `404`, `409` |
| **Примечания** | Состав вопросов после материализации в draft можно пересобрать отдельным endpoint при необходимости — v1: только meta/rule |

### `POST /assessment/exams/:examId/publish`

| | |
|--|--|
| **Назначение** | Опубликовать Exam (immutable состав + rule) |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | Exam |
| **Ошибки** | `401`, `403`, `404`, `409` |

### `POST /assessment/exams/:examId/archive`

| | |
|--|--|
| **Назначение** | Архивировать Exam (новые Attempt закрыты) |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | Exam |
| **Ошибки** | `401`, `403`, `404`, `409` |

### `GET /assessment/exams/:examId/preview`

| | |
|--|--|
| **Назначение** | **Предпросмотр экзамена** для автора (структура, стемы; ключи — только authoring) |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | `{ "exam", "sections": [{ "section_key", "weight", "questions": [...] }] }` |
| **Ошибки** | `401`, `403`, `404` |
| **Примечания** | Не путать с Blueprint preview; это preview уже материализованного Exam |

---

## 7. Assignments (`/assessment/assignments`)

### `POST /assessment/assignments`

| | |
|--|--|
| **Назначение** | Назначить Exam аудитории |
| **Доступ** | `admin`, `teacher` |
| **Тело** | |
| **Ответ `201`** | Assignment |
| **Ошибки** | `400`, `401`, `403`, `404`, `409` |

```json
{
  "exam_id": "uuid",
  "target_type": "student | teacher | group | course | corporate_group | public",
  "target_id": "uuid",
  "valid_from": "ISO-8601?",
  "valid_to": "ISO-8601?",
  "assessment_rule_override_id": "uuid?"
}
```

Exam должен быть `published` (или `409`).

### `GET /assessment/assignments`

| | |
|--|--|
| **Назначение** | Список назначений |
| **Доступ** | `admin`, `teacher`; `student` — свои (где он в target) |
| **Query** | `exam_id?`, `target_type?`, `target_id?`, `active?`, `limit?`, `offset?` |
| **Ответ `200`** | `{ "items", "total" }` |
| **Ошибки** | `401`, `403` |

### `GET /assessment/assignments/:assignmentId`

| | |
|--|--|
| **Назначение** | Детали назначения |
| **Доступ** | `admin`, `teacher`; `student` если относится к нему |
| **Ответ `200`** | Assignment (+ краткий exam summary) |
| **Ошибки** | `401`, `403`, `404` |

### `POST /assessment/assignments/:assignmentId/cancel`

| | |
|--|--|
| **Назначение** | Отменить Assignment → `cancelled` |
| **Доступ** | `admin`, `teacher` |
| **Ответ `200`** | Assignment |
| **Ошибки** | `401`, `403`, `404`, **`409`** если есть хотя бы один Attempt в `started` |
| **Примечания** | Отмена только **до начала первой попытки** (`started`). История `submitted` Attempt/Result не удаляется. См. [state-machine.md §5.5](./state-machine.md). |

---

## 8. Attempts (`/assessment/attempts`)

### `POST /assessment/attempts`

| | |
|--|--|
| **Назначение** | **Start** — создать Attempt + snapshots |
| **Доступ** | `student`; `teacher` если Assignment `target_type=teacher` на него; `admin` (impersonation — later / запрещено в v1) |
| **Тело** | `{ "exam_id": "uuid", "assignment_id"?: "uuid" }` |
| **Ответ `201`** | AttemptState (см. ниже; **без** `is_correct`) |
| **Ошибки** | `400`, `401`, `403`, `404`, `409` (лимит попыток / уже live Attempt `created`/`started`) |
| **Примечания** | Атомарно `created`→`started`. Статусы Attempt: только `created` \| `started` \| `submitted`. Нет `expired` / `abandon`. |

### `GET /assessment/attempts/:attemptId`

| | |
|--|--|
| **Назначение** | Текущее состояние попытки (вопросы snapshot, сохранённые ответы, таймер) |
| **Доступ** | владелец Attempt; `admin`, `teacher` (просмотр ученика в scope) |
| **Ответ `200`** | AttemptState |
| **Ошибки** | `401`, `403`, `404` |

**AttemptState (участник):**

```json
{
  "id": "uuid",
  "exam_id": "uuid",
  "status": "started",
  "submit_reason": null,
  "attempt_number": 1,
  "started_at": "...",
  "expires_at": "...",
  "sections": [
    {
      "section_key": "listening",
      "title": "Listening",
      "weight": 30,
      "questions": [
        {
          "snapshot_id": "uuid",
          "type": "listening",
          "stem": "...",
          "points": 1,
          "attachments": [{ "id": "uuid", "kind": "audio", "url": "signed..." }],
          "answers": [{ "snapshot_id": "uuid", "text": "...", "sort_order": 0 }],
          "saved_answer": { "selected_answer_snapshot_ids": [], "text": null }
        }
      ]
    }
  ]
}
```

После submit: `status=submitted`, `submit_reason` = `manual` \| `timeout` \| `system`.

### `PATCH /assessment/attempts/:attemptId/answers`

| | |
|--|--|
| **Назначение** | **Autosave** ответов |
| **Доступ** | владелец Attempt (`student` / `teacher`-участник) |
| **Тело** | `{ "answers": [{ "question_snapshot_id", "selected_answer_snapshot_ids"?: [], "text"?: string }] }` |
| **Ответ `200`** | `{ "saved_at": "...", "count": number }` |
| **Ошибки** | `400`, `401`, `403`, `404`, `409` если не `started` |

### `POST /assessment/attempts/:attemptId/submit`

| | |
|--|--|
| **Назначение** | Завершить попытку (`submit_reason=manual`) → создать Result |
| **Доступ** | владелец |
| **Тело** | optional `{ "answers": [...] }` (финальный flush) |
| **Ответ `200`** | `{ "attempt", "result" }` — поля Result по политике `show_result_after_submit` / `show_correct_answers` |
| **Ошибки** | `401`, `403`, `404`, `409` |
| **Примечания** | При истечении времени **system** сам вызывает тот же переход с `submit_reason=timeout` (отдельного endpoint `expire` нет). Admin force → `submit_reason=system`. Нет endpoint `abandon`. |

### `GET /assessment/attempts`

| | |
|--|--|
| **Назначение** | Список попыток |
| **Доступ** | `admin`, `teacher` (scope); `student` — только свои |
| **Query** | `exam_id?`, `student_id?`, `status?`, `limit?`, `offset?` |
| **Ответ `200`** | `{ "items", "total" }` |
| **Ошибки** | `401`, `403` |

---

## 9. Snapshots & attachments (special)

### `GET /assessment/attempts/:attemptId/snapshots`

| | |
|--|--|
| **Назначение** | **Получение snapshot** попытки (полный набор QuestionSnapshot / AnswerSnapshot) |
| **Доступ** | владелец; `admin`, `teacher` (scope). Ключи `is_correct` — только authoring / после политики показа |
| **Ответ `200`** | `{ "question_snapshots": [], "answer_snapshots": [] }` |
| **Ошибки** | `401`, `403`, `404` |

### `GET /assessment/attachments/:attachmentId/download`

| | |
|--|--|
| **Назначение** | **Скачивание / signed URL** вложения вопроса (authoring) или snapshot-вложения в Attempt |
| **Доступ** | `admin`, `teacher`; `student` только если attachment входит в его active/submitted Attempt |
| **Query** | `disposition?=inline\|attachment` |
| **Ответ `200`** | redirect / `{ "url": "signed...", "expires_at": "..." }` |
| **Ошибки** | `401`, `403`, `404` |
| **Примечания** | Не отдавать сырой путь диска; только SecureFiles |

Альтернатива (допустима в реализации):  
`GET /assessment/attempts/:attemptId/attachments/:attachmentId/download` — более узкий ACL.  
Канон контракта: общий download + ACL по контексту.

---

## 10. Results (`/assessment/results`)

### `GET /assessment/results/:resultId`

| | |
|--|--|
| **Назначение** | Получить сохранённый итог |
| **Доступ** | владелец; `admin`, `teacher` (scope) |
| **Ответ `200`** | Result |

```json
{
  "id": "uuid",
  "attempt_id": "uuid",
  "exam_id": "uuid",
  "status": "passed",
  "evaluation_type": "automatic",
  "score": 72,
  "max_score": 100,
  "percent": 72.0,
  "passed": true,
  "started_at": "...",
  "finished_at": "...",
  "duration": 3540,
  "attempt_number": 1,
  "breakdowns": [
    { "section_key": "listening", "weight": 30, "score": 24, "max_score": 30 }
  ]
}
```

| **Ошибки** | `401`, `403`, `404` |
| **Примечания** | `status`: `processing` \| `pending_review` \| `passed` \| `failed` \| `invalidated`. `evaluation_type`: `automatic` \| `manual` \| `mixed`. Правильные ответы — только если Rule позволяет. |

### `GET /assessment/results`

| | |
|--|--|
| **Назначение** | Список результатов |
| **Доступ** | `admin`, `teacher`; `student` — свои |
| **Query** | `exam_id?`, `student_id?`, `teacher_id?`, `passed?`, `from?`, `to?`, `limit?`, `offset?` |
| **Ответ `200`** | `{ "items", "total" }` |
| **Ошибки** | `401`, `403` |

### `GET /assessment/results/export`

| | |
|--|--|
| **Назначение** | Экспорт результатов (CSV) |
| **Доступ** | `admin`, `teacher` |
| **Query** | те же фильтры, что у списка + `format=csv` |
| **Ответ `200`** | `text/csv` или `{ "download_url" }` |
| **Ошибки** | `401`, `403`, `400` |
| **Примечания** | `system` может вызывать для scheduled reports (позже) |

### `GET /assessment/attempts/:attemptId/result`

| | |
|--|--|
| **Назначение** | Result по Attempt (удобный alias) |
| **Доступ** | как у Result |
| **Ответ `200`** | Result |
| **Ошибки** | `401`, `403`, `404` |

---

## 11. Endpoint catalog (count)

| Area | Methods | Count |
|------|---------|------:|
| Health | GET | 1 |
| Banks | POST, GET, GET:id, PATCH, publish, archive | 6 |
| Questions | POST, GET, GET:id, PATCH, DELETE, archive, attachments POST/DELETE | 8 |
| Exam templates | POST, GET, GET:id, PATCH, DELETE, publish, archive | 7 |
| Blueprints | POST, GET, GET:id, PATCH, DELETE, publish, archive, preview | 8 |
| Exams | POST, GET, GET:id, PATCH, publish, archive, preview | 7 |
| Assignments | POST, GET, GET:id, cancel | 4 |
| Attempts | POST (start), GET:id, GET list, autosave PATCH, submit | 5 |
| Snapshots / download | GET snapshots, GET download | 2 |
| Results | GET:id, GET list, export, GET by attempt | 4 |
| **Total** | | **52** |

---

## 12. Coverage by entity

| Domain concept | API resource |
|----------------|--------------|
| Bank | `/banks` |
| Question (+ Answer, Attachment) | `/questions`, attachments |
| ExamTemplate | `/exam-templates` |
| Blueprint | `/blueprints` (+ preview) |
| Exam (+ Rule, Section) | `/exams` (+ preview) |
| Assignment | `/assignments` |
| Attempt | `/attempts` |
| Snapshot | `/attempts/:id/snapshots` |
| Result | `/results` |
| Media download | `/attachments/:id/download` |

AssessmentRule — не отдельный top-level CRUD в v1: создаётся/обновляется **внутри** Exam create/patch (единственный store полей).  
При необходимости позже: `GET /assessment/exams/:examId/rule`.

---

## 13. Open questions (обсудить до реализации)

1. ~~**`assessment_banks` vs только Questions**~~ — **закрыто:** таблица `assessment_banks` + Entity.  
2. **Admin start Attempt** — разрешать ли impersonation / тест от имени студента?  
3. **Autosave vs WebSocket** — контракт HTTP; realtime не в scope.  
4. **Public Assignment** — отдельный auth flow для гостя или только после регистрации Student?  
5. **Export** — синхронный CSV vs async job + `system`.  
6. **Teacher as participant** — Attempt с `teacher_id` вместо `student_id` (как в domain-model).  
7. **Пересборка вопросов draft Exam** — нужен ли `POST /exams/:id/rebuild` из того же Blueprint?

**Закрыто официально (см. state-machine.md / domain-model):** нет `abandon`/`expired`; timeout = auto-submit; cancel Assignment при Attempt `started` → `409`; Result `pending_review` + `evaluation_type`; Assignment `status` (не boolean active); Bank table; ResultBreakdown; AttemptAnswerSelection.

---

## 14. Out of scope this document

- GraphQL  
- Реализация controllers/services  
- Entity / migrations  
- Certificate issuance endpoints (CRM)

**Код в этом этапе не пишется.**
