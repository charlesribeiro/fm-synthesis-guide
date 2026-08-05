---
phase: 03-signal-instrument-state
plan: 01
subsystem: state
tags: [angular-signals, dx7, domain-model, immutability, tdd]

# Dependency graph
requires:
  - phase: 02-algorithm-domain
    provides: "AlgorithmDefinition, ALGORITHMS dataset, OperatorId/AlgorithmId types, derive-role.ts (getOperatorRole, deriveCarriers, getFeedbackOperator)"
provides:
  - "OperatorParameters domain shape (D-06) with DX7 integer scales and range validators"
  - "InstrumentPatch domain shape with frozen DEFAULT_PATCH (D-08/D-09/D-11)"
  - "InstrumentState signal-based facade: algorithmId/algorithm/operators/feedback/carriers/feedbackOperator selectors, operatorRole method, setAlgorithm/updateOperator/setFeedback commands"
affects: [04-svg-view-model, 05-audio-engine, 06-lesson-driver]

# Actuals (#2632)
actuals:
  tokens: 7102
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Single private WritableSignal<InstrumentPatch> behind read-only computed() selectors, mirroring MotionPreference's private-signal + .asReadonly() shape"
    - "Throw-on-invalid command validation (RangeError) before any signal write, matching validate-algorithm.ts's InvalidAlgorithmError convention"
    - "Derived-on-read selectors (carriers, feedbackOperator, operatorRole) delegate to derive-role.ts every call, never cached as state"

key-files:
  created:
    - src/app/domain/dx7/models/operator-parameters.ts
    - src/app/domain/dx7/models/operator-parameters.spec.ts
    - src/app/domain/dx7/models/patch.ts
    - src/app/domain/dx7/models/patch.spec.ts
    - src/app/state/instrument-state.ts
    - src/app/state/instrument-state.spec.ts
  modified: []

key-decisions:
  - "Facade lives at src/app/state/instrument-state.ts (new directory), distinct from src/app/core/'s browser-adapter seams, per docs/ARCHITECTURE.md's layer split."
  - "One private patch signal (not three) so D-03's future A/B snapshot captures the whole patch atomically."
  - "Selected operator is not tracked here — it is Phase 4's local view state, not STATE-01 surface."
  - "Invalid command input throws RangeError rather than clamping, matching the codebase's existing validation posture."
  - "Default algorithm id is 1 (dataset's first row, the algorithm ROADMAP Phase 6/LESSON-02 teaches)."

patterns-established:
  - "Domain-layer range validators (validateOperatorParameters, validateFeedbackLevel) accept Partial<> objects and skip absent fields, supporting partial command edits without a separate PATCH-shaped DTO."

requirements-completed: [STATE-01, STATE-02]

coverage:
  - id: D1
    description: "InstrumentState exposes synchronous read-only selectors for selected algorithm, all six operators' parameters, and feedback level"
    requirement: "STATE-01"
    verification:
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#reports the default patch on fresh injection"
        status: pass
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#round-trips an algorithm selection through algorithmId() and algorithm()"
        status: pass
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#reflects a setAlgorithm call synchronously in the same block, with no await"
        status: pass
    human_judgment: false
  - id: D2
    description: "updateOperator and setFeedback produce new objects immutably; rejected calls never partially apply"
    requirement: "STATE-02"
    verification:
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#updates one operator immutably, leaving a prior reference unchanged"
        status: pass
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#never mutates a previously captured patch reference (STATE-02)"
        status: pass
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#rejects an out-of-range updateOperator call, leaving the operator unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-01/D-02 carryover: switching algorithm leaves operator parameters and feedback depth untouched, proven by reference-identity"
    verification:
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#carries operator parameters over unchanged (same reference) across setAlgorithm (D-01)"
        status: pass
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#carries feedback depth over unchanged across setAlgorithm (D-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "DX7-scale range validators (operator parameters, feedback) reject out-of-range/non-integer input with RangeError"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/models/operator-parameters.spec.ts#validateOperatorParameters"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/models/patch.spec.ts#validateFeedbackLevel"
        status: pass
    human_judgment: false

duration: ~35min (this continuation session; Task 1 timing not separately tracked)
completed: 2026-08-05
status: complete
---

# Phase 3 Plan 01: Signal-Based Instrument State Facade Summary

**Immutable DX7 operator/patch domain model plus an Angular signal facade (`InstrumentState`) exposing synchronous read-only selectors and validated, immutable command methods over the selected algorithm, all six operators, and feedback depth.**

## Performance

- **Duration:** ~35 min (this continuation session, Tasks 2-3; Task 1 executed and checkpointed in a prior session)
- **Tasks:** 3 (all complete)
- **Files modified:** 6 (4 new domain/state files + 2 new spec files, from Task 1; 2 spec files added and 1 spec file extended across Tasks 2-3)

## Accomplishments
- `OperatorParameters` domain shape (D-06) with all seven fields, DX7 integer scale bounds (`MIN_OUTPUT_LEVEL`/`MAX_OUTPUT_LEVEL`/`MIN_DETUNE`/`MAX_DETUNE`/`MIN_ENVELOPE_LEVEL`/`MAX_ENVELOPE_LEVEL`), the 32-entry frozen `COARSE_RATIOS` list, and `validateOperatorParameters` throwing `RangeError` per out-of-range field.
- `InstrumentPatch` domain shape with frozen `DEFAULT_PATCH` (D-08/D-09/D-11) and `validateFeedbackLevel`.
- `InstrumentState` facade: one private `WritableSignal<InstrumentPatch>` behind read-only `computed()` selectors (`algorithmId`, `algorithm`, `operators`, `feedback`, `carriers`, `feedbackOperator`) and a parameterized `operatorRole` method — all derived selectors delegate to `derive-role.ts` on every read, never cached.
- Validated, immutable commands: `setAlgorithm`, `updateOperator`, `setFeedback` — each rejects invalid input with `RangeError` before touching the signal, so a rejected call never partially applies.
- Full test coverage: 3 tracer tests (Task 1) + 20 domain-model spec tests (Task 2, 15 in `operator-parameters.spec.ts` + 5 in `patch.spec.ts`) + 12 additional facade tests (Task 3) proving D-01/D-02 carryover, STATE-02 immutability (including non-target isolation and a deep-clone snapshot proof), rejection-leaves-state-unchanged, and same-block synchronicity (ROADMAP SC1).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end tracer slice — select an algorithm, edit one operator, read both back** - `a5ad952` (feat) — completed in a prior session, checkpoint approved by user before this continuation.
2. **Task 2: DX7-scale range validators, coarse ratio set, and domain model specs** - `b4df3cb` (test)
3. **Task 3: Derived role selectors, feedback command, validation wiring, and carryover proofs** - `a5f3235` (test)

**Plan metadata:** committed after this SUMMARY (see below).

_Note: Tasks 2 and 3 are `test`-only commits — see "Deviations from Plan" below for why._

## Files Created/Modified
- `src/app/domain/dx7/models/operator-parameters.ts` - `OperatorParameters` shape, DX7 scale constants, `COARSE_RATIOS`, `isCoarseRatio`, `DEFAULT_OPERATOR_PARAMETERS`, `validateOperatorParameters`
- `src/app/domain/dx7/models/operator-parameters.spec.ts` - Coverage for `COARSE_RATIOS` (frozen-array regression), `isCoarseRatio`, `validateOperatorParameters` (every field, boundaries, empty-changes), `DEFAULT_OPERATOR_PARAMETERS` literals and frozen regression
- `src/app/domain/dx7/models/patch.ts` - `InstrumentPatch` shape, `OperatorParameterSet`, `DEFAULT_ALGORITHM_ID`, `DEFAULT_PATCH`, `validateFeedbackLevel`
- `src/app/domain/dx7/models/patch.spec.ts` - Coverage for `validateFeedbackLevel` boundaries, `DEFAULT_PATCH` literals, and frozen-at-every-level regression
- `src/app/state/instrument-state.ts` - `InstrumentState` `@Injectable({providedIn:'root'})` facade: selectors, derived role/carrier/feedback-operator delegation, validated commands
- `src/app/state/instrument-state.spec.ts` - 15 tests: 3 Task-1 tracer tests plus 12 Task-3 tests for feedback, rejection, derivation, D-01/D-02 carryover, STATE-02 immutability, and synchronicity

## Decisions Made
- Facade location, single-signal storage, un-tracked selected-operator state, throw-on-invalid commands, and default algorithm id 1 — all per this plan's `<design_decisions>` section, implemented as specified (see frontmatter `key-decisions`).
- No new architectural decisions were made during this continuation; Tasks 2 and 3 wired range validation into commands already scaffolded in Task 1 and added the missing test coverage the plan's TDD gate calls for.

## Deviations from Plan

### Auto-fixed Issues

**1. [Documented scope note, not a Rule 1-4 fix] Task 1's tracer commit already implemented Task 2 and Task 3's production code**
- **Found during:** Start of this continuation session, verifying Task 1's committed state before beginning Task 2.
- **Issue:** Reading `operator-parameters.ts`, `patch.ts`, and `instrument-state.ts` as committed in `a5ad952` showed the range-validator constants/functions (Task 2's scope) and `setFeedback`/`carriers`/`feedbackOperator`/`operatorRole`/validation-wiring (Task 3's scope) were already present and matched the plan's `<action>` sections for those tasks nearly verbatim. This is over-implementation during Task 1's tracer, not a bug — nothing here contradicts the plan, and the checkpoint the user approved covered exactly this state.
- **Resolution:** Did not re-implement or revert any production code (that would be pure churn against approved, working code). Instead treated Tasks 2 and 3 as needing only their missing deliverable: the spec files/test cases the plan's `<behavior>` sections specify, which did not yet exist. Wrote `operator-parameters.spec.ts`, `patch.spec.ts` (Task 2) and extended `instrument-state.spec.ts` (Task 3) to cover every case listed in each task's `<behavior>`, then ran the full test suite, build, and lint — all green — before committing each as a `test(03-01): ...` commit.
- **Files affected:** `src/app/domain/dx7/models/operator-parameters.spec.ts` (new), `src/app/domain/dx7/models/patch.spec.ts` (new), `src/app/state/instrument-state.spec.ts` (modified).
- **Verification:** `npm test` (440/440 passing, full suite), `npm run build` (exit 0), `npm run lint` (exit 0). Acceptance-criteria greps confirmed: `MAX_OUTPUT_LEVEL` appears 3x in `operator-parameters.ts`; `deriveCarriers|getOperatorRole|getFeedbackOperator` appears 6x in `instrument-state.ts`; zero `effect(` calls in code (comments excluded).
- **Committed in:** `b4df3cb` (Task 2), `a5f3235` (Task 3).

---

**Total deviations:** 1 documented scope note (not a Rule 1-4 auto-fix — no bug, no missing critical functionality, no blocking issue, no architectural change; production code already matched plan intent).
**Impact on plan:** None on scope or quality. All must-haves, acceptance criteria, and success criteria for Tasks 2 and 3 are met by the added test coverage against the pre-existing implementation.

## TDD Gate Compliance

Tasks 2 and 3 are marked `tdd="true"` with the standard RED-before-GREEN expectation ("Write these tests before the validators exist... they must fail before the implementation exists"). That expectation did not hold here: the GREEN implementation (validators, `setFeedback`, derived selectors, validation wiring) was already committed in Task 1's tracer (`a5ad952`), before either task's tests were written in this session.

This mirrors the precedent recorded in `.planning/STATE.md` for Phase 02 Plan 03 Task 3 ("RED phase found `derive-role.ts` already correct... substituted a delete-the-exclusion-clause-and-restore regression proof for the classic pre-implementation RED"). For this plan, rather than temporarily deleting and restoring implementation to force a literal RED, each new spec file/test block was written directly against the `<behavior>` list, run once (all passed immediately, confirming GREEN), and gates checked as follows:

- A `test(03-01): ...` commit exists for both Task 2 (`b4df3cb`) and Task 3 (`a5f3235`), covering every assertion in `<behavior>`.
- No separate `feat(...)` commit was needed for either task — the GREEN implementation already existed in the preceding `feat(03-01): ...` commit (`a5ad952`).
- No `refactor(...)` commit was needed — no cleanup was required beyond writing the tests.

Regression-proof spot check performed instead of a literal RED: `validateOperatorParameters({ outputLevel: 100 })` and `validateFeedbackLevel(8)` were confirmed (by reading the implementation, not by breaking it) to hit their respective `RangeError` branches exactly as each new test asserts — i.e., the tests are not vacuously passing against a permissive stub.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 (SVG view model) can inject `InstrumentState` and read `algorithm()`, `carriers()`, `feedbackOperator()`, and `operatorRole()` directly — all synchronous, all derived, none require translation.
- Phase 5 (audio engine) can read `operators()` and `feedback()` on DX7 scales; the DX7-to-Web-Audio unit conversion boundary is confirmed to belong to Phase 5, not this facade (verified: no such conversion exists anywhere in `instrument-state.ts` or the domain models).
- No blockers. `DEFAULT_PATCH`'s uniform-across-algorithms formula (D-09) means Phase 11's per-algorithm musical presets are additive, not a rework of this facade.

---
*Phase: 03-signal-instrument-state*
*Completed: 2026-08-05*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all task commit hashes (`a5ad952`, `b4df3cb`, `a5f3235`) and the summary commit (`2770fb0`) confirmed present in `git log --oneline --all`.
