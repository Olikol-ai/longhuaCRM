# Stage 3 — Offline Read Audit (pre-implementation)

**Date:** 2026-08-13  
**Code changes in this document:** none  
**Depends on:** Stage 0 offline contracts · Stage 2 SW foundation · ADR-001

---

## Verdict of audit

Longhua CRM can support **read-mostly offline** for a **whitelist** of snapshots in IndexedDB, with PostgreSQL remaining the only SSOT.

**Not ready as-is:** no IndexedDB domain layer; pages use manual `useState` + `api.*`; React Query is mounted but almost unused; chat history is memory-only; logout clears JWT/session cache but has no offline store to wipe.

**Must not do in Stage 3:** outbox, offline send, SW API cache, Jitsi/PiP changes, balance/payment mutations offline, dual SSOT.

---

## 1. Current stack (relevant)

| Area | Finding | Offline impact |
|------|---------|----------------|
| **Service Worker** (`public/sw.js`) | Stage 2: API / socket / uploads / media / `access_token` / cross-origin **bypass**; HTML network-first; hashed assets cache-first | Correct for Stage 3 — **API must stay out of SW cache**; app owns IDB snapshots |
| **React Query** | `QueryClientProvider` in `App.jsx`; `src/lib/query-client.js`; **almost no `useQuery`/`useMutation`** | Do **not** migrate whole app. IDB = persistent read snapshot; RQ remains optional later hydrate |
| **HTTP** | `src/api/http.js` → `fetch('/api...')` + `Authorization: Bearer` from `localStorage` `longhua_access_token` | All domain reads go here; ideal single place for offline mutation block + network-failure signal |
| **Socket.IO** | `src/lib/chat-socket.js` → `io('/chat', { auth: { token }, reconnection: true })` | Leave alone; IDB only stores last chat **HTTP** snapshots |
| **Auth** | JWT in `localStorage`; session user memory cache in `src/lib/session-user.js`; `logout` → clear session + `setToken(null)` + redirect | Must add **IDB private wipe** on logout / account switch |
| **Video / Jitsi / PiP** | `VideoSessionContext`, `VideoSessionLayer`, Document PiP contracts | Online-only; offline layer must never touch |
| **Design System** | StatusPill, EmptyState, ErrorState; no OfflineStatus yet | Add one DS status strip / banner |

---

## 2. Storage inventory (today)

| Store | Keys / usage | User-scoped? | Stage 3 action |
|-------|--------------|--------------|----------------|
| `localStorage` | `longhua_access_token` (JWT) | Device-global token | **Never** put JWT in IndexedDB |
| `localStorage` | `theme` | Device | Keep |
| `localStorage` | Video mini-player prefs (`VideoSessionContext`) | Device UI | Keep; not domain SSOT |
| `localStorage` | PWA install dismiss | Device | Keep |
| `localStorage` | HSK exam drafts (`draftKey(sessionId)`) | Session-ish | Out of Stage 3 whitelist (exam take = online) |
| `sessionStorage` | Frontend update nav / chunk reload / events | Tab | Keep |
| `sessionStorage` | Materials browse UI (`longhua:materials:browse:${scope}:${userId}`) | Yes | Keep as UI prefs only |
| `sessionStorage` | Pending registration / invite / payment id | Transient | Keep |
| IndexedDB | **None** for CRM domains | — | **Create** `longhua-offline` |
| SW Cache API | Icons + hashed assets + nav fallback | Build-scoped | Unchanged (Stage 2) |

**Contract already present:** `chats-persistence.contract.test.js` forbids `localStorage.*messages` — offline chat must use **scoped IndexedDB**, not localStorage.

---

## 3. Domain feasibility matrix

| Domain | Primary UI | Primary API | Read offline? | Write offline? | Notes |
|--------|------------|-------------|---------------|----------------|-------|
| **Schedule / lessons** | `Schedule.jsx`, `TeacherSchedule.jsx`, `TutorSchedule.jsx`, `StudentLessons.jsx` | `api.lessons.list`, teachers/students/groups lists | **YES** (snapshot) | **NO** | Personal/role-scoped lesson rows; include companion lists in one snapshot blob |
| **Profile** | `Profile.jsx`, `Settings.jsx` | `auth` / users me | **YES** (name, avatar meta, role, basic settings) | **NO** (edit online) | Safe read |
| **Homework** | `HomeworkList`, `HomeworkViewer`, assignment pages | `api.homework.*` | **YES** (list + last opened detail if fetched) | **NO** submit/upload/grade/edit | Block mutations |
| **Materials** | `MaterialsHub`, `StudentLessonMaterials` | `api.materials`, folders | **YES** metadata only | **NO** upload/ACL/rename | Opening binary → online required |
| **Chat** | `Chats.jsx` + REST history | `chatsApi.list/messages` + socket | **YES** last N msgs **read-only** | **NO** send/edit/upload | No outbox (Stage 5). E2EE: store **API payload as returned** (ciphertext); do not store private keys in offline DB |
| **Balance** | Student dashboard / labels | `students.lesson_balance` via student entity | **YES** last known + “as of …” | **NO** | SSOT remains PostgreSQL |
| **Payments** | `Payments.jsx`, TopUp, Alfa | payments / alfabank | **YES** last list optional | **NO** create/change | Never cache mutation responses as authority |
| **Dashboard** | role dashboards | mixed | **PARTIAL** safe cards only | **NO** | Admin: read snapshot only; no CRUD |
| **Admin users/ACL** | `UserManagement`, etc. | users CRUD | **NO** mutations; minimal stats optional | **NO** | Max limited |
| **Video / Jitsi / PiP** | `LessonVideo`, VideoSession | video tokens, iframe | **NO** | **NO** | Bypass completely |
| **Certificates / exams / HSK** | many pages | assessment APIs | **NO** in V1 whitelist | **NO** | Online |
| **Telegram** | settings | telegram API | **NO** | **NO** | Online |
| **Notifications** | in-app | notifications API | **DEFER** V1 | **NO** | Store reserved, not required for PASS |

---

## 4. What is personal / sensitive

| Data | May cache offline? | Condition |
|------|--------------------|-----------|
| Own profile fields | Yes | Scoped `userId+role` |
| Own / role-visible schedule | Yes | Scoped; teachers must not see other teachers’ private payloads across accounts |
| Chat list + last N messages | Yes | Scoped; **no cross-user**; no JWT; attachments URLs with `access_token` **must not** be persisted as long-lived secrets — strip query tokens from cached attachment URLs or store message ids only for media |
| Materials metadata | Yes | Scoped to what API already returned under ACL |
| Homework list/status | Yes | Scoped |
| `lesson_balance` last known | Yes (display only) | Label as stale; never mutate |
| Payment create payloads | **No** | — |
| JWT / Authorization | **No** | Stay in localStorage only as today |
| Jitsi / WebRTC | **No** | — |
| Large PDF/video/audio/ZIP | **No** auto | Future pin mechanism |
| Admin full school dumps | **Avoid** | Only tiny dashboard snapshot if any |

---

## 5. React Query decision (Stage 3)

```
API (SSOT)  →  page fetcher / api.*  →  UI
                    ↓ on success
              IndexedDB snapshot
                    ↓ on network fail
                    UI (stale)
```

- **Do not** invent a second parallel cache beside IDB + ad-hoc `useState`.
- **Do not** force-migrate all pages to React Query in Stage 3.
- Optional later: RQ `placeholderData` from IDB — out of scope unless a single helper uses it.

---

## 6. Risks (FOUND → FIX)

| # | FOUND | RISK | FIX (Stage 3) |
|---|--------|------|----------------|
| 1 | No IDB layer | No offline read | Unified `src/lib/offline/*` |
| 2 | Logout does not clear IDB | Cross-account leak | Wipe user-scoped stores on logout / token clear |
| 3 | Unscoped localStorage domain caches | Leak / wrong user | Forbid; IDB keys include `userId` + `role` |
| 4 | Chat E2EE plaintext temptation | Sensitive disk cache | Cache API ciphertext payloads only; never private keys |
| 5 | Attachment URLs with `access_token` | Token on disk | Strip tokens before persist |
| 6 | `navigator.onLine` alone | False online | Combine with API failure → degraded |
| 7 | Mutation while offline | Fake success / corrupt UX | Central block on non-GET `apiFetch` / uploads + UI copy |
| 8 | SW accidentally caching API | Dual truth | Keep Stage 2 bypass (verify in tests) |
| 9 | Refresh during VideoSession | Lesson break | Offline recovery must not reload / touch VideoSession |
| 10 | Admin offline CRUD | Dangerous | No admin mutation paths offline |

---

## 7. V1 whitelist (implementation target)

**Stores in DB `longhua-offline` (versioned):**

- `metadata`
- `schedule`
- `chats`
- `materials`
- `homework`
- `profile`
- `balance` (read-only display snapshot)

**Not in V1:** `students` as separate store (embed needed companion data inside schedule snapshot), `notifications`, outbox, media blobs.

Each record: `{ key, userId, role, resource, data, updatedAt, source, expiresAt, schemaVersion }`.

---

## 8. Explicitly out of Stage 3

- Offline mutations / outbox / Background Sync / Web Push  
- Auth architecture change (cookies, refresh rotation)  
- API / PostgreSQL / ACL / roles / Telegram / Jitsi / Document PiP  
- Automatic large file caching  
- Second CRM SSOT in IndexedDB  

---

## 9. Manual QA (device) — deferred note

Full Chrome/Edge/Android/iOS matrix requires interactive devices. Audit marks these as **NOT VERIFIED in CI environment**; report must not claim PASS on device QA without evidence.

---

## 10. Proceed

Audit complete → implement unified offline read layer + wire whitelist pages + tests + report.
