---
phase: 2
slug: algorithm-domain
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-04
validated: 2026-08-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.8, run via `@angular/build:unit-test` (Angular 22's integrated builder) |
| **Config file** | none — builder-managed (`angular.json`'s `"test": { "builder": "@angular/build:unit-test" }`, no separate `vitest.config.ts`) |
| **Quick run command** | `npm test` (runs once and exits outside a TTY; `npm test -- --run` is not a valid flag on this builder — documented Phase 1 finding) |
| **Full suite command** | `npm test` (single suite, no quick/full split yet) |
| **Estimated runtime** | ~5 seconds (small domain-only suite, no browser/audio harness) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run build`, `npm test`, `npm run lint` all green (CLAUDE.md verification commands)
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | DOMAIN-01 | — / — | N/A | unit | `npm test` (`algorithms.spec.ts`) | ✅ | ✅ passed |
| 02-01-02 | 01 | 0 | DOMAIN-02 | — / — | N/A | unit | `npm test` (`validate-algorithm.spec.ts`) | ✅ | ✅ passed |
| 02-01-03 | 01 | 0 | DOMAIN-03 | — / — | N/A | unit | `npm test` (`derive-role.spec.ts`) | ✅ | ✅ passed |
| 02-01-04 | 01 | 0 | DOMAIN-04 | — / — | N/A | static + unit | `npm run build` + `npm test` + `npm run lint` | ✅ | ✅ passed |

*No threat model applies — this phase has no network, auth, or user-input surface (see RESEARCH.md § Security Domain). Threat Ref column is N/A throughout.*

---

## Wave 0 Requirements

- [x] `src/app/domain/dx7/models/modulation-edge.ts` + `.spec.ts` — new type, no existing file
- [x] `src/app/domain/dx7/models/algorithm-definition.ts` — new type
- [x] `src/app/domain/dx7/models/algorithms.ts` + `algorithms.spec.ts` — the 32-row dataset and its `it.each`/`describe.each` invariant suite
- [x] `src/app/domain/dx7/models/derive-role.ts` + `.spec.ts` — DOMAIN-03 pure derivation functions
- [x] `src/app/domain/dx7/models/validate-algorithm.ts` + `.spec.ts` — DOMAIN-02 runtime guard
- [x] ESLint `no-restricted-imports` rule scoped to `src/app/domain/**` implemented and proven by negative control (Plan 02-02) — DOMAIN-04's "zero Angular imports" claim is now machine-enforced, not convention-only

---

## Manual-Only Verifications

*None automated-verification-blocking — all phase behaviors (dataset shape, validation, role derivation, Angular-purity) have automated verification via Vitest and `npm run build`/`npm run lint`.*

**Resolved (was tracked separately from automation):** The routing-table's MEDIUM-confidence intermediate edges warranted a human spot-check pass before the dataset was treated as historically authoritative. Tracked as the `checkpoint:human-verify` task in Plan 02-05 — see RESEARCH.md § Assumptions Log (A1–A3). **Initial sign-off 2026-08-04:** approved as-is. **Superseded 2026-08-05** (`02-DATASET-REVIEW.md` Section 5): Algorithms 26 and 27 corrected to edges `6→4, 5→4, 3→2` (carriers `{1,2,4}` preserved); Algorithm 19 restored to stated edges and marked `unresolved`. Downstream phases must not treat Algorithm 19 as final canon.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Approved — structural validation confirmed by independent goal-backward verification (`02-VERIFICATION.md`, 8/8 must-haves passed, 2026-08-05) and historical-fidelity record (`02-DATASET-REVIEW.md`: 2026-08-04 approved as-is, superseded 2026-08-05 with Alg 26/27 corrections and Alg 19 unresolved).
