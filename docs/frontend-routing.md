# Frontend Routing

LongHuaCRM uses three coordinated files for routing. Do not consolidate them without a dedicated migration — each serves a distinct role.

## Source of truth by concern

| Concern | File | Role |
|---------|------|------|
| **Route registration** | `src/App.jsx` | Declares React Router `<Route>` elements, role guards, redirects |
| **Page component registry** | `src/pages.config.js` | Maps page name → component for routes generated from `PAGES` |
| **Path helpers & access rules** | `src/lib/routing.js` | Role home paths, onboarding path, `getRequiredRoleForPath()` |

**Primary entry for new authenticated pages:** `src/App.jsx` (add a `<Route>` with the appropriate guard).

**Secondary entry (simple CRUD-style pages):** add a file under `src/pages/` and register it in `pages.config.js` if it should appear at `/{PageName}` with layout wrapper.

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
| Others in `PAGES` | No extra guard (shared) |

### 3. Manual routes (`App.jsx`)

These pages exist under `src/pages/` but are **not** in `pages.config.js`:

| Path | Component | Guard |
|------|-----------|-------|
| `/AdminLessonMaterials` | `AdminLessonMaterials` | Admin |
| `/MaterialsHub` | `MaterialsHub` | Teacher |
| `/StudentLessonMaterials` | `StudentLessonMaterials` | Student |
| `/UserManagement` | `UserManagement` | Admin |
| `/AdminPanel` | `AdminPanel` | Admin |

`AdminPanel` embeds tab pages: `Analytics`, `Salary`, `ExportData`, `ShopSettingsAdmin`, `WelcomePageEditor`, `TelegramSettings`, `AdminSettings`.

### 4. Redirects & legacy paths

| Path | Behavior |
|------|----------|
| `/Welcome` | Redirect → `/auth/pending-approval` |
| `/Students`, `/students` | Redirect → `/UserManagement` |
| `/Attendance`, `/LessonSeriesAdmin` | Redirect → `/Groups` |
| `/Groups/:groupId` | Карточка группы (расписание, ученики, посещаемость) |
| `/`, `/admin`, `/teacher`, `/student` | Role home redirects via `RoleHomeRedirect` |
| `*` (authenticated) | `OnboardingFallback` |

Legacy path constants remain in `lib/routing.js` for guard checks (e.g. `/Students`).

## Role routing helpers (`lib/routing.js`)

- `ONBOARDING_PATH` — `/auth/pending-approval`
- `ROLE_ENTRY_PATHS` — short aliases (`/admin`, `/teacher`, `/student`)
- `ROLE_DASHBOARD_PATHS` — dashboard URLs per role
- `getRequiredRoleForPath()` — used by `RoleRouteGuard`
- `resolveRedirect()` — post-login redirect target

## Teacher dashboard naming

Two distinct UIs (not duplicates):

| File | Route / usage |
|------|----------------|
| `pages/TeacherDashboard.jsx` | `/TeacherDashboard` — full teacher home with lesson actions |
| `components/dashboard/TeacherRoleDashboard.jsx` | Embedded in `pages/Dashboard.jsx` when `user.role === 'teacher'` |

## Adding a new page (checklist)

1. Create `src/pages/MyPage.jsx`
2. Choose registration:
   - **Simple layout page:** add to `pages.config.js` `PAGES` and role guard list in `App.jsx` if needed
   - **Custom path or guard:** add explicit `<Route>` in `App.jsx`
3. If path-based access control is required, extend `getRequiredRoleForPath()` in `lib/routing.js`
4. Add navigation link in `Layout.jsx` if the page should appear in the sidebar
