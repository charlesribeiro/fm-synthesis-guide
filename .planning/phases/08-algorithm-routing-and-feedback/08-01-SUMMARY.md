---
phase: 08-algorithm-routing-and-feedback
plan: 01
subsystem: dsp
tags: [angular, worklet, fm-synthesis, phase-modulation, audioworklet, vitest]

# Dependency graph
requires:
  - phase: 07-audioworklet-dsp-foundation
    provides: "PhaseModulatedOperator kernel, additive-fixture proof, worklet processor scaffold, worklet-messages choke point"
provides:
  - "GraphRouter — the persistent, allocation-free six-operator routed kernel driving any of the 32 canonical algorithms"
  - "PhaseModulatedOperator.renderWithFeedback — the one-sample-delay feedback render path (D-06)"
  - "buildRoutingConfig — the single AlgorithmDefinition -> RoutingConfig translation point"
  - "Three new worklet message kinds (setAlgorithm, setOperatorParameters, setFeedback) validated through parseWorkletMessage's single choke point"
  - "WorkletSynthEngine as the live SYNTH_ENGINE implementation (D-01 cutover) — Playground and /learn now hear the routed worklet kernel"
  - "Two proven kernel invariants plan 08-02's 32-row cross-check depends on: Algorithm 15's combined external-modulation-plus-self-feedback path, and feedback-history hygiene across a routing change"
affects: [08-02-algorithm-cross-check, 09-envelope-shaping]

# Actuals (#2632)
actuals:
  tokens: 21400
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Persistent per-operator table indexed 1..6 (index 0 unused) instead of a Map, for render-thread allocation avoidance"
    - "Router setters store raw input then call one private recomputeDerivedValues() — render() never recomputes anything"
    - "Gain normalization (MASTER_GAIN) and the hard output bound both live inside the pure kernel, not only on a downstream Web Audio node, so the Vitest proof (no AudioContext) still verifies the real safety ceiling"

key-files:
  created:
    - src/app/domain/dx7/dsp/graph-router.ts
    - src/app/domain/dx7/dsp/graph-router.spec.ts
  modified:
    - src/app/domain/dx7/dsp/operator.ts
    - src/app/domain/dx7/dsp/operator.spec.ts
    - src/app/domain/dx7/dsp/worklet-messages.ts
    - worklets/dx7-worklet-processor.ts
    - src/app/core/audio/worklet-synth-engine.ts
    - src/app/core/audio/worklet-synth-engine.spec.ts
    - src/app/core/audio/synth-engine.token.ts

key-decisions:
  - "D-01 cutover executed as planned: SYNTH_ENGINE now resolves WorkletSynthEngine; WebAudioSynthEngine is retained, untouched, as an unused reference fallback (D-04)."
  - "Task 2 required no production change to operator.ts or graph-router.ts — both kernel invariants (Algorithm 15's combined path, feedback-history hygiene across a routing change) were already correctly implemented by Task 1. Task 2 added the named regression tests that prove it, per the 02-03/03-01 precedent for a fix-attempt that finds nothing to fix."
  - "The three WorkletSynthEngine interface methods (setAlgorithm, setFeedback, updateOperatorLevel) keep InstrumentState's own validation as the operative guard rather than re-validating locally — InstrumentState.setAlgorithm/setFeedback/updateOperator already throw the documented RangeError, so a second guard would be redundant."

patterns-established:
  - "Fixed descending render order ([6,5,4,3,2,1]) as the graph's only valid topological order, proven once against all 32 ALGORITHMS rows rather than computed per-algorithm"
  - "Kernel invariant proofs (Task 2's pattern): write the case first against the production code as it already stands; if it passes, record that as the regression proof rather than inventing an implementation change"

requirements-completed: [ENGINE-02]

coverage:
  - id: D1
    description: "GraphRouter renders Algorithm 1 end to end (feedback on operator 6, carriers 1 and 3) matching a hand-built independent reference"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/graph-router.spec.ts#GraphRouter > at feedback level 0 with every operator at DEFAULT_OPERATOR_PARAMETERS, renders Algorithm 1 identically to a hand-built reference"
        status: pass
    human_judgment: false
  - id: D2
    description: "PhaseModulatedOperator.renderWithFeedback implements the true one-sample-delay feedback recurrence, with non-finite guards and feedback-history reset via resetPhase()"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/operator.spec.ts#renderWithFeedback (Phase 8, D-06) > honours the one-sample delay recurrence"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/dsp/operator.spec.ts#renderWithFeedback (Phase 8, D-06) > resetPhase() clears the one-sample feedback history"
        status: pass
    human_judgment: false
  - id: D3
    description: "Algorithm 15's combined case — an operator that is simultaneously the feedback operator, a receiver of external modulation, and a modulator of another operator — renders correctly"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/operator.spec.ts#renderWithFeedback (Phase 8, D-06) > proves Algorithm 15's combined shape at operator granularity"
        status: pass
    human_judgment: false
  - id: D4
    description: "A routing change clears feedback history so a relocated feedback operator never reads a stale previous sample from a different topology"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/graph-router.spec.ts#GraphRouter routing-change hygiene (T-08-04) > applying Algorithm 2 after Algorithm 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every non-self-loop edge across all 32 ALGORITHMS rows satisfies the higher-modulates-lower invariant the fixed descending render order depends on"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/graph-router.spec.ts#ALGORITHMS dataset invariant (higher-modulates-lower)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A six-carrier algorithm at maximum output level and feedback level 0 stays finite and within the [-1, 1] output bound, proving the bound sits at the summed-carrier stage rather than only on the feedback path"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/graph-router.spec.ts#GraphRouter output bound placement (T-08-03)"
        status: pass
    human_judgment: false
  - id: D7
    description: "SYNTH_ENGINE resolves WorkletSynthEngine and the routed kernel is audible in the live app (Algorithm 1: routed FM timbre, live feedback, click-free, bounded volume)"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-synth-engine.spec.ts#SYNTH_ENGINE resolves to WorkletSynthEngine"
        status: pass
      - kind: manual_procedural
        ref: "Human verified in-browser at http://localhost:4200/ — routed Algorithm 1 audio confirmed correct (tracer feedback-gate checkpoint, response: 'verified')"
        status: pass
    human_judgment: true
    rationale: "Live audio quality (timbre, click-freeness, perceived loudness) is a perceptual judgment a unit test cannot make; this was resolved via the plan's own tracer feedback-gate checkpoint, already confirmed by the human before this continuation began."

# Metrics
duration: ~35min
completed: 2026-08-13
status: complete
---

# Phase 08 Plan 01: Algorithm 1 End-to-End Routing + Kernel Invariants Summary

**Routed six-operator worklet kernel (`GraphRouter`) live as `SYNTH_ENGINE`, proven against Algorithm 1's hand-built reference plus the two invariants (Algorithm 15's combined feedback-and-modulation operator, and feedback-history hygiene across a routing change) the phase's 32-row cross-check depends on.**

## Performance

- **Duration:** ~35 min across two sessions (Task 1 in the initial session with a human-verified tracer checkpoint; Task 2 in this continuation)
- **Started:** 2026-08-13T11:43:11-03:00 (Task 1 commit)
- **Completed:** 2026-08-13T12:17:42-03:00 (Task 2 commit)
- **Tasks:** 2/2
- **Files modified:** 9 (2 new, 7 extended)

## Accomplishments

- `PhaseModulatedOperator.renderWithFeedback` — the true one-sample-delay feedback render path, with the same finite-guard and no-allocation discipline as the existing `render` method.
- `GraphRouter` — the new persistent, allocation-free six-operator routed kernel: `buildRoutingConfig` translates an `AlgorithmDefinition` once; `render()` walks the fixed descending operator order, accumulates modulation, and applies the router's `MASTER_GAIN` + hard `[-1, 1]` clamp as the only limiter.
- Three new worklet message kinds (`setAlgorithm`, `setOperatorParameters`, `setFeedback`) validated through the existing single `parseWorkletMessage` choke point — no second validator introduced.
- `worklets/dx7-worklet-processor.ts` gained a `'routed'` render mode over a persistent `GraphRouter`, with Phase 7's additive-bank proof cases kept intact and no import of `derive-role`/`patch-plan` (role derivation stays exclusively main-thread).
- `WorkletSynthEngine` is now reactive to `InstrumentState` (algorithm/operators/feedback) and is the resolved `SYNTH_ENGINE` implementation (D-01 cutover) — confirmed live in-browser by the human at the Task 1 tracer checkpoint.
- Task 2 proved, with named tests, the two kernel invariants plan 08-02's 32-row cross-check assumes: Algorithm 15's combined external-modulation-plus-self-feedback operator, and feedback-history hygiene when the feedback operator's id changes across a routing update — both already correct from Task 1's implementation, so this task added regression coverage rather than a fix.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route Algorithm 1 end to end — kernel feedback path, graph router, three worklet messages, routed processor, reactive engine, live cutover** - `a6e1cce` (feat) — completed and human-verified (tracer feedback-gate checkpoint) in the prior session.
2. **Task 2: Prove the two kernel invariants the 32-row proof assumes** - `3cf4be8` (test) — no production change required.

**Plan metadata:** (this commit, following SUMMARY/STATE/ROADMAP updates)

## Files Created/Modified

- `src/app/domain/dx7/dsp/graph-router.ts` - NEW: persistent six-operator routed kernel, `buildRoutingConfig`, `DESCENDING_OPERATOR_IDS`
- `src/app/domain/dx7/dsp/graph-router.spec.ts` - NEW: Algorithm 1 hand-built reference, dataset-order invariant, routing-change hygiene, output-bound placement
- `src/app/domain/dx7/dsp/operator.ts` - `renderWithFeedback`, feedback-history-aware `resetPhase()`
- `src/app/domain/dx7/dsp/operator.spec.ts` - 5 new cases for the feedback render path (zero-index equivalence, one-sample recurrence, Algorithm 15 shape, non-finite guards, feedback-history reset)
- `src/app/domain/dx7/dsp/worklet-messages.ts` - three new message kinds, extended `parseWorkletMessage`
- `worklets/dx7-worklet-processor.ts` - `'routed'` render mode over a persistent `GraphRouter`
- `src/app/core/audio/worklet-synth-engine.ts` - `InstrumentState`-reactive constructor effect, real `setAlgorithm`/`setFeedback`/`updateOperatorLevel`
- `src/app/core/audio/worklet-synth-engine.spec.ts` - widened message-array assertions, `SYNTH_ENGINE` resolves `WorkletSynthEngine`
- `src/app/core/audio/synth-engine.token.ts` - D-01 cutover: factory now resolves `WorkletSynthEngine`

## Decisions Made

- SYNTH_ENGINE now resolves `WorkletSynthEngine`; `WebAudioSynthEngine` is retained untouched as an unused reference fallback (D-04) — verified `git diff --stat HEAD -- src/app/core/audio/web-audio-synth-engine.ts` prints nothing.
- Task 2's cases required no production fix: both `operator.ts` and `graph-router.ts` already satisfied the Algorithm 15 combined-path and feedback-history-hygiene invariants from Task 1's implementation. Recorded here per the 02-03/03-01 precedent rather than inventing a change.
- The three `WorkletSynthEngine` interface methods keep `InstrumentState`'s own validation as the operative guard (no redundant local re-validation), since `InstrumentState.setAlgorithm`/`setFeedback`/`updateOperator` already throw the documented `RangeError`.

## Deviations from Plan

None - plan executed exactly as written. Task 2 found both invariants already correctly implemented; the deviation-free outcome is itself explicitly anticipated by the plan's own action text ("the two production files may well already satisfy every case from Task 1, in which case record that in the summary").

## Issues Encountered

- Initial `toBeCloseTo(expectedSample, 12)` precision in the new `operator.spec.ts` feedback-recurrence cases was too tight for `Float32Array`-backed samples compared against a `Float64Array`-precision local expectation; adjusted to `toBeCloseTo(expectedSample, 6)`, matching the precision convention every other float32-vs-float64 comparison in this spec file already uses (float32's own ~7-decimal-digit precision, not float64's).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four verification commands (`npm test`, `npm run build`, `npm run lint`; `npm run typecheck:worklet` verified in the prior Task 1 session) are green; this session additionally reran `npm test`, `npm run lint`, `npm run build` after Task 2's changes — all green (899/899 tests, up from 891).
- Plan 08-02's 32-row cross-check can now build directly on two proven kernel invariants (Algorithm 15's combined path, feedback-history hygiene) instead of assuming them.
- `GraphRouter`, `buildRoutingConfig`, and `renderWithFeedback` are ready to be exercised against all 32 `ALGORITHMS` rows in 08-02 with no further kernel changes anticipated.

---
*Phase: 08-algorithm-routing-and-feedback*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: src/app/domain/dx7/dsp/graph-router.ts
- FOUND: src/app/domain/dx7/dsp/graph-router.spec.ts
- FOUND: .planning/phases/08-algorithm-routing-and-feedback/08-01-SUMMARY.md
- FOUND: commit a6e1cce (Task 1)
- FOUND: commit 3cf4be8 (Task 2)
