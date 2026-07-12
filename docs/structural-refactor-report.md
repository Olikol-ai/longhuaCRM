# Structural Refactor Report

Date: 2026-06-28  
Scope: structural cleanup per Structural Audit Report — no business logic, API contract, or database schema changes.

---

## 1. What was fixed

### Stage 1 — UploadsModule
- **No change required.** Module already exists at `apps/api/src/modules/uploads/` with `uploads.module.ts` and `uploads.controller.ts`. Referenced correctly from `AppModule`.

### Stage 2 — MaterialAccessCheckService duplicate provider
- `EntitiesModule` remains the **owner** of `MaterialAccessCheckService` (already exported).
- `SecureFilesModule` now imports `EntitiesModule` via `forwardRef` and **no longer registers** `MaterialAccessCheckService` locally.
- `EntitiesModule` ↔ `SecureFilesModule` circular import resolved with `forwardRef` on both sides.

### Stage 3 — RolesGuard duplicate providers
- Added global `GuardsModule` (`apps/api/src/common/guards/guards.module.ts`) exporting a single `RolesGuard` instance.
- Removed `RolesGuard` from `providers` in: `EntitiesModule`, `UsersModule`, `JobsModule`, `TelegramModule`, `UploadsModule`.
- Registered `GuardsModule` in `AppModule`.

### Stage 4 — Entity filename normalization
- Renamed 25 PascalCase entity files to **kebab-case** `*.entity.ts` (e.g. `AlfaBankOrder.entity.ts` → `alfabank-order.entity.ts`).
- Updated `crm.entities.ts`, `index.ts`, and all import paths under `apps/api/src/`.
- Fixed internal cross-entity import in `payment.entity.ts` (`./student.entity`).

### Stage 5 — Frontend dead code removed
Deleted files with zero inbound imports:
- `src/components/students/StudentDetailModal.jsx`
- `src/components/students/BuyLessonsModal.jsx`
- `src/components/materials/AccessManageModal.jsx`
- `src/components/schedule/LessonFormDialog.jsx`
- `src/components/dashboard/LessonCard.jsx`

### Stage 6 — TeacherDashboard naming conflict
- **Kept both UIs** (different behavior; no UI merge).
- Renamed `components/dashboard/TeacherDashboard.jsx` → `TeacherRoleDashboard.jsx` (used from `pages/Dashboard.jsx`).
- `pages/TeacherDashboard.jsx` remains the route page at `/TeacherDashboard`.

### Stage 7 — Frontend routing documentation
- Added routing comments to `pages.config.js`, `App.jsx`, `lib/routing.js`.
- Created `docs/frontend-routing.md`.

### Stage 8 — Empty directories removed
- `scripts/` (root)
- `apps/api/scripts/`
- `apps/api/src/types/`

### Stage 9 — Module boundaries documentation
- Created `docs/architecture/module-boundaries.md`.

### Stage 10 — Build verification
- `npm run build` (API + Vite) — **success**.

---

## 2. Changed files

### Backend — added
| File |
|------|
| `apps/api/src/common/guards/guards.module.ts` |
| `docs/frontend-routing.md` |
| `docs/architecture/module-boundaries.md` |
| `docs/structural-refactor-report.md` |

### Backend — modified
| File | Change |
|------|--------|
| `apps/api/src/app.module.ts` | `GuardsModule` import |
| `apps/api/src/modules/entities/entities.module.ts` | `forwardRef(SecureFilesModule)`, removed `RolesGuard` |
| `apps/api/src/modules/files/secure-files.module.ts` | `forwardRef(EntitiesModule)`, removed duplicate service |
| `apps/api/src/modules/users/users.module.ts` | removed `RolesGuard` |
| `apps/api/src/modules/jobs/jobs.module.ts` | removed `RolesGuard` |
| `apps/api/src/modules/telegram/telegram.module.ts` | removed `RolesGuard` |
| `apps/api/src/modules/uploads/uploads.module.ts` | removed `RolesGuard` |
| `apps/api/src/entities/crm.entities.ts` | kebab-case export paths |
| `apps/api/src/entities/index.ts` | kebab-case import paths |
| `apps/api/src/entities/payment.entity.ts` | internal import fix |
| ~30 module/service files | entity import path updates |

### Backend — renamed (entities)
All CRM entity files under `apps/api/src/entities/` from PascalCase to kebab-case (except `user.entity.ts` and `pending-registration.entity.ts` which were already correct).

### Frontend — modified
| File | Change |
|------|--------|
| `src/pages/Dashboard.jsx` | import `TeacherRoleDashboard` |
| `src/pages.config.js` | routing doc comment |
| `src/App.jsx` | routing doc comment |
| `src/lib/routing.js` | routing doc comment |

### Frontend — renamed
| From | To |
|------|-----|
| `src/components/dashboard/TeacherDashboard.jsx` | `src/components/dashboard/TeacherRoleDashboard.jsx` |

### Frontend — deleted
See Stage 5 list above.

### Directories removed
`scripts/`, `apps/api/scripts/`, `apps/api/src/types/`

---

## 3. Remaining technical debt

| Item | Notes |
|------|-------|
| **Dual TeacherDashboard UIs** | Different components by design; documented in `docs/frontend-routing.md` |
| **EntitiesModule hub coupling** | Still central; documented as legacy compatibility layer |
| **Parallel verification services** | `VerificationEmailService` + `PendingRegistrationService` — intentional dual flow |
| **Legacy auth endpoints** | `verify-code`, `resend-code` kept for backward compatibility |
| **Legacy public-settings** | Duplicated in `AuthController` and `LegacyController` |
| **~31 unused shadcn/ui components** | Scaffold; intentionally not removed |
| **`pages/Welcome.jsx`** | Registered but `/Welcome` redirects to onboarding |
| **Orphan mappers** | `shop.mapper.ts`, `welcome.mapper.ts` without dedicated modules |
| **Repository pattern inconsistency** | Only 2 `*.repository.ts` files; rest use services |
| **Windows git index casing** | Filesystem uses kebab-case; run `git add -A apps/api/src/entities/` before commit on Windows |

---

## 4. Changes intentionally NOT made

- No business logic changes in services or controllers
- No API route or payload changes
- No database migrations or entity class/table renames
- No new TypeORM entities
- No JSONB → relational migration
- No shadcn/ui component cleanup
- No routing rewrite (only documentation + comments)
- No merge of `pages/TeacherDashboard.jsx` and `TeacherRoleDashboard.jsx` (would change UI)
- No `shop` / `welcome` module extraction
- No consolidation of `VerificationEmailService` / `PendingRegistrationService`

---

## 5. Verification

```bash
npm run build          # OK — nest build + vite build
```

Checks performed:
- No TypeScript compilation errors
- No missing entity imports after kebab-case rename
- Single `MaterialAccessCheckService` provider (via `EntitiesModule` export)
- Single global `RolesGuard` provider (via `GuardsModule`)
- Frontend dead components removed; routes unchanged
