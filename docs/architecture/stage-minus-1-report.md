# Stage −1 Report — Design System 2.0 + Unified Event Architecture

**Date:** 2026-08-13  
**Scope:** Architecture + DS foundation scaffold  
**Out of scope:** PWA, Push, Offline, API/business/auth/Jitsi/Telegram changes

---

## Executive verdict

Stage −1 delivers the **product foundation**: audited UI debt, Design System 2.0 SSOT under `src/design-system/`, Event Bus design, ADR-001 (PWA primary / Expo not a second product), and a prioritized migration plan. **PWA Stage 0 must not start until this report is accepted.**

---

## 1. Full UI audit

See detailed findings in [design-system-2.0.md](./design-system-2.0.md) §1–2.

**Snapshot:** ~80 pages, ~49 shadcn primitives, 100+ domain components, ~165 Lucide consumers, dual button systems, no shared Empty/Error/Loading patterns, mobile = responsive desktop (`Layout.jsx`), warm-remapped `slate-*` still used as a parallel palette, video/chat/assessment shells invent local chrome.

---

## 2. Inconsistencies (short list)

- Semantic tokens vs `slate-*` / ad-hoc emerald/rose
- `Button` vs raw `<button>`
- Card padding / radius / shadow without named scales
- Icon size chaos (`h-4`…`h-6`)
- Typography reinvented per page (+ separate learner scale)
- Loading / empty / error reinvented
- Multiple badge/status systems
- Tables & dialogs inconsistently responsive
- No role-specific mobile IA yet

---

## 3. Design System structure

Implemented scaffold: `src/design-system/` (tokens, primitives, patterns, domain cards).  
Canonical doc: [design-system-2.0.md](./design-system-2.0.md).  
Enforcement: `.cursor/rules/design-system.mdc`.

---

## 4. Event Bus structure

Canonical doc: [event-bus.md](./event-bus.md).  
Principle: **one domain event → many channel handlers** (in-app, Telegram, future Web Push, activity, audit).  
No runtime wiring in Stage −1.

---

## 5. ADR

[ADR-001 — Primary Client = PWA](./adr-001-primary-client-pwa.md) — **Accepted**.

---

## 6. Migration plan

Strangler waves W0–W10 in [design-system-2.0.md](./design-system-2.0.md) §6.  
W0 = foundation (this stage). W1+ = journey-based page migration.

---

## 7. Migration priorities

| Priority | Waves | Journeys |
|----------|-------|----------|
| P0 | W1–W3 | Auth shell, dashboards, schedule, chats chrome |
| P1 | W4–W7 | Materials, homework, payments/certs, assessment shells |
| P2 | W8–W9 | Video chrome tokens, UserManagement |
| P3 | W10 | Long-tail admin / public verify |

---

## 8. Components to reuse

- `src/components/ui/*` via DS wrappers  
- `PageShell`, `PageHeader`, `ResponsiveTable`, `ResponsiveDialog`  
- `StatCard` → analytics domain card  
- Brand CSS variables; Lucide; existing Badge/Button CVA  
- Safe-area + touch utilities  

---

## 9. Pages / areas unchanged for now

- All business/API/auth/role/Jitsi/Telegram behavior  
- Untouched pages until their wave (still runnable)  
- `JitsiLessonEmbed` internals, E2EE crypto guts  
- `apps/mobile` feature growth (**frozen** per ADR-001)  

---

## 10. Risks

Documented in [design-system-2.0.md](./design-system-2.0.md) §9 and [event-bus.md](./event-bus.md).  
Top risks: dual UI during migration; agents inventing styles; video/PiP regression if chrome rewritten carelessly; event migration duplicating Telegram sends if not idempotent.

---

## Delivered artifacts

| Artifact | Path |
|----------|------|
| ADR-001 | `docs/architecture/adr-001-primary-client-pwa.md` |
| Design System spec | `docs/architecture/design-system-2.0.md` |
| Event Bus spec | `docs/architecture/event-bus.md` |
| This report | `docs/architecture/stage-minus-1-report.md` |
| DS code SSOT | `src/design-system/**` |
| Agent rule | `.cursor/rules/design-system.mdc` |
| CSS tokens | `--lh-*` in `src/index.css` |

---

## Readiness for Stage 0 (PWA)

| Check | Status |
|-------|--------|
| ADR accepted | Pending product confirmation |
| DS public API importable | Yes — `@/design-system` |
| New screen can be composed without new visuals | Yes (primitives + patterns + domain cards) |
| Event Bus designed | Yes (implementation later) |
| PWA / Push / Offline code | **Not started** (correct) |

**Next allowed step after acceptance:** Stage 0 — Architectural preparation for PWA (still no Push/Offline product features until their stages).
