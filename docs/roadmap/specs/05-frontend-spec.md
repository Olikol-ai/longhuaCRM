# Спецификация этапа 5: Frontend Migration

**Roadmap:** [05-frontend.md](../05-frontend.md)  
**Предшественник:** [04-api-spec.md](./04-api-spec.md) (параллель после первых v2 endpoints)  
**Следующий:** [08-final-cleanup-spec.md](./08-final-cleanup-spec.md)  
**Аудит:** [docs/audit/frontend.md](../../audit/frontend.md)  
**Трудоёмкость:** 24–40 ч

---

## Цель этапа

Перевести React UI с generic `base44.entities.*` (`/api/entities/:entity`) на typed `/api/v2/*` clients. Сохранить snake_case контракт с backend. Устранить дублирование бизнес-логики (balance adjustment) на стороне UI там, где backend services берут её на себя (этап 3–4).

---

## Архитектура (текущее состояние)

```
React Pages/Components
  └── import { base44 } from "@/api/base44Client"
        ├── base44.auth.*     → /api/auth/*        (typed backend ✓)
        ├── base44.entities.* → /api/entities/*    (generic legacy)
        └── base44.functions.* → /api/functions/* (partial auth)

Token: localStorage key 'longhua_access_token' (base44Client.js:2, 4-10)
API base: '/api' (base44Client.js:1) — Vite proxy → NestJS :3001
```

### Целевая архитектура

```
src/api/
  ├── authClient.js          (from base44.auth or standalone)
  ├── clients/
  │   ├── students.js
  │   ├── teachers.js
  │   ├── lessons.js
  │   ├── payments.js
  │   ├── shop.js
  │   ├── welcome.js
  │   ├── users.js
  │   └── materialAccess.js
  └── index.js               (single export point)

Pages → clients.* → /api/v2/*
AuthContext → authClient (no entity role inference via updateMe after этап 4)
```

---

## Классы / модули

### `base44Client.js` — monolithic API facade

**Файл:** `src/api/base44Client.js` (144 строки)

| Export | Строки | Назначение |
|--------|--------|------------|
| `getToken()` | 4-6 | read localStorage |
| `setToken(token)` | 8-11 | write/remove token |
| `apiFetch(path, options)` | 13-34 | core HTTP wrapper |
| `createEntityClient(name)` | 36-73 | factory list/filter/create/update/delete/bulkCreate |
| `ENTITY_NAMES` | 75-81 | 17 entity names + User |
| `entities` | 83-86 | map name → client |
| `base44.auth` | 89-132 | me, updateMe, logout, redirectToLogin, login, register |
| `base44.functions` | 134-142 | invoke(name, params) |

### `materialAccess.js` — domain helper

**Файл:** `src/lib/materialAccess.js` (133 строки)

| Function | Строки | API calls |
|----------|--------|-----------|
| `hasAccessToMaterial(userId, materialId)` | 9-29 | MaterialAccess.filter |
| `grantAccess(...)` | 39-86 | Student.filter, Teacher.filter, MaterialAccess filter/create/update |
| `revokeAccess(...)` | 94-114 | MaterialAccess filter/delete/create |
| `filterMaterialsByAccess(materials, userId)` | 122-133 | N× hasAccessToMaterial |

### Page components (scope документа)

| Component | Файл | Строк | base44.entities usage count |
|-----------|------|-------|----------------------------|
| Payments | `src/pages/Payments.jsx` | 216 | Payment, Student |
| Schedule | `src/pages/Schedule.jsx` | 361 | Lesson, Teacher, Student + auth.me |
| ShopSettingsAdmin | `src/pages/ShopSettingsAdmin.jsx` | 204 | ShopSettings |
| WelcomePageEditor | `src/pages/WelcomePageEditor.jsx` | 108 | WelcomePageSettings |
| UserManagement | `src/pages/UserManagement.jsx` | 681 | User, Student, Teacher, Lesson, Payment, Course |

---

## Методы

### apiFetch — `base44Client.js:13-34`

1. Headers: `Content-Type: application/json` + merge options.headers — строка 14
2. Bearer token if present — строки 15-16
3. `fetch(\`${API_BASE}${path}\`)` — строка 18
4. Parse JSON or `{ raw: text }` on failure — строки 19-25
5. Error: `Error(data.error || 'Request failed')` + status, data — строки 27-31

**Проблема:** NestJS ValidationPipe возвращает `message: string[]`, не `error` — строка 28.

### createEntityClient methods — `base44Client.js:36-73`

| Method | HTTP | Path pattern | Строки |
|--------|------|--------------|--------|
| list(sortField, limit) | GET | `/entities/${name}?sort&limit` | 38-43 |
| filter(query) | POST | `/entities/${name}/filter` | 45-49 |
| create(data) | POST | `/entities/${name}` | 51-55 |
| update(id, data) | PATCH | `/entities/${name}/${id}` | 57-61 |
| delete(id) | DELETE | `/entities/${name}/${id}` | 63-65 |
| bulkCreate(items) | POST | `/entities/${name}` (array body) | 66-71 |

**Sort convention:** prefix `-` for desc — e.g. `"-payment_date"` (Payments.jsx:18); backend `applySortAndLimit` localeCompare — entity-repository.service.ts:119-122.

### base44.auth — `base44Client.js:89-132`

| Method | Endpoint | Строки | Notes |
|--------|----------|--------|-------|
| me() | GET /auth/me | 90-96 | throws 401 if no token locally |
| updateMe(data) | PATCH /auth/me | 98-100 | |
| logout(redirectUrl) | local | 101-106 | always redirects /login if redirectUrl defined |
| redirectToLogin | window.location | 107-110 | `?from_url=` |
| login(email, password) | POST /auth/login | 111-117 | setToken |
| register(...) | POST /auth/register | 119-130 | setToken |

### base44.functions.invoke — `base44Client.js:134-142`

POST `/functions/${name}` → wraps response as `{ data }` — **важно для TopUpModal** (`res.data.redirectUrl`).

---

### Payments.jsx

#### State — строки 8-14

`payments`, `students`, `loading`, `showModal`, `editingPayment`, `deletingId`, `search`

#### `load()` — строки 16-24

```javascript
Promise.all([
  base44.entities.Payment.list("-payment_date", 200),
  base44.entities.Student.list(),
])
```

#### `handleSave(data)` — строки 28-53

**Edit path (строки 29-41):**
1. `diff = data.lessons_added - editingPayment.lessons_added`
2. `Payment.update(id, data)`
3. If diff !== 0: `Student.update` lesson_balance += diff, Math.max(0, ...)

**Create path (строки 42-49):**
1. `Payment.create(data)`
2. `Student.update` lesson_balance += lessons_added

**Business logic on UI** — должна мигрировать в PaymentsService (этап 3) + v2 API (этап 4).

#### `handleDelete(payment)` — строки 55-65

Confirm dialog → Payment.delete → Student balance -= lessons_added (max 0)

#### Derived stats — строки 67-79

- totalRevenue: sum amount
- thisMonth: parseISO payment_date filter current month — строки 68-74
- filtered: search by student_name — строки 77-79

#### UI — строки 81-214

Stats cards, search, table columns: student_name, amount, lessons_added, payment_date, comment, edit/delete actions. Modal: `PaymentModal` — строки 206-213.

---

### Schedule.jsx

#### State — строки 13-22

view (day/week/month), current date, lessons, teachers, students, user, modals, loading

#### Auth load — строки 24-26

`base44.auth.me().then(setUser).catch(() => {})`

#### `load()` — строки 28-38

Lesson.list("-date", 500), Teacher.list(), Student.list()

#### `handleSave(data, recurring, recurringWeeks=4)` — строки 54-71

**Recurring:** generate weekly dates — строки 56-65, `recurring_group_id: Date.now()`, `is_recurring: true`  
**Single:** Lesson.create(data) — строка 67

#### `handleUpdate(id, data)` — строки 73-95

If status in `["completed", "missed_no_notice"]`:
- Resolve student ids from lesson.student_ids or lesson.student_id — строки 79-80
- Per student: filter Student, decrement lesson_balance — строки 80-90

**Duplicate logic risk:** JobsService.autoCompleteExpiredLessons sets completed without balance deduct.

#### `handleDelete(id)` — строки 97-101

#### `getLessonsForDay(day)` — строки 103-106

parseISO + isSameDay + sort by start_time

#### Role gating — строки 108-109, 142-149

Only admin sees «Новый урок» button; WeekView slot click admin-only — строки 164, 315

#### Subcomponents — строки 198-361

- `LessonChip`, `MonthView`, `WeekView`, `DayView`
- statusColors — строки 198-203; STATUS_LABELS defined but unused in render
- HOURS 7-20 — строка 111

#### Modals — строки 172-193

LessonModal (create), LessonDetailModal (update/delete) with isAdmin, isTeacher props

---

### ShopSettingsAdmin.jsx

#### Defaults — строки 5-18

`DEFAULT_PACKAGES` (4 items), `DEFAULT_COURSES` (3 items), `EMPTY_PKG`, `EMPTY_COURSE`

Fields per item: `item_id`, `label`, `lessons`, `price`, `note`, `type`, `sort_order`, `is_active`, `description?`

#### `loadItems()` — строки 29-41

1. ShopSettings.list("sort_order")
2. If empty: bulk seed DEFAULT_PACKAGES + DEFAULT_COURSES via create — строки 32-36
3. **Side effect:** first admin visit auto-seeds DB

#### CRUD — строки 45-71

- startAdd, handleSave (create/update), handleDelete, toggleActive(is_active flip)

#### UI — строки 75-203

Tab package/course, list cards, edit modal with form fields — строки 147-190

---

### WelcomePageEditor.jsx

#### DEFAULTS — строки 7-13

`school_name`, `title`, `subtitle`, `body_text`, `info_text`

#### `loadSettings()` — строки 24-31

WelcomePageSettings.list() → first record or DEFAULTS

#### `handleSave()` — строки 35-45

update if record exists else create; toast notification

#### Preview — строки 72-91

Renders form fields as welcome page mockup; body_text split by `\n` — строки 83-85

#### Field component — строки 96-108

---

### UserManagement.jsx

#### Structure — строки 645-681

Main tabs: accounts | students | teachers

#### AccountsTab — строки 132-341

| Method | Строки | API |
|--------|--------|-----|
| load | 140-145 | User.list() |
| changeRole | 149-197 | User.update role; conditional Teacher/Student create/link |
| deleteUser | 199-205 | User.delete |

**changeRole teacher path (158-174):** filter Teacher by user_id; else by email; create or link user_id  
**changeRole student path (175-192):** same pattern for Student with lesson_balance: 0

#### StudentsTab — строки 344-495

| Method | Строки | API |
|--------|--------|-----|
| loadData | 361-369 | Student.list, Teacher.list |
| handleDelete | 373-391 | cascade delete Lesson, Payment, Course; Student; optional User |

#### TeachersTab — строки 498-643

| Method | Строки | API |
|--------|--------|-----|
| loadData | 510-520 | Teacher, Student, Lesson lists |
| hasActiveLessons | 524 | planned lessons for teacher |
| handleDelete | 526-538 | block if active lessons |

#### Shared UI components

- RoleBadge — строки 25-33
- RoleDropdown (portal) — строки 36-98
- ConfirmDeleteModal — строки 100-129

---

### materialAccess.js (детально)

#### Priority rules — hasAccessToMaterial — строки 15-28

1. ADMIN + access:false → deny — строка 16-17
2. ADMIN + access:true → allow — строка 20-21
3. TEACHER + access:true → allow — строка 24-25
4. else deny

#### grantAccess teacher validation — строки 41-63

- Student must exist with user_id
- Teacher must exist with grantedByUserId
- `student[0].assigned_teacher === teacher[0].id`

#### revokeAccess admin deny record — строки 105-113

After delete, if ADMIN: create `{ access: false }` — explicit deny

---

## DTO / контракт полей (frontend ↔ API)

### Payment (Payments.jsx)

| Field | Used in UI | Строки |
|-------|------------|--------|
| student_name | table, search | 77-78, 160-163 |
| student_id | handleSave | 34, 44 |
| amount | table, stats | 67, 167 |
| lessons_added | table, balance ops | 31, 47, 61, 171 |
| payment_date | table, thisMonth | 70, 175 |
| comment | table | 178 |
| package_type | — (backend AlfaBank) | — |

### ShopSettings (ShopSettingsAdmin.jsx)

| Field | Строки defaults/UI |
|-------|-------------------|
| item_id | 6-14, 149-152 |
| label | 6-14, 155-158 |
| lessons | 6-14, 162-164 |
| price | 6-14, 167-169 |
| note | 6-14, 173-176 |
| type | package/course | 6-14, tab filter 43 |
| sort_order | 6-14, 187-189 |
| is_active | 6-14, toggle 68-70 |
| description | courses 12-14, 178-184 |

### WelcomePageSettings (WelcomePageEditor.jsx)

| Field | DEFAULTS строки 7-13 |
|-------|---------------------|
| school_name | ✓ |
| title | ✓ |
| subtitle | ✓ |
| body_text | ✓ multiline |
| info_text | ✓ |

### User (UserManagement AccountsTab)

| Field | Usage |
|-------|-------|
| id | changeRole, delete |
| email | display, Teacher/Student link |
| first_name, last_name | displayName |
| full_name | fallback |
| role | filter, badge, changeRole |
| created_date | table col 317 |

### Student / Teacher / Lesson (UserManagement, Schedule)

Standard CRM fields: name, email, user_id, lesson_balance, assigned_teacher, status, teacher_id, student_ids, date, start_time, status, etc.

### MaterialAccess (materialAccess.js)

| Field | materialAccess.js |
|-------|-------------------|
| user_id | filter key |
| material_id | filter key |
| granted_by_role | "ADMIN" \| "TEACHER" |
| access | boolean |

**Mismatch elsewhere:** BulkAccessModal uses `student_ids`, `access_type` — см. audit/frontend.md (не в scope файлов, но P1 migration).

---

## Entity (через UI)

| Entity | Primary pages (this spec) | Operations |
|--------|---------------------------|------------|
| Payment | Payments.jsx | list, create, update, delete + balance |
| Student | Payments, Schedule, UserManagement | list, update balance, CRUD, cascade delete |
| Lesson | Schedule, UserManagement | list, create, update, delete, recurring |
| Teacher | Schedule, UserManagement | list, CRUD |
| ShopSettings | ShopSettingsAdmin | list, seed, CRUD, toggle |
| WelcomePageSettings | WelcomePageEditor | list, create, update |
| User | UserManagement | list, update role, delete |
| Course | UserManagement cascade | delete on student delete |
| MaterialAccess | materialAccess.js | filter, create, update, delete |

---

## Зависимости

### Frontend → Backend

| Page | Requires v2 endpoint | Requires v2 function |
|------|---------------------|----------------------|
| Payments.jsx | payments, students | — |
| Schedule.jsx | lessons, students, teachers | — |
| ShopSettingsAdmin.jsx | shop-items | — |
| WelcomePageEditor.jsx | welcome-page | — |
| UserManagement.jsx | users, students, teachers | — |
| materialAccess.js | material-access | — |
| TopUpModal (related) | shop-items, students | alfaBankInit (keep functions) |

### Internal component dependencies

| Page | Components |
|------|------------|
| Payments.jsx | PaymentModal (`../components/payments/PaymentModal`) |
| Schedule.jsx | LessonModal, LessonDetailModal |
| UserManagement.jsx | StudentFormDialog, TeacherFormDialog, TeacherDetailModal, DeleteConfirmModal |
| WelcomePageEditor.jsx | Button, useToast (shadcn) |

### Auth

`AuthContext.jsx` — base44.auth.me, updateMe(role), entities Teacher/Student filter for role inference — строки 42-55.

---

## Callers (кто вызывает API client)

| Caller file | Callee | Строки |
|-------------|--------|--------|
| Payments.jsx | base44.entities.Payment, Student | 18-19, 32-47, 57-61 |
| Schedule.jsx | base44.entities.Lesson, Teacher, Student; auth.me | 25, 30-32, 64-98 |
| ShopSettingsAdmin.jsx | base44.entities.ShopSettings | 31-34, 52-55, 64, 69 |
| WelcomePageEditor.jsx | base44.entities.WelcomePageSettings | 25, 38-40 |
| UserManagement.jsx | User, Student, Teacher, Lesson, Payment, Course | см. таблицы выше |
| materialAccess.js | MaterialAccess, Student, Teacher | 10, 43-79, 95-111 |
| AuthContext.jsx | auth.me, updateMe, entities | 32, 44-51 |
| TopUpModal.jsx | auth.me, ShopSettings, Student, functions | 19-24, 46 |
| Layout.jsx, Login.jsx | auth | various |

**Grep scope:** 40+ файлов с `base44.entities` — полный список в audit/frontend.md.

---

## Callees (куда идут запросы)

```
base44Client.js
  → fetch /api/entities/*     (legacy)
  → fetch /api/auth/*         (typed)
  → fetch /api/functions/*    (serverless compat)

Future clients/*.js
  → fetch /api/v2/students
  → fetch /api/v2/payments
  → ...
```

---

## Data flow

### Flow 1: Manual payment + balance sync

```
Payments.jsx:16-24 load
  → GET entities/Payment?sort=-payment_date&limit=200
  → GET entities/Student

User submits PaymentModal
  → Payments.jsx:43-48 handleSave (create)
    → POST entities/Payment { student_id, amount, lessons_added, payment_date, ... }
    → PATCH entities/Student { lesson_balance: old + lessons_added }
  → load() refresh

Target (post migration):
  → POST /api/v2/payments (PaymentsService creates payment + adjusts balance in transaction)
  → UI only calls paymentsClient.create
```

### Flow 2: Lesson complete → balance deduct

```
Schedule.jsx:73-95 handleUpdate
  → PATCH entities/Lesson/:id { status: 'completed' }
  → For each student_id: PATCH entities/Student lesson_balance - 1

Conflict: JobsService autoCompleteExpiredLessons marks completed WITHOUT deduct (backend)
```

### Flow 3: Shop seed on first load

```
ShopSettingsAdmin.jsx:29-36
  → GET shop items empty
  → POST × 7 default packages/courses
  → Re-list

Target: POST /api/v2/shop-items/seed-defaults (admin) OR migration seed in backend
```

### Flow 4: User role assignment

```
UserManagement.jsx:149-197 changeRole
  → PATCH entities/User/:id { role: newRole }
  → If teacher: create/link Teacher record
  → If student: create/link Student record

Target:
  → PATCH /api/v2/users/:id/role (admin only, этап 4)
  → Backend orchestrates Teacher/Student provisioning
```

### Flow 5: Material access check

```
materialAccess.js:9-29 hasAccessToMaterial
  → POST entities/MaterialAccess/filter { user_id, material_id }
  → Client-side rule evaluation (ADMIN deny > allow > TEACHER allow)

Target:
  → GET /api/v2/material-access/check?user_id&material_id
  OR keep filter with RBAC on server
```

### Flow 6: Alfa Bank top-up (related)

```
TopUpModal.jsx:46-56
  → functions.invoke('alfaBankInit', { type, itemId, studentId, amount, returnUrl })
  ← res.data.redirectUrl
  → window.location.href redirect

functions client stays on base44.functions or dedicated paymentsFunctions client
```

---

## Проблемы (с номерами строк)

| # | Файл | Строки | Проблема |
|---|------|--------|----------|
| F1 | Payments.jsx | 31-48, 60-62 | Balance logic duplicated on UI; race if parallel edits |
| F2 | Schedule.jsx | 76-90 | Balance deduct on status change; inconsistent with auto-complete job |
| F3 | Schedule.jsx | 205-210 | STATUS_LABELS unused dead code |
| F4 | ShopSettingsAdmin.jsx | 32-34 | Auto-seed on empty — side effect in UI |
| F5 | UserManagement.jsx | 156 | Role change via generic User entity (no RBAC) |
| F6 | UserManagement.jsx | 376-387 | Cascade delete in UI — should be backend transaction |
| F7 | UserManagement.jsx | 387 | User.delete catch swallow — silent fail |
| F8 | AuthContext.jsx | 48-51 | updateMe({ role }) — privilege escalation |
| F9 | base44Client.js | 28 | Error shape mismatch with NestJS |
| F10 | base44Client.js | 103-105 | logout always /login not returnUrl |
| F11 | materialAccess.js | 122-133 | N+1 filter calls for materials list |
| F12 | materialAccess.js | — | Logic mirrors backend need; duplicate с future MaterialAccessService |
| F13 | WelcomePageEditor.jsx | 38 | Sends full form including potential read-only fields |
| F14 | Payments.jsx | 13 | deletingId state declared never used |
| F15 | base44Client.js | 75-81 | User in ENTITY_NAMES but User create blocked server-side |

---

## Legacy

| Pattern | Location | Replacement |
|---------|----------|-------------|
| `base44.entities.X` | 40+ files | `clients/x.js` |
| `createEntityClient` factory | base44Client.js:36-73 | Remove after migration |
| Snake_case manual in components | all pages | Typed JSDoc or TS interfaces |
| Client-side cascade delete | UserManagement.jsx:376-387 | DELETE /v2/students/:id cascade |
| Client-side balance | Payments.jsx, Schedule.jsx | Server-side in Payments/Lessons services |
| Role inference AuthContext | AuthContext.jsx:42-55 | Server assigns role on admin action |

---

## Delete / Replace

| Delete (этап 8) | Replace | Condition |
|-----------------|---------|-----------|
| `entities` in base44Client.js:83-86 | src/api/clients/* | grep base44.entities = 0 |
| Balance code Payments.jsx:31-48 | paymentsClient.create | v2 live |
| Shop seed ShopSettingsAdmin.jsx:32-34 | backend seed endpoint | one-time migration |
| materialAccess grant/revoke entity calls | materialAccessClient + v2 | RBAC on server |
| User.update role UserManagement:156 | usersClient.updateRole | admin API |

**Keep temporarily:** `base44.auth`, `base44.functions` until auth/functions refactored.

---

## Риски

| Рisk | Impact | Mitigation |
|------|--------|------------|
| Partial migration — two code paths | Bugs | Feature flag per page |
| Field name drift v2 vs UI | Silent UI breaks | Contract tests from this spec |
| Balance double-apply during migration | Wrong balances | Backend idempotent; UI stops PATCH student |
| Shop auto-seed removed without DB seed | Empty shop | Run migration script first |
| materialAccess N+1 | Slow materials hub | Batch check endpoint |

---

## Tests

### Manual checklist (P0 pages)

| Page | Test case | Expected |
|------|-----------|----------|
| Payments | Create payment 4 lessons | Balance +4 |
| Payments | Edit lessons_added 4→6 | Balance +2 |
| Payments | Delete payment | Balance -lessons_added |
| Schedule | Admin create lesson | Appears in calendar |
| Schedule | Mark completed | Balance -1 per student |
| ShopSettingsAdmin | First load | Items visible (seed or existing) |
| ShopSettingsAdmin | Toggle inactive | Hidden from TopUpModal filter |
| WelcomePageEditor | Save + reload | Text persisted |
| UserManagement | Change role → teacher | Teacher record linked |
| UserManagement | Delete student | Lessons/payments removed |

### Automated (recommended)

```javascript
// paymentsClient.test.js
// mock fetch → verify POST /api/v2/payments body snake_case
```

### Build verification

```bash
npm run build   # Vite frontend
grep -r "base44.entities" src/  # target: 0 after completion
```

---

## Новые client modules (создать)

### `src/api/clients/payments.js` (example signature)

| Method | Maps from | v2 endpoint |
|--------|-----------|-------------|
| list(sort, limit) | Payment.list | GET /v2/payments |
| create(data) | Payment.create | POST /v2/payments |
| update(id, data) | Payment.update | PATCH /v2/payments/:id |
| delete(id) | Payment.delete | DELETE /v2/payments/:id |

### `src/api/clients/students.js`

list, get, create, update, delete — mirror base44 entity client API for drop-in replacement.

### `src/api/index.js`

```javascript
export { paymentsClient } from './clients/payments';
export { studentsClient } from './clients/students';
// ...
export { base44 } from './base44Client'; // temporary
```

---

## Таблица изменений

| Файл | Строки | Причина | Результат | Побочные эффекты | Проверка |
|------|--------|---------|-----------|------------------|----------|
| `src/api/clients/payments.js` | NEW | v2 API | Typed payment client | — | Payments list |
| `src/api/clients/students.js` | NEW | v2 API | Typed student client | — | Schedule load |
| `src/api/clients/lessons.js` | NEW | v2 API | Typed lesson client | — | Schedule CRUD |
| `src/api/clients/shop.js` | NEW | v2 API | Shop CRUD | — | ShopSettingsAdmin |
| `src/api/clients/welcome.js` | NEW | v2 API | Welcome GET/PUT | — | WelcomePageEditor |
| `src/api/clients/users.js` | NEW | Admin users | Role endpoint | UserManagement | role change |
| `src/api/clients/materialAccess.js` | NEW | P1 materials | grant/revoke/check | materialAccess.js | access flow |
| `src/api/index.js` | NEW | Single import | Clean imports | — | build |
| `Payments.jsx` | 2, 18-61 | Migration | paymentsClient + studentsClient | Remove balance PATCH | manual payment |
| `Schedule.jsx` | 2, 30-98 | Migration | lessonsClient | Remove balance PATCH if server handles | complete lesson |
| `ShopSettingsAdmin.jsx` | 2, 31-69 | Migration | shopClient | Remove client seed | CRUD |
| `WelcomePageEditor.jsx` | 2, 25-40 | Migration | welcomeClient | — | save reload |
| `UserManagement.jsx` | 3, 142-387 | Migration | users/students/teachers clients | Cascade → API | role + delete |
| `lib/materialAccess.js` | 1, 10-111 | Migration | materialAccessClient | — | grant/revoke |
| `lib/AuthContext.jsx` | 48-51 | Security | Remove updateMe role | Needs admin API | login flow |
| `base44Client.js` | 75-86 | Cleanup (этап 8) | Remove entities factory | — | grep = 0 |

---

## Checklist

- [ ] `src/api/clients/payments.js` + tests
- [ ] `src/api/clients/students.js`, `lessons.js`, `teachers.js`
- [ ] `src/api/clients/shop.js`, `welcome.js`, `users.js`
- [ ] Migrate Payments.jsx — no direct Student balance PATCH
- [ ] Migrate Schedule.jsx
- [ ] Migrate ShopSettingsAdmin.jsx
- [ ] Migrate WelcomePageEditor.jsx
- [ ] Migrate UserManagement.jsx (all 3 tabs)
- [ ] Migrate materialAccess.js
- [ ] Fix AuthContext role inference (server-side)
- [ ] grep `base44.entities` → 0 in src/
- [ ] `npm run build` (Vite) OK

---

## Definition of Done

1. P0 страницы (Payments, Schedule, ShopSettingsAdmin, WelcomePageEditor, UserManagement) используют **только** v2 clients
2. Нет `base44.entities` в `src/` (grep = 0)
3. Balance changes идут через backend API, не PATCH Student из Payments/Schedule
4. Role assignment только через admin API
5. Auth login/logout/me работает
6. TopUpModal + alfaBankInit flow работает (functions может остаться)
7. Vite production build успешен

---

## Зависимости этапа

| Backend prerequisite | Frontend consumer |
|---------------------|-------------------|
| GET/POST/PATCH/DELETE /v2/payments | Payments.jsx |
| /v2/lessons | Schedule.jsx |
| /v2/shop-items | ShopSettingsAdmin, TopUpModal |
| GET/PUT /v2/welcome-page | WelcomePageEditor, Welcome.jsx |
| /v2/users + role endpoint | UserManagement AccountsTab |
| /v2/students, /v2/teachers | UserManagement tabs |
| /v2/material-access | materialAccess.js |
| PATCH /auth/me без role | AuthContext |

---

## Параллельная работа

| Agent A | Agent B | Agent C |
|---------|---------|---------|
| payments + Payments.jsx | lessons + Schedule.jsx | shop + ShopSettingsAdmin |
| welcome + WelcomePageEditor | users + UserManagement accounts | students/teachers tabs |

**Условие:** соответствующий v2 endpoint merged и deployed.

---

## Запрещено

- Удалять backend `/api/entities/*` до grep `base44.entities` = 0
- Удалять `base44.auth` до полной миграции auth client
- Менять localStorage token key без migration plan (breaks sessions)
- Вводить JSON storage на frontend для business entities
- Partial migrate Payments without removing balance PATCH (double-count risk during transition — coordinate with backend deploy)

---

## Порядок миграции страниц

```
1. src/api/clients/* + index.js (foundation)
2. Payments.jsx + PaymentModal (if separate entity calls)
3. ShopSettingsAdmin.jsx + TopUpModal (shop client)
4. WelcomePageEditor.jsx + Welcome.jsx
5. Schedule.jsx + LessonModal/LessonDetailModal
6. UserManagement.jsx (accounts → students → teachers)
7. materialAccess.js + Materials P1 pages
8. AuthContext.jsx (remove role updateMe)
9. Remaining 30+ files (P2 dashboards)
10. Remove base44.entities factory (этап 8)
```

---

## Связь с base44Client.js — полная карта entity clients

| ENTITY_NAMES entry | base44Client строка | Primary page(s) in spec |
|--------------------|---------------------|-------------------------|
| Payment | 76 | Payments.jsx |
| Student | 76 | Payments, Schedule, UserManagement |
| Teacher | 76 | Schedule, UserManagement |
| Lesson | 76 | Schedule, UserManagement |
| ShopSettings | 79 | ShopSettingsAdmin |
| WelcomePageSettings | 80 | WelcomePageEditor |
| User | 80 | UserManagement |
| MaterialAccess | 78 | materialAccess.js |
| Course | 76 | UserManagement cascade |

---

*Номера строк актуальны для файлов в `src/api/`, `src/pages/`, `src/lib/` по состоянию репозитория.*
