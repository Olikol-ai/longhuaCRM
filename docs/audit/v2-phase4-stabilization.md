# LongHuaCRM v2 — Phase 4 Stabilization Audit

**Date:** 2026-07-12  
**Scope:** E2E tests, certificate PDF, lesson cancellation, enrollment progress UI  
**Build:** `npm run build` — pass  
**Tests:** `npm run test:e2e` — 8/8 pass (isolated DB `longhua_e2e`)

---

## 1. E2E Testing

### Infrastructure

| Item | Location |
|------|----------|
| Jest config | `apps/api/test/jest-e2e.json` |
| Env bootstrap | `apps/api/test/setup-env.ts` |
| Helpers | `apps/api/test/e2e-helpers.ts` |
| Business flows | `apps/api/test/business-flows.e2e-spec.ts` |
| Script | `npm run test:e2e` (root and `apps/api`) |

### Test database

- E2E uses isolated PostgreSQL database **`longhua_e2e`** (derived from `DATABASE_URL`).
- Schema is created via TypeORM `dropSchema` + `synchronize` when `NODE_ENV=test` and `E2E_SYNC_SCHEMA=true`.
- Dev database `longhua` is not modified during tests.

### Covered scenarios

| Flow | Tests |
|------|-------|
| **Auth** | Registration (pending → verify → login), admin login |
| **Student** | Create student, enrollment, group member, lesson, attendance, enrollment progress |
| **Teacher** | Teacher login, lesson complete, `GET /teacher-payments/my` |
| **Payment** | Offline payment request, AlfaBank webhook (checksum + balance) |
| **Certificate** | Draft → issue → `GET /certificates/:id/pdf` |
| **Lesson cancel** | Status cancelled, booking cancelled, attendance cancelled |

---

## 2. Certificate PDF

### Endpoint

`GET /api/certificates/:id/pdf` (JWT + access check)

### Service

`apps/api/src/modules/certificates/certificate-pdf.service.ts`

Uses **pdfkit** for PDF generation and **qrcode** for verification QR placeholder.

### PDF contents

- Student name  
- Course name  
- Registration number  
- Blank series / number  
- Issue date  
- Status  

### QR verification (prepared)

PDF embeds QR code and URL:

`{APP_PUBLIC_URL}/api/certificates/{id}/verify`

Verification endpoint is reserved for a future phase; URL structure is stable.

---

## 3. Lesson Cancellation

### Endpoint

`PATCH /api/lessons/:id/cancel` (admin, teacher)

### Behavior (`LessonsService.cancel`)

Transaction:

1. Lesson `status` → `cancelled`
2. Related `availability_bookings` → `cancelled`
3. Related `attendance_records` → `cancelled`

---

## 4. Enrollment Progress UI

### Backend (existing)

`GET /api/courses/enrollments/:id/progress`

### Frontend

- `src/api/courses.api.js` — `enrollmentProgress(id)`
- `src/pages/StudentDetail.jsx` — course progress cards with:
  - Completed lessons  
  - Missed lessons  
  - Remaining lessons  
  - Progress percentage (Progress bar)

---

## 5. Bug Fixes (discovered during stabilization)

### Teacher payment on lesson complete

`TeacherPaymentsService.createForCompletedLesson()` did not load teacher when called outside a transaction (e.g. from `LessonsService.complete()`). Fixed by injecting `TeacherEntity` repository.

### AlfaBank webhook balance

`PaymentsService.markPaidFromWebhook()` did not apply `lessonsAdded` when payment had no shop item. Fixed: apply balance when `lessonsAdded > 0` after package/course handling.

---

## 6. Dependencies Added

**Runtime (`apps/api`):**

- `pdfkit`
- `qrcode`

**Dev (`apps/api`):**

- `jest`, `ts-jest`, `@nestjs/testing`, `supertest`, related `@types/*`

---

## 7. Configuration Notes

| Variable | E2E default | Purpose |
|----------|-------------|---------|
| `E2E_DATABASE_URL` | `{base}/longhua_e2e` | Isolated test DB |
| `E2E_SYNC_SCHEMA` | `true` | Sync entities in test |
| `E2E_DROP_SCHEMA` | `true` | Fresh schema per run |
| `SERVE_FRONTEND` | `false` | API-only in tests |
| `ENABLE_CRON` | `false` | No cron in tests |
| `TELEGRAM_ENABLED` | `false` | No Telegram in tests |
| `ALFA_BANK_TOKEN` | `e2e-test-alfa-token` | Webhook checksum tests |

---

## 8. Verification Commands

```bash
npm run build
npm run test:e2e
```

Requires PostgreSQL reachable via `DATABASE_URL` (or `DB_*` vars). Test suite creates `longhua_e2e` automatically if missing.

---

## 9. Out of Scope (unchanged)

- Certificate public verify endpoint (`/certificates/:id/verify`)
- Individual lessons without series still do not update enrollment progress automatically
- Production migration path for legacy DBs (use `npm run migration:run` on deployed environments)
