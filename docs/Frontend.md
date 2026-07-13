# Frontend

React 18 + Vite 6 + Tailwind 3 + shadcn/ui (Radix). SPA с role-based routing.

## Структура

```
src/
├── api/                    # HTTP-клиент
│   ├── index.js            # export api { auth, students, … }
│   ├── http.js             # apiFetch, apiUpload, token
│   ├── domain-client.js    # CRUD factory + field aliases
│   ├── auth.js
│   ├── *.api.js            # доменные клиенты
│   ├── functions.js        # legacy RPC
│   ├── schedule.js
│   └── alfabank.js
├── pages/                  # Страницы
├── components/             # UI, auth guards, forms
├── lib/                    # AuthContext, routing, query-client, theme
├── App.jsx                 # Router root
├── Layout.jsx              # Sidebar
└── pages.config.js         # Реестр страниц для auto-routes
```

## Маршрутизация

Три координированных файла — см. [frontend-routing.md](./frontend-routing.md):

| Файл | Роль |
|------|------|
| `App.jsx` | `<Route>`, guards, lazy imports |
| `pages.config.js` | `PAGES` → `/{PageName}` |
| `lib/routing.js` | `ONBOARDING_PATH`, role home paths |

### Публичные
- `/login`
- `/auth/pending-approval` (`ONBOARDING_PATH`)

### Role entry → dashboard
- `/admin` → `/Dashboard`
- `/teacher` → `/TeacherDashboard`
- `/student` → `/StudentDashboard`

### Страницы из `pages.config.js`
`Dashboard`, `Profile`, `Schedule`, `Settings`, `StudentDashboard`, `StudentDetail`, `StudentLessons`, `TeacherDashboard`, `TeacherSchedule`, `Welcome`

### Отдельные маршруты в `App.jsx` (lazy-loaded)
`AdminLessonMaterials`, `MaterialsHub`, `StudentLessonMaterials`, `UserManagement`, `AdminPanel`, `Groups`, `Certificates`, `Attendance`, `TeacherPayments`

Guards: `AdminRoute`, `TeacherRoute`, `StudentRoute`, `RoleRouteGuard`.

## API-клиент

```javascript
import { api } from '@/api';

await api.auth.login(email, password);
const list = await api.students.list();
await api.uploads.uploadFile({ file });
```

**Правило:** не вызывать `fetch('/api/...')` вне `src/api/` (исключение — Playwright/e2e helpers).

### Экспорт `api` (`index.js`)
`auth`, `students`, `teachers`, `courses`, `groups`, `lessons`, `payments`, `certificates`, `materials`, `settings`, `users`, `notifications`, `teacherPayments`, `lessonSeries`, `functions`, `schedule`, `alfabank`, `uploads`, `files`

Token: `localStorage` key `longhua_access_token` (`TOKEN_KEY` в `http.js`).

## State

| Concern | Решение |
|---------|---------|
| Auth | `AuthContext` (`lib/AuthContext.jsx`) |
| Server data | TanStack Query (`lib/query-client.js`) |
| Theme | `ThemeContext` |

## Сборка и code splitting

`vite.config.js` — `manualChunks`:
- `vendor-react` — react-dom, react-router
- `vendor-ui` — radix, lucide
- `vendor-charts` — recharts, moment, date-fns
- `vendor-query` — @tanstack/react-query

`App.jsx` — `React.lazy` + `Suspense` для тяжёлых admin/teacher страниц (см. список выше).

```bash
npm run build:client   # → dist/
npm run preview
```

## Добавление страницы

1. `src/pages/MyPage.jsx`
2. Маршрут в `App.jsx` (с guard) **или** запись в `pages.config.js`
3. Пункт меню в `Layout.jsx`
4. Методы в `src/api/`

## E2E

```bash
npm run test:browser        # 8 specs
npm run test:browser:report # merge ui-issues → audit report
```

Конфиг: `playwright.config.ts`, тесты: `e2e/browser/`.
