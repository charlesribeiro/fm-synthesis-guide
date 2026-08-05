---
phase: 03-signal-instrument-state
plan: 02
subsystem: state
tags: [angular-signals, dx7, domain-model, immutability, tdd]

# Dependency graph
requires:
  - phase: 03-signal-instrument-state
    plan: 01
    provides: "InstrumentState facade with private patch signal, immutable setAlgorithm/updateOperator/setFeedback commands, DEFAULT_PATCH"
provides:
  - "InstrumentState.snapshots/captureSnapshot/recallSnapshot/hasSnapshot/reset (STATE-03)"
  - "SnapshotSlot restricted-union type + frozen SNAPSHOT_SLOTS ('a', 'b')"
affects: [04-svg-view-model, 06-lesson-driver]

# Actuals (#2632)
actuals:
  tokens: 4140
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Second private WritableSignal<SnapshotSlots> alongside the patch signal, written by exactly one method (captureSnapshot), mirroring the single-writer discipline already used for the patch signal"
    - "null-as-uncaptured-slot representation instead of a parallel boolean flag, so slot state and slot occupancy can never disagree"
    - "Capture stores the patch signal's current reference directly (no clone), relying on plan 01's every-command-produces-a-new-object contract for exactness"

key-files:
  created: []
  modified:
    - src/app/state/instrument-state.ts
    - src/app/state/instrument-state.spec.ts
    - README.md

key-decisions:
  - "SnapshotSlot / SNAPSHOT_SLOTS mirror the OperatorId/OPERATOR_IDS restricted-literal + frozen-array convention, making 'exactly two slots' a compile-time fact (D-03)."
  - "recallSnapshot returns boolean (false on an uncaptured slot, no-op); reset returns void and can never fail (per plan's design_decisions)."
  - "reset writes only the patch signal; the snapshots signal is written in exactly one method (captureSnapshot), verified by grep in acceptance criteria."

patterns-established:
  - "Regression-test describe block explicitly framed as protecting a cross-file coupling (plan 01's immutability contract) rather than testing this file in isolation — documents *why* the tests exist, not just what they assert."

requirements-completed: [STATE-03]

coverage:
  - id: D1
    description: "Capture/recall round-trips the full patch (algorithm id, all six operators, feedback) exactly"
    requirement: "STATE-03"
    verification:
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#round-trips algorithm, operator parameters, and feedback through capture/recall (D-03)"
        status: pass
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#restores every operator id after recall, not only the edited one (D-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A and B are independent slots — capture/recall of one never affects the other"
    requirement: "D-03"
    verification:
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#keeps slot a unaffected by a later capture into slot b (D-03)"
        status: pass
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#leaves slot b untouched by a recall of slot a (D-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "reset() restores the D-11 default patch and never disturbs either snapshot slot"
    requirement: "STATE-03 / D-04"
    verification:
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#restores the D-11 default patch literals on reset"
        status: pass
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#preserves both slots deep-equal across a reset (D-04)"
        status: pass
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#still recalls a captured slot correctly after a reset (D-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "recallSnapshot on a never-captured slot is a no-op returning false"
    requirement: "STATE-03"
    verification:
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#returns false and leaves state unchanged when recalling a never-captured slot (D-03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A captured snapshot is immune to edits made after capture or after a recall — snapshots are immutable values, not live references"
    requirement: "STATE-02 x D-03"
    verification:
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#keeps a captured snapshot unchanged by edits made after the capture (STATE-02, D-03)"
        status: pass
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#keeps a snapshot unchanged by edits made after recalling it"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-05
status: complete
---

# Phase 3 Plan 02: A/B Snapshots and Reset Summary

**Two named full-patch A/B snapshot slots plus a reset-to-default command on `InstrumentState`, completing STATE-03 with regression tests proving round-trip exactness, slot independence, snapshot immunity to later edits, and that reset never disturbs the slots.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (both complete)
- **Files modified:** 3 (`instrument-state.ts`, `instrument-state.spec.ts`, `README.md`)

## Accomplishments
- `SnapshotSlot = 'a' | 'b'` restricted-union type and a frozen `SNAPSHOT_SLOTS` array, mirroring the `OperatorId`/`OPERATOR_IDS` convention — exactly two slots is a compile-time fact.
- A second private `WritableSignal<SnapshotSlots>`, written by exactly one method (`captureSnapshot`), exposed read-only via `snapshots`.
- `captureSnapshot(slot)` stores the current patch signal's value directly (no clone), documented as depending on plan 01's immutable-update contract; overwrites an occupied slot.
- `recallSnapshot(slot)` returns `true`/restores on a captured slot, `false`/no-op on an empty one.
- `hasSnapshot(slot)` reads the snapshots signal reactively.
- `reset()` writes only the patch signal to `DEFAULT_PATCH`, touching nothing else — verified by both a `grep -c "_snapshots.set|_snapshots.update"` acceptance check (returns 1) and a dedicated preserves-both-slots test.
- 16 new tests: 9 in Task 1 (fresh-state, round-trip, all-six-operators, hasSnapshot, empty-slot no-op, capture-overwrite, reset literals, reset determinism, frozen-array regression) and 7 in Task 2 (slot isolation on capture/recall, snapshot immunity to later edits and to edits after recall, reset-preserves-both-slots, reset-then-recall, repeat-recall determinism).
- README: `state/` line added to the "Layered source tree" fenced block (between `domain/dx7/` and `features/`, the other three lines byte-identical to before), and a new architecture-summary bullet documenting `InstrumentState` as the single source of truth with immutable updates, derived role/carrier, and in-memory-only A/B + reset.

## Task Commits

Each task was committed atomically, following a genuine RED/GREEN cycle (unlike plan 01, where the tracer had over-implemented the later tasks' scope — here nothing existed yet, so RED was real):

1. **Task 1: Two named snapshot slots, capture/recall, and reset to default** (`tdd="true"`)
   - RED: `7b3161a` (test) — 9 new tests added against the pre-Task-1 facade; compilation failed with `TS2339: Property 'captureSnapshot'/'recallSnapshot'/'hasSnapshot'/'reset' does not exist`, confirmed before writing any implementation.
   - GREEN: `328fd63` (feat) — `SnapshotSlot`/`SNAPSHOT_SLOTS`, the snapshots signal, and all four command methods added; all 9 new tests plus the 15 carried-over tests passed (24/24 in the file). This commit also fixed a test bug discovered while running the RED-authored suite: one test called `TestBed.configureTestingModule` twice in a single spec (invalid Angular TestBed usage — "Cannot configure the test module when the test module has already been instantiated"), rewritten to derive the "fresh" comparison patch from the same service instance instead of a second `TestBed.inject`.
2. **Task 2: Slot-isolation and immutability regression tests, plus source-tree documentation** (`tdd="true"`)
   - `a6c1884` (test) — 7 adversarial tests added to a new `describe('slot isolation and immutability regressions')` block, plus the README `state/` source-tree line and architecture-summary bullet. No separate `feat` commit was needed: Task 1's implementation already satisfied every assertion (see TDD Gate Compliance below).

**Plan metadata:** committed after this SUMMARY (see below).

## Files Created/Modified
- `src/app/state/instrument-state.ts` — added `SnapshotSlot`, `SnapshotSlots`, `SNAPSHOT_SLOTS`, the private snapshots signal + public `snapshots` selector, and `captureSnapshot`/`recallSnapshot`/`hasSnapshot`/`reset`; extended the class doc comment with D-05.
- `src/app/state/instrument-state.spec.ts` — 16 new tests (9 Task 1, 7 Task 2) covering STATE-03's capture/recall/reset behavior and its slot-isolation/immutability regression surface; all 15 plan-01 tests carried over unchanged.
- `README.md` — `state/` line in the layered source-tree block; new architecture-summary bullet for `InstrumentState`.

## Decisions Made
- All design decisions were pre-specified in this plan's `<design_decisions>` section (snapshots store a reference not a clone, `recallSnapshot` returns boolean vs. `reset` returns void, `SnapshotSlot` as a restricted union) and implemented exactly as specified — no deviations.
- No new architectural decisions were made during execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Double `TestBed.configureTestingModule` call in the reset-determinism test**
- **Found during:** Task 1, running the newly-written tests against the completed GREEN implementation.
- **Issue:** The plan's `<behavior>` for "Reset determinism" calls for "two independently constructed services" to be compared. My first draft called `setup()` twice in one `it()` block, each calling `TestBed.configureTestingModule({})` — Angular's `TestBed` throws `Cannot configure the test module when the test module has already been instantiated` on the second call within a single spec.
- **Fix:** Rewrote the test to capture the freshly-injected service's `patch()` value *before* mutating it, then compare against that captured value after `reset()` — same assertion intent (a heavily-edited-then-reset patch matches a never-touched one), without a second `TestBed` instantiation.
- **Files modified:** `src/app/state/instrument-state.spec.ts`.
- **Verification:** `npm test -- --include src/app/state/instrument-state.spec.ts` — 24/24 passing after the fix.
- **Commit:** `328fd63`.

---

**Total deviations:** 1 (Rule 1 test-authoring bug, caught and fixed before the GREEN commit).
**Impact on plan:** None on scope or quality — the fixed test still asserts exactly what the plan's `<behavior>` specifies.

## TDD Gate Compliance

Both tasks are `tdd="true"`. Task 1 followed a literal RED-then-GREEN cycle: the RED commit (`7b3161a`) added tests against methods that did not yet exist, confirmed to fail compilation (`TS2339` for `captureSnapshot`/`recallSnapshot`/`hasSnapshot`/`reset`), then the GREEN commit (`328fd63`) added the implementation and all tests passed.

Task 2's tests passed immediately against Task 1's already-complete GREEN implementation — there was no separate implementation gap left for Task 2 to fill; its `<action>` is entirely additional test coverage plus documentation. This mirrors the precedent recorded for phase 02 plan 03 and phase 03 plan 01: rather than forcing an artificial RED by temporarily deleting working code, the 9 new tests were written directly against the `<behavior>` list, run once (all passed, confirming they exercise real behavior and are not vacuous), and the commit was made as `test(03-02): ...` with no accompanying `feat` commit since none was needed.

- A `test(...)` commit exists for both tasks (`7b3161a`, `a6c1884`).
- A `feat(...)` commit (`328fd63`) exists between them, satisfying the GREEN gate for Task 1.
- No `refactor(...)` commit was needed for either task.

## Issues Encountered
None beyond the test-authoring bug documented above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 4 (SVG view model) and Phase 6 (guided lessons) can inject `InstrumentState` and call `captureSnapshot`/`recallSnapshot`/`hasSnapshot`/`reset` directly — all synchronous, all immediately reflected in `algorithmId()`/`operators()`/`feedback()`.
- Phase 3 (this phase) is now fully complete: STATE-01, STATE-02, and STATE-03 are all implemented and tested. No blockers for Phase 4.
- D-05 remains binding for future phases: nothing in `src/app/state/instrument-state.ts` reads or writes browser storage; PERSIST-01 (Phase 12) is the first phase permitted to add persistence, and should design its own versioned schema rather than serializing `SnapshotSlots` as-is.

---
*Phase: 03-signal-instrument-state*
*Completed: 2026-08-05*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`src/app/state/instrument-state.ts`,
`src/app/state/instrument-state.spec.ts`, `README.md`, this SUMMARY). All task commit hashes
(`7b3161a`, `328fd63`, `a6c1884`) confirmed present in `git log --oneline --all`.
