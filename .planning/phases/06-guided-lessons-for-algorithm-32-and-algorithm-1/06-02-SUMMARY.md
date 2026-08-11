---
phase: 06-guided-lessons-for-algorithm-32-and-algorithm-1
plan: 02
subsystem: ui
tags: [angular, signals, lessons, dx7, domain-data]

requires:
  - phase: 06-guided-lessons-for-algorithm-32-and-algorithm-1
    provides: "Plan 06-01's LessonDefinition/LessonId/LESSON_IDS domain model, the LESSONS dataset shape, LessonProgress, PlaySurface, and the generic LessonDetail route component — this plan adds only data and tests against that existing surface"
provides:
  - "The 'algorithm-1' row in LESSONS — Algorithm 1's lesson (title, objective, three-paragraph explanation, startingPatch, tryThis), authored as pure data with zero component changes"
  - "lessons.spec.ts — dataset invariant suite iterating LESSON_IDS (not a hardcoded row count), so Phase 11's future rows inherit the same gate"
  - "Algorithm 1 end-to-end coverage and a five-segment rejected-address matrix in lesson-detail.spec.ts"
affects: [06-03-PLAN, 06-04-PLAN, phase-11-full-curriculum]

actuals:
  tokens: 5900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Iterate-not-hardcode dataset spec convention (describe.each([...LESSONS])) — every future LESSONS row automatically inherits the full invariant suite with zero spec changes"
    - "Independent hand-populated cross-check table for a single algorithm's carriers/feedback-operator (mirrors algorithms.spec.ts's EXPECTED_CARRIERS/EXPECTED_FEEDBACK_OP convention), applied for the first time inside the lessons domain rather than the algorithms domain"

key-files:
  created:
    - src/app/domain/dx7/lessons/lessons.spec.ts
  modified:
    - src/app/domain/dx7/lessons/lessons.ts
    - src/app/features/learn/lesson-detail/lesson-detail.spec.ts

key-decisions:
  - "Algorithm 1's try-this target operator is 5 (the middle of the three-operator modulator sub-chain 6→5→4 that terminates in carrier 3) rather than operator 4, which would equally satisfy the plan's 'receives modulation and passes it on' description — Claude's Discretion per the plan's own instruction to derive the mapping from the edge list rather than assume it from prose. Documented here since two operators technically qualify."
  - "startingPatch outputLevels: carriers (1, 3) = 75; the short pair's modulator (2) = 60; the deeper chain's three modulators (4, 5, 6) = 55/50/45 descending from nearest-output to furthest, per the plan's explicit level scheme. All ratios left at 1 so the timbre difference the lesson teaches comes from routing depth, not detuning. feedback = 3 (mid-scale, non-zero) so operator 6's self-loop is audible."
  - "Rejected-address matrix uses 5 segments matching the plan's exact <behavior> list (unknown slug, near-miss, differently-cased slug, numeric segment, punctuation segment) rather than the broader 10-segment AlgorithmDetail precedent — LessonDetail's guard is string-set-membership (isLessonId), not AlgorithmDetail's numeric-range regex, so the numeric-edge-case segments ('1e1', '999999999999999999999', etc.) that matter for a numeric guard don't apply here."

patterns-established: []

requirements-completed: [LESSON-02]

coverage:
  - id: D1
    description: "Navigating to /learn/algorithm-1 renders that lesson's title, every explanation paragraph, one embedded SVG diagram, a try-this range control, and the embedded play surface's twelve key buttons — from the same generic LessonDetail component, driven purely by the second LESSONS row, with no per-lesson branch in any component"
    requirement: LESSON-02
    verification:
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#renders the objective, explanation, embedded diagram, try-this control, and embedded play surface for a cold deep link to /learn/algorithm-1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Opening the Algorithm 1 lesson applies its startingPatch — algorithmId() becomes 1, all six operators match lesson.startingPatch.operators, and feedback() matches lesson.startingPatch.feedback"
    requirement: LESSON-02
    verification:
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#applies the lesson starting patch to InstrumentState on a cold deep link"
        status: pass
    human_judgment: false
  - id: D3
    description: "The rendered carrier list for algorithm 1 equals deriveCarriers for algorithm 1 — the page shows derived roles, not copy"
    requirement: LESSON-02
    verification:
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#renders the derived carrier list for algorithm 1, matching deriveCarriers — the page shows derived roles, not copy"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Algorithm 1 lesson completes only after operator 5's ratio moves in the increase direction AND a note is subsequently played; raising then playing completes it, playing alone leaves it incomplete, and lowering then playing does NOT complete it (direction enforced, not merely 'moved') — completing it leaves algorithm-32 untouched"
    requirement: LESSON-02
    verification:
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#stays incomplete after only playing a note, with the try-this parameter untouched (Algorithm 1 block)"
        status: pass
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#raising the try-this control above its starting index drives the target ratio up, and leaves the lesson incomplete until a note is played"
        status: pass
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#completes the lesson once the ratio has been raised AND a note is subsequently played, leaving algorithm-32 untouched"
        status: pass
      - kind: unit
        ref: 'src/app/features/learn/lesson-detail/lesson-detail.spec.ts#lowering the try-this control below its starting index and then playing a note does NOT complete the lesson (direction enforced, not just "moved")'
        status: pass
    human_judgment: false
  - id: D5
    description: "Every LESSONS row resolves to a real algorithm in ALGORITHMS, and every row's startingPatch is accepted by validateOperatorParameters/validateFeedbackLevel and frozen at every level — a malformed row fails a named test rather than reaching a learner (T-06-03)"
    requirement: LESSON-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/lessons/lessons.spec.ts (describe.each over LESSONS: algorithmId resolution, startingPatch.algorithmId agreement, validateOperatorParameters/validateFeedbackLevel, frozen-at-every-level checks)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every LESSONS row's try-this step is reachable — the target parameter's starting value leaves room to move in the stated direction, so no lesson can be authored that is impossible to complete"
    requirement: LESSON-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/lessons/lessons.spec.ts#has a try-this step that is reachable: the starting value has room to move in the stated direction"
        status: pass
    human_judgment: false
  - id: D7
    description: "An address that is not a member of LESSON_IDS — an unknown slug, a near-miss, a differently-cased slug, a numeric segment, and a punctuation segment — renders the not-found state, no svg, and throws nothing; the raw segment reaches text content only, never an element attribute or anchor href (T-06-01)"
    requirement: LESSON-02
    verification:
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#renders the not-found branch, no svg, and throws nothing for every rejected address"
        status: pass
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#echoes the raw rejected segment in text content only — never in an element attribute or an anchor href"
        status: pass
    human_judgment: false
  - id: D8
    description: "Algorithm 1's derived carriers (operators 1 and 3) and feedback operator (6) are cross-checked against deriveCarriers/getFeedbackOperator via an independently hand-populated table, rather than restated in lesson copy — a transcription slip in either the dataset or the lesson fails a named test (T-06-06)"
    requirement: LESSON-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/lessons/lessons.spec.ts#deriveCarriers for algorithm 1 equals the hand-populated expected carrier set"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/lessons/lessons.spec.ts#getFeedbackOperator for algorithm 1 equals the hand-populated expected feedback operator"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-08-10
status: complete
---

# Phase 6 Plan 2: Algorithm 1 Lesson (Data-Only) and Dataset Invariants Summary

**The `algorithm-1` LESSONS row — a stack-and-tower lesson proving two independent modulation paths, added as pure data with zero component changes, backed by a dataset invariant suite that iterates `LESSON_IDS` and a five-segment rejected-address matrix.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-08-10T18:56:00Z (approx.)
- **Completed:** 2026-08-10T19:17:31Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Added the `'algorithm-1'` row to `LESSONS` (`src/app/domain/dx7/lessons/lessons.ts`): title "A stack and a tower", an objective and three original explanation paragraphs describing the two independent output paths (a short pair and a deeper four-operator chain with a self-feeding top operator) without naming operator numbers — carrier facts stay derived from `derive-role.ts`, never hardcoded in copy. No component file changed to add the second lesson, proving D-01's "generic, data-driven model" claim for real.
- Built the `startingPatch` by spreading `DEFAULT_OPERATOR_PARAMETERS` per operator (never mutating the shared defaults): both carriers (1, 3) at `outputLevel` 75, the short pair's modulator (2) at 60, the deeper chain's three modulators (4, 5, 6) at descending 55/50/45, all ratios at 1, `feedback` 3. Frozen at every level, mirroring the Algorithm 32 row's convention.
- The try-this step targets operator 5's `ratio`, direction `increase` — raising it should make the "tower" voice brighter while the "pair" voice (operators 1/2) stays untouched, proving path independence.
- Wrote `lessons.spec.ts`: a dataset invariant suite that iterates `LESSON_IDS`/`LESSONS` rather than asserting a hardcoded row count, so every future Phase 11 lesson inherits the same gate automatically. Covers: row-count/order/uniqueness, `algorithmId` resolution against `ALGORITHMS`, `startingPatch.algorithmId` agreement, `validateOperatorParameters`/`validateFeedbackLevel` over every operator/row, frozen-at-every-level checks, try-this reachability (starting value not at the ladder end the stated direction moves toward), non-empty copy fields, `getLesson` round-trip and its `RangeError` on an unknown id, and an independent hand-populated cross-check of Algorithm 1's carriers/feedback operator against `deriveCarriers`/`getFeedbackOperator` (T-06-06).
- Extended `lesson-detail.spec.ts` with a full Algorithm 1 end-to-end block (cold-deep-link render, starting-patch application, derived-carrier rendering, note-gated completion, and the direction-enforcement case — lowering the control then playing a note must NOT complete the lesson) plus a five-segment rejected-address matrix (unknown slug, near-miss, differently-cased slug, numeric segment, punctuation segment) proving the not-found branch, no `svg`, no throw, and text-only echo of the raw segment (T-06-01).
- Proved test teeth for both new spec files via a break/confirm-red/restore probe (see TDD Gate Compliance below) rather than strict RED-first authoring, since data and its invariant suite were written together and the completion-gating implementation already existed from plan 06-01.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the Algorithm 1 lesson row and lock every LESSONS row behind dataset invariants** - `276623f` (feat)
2. **Task 2: Prove the Algorithm 1 lesson end-to-end and close the rejected-address matrix** - `600b06f` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/app/domain/dx7/lessons/lessons.ts` - added `buildAlgorithm1StartingPatch()` and the `'algorithm-1'` `LESSONS` row; updated stale doc comments referring to the row as not-yet-added
- `src/app/domain/dx7/lessons/lessons.spec.ts` - new file: dataset invariant suite over `LESSONS`, plus Algorithm 1's independent carrier/feedback-operator cross-check
- `src/app/features/learn/lesson-detail/lesson-detail.spec.ts` - extended with the Algorithm 1 end-to-end `describe` block and the rejected-address matrix `describe` block

## Decisions Made

- Target operator for Algorithm 1's try-this step is operator 5, not operator 4 — both technically satisfy "receives modulation and passes it on" in the `6→5→4→3` chain, but 5 is the unambiguous middle of the three-operator modulator sub-chain (`6, 5, 4`) that feeds carrier 3. Documented as Claude's Discretion since the plan explicitly required deriving (not assuming) the mapping from the edge list.
- `outputLevel` assignments (75/75 carriers, 60 short-pair modulator, 55/50/45 descending deep-chain modulators) and `feedback: 3` follow the plan's explicit level scheme exactly — no discretion needed there.
- Rejected-address matrix covers exactly the plan's stated five segment types (unknown, near-miss, differently-cased, numeric, punctuation) rather than porting `AlgorithmDetail`'s full ten-segment numeric-edge-case matrix — `LessonDetail`'s guard is string-set membership (`isLessonId`), not a numeric-range regex, so numeric-parsing edge cases like `'1e1'` or oversized integer strings aren't the relevant threat surface here.

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed spec import of `validateFeedbackLevel` from the wrong module**
- **Found during:** Task 1 (`lessons.spec.ts` initial write)
- **Issue:** `validateFeedbackLevel` lives in `patch.ts`, not `operator-parameters.ts`; the initial spec import guessed the wrong module and failed the build with `TS2305`.
- **Fix:** Split the import — `validateOperatorParameters` from `operator-parameters.ts`, `validateFeedbackLevel` from `patch.ts`.
- **Files modified:** `src/app/domain/dx7/lessons/lessons.spec.ts`.
- **Verification:** `npx ng test --include=".../lessons.spec.ts"` — 21/21 passing.
- **Committed in:** `276623f` (Task 1 commit — caught before the commit, not a follow-on fix).

---

**Total deviations:** 1 auto-fixed (1 bug, caught pre-commit)
**Impact on plan:** Trivial import-path correction; no scope creep, no architectural change.

## Issues Encountered

None beyond the deviation above.

## TDD Gate Compliance

Both tasks are `tdd="true"`. For Task 1, the data row and its invariant suite were authored together in one pass (the plan's own action describes writing the row, then writing `lessons.spec.ts` "covering every case in `<behavior>`") — there was no separable "write a failing test against not-yet-written data" step, since the invariants are properties of *any* row, not predictions about this specific row's future values. For Task 2, `LessonDetail`'s completion-gating logic already existed complete from plan 06-01 (only the second lesson's *data* was new), so RED could not precede GREEN in the classic sense — mirroring the documented precedent from 02-03/03-01/04-01/06-01.

Per that precedent, test teeth were proven via a break/confirm-red/restore probe on both new spec files after both task commits landed:

| File broken | Break | Result |
|---|---|---|
| `lessons.ts` (`buildAlgorithm1StartingPatch`) | Set operator 5's `ratio` to `31` (COARSE_RATIOS' max) — no room left to `'increase'` | `lessons.spec.ts`'s reachability invariant failed (1/21 tests red: `expected 31 not to be 31`) |
| `lesson-detail.ts` (`onNotePlayed`) | Removed the `if (this.paramMoved())` guard — `markComplete` fired unconditionally on any note | 3/15 tests in `lesson-detail.spec.ts` failed: the existing algorithm-32 "stays incomplete after only playing a note" test, its new Algorithm 1 counterpart, and the new direction-enforcement ("lowering... does NOT complete") test |

Both files were restored to their committed content immediately after confirming red (verified via `git diff --stat` showing no residual diff), then re-verified green with the full suite (`npm test`: 796/796 passing).

## Next Phase Readiness

- Both `LESSONS` rows now exist end-to-end; `getLesson('algorithm-1')` no longer throws, and `/learn/algorithm-1` is fully reachable and behaviorally proven.
- Plan 06-03 (`/learn` index rebuild) can read both `LESSONS` rows and `LessonProgress` directly — neither is touched by this plan beyond the new data row.
- Plan 06-04's real-browser listening checkpoint remains open (carried over from 06-01): automated tests prove the mechanism for both lessons, but no human has yet confirmed the embedded play surface sounds identical to Playground's, or that Algorithm 1's tower voice is audibly distinguishable from its pair voice.
- No blockers. `npm run build`, `npm test` (796/796), and `npm run lint` are all green; `playground.spec.ts` is untouched (`git diff --exit-code` confirmed).

## Self-Check: PASSED

All 3 files listed under Files Created/Modified were verified present on disk, and both task commit hashes (`276623f`, `600b06f`) were verified present in git history.

---
*Phase: 06-guided-lessons-for-algorithm-32-and-algorithm-1*
*Completed: 2026-08-10*
