---
phase: 11-curriculum-across-all-32-algorithms
plan: 02
subsystem: domain/dx7/lessons
tags: [curriculum, grouping, data-transform, tdd]
dependency-graph:
  requires:
    - src/app/domain/dx7/models/algorithm-definition.ts (TeachingTag, TEACHING_TAGS, AlgorithmDefinition)
    - src/app/domain/dx7/lessons/lesson-definition.ts (LessonDefinition)
  provides:
    - groupLessonsByTeachingTag (src/app/domain/dx7/lessons/lesson-grouping.ts)
    - CURRICULUM_GROUP_ORDER, CURRICULUM_GROUP_LABELS, CURRICULUM_GROUP_DESCRIPTIONS
    - LessonGroup interface
  affects:
    - plan 11-05 (Learn index will consume groupLessonsByTeachingTag as its section data source)
    - plan 11-04 (curriculum-order invariant checks LESSON_IDS against CURRICULUM_GROUP_ORDER)
tech-stack:
  added: []
  patterns:
    - "pure data transform, no Angular import, both datasets arrive as parameters (never imported directly)"
    - "total function over a fixed-order union (CURRICULUM_GROUP_ORDER), frozen at every level"
    - "validate-or-throw on lookup, mirroring getLesson's RangeError convention"
key-files:
  created:
    - src/app/domain/dx7/lessons/lesson-grouping.ts
    - src/app/domain/dx7/lessons/lesson-grouping.spec.ts
  modified: []
decisions:
  - "CURRICULUM_GROUP_ORDER's permutation-of-TEACHING_TAGS invariant is enforced twice: once at module load (a RangeError fires for every consumer, not only a spec, if the taxonomy and the curriculum order ever disagree) and once by a dedicated spec — a stronger guarantee than the plan's 'a spec asserts it' baseline, and a genuine production use for the TEACHING_TAGS import the plan's action text names as a required import."
  - "Task 2's taxonomy-fidelity suite passed on first run with zero implementation changes (all 6 new assertions), because Task 1's implementation already satisfied every fact the plan asked Task 2 to pin. Substituted a break/confirm-red/restore probe for the missing RED phase, mirroring the 02-03/03-01/08-01/04-01 precedent already recorded in STATE.md."
metrics:
  duration: "~20min"
  completed: 2026-08-24
status: complete
actuals:
  tokens: 3976
  tasks: 2
  commits: 2
---

# Phase 11 Plan 02: Pure lesson-grouping transform Summary

`groupLessonsByTeachingTag` — a pure, framework-independent transform that buckets the lesson dataset
into the four curriculum sections (`parallel`, `additive-stacks`, `tree-branch`, `rooting`) in D-02's
fixed order, reading each lesson's group from its algorithm row's own `teachingTags` rather than
restating it anywhere else.

## What Was Built

- **`src/app/domain/dx7/lessons/lesson-grouping.ts`** — new domain module, no Angular import, no direct
  import of `ALGORITHMS`/`LESSONS` (both arrive as parameters). Exports:
  - `CURRICULUM_GROUP_ORDER: readonly TeachingTag[]` — `['parallel', 'additive-stacks', 'tree-branch',
    'rooting']`, D-02's reordering of the dataset's own `TEACHING_TAGS`. Asserted a permutation of
    `TEACHING_TAGS` at module load (throws `RangeError` immediately if it ever isn't) and by a spec.
  - `CURRICULUM_GROUP_LABELS` / `CURRICULUM_GROUP_DESCRIPTIONS` — two frozen records, total over
    `TeachingTag`, the one place a component may read a group's display heading or one-sentence
    routing-shape description. All four descriptions are original prose naming no third-party product.
  - `LessonGroup` interface — `{ tag, label, description, lessons }`.
  - `groupLessonsByTeachingTag(lessons, algorithms): readonly LessonGroup[]` — a single pass over
    `lessons`, bucketing each by its algorithm row's first `teachingTags` entry, then mapping
    `CURRICULUM_GROUP_ORDER` to the four `LessonGroup` objects (always all four, even when empty).
    Raises `RangeError` naming the offending id when a lesson's `algorithmId` is absent from the passed
    algorithms, or when an algorithm's `teachingTags` is empty. Frozen at every level (the returned
    array, each group object, each group's `lessons` array).

- **`src/app/domain/dx7/lessons/lesson-grouping.spec.ts`** — 15 test cases across two `describe` blocks:
  - `groupLessonsByTeachingTag` (9 cases, Task 1): four-group curriculum order for both the live
    dataset and an empty list; non-empty label/description per group; concatenation is a permutation
    of the input preserving relative order within each group (fixture-based); every live lesson lands
    under the group its own algorithm row names; two `RangeError` cases (unknown `algorithmId`, empty
    `teachingTags`); freezing at all three levels; purity (repeated calls deeply equal, no input
    mutation).
  - `curriculum taxonomy fidelity` (6 cases, Task 2): `CURRICULUM_GROUP_ORDER` is a permutation of
    `TEACHING_TAGS` (sorted-copy comparison); D-02's ordering constraint by index comparison (not by
    re-asserting the literal array); all three exported constants frozen; both presentation records
    total over `TEACHING_TAGS` with no extra keys and non-empty entries; every `ALGORITHMS` row carries
    exactly one teaching tag; and a hand-populated independent id-range table (additive-stacks 1-6,
    tree-branch 7-18, rooting 19-25, parallel 26-32) cross-checked against the ids the live dataset
    actually assigns per tag.

## TDD Gate Compliance

**Task 1** followed a standard RED→GREEN cycle: the spec was written first against the not-yet-existing
module, `npm test` failed with `TS2307: Cannot find module './lesson-grouping'` (plus cascading
implicit-`any` errors in the spec itself), then `lesson-grouping.ts` was implemented and all 9 new
cases passed (1306 → 1315 tests).

**Task 2** did not produce a genuine RED phase: all 6 new taxonomy-fidelity assertions passed
immediately on first run (1315 → 1321 tests) because Task 1's implementation already satisfied every
fact Task 2's spec pins — the same "fix attempt finds nothing to fix" situation this repository's
STATE.md already records for plans 02-03, 03-01, 04-01, and 08-01. Substituted the same proof-of-teeth
protocol used at those precedents: temporarily swapped `CURRICULUM_GROUP_ORDER`'s first two entries
(`'additive-stacks'` before `'parallel'`), re-ran `npm test`, confirmed 3 of the 6 new cases failed with
the expected assertion diffs (the two Task-1 curriculum-order cases and Task 2's own D-02
index-comparison case), then restored the original order and confirmed all 1321 tests passed again
with zero diff against the committed file (`git diff` showed no change after restore).

## Deviations from Plan

None — plan executed exactly as written. Task 2's RED-phase substitution (above) is the only deviation
from a literal reading of the TDD cycle, and it follows an established repository precedent rather than
introducing a new pattern.

## Verification

- `npm test`: 1321/1321 passing (49 test files).
- `npm run lint`: all files pass linting.
- `npm run build`: succeeds, `assert-no-harness-in-dist` passes.
- `grep -c "from '@angular" src/app/domain/dx7/lessons/lesson-grouping.ts` → `0`.
- `grep -cE "^import .*(models/algorithms|lessons/lessons)" src/app/domain/dx7/lessons/lesson-grouping.ts`
  → `0` — neither live dataset is imported directly.
- No component, template, or stylesheet was touched by this plan.

## Known Stubs

None. This plan produces a self-contained domain module and its spec; nothing renders yet (plan 11-05
consumes this transform in the `/learn` index).

## Self-Check: PASSED

- FOUND: src/app/domain/dx7/lessons/lesson-grouping.ts
- FOUND: src/app/domain/dx7/lessons/lesson-grouping.spec.ts
- FOUND commit b2c4573 (feat(11-02): add pure lesson-grouping transform)
- FOUND commit dd6c2bb (test(11-02): pin curriculum taxonomy fidelity as checked facts)
