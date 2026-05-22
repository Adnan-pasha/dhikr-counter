# Stability & Production Readiness Review

Date: 2026-05-22

## Executive summary
The app has improved materially and now includes runtime storage sanitization/migration, reminder dedupe, app-level error boundary recovery, and service-worker update UX. Remaining gaps are primarily around deeper runtime behavioral testing, telemetry, and further decomposition of large UI orchestrators.

## Current status snapshot

### Implemented
- Runtime persisted-state sanitization and schema migration bootstrap.
- Domain extraction for streak logic, reminder matching, and reminder occurrence dedupe.
- Reminder scheduler hook with visibility catch-up and multi-reminder matching support.
- App-level error boundary with reload/reset recovery options.
- Service-worker update prompt + `SKIP_WAITING` + `controllerchange` reload path.
- Baseline domain and regression tests for the above plumbing.

### Still pending
1. **Runtime behavioral tests (RTL/Playwright)** for user-visible flows, not only source assertions.
2. **Timezone/DST and long-background reminder semantics** with explicit product rules and tests.
3. **Further decomposition of large `App.tsx` orchestration** into focused hooks/services.
4. **Production telemetry/observability** (Sentry/OpenTelemetry) beyond `console.error`.
5. **A11y audit and CI automation** (axe) for keyboard/focus/contrast verification.

---

## Updated prioritized work items

## P0 (before wider user rollout)

### 1) Add runtime behavioral coverage for critical user journeys
**Why:** Existing tests validate logic and wiring but do not fully validate browser runtime behavior.

**Add:**
- Component tests (React Testing Library): counter increments, reminder toast flow, error-boundary fallback actions.
- E2E tests (Playwright): app boot, SW update acceptance, keyboard guard behavior, offline/online indicator.

### 2) Define reminder policy for missed notifications and timezone/DST edges
**Why:** Dedupe exists, but behavior expectations around device timezone changes and long inactive periods need explicit rules.

**Add:**
- Document product policy (e.g., whether to fire missed reminders on resume or only next due minute).
- Implemented baseline catch-up window policy (10 minutes) in domain logic; further DST/timezone scenario coverage remains.
- Add deterministic tests for DST transitions, midnight boundaries, and changed timezone offsets.

---

## P1 (strongly recommended)

### 3) Continue `App.tsx` decomposition
- Extract counter flow/history mutations to dedicated hooks.
- Keep `App.tsx` primarily composition and routing-level orchestration.

### 4) Add production telemetry
- Capture startup migration failures, reminder trigger outcomes, SW update actions, and render crashes.
- Add release-tagged error reporting and basic alert thresholds.

### 5) A11y baseline
- Add automated checks in CI for focus order, labels, and contrast.
- Manually verify keyboard navigation across tabs/modals.

---

## P2 (follow-on hardening)

### 6) Performance and bundle management
- Introduce lazy-loading for heavier tabs (Qibla/Prayer tools).
- Audit third-party dependency cost and dead code.

### 7) Security/ops hardening
- Formalize CSP and third-party media host allowlist.
- Add incident runbook for SW rollback/update issues.

---

## Release gates (updated)
- [x] Runtime schema validation + migration path for persisted data.
- [x] Reminder dedupe and foreground catch-up flow.
- [x] Error boundary + fallback UX.
- [x] SW update prompt and activation strategy.
- [ ] 20+ domain and component behavioral tests.
- [ ] 2–3 Playwright E2E critical journeys in CI.
- [ ] Telemetry + crash reporting configured.
- [ ] A11y baseline checks in CI.
- [ ] Lazy-loading strategy for heavy screens.

## Suggested next sprint sequence
1. **Days 1–3:** RTL behavioral tests + reminder policy docs.
2. **Days 4–6:** Playwright E2E flows (SW update, keyboard safety, startup).
3. **Days 7–9:** telemetry instrumentation + dashboards/alerts.
4. **Days 10–12:** further `App.tsx` hook extraction + a11y CI.
5. **Days 13–14:** performance/bundle split and release rehearsal.
