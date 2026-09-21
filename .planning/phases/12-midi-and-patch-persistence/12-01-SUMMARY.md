---
phase: 12-midi-and-patch-persistence
plan: 01
subsystem: persistence
tags: [angular, vitest, localStorage, json-codec, lesson-progress, playground-slot]
status: complete

requires:
  - phase: 03-signal-instrument-state
    provides: InstrumentState validate-then-immutable-write, storage-free facade, SnapshotSlots session-only (D-05)
  - phase: 06-guided-lessons
    provides: LessonProgress session ratchet, isLessonId/LESSON_IDS, Learn TestBed
  - phase: 08-algorithm-routing-and-feedback
    provides: exact-six-key operator record rule, fail-closed parseWorkletMessage hostile matrix

provides:
  - PERSISTENCE_SCHEMA_VERSION / PERSISTENCE_STORAGE_KEY / EXPORT_FILENAME / MAX_IMPORT_BYTES / SavedDocument / defaultSavedDocument
  - parseSavedDocument never-throw codec (schema v1 only; extra keys ignored; Dexed/SysEx/hostile getters fail closed)
  - STORAGE InjectionToken + FakeStorage (throwOnSetItem)
  - SavedDocumentStore hydrateLive / persistLessonProgress / writePlaygroundPatch / clearDocument / recoveryMessage / writeError
  - PlaygroundPatchSlot read/write isolated from LessonProgress
  - InstrumentState.replacePatch atomic live apply
  - LessonProgress.replaceCompleted + durable markComplete

affects: [12-03-playground-restore, 12-04-settings-import-export]

actuals:
  tokens: 9720
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Fail-closed domain codec: unknown in, SavedDocument | null out, whole body in try/catch including hostile getters"
    - "STORAGE always a Like (animation-frame no-op fallback), never null; factory is the only file that names window.localStorage"
    - "hydrateLive after both facades exist — store constructor does not call replaceCompleted"
    - "Playground slot is a dedicated document field written by call site, not a subscription to InstrumentState.patch()"

key-files:
  created:
    - src/app/domain/dx7/persistence/saved-document.ts
    - src/app/domain/dx7/persistence/parse-saved-document.ts
    - src/app/domain/dx7/persistence/parse-saved-document.spec.ts
    - src/app/core/persistence/storage.token.ts
    - src/app/core/persistence/testing/fake-storage.ts
    - src/app/state/saved-document-store.ts
    - src/app/state/saved-document-store.spec.ts
    - src/app/state/playground-patch-slot.ts
    - src/app/state/playground-patch-slot.spec.ts
  modified:
    - src/app/state/lesson-progress.ts
    - src/app/state/lesson-progress.spec.ts
    - src/app/state/instrument-state.ts
    - src/app/state/instrument-state.spec.ts
    - src/app/app.ts
    - src/app/app.spec.ts
    - src/app/features/learn/learn.spec.ts

key-decisions:
  - "LessonProgress.markComplete resolves SavedDocumentStore via inject(Injector).get, not method-level inject() — Angular NG0203 forbids inject() outside an injection context, and tests/click handlers call markComplete later."
  - "PlaygroundPatchSlot.write also rejects a non-isAlgorithmId algorithmId with RangeError before persisting, so an invalid playground patch cannot fail-close the whole document on reload and wipe lesson progress."
  - "Store constructor never calls replaceCompleted; App and tests call hydrateLive() after both facades exist (plan hydrate-race rule)."

patterns-established:
  - "Shared FakeStorage instance across two TestBeds is the simulated-reload proof for durable LessonProgress (D-18)."
  - "Every TestBed that constructs App/Learn/LessonProgress or calls markComplete provides STORAGE: FakeStorage — never origin localStorage."

requirements-completed: [PERSIST-01]

coverage:
  - id: D1
    description: "parseSavedDocument never throws on the hostile matrix (non-object, array root, missing/v2 schema, seventh operator, Dexed-shaped, throwing getter, __proto__-only); extra keys on valid v1 are ignored"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/persistence/parse-saved-document.spec.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "JSON round-trip of defaultSavedDocument yields schemaVersion 1 and numeric operator keys after rebuild"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/persistence/parse-saved-document.spec.ts#round-trips JSON.parse(JSON.stringify(defaultSavedDocument()))"
        status: pass
    human_judgment: false
  - id: D3
    description: "Missing storage hydrates defaults; unparseable storage resets to defaults with a recoveryMessage; quota setItem keeps in-memory document and sets writeError"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/state/saved-document-store.spec.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "LessonProgress.markComplete then a second TestBed sharing FakeStorage plus hydrateLive still reports the lesson complete (D-18)"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/state/lesson-progress.spec.ts#isComplete remains true after a simulated reload"
        status: pass
    human_judgment: false
  - id: D5
    description: "PlaygroundPatchSlot.write updates only playgroundPatch; markComplete does not change the written patch (D-21, D-22)"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/state/playground-patch-slot.spec.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "InstrumentState.replacePatch atomically restores algorithm, operators, and feedback and does not touch snapshots or STORAGE"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/state/instrument-state.spec.ts#replacePatch"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-09
---

# Phase 12 Plan 01: Schema-version-1 persistence tracer Summary

**Fail-closed schema-v1 JSON codec, fakeable STORAGE seam, durable LessonProgress across a simulated reload, and a Playground patch slot isolated from live InstrumentState**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-09T13:26:48Z
- **Completed:** 2026-09-09T13:34:26Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Schema-version-1 `SavedDocument` codec rebuilds numeric operator keys, ignores extra JSON keys, and returns `null` (never throws) for hostile/Dexed/wrong-version payloads.
- `STORAGE` + `FakeStorage` keep tests off origin storage; missing key hydrates defaults; corrupt JSON recovers with a non-empty `recoveryMessage`; quota `setItem` keeps in-memory state.
- `LessonProgress.markComplete` persists; a second TestBed sharing one `FakeStorage` plus `hydrateLive()` still reports `algorithm-32` complete.
- `PlaygroundPatchSlot` is a dedicated document field; completing a lesson does not change a written Playground patch. `replacePatch` is the atomic live apply for later Playground restore / Settings import.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** `99bdb21` (test) — failing codec/store/reload specs and FakeStorage TestBed providers
2. **Task 1 GREEN:** `385a03e` (feat) — codec, STORAGE, SavedDocumentStore, durable LessonProgress, App hydrateLive
3. **Task 2 RED:** `0189122` (test) — Playground slot isolation and replacePatch failing specs
4. **Task 2 GREEN:** `56ae836` (feat) — PlaygroundPatchSlot + InstrumentState.replacePatch

**Plan metadata:** (this commit)

_Note: TDD tasks used RED then GREEN commits per task._

## Files Created/Modified

- `src/app/domain/dx7/persistence/saved-document.ts` — v1 document type, key, filename, size cap, defaults
- `src/app/domain/dx7/persistence/parse-saved-document.ts` — never-throw codec; exact-six-key rebuild; no DSP imports
- `src/app/domain/dx7/persistence/parse-saved-document.spec.ts` — hostile matrix + extra-key success + round-trip
- `src/app/core/persistence/storage.token.ts` — StorageLike + probe factory (only file naming `window.localStorage`)
- `src/app/core/persistence/testing/fake-storage.ts` — Map-backed Like with `throwOnSetItem`
- `src/app/state/saved-document-store.ts` — hydrate/persist/clear; no `localStorage.clear`; no `effect()`
- `src/app/state/saved-document-store.spec.ts` — missing/corrupt/quota/clear + FakeStorage + STORAGE factory
- `src/app/state/lesson-progress.ts` — `replaceCompleted`; persist after non-idempotent `markComplete`
- `src/app/state/lesson-progress.spec.ts` — FakeStorage TestBed + simulated reload
- `src/app/app.ts` — injects SavedDocumentStore and `hydrateLive()` in constructor
- `src/app/app.spec.ts` / `src/app/features/learn/learn.spec.ts` — STORAGE FakeStorage on every TestBed
- `src/app/state/playground-patch-slot.ts` — read/write dedicated Playground field
- `src/app/state/playground-patch-slot.spec.ts` — write/read, markComplete isolation, invalid feedback
- `src/app/state/instrument-state.ts` — `replacePatch` (no persistence import)
- `src/app/state/instrument-state.spec.ts` — algorithm 32 → DEFAULT_PATCH, reject 99, snapshot isolation

## Decisions Made

- Persist from `markComplete` via `this.injector.get(SavedDocumentStore)` so the store is not constructed from a field initializer and `inject()` is not called outside an injection context (NG0203).
- `PlaygroundPatchSlot.write` validates `isAlgorithmId` in addition to operators/feedback so a bad algorithm id cannot make `parseSavedDocument` reject the whole document on the next load.
- Hydration of `LessonProgress` is explicit (`hydrateLive`), never in the store constructor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Method-level `inject(SavedDocumentStore)` throws NG0203**
- **Found during:** Task 1 GREEN
- **Issue:** Angular forbids `inject()` in `markComplete` when the caller is a test or UI handler, not an injection context.
- **Fix:** Field-inject `Injector` and `this.injector.get(SavedDocumentStore)` after the successful set write. Store still is not constructed from the LessonProgress field initializer.
- **Files modified:** `src/app/state/lesson-progress.ts`
- **Verification:** `lesson-progress.spec.ts` and `saved-document-store.spec.ts` pass, including simulated reload and quota persist.
- **Committed in:** `385a03e`

**2. [Rule 2 - Missing Critical] Invalid algorithmId on Playground write would fail-close the whole document**
- **Found during:** Task 2 GREEN
- **Issue:** Plan asked only for operator/feedback validation on `PlaygroundPatchSlot.write`. An out-of-range `algorithmId` would persist, then `parseSavedDocument` would return `null` on reload and reset lesson progress (D-26).
- **Fix:** Throw `RangeError` from `write` when `!isAlgorithmId(patch.algorithmId)` before `writePlaygroundPatch`.
- **Files modified:** `src/app/state/playground-patch-slot.ts`
- **Verification:** existing invalid-feedback throw still passes; `isAlgorithmId` is the same bound `replacePatch` uses via `resolveAlgorithm`.
- **Committed in:** `56ae836`

**3. [Rule 3 - Blocking] `no-useless-assignment` on storage read**
- **Found during:** Task 2 plan-level lint
- **Issue:** `let raw: string | null = null` then unconditionally reassigned in try/catch.
- **Fix:** Drop the initializer so the try/catch is the first assignment.
- **Files modified:** `src/app/state/saved-document-store.ts`
- **Verification:** `npm run lint` green.
- **Committed in:** `56ae836`

---

**Total deviations:** 3 auto-fixed (1 missing-critical, 2 blocking)
**Impact on plan:** All required for correctness or the lint gate. No scope creep into 12-02/03/04.

## TDD Gate Compliance

- Task 1: RED `99bdb21` then GREEN `385a03e` — codec spec failed on missing modules before implementation.
- Task 2: RED `0189122` then GREEN `56ae836` — `replacePatch` / `PlaygroundPatchSlot` missing before implementation.

## Authentication Gates

None.

## Issues Encountered

None beyond the documented NG0203 inject() fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 12-02 (MIDI tracer). Playground/ToolsPanel call sites remain 12-03. Settings import/export/clear UI remains 12-04. `PERSIST-01` stays open until 12-03 and 12-04 summaries exist (shared requirement id).

## Self-Check: PASSED

---
*Phase: 12-midi-and-patch-persistence*
*Completed: 2026-09-09*
