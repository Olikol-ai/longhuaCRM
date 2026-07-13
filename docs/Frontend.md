# Frontend

React 18 + Vite 6 + Tailwind + shadcn/ui (Radix). SPA с role-based routing.

## Структура

```
src/
├── api/              # HTTP-клиент (единая точка входа: index.js)
├── pages/            # Страницы приложения
├── components/       # Переиспользуемые компоненты
│   ├── auth/         # Guards, modals
│   └── ui/           # shadcn primitives
├── lib/              # AuthContext, routing, query-client, theme
├── App.jsx           # Router root
├── Layout.jsx        # Sidebar navigation
└── pages.config.js   # Auto-registered pages
```

## Маршрутизация

Источник правды: `docs/frontend-routing.md`, `src/lib/routing.js`, `App.jsx`.

- Публичные: `/login`, `/auth/pending-approval`
- Admin: `/Dashboard`, `/AdminPanel`, `/UserManagement`, `/Groups`, …
- Teacher: `/TeacherDashboard`, `/TeacherSchedule`, `/MaterialsHub`
- Student: `/StudentDashboard`, `/StudentLessons`

Guards: `AdminRoute`, `TeacherRoute`, `StudentRoute`, `RoleRouteGuard`.

## API-клиент

Все запросы через `src/api/`:

```javascript
import { api } from '@/api';

const students = await api.students.list();
await api.auth.login({ email, password });
```

- `http.js` — `apiFetch`, JWT token, error shape
- `domain-client.js` — фабрика CRUD для доменов
- Каждый домен: `students.api.js`, `lessons.api.js`, …

**Правило:** не использовать raw `fetch('/api/...')` вне `src/api/`.

## State management

- **Auth** — только `AuthContext` (`src/lib/AuthContext.jsx`)
- **Server state** — TanStack Query (`src/lib/query-client.js`)
- **Theme** — `ThemeContext`

## Сборка и code splitting

Vite config: `vite.config.js` — manual chunks для vendor/react/ui.

Lazy routes для тяжёлых admin-страниц (AdminPanel, UserManagement, MaterialsHub) через `React.lazy`.

```bash
npm run build:client   # → dist/
npm run preview        # локальный preview
```

## Стили

Tailwind + `class-variance-authority`. Компоненты UI в `src/components/ui/`.

## Добавление страницы

1. Создать `src/pages/MyPage.jsx`
2. Добавить в `pages.config.js` (или auto-register если настроено)
3. При необходимости — route + guard в `App.jsx`
4. Пункт меню в `Layout.jsx`
5. API methods в `src/api/`

## Формат компонента (конвенция)

```jsx
export default function MyPage() {
  const { data, isLoading } = useQuery({ queryKey: ['my'], queryFn: () => api.domain.list() });
  // ...
}
```

- Именованные export default для страниц
- Loading/error states через Query или локальный state
- Формы: react-hook-form + zod где сложная валидация

## E2E

```bash
npm run test:browser
```

Playwright: `e2e/browser/`, webServer в `playwright.config.ts`.
