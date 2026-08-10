---
phase: 05-first-playable-approximation
plan: 01
subsystem: audio
tags: [web-audio, angular-signals, di-token, vitest, tdd, fake-audio-context]

# Dependency graph
requires:
  - phase: 03-signal-instrument-state
    provides: InstrumentState read-only facade (algorithm/operators/feedback signals, validate-then-write commands)
  - phase: 02-algorithm-domain
    provides: canonical 32-algorithm dataset, derive-role.ts (deriveCarriers/getFeedbackOperator), OperatorId/AlgorithmId types
provides:
  - AUDIO_CONTEXT_CTOR DI token (gesture-gated, feature-detecting, null-on-unsupported)
  - SYNTH_ENGINE DI token indirection over WebAudioSynthEngine
  - WebAudioSynthEngine: persistent six-oscillator graph, click-safe note-on/off, D-04 retrigger, teardown
  - value-conversion.ts pure DX7-scale-to-Web-Audio-value conversions
  - hand-rolled Web Audio fakes (FakeAudioContext/FakeOscillatorNode/FakeGainNode/FakeDelayNode)
  - Playground Enable-audio gate + single playable C4 key + persistent approximation label
affects: [05-02-modulation-routing, 05-03-full-keyboard, 05-04-listening-checkpoint, 07-audioworklet-engine, 06-guided-lessons]

# Actuals (#2632)
actuals:
  tokens: 13600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "InjectionToken + factory returning a constructor (never an instance), mirroring MotionPreference/MATCH_MEDIA"
    - "Persistent Web Audio node graph built once in initialize(), never recreated per note"
    - "Hand-rolled Web Audio test doubles (no test library) since jsdom has no Web Audio API"
    - "Pure DX7-scale-to-Web-Audio conversion functions isolated in the domain layer (DOMAIN-04 gate)"

key-files:
  created:
    - src/app/core/audio/audio-context.token.ts
    - src/app/core/audio/synth-engine.token.ts
    - src/app/core/audio/web-audio-synth-engine.ts
    - src/app/core/audio/web-audio-synth-engine.spec.ts
    - src/app/core/audio/testing/fake-audio-context.ts
    - src/app/domain/dx7/audio/value-conversion.ts
    - src/app/domain/dx7/audio/value-conversion.spec.ts
  modified:
    - src/app/features/playground/playground.ts
    - src/app/features/playground/playground.html
    - src/app/features/playground/playground.scss
    - src/app/features/playground/playground.spec.ts

key-decisions:
  - "SynthEngine.setAlgorithm/updateOperatorLevel/setFeedback forward the value into InstrumentState then synchronously re-apply routing from InstrumentState's current signals, rather than caching a parallel copy — keeps InstrumentState the single source of truth while still giving D-02's live re-patch an immediate (non-effect-scheduling-delayed) path."
  - "MASTER_GAIN fixed at 1/6 (not per-algorithm normalized), per D-03's literal 'fixed' wording and RESEARCH.md Open Question 2's resolution; perceptual loudness-swing tuning is plan 05-04's listening checkpoint, not this plan's job."
  - "ATTACK_SECONDS = RELEASE_TIME_CONSTANT = RETRIGGER_CUT_SECONDS = 15ms (RESEARCH.md Assumptions Log A2's default), release terminates with a hard setValueAtTime(0, ...) anchor five time constants out so silence is exact and assertable, not asymptotic."
  - "velocityToAmplitude/outputLevelToAmplitude both use a squared-normalised curve (RESEARCH.md Assumptions Log A1's perceptual rationale) rather than linear."

patterns-established:
  - "Persistent-oscillator lifecycle: six OscillatorNodes built and started once in initialize(), never recreated — note-on/off/retrigger only touch voiceGain automation and oscillator frequency/detune, structurally eliminating stuck voices."
  - "Routing seam: WebAudioSynthEngine.applyRouting(algorithm, operators, feedback) is the single method plan 05-02 extends with modulation edges and the feedback DelayNode."

requirements-completed: []
requirements-partial: [AUDIO-01, AUDIO-02, AUDIO-03]
# Full AUDIO-* completion is reserved for the phase-level record: routing/algorithm
# switching lands in 05-02 and computer-keyboard/12-key support in 05-03.

coverage:
  - id: D1
    description: "AudioContext is never constructed before the Enable-audio gesture; status() reports 'unavailable'/'suspended'/'ready'/'error' distinctly and honestly"
    requirement: "AUDIO-01"
    verification:
      - kind: unit
        ref: "src/app/core/audio/web-audio-synth-engine.spec.ts#AudioEngineStatus reachability (4 named tests)"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#constructs no AudioContext before the Enable-audio gesture"
        status: pass
    human_judgment: false
  - id: D2
    description: "A held note plays a click-safe scheduled note through a persistent six-oscillator graph; release and D-04 retrigger never leave a stuck voice; out-of-range note/velocity is rejected before any AudioParam call"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/core/audio/web-audio-synth-engine.spec.ts#note lifecycle (8 tests: validation, attack/release, stale noteOff, allNotesOff, D-04 retrigger, zero direct assignments)"
        status: pass
      - kind: unit
        ref: "src/app/core/audio/web-audio-synth-engine.spec.ts#destroy() stops every started oscillator once, disconnects every created node..."
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#schedules a rising ramp on note-on and a release-to-zero on note-off"
        status: pass
    human_judgment: false
  - id: D3
    description: "The approximation label is present, unconditional, and correctly worded in every render state"
    requirement: "AUDIO-03"
    verification:
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#shows the approximation label before and after enabling audio"
        status: pass
      - kind: other
        ref: "grep -c 'Educational approximation — not a bit-accurate DX7 emulation' src/app/features/playground/playground.html"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fixed MASTER_GAIN safety clamp sounds acceptable (not clipped, not inaudibly quiet) across representative algorithms, including carrier-heavy ones"
    verification: []
    human_judgment: true
    rationale: "Perceptual loudness tuning cannot be automated; RESEARCH.md Assumptions Log A3 and Open Question 2 explicitly defer this to plan 05-04's listening checkpoint. This plan only guarantees the structural clamp (fixed constant, no input can raise it)."

duration: ~14min
completed: 2026-08-07
status: complete
---

# Phase 5 Plan 1: End-to-end first playable approximation Summary

**Gesture-gated WebAudioSynthEngine with a persistent six-oscillator graph, click-safe note scheduling, D-04 cut-and-restart retrigger, and a Playground Enable-audio gate wired to one playable C4 key with a persistent teaching-approximation label.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-08-07T02:06Z (approx., first file write)
- **Completed:** 2026-08-07T02:22Z
- **Tasks:** 3
- **Files modified:** 11 (7 created, 4 extended)

## Accomplishments

- `AUDIO_CONTEXT_CTOR` DI token: feature-detects `AudioContext`/`webkitAudioContext`, never constructs one outside a user gesture, `null` on unsupported browsers
- `SYNTH_ENGINE` token indirection so Phase 7's AudioWorklet engine can swap in without touching UI code
- `WebAudioSynthEngine`: persistent six-oscillator graph built once in `initialize()`; click-safe `noteOn`/`noteOff`/`allNotesOff` scheduling on the audio clock; D-04 cut-and-restart retrigger (cancel → ramp to zero → retune at the cut boundary → ramp to new level); full `destroy()` teardown proven to leave zero live connections and one-to-one oscillator stop/start parity
- `value-conversion.ts`: pure, zero-Angular-import MIDI-note-to-Hz and squared-normalised velocity/output-level-to-amplitude conversions, independently unit-tested
- Hand-rolled `FakeAudioContext`/`FakeOscillatorNode`/`FakeGainNode`/`FakeDelayNode` test doubles (jsdom has no Web Audio API at all)
- Playground: Enable-audio gate covering `unavailable`/`suspended`/`error`/in-flight `enabling` states, a single playable C4 key gated on `status() === 'ready'`, and the persistent approximation label rendered unconditionally in every state

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "enable audio, press one key, hear a note" tracer** - `ae4b7be` (feat)
2. **Task 2: Engine lifecycle, status matrix, and the no-leaked-node invariant** - `e425b77` (test)
3. **Task 3: Monophonic note lifecycle — retrigger, stale release, boundary validation** - `dbbd390` (feat)

**Plan metadata:** commits at end of this plan's completion step

_Note: Tasks 2 and 3 (`tdd="true"`) both found Task 1's tracer implementation already correct on first test run — see TDD Gate Compliance below._

## Files Created/Modified

- `src/app/core/audio/audio-context.token.ts` - `AudioContextLike`/`OscillatorNodeLike`/etc. structural interfaces + `AUDIO_CONTEXT_CTOR` token
- `src/app/core/audio/synth-engine.token.ts` - `SYNTH_ENGINE` token, the one seam every consumer injects
- `src/app/core/audio/web-audio-synth-engine.ts` - `WebAudioSynthEngine implements SynthEngine`, the persistent-graph engine
- `src/app/core/audio/web-audio-synth-engine.spec.ts` - lifecycle + note-lifecycle unit spec (25 tests)
- `src/app/core/audio/testing/fake-audio-context.ts` - hand-rolled Web Audio fakes with automation/connection introspection
- `src/app/domain/dx7/audio/value-conversion.ts` - pure DX7-scale-to-Web-Audio conversions
- `src/app/domain/dx7/audio/value-conversion.spec.ts` - boundary-value spec (8 tests)
- `src/app/features/playground/playground.ts` - injects `SYNTH_ENGINE`, owns `enabling`/`heldNote` signals
- `src/app/features/playground/playground.html` - Enable-audio gate, single playable key, approximation label
- `src/app/features/playground/playground.scss` - gate/key/badge styles per `05-UI-SPEC.md`
- `src/app/features/playground/playground.spec.ts` - rewritten component spec (6 tests)

## Decisions Made

- `SynthEngine.setAlgorithm`/`updateOperatorLevel`/`setFeedback` forward the caller's value into `InstrumentState` (the single source of truth) and then synchronously re-run routing against `InstrumentState`'s current signals, rather than either ignoring the parameter or forking a parallel copy. This satisfies both the interface's own parameters and D-02's "immediately" requirement (a synchronous re-apply, not waiting on `effect()`'s own scheduling).
- `MASTER_GAIN = 1/6` fixed (not per-algorithm-normalized), per D-03's literal wording and RESEARCH.md's Open Question 2 resolution — perceptual tuning across carrier-heavy algorithms is plan 05-04's listening checkpoint (documented as coverage deliverable D4, `human_judgment: true`).
- `ATTACK_SECONDS = RELEASE_TIME_CONSTANT = RETRIGGER_CUT_SECONDS = 0.015s` (RESEARCH.md Assumptions Log A2's default); release always ends with a hard `setValueAtTime(0, now + RELEASE_SECONDS)` anchor so silence is exact and assertable, not merely asymptotic.
- `velocityToAmplitude`/`outputLevelToAmplitude` both use a squared-normalised curve (RESEARCH.md Assumptions Log A1) rather than a linear one.
- `AudioParamLike`'s methods return `unknown` (not chained `AudioParamLike`) to keep the structural interface permissive enough that a real `AudioContext` never needs casting anywhere except the one narrowing cast inside `AUDIO_CONTEXT_CTOR`'s factory.

## Deviations from Plan

None — plan executed exactly as written. Task 1's tracer over-implemented the full lifecycle (idempotent `initialize()`, partial-build teardown, full `destroy()` cleanup) in-line with the plan's own instructions rather than leaving gaps for Task 2 to discover; Tasks 2 and 3 supplied the missing test coverage rather than re-implementing engine code, matching the precedent already recorded in this project's `STATE.md` for Phases 02-03/03-01/04-01. This is documented as a TDD Gate Compliance note below, not a deviation from the plan's instructions.

## TDD Gate Compliance

Task 2 (`tdd="true"`): all 9 lifecycle/status tests passed against Task 1's tracer implementation with zero engine changes needed. Regression teeth were verified via a break/confirm-fail/restore probe on `destroy()`'s oscillator-stop loop (removed the `stop()` call, confirmed the "stops every started oscillator once" test failed, restored the loop, confirmed green again) rather than a classic pre-implementation RED.

Task 3 (`tdd="true"`): the D-04 retrigger implementation and its test were authored together (not strict RED-first), then verified via the same break/confirm-fail/restore pattern — temporarily routed retriggered `noteOn` calls through the plain attack path instead of `scheduleRetrigger`, confirmed the retrigger test's "ramp toward zero" assertion failed, restored the retrigger branch, confirmed all 16 tests green again. `value-conversion.spec.ts`'s 8 boundary-value tests passed on first run against Task 1's already-correct conversion functions.

## Issues Encountered

None. `npm install` was required once at the start of this session (the worktree had no `node_modules`) — not a deviation, a standard environment-setup step, and not part of any task's file changes.

## Known Stubs

None. The thin routing path (only carriers connected to `voiceGain`; modulator `levelGain`s intentionally left unconnected) is documented, in-scope deferral to plan 05-02 per the plan's own `<action>` text — not an undocumented placeholder, and it does not block this plan's stated goal (one playable note, proven end-to-end).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `WebAudioSynthEngine.applyRouting()` is the single seam plan 05-02 extends with modulation edges (`planConnections`-style patching) and the feedback `DelayNode` for all 32 algorithms — no graph reshaping needed, only the routing method's body.
- `SYNTH_ENGINE`/`AUDIO_CONTEXT_CTOR` tokens and the `FakeAudioContext` test-double set are ready for reuse by plan 05-02's expanded routing tests and plan 05-03's full 12-key keyboard.
- `MASTER_GAIN`'s perceptual loudness across carrier-heavy algorithms (Algorithm 32 especially) is an open, explicitly-deferred item for plan 05-04's listening checkpoint (coverage deliverable D4 above).
- `git diff --exit-code src/app/core/audio/synth-engine.ts` still exits 0 — the shared Phase 1 `SynthEngine` contract is untouched, confirming Phase 7's AudioWorklet engine can implement the same interface later without a breaking change here.

---
*Phase: 05-first-playable-approximation*
*Completed: 2026-08-07*
