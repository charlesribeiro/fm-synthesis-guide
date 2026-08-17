---
phase: 09-dx7-style-envelopes-and-parameter-mapping
plan: 01
subsystem: audio
tags: [dsp, audioworklet, envelope, fm-synthesis, angular, vitest]

# Dependency graph
requires:
  - phase: 08-algorithm-routing-and-feedback
    provides: GraphRouter, buildRoutingConfig, worklet message contract, WorkletSynthEngine cutover (D-01)
provides:
  - Structured four-rate/four-level Dx7Envelope replacing the flat envelopeLevel stand-in
  - Pure, allocation-free EnvelopeGenerator kernel (six instances live inside GraphRouter)
  - envelopeRateToLevelUnitsPerSample rate-to-speed curve
  - setGate worklet message (open/velocity) and GraphRouter.setGate
  - Per-operator envelope multiply inside GraphRouter.render(), applied after renderWithFeedback
  - WorkletSynthEngine with the dedicated per-voice gain node removed; note lifecycle now posts gate messages
affects: [09-02, 09-03, 09-04]

# Actuals (#2632)
actuals:
  tokens: 31226
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-allocation, per-sample, instance-field render loop (EnvelopeGenerator mirrors PhaseModulatedOperator's shape)"
    - "Gate-and-warm-up render-path test pattern: gate the router at maximum velocity with a maximum-level/maximum-rate envelope, render a warm-up block count computed from the exported curve, then compare only the post-warm-up block"

key-files:
  created:
    - src/app/domain/dx7/dsp/envelope-generator.ts
    - src/app/domain/dx7/dsp/envelope-generator.spec.ts
  modified:
    - src/app/domain/dx7/models/operator-parameters.ts
    - src/app/domain/dx7/audio/value-conversion.ts
    - src/app/domain/dx7/dsp/worklet-messages.ts
    - src/app/domain/dx7/dsp/graph-router.ts
    - worklets/dx7-worklet-processor.ts
    - src/app/core/audio/worklet-synth-engine.ts

key-decisions:
  - "Rate-curve endpoints ENVELOPE_MIN_FULL_SCALE_SECONDS=0.002, ENVELOPE_MAX_FULL_SCALE_SECONDS=6.4, geometrically interpolated — puts rate 50 at ~108.6ms (matches the RESEARCH.md calibration anchor), rate 74 at ~15.4ms, rate 55 at ~72.3ms (the two DEFAULT_ENVELOPE ramp lengths already approved at the 05-04/07-03 listening checkpoints)"
  - "Render-path specs (graph-router.spec.ts, algorithm-routing.spec.ts) gate the router open at MAX_VELOCITY with every operator's envelope forced to maximum rate/maximum level, render a computed warm-up block count, then compare only the post-warm-up block against Phase 8's un-enveloped expected values — reference-evaluator.ts stays byte-identical"
  - "playground.spec.ts (not in files_modified) needed a blast-radius fix: it asserted directly on WorkletSynthEngine's now-removed voiceGain node — rewritten to assert on posted setGate messages instead (Rule 1/3 deviation)"

patterns-established:
  - "Task-commit split by TDD unit rather than by the plan's numbered action groups: Task 1's tree only compiles as a whole (widening one shared field touches every consumer simultaneously, exactly as the plan's own objective predicts), so it landed as one atomic commit; Task 2's spec-only additions landed as a second, separately reviewable commit"

requirements-completed: [ENGINE-03]

coverage:
  - id: D1
    description: "OperatorParameters.envelope carries a structured Dx7Envelope (four rates, four levels) in place of the flat envelopeLevel stand-in; DEFAULT_OPERATOR_PARAMETERS uses one identical DEFAULT_ENVELOPE for all six operators"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/models/operator-parameters.spec.ts#DEFAULT_OPERATOR_PARAMETERS/DEFAULT_ENVELOPE"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/models/patch.spec.ts#DEFAULT_PATCH gives all six operators the identical envelope object reference (D-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "EnvelopeGenerator: six independent per-operator envelope generators inside GraphRouter, each scaling its own operator's block after render/renderWithFeedback and strictly before the block is read as a carrier contribution or modulation source"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/envelope-generator.spec.ts#EnvelopeGenerator"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/dsp/graph-router.spec.ts#GraphRouter (never-gated silence, gated Algorithm 1 match, all-zero-when-never-gated)"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/dsp/algorithm-routing.spec.ts#Algorithm $id ($name) (32-row gated cross-check, D-11 bounded-output sweep)"
        status: pass
    human_judgment: false
  - id: D3
    description: "setGate worklet message reaches the kernel end to end: WorkletSynthEngine.noteOn/noteOff/allNotesOff/destroy post gate messages instead of scheduling a Web Audio ramp; Dx7WorkletProcessor dispatches setGate to GraphRouter.setGate"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/worklet-messages.spec.ts#parseWorkletMessage (setGate round-trip and hostile-payload matrix)"
        status: pass
      - kind: unit
        ref: "src/app/core/audio/worklet-synth-engine.spec.ts#note lifecycle"
        status: pass
      - kind: unit
        ref: "src/app/core/audio/worklet-processor-bundle.spec.ts#worklet-processor-bundle"
        status: pass
    human_judgment: false
  - id: D4
    description: "Global click-prevention voice ramp and its dedicated gain node removed from WorkletSynthEngine; velocity-to-amplitude scaling survives as a router-side output-stage multiplier"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-synth-engine.spec.ts#schedules the master gain to 0 initially"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/dsp/graph-router.spec.ts#a router configured with any algorithm but never gated renders an all-zero block"
        status: pass
    human_judgment: false
  - id: D5
    description: "Envelope state machine timing/continuity/boundary/long-hold invariants asserted by tests that fail when the behaviour is removed"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/envelope-generator.spec.ts#EnvelopeGenerator state-machine invariants (Task 2)"
        status: pass
    human_judgment: false

duration: ~2h
completed: 2026-08-15
status: complete
---

# Phase 9 Plan 01: DX7-style envelope generator wired end to end Summary

**Six independent per-operator four-rate/four-level DX7-style envelopes now shape every played note inside the AudioWorklet kernel, driven by a new `setGate` message that replaced `WorkletSynthEngine`'s Web Audio voice-ramp gain node.**

## Performance

- **Duration:** ~2h (recovered from an interrupted prior session; this run picked up an unverified draft patch, audited it against the plan, completed the remaining ~40% of Task 1's scope, then executed Task 2 fresh)
- **Tasks:** 2/2
- **Files modified:** 22 (1 file — `envelope-generator.spec.ts` — touched by both tasks)

## Accomplishments

- `OperatorParameters.envelope: Dx7Envelope` (four rates, four levels, DX7 0-99 integer scale) replaces the flat `envelopeLevel` stand-in everywhere in the tree; `DEFAULT_ENVELOPE` (rates `[74,74,74,55]`, levels `[99,99,99,0]`) is shared by reference across all six operators on every algorithm (D-06).
- New `envelopeRateToLevelUnitsPerSample` rate-to-speed curve (`ENVELOPE_MIN_FULL_SCALE_SECONDS=0.002` / `ENVELOPE_MAX_FULL_SCALE_SECONDS=6.4`, geometric interpolation) — see exact durations table below.
- New `EnvelopeGenerator` class: an allocation-free, per-sample four-segment state machine. `gateOn`/`gateOff` never assign a fixed starting level — a retrigger or release always moves continuously from wherever the level currently sits (D-04).
- `GraphRouter` now owns six `EnvelopeGenerator` instances, multiplies each operator's rendered block by its own envelope's amplitude immediately after `render`/`renderWithFeedback` returns (so the feedback delay line keeps reading the raw, unscaled sample — Phase 8's feedback correctness proof is untouched), and applies the gated velocity amplitude as the final output-stage multiplier alongside `MASTER_GAIN`.
- `SetGateMessage`/`setGateMessage` added to the shared worklet message contract; `Dx7WorkletProcessor` dispatches it to `GraphRouter.setGate`.
- `WorkletSynthEngine`: `WORKLET_ATTACK_SECONDS`, `WORKLET_RELEASE_TIME_CONSTANT`, `WORKLET_RELEASE_SECONDS`, and the dedicated `voiceGain` node are gone. `noteOn`/`noteOff`/`allNotesOff`/`destroy` post gate messages and perform zero `AudioParam` scheduling. The master gain node now starts at `0` instead of `MASTER_GAIN` (closes the pre-routed-mode continuous-tone window the old voice gain used to close).
- The envelope state machine's timing, per-sample-not-per-block advance, mid-segment continuity, rate/level boundary behaviour, and long-hold precision are all proven by dedicated tests (Task 2) — Task 1's implementation needed no production fix for any of them.

## Task Commits

1. **Task 1: One note, six envelopes, end to end** - `1443217` (feat) — widened parameter model, envelope kernel, gate message, routed application, removal of the global voice ramp; 22 files.
2. **Task 2: Prove the envelope state machine** - `da21fbc` (test) — exhaustive `EnvelopeGenerator` invariant suite; 1 file (`envelope-generator.spec.ts`, appended to the file Task 1 created).

_Note: this task's own `<action>` text suggested committing after each of its 8 numbered sub-groups. Given the plan's own stated premise — "every consumer of that field has to move with it in the same commit or the tree does not compile" — sub-group commits would each have left the tree in a broken (non-compiling or non-passing) intermediate state. Task 1 landed as one atomic commit at the `<task>`-XML granularity instead; see "Deviations from Plan" below._

## Files Created/Modified

- `src/app/domain/dx7/dsp/envelope-generator.ts` (new) - Pure four-segment envelope state machine, zero allocation in `render`.
- `src/app/domain/dx7/dsp/envelope-generator.spec.ts` (new) - Task 1's core-behaviour suite plus Task 2's exhaustive invariant suite.
- `src/app/domain/dx7/models/operator-parameters.ts` - `Dx7Envelope`, `DEFAULT_ENVELOPE`, rate bounds, envelope guards; `envelope` replaces `envelopeLevel`.
- `src/app/domain/dx7/audio/value-conversion.ts` - `envelopeRateToLevelUnitsPerSample` and its two curve-endpoint constants.
- `src/app/domain/dx7/dsp/worklet-messages.ts` - `SetGateMessage`, `setGateMessage`, widened operator-entry guard.
- `src/app/domain/dx7/dsp/graph-router.ts` - `envelopesById`, `setGate`, per-operator envelope multiply, velocity output-stage multiplier.
- `worklets/dx7-worklet-processor.ts` - `setGate` dispatch branch.
- `src/app/core/audio/worklet-synth-engine.ts` - Voice-gain node and ramp constants removed; gate messages posted instead.
- `src/app/domain/dx7/lessons/lesson-definition.ts`, `try-this.ts` (+ specs) - `envelope` excluded from `TryThisParam` (whole-object field, no increase/decrease direction).
- `src/app/domain/dx7/models/operator-parameters.spec.ts`, `patch.spec.ts`, `value-conversion.spec.ts`, `worklet-messages.spec.ts`, `graph-router.spec.ts`, `algorithm-routing.spec.ts`, `worklet-synth-engine.spec.ts`, `worklet-processor-bundle.spec.ts`, `instrument-state.spec.ts` - Fixture/call-site migrations to the structured envelope field; render-path specs additionally gated (see Decisions).
- `src/app/features/playground/playground.spec.ts` (blast-radius fix, not in `files_modified`) - Rewritten to assert on posted `setGate` messages instead of the removed `voiceGain` node.

## Decisions Made

**Rate-curve endpoint constants and the full-scale durations they produce** (`envelopeRateToLevelUnitsPerSample`, `ENVELOPE_MIN_FULL_SCALE_SECONDS=0.002`, `ENVELOPE_MAX_FULL_SCALE_SECONDS=6.4`):

| Rate | Full-scale duration |
|------|---------------------|
| 0 (`MIN_ENVELOPE_RATE`) | 6400 ms |
| 50 | 108.62 ms |
| 55 (`DEFAULT_ENVELOPE` release rate) | 72.26 ms |
| 74 (`DEFAULT_ENVELOPE` attack rate) | 15.35 ms |
| 99 (`MAX_ENVELOPE_RATE`) | 2 ms |

Rate 50 landing at ~108.6ms matches RESEARCH.md's calibration anchor (the cited hardware rate-50 decay time constant, carried to five time constants). Rate 74's ~15.4ms and rate 55's ~72.3ms match the previously-approved `WORKLET_ATTACK_SECONDS=0.015s`/`WORKLET_RELEASE_SECONDS=0.075s` listening-checkpoint values (05-04, 07-03), preserving Phase 8's already-approved envelope feel unchanged.

**Task 2's cases required no production change.** Every behaviour in Task 2's `<behavior>` block (exact segment-completion sample counts, per-sample-not-per-block advance, mid-segment gate-off/gate-on continuity, rate/level boundary finiteness, long-hold exactness, zero-release exactness) was already satisfied by Task 1's `EnvelopeGenerator` implementation. Per the break-then-restore substitution the plan specifies for this situation: the continuity case's teeth were proven by editing `gateOn`/`gateOff` to assign `MIN_ENVELOPE_LEVEL` as a fixed starting value, confirming the test failed, then reverting. The **first probe attempt used parameters too weak to catch the bug** — `attackRate=20`/`releaseRate=30` with a 200-sample window left `currentLevel` already within ~0.36 of zero at each gate transition (the slow rate meant the level had barely moved from its 0 starting point), so forcing it to `MIN_ENVELOPE_LEVEL` produced no detectable jump and the broken test passed. The fixture was redesigned to `attackRate=releaseRate=70`, a 100-sample window, and a non-zero release target (20 instead of 0), leaving `currentLevel` meaningfully non-zero (~10.6) at each transition; the redesigned probe then failed as expected (`AssertionError: expected 0.0114 to be less than or equal to 0.0021`) and passed again once reverted.

**Warm-up block count and gating pattern adopted in the render-path specs:** `WARM_UP_BLOCK_COUNT = ceil(ceil((MAX_ENVELOPE_LEVEL - MIN_ENVELOPE_LEVEL) / envelopeRateToLevelUnitsPerSample(MAX_ENVELOPE_RATE, sampleRate)) / blockSize)`, which evaluates to **1** at 44.1kHz/128-sample blocks (99 level units at the fastest rate's ~1.122 units/sample step completes in 89 samples, under one 128-sample block). Both `graph-router.spec.ts` and `algorithm-routing.spec.ts` gate the router open at `MAX_VELOCITY` with every operator's envelope forced to maximum rate/maximum level (`GATED_MAX_ENVELOPE`), render and discard `WARM_UP_BLOCK_COUNT` blocks, then render the block under comparison. For the 32-row cross-check, the independent reference evaluator is invoked with `blockSize = (WARM_UP_BLOCK_COUNT + 1) * RENDER_QUANTUM_FRAMES` and only its tail slice is compared — `reference-evaluator.ts` itself stays byte-identical to `HEAD` (verified by the plan's own automated check).

**Every one of the thirty-two `algorithm-routing.spec.ts` cross-check rows held the existing `CROSS_CHECK_DECIMAL_PLACES = 6` tolerance** — no row needed loosening.

**`GraphRouter routing-change hygiene (T-08-04)` test needed more than a mechanical fixture replacement.** Simply gating both the "reused" and "freshly-constructed" routers independently (each warmed up separately) produced a false failure: `setRouting` resets operator phase and feedback history to zero on an algorithm switch, but the naive fix advanced the fresh router's phase via its own warm-up renders while the reused router's phase reset to zero at the switch — the two sides' phase states no longer lined up for an exact `toEqual`. Fixed by rendering the same `WARM_UP_BLOCK_COUNT`-block warm-up *after* the reused router's post-switch phase reset too (a no-op for its already-saturated envelope, but real phase/feedback-history progress), putting both sides at an identical elapsed-sample-count state before the final comparison block.

**`playground.spec.ts` blast-radius fix (Rule 1/3 deviation, not in `files_modified`):** it asserted directly on `WorkletSynthEngine`'s Web Audio `voiceGain` automation entries, which no longer exist after the voice-gain-node removal. Rewritten to assert on the posted `setGate` messages instead, matching the new note-lifecycle contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `worklet-synth-engine.ts` left half-migrated by the recovered patch**
- **Found during:** Task 1 audit (recovered_work_notice step)
- **Issue:** The recovered, unverified patch updated this file's imports (removed `velocityToAmplitude`, added `setGateMessage`) but never touched the actual `noteOn`/`noteOff`/`releaseVoice`/`destroy`/`buildAndStart`/`teardownGraph` bodies, the `voiceGain` field, or the ramp constants — the file would not have compiled as left.
- **Fix:** Completed the migration per the plan's item 7: removed the ramp constants and `voiceGain` field/node entirely, changed master-gain construction to start at `0`, and rewrote `noteOn`/`noteOff`/`allNotesOff`/`destroy` to post gate messages with zero `AudioParam` scheduling.
- **Files modified:** `src/app/core/audio/worklet-synth-engine.ts`
- **Verification:** `npm test`, `npm run build`, `npm run lint`, `npm run typecheck:worklet` all green.
- **Committed in:** `1443217`

**2. [Rule 3 - Blocking] Nine call-site/fixture groups (11 files) the recovered patch never touched**
- **Found during:** Task 1 audit
- **Issue:** `graph-router.spec.ts`, `worklet-messages.spec.ts`, `algorithm-routing.spec.ts`, `lesson-definition.ts`/`.spec.ts`, `try-this.ts`/`.spec.ts`, `instrument-state.spec.ts`, `worklet-synth-engine.spec.ts`, `worklet-processor-bundle.spec.ts`, `patch.spec.ts` all still referenced the removed `envelopeLevel` field or (for the render-path specs) assumed an ungated router still produces sound — none of these compiled or passed against the patched production code.
- **Fix:** Migrated every fixture to the structured `envelope` field; gated and warmed the render-path specs per the plan's documented pattern (see Decisions above).
- **Files modified:** listed under "Files Created/Modified" above.
- **Verification:** Full `npm test` suite green (1094/1094).
- **Committed in:** `1443217`

**3. [Rule 1 - Bug] Blast-radius break in `playground.spec.ts` (not in `files_modified`)**
- **Found during:** Full-suite verification after Task 1's other fixes
- **Issue:** Asserted directly on the now-removed `voiceGain` Web Audio node.
- **Fix:** Rewritten to assert on posted `setGate` messages.
- **Files modified:** `src/app/features/playground/playground.spec.ts`
- **Verification:** `npm test` green.
- **Committed in:** `1443217`

**4. [Rule 1 - Bug] `DEFAULT_ENVELOPE` tuple typing**
- **Found during:** Task 1 typecheck
- **Issue:** `Object.freeze([74, 74, 74, 55])` widens to `readonly number[]`, not the required `readonly [number, number, number, number]` tuple, failing `tsc`.
- **Fix:** Added `as const` to both literal arrays.
- **Files modified:** `src/app/domain/dx7/models/operator-parameters.ts`
- **Verification:** `npx tsc --noEmit -p tsconfig.app.json` clean.
- **Committed in:** `1443217`

**5. [Rule 1 - Bug] Stray `envelopeLevel` string in a doc comment**
- **Found during:** Plan's own automated verify check (`grep -rl 'envelopeLevel' src/ worklets/`)
- **Issue:** `operator-parameters.ts`'s head comment referenced the old field name inside backticks, tripping the plan's zero-files acceptance criterion.
- **Fix:** Reworded to avoid the literal string.
- **Files modified:** `src/app/domain/dx7/models/operator-parameters.ts`
- **Verification:** Grep returns 0 files.
- **Committed in:** `1443217`

---

**Total deviations:** 5 auto-fixed (2 bugs completing the recovered patch, 1 blocking call-site migration, 1 blast-radius bug fix, 1 typecheck/lint bug fix).
**Impact on plan:** All auto-fixes were necessary to reach the plan's own stated verification bar (green `npm test`/`build`/`lint`/`typecheck:worklet`, zero `envelopeLevel` occurrences). No scope creep — no behavior was added beyond what the plan's `<action>` and `<must_haves>` already specified.

## TDD Gate Compliance

Task 1 (`tdd="true"`, `type="tracer"`): the recovered patch had already written `envelope-generator.ts` and its initial spec together rather than strict RED-then-GREEN (consistent with the plans-02-03/03-01/04-01/08-01 precedent this project has repeatedly recorded). No corrective action taken — the implementation is correct and the tests have teeth (verified via Task 2's break-then-restore probe).

Task 2 (`tdd="true"`, `type="auto"`): RED phase found every case already passing against Task 1's implementation — no production change required. Per the plan's own explicit instruction for this situation, a break-then-restore regression probe was substituted for the mid-segment continuity case (see "Decisions Made" above for the full account, including the first probe attempt's false pass and the fixture redesign that fixed it).

## Issues Encountered

- The recovered patch from the interrupted prior session covered roughly 60% of Task 1's file list and was internally consistent for the files it did touch, but left `worklet-synth-engine.ts` in a non-compiling half-migrated state and 9 further call-site/fixture groups (11 files) untouched entirely. Resolved per the recovered_work_notice protocol: applied, audited against the plan's must-haves/prohibitions, then completed the remainder as fresh work (see Deviations above).
- Two render-path test designs required iteration to get exactly right: the 32-row cross-check's warm-up-then-tail-slice comparison technique, and the routing-change-hygiene test's phase-alignment fix (see Decisions above for both).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SYNTH_ENGINE` (still `WorkletSynthEngine`, D-01 from Phase 8) now renders a real envelope-shaped note end to end: note-on starts six independent attack segments, note-off releases them from wherever they sit, velocity still scales loudness via the router's output-stage multiplier, and the app is silent at rest (no dedicated voice gain node; silence depends entirely on the router's own never-gated-renders-zero guarantee, itself covered by a dedicated test).
- The dev listening harness (`worklets/harness/`) is now silent for routed playback, as `<flagged_assumptions>` predicted — it posts no gate message yet. This is bounded to the dev-only harness; plan 09-04 is the documented owner of wiring its gate control. Not a blocker for 09-02/09-03.
- Plan 09-02 (per this plan's own cross-references) owns expanding the envelope hostile-payload matrix beyond Task 1's minimum coverage and the velocity-scaling/silence-at-rest regression tests beyond what this plan's `worklet-synth-engine.spec.ts` additions already cover.
- No blockers. `reference-evaluator.ts` is untouched (`git diff --stat HEAD -- src/app/domain/dx7/dsp/reference-evaluator.ts` prints nothing), preserving its independence for future cross-checks.

---
*Phase: 09-dx7-style-envelopes-and-parameter-mapping*
*Completed: 2026-08-15*

## Self-Check: PASSED

- `src/app/domain/dx7/dsp/envelope-generator.ts` — FOUND
- `src/app/domain/dx7/dsp/envelope-generator.spec.ts` — FOUND
- `src/app/core/audio/worklet-synth-engine.ts` — FOUND
- Commit `1443217` — FOUND
- Commit `da21fbc` — FOUND
