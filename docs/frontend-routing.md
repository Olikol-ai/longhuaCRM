# Frontend Routing

LongHuaCRM uses three coordinated files for routing. Do not consolidate them without a dedicated migration — each serves a distinct role.

## Source of truth by concern

| Concern | File | Role |
|---------|------|------|
| **Route registration** | `src/App.jsx` | Declares React Router `<Route>` elements, role guards, redirects |
| **Page component registry** | `src/pages.config.js` | Maps page name → component for routes generated from `PAGES` |
| **Path helpers & access rules** | `src/lib/routing.js` | Role home paths, onboarding path, **ROUTE_ACCESS allowlist**, guards |

**Menu visibility (`Layout.jsx`) is not security.** Hiding a nav item never grants or denies access. SPA enforcement is:

1. `RoleRouteGuard` — checks `isPathForbiddenForUser()` against `EXACT_ROUTE_ACCESS` / `PREFIX_ROUTE_ACCESS`
2. Per-route `AdminRoute` / `TeacherRoute` / `StudentRoute` / `TutorRoute` / `PathAccessGuard` — `RoleGuard` shows **403 Forbidden** page on deny
3. Backend `@Roles` + ownership services — primary ACL for all API calls

Unauthorized direct URL → `src/pages/Forbidden.jsx` (403 UX), not a silent redirect that looks like a bug.

**Primary entry for new authenticated pages:** `src/App.jsx` (add a `<Route>` with the appropriate guard) **and** add the path to `EXACT_ROUTE_ACCESS` (or `PREFIX_ROUTE_ACCESS`) in `src/lib/routing.js`.

**Secondary entry (simple CRUD-style pages):** add a file under `src/pages/` and register it in `pages.config.js` if it should appear at `/{PageName}` with layout wrapper — still must be allowlisted in `routing.js`.

## How routes are created

### 1. Public routes (`App.jsx` outer router)

- `/login` → `Login`
- `/auth/pending-approval` → `PendingApproval` (onboarding)
- `*` → `AuthenticatedApp`

### 2. Auto-registered pages (`pages.config.js` → `App.jsx`)

`Object.entries(Pages)` creates routes at `/{PageName}` with `LayoutWrapper` and optional role guards:

| Page key | Guard |
|----------|-------|
| `Dashboard`, `Schedule`, `StudentDetail` | `AdminRoute` |
| `TeacherDashboard`, `TeacherSchedule` | `TeacherRoute` |
| `StudentDashboard`, `StudentLessons` | `StudentRoute` |
| Others in `PAGES` | Outer `RoleRouteGuard` + allowlist (still enforced) |

### 3. Manual routes (`App.jsx`)

These pages exist under `src/pages/` but are **not** in `pages.config.js`:

| Path | Component | Guard |
|------|-----------|-------|
| `/AdminLessonMaterials` | `AdminLessonMaterials` | Teacher+Tutor (shared materials) |
| `/MaterialsHub` | `MaterialsHub` | Teacher+Tutor |
| `/StudentLessonMaterials` | `StudentLessonMaterials` | Student |
| `/UserManagement` | `UserManagement` | Admin |
| `/AdminPanel` | `AdminPanel` | Admin |
| `/AssessmentQuestions` … `/AssessmentExams` | Assessment authoring | Teacher+Tutor (+admin) |
| `/HomeworkList` … | Homework | Teacher+Tutor |
| `/HomeworkViewer` | Homework viewer | Student / tutor_student |

`AdminPanel` embeds tab pages: `Analytics`, `Salary`, `ExportData`, `ShopSettingsAdmin`, `WelcomePageEditor`, `TelegramSettings`, `AdminSettings`. There is **no** standalone `/Salary` route — opening unknown paths shows 403.

### 4. Redirects & legacy paths

| Path | Behavior |
|------|----------|
| `/Welcome` | Redirect → `/auth/pending-approval` |
| `/Students`, `/students` | Redirect → `/UserManagement` |
| `/Attendance`, `/LessonSeriesAdmin` | Redirect → `/Groups` |
| `/Groups/:groupId` | Карточка группы |
| `/`, `/admin`, `/teacher`, `/student`, `/tutor` | Role home redirects |
| `*` (authenticated) | `OnboardingFallback` → 403 if role known |

Legacy path constants remain in `lib/routing.js` for guard checks (e.g. `/Students`).

## Role routing helpers (`lib/routing.js`)

- `ONBOARDING_PATH` — `/auth/pending-approval`
- `ROLE_ENTRY_PATHS` — short aliases (`/admin`, `/teacher`, `/student`, `/tutor`, `/tutor-student`)
- `ROLE_DASHBOARD_PATHS` — dashboard URLs per role
- `getAllowedRolesForPath()` / `isPathAllowedForUser()` / `isPathForbiddenForUser()` — **SPA ACL**
- `getRequiredRoleForPath()` — deprecated single-role helper for diagnostics
- `resolveRedirect()` — post-login redirect target

Unknown authenticated paths return an empty allowlist → **denied** (forces explicit registration).

## Role matrix (high level)

| Area | admin | teacher | tutor | student | tutor_student |
|------|-------|---------|-------|---------|---------------|
| AdminPanel / Users / Salary tabs | ✓ | ✗ | ✗ | ✗ | ✗ |
| TeacherAssessment / Teacher* | ✓ | ✓ | ✗ | ✗ | ✗ |
| TutorStats / Tutor* | ✓ | ✗ | ✓ | ✗ | ✗ |
| Assessment Questions / Blocks / Exams | ✓ | ✓ | ✓ | ✗ | ✗ |
| Materials / Homework (manage) | ✓ | ✓ | ✓ | ✗ | ✗ |
| HSK Academy (learner) | ✓ | ✓ | ✗ | ✓ | ✗ |
| Exam Content / HSK bank (staff) | ✓ | ✓ | ✗ | ✗ | ✗ |
| HomeworkViewer | ✗ | ✗ | ✗ | ✓ | ✓ |
| StudentDashboard | ✗ | ✗ | ✗ | ✓ | ✗ |

Owner scoping (own entities only) is enforced on the **API**, not by the menu.

## Adding a new page (checklist)

1. Create the page component under `src/pages/`
2. Register a `<Route>` in `App.jsx` with `AdminRoute` / `TeacherRoute` / etc.
3. Add the path to `EXACT_ROUTE_ACCESS` (or a prefix rule) in `src/lib/routing.js`
4. Optionally add a nav item in `Layout.jsx` (cosmetic only)
5. Ensure the NestJS controller uses `@Roles` + ownership checks
6. Add/extend a contract test in `src/lib/routing.acl.contract.test.js` if the matrix changes
