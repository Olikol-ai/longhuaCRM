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
- `vendor-react` — **единый чанк** для всей React-экосистемы (см. ниже)
- `vendor-ui` — radix, lucide
- `vendor-charts` — recharts, moment, date-fns

`resolve.dedupe: ['react', 'react-dom']` и `optimizeDeps.include` — для dev/pre-bundle.

`App.jsx` — `React.lazy` + `Suspense` для тяжёлых admin/teacher страниц (см. список выше).

```bash
npm run build:client   # → dist/
npm run preview
```

### Vite bundle rules

The following packages must remain in the same vendor chunk (`vendor-react`):

- `react`
- `react-dom`
- `react-router`
- `react-router-dom`
- `scheduler`
- `@tanstack/react-query`
- `@tanstack/query-core`

**Reason:** React runtime must exist as a single instance. Separating these libraries into different `manualChunks` previously caused a white screen on startup due to runtime initialization order (`Cannot read properties of undefined (reading 'exports')`).

See the `IMPORTANT` comment in `vite.config.js` before changing chunking.

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
