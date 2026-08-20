# ADR-001 — Primary Client = PWA; Expo is not a second product

**Status:** Accepted  
**Date:** 2026-08-13  
**Stage:** −1 (foundation, before PWA implementation)  
**Deciders:** Product / Architecture (Longhua Platform)

## Context

Longhua is evolving from a CRM SPA into a commercial educational platform. Two client surfaces already exist:

1. **Vite React web** (`src/`) — full product (admin, teacher, student, tutor), production traffic.
2. **Expo React Native** (`apps/mobile/`) — scaffold (mocked login, placeholder screens).

Building both as full UIs would duplicate Design System, business flows, and create permanent drift.

## Decision

1. **Primary client = installable PWA** on the existing Vite React app.
2. **Expo is not developed as a separate full product.** No parallel screen/feature parity work.
3. If a future **App Store / Play Store** release is required, Expo (or equivalent) becomes a **thin native shell** over the same platform (WebView / shared API contracts), **not** a second UI implementation.
4. **Design System 2.0** and **Unified Event Bus** are mandatory foundations **before** PWA stages (0+).
5. All new UI must be composed from Design System 2.0. Ad-hoc page styling is forbidden for new work.

## Consequences

### Positive

- Single UX and Design System SSOT.
- One place to ship chat, video, materials, exams.
- PWA install / push / offline invest in one codebase.
- Clear rule for agents and humans: do not grow `apps/mobile` feature surface.

### Negative / trade-offs

- Native-only APIs (some background sync, iOS push nuances) are constrained by web capabilities until a shell exists.
- Existing Expo scaffold becomes documentation/reference only until a shell decision.

### Explicit non-goals (until Stage 0+)

- Implementing Push, Offline, Background Sync, or install UX in this ADR.
- Changing auth, roles, Jitsi, Telegram, or API contracts as part of Stage −1.

## Related

- [Design System 2.0](./design-system-2.0.md)
- [Unified Event Bus](./event-bus.md)
- [Stage −1 report](./stage-minus-1-report.md)
