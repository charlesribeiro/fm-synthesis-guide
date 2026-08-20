---
phase: 10-visualizers-and-comparison-tools
plan: 03
subsystem: domain-state
tags: [angular-signals, domain-purity, random-walk, patch-validation, vitest]

# Dependency graph
requires:
  - phase: 03-signal-instrument-state
    provides: InstrumentState facade (patch signal, updateOperator/setFeedback validate-first-then-write pattern, A/B snapshot slots)
  - phase: 09-dx7-style-envelopes-and-parameter-mapping
    provides: Dx7Envelope four-rate/four-level shape and its MIN/MAX_ENVELOPE_RATE/LEVEL bounds
provides:
  - "randomWalkPatch(patch, rng) — pure, framework-independent bounded random walk over a full InstrumentPatch"
  - "InstrumentState.randomize(rng?) — validated, atomic, immutable randomize command"
affects: [10-04 (wires randomize() to a Tools Panel button)]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 7486
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded random walk from current value (never a uniform draw over the full range), delta scaled by a named RANDOM_WALK_DELTA_FRACTION tuning constant"
    - "Randomness source injected as a () => number parameter, never a hidden Math.random global read inside the pure domain layer"
    - "Validate-candidate-before-single-write command shape (matches updateOperator/setFeedback): compute the whole next value first, run it through the real domain validators, then perform exactly one signal.set()"

key-files:
  created:
    - src/app/domain/dx7/randomization/random-walk-patch.ts
    - src/app/domain/dx7/randomization/random-walk-patch.spec.ts
  modified:
    - src/app/state/instrument-state.ts
    - src/app/state/instrument-state.spec.ts

key-decisions:
  - "randomWalkRatio and randomWalkFixedFrequencyHz both reuse randomWalkInteger's scaled-and-rounded rule (position walk for ratio, value walk for frequency) rather than each inventing their own delta math, so RANDOM_WALK_DELTA_FRACTION means the same thing everywhere it is applied."
  - "The single-write regression test spies on the private _patch signal's own set() method rather than observing a computed(), because a lazy computed cannot distinguish 'one set() call' from 'six set() calls, read once afterward' — Angular signals update synchronously and computed only recomputes on read. Spying on set() is the assertion that actually fails if a future refactor writes per-operator."

patterns-established:
  - "Pattern: pure bounded-walk domain function importing only sibling models/*.ts files, satisfying DOMAIN-04's ESLint gate, with the RNG as an explicit parameter."

requirements-completed: [VIZ-02]

coverage:
  - id: D1
    description: "Pure randomWalkPatch walks every numeric field of a patch by a bounded delta from its current value, snaps ratios to legal COARSE_RATIOS positions, keeps fixed frequencies inside a documented practical range, never touches mode/enabled/algorithmId, never mutates its input, proven against the real domain validators over 1000+ iterations."
    requirement: VIZ-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/randomization/random-walk-patch.spec.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "InstrumentState.randomize(rng?) validates every candidate operator and the feedback depth before a single atomic _patch.set write; algorithmId reaches the new patch only through the spread of the previous patch; A/B snapshot slots are untouched."
    requirement: VIZ-02
    verification:
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts (describe: randomize)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-18
status: complete
---

# Phase 10 Plan 03: Constrained Patch Randomization Summary

**Pure bounded-random-walk domain function (`randomWalkPatch`) plus `InstrumentState.randomize()`, a validated single-write command that nudges every operator field and the feedback depth from a patch's current values without ever touching the algorithm, an operator's mode, or its enabled flag.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-18T00:02Z (approx, per first task commit)
- **Completed:** 2026-08-18T00:04:59-03:00
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- New domain-pure module `domain/dx7/randomization/random-walk-patch.ts` exporting `randomWalkInteger`, `randomWalkRatio`, `randomWalkFixedFrequencyHz`, `randomWalkOperatorParameters`, `randomWalkPatch`, `RandomSource`, `RANDOM_WALK_DELTA_FRACTION` (0.2), `MIN_RANDOM_FIXED_FREQUENCY_HZ`/`MAX_RANDOM_FIXED_FREQUENCY_HZ` (20/8000) — zero Angular imports, passes the DOMAIN-04 ESLint gate.
- `InstrumentState.randomize(rng: RandomSource = Math.random): void` — delegates delta/clamp math to `randomWalkPatch`, then runs every operator through `validateOperatorParameters` (iterating the fixed `OPERATOR_IDS` list) and the feedback through `validateFeedbackLevel` before one `_patch.set` write.
- `algorithmId` is structurally excluded from every mutation path — the only place it appears in `randomize()`'s body is the spread of the previously-read patch.
- 1000+-iteration invariant tests assert against the real `validateOperatorParameters`/`validateFeedbackLevel` (not a restatement of their bounds), at both the pure-function layer and the state-command layer.
- A dedicated regression test proves `randomize()` performs exactly one write to the patch signal (spying on the private signal's `set` method), and another proves it never disturbs the A/B snapshot slots.

## Task Commits

Each task was committed atomically:

1. **Task 1: The pure bounded random walk over a patch** - `0ee3b31` (feat)
2. **Task 2: The `randomize` command on `InstrumentState`** - `fd3132f` (feat)

_Note: Task 1 carries `tdd="true"`; see TDD Gate Compliance below for a deviation from strict RED-first._

## Files Created/Modified
- `src/app/domain/dx7/randomization/random-walk-patch.ts` - pure bounded random walk over one integer field, one coarse-ratio position, one fixed-frequency value, one operator's parameters, and a whole patch
- `src/app/domain/dx7/randomization/random-walk-patch.spec.ts` - identity/extreme/clamp/non-finite cases for `randomWalkInteger`; membership/nearest-fallback/six-position-bound cases for `randomWalkRatio`; range/edge-current cases for `randomWalkFixedFrequencyHz`; mode-gating and per-segment-variety cases for `randomWalkOperatorParameters`; 1000-iteration validator-proof, no-mutation, and never-silences-`DEFAULT_PATCH` cases for `randomWalkPatch`
- `src/app/state/instrument-state.ts` - added `randomize(rng)` command, positioned after `setFeedback` and before the snapshot commands
- `src/app/state/instrument-state.spec.ts` - added a `describe('randomize', ...)` block covering all seven behavior-block cases

## Decisions Made
- `randomWalkRatio` and `randomWalkFixedFrequencyHz` both reuse `randomWalkInteger`'s scaled-and-rounded delta rule (applied to the ratio list's index, and separately to the frequency's multiplicative factor) rather than each hand-rolling its own math — keeps `RANDOM_WALK_DELTA_FRACTION` meaning the same fraction-of-range everywhere it appears.
- The plan's acceptance criterion "a `computed` over the patch signal takes exactly one new value per `randomize()` call" was satisfied with a `vi.spyOn` on the private `_patch` signal's `set` method instead of a literal `computed()`-based observation. Angular signals write synchronously and `computed()` is lazy (recomputes only on read), so a `computed` read once before and once after a call cannot distinguish "one `set()` call" from "several `set()` calls, only read once afterward." Spying directly on `set()` is what actually fails if a future refactor moves to a per-operator write loop — documented inline in the spec as a deliberate substitution for the letter of the acceptance criterion, in service of its stated intent ("so a future refactor that writes per-operator is caught by a named test").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test-file bug in `randomWalkRatio`'s nearest-fallback assertion, found while proving test teeth**
- **Found during:** Task 1's break/restore probe (see TDD Gate Compliance below)
- **Issue:** The first draft of the "starts from the numerically nearest member" spec case used `randomWalkRatio(0.6, () => 0.5)` expecting `1`, but `0.6` is numerically closer to `0.5` (distance `0.1`) than to `1` (distance `0.4`) — the test's own expected value was wrong, not the implementation.
- **Fix:** Changed the fixture to `randomWalkRatio(1.6, () => 0.5)` expecting `2` (distance to `1` is `0.6`, distance to `2` is `0.4`), which correctly exercises the nearest-member fallback.
- **Files modified:** `src/app/domain/dx7/randomization/random-walk-patch.spec.ts`
- **Committed in:** `0ee3b31` (Task 1 commit; caught and fixed before the commit was made)

---

**Total deviations:** 1 auto-fixed (1 bug, self-caught during test authoring, never shipped in a passing-but-wrong state)
**Impact on plan:** No scope creep; the fix was to the test's own arithmetic, not to any behavior or interface described in the plan.

## TDD Gate Compliance

Task 1 carries `tdd="true"`. The implementation (`random-walk-patch.ts`) was written in the same pass as the spec rather than strictly spec-first — the same substitution pattern already recorded for plans 02-03, 03-01, 04-01, and 08-01 in `PROJECT.md`'s Key Decisions. Because a classic RED phase did not happen, test teeth were proven by the plan's own prescribed substitution: the clamp in `randomWalkInteger` was deliberately removed (`return next;` instead of `return Math.min(max, Math.max(min, next));`), `npm test` was run and confirmed **5 tests failed** (the two clamp-boundary cases directly, plus three downstream cases whose validator/clamp assumptions depend on it — `randomWalkRatio`'s boundary case, and two of `randomWalkPatch`'s 1000-iteration validator-invariant cases), the implementation was restored byte-identical (`diff` confirmed), and `npm test` returned to 1217/1217 green. This is documented here rather than claimed as a red phase that did not happen.

Task 2 is `type="auto"` (no `tdd` attribute) and followed the plan's specified order directly: production code and its spec cases were both authored in the same commit, matching the task's own instructions rather than a TDD gate.

## Issues Encountered
None beyond the self-caught test-arithmetic slip documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `InstrumentState.randomize()` is ready for plan 10-04 to wire to a Tools Panel button — its signature (`randomize(rng?: RandomSource): void`) requires no argument for the normal UI call path.
- All prior `instrument-state.spec.ts` cases still pass (1224/1224 total after this plan, up from 1198 before it).
- `npm run build` and `npm run lint` both green with this plan's changes included.

---
*Phase: 10-visualizers-and-comparison-tools*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: src/app/domain/dx7/randomization/random-walk-patch.ts
- FOUND: src/app/domain/dx7/randomization/random-walk-patch.spec.ts
- FOUND: .planning/phases/10-visualizers-and-comparison-tools/10-03-SUMMARY.md
- FOUND commit: 0ee3b31 (Task 1)
- FOUND commit: fd3132f (Task 2)
- FOUND commit: 89e508a (SUMMARY)
