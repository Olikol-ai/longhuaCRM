# STAGE 3 REPORT

**Date:** 2026-08-13  
**Scope:** Offline read / IndexedDB / read-mostly offline model  
**SSOT:** PostgreSQL / API only — IndexedDB is a local read cache  
**Out of scope:** Offline mutations, outbox, Web Push, Background Sync, auth rewrite, Stage 4+

---

## Audit

Document: `docs/architecture/stage-3-offline-read-audit.md`

Findings (pre-implementation):

- No domain IndexedDB; React Query mounted but almost unused; manual `api.*` fetch on pages
- SW Stage 2 correctly bypasses API/socket/uploads — keep it that way
- Chat history memory-only; contract forbids `localStorage` messages
- Logout cleared JWT/session only — no offline wipe
- Video / Jitsi / PiP must stay untouched

---

## Architecture

```
ONLINE:  API → UI → IndexedDB snapshot
OFFLINE: IndexedDB snapshot → UI
RECOVER: network OK → background refetch → replace snapshot (no full reload)
```

- Layer: `src/lib/offline/*` (single DB `longhua-offline`)
- Status UI: Design System `OfflineStatus` + `OfflineStatusController`
- Mutations: blocked in `apiFetch` / uploads via `assertOnlineForMutation`
- React Query: **not** migrated wholesale; IDB is the persistent read snapshot

---

## IndexedDB schema

| Item | Value |
|------|--------|
| DB name | `longhua-offline` |
| Version | `1` |
| Stores | `metadata`, `schedule`, `chats`, `materials`, `homework`, `profile`, `balance` |
| Record key | `{userId}::{role}::{resource}::{resourceKey}` |
| Fields | `key`, `userId`, `role`, `resource`, `resourceKey`, `data`, `updatedAt`, `expiresAt`, `source`, `schemaVersion` |
| TTL default | 7 days (UI stale warning after 1 hour) |

---

## Offline resources

| Resource | Strategy | Wired |
|----------|----------|-------|
| Schedule (admin/teacher/tutor/student) | Snapshot of last successful load | Yes |
| Chat list + last ≤100 messages / chat | Read-only snapshot | Yes |
| Materials metadata (folders + list meta) | Snapshot; no binaries | Yes |
| Homework list / my assignments | Snapshot | Yes |
| Profile self | Snapshot on Profile load | Yes |
| Lesson balance | Last known display + “as of …” | Student dashboard |

---

## Explicitly forbidden offline operations

- Send / edit chat; outbox
- Homework submit / upload / grade / delete / edit
- Materials open/download/upload/ACL mutations (open blocked with clear message)
- Payments create/change; balance mutations
- Admin users CRUD / lesson edits / ACL
- Jitsi / WebRTC / Socket.IO persistence
- JWT / Authorization / `access_token` URLs in IDB
- Large media auto-cache

Central enforcement: non-GET `apiFetch` + uploads throw `OfflineMutationError` when offline/degraded.

---

## Security

| Check | Status |
|-------|--------|
| User isolation (`userId` in key) | Covered by tests |
| Role isolation | Covered by tests |
| Logout / account switch wipe | `clearAllOfflineData` / `ensureOfflineUserScope` |
| No JWT in IDB | Sanitizer strips auth fields |
| `access_token` stripped from URLs | Tests |
| No SW API cache | Stage 2 bypass + contract |
| Chat not in unscoped localStorage | Existing + Stage 3 contracts |

---

## Video / Jitsi safety

- Offline layer does not import or call VideoSession / Jitsi / PiP
- Recovery toast / status strip does not reload the document
- `shouldDeferAppReload` still respected for recover toast during lesson
- Socket.IO reconnect logic unchanged

**Device mid-lesson offline:** NOT VERIFIED in this environment.

---

## Tests

| Suite | Result |
|-------|--------|
| `src/lib/offline/offline.contract.test.js` (22) | PASS |
| `npm run test:unit` (240) | PASS |

Covers: IDB init, schema markers, write/read, TTL, user/role isolation, logout cleanup, account switch, sanitize, materials meta, chat cap, stale labels, offline→online refresh, API fail→snapshot, mutation block, wiring contracts, SW bypass, PiP untouched, no outbox.

---

## Build

`npm run build` — **PASS** (API + client).

---

## Manual QA

| Scenario | Status |
|----------|--------|
| Desktop Chrome/Edge online→offline→online matrix | **NOT VERIFIED** (no interactive browser session here) |
| Android Chrome / iOS Safari PWA | **NOT VERIFIED** |
| Live Jitsi + Document PiP during offline/recover | **NOT VERIFIED** |

Automated contracts + build verified. Device matrix must be run on real clients before production confidence.

---

## Remaining limitations

1. Not every CRM page is wired (exams, certificates, admin CRUD pages stay online-only by design).
2. Student materials page may rely on shared `MaterialManager` path; dedicated student materials UX may need a follow-up pass if separate loaders exist.
3. E2EE chat: caches API payloads as returned (ciphertext scrubbed of tokens); private keys not stored in offline DB.
4. `navigator.onLine` supplemented by fetch failures → degraded; perfect flaky-network detection is best-effort.
5. No offline write / Stage 5 outbox.

No intentional P0/P1 left open in Stage 3 code path from the audit whitelist.

---

## FINAL VERDICT

**STAGE 3 — PASS**

(with explicit caveat: full device Manual QA matrix = **NOT VERIFIED** in this environment; do not treat that as done.)
