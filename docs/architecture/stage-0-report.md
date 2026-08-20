# Stage 0 Report — PWA Architecture Preparation

**Date:** 2026-08-13  
**Scope:** Engineering preparation only  
**Code changes:** None (documentation)  
**Full document:** [stage-0-pwa-preparation.md](./stage-0-pwa-preparation.md)

---

## Verdict

Architecture is **ready to start Stage 1 (PWA identity)** after your confirmation.  
Offline / Push / Background Sync must **not** start until Event Bus + storage/SW contracts from Stage 0 are followed.

---

## 1. Architecture map

See full doc §1 — Vite PWA primary client over Nest/PostgreSQL SSOT; Socket.IO chats; Jitsi external; Telegram as future bus handler.

---

## 2. Readiness matrix (summary)

| READY | PARTIAL | NOT READY |
|-------|---------|-----------|
| React/Vite, Router, guards, lazy+chunk recovery, DS 2.0 | Manifest/SW seed, JWT storage, Socket, Jitsi leave-alone, materials media, Telegram/notifiers, RQ unused | Event Bus impl, App Shell protocol, Offline IDB, Push, Outbox, Install UX, Mobile/Desktop shells |

---

## 3. Stage 1 plan

Unify build/SW/manifest versions → complete manifest (shortcuts/screenshots) → install QA → report. **No Offline/Push.**

## 4. Stage 2 plan

SW class strategies (shell/assets; bypass API/socket/Jitsi) → update protocol with `frontendUpdate.js` → contract tests → Jitsi/chat smoke.

---

## 5. Risks (top)

SW caching API · stale HTML/chunks · dual Telegram+Push without bus · JWT XSS · iOS Push/BgSync limits · E2EE offline cache

---

## 6. Must change before feature stages

Version stamp (before Stage 1) · SW matrix (Stage 2) · IDB+RQ for offline · Event Bus before Push · Outbox before sync

---

## 7. Must NOT change

Business logic · API contracts (except additive later) · roles · Jitsi session model · Telegram protocol · payments · materials ACL · PostgreSQL SSOT

---

## 8. Keep as-is (correct)

Network-first HTML · no API in SW · chunk single auto-reload · socket singleton · lazy+vendor-react rule · DS 2.0 · ADR-001 · Event Bus design · safe-area tokens

---

**Awaiting confirmation to begin Stage 1.**
