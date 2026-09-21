---
phase: 12-midi-and-patch-persistence
plan: 03
subsystem: persistence
tags: [angular, vitest, playground, tools-panel, lesson-isolation, patch-slot]
status: complete

requires:
  - phase: 12-midi-and-patch-persistence
    provides: PlaygroundPatchSlot.read/write, InstrumentState.replacePatch, STORAGE + FakeStorage
  - phase: 03-signal-instrument-state
    provides: InstrumentState reset/randomize/captureSnapshot, A/B slots session-only (D-05)
  - phase: 06-guided-lessons
    provides: LessonDetail applyStartingPatch via setAlgorithm/updateOperator/setFeedback

provides:
  - Playground constructor restore: replacePatch(PlaygroundPatchSlot.read()) on enter (D-21)
  - ToolsPanel Randomize/Reset persist via PlaygroundPatchSlot.write(state.patch()) (D-22)
  - Capture/Recall A/B do not write the Playground slot (D-19)
  - LessonDetail startingPatch isolation proven by write spy; production lesson-detail.ts unchanged

affects: [12-04-settings-import-export]

actuals:
  tokens: 4090
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Playground restores the dedicated slot in the constructor — loadComponent new-instance-per-navigation (A5), never an effect or route-sync hook"
    - "Playground-originated slot writes are call-site only (ToolsPanel Randomize/Reset); no subscription to InstrumentState.patch()"
    - "Lesson isolation is a spy on PlaygroundPatchSlot.write, not a LessonDetail production change"

key-files:
  created: []
  modified:
    - src/app/features/playground/playground.ts
    - src/app/features/playground/playground.spec.ts
    - src/app/features/playground/tools-panel/tools-panel.ts
    - src/app/features/playground/tools-panel/tools-panel.spec.ts
    - src/app/features/learn/lesson-detail/lesson-detail.spec.ts

key-decisions:
  - "Playground restores via constructor replacePatch(read()), not an effect or router.events subscription, because loadComponent constructs a new instance per navigation (A5, D-21)."
  - "ToolsPanel writes the Playground slot only after Randomize and Reset; Capture/Recall stay session-only and do not serialize A/B snapshots (D-19, D-22)."
  - "LessonDetail production code is unchanged; isolation is the write-spy plus read() remaining DEFAULT_PATCH after opening Algorithm 32."

patterns-established:
  - "Any TestBed that constructs Playground, ToolsPanel, or LessonDetail provides STORAGE: FakeStorage because those graphs now reach SavedDocumentStore."
  - "Playground TestBed also provides REQUEST_MIDI_ACCESS: null so embedded PlaySurface / MidiSession does not touch navigator."

requirements-completed: [PERSIST-01]

coverage:
  - id: D1
    description: "Entering Playground applies PlaygroundPatchSlot.read() through InstrumentState.replacePatch, so a previously selected live algorithm does not remain (D-21)"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#restores the Playground slot into live InstrumentState on construction"
        status: pass
    human_judgment: false
  - id: D2
    description: "ToolsPanel Reset writes DEFAULT_PATCH to the slot; Randomize writes the live operators object by reference (D-22)"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/features/playground/tools-panel/tools-panel.spec.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Capture A does not change PlaygroundPatchSlot.read() (D-19, A/B stay session-only)"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/features/playground/tools-panel/tools-panel.spec.ts#Capture A does not write the Playground slot"
        status: pass
    human_judgment: false
  - id: D4
    description: "playground.ts contains no effect( call — constructor restore only (A5)"
    requirement: PERSIST-01
    verification:
      - kind: other
        ref: "grep -v '^#' src/app/features/playground/playground.ts | grep -c 'effect('"
        status: pass
    human_judgment: false
  - id: D5
    description: "Opening /learn/algorithm-32 still applies startingPatch and PlaygroundPatchSlot.write is never called; read() remains DEFAULT_PATCH"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/features/learn/lesson-detail/lesson-detail.spec.ts#does not write the Playground slot when applying a lesson startingPatch"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-09-09
---

# Phase 12 Plan 03: Playground restore-on-enter Summary

**Playground constructor restores the dedicated patch slot; ToolsPanel Randomize/Reset persist it; lessons still apply startingPatch without writing that slot**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-09T13:46:09Z
- **Completed:** 2026-09-09T13:49:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Entering `/playground` applies `PlaygroundPatchSlot.read()` through `InstrumentState.replacePatch`, so a lesson `startingPatch` left in live state does not remain.
- ToolsPanel Reset and Randomize each call `write(state.patch())` after the live command; Capture A does not.
- Opening Algorithm 32's lesson still routes `startingPatch` through `setAlgorithm` / `updateOperator` / `setFeedback` and never calls `PlaygroundPatchSlot.write`.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** `018b919` (test) — failing restore-on-enter and ToolsPanel write/non-write specs plus FakeStorage / null MIDI TestBed providers
2. **Task 1 GREEN:** `54255c1` (feat) — Playground constructor restore; ToolsPanel write after reset/randomize
3. **Task 2:** `1fb46c7` (test) — lesson write spy, FakeStorage on every LessonDetail TestBed

**Plan metadata:** (this commit)

_Note: Task 1 used RED then GREEN. Task 2 is test-only because `lesson-detail.ts` must stay unchanged._

## Files Created/Modified

- `src/app/features/playground/playground.ts` — inject slot + `InstrumentState`; constructor `replacePatch(read())`; no slot write; no `effect(`
- `src/app/features/playground/playground.spec.ts` — FakeStorage, `REQUEST_MIDI_ACCESS: null`, restore-on-enter (algorithm 32 vs live algorithm 1)
- `src/app/features/playground/tools-panel/tools-panel.ts` — `write(state.patch())` after `reset()` and `randomize()` only
- `src/app/features/playground/tools-panel/tools-panel.spec.ts` — Reset/Randomize persist; Capture A does not
- `src/app/features/learn/lesson-detail/lesson-detail.spec.ts` — write spy + `read() === DEFAULT_PATCH`; STORAGE and null MIDI on all eight TestBeds

`src/app/features/learn/lesson-detail/lesson-detail.ts` is git-unchanged.

## Decisions Made

- Restore in the Playground constructor, not a reactive route hook, because `loadComponent` creates a new instance per navigation (Assumption A5).
- Persist only Playground-originated Randomize/Reset; never serialize A/B snapshot slots (D-19).
- Prove lesson isolation with a spy on `PlaygroundPatchSlot.write` rather than touching `LessonDetail` production code.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- Task 1: RED `018b919` then GREEN `54255c1`. Restore, Reset-write, and Randomize-write specs failed before implementation (algorithmId stayed 1; slot kept the pre-reset patch; operators were not the live reference). Capture A already did not write — that prohibition spec passed during RED, as expected.
- Task 2: spy specs passed on the first run because `LessonDetail` already does not call `write`. Production change is forbidden by the plan, so there is no GREEN `feat` commit. Isolation is the test itself (same substitution as 02-03 / 03-01 when the behavior already held).

## Authentication Gates

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 12-04 (Settings MIDI picker, last-device id, import/export/clear). `PERSIST-01` stays open until 12-04 lands the versioned document UI. Playground restore and lesson isolation are in place for import-on-playground.

## Self-Check: PASSED

---
*Phase: 12-midi-and-patch-persistence*
*Completed: 2026-09-09*
