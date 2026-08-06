---
phase: 4
slug: algorithm-browser-and-svg
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.8, run via `@angular/build:unit-test` (Angular 22's integrated builder) |
| **Config file** | none — builder-managed (`angular.json`'s `"test": { "builder": "@angular/build:unit-test" }`, no separate `vitest.config.ts`) |
| **Quick run command** | `npm test` (runs once and exits outside a TTY; `npm test -- --run` is not a valid flag on this builder — documented Phase 1 finding) |
| **Full suite command** | `npm test` (single suite, no quick/full split) |
| **Estimated runtime** | ~5-10 seconds (adds ~5 new spec files over Phase 3's baseline, still no browser/audio harness) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test` + `npm run build` + `npm run lint`
- **Before `/gsd-verify-work`:** `npm run build`, `npm test`, `npm run lint` all green (CLAUDE.md verification commands)
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner (not yet run at validation-strategy time). Rows below map
each phase requirement to its test per `04-RESEARCH.md` § Validation Architecture; the planner
fills in concrete Task ID/Plan/Wave when it creates PLAN.md, and execution updates Status.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-03 T1 | 04-03 | 3 | VIS-01 | — / — | N/A | component | `npm test` (`algorithms.spec.ts`, extended: 32 cards, group membership, ordering, link targets) | ✅ exists (extend) | ⬜ pending |
| 04-01 T1 | 04-01 | 1 | VIS-01 | — / — | N/A | routed-component | `npm test` (`algorithm-detail.spec.ts` — cold deep link to `/algorithms/1`) | ✅ exists | ✅ pass (04-01-SUMMARY) |
| 04-03 T2 | 04-03 | 3 | VIS-01 | — / — | N/A | routed-component | `npm test` (`algorithms.spec.ts` — in-app round trip following a rendered link) | ✅ exists (extend) | ⬜ pending |
| 04-04 T2 | 04-04 | 3 | VIS-01 | T-4-01 / validate `:id` with `isAlgorithmId` before lookup, render not-found state | Out-of-range/non-numeric route param rejected, no unhandled exception, no redirect, no clamping | routed-component | `npm test` (`algorithm-detail.spec.ts` — 10-segment rejected-input matrix + both accepted boundaries) | ✅ exists | ⬜ pending |
| 04-04 T2 | 04-04 | 3 | VIS-01 | T-4-04 / rejected segment echoed through text interpolation only | Reflected route segment cannot become markup or a URL | routed-component | `npm test` (`algorithm-detail.spec.ts`) | ✅ exists | ⬜ pending |
| 04-04 T1 | 04-04 | 3 | VIS-01 | — / — | N/A | routed-component | `npm test` (`algorithm-detail.spec.ts` — prev/next per D-04, both ends, same-route re-render, 1..32 sweep) | ✅ exists | ⬜ pending |
| 04-01 T3 | 04-01 | 1 | VIS-02 | — / — | N/A | component (unit) | `npm test` (`algorithm-diagram.spec.ts`, Alg 1 + Alg 32 fixtures — node/edge/output-bus counts) | ✅ exists | ✅ pass (04-01-SUMMARY) |
| 04-01 T3 | 04-01 | 1 | VIS-02 | — / — | N/A | component (unit) | `npm test` (`algorithm-diagram.spec.ts` — `<title>`/`<desc>`, `aria-labelledby`, instance+algorithm id uniqueness incl. `<marker>`) | ✅ exists | ✅ pass (04-01-SUMMARY) |
| 04-01 T2 | 04-01 | 1 | VIS-02 | — / — | N/A | pure-function unit | `npm test` (`describe-algorithm.spec.ts` — full edge enumeration per D-12, carriers, feedback, review-flag clause) | ✅ exists | ✅ pass (04-01-SUMMARY) |
| 04-01 T2 | 04-01 | 1 | VIS-02 | — / — | N/A | pure-function unit | `npm test` (`build-diagram-view-model.spec.ts` — node/edge geometry, Alg 32 zero-modulation case, invalid-id null contract) | ✅ exists | ✅ pass (04-01-SUMMARY) |
| 04-05 T1 | 04-05 | 4 | VIS-02 | — / — | N/A | component (unit) | `npm test` (`algorithm-diagram.coverage.spec.ts` — description, counts and id uniqueness across all 32) | ❌ W0 | ⬜ pending |
| 04-01 T3 | 04-01 | 1 | VIS-03 | — / — | N/A | component (unit) | `npm test` (`algorithm-diagram.spec.ts` — role shape/class, no assertion reads a color value) | ✅ exists | ✅ pass (04-01-SUMMARY) |
| 04-01 T3 | 04-01 | 1 | VIS-03 | — / — | N/A | component (unit) | `npm test` (`algorithm-diagram.spec.ts` — feedback self-loop distinct class and curved path) | ✅ exists | ✅ pass (04-01-SUMMARY) |
| 04-05 T1 | 04-05 | 4 | VIS-03 | — / — | N/A | component (unit) | `npm test` (`algorithm-diagram.coverage.spec.ts` — role encoding and feedback class across all 32) | ❌ W0 | ⬜ pending |
| 04-02 T1 | 04-02 | 2 | (supporting) | T-4-01 / `getAlgorithmLayout` guards with `isAlgorithmId` and returns null | Unvalidated id never indexes the layout map | pure-function unit | `npm test` (`algorithm-layout.spec.ts` — all 32 × 6 operators, grid membership, carrier row, downward flow, distinct positions, edge clearance, bounds, freezing, guard) | ✅ exists | ⬜ pending |
| 04-02 T2 | 04-02 | 2 | (supporting) | — / — | N/A | pure-function unit | `npm test` (`algorithm-layout.spec.ts` — all 32 build a complete view model with dataset-derived counts) | ✅ exists | ⬜ pending |
| 04-05 T2 | 04-05 | 4 | VIS-02 (manual) | — / — | N/A | human-verify checkpoint | manual — `npm start`, 32-diagram legibility pass, monochrome pass, keyboard-only journey, screen-reader spot check | n/a | ⬜ pending |

*Threat Ref T-4-01 is the only applicable threat this phase carries — see `04-RESEARCH.md` §
Security Domain: no auth/session/persistence/network surface, only the untrusted route `:id`
param (ASVS V5 Input Validation).*

---

## Wave 0 Requirements

- [ ] `src/app/domain/dx7/diagram/algorithm-layout.spec.ts` — layout-data completeness (all 32 ×
      6 operators); no phase requirement directly, but blocks VIS-02's fixture-driven diagram tests
      (file exists; Plan 04-02 verification still pending under only-04-01 execution authority)
- [x] `src/app/domain/dx7/diagram/build-diagram-view-model.spec.ts` — view-model correctness
      feeding VIS-02 (04-01 evidence: 04-01-SUMMARY)
- [x] `src/app/domain/dx7/diagram/describe-algorithm.spec.ts` — VIS-02's accessible-description
      requirement (D-11/D-12) (04-01 evidence: 04-01-SUMMARY)
- [x] `src/app/features/algorithms/algorithm-detail/algorithm-detail.spec.ts` — VIS-01 (first use
      of `RouterTestingHarness` in this codebase) (04-01 evidence: 04-01-SUMMARY)
- [x] `src/app/features/algorithms/algorithm-diagram/algorithm-diagram.spec.ts` — VIS-02/VIS-03
      (04-01 evidence: 04-01-SUMMARY)
- [ ] `src/app/features/algorithms/algorithm-diagram/algorithm-diagram.coverage.spec.ts` — added by
      planning: the same VIS-02/VIS-03 contract swept across all 32 algorithms (Plan 04-05 Task 1)
- [x] No new framework install needed — Vitest, `@angular/router/testing`, and jsdom are already
      present (`[VERIFIED: package.json]` per RESEARCH.md)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Aesthetic balance of each of the 32 hand-authored layouts | VIS-02 (D-05/D-06/D-07) | What remains after planning converted the mechanical part of "reads cleanly" into invariants: coincident node positions, off-grid coordinates, upward-flowing edges, carriers off the bottom band, edges passing within `NODE_RADIUS + 4` of an unrelated node, and out-of-canvas positions are all asserted in `algorithm-layout.spec.ts` (Plan 04-02 Task 1). Only the visual-quality judgment is left, which no unit test can make | Plan 04-05 Task 2 checkpoint: `npm start`, step `/algorithms/1` through `/algorithms/32` with the prev/next pager, and log any id needing a coordinate nudge |
| Non-color encoding survives a monochrome rendering | VIS-02, VIS-03 (D-08/D-09) | Tests assert `data-role`, class names and shape elements and deliberately read no color value, which proves the encoding does not *depend* on color but cannot prove the result is legible without it | Plan 04-05 Task 2 checkpoint: enable the browser's grayscale rendering emulation or the OS grayscale filter and confirm carrier/modulator and modulation/feedback remain distinguishable |
| Assistive-technology behaviour of the diagram | VIS-02 | Interactive operator nodes must remain discoverable; jsdom cannot answer how a real screen reader resolves SVG semantics and announcements | Plan 04-05 Task 2 checkpoint: VoiceOver spot check on `/algorithms/1` — confirm the full routing description is announced and that selecting an operator is announced via labelled, discoverable controls; record what was heard |
| Keyboard-only journey end to end | VIS-01, VIS-02 | Focus-ring visibility and the absence of a keyboard trap are properties of the running browser, not of the rendered DOM snapshot | Plan 04-05 Task 2 checkpoint: browse, activate a card, select an operator with Enter and Space, step with prev/next, all without the mouse |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
