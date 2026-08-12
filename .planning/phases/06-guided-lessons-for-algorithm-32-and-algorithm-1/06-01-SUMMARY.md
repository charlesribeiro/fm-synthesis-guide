---
phase: 06-guided-lessons-for-algorithm-32-and-algorithm-1
plan: 01
subsystem: ui
tags: [angular, signals, lessons, audio, dx7, output-api]

requires:
  - phase: 05-first-playable-approximation
    provides: "Playground's note-lifecycle play surface and the SynthEngine boundary this plan extracts and reuses, never widens"
  - phase: 04-algorithm-browser-and-svg
    provides: "AlgorithmDiagram + buildDiagramViewModelForId, embedded inline on the lesson page (D-05)"
  - phase: 03-signal-instrument-state
    provides: "InstrumentState's setAlgorithm/updateOperator/setFeedback commands — the only write path this plan uses"
  - phase: 02-algorithm-domain
    provides: "The canonical ALGORITHMS dataset and derive-role.ts, read (never re-derived) for Algorithm 32's carrier facts"
provides:
  - "LessonDefinition/LESSON_IDS/isLessonId/TryThisStep domain model (src/app/domain/dx7/lessons/)"
  - "LESSONS dataset with Algorithm 32's row + getLesson lookup"
  - "hasMovedTowardTarget/tryThisParamValues pure predicates"
  - "LessonProgress in-memory completion facade (src/app/state/)"
  - "PlaySurface, extracted from Playground, with a new notePlayed output — the one shared note-lifecycle implementation"
  - "LessonDetail route component at /learn/:lessonId, end-to-end for algorithm-32"
affects: [06-02-PLAN, 06-03-PLAN, 06-04-PLAN, phase-11-full-curriculum]

actuals:
  tokens: 22150
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Angular signal output() (first use in this repo) for a DOM-originated 'a note was played' event, read imperatively — no effect() anywhere in the completion-check flow"
    - "Domain dataset + O(1) Map lookup (LESSONS/LESSONS_BY_ID) mirroring ALGORITHMS_BY_ID/instrument-state.ts"
    - "Try-this range control whose positions index into a domain-owned value ladder, so every write is legal by construction and InstrumentState.updateOperator's RangeError guards stay the only validation"

key-files:
  created:
    - src/app/domain/dx7/lessons/lesson-definition.ts
    - src/app/domain/dx7/lessons/lessons.ts
    - src/app/domain/dx7/lessons/try-this.ts
    - src/app/state/lesson-progress.ts
    - src/app/features/play-surface/play-surface.ts
    - src/app/features/play-surface/play-surface.html
    - src/app/features/play-surface/play-surface.scss
    - src/app/features/learn/lesson-detail/lesson-detail.ts
    - src/app/features/learn/lesson-detail/lesson-detail.html
    - src/app/features/learn/lesson-detail/lesson-detail.scss
  modified:
    - src/app/features/playground/playground.ts
    - src/app/features/playground/playground.html
    - src/app/features/playground/playground.scss
    - src/app/app.routes.ts

key-decisions:
  - "LessonId is a distinct string-slug union ('algorithm-32' | 'algorithm-1'), not a reuse of AlgorithmId — locked in the plan's phase_decisions before this execution began"
  - "TryThisParam excludes fixedFrequencyHz (in addition to D-02's enabled/mode exclusion) because it is inert while an operator is in ratio mode — an inaudible try-this step cannot satisfy D-06"
  - "LessonId already lists both 'algorithm-32' and 'algorithm-1' this plan, but LESSONS only has one row — getLesson('algorithm-1') will throw until plan 06-02 lands; unreachable from the UI this plan since learn.ts (the only in-app entry point) is untouched"
  - "keyboard-note-map.ts/.spec.ts moved alongside the PlaySurface extraction (not itself a lesson concern, but only used by the play surface now) — Rule 3 follow-on, not a plan-listed file"

patterns-established:
  - "Extracting shared UI+host-binding logic into a standalone component (PlaySurface) rather than a directive/service, when the logic needs both a template and document-level listeners together"
  - "Behavior-verified completion check split into a pure computed() half plus an imperative read from a DOM-originated output()'s handler, with no effect() in the flow"

requirements-completed: [LESSON-01]

coverage:
  - id: D1
    description: "Navigating to /learn/algorithm-32 on a cold deep link renders the objective, explanation, embedded SVG diagram, try-this control, and embedded play surface all on one page"
    requirement: LESSON-01
    verification:
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#renders the objective, explanation, embedded diagram, try-this control, and embedded play surface for a cold deep link to /learn/algorithm-32"
        status: pass
    human_judgment: false
  - id: D2
    description: "Opening the lesson applies the lesson's startingPatch to InstrumentState (algorithm 32, operator 3's parameters match the lesson's starting values)"
    requirement: LESSON-01
    verification:
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#applies the lesson starting patch to InstrumentState on a cold deep link"
        status: pass
    human_judgment: false
  - id: D3
    description: "The lesson completes only after BOTH the try-this parameter moved in the stated direction AND a note was subsequently played — either half alone leaves it incomplete"
    requirement: LESSON-01
    verification:
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#stays incomplete after only playing a note, with the try-this parameter untouched"
        status: pass
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#stays incomplete after only moving the try-this parameter, with no note played"
        status: pass
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#completes only once the try-this parameter has moved in the stated direction AND a note is subsequently played"
        status: pass
    human_judgment: false
  - id: D4
    description: "An unknown :lessonId route segment renders an explicit not-found state and never throws"
    requirement: LESSON-01
    verification:
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#renders a not-found message with no svg and throws nothing for an unknown lesson slug"
        status: pass
    human_judgment: false
  - id: D5
    description: "Playground's existing behavior is unchanged by the PlaySurface extraction — playground.spec.ts passes byte-identical"
    verification:
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts (29 tests, unmodified file)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Embedded play surface inside the lesson page actually sounds identical to Playground's (no perceptible regression from the extraction) — mechanism-proven by automated tests but only listening confirms nothing perceptible reached the ear"
    verification: []
    human_judgment: true
    rationale: "06-VALIDATION.md's Manual-Only Verifications table names this explicitly — automated tests prove the same SynthEngine calls and note-lifecycle branches run, but only real-browser listening confirms no perceptible behavior change. Deferred to 06-04's checkpoint plan."

duration: 9min
completed: 2026-08-10
status: complete
---

# Phase 6 Plan 1: Algorithm 32 Lesson Tracer Summary

**End-to-end `/learn/algorithm-32` lesson — data-driven `LessonDefinition`, an extracted shared `PlaySurface` with a `notePlayed` output, and a two-signal (no-`effect()`) behavior-verified completion check — all wired through one commit-worthy vertical slice.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-08-10T05:50:08Z
- **Completed:** 2026-08-10T05:59:14Z
- **Tasks:** 2
- **Files modified:** 20 (10 created, 4 modified, 2 renamed pairs — keyboard-note-map.{ts,spec.ts} — plus the 4 new spec files added in Task 2)

## Accomplishments

- Extracted `Playground`'s note-lifecycle logic into a standalone `PlaySurface` component (`app-play-surface`) with a new `notePlayed = output<number>()`, emitted only on the path where `pressKey()` actually starts a note. `Playground` is now a thin host embedding it; `playground.spec.ts` passes byte-identical and unmodified (T-06-02 parity gate).
- Built the lesson domain module (`src/app/domain/dx7/lessons/`): `LessonId`/`LESSON_IDS`/`isLessonId`, `TryThisParam`/`TryThisStep`/`LessonDefinition`, the `LESSONS` dataset with Algorithm 32's row (six independent carriers, operator 3's `outputLevel` as the try-this target), and the pure `hasMovedTowardTarget`/`tryThisParamValues` predicates — zero Angular imports, ESLint-domain-scope enforced.
- Added `LessonProgress`, an in-memory per-lesson completion facade mirroring `InstrumentState`'s private-signal/`.asReadonly()` shape; `markComplete` is a one-way ratchet.
- Built `LessonDetail` (`/learn/:lessonId`): validates the route segment via `isLessonId` before any lookup, applies the lesson's starting patch once through `InstrumentState`'s existing `setAlgorithm`/`updateOperator`/`setFeedback` commands, embeds `AlgorithmDiagram` and `PlaySurface` inline on one scrolling page, and marks the lesson complete only when the try-this parameter has moved in the stated direction **and** a note is subsequently played — no `effect()` anywhere in that flow.
- Wired the `learn/:lessonId` route in `app.routes.ts`.
- Covered every new symbol with named, passing unit/component tests (Task 2), proving test teeth via the break/confirm-red/restore substitution since the tracer already implemented the code under test.

## Task Commits

1. **Task 1: End-to-end "open the Algorithm 32 lesson, change one carrier, play a note, lesson completes"** - `df991da` (feat) + `6b88368` (chore — completes the keyboard-note-map.{ts,spec.ts} rename left half-staged by the pathspec-restricted commit)
2. **Task 2: Unit-test the new domain, facade, and play-surface surface** - `29a14aa` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/app/domain/dx7/lessons/lesson-definition.ts` - `LessonId`/`LESSON_IDS`/`isLessonId`, `TryThisParam`/`TryThisDirection`/`TryThisStep`/`LessonDefinition`, `TRY_THIS_PARAM_LABELS`
- `src/app/domain/dx7/lessons/lessons.ts` - `LESSONS` (Algorithm 32's row) + `getLesson`
- `src/app/domain/dx7/lessons/try-this.ts` - `hasMovedTowardTarget`, `tryThisParamValues`
- `src/app/state/lesson-progress.ts` - `LessonProgress` facade
- `src/app/features/play-surface/play-surface.ts`/`.html`/`.scss` - the extracted, shared play surface with `notePlayed`
- `src/app/features/playground/playground.ts`/`.html`/`.scss` - reduced to a thin host embedding `<app-play-surface />`
- `src/app/features/learn/lesson-detail/lesson-detail.ts`/`.html`/`.scss` - the `/learn/:lessonId` route component
- `src/app/app.routes.ts` - added the `learn/:lessonId` lazy route entry
- `src/app/features/play-surface/keyboard-note-map.ts`/`.spec.ts` - moved from `playground/` (extraction follow-on)
- Four new spec files (Task 2): `lesson-definition.spec.ts`, `try-this.spec.ts`, `lesson-progress.spec.ts`, `play-surface.spec.ts`

## Decisions Made

- `LessonId`/`TryThisParam` shape, the try-this candidate for Algorithm 32 (operator 3, `outputLevel`, decrease), and the one-way-ratchet completion semantics were all locked in the plan's `<phase_decisions>` before execution — no new discretion calls made during this run.
- `getLesson('algorithm-1')` will throw a `RangeError` until plan 06-02 adds that row, even though `'algorithm-1'` is already a valid `LessonId`. Left as specified by the plan (mirrors `resolveAlgorithm`'s throw-on-miss posture) since it is unreachable from the UI this plan — `learn.ts`, the only in-app entry point into a lesson, is untouched until plan 06-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved `keyboard-note-map.ts`/`.spec.ts` alongside the `PlaySurface` extraction**
- **Found during:** Task 1 (extracting `Playground`'s note-lifecycle logic)
- **Issue:** `keyboard-note-map.ts` is imported only by the extracted play surface now; leaving it in `playground/` while its own `.spec.ts` sibling stayed there too was not itself blocking, but the plan's own read-first list frames the extraction as "move the code, don't rewrite it" — leaving an orphaned dependency in the old location would have split one logical unit across two feature folders for no reason.
- **Fix:** `git mv` both files into `src/app/features/play-surface/`.
- **Files modified:** `src/app/features/play-surface/keyboard-note-map.ts`, `src/app/features/play-surface/keyboard-note-map.spec.ts` (moved from `playground/`).
- **Verification:** `npx ng test --include="src/app/features/play-surface/**/*.spec.ts"` — 7 `keyboard-note-map` tests + new `play-surface` tests all pass.
- **Committed in:** `df991da` (Task 1 commit) + `6b88368` (a follow-on commit completing the rename's old-path deletion, which the first commit's restrictive pathspec had left staged but uncommitted).

**2. [Rule 1 - Bug] Fixed a lint error in `try-this.spec.ts`**
- **Found during:** Task 2 verification (`npm run lint`)
- **Issue:** `ReadonlyArray<{...}>` triggers `@typescript-eslint/array-type` (project convention requires `readonly T[]`).
- **Fix:** Changed the type annotation to `readonly {...}[]`.
- **Files modified:** `src/app/domain/dx7/lessons/try-this.spec.ts`.
- **Verification:** `npm run lint` exits 0; `npx ng test --include="...try-this.spec.ts"` still 16/16 passing.
- **Committed in:** `29a14aa` (Task 2 commit).

---

**Total deviations:** 2 auto-fixed (1 blocking follow-on, 1 bug)
**Impact on plan:** Both auto-fixes were mechanical follow-ons of the plan's own instructions (move the extraction cleanly; keep lint green) — no scope creep, no architectural change.

## Issues Encountered

None beyond the two auto-fixed items above.

## TDD Gate Compliance

Task 2 is `tdd="true"`, but Task 1's tracer already implemented every symbol Task 2's `<behavior>` list covers (the lesson domain guard/predicates, `LessonProgress`, and `PlaySurface.notePlayed`), so RED could not precede GREEN in the usual commit order — this mirrors the documented precedent from 02-03/03-01/04-01. Per the plan's own instruction, teeth were proven by temporarily breaking each implementation, confirming the corresponding tests failed, then restoring:

| File broken | Break | Result |
|---|---|---|
| `lesson-definition.ts` | `isLessonId` always returns `true` | 4/9 tests in `lesson-definition.spec.ts` failed |
| `try-this.ts` | `hasMovedTowardTarget` always returns `true` | 5/16 tests in `try-this.spec.ts` failed |
| `lesson-progress.ts` | removed `markComplete`'s idempotency early-return | 1/7 tests in `lesson-progress.spec.ts` failed |
| `play-surface.ts` | removed `this.notePlayed.emit(note)` from `pressKey` | 4/5 tests in `play-surface.spec.ts` failed |

All four files were restored to their Task-1 committed content immediately after confirming red, then re-verified green.

## Next Phase Readiness

- Plan 06-02 (Algorithm 1's lesson row) can add directly to `LESSONS`/`LessonId` — the domain model, `LessonDetail` route component, and `PlaySurface` are all generic and require no changes for a second lesson.
- Plan 06-03 (`/learn` index rebuild) can read `LESSONS` + `LessonProgress` directly — neither was touched this plan beyond being built.
- Plan 06-04's real-browser listening checkpoint (D6/coverage above) remains open: automated tests prove the mechanism, but no human has yet confirmed the embedded play surface sounds identical to Playground's.
- No blockers. `npm run build`, `npm test` (766/766), and `npm run lint` are all green; `playground.spec.ts` and the engine files (`synth-engine.ts`, `web-audio-synth-engine.ts`) are untouched.

## Self-Check: PASSED

All 20 files listed under Files Created/Modified were verified present on disk, and all 3 task
commit hashes (`df991da`, `6b88368`, `29a14aa`) were verified present in git history.

---
*Phase: 06-guided-lessons-for-algorithm-32-and-algorithm-1*
*Completed: 2026-08-10*
