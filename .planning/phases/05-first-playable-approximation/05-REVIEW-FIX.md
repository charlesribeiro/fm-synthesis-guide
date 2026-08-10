---
phase: 05-first-playable-approximation
fixed_at: 2026-08-07T13:04:02Z
review_path: .planning/phases/05-first-playable-approximation/05-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: superseded
superseded_by: .planning/phases/05-first-playable-approximation/05-REVIEW.md
scope: "Iteration 1 fixes against an earlier review revision only — not the current all_fixed result. Latest 05-REVIEW.md (round 4) still reports open WR-10 and WR-09."
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-08-07T13:04:02Z
**Source review:** .planning/phases/05-first-playable-approximation/05-REVIEW.md
**Iteration:** 1
**Status:** superseded — scoped to iteration 1 against an earlier review revision; not the current review outcome (see latest `05-REVIEW.md`, which still lists open WR-10 and WR-09)

**Summary:**
- Findings in scope (critical + warning): 8
- Fixed: 8
- Skipped: 0

All work was performed in an isolated git worktree on a temp branch `gsd-reviewfix/05-*` and
fast-forwarded onto `feature/phase-5-first-playable-approximation` on completion — the worktree and
temp branch no longer exist. Every commit below was independently verified in that worktree (via a
read-only symlink to the main checkout's `node_modules`) with `ng build`, `ng test --watch=false`,
and `ng lint`, then **re-verified again in the main checkout** after the fast-forward:
`npm run build`, `npm test -- --watch=false` (712/712 passing), and `npm run lint` all pass
cleanly — the numbers above are reproducible from the tree you are looking at now.

**Note on commit granularity:** The project's `commit` tool stages whole files, not individual hunks. CR-01/WR-02/WR-03/WR-05 all touch overlapping regions of the same method (`applyRouting`) in `web-audio-synth-engine.ts` and were implemented as one coherent refactor; WR-04's fix to `fake-audio-context.ts` and WR-05's test-only `TestBed.tick()` additions ended up bundled into the CR-02 commit because that file already had other in-progress edits sitting in the working tree when the file-level commit ran. Every finding's actual source-code fix is still individually identifiable in the diffs below; the commit boundaries are file-driven rather than perfectly one-finding-per-commit.

## Fixed Issues

### CR-01: FM modulation/feedback depth does not track the currently played note's pitch

**Files modified:** `src/app/core/audio/web-audio-synth-engine.ts`, `src/app/core/audio/web-audio-synth-engine.spec.ts`
**Commit:** `bc8a28e`
**Applied fix:** Factored the modulation/feedback depth math out of `applyRouting()` into a new `applyModulationDepths(algorithm, operators, feedback, operatorFrequencies, atTime)` helper, parameterized by an explicit per-operator frequency map (`computeOperatorFrequencies()`) rather than a stale `oscillator.frequency.value` readback. `applyRouting()` now calls it using the currently-held note's frequency (or `A4_FREQUENCY_HZ` before any note has ever played, preserving the prior baseline). `scheduleAttack()` and `scheduleRetrigger()` now also call it directly — at `now` and at the retrigger `cutTime` respectively — so a note-on or retrigger recomputes every operator's Hz-valued depth from the note actually sounding. Added a regression test (`CR-01: ...`) in `web-audio-synth-engine.spec.ts` that asserts `feedbackGain.gain.value`/`levelGain.gain.value` against the analytically-expected depth at two different notes (60 and a retriggered 72), which fails under the old behavior (depth frozen at whatever frequency was live when routing was last applied).

### CR-02: `initialize()` leaks the `AudioContext` when graph construction fails after the context itself was constructed successfully

**Files modified:** `src/app/core/audio/web-audio-synth-engine.ts`, `src/app/core/audio/testing/fake-audio-context.ts`, `src/app/core/audio/web-audio-synth-engine.spec.ts`
**Commit:** `99b4732`
**Applied fix:** `initialize()`'s `catch` block now captures `this.context` (via a type assertion — see the in-code comment explaining why a plain narrowed read would otherwise mistype the reference as `null`/`never`) before `teardownGraph()`/nulling it, and calls `.close()` on the captured reference if it was non-null. Added a `closeCalls` counter to `FakeAudioContext` and a new regression test (`CR-02: ...`) using a fake whose `resume()` throws only after successful construction, asserting `closeCalls` is `1`.

### WR-01: `MASTER_GAIN` does not actually bound worst-case output below unity

**Files modified:** `src/app/domain/dx7/audio/value-conversion.ts`, `src/app/domain/dx7/audio/value-conversion.spec.ts`
**Commit:** `fd1b018`
**Applied fix:** Lowered `MASTER_GAIN` from `0.18` to `1 / 6` (≈0.1667) so Algorithm 32's worst case (six unmodulated carriers at max output level and max velocity, summed in-phase) no longer exceeds full scale, and updated the doc comment to state the invariant explicitly. Added a regression test computing the worst-case product (`OPERATOR_IDS.length * outputLevelToAmplitude(MAX) * velocityToAmplitude(MAX) * MASTER_GAIN`) and asserting it is `<= 1`.

### WR-02: Live re-patch writes `AudioParam.value` directly with no smoothing

**Files modified:** `src/app/core/audio/web-audio-synth-engine.ts`
**Commit:** `bc8a28e`
**Applied fix:** Added a `scheduleGainValue(param, value, atTime)` helper (cancel → `setValueAtTime(current)` → `linearRampToValueAtTime(value, atTime + ROUTING_GAIN_RAMP_SECONDS)`, a 5ms ramp) and routed every routing-gain assignment through it: the carrier `levelGain` amplitude in `applyRouting()`, and the feedback/modulation depth assignments in the new `applyModulationDepths()` helper (shared with the CR-01 fix). No more direct `.value =` assignments on these params.

### WR-03: Dead/write-only field `currentFeedback`

**Files modified:** `src/app/core/audio/web-audio-synth-engine.ts`
**Commit:** `bc8a28e`
**Applied fix:** Removed the unused `currentFeedback` field entirely — the CR-01 fix reads `feedback` fresh from the call site (`instrumentState.feedback()` or the `applyRouting()` parameter) every time depth is recomputed, so no cached copy is needed.

### WR-04: `FakeAudioParam.setTargetAtTime` silently drops its `timeConstant` argument

**Files modified:** `src/app/core/audio/testing/fake-audio-context.ts`, `src/app/core/audio/web-audio-synth-engine.spec.ts`
**Commit:** `99b4732`
**Applied fix:** Added an optional `timeConstant` field to `AudioParamAutomationEntry` and record it in `FakeAudioParam.setTargetAtTime`. Added a regression test asserting `releaseVoice()`'s `setTargetAtTime` call carries `RELEASE_TIME_CONSTANT`.

### WR-05: Every `setAlgorithm`/`updateOperatorLevel`/`setFeedback` call rebuilds the routing graph twice

**Files modified:** `src/app/core/audio/web-audio-synth-engine.ts`, `src/app/core/audio/web-audio-synth-engine.spec.ts`
**Commit:** `bc8a28e`
**Applied fix:** Removed the explicit `reapplyRouting()` calls (and the now-unused `reapplyRouting()` method) from `setAlgorithm()`, `updateOperatorLevel()`, and `setFeedback()` — the constructor's `effect()` is now the sole routing synchronization mechanism, whether the triggering signal write came from these methods or from a caller mutating `InstrumentState` directly. Updated the affected specs to call `TestBed.tick()` after each direct engine call before asserting on routing state (mirroring the pattern the "via the constructor effect" spec already used).

### WR-06: `onDocumentKeyup` lacks the editable-target/modifier guards `onDocumentKeydown` enforces

**Files modified:** `src/app/features/playground/playground.ts`, `src/app/features/playground/playground.spec.ts`
**Commit:** `7eb499c`
**Applied fix:** Added the same modifier-key and `isEditableTarget` guards to `onDocumentKeyup` that `onDocumentKeydown` already has (readiness is intentionally not re-checked, since a release should always be allowed through once a note is playing). Added a regression test that holds a note via the pointer path, then dispatches a `keyup` with the same `code` from an unrelated `<input>` element, asserting `engine.noteOff` is not called for that note.

## Skipped Issues

None — all in-scope findings (critical + warning) were fixed.

---

_Fixed: 2026-08-07T13:04:02Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
