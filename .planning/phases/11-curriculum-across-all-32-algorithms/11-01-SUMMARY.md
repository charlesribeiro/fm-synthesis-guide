---
phase: 11-curriculum-across-all-32-algorithms
plan: 01
subsystem: domain
tags: [angular, vitest, dx7, fm-synthesis, algorithm-dataset, lesson-content]

requires:
  - phase: 06-guided-lessons
    provides: LessonDefinition/LessonId/LESSONS/LESSONS_BY_ID/getLesson shape, TryThisStep/tryThisParamValues/hasMovedTowardTarget, LessonDetail route rendering a lesson's startingPatch through InstrumentState
  - phase: 02-algorithm-domain
    provides: canonical ALGORITHMS dataset, deriveCarriers/getFeedbackOperator/getOperatorRole (derive-role.ts)
provides:
  - hopDistanceFromOutput/maxModulatorHopDistance/deepestModulators (domain/dx7/models/hop-distance.ts) — pure hop-distance-from-output graph facts with fan-out-disagreement and cycle guards
  - deriveIsolatedCarriers (domain/dx7/models/derive-role.ts extension)
  - buildStructuralStartingPatch/isAdditiveLikeAlgorithm/structuralOutputLevel/structuralRatio/SHARED_MODULATOR_ENVELOPE (domain/dx7/lessons/structural-lesson-patch.ts) — the shared, structural starting-patch builder D-04 through D-08 require
  - selectTryThisTarget/buildStructuralTryThis (domain/dx7/lessons/try-this-selection.ts) — D-11's four-clause systematic try-this selection rule
  - structuralLesson row factory + requireAlgorithm (domain/dx7/lessons/lessons.ts)
  - eight-member LessonId/LESSON_IDS curriculum sequence (Parallel group first, Algorithm 32 and Algorithm 1 pinned openers)
  - six new lessons (Algorithms 26-31) rendering at /learn/algorithm-26 through /learn/algorithm-31
affects: [11-03-eleven-more-lessons, 11-04-thirteen-more-lessons, 11-05-grouped-index]

actuals:
  tokens: 18460
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Hop-distance-from-output as a pure recursive graph fact (hop-distance.ts), with an explicit visited-operator cycle guard and an explicit fan-out-target-agreement check — both proven with break/restore probes rather than assumed correct because 'the tests looked reasonable'"
    - "Structural-rule-over-hand-tuned-constants preset generation: every one of the 30 remaining lessons' startingPatch values falls out of role + hop-distance + a small set of named module constants, never a per-algorithm numeric table"
    - "Row-factory-with-id/algorithm-agreement-check (structuralLesson) so a lesson's slug and its algorithm can never diverge, mirroring the existing requireAlgorithm/resolveAlgorithm 'throw naming the id' convention"

key-files:
  created:
    - src/app/domain/dx7/models/hop-distance.ts
    - src/app/domain/dx7/models/hop-distance.spec.ts
    - src/app/domain/dx7/lessons/structural-lesson-patch.ts
    - src/app/domain/dx7/lessons/structural-lesson-patch.spec.ts
    - src/app/domain/dx7/lessons/try-this-selection.ts
    - src/app/domain/dx7/lessons/try-this-selection.spec.ts
  modified:
    - src/app/domain/dx7/models/derive-role.ts
    - src/app/domain/dx7/models/derive-role.spec.ts
    - src/app/domain/dx7/lessons/lesson-definition.ts
    - src/app/domain/dx7/lessons/lesson-definition.spec.ts
    - src/app/domain/dx7/lessons/lessons.ts
    - src/app/features/learn/lesson-detail/lesson-detail.spec.ts

key-decisions:
  - "Tasks 1 and 2 committed together (one commit) rather than split at the task boundary — Task 1's own acceptance criteria required LESSON_IDS and LESSONS to both reach eight members in the same order, which is only true once Task 2's remaining five rows land; splitting the commit would have left npm test red at the Task 1 checkpoint, which CLAUDE.md's build/test/lint gate forbids. See Deviations below."
  - "hopDistanceFromOutput's cycle guard is asserted by message content (/modulation cycle/), not just error type — V8's own stack-overflow guard also throws a RangeError, so a bare '.toThrow(RangeError)' assertion would pass even with the explicit guard removed. Proven by break/restore probe."
  - "isAdditiveLikeAlgorithm implemented as three structural clauses (>=4 carriers, >=2 isolated carriers, maxModulatorHopDistance <= 1) rather than a hand-maintained id list; verified by hand against all 32 rows against 11-RESEARCH.md's candidate analysis before implementation, and cross-checked again via the hand-populated EXPECTED_TRUE_IDS/EXPECTED_FALSE_IDS table in structural-lesson-patch.spec.ts"

patterns-established:
  - "Pure domain graph helpers stay beside the model they describe (hop-distance.ts sits next to derive-role.ts, not under lessons/) even when only lesson code currently consumes them — the fact is structural, the consumer is incidental"

requirements-completed: [CURR-01]

coverage:
  - id: D1
    description: "hopDistanceFromOutput/maxModulatorHopDistance/deepestModulators compute hop-distance-from-output over an algorithm's edges, refusing to guess on fan-out disagreement or a modulation cycle"
    requirement: CURR-01
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/models/hop-distance.spec.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "deriveIsolatedCarriers identifies bare, unmodulated carriers, always a subset of deriveCarriers"
    requirement: CURR-01
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/models/derive-role.spec.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildStructuralStartingPatch generates a valid, frozen InstrumentPatch for every one of the 32 dataset rows, with envelope/output-level/ratio/feedback all derived from structural rules (D-04 through D-08), no per-algorithm hand-picked constants"
    requirement: CURR-01
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/lessons/structural-lesson-patch.spec.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "selectTryThisTarget derives a try-this target from D-11's four-clause rule, distinguishing feedback-relocated sibling algorithms (26 vs 27, 3 vs 10) that share identical non-feedback edges"
    requirement: CURR-01
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/lessons/try-this-selection.spec.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Six new lessons (Algorithms 26-31) ship as LESSONS rows in curriculum order, each with a derived original preset and a derived experiment, and render end to end at their own /learn/:lessonId route"
    requirement: CURR-01
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/lessons/lessons.spec.ts (describe.each dataset invariant suite, unedited)"
        status: pass
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#LessonDetail route — Algorithm 26 lesson"
        status: pass
    human_judgment: false
  - id: D6
    description: "The six new lessons' presets sound like usable teaching starting points, not merely pass validation — a structural rule cannot prove musical usefulness in an automated test"
    verification: []
    human_judgment: true
    rationale: "Explicitly flagged in the plan's must_haves as a 'backstop' truth: the in-repo proof is the rule-level assertions in this plan plus plan 11-05's blocking listening and reading checkpoint, not an automated test in this plan."

duration: ~25min
completed: 2026-08-24
status: complete
---

# Phase 11 Plan 01: Structural Lesson Machinery + Six Parallel-Group Lessons Summary

**Two new domain modules (hop-distance, structural-lesson-patch, try-this-selection) turn any canonical algorithm row into a derived starting patch and a derived try-this experiment with zero hand-picked constants, proven end to end by shipping the Parallel group's six new lessons (Algorithms 26-31).**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 12 (6 new, 6 extended)

## Accomplishments

- `hop-distance.ts`: `hopDistanceFromOutput` (with an explicit visited-operator cycle guard and an explicit fan-out-target-agreement check, both proven to have real teeth via break/restore probes — including discovering that V8's own stack-overflow error is itself a `RangeError`, which would have silently defeated a bare `.toThrow(RangeError)` cycle-detection test), `maxModulatorHopDistance`, `deepestModulators`.
- `derive-role.ts` extended with `deriveIsolatedCarriers`.
- `structural-lesson-patch.ts`: `SHARED_MODULATOR_ENVELOPE`, `isAdditiveLikeAlgorithm` (D-07's ratio exception as a three-clause structural predicate, hand-verified against all 32 dataset rows), `structuralOutputLevel` (D-06), `structuralRatio` (D-07), `buildStructuralStartingPatch` (D-04/D-05/D-08) — the one shared builder every lesson but Algorithm 1's and Algorithm 32's now goes through.
- `try-this-selection.ts`: `selectTryThisTarget` (D-11's four ordered clauses — additive-like isolation, feedback-relocated, chain-depth with a feedback-operator tie-break, and the flat-hop-1 fallback) and `buildStructuralTryThis`.
- `LessonId`/`LESSON_IDS` grown to the eight-member curriculum sequence (Parallel group first, per D-01/D-02/D-03); both `algorithm-2` rejected-slug landmines (`lesson-definition.spec.ts`, `lesson-detail.spec.ts`) replaced with `algorithm-33` since `algorithm-2` becomes a legal id later in this phase.
- `lessons.ts`: `structuralLesson` row factory (with an id/algorithmId agreement check) and `requireAlgorithm`; all six Parallel-group lessons (26-31) added through it; `ALGORITHM_1_MODULATOR_ENVELOPE` replaced by the new shared `SHARED_MODULATOR_ENVELOPE` constant (byte-identical values — Algorithm 1's shipped patch is unchanged).
- Algorithm 1's and Algorithm 32's starting patches proven byte-for-byte unchanged (existing envelope-differentiation and shared-reference specs pass untouched).

## Task Commits

Both tasks landed in a single commit — see Deviations below for why.

1. **Task 1 + Task 2 (combined): structural machinery, LESSON_IDS/LessonId growth, and all six Parallel-group lessons** - `a3c78c7` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/app/domain/dx7/models/hop-distance.ts` - hop-distance-from-output graph facts (new)
- `src/app/domain/dx7/models/hop-distance.spec.ts` - dedicated spec, including cycle/fan-out break-probe-verified cases (new)
- `src/app/domain/dx7/models/derive-role.ts` - adds `deriveIsolatedCarriers`
- `src/app/domain/dx7/models/derive-role.spec.ts` - adds `deriveIsolatedCarriers` coverage
- `src/app/domain/dx7/lessons/structural-lesson-patch.ts` - the shared structural starting-patch builder (new)
- `src/app/domain/dx7/lessons/structural-lesson-patch.spec.ts` - dedicated spec, hand-populated additive-like membership table (new)
- `src/app/domain/dx7/lessons/try-this-selection.ts` - D-11's try-this selection rule (new)
- `src/app/domain/dx7/lessons/try-this-selection.spec.ts` - dedicated spec, Parallel-group cross-check table (new)
- `src/app/domain/dx7/lessons/lesson-definition.ts` - `LessonId`/`LESSON_IDS` grown to 8 members
- `src/app/domain/dx7/lessons/lesson-definition.spec.ts` - `algorithm-2` landmine replaced with `algorithm-33`; new-id acceptance coverage added
- `src/app/domain/dx7/lessons/lessons.ts` - `structuralLesson` factory, `requireAlgorithm`, six new `LESSONS` rows
- `src/app/features/learn/lesson-detail/lesson-detail.spec.ts` - `algorithm-2` landmine replaced; cold-deep-link coverage for `/learn/algorithm-26`

## Decisions Made

- **Combined the two tasks into a single commit.** Task 1's own acceptance criteria stated "`LESSON_IDS` has exactly eight members... and `LESSONS` has one row per member in the same order — asserted by the existing set-level invariant in `lessons.spec.ts`." That invariant (`LESSONS.length === LESSON_IDS.length`, `LESSONS.map(id) toEqual LESSON_IDS`) is unsatisfiable at Task 1's own file/action boundary: Task 1's `<action>` explicitly grows `LESSON_IDS` to all eight members but adds only the Algorithm 26 row to `LESSONS` ("The remaining five Parallel rows land in task 2"). I verified this concretely: temporarily reducing `lessons.ts`/`try-this-selection.spec.ts` to the literal Task-1-only file scope and running `npm test` reproduced exactly the predicted two failures (`lessons.spec.ts`'s set-level invariant and `getLesson` resolution), nothing else. Rather than commit that red-test intermediate state — which would violate CLAUDE.md's "Run build, unit tests, and lint before declaring work complete" — I completed both tasks' production and spec code together, confirmed `npm test`/`npm run lint`/`npm run build` all green, and committed once. This mirrors an existing precedent in this project's own history (STATE.md, Phase 03-01: "Task 1's tracer over-implemented Tasks 2 and 3's production scope in the same commit").
- **`isAdditiveLikeAlgorithm`'s three clauses** (`>= MIN_ADDITIVE_LIKE_CARRIERS` carriers, `>= MIN_ADDITIVE_LIKE_ISOLATED_CARRIERS` isolated carriers, `maxModulatorHopDistance <= 1`) were hand-verified against all 32 `ALGORITHMS` rows before writing any test, matching `11-RESEARCH.md`'s candidate analysis exactly (true for 21, 23, 24, 25, 29, 31, 32; false for the ten explicitly-listed borderline/non-candidate rows, including Algorithm 30's genuine hop-2 chain being the deciding factor that excludes it).
- **`hopDistanceFromOutput`'s cycle-guard test asserts the specific error message**, not just `RangeError` as a type. A break/restore probe removing the explicit visited-operator guard revealed that V8's native stack-overflow error is *also* a `RangeError` ("Maximum call stack size exceeded") — so a bare `.toThrow(RangeError)` assertion would have passed even with the guard deleted, silently defeating the DoS mitigation (threat T-11-03) the guard exists for. The test now asserts `.toThrow(/modulation cycle/)`, which only the explicit guard's message satisfies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 — architectural/scope, resolved without a checkpoint since both paths stay within this plan's own two tasks] Combined Task 1 and Task 2 into one commit**
- **Found during:** Task 1, while preparing to commit only the machinery + Algorithm 26 row per Task 1's literal `<action>`/`<files>` scope.
- **Issue:** Task 1's acceptance criteria requires `LESSON_IDS`/`LESSONS` to both carry eight members in the same order (the existing `lessons.spec.ts` set-level invariant passing), but Task 1's own `<action>` only adds the Algorithm 26 row to `LESSONS` while growing `LESSON_IDS` to all eight members — an internally inconsistent task boundary. Verified concretely by reproducing the exact predicted `npm test` failures with `lessons.ts`/`try-this-selection.spec.ts` reduced to Task 1's literal file scope.
- **Fix:** Implemented Task 2's remaining five lesson rows and cross-check spec table together with Task 1's machinery, verified `npm test`/`npm run lint`/`npm run build` green as one unit, and committed once. No task's `<behavior>`, `<action>`, or `<acceptance_criteria>` content was skipped or altered — only the git-commit granularity changed from two commits to one.
- **Files modified:** `src/app/domain/dx7/lessons/lessons.ts`, `src/app/domain/dx7/lessons/try-this-selection.spec.ts` (both already in-scope for one or the other task).
- **Verification:** `npm test` (1510/1510 passing), `npm run lint` (clean), `npm run build` (clean, including `assert-no-harness-in-dist`).
- **Committed in:** `a3c78c7`

---

**Total deviations:** 1 (commit-granularity only; no scope, behavior, or acceptance-criteria change)
**Impact on plan:** None on delivered functionality — every task's `<behavior>`/`<action>`/`<acceptance_criteria>` item is implemented and verified exactly as specified. Only the number of commits differs from a literal two-commits-per-task reading, and only because that reading was internally impossible to satisfy without a red-test intermediate commit.

## Issues Encountered

- `hopDistanceFromOutput`'s cycle-detection test initially asserted only `.toThrow(RangeError)`, which a break/restore probe showed does NOT discriminate between "the explicit guard fired" and "V8's own stack-overflow guard fired" (both throw `RangeError`). Resolved by strengthening the assertion to match the guard's specific message (`/modulation cycle/`), re-verified via a second break/restore cycle. Documented as a TDD-gate-compliance note rather than left silent, since it is exactly the kind of test-has-no-teeth gap the plan's break/restore-probe instruction exists to catch.

## TDD Gate Compliance

Both tasks are `tdd="true"`. Specs and implementations were authored together for every new module rather than strict RED-then-GREEN (mirroring the documented precedent in Phase 02-03/03-01/04-01/08-01), so test teeth were proven via targeted break/restore probes instead of a natural RED phase:

- **`hopDistanceFromOutput` fan-out-disagreement guard:** removed the depth-agreement check → the disagreeing-depths test failed as expected → restored → test passes again.
- **`hopDistanceFromOutput` cycle guard:** removed the visited-operator check → the cycle test *initially still passed* (V8's own stack-overflow `RangeError` satisfied a bare `.toThrow(RangeError)` assertion) → strengthened the test to assert the guard's specific message (`/modulation cycle/`) → re-broke the guard → test now correctly failed → restored → test passes again. This is the one case in this plan where the break-probe found the test itself lacked teeth, not just proved the implementation — the fix was to the test, and both the before (weak) and after (strong) states are documented here per the plan's TDD instruction.
- All other new modules (`structural-lesson-patch.ts`, `try-this-selection.ts`) and the `deriveIsolatedCarriers` extension were verified by hand-computing expected values against `ALGORITHMS`' actual edge lists (documented inline in this summary's Decisions section and in the spec files' own comments) before the specs were run, rather than a formal break/restore probe on each — the hand-verification against independently-read source data serves the same "prove the test isn't vacuously true" purpose `11-RESEARCH.md`'s own cross-check-table convention establishes.

No RED-phase commit exists separately from the GREEN-phase commit for this plan (both tasks landed in one combined commit, see Deviations above) — this is consistent with the same substitution precedent cited above, now also applied to the RED/GREEN commit split itself.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 11-03 and 11-04 (the remaining 11 Tree/Branch and 13 Rooting-plus-Additive-Stacks lessons) can add their rows purely by calling `structuralLesson` with prose — no further machinery work needed. The module surface (`buildStructuralStartingPatch`, `selectTryThisTarget`, `buildStructuralTryThis`, `structuralLesson`) is exactly what this plan's objective committed to establishing.
- Plan 11-05 (grouped `/learn` index) can rely on `LESSON_IDS`'s final ordering rule (documented in `lesson-definition.ts`'s own doc comment) being stable and already curriculum-correct for the eight members that exist today.
- **Blocker/concern for a later plan, not this one:** the six new presets' *musical* usefulness (do they sound like good teaching starting points, not just valid patches) is explicitly out of scope for automated verification in this plan (see `coverage` D6 above) — plan 11-05's blocking listening and reading checkpoint is the intended backstop, per this plan's own `must_haves`.
- **CURR-01 is only partially satisfied by this plan** (6 of 32 algorithms have lessons now: Algorithm 32, Algorithm 1, and Algorithms 26-31). `requirements mark-complete` was deliberately NOT run for CURR-01 in this plan — the requirement text is "every algorithm," and marking it complete now would misrepresent REQUIREMENTS.md's traceability table until plans 11-03/11-04 land the remaining 24 algorithms. `requirements-completed: [CURR-01]` in this file's frontmatter reflects the plan's own `requirements` field per the summary template's literal instruction, not a claim that the requirement is fully closed project-wide.

## Self-Check: PASSED

All 12 code files and the SUMMARY.md itself confirmed present on disk; commit `a3c78c7` confirmed present in `git log`.
