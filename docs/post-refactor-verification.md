# Post-Refactor Verification

Date: 2026-06-28  
Scope: read-only verification after structural refactor. No code changes performed during this check.

---

## Summary

| Area | Result |
|------|--------|
| Nest module cycle (Entities ↔ SecureFiles) | **PASS** (managed via `forwardRef`) |
| Duplicate `RolesGuard` providers | **PASS** |
| Duplicate `MaterialAccessCheckService` providers | **PASS** |
| Entity imports (`apps/api/src`) | **PASS** |
| Entity barrel files (`crm.entities.ts`, `index.ts`, `data-source.ts`) | **PASS** |
| Migrations entity imports | **PASS** |
| Frontend dead component imports | **PASS** |
| Frontend `TeacherDashboard` references | **PASS** |
| Backend build (`npm run build:api`) | **PASS** |
| Frontend build (`npm run build:client`) | **PASS** |

**Overall: PASS** — refactor goals verified; no blocking issues found.

---

## 1. Nest module cycle: EntitiesModule ↔ SecureFilesModule

| | |
|---|---|
| **Result** | **PASS** |
| **Files** | `apps/api/src/modules/entities/entities.module.ts`, `apps/api/src/modules/files/secure-files.module.ts`, `apps/api/src/app.module.ts` |
| **Finding** | Import cycle exists: `EntitiesModule` → `forwardRef(SecureFilesModule)` and `SecureFilesModule` → `forwardRef(EntitiesModule)`. Both modules are also registered in `AppModule`. |
| **Service-level check** | `MaterialAccessCheckService` depends only on `MaterialAccessEntity` repository. It does **not** inject `SecureFilesService`. `SecureFilesService` injects `MaterialAccessCheckService` from `EntitiesModule` export. No service-level circular DI detected. |
| **Recommendation** | Keep `forwardRef` on both sides. Optional long-term improvement: extract `MaterialAccessModule` owned by entities domain to reduce bidirectional module coupling (not required now; build and DI graph are healthy). |

---

## 2. Duplicate providers

### RolesGuard

| | |
|---|---|
| **Result** | **PASS** |
| **Files** | `apps/api/src/common/guards/guards.module.ts`, `apps/api/src/app.module.ts` |
| **Finding** | Single registration: `@Global()` `GuardsModule` with one `RolesGuard` in `providers` + `exports`. No duplicate `RolesGuard` in `EntitiesModule`, `UsersModule`, `JobsModule`, `TelegramModule`, or `UploadsModule`. |
| **Recommendation** | None. Controllers may continue using `@UseGuards(JwtAuthGuard, RolesGuard)` — guard class reference does not require per-module provider registration when global. |

### MaterialAccessCheckService

| | |
|---|---|
| **Result** | **PASS** |
| **Files** | `apps/api/src/modules/entities/entities.module.ts`, `apps/api/src/modules/files/secure-files.module.ts` |
| **Finding** | Registered once in `EntitiesModule.providers` and exported. `SecureFilesModule` does **not** list `MaterialAccessCheckService` in `providers`; it obtains the service via `forwardRef(() => EntitiesModule)` import. |
| **Recommendation** | None. Singleton behavior restored as intended. |

---

## 3. Entity imports after kebab-case rename

### data-source.ts

| | |
|---|---|
| **Result** | **PASS** |
| **File** | `apps/api/src/database/data-source.ts` |
| **Finding** | Uses `ALL_ENTITIES` from `../entities` (barrel). No direct PascalCase entity file paths. |
| **Recommendation** | None. |

### crm.entities.ts

| | |
|---|---|
| **Result** | **PASS** |
| **File** | `apps/api/src/entities/crm.entities.ts` |
| **Finding** | All 20 re-exports use kebab-case paths (e.g. `./alfabank-order.entity`, `./student.entity`). No `./alfaBankOrder.entity` or PascalCase paths. |
| **Recommendation** | None. |

### index.ts

| | |
|---|---|
| **Result** | **PASS** |
| **File** | `apps/api/src/entities/index.ts` |
| **Finding** | Direct imports and `ALL_ENTITIES` array reference kebab-case files only. Exports via `crm.entities` barrel are consistent. |
| **Recommendation** | None. |

### Migrations

| | |
|---|---|
| **Result** | **PASS** |
| **Files** | `apps/api/src/database/migrations/*.ts` (20 files) |
| **Finding** | Migrations use inline SQL / query builder. **Zero** imports from `entities/*.entity.ts`. Rename does not affect migrations. |
| **Recommendation** | None. |

### Full API source scan

| | |
|---|---|
| **Result** | **PASS** |
| **Files** | All `apps/api/src/**/*.ts` |
| **Finding** | No remaining imports matching `entities/[A-Z]*.entity` or `alfaBankOrder.entity`. `entity-registry.ts` imports from `crm.entities` barrel (kebab-case paths). Internal cross-entity import in `payment.entity.ts` uses `./student.entity`. |
| **Git / filesystem** | `git ls-files apps/api/src/entities/*.entity.ts` lists 27 kebab-case files; filesystem matches git index. |
| **Recommendation** | On Linux CI, kebab-case names avoid prior Windows casing issues. Ensure commits include entity renames (`git add -A apps/api/src/entities/`). |

---

## 4. Frontend verification

### Deleted components — import check

| | |
|---|---|
| **Result** | **PASS** |
| **Files checked** | `StudentDetailModal.jsx`, `BuyLessonsModal.jsx`, `AccessManageModal.jsx`, `LessonFormDialog.jsx`, `LessonCard.jsx` |
| **Finding** | Files **not present** on disk (`Test-Path` → false). Grep across `src/` finds **zero** import statements referencing these paths. |
| **Recommendation** | None. Deletion from stage 5 refactor is effective. |

### TeacherDashboard references

| | |
|---|---|
| **Result** | **PASS** |
| **Files** | `src/pages/TeacherDashboard.jsx`, `src/components/dashboard/TeacherRoleDashboard.jsx`, `src/pages/Dashboard.jsx`, `src/pages.config.js`, `src/App.jsx`, `src/lib/routing.js`, `src/Layout.jsx` |
| **Finding** | `components/dashboard/TeacherDashboard.jsx` **removed** (not on disk). `Dashboard.jsx` imports `TeacherRoleDashboard`. Route page `pages/TeacherDashboard.jsx` remains for `/TeacherDashboard`. References in `routing.js`, `App.jsx`, `pages.config.js`, `Layout.jsx` point to the **route key** `/TeacherDashboard`, not the removed component file. No stale import `dashboard/TeacherDashboard`. |
| **Recommendation** | None. Naming split (page vs embed component) is consistent. |

---

## 5. Build verification

### Backend build

| | |
|---|---|
| **Result** | **PASS** |
| **Command** | `npm run build:api` |
| **Exit code** | 0 |
| **Finding** | `nest build` completed without TypeScript errors after entity rename and module refactor. |
| **Recommendation** | None. |

### Frontend build

| | |
|---|---|
| **Result** | **PASS** |
| **Command** | `npm run build:client` |
| **Exit code** | 0 |
| **Finding** | `vite build` completed without errors. |
| **Recommendation** | None. |

---

## 6. Non-blocking observations (informational)

| Result | File | Problem | Recommendation |
|--------|------|---------|----------------|
| INFO | `docs/audit/entities.md`, `docs/refactor-plan.md`, other roadmap docs | Documentation still references old PascalCase entity filenames (`Student.entity.ts`, `alfaBankOrder.entity.ts`) | Update docs in a separate documentation pass; does not affect runtime or build |
| INFO | `EntitiesModule` ↔ `SecureFilesModule` | Structural import cycle remains (intentionally managed) | Monitor if new shared services increase coupling; consider `MaterialAccessModule` extraction in future refactor |
| INFO | `AppModule` | Imports both `SecureFilesModule` and `EntitiesModule` at root | Valid NestJS pattern; `forwardRef` handles initialization order |

---

## 7. Verification commands used

```bash
npm run build:api
npm run build:client
git ls-files apps/api/src/entities/*.entity.ts
# ripgrep: RolesGuard, MaterialAccessCheckService in *.module.ts
# ripgrep: entities/[A-Z], deleted component imports, TeacherDashboard paths
# Test-Path for deleted frontend files
```

---

## 8. Conclusion

Structural refactor verification **PASS**. The project builds cleanly on backend and frontend. Provider deduplication is effective. Entity import paths are normalized under kebab-case in runtime code. Frontend has no broken imports from deleted components or renamed dashboard component.

No automatic fixes applied during this verification.
