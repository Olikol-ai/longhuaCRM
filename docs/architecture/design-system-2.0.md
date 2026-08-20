# Longhua Design System 2.0

**Status:** Foundation (Stage −1)  
**SSOT path:** `src/design-system/`  
**Primitives (legacy shadcn):** `src/components/ui/` — allowed only via Design System wrappers for **new** UI  
**Related:** [ADR-001](./adr-001-primary-client-pwa.md) · [Stage −1 report](./stage-minus-1-report.md)

---

## 1. Frontend audit summary

| Metric | Finding |
|--------|---------|
| Pages | ~80 under `src/pages/` |
| UI primitives (`components/ui`) | ~49 shadcn/Radix files |
| Domain components | 100+ under `src/components/{video,chats,materials,assessment,…}` |
| Lucide icon imports | ~165 files |
| `Button` imports | ~110 files |
| Raw `<button>` | ~70+ files (esp. `UserManagement`, schedule modals, `FolderTree`, video) |
| `slate-*` usage | Widespread; Tailwind remaps slate to warm neutrals, but pages still bypass semantic tokens (`bg-card`, `text-muted-foreground`) |
| Empty states | Inline copy in 30+ pages — no shared `EmptyState` |
| Loading | `AuthLoadingScreen` spinner, ad-hoc `animate-spin`, `Skeleton`, page-level text — inconsistent |
| Error | `AppErrorBoundary`, `Forbidden`, toasts, inline red text — inconsistent |
| Responsive shell | Good seeds: `PageShell`, `PageHeader`, `ResponsiveTable`, `ResponsiveDialog` |
| Mobile | Layout uses `lg:` + safe-area utilities — **adapted desktop**, not separate mobile IA |
| Video | Dedicated control chrome in `components/video/*` — not yet tokenized |
| Charts | `components/ui/chart.jsx` + page-level Recharts styling |
| Parallel mobile app | `apps/mobile` — **not** DS consumer (ADR-001) |

### Hottest inconsistency hotspots

| Area | Evidence |
|------|----------|
| User management | Heavy `slate-*`, many raw buttons (`UserManagement.jsx`) |
| Schedule / lessons | Mixed modal styling (`LessonModal`, `LessonDetailModal`, calendar) |
| Assessment / HSK | Parallel shells (`HskAcademyShell`, `ExamContentShell`, focus chrome) |
| Materials | Mix of `Button` + raw `<button>` in tables/folder tree |
| Video | Custom floating controls, separate from CRM button variants |
| Auth loading | Hard-coded spinner in `lib/auth-gate.jsx` |

### What already works (reuse)

- Brand CSS variables in `src/index.css` (`--brand-*`, semantic HSL tokens)
- Tailwind `brand.*` + remapped `slate`
- `Button` CVA variants: default, secondary, outline, ghost, destructive, gold, link + touch sizes
- `Badge` variants including success/warning/gold
- `Card` family, `Dialog` / `AlertDialog` / `Sheet` / `Drawer`
- `PageShell` / `PageHeader` / `ResponsiveTable` / `ResponsiveDialog`
- `StatCard`, certificate/assessment status badges
- Safe-area utilities (`.safe-pt`, `.safe-pb`, …)
- Touch targets (`min-h-touch`, `--touch-min: 44px`)

---

## 2. Inconsistencies catalog (must eliminate over migration)

1. **Two color languages:** semantic tokens (`bg-primary`, `text-brand`) vs raw `slate-*` / `emerald-*` / `rose-*` in pages.
2. **Button dualism:** `Button` vs raw `<button className="…">` with one-off paddings.
3. **No FAB / IconButton product API** — only `size="icon"`; video reinvented controls.
4. **Card padding:** `p-6` default vs `p-4` / `p-5` / bare bordered divs.
5. **Radius:** `rounded-md` / `xl` / `2xl` / `full` without a named scale in product code.
6. **Shadows:** `shadow` / `shadow-sm` / `shadow-md` / none — no elevation ladder.
7. **Icon sizes:** `h-4 w-4` / `h-5 w-5` / `h-6 w-6` / arbitrary — no `icon.size`.
8. **Typography:** ad-hoc `text-xl sm:text-2xl font-bold` vs learner-content scale vs page titles.
9. **Loading:** spinner CSS duplicated; skeletons optional; no `PageLoading` contract.
10. **Empty / error:** copy + icons reinvented per page.
11. **Tables:** some `ResponsiveTable`, many custom HTML tables.
12. **Dialogs:** `Dialog` vs `ResponsiveDialog` vs custom full-screen panels vs bottom-ish sheets inconsistently.
13. **Status badges:** `Badge`, `CertificateStatusBadge`, `LifecycleBadge`, `StatusBadges`, presence dots — parallel systems.
14. **Navigation:** single `Layout.jsx` sidebar — no bottom nav / role-specific mobile IA yet (concept only in Stage −1).

---

## 3. Proposed structure (SSOT)

```
src/design-system/
├── index.js                 # Public API — import ONLY from here in new screens
├── tokens/
│   ├── index.js
│   ├── spacing.js           # 8pt grid
│   ├── radius.js
│   ├── shadow.js
│   ├── motion.js
│   ├── icon.js
│   └── typography.js
├── primitives/              # Thin wrappers over components/ui
│   ├── Button.jsx
│   ├── IconButton.jsx
│   ├── Fab.jsx
│   ├── Input.jsx
│   ├── Textarea.jsx
│   ├── SearchField.jsx
│   ├── Card.jsx
│   ├── Badge.jsx
│   ├── Avatar.jsx
│   ├── Dialog.jsx
│   ├── AlertDialog.jsx
│   ├── Sheet.jsx
│   └── Table.jsx
├── patterns/
│   ├── Typography.jsx
│   ├── EmptyState.jsx
│   ├── ErrorState.jsx
│   ├── Spinner.jsx
│   ├── PageLoading.jsx
│   ├── SkeletonBlock.jsx
│   └── StatusPill.jsx
├── domain/                  # Domain cards — compose primitives only
│   ├── LessonCard.jsx
│   ├── HomeworkCard.jsx
│   ├── MaterialCard.jsx
│   ├── PaymentCard.jsx
│   ├── CertificateCard.jsx
│   ├── StudentCard.jsx
│   ├── TeacherCard.jsx
│   └── AnalyticsCard.jsx
├── navigation/              # Contracts + early shells (mobile concepts)
│   └── README.md            # IA by role — implement in Mobile UX stage
└── video/
    └── README.md            # Control token map — implement without Jitsi changes
```

### Layers

| Layer | Rule |
|-------|------|
| **Tokens** | Only place for spacing/radius/shadow/type/icon scales |
| **Primitives** | Interactive atoms; wrap `components/ui`; no business data |
| **Patterns** | Empty/Loading/Error/Typography/Status — product-wide |
| **Domain** | Cards/lists tied to entities; no fetch; props-in |
| **Pages** | Compose DS only; no new visual inventions |

### Forbidden for new code

- Copy-pasting `className` stacks for buttons/cards from old pages
- New button variants outside `primitives/Button.jsx`
- Importing `@/components/ui/*` directly from **new** pages (use `@/design-system`)
- Growing `apps/mobile` UI as a second DS consumer

---

## 4. Token scales (8pt grid)

| Token | Value | Use |
|-------|-------|-----|
| `space.0` | 0 | — |
| `space.1` | 4px | hair gaps |
| `space.2` | 8px | dense |
| `space.3` | 12px | compact |
| `space.4` | 16px | default |
| `space.5` | 24px | section |
| `space.6` | 32px | block |
| `space.8` | 48px | hero / FAB margin |

| Radius | Value |
|--------|-------|
| `none` | 0 |
| `sm` | 6px |
| `md` | 8px (`--radius`) |
| `lg` | 12px |
| `xl` | 16px |
| `pill` | 9999px |

| Shadow | Use |
|--------|-----|
| `none` | flat |
| `sm` | inputs / subtle |
| `md` | cards |
| `lg` | dialogs / FAB |

| Icon size | px |
|-----------|-----|
| `sm` | 16 |
| `md` | 20 |
| `lg` | 24 |
| `xl` | 28 |

CSS mirrors live under `:root` as `--lh-space-*`, `--lh-radius-*`, `--lh-shadow-*` (additive — does not rewrite legacy pages overnight).

---

## 5. Component catalog (target)

### Buttons

`Primary` · `Secondary` · `Ghost` · `Danger` · `Gold` · `IconButton` · `FAB`  
Sizes: `sm` · `md` · `lg` (map to existing CVA + touch rules)

### Inputs

`Text` · `Number` · `Password` · `Search` · `Textarea` · `Autocomplete` (Command-based)

### Cards (domain)

Student · Teacher · Lesson · Homework · Material · Payment · Certificate · Analytics

### Tables

Desktop · Tablet card-list · Mobile — build on `ResponsiveTable`

### Dialogs

Alert · Confirm · Modal · Fullscreen · Bottom Sheet · Drawer — map to AlertDialog / Dialog / Sheet / Drawer

### Badges / Status

Success · Warning · Danger · Info · Neutral + domain status (lesson, payment, homework, online)

### Typography

`H1` `H2` `H3` `Body` `Caption` `Label` (+ keep `.learner-*` for study content)

### Loading / Empty / Error

Skeleton · Spinner · PageLoading · Button loading  
Empty presets: lessons, materials, messages, homework, certificates, results  
Error presets: network, 403, 404, 500, validation

### Navigation (concept — Stage Mobile UX)

| Role | Mobile | Desktop |
|------|--------|---------|
| Student | Bottom nav: Home, Schedule, Chats, Materials, Profile | Compact sidebar |
| Teacher | Bottom nav: Today, Schedule, Students, Chats, More | Dense sidebar + multi-pane |
| Admin | Drawer + priority hubs | Full sidebar |

Thumb zone, safe areas, Dynamic Island, gestures, bottom sheets — **specified here**, implemented in later UX stages without adapting desktop layouts.

### Video / Charts

Tokenized control surfaces and chart colors from `--chart-*` / brand — no Jitsi API changes in Stage −1.

---

## 6. Migration plan (pages)

### Strategy

**Strangler:** new screens and touched screens must use `@/design-system`. Untouched pages keep working. No big-bang rewrite.

### Phases

| Wave | Scope | Priority |
|------|-------|----------|
| **W0** | Tokens + primitives + patterns landed; cursor rule enforced | Done in Stage −1 |
| **W1** | Shell: Login, dashboards (`Student`/`Teacher`/`Admin`), Profile, Settings | P0 |
| **W2** | Schedule + lesson modals + StudentLessons | P0 |
| **W3** | Chats list/composer chrome (not E2EE/crypto) | P0 |
| **W4** | Materials hub/tables | P1 |
| **W5** | Homework list/viewer | P1 |
| **W6** | Payments / certificates | P1 |
| **W7** | Assessment + HSK shells unify on DS patterns | P1 |
| **W8** | Video control chrome → DS video tokens | P2 |
| **W9** | UserManagement / Admin dense tables | P2 |
| **W10** | Long-tail admin (shop, telegram settings, series) | P3 |

### Gate per wave

`npm run build` · smoke of migrated routes · no visual inventiveness in PR · report.

---

## 7. Reuse vs replace

| Reuse as-is (wrap) | Evolve | Do not fork |
|--------------------|--------|-------------|
| `components/ui/*` | Wrap in `design-system/primitives` | Duplicate Button/Card |
| `PageShell`, `PageHeader` | Re-export from DS | New page padding systems |
| `ResponsiveTable/Dialog` | Become DS table/dialog | Per-page table CSS |
| `StatCard` | → `AnalyticsCard` / keep alias | New KPI card styles |
| Status badge helpers | Merge into `StatusPill` | Third badge system |
| Lucide icons | Enforce size tokens | Mixed icon packs |
| Brand CSS variables | Extend with `--lh-*` | New color hex in JSX |

---

## 8. Pages intentionally unchanged (for now)

Until their migration wave:

- Jitsi embed internals (`JitsiLessonEmbed`) — behavior frozen
- E2EE chat crypto UI internals (unlock flows stay; chrome migrates later)
- Certificate PDF/print views (content layout may stay; chrome migrates)
- One-off public `CertificateVerify` marketing-ish layout (wave P3)
- `apps/mobile/**` — frozen per ADR-001

Business logic, API clients, auth, roles: **unchanged** by Design System work.

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Dual systems during migration look “half old” | Wave by user journey, not random files |
| Agents keep inventing styles | `.cursor/rules/design-system.mdc` alwaysApply |
| Wrappers add bundle weight | Thin re-exports; tree-shake via barrel discipline |
| Token rename breaks Tailwind | Additive `--lh-*`; migrate class usage gradually |
| Domain cards become data-fetching | Strict props-in / no API in `domain/` |
| Video redesign regresses PiP | Video wave after control token map; no Jitsi changes |

---

## 10. Readiness criterion

A developer can open a **new** screen and assemble it from `@/design-system` (tokens, primitives, patterns, domain cards) **without inventing new visual treatments**.

Legacy pages may still contain old patterns until their wave. **PWA Stage 0 starts only after Stage −1 artifacts + DS scaffold are accepted.**
