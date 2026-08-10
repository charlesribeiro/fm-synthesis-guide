---
phase: 05-first-playable-approximation
plan: 02
subsystem: audio
tags: [web-audio, patch-plan, dx7-scale-conversion, feedback-delaynode, angular-effect, vitest]

# Dependency graph
requires:
  - phase: 05-first-playable-approximation
    plan: 01
    provides: WebAudioSynthEngine persistent six-oscillator graph, applyRouting() seam, AUDIO_CONTEXT_CTOR/SYNTH_ENGINE tokens, FakeAudioContext test-double set, MASTER_GAIN/velocity/outputLevel conversion functions
  - phase: 02-algorithm-domain
    provides: canonical 32-algorithm dataset (ALGORITHMS), derive-role.ts (deriveCarriers/getFeedbackOperator), OperatorId/AlgorithmId types
  - phase: 03-signal-instrument-state
    provides: InstrumentState read-only facade and validate-then-write commands (setAlgorithm/updateOperator/setFeedback)
provides:
  - "planConnections(algorithm): pure edge-to-connection traversal, the single routing derivation for all 32 algorithms"
  - "value-conversion.ts additions: operatorFrequencyHz, detuneToCents, outputLevelToModulationDepthHz, feedbackLevelToDepthHz, MAX_MODULATION_INDEX, MAX_FEEDBACK_INDEX, CENTS_PER_DETUNE_STEP"
  - "WebAudioSynthEngine: per-operator feedback gain + feedback delay, generic applyRouting() driven by planConnections/deriveCarriers, per-operator ratio/detune-aware noteOn/retrigger tuning"
affects: [05-03-full-keyboard, 05-04-listening-checkpoint, 07-audioworklet-engine, 06-guided-lessons]

# Actuals (#2632)
actuals:
  tokens: 10444
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure domain-layer patch-plan module (zero Angular/Web Audio imports) traversing AlgorithmDefinition.edges once, reused by both automated tests and the engine — no per-algorithm special case anywhere"
    - "Feedback self-loop closed through a persistent GainNode->DelayNode pair, delay time computed from context.sampleRate as one render quantum, never a literal 0"
    - "Re-patch tears down only the re-patchable links (levelGain, feedbackDelay outputs) on every algorithm/operator/feedback change, leaving persistent oscillator->levelGain/feedbackGain and feedbackGain->feedbackDelay links untouched — D-02's live re-patch as pure disconnect/reconnect, zero node churn"
    - "Depth (modulation index, feedback index) expressed in Hz proportional to the modulating operator's own current frequency, bounded by named MAX_MODULATION_INDEX/MAX_FEEDBACK_INDEX constants (T-05-02)"

key-files:
  created:
    - src/app/domain/dx7/audio/patch-plan.ts
    - src/app/domain/dx7/audio/patch-plan.spec.ts
  modified:
    - src/app/domain/dx7/audio/value-conversion.ts
    - src/app/domain/dx7/audio/value-conversion.spec.ts
    - src/app/core/audio/web-audio-synth-engine.ts
    - src/app/core/audio/web-audio-synth-engine.spec.ts

key-decisions:
  - "MAX_MODULATION_INDEX = 8, MAX_FEEDBACK_INDEX = 2 (feedback strictly below modulation, per T-05-02) — Claude's Discretion defaults per 05-CONTEXT.md; both are named, exported constants a later listening checkpoint can retune without touching call sites."
  - "CENTS_PER_DETUNE_STEP = 2 — the DX7's -7..+7 detune scale maps to ±14 cents at the extremes, well under a 100-cent semitone, matching RESEARCH.md Assumptions Log A5's proportional-fine-tuning rationale."
  - "Depth-scaling functions read 'that operator's frequency' as the operator's own oscillator.frequency.value at applyRouting()-call time (whatever noteOn/retrigger last set it to, or the Web-Audio-standard 440Hz default before any note has played) rather than re-deriving a note frequency inside applyRouting() itself — routing application stays independent of whether a note is currently held, matching the plan's 'For each of the 32 algorithms, applying the routing produces live connections...' behavior, which is unconditional on note state."
  - "An operator's levelGain can fan out to more than one target oscillator.frequency when the algorithm gives it multiple outgoing non-feedback edges (one modulator feeding two carriers) — Web Audio natively supports one output connecting to multiple destinations, so this needed no special-casing in applyRouting(); the topology-assertion helper in the spec was corrected mid-task to expect a connection-count equal to the operator's outgoing-edge count, not a hardcoded 1, after Algorithm 26/27's two-modulators-into-one-carrier shape caught the original stricter assertion."
  - "The switch-matrix test's pairs are algorithms whose feedback operator and carrier/modulator shape differ substantially (1 -> 32 -> 2 -> 1), not a 'feedback to no-feedback' pair as the plan's action text illustrates — verified via `grep -c 'feedback self-loop' algorithms.ts` that all 32 canonical rows declare a self-loop edge, so no non-feedback algorithm exists in this dataset to exercise that specific illustrative case. The exact-match topology assertion used for every step of the sequence proves the same 'no stale link survives' property regardless of which specific pairs are chosen."

patterns-established:
  - "planConnections(algorithm) + deriveCarriers(algorithm) is the only routing derivation path the engine calls — Task 3's full-sweep and switch-matrix specs compute their expectations from these same two functions, so a future dataset edit that breaks routing fails a named test rather than surfacing as a silent audio bug."
  - "Depth-scaling (outputLevelToModulationDepthHz / feedbackLevelToDepthHz) is applied as a value read at routing-application time from the already-tuned oscillator.frequency.value, establishing the seam Phase 7's AudioWorklet engine (or a future per-note depth-rescaling enhancement) would extend."

requirements-completed: [AUDIO-02]

coverage:
  - id: D1
    description: "All 32 algorithms patch without throwing, including every feedback self-loop, which closes legally through a persistent DelayNode (never a literal 0 delay)"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/core/audio/web-audio-synth-engine.spec.ts#applies all 32 algorithm ids without throwing, with the live topology matching planConnections/deriveCarriers exactly"
        status: pass
      - kind: unit
        ref: "src/app/core/audio/web-audio-synth-engine.spec.ts#sets the feedback delay time to a minimal non-zero value derived from the context sample rate"
        status: pass
    human_judgment: false
  - id: D2
    description: "Switching the selected algorithm while a note is held re-patches the sounding voice immediately (D-02) — zero node creation, zero oscillator start/stop, no new voice-gain automation entry, driven through InstrumentState via the engine's constructor effect"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/core/audio/web-audio-synth-engine.spec.ts#switching algorithms while a note is held creates zero nodes, adds no voice-gain automation entry, and starts/stops no oscillator"
        status: pass
      - kind: unit
        ref: "src/app/core/audio/web-audio-synth-engine.spec.ts#re-patches through InstrumentState.setAlgorithm() via the constructor effect, without the caller touching the engine directly"
        status: pass
    human_judgment: false
  - id: D3
    description: "After any algorithm switch, no connection from the previous algorithm's routing survives — live topology equals exactly the new algorithm's planConnections plus deriveCarriers, for every algorithm and across a representative switch sequence"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/core/audio/web-audio-synth-engine.spec.ts#applies all 32 algorithm ids without throwing... (exact-match assertion per algorithm)"
        status: pass
      - kind: unit
        ref: "src/app/core/audio/web-audio-synth-engine.spec.ts#switch matrix: after switching across representative algorithm pairs, the live topology always matches the destination algorithm exactly"
        status: pass
    human_judgment: false
  - id: D4
    description: "Routing derives only from AlgorithmDefinition.edges (via planConnections) and deriveCarriers — no per-algorithm special case, no second copy of the carrier/feedback rule; a disabled operator contributes zero gain via a multiplier rather than a skipped connection"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/audio/patch-plan.spec.ts#cross-algorithm invariants (all 32 ALGORITHMS entries)"
        status: pass
      - kind: unit
        ref: "src/app/core/audio/web-audio-synth-engine.spec.ts#a disabled operator contributes zero gain on both its carrier path and its modulation path"
        status: pass
    human_judgment: false
  - id: D5
    description: "planConnections and every DX7-scale conversion function are pure, framework-independent, and unit-tested without any Web Audio or Angular dependency (DOMAIN-04 gate)"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/audio/patch-plan.spec.ts (99 tests, all 32 algorithms)"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/audio/value-conversion.spec.ts (21 tests)"
        status: pass
      - kind: other
        ref: "npm run lint (DOMAIN-04 ESLint gate on src/app/domain/**/*.ts)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Feedback depth and modulation depth are both bounded by named maximum-index constants (MAX_FEEDBACK_INDEX < MAX_MODULATION_INDEX), so no algorithm or patch can drive the graph into runaway output (T-05-02)"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/audio/value-conversion.spec.ts#feedbackLevelToDepthHz > MAX_FEEDBACK_INDEX is strictly less than MAX_MODULATION_INDEX"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-07
status: complete
---

# Phase 5 Plan 2: Modulation routing, feedback DelayNode, and D-02 live re-patch Summary

**Generic edge-traversal patcher (`planConnections`) drives all 32 algorithms' Web Audio routing — modulation edges, a persistent feedback self-loop closed through a DelayNode, and per-operator ratio/detune-aware oscillator tuning — with an algorithm switch during a held note re-patching live and leaving zero stale connections.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files:** 6 (2 created, 4 extended)
- **Tests:** 685/685 passing (full suite); 99 new in `patch-plan.spec.ts`, 13 new in `value-conversion.spec.ts`, 7 new in `web-audio-synth-engine.spec.ts`

## Accomplishments

- `planConnections(algorithm)`: pure, zero-Angular/zero-Web-Audio traversal of `AlgorithmDefinition.edges` into a frozen, feedback-flagged `OperatorConnection[]` — one code path for all 32 algorithms, verified with a full 32-row sweep plus explicit Algorithm-1/Algorithm-32 fixtures
- `value-conversion.ts` extended with `operatorFrequencyHz` (ratio/fixed mode), `detuneToCents`, `outputLevelToModulationDepthHz`, `feedbackLevelToDepthHz`, and the named `MAX_MODULATION_INDEX`/`MAX_FEEDBACK_INDEX`/`CENTS_PER_DETUNE_STEP` bounds — all pure, boundary-tested, and finiteness-swept across every `COARSE_RATIOS` entry in both frequency modes
- `WebAudioSynthEngine`: every operator now owns a persistent feedback gain + feedback delay (delay time = one render quantum of the real `sampleRate`, never 0); `applyRouting()` walks `planConnections`/`deriveCarriers` exclusively, tearing down and reconnecting only the re-patchable `levelGain`/`feedbackDelay` outputs on every algorithm/operator/feedback change
- `noteOn`/retrigger now retune each of the six oscillators independently via `operatorFrequencyHz`, replacing the tracer's single shared note frequency
- A disabled operator's contribution is zeroed via a gain multiplier on whichever path (carrier or modulation) it occupies, never by skipping its connection — live topology stays a pure function of the algorithm alone
- Full-sweep, delay-link-count, switch-matrix, held-note-switch-zero-churn, disabled-operator, and effect-path (`InstrumentState.setAlgorithm()` + `TestBed.tick()`) coverage added to `web-audio-synth-engine.spec.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: planConnections — pure, data-driven patch plan for all 32 algorithms** - `a24fc00` (feat)
2. **Task 2: DX7-scale to Web Audio conversion — frequency, detune, modulation depth, feedback depth** - `4fe09cf` (feat)
3. **Task 3: Apply the plan — modulation edges, feedback DelayNode, and D-02 live re-patch** - `a51383b` (feat)

## Files Created/Modified

- `src/app/domain/dx7/audio/patch-plan.ts` - `OperatorConnection`, `planConnections`
- `src/app/domain/dx7/audio/patch-plan.spec.ts` - table-driven Algorithm 1/32 fixtures + a full 32-algorithm invariant sweep (99 tests)
- `src/app/domain/dx7/audio/value-conversion.ts` - `operatorFrequencyHz`, `detuneToCents`, `outputLevelToModulationDepthHz`, `feedbackLevelToDepthHz`, `CENTS_PER_DETUNE_STEP`, `MAX_MODULATION_INDEX`, `MAX_FEEDBACK_INDEX`
- `src/app/domain/dx7/audio/value-conversion.spec.ts` - boundary/proportionality/finiteness-sweep coverage for the new conversions
- `src/app/core/audio/web-audio-synth-engine.ts` - per-operator feedback gain/delay, generic `applyRouting()`, per-operator noteOn/retrigger tuning
- `src/app/core/audio/web-audio-synth-engine.spec.ts` - routing sweep, switch matrix, held-note-switch, disabled-operator, and effect-path coverage

## Decisions Made

See `key-decisions` in the frontmatter above for the full rationale on each of: the `MAX_MODULATION_INDEX`/`MAX_FEEDBACK_INDEX` values, `CENTS_PER_DETUNE_STEP`, reading "that operator's frequency" from the oscillator's current value at routing-application time, the fan-out connection-count fix, and the switch-matrix pair substitution (no non-feedback algorithm exists in the canonical 32-row dataset to exercise the plan's illustrative "feedback to no-feedback" case).

## Deviations from Plan

**1. [Test-authoring fix, not a production-code deviation] Fan-out connection-count assertion corrected mid-task**

- **Found during:** Task 3, first full-sweep test run
- **Issue:** The spec's initial topology-assertion helper asserted every operator's `levelGain` has exactly one outgoing connection. Algorithms with a two-modulators-into-one-carrier shape (e.g. Algorithm 26/27's `6->4` and `5->4`, both from different operators, is fine — but any algorithm where a single operator fans out to two different targets) legitimately produce more than one connection per `levelGain`, since Web Audio natively allows one output to connect to multiple destinations. This surfaced as a `1 vs 3` assertion failure on the first affected algorithm in the sweep.
- **Fix:** The assertion helper now computes the expected connection count from the number of outgoing non-feedback edges `planConnections` returns for that operator, rather than hardcoding 1. No production code changed — `applyRouting()` was already correct (Web Audio's native multi-destination fan-out required no special-casing).
- **Files modified:** `src/app/core/audio/web-audio-synth-engine.spec.ts`
- **Commit:** `a51383b` (folded into Task 3's single commit, found before the task's commit was made)

**2. Plan-illustration substitution: switch-matrix pairs**

- **Found during:** Task 3, writing the switch-matrix test
- **Issue:** The plan's action text illustrates the switch-matrix test with "an algorithm with feedback to one without, and back." A `grep -c 'feedback self-loop' algorithms.ts` count (32, matching the 32-row dataset) confirms every canonical algorithm declares a feedback self-loop edge — no non-feedback algorithm exists to exercise that specific pairing.
- **Fix:** Used a sequence of algorithms whose feedback operator and carrier/modulator shape differ substantially instead (1 → 32 → 2 → 1). Every step still asserts an exact-topology match against the destination algorithm's `planConnections`/`deriveCarriers`, which proves "no stale link survives" identically regardless of which specific algorithms are chosen.
- **Files modified:** `src/app/core/audio/web-audio-synth-engine.spec.ts`
- **Commit:** `a51383b`

## TDD Gate Compliance

Both `tdd="true"` tasks (Task 1 and Task 2) had their test file and implementation authored together in the same commit rather than strict RED-first, following the precedent already recorded for Phases 02-03/03-01/04-01/05-01 in `STATE.md`. Regression teeth were verified for the two functionally load-bearing points instead of a classic pre-implementation RED:

- **Task 1:** `planConnections`'s `isFeedback` flag was verified by intentionally weakening the test's own equivalence check first (`connection.from === feedbackOperator` alone, without the `to === feedbackOperator` conjunct) — this produced 31 real failures (every algorithm whose feedback operator also modulates another operator), confirming the sweep actually exercises the self-loop-specific logic before the correct two-sided check was restored.
- **Task 3:** The fan-out connection-count assertion (Deviation 1 above) was itself discovered by running the full 32-algorithm sweep against the real implementation and finding a genuine test-vs-behavior mismatch — equivalent regression-teeth evidence to a break/confirm-fail/restore probe, just surfaced by real dataset coverage rather than an intentional break.

## Issues Encountered

`node_modules` was absent from this worktree at session start (fresh worktree, no prior `npm install` run in it); ran `npm install` once before any verification command — standard environment setup, not a task deviation.

## Known Stubs

None. Every one of the 32 algorithms' modulation edges, feedback self-loop, and carrier connections are live and wired; no placeholder or hardcoded-empty path was introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `WebAudioSynthEngine.applyRouting()` and the persistent per-operator feedback gain/delay pair are the seam plan `05-04`'s listening checkpoint tunes against (`MAX_MODULATION_INDEX`/`MAX_FEEDBACK_INDEX`/`MASTER_GAIN` are all named, independently retunable constants).
- Plan `05-03` (full keyboard) can drive `noteOn`/`noteOff` across the full 12-key octave without any change to this plan's routing or tuning logic — `operatorFrequencyHz` already accepts any `noteFrequencyHz`.
- `git diff --exit-code src/app/core/audio/synth-engine.ts` still exits 0 — the shared Phase 1 `SynthEngine` contract is untouched.
- `MASTER_GAIN`'s perceptual loudness across carrier-heavy algorithms (Algorithm 32 especially, now audibly wired through six independent carriers) remains plan `05-04`'s explicitly-deferred listening checkpoint (05-01-SUMMARY.md's D4).

## Self-Check: PASSED

- All 6 source files (`patch-plan.ts`, `patch-plan.spec.ts`, `value-conversion.ts`,
  `value-conversion.spec.ts`, `web-audio-synth-engine.ts`, `web-audio-synth-engine.spec.ts`) verified
  present on disk.
- All 4 commits (`a24fc00`, `4fe09cf`, `a51383b`, `4273df1`) verified present in `git log --oneline --all`.
- `npm test` (685/685), `npm run lint`, and `npm run build` all verified green after Task 3.

---
*Phase: 05-first-playable-approximation*
*Completed: 2026-08-07*
