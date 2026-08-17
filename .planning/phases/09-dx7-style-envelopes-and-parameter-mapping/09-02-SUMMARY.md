---
phase: 09-dx7-style-envelopes-and-parameter-mapping
plan: 02
subsystem: testing
tags: [dsp, audioworklet, envelope, fm-synthesis, vitest, security, regression]

# Dependency graph
requires:
  - phase: 09-dx7-style-envelopes-and-parameter-mapping
    provides: "Plan 09-01's structured Dx7Envelope, EnvelopeGenerator kernel, setGate worklet message, and GraphRouter per-operator envelope multiply"
provides:
  - "Hostile-payload matrix for the setGate message and the widened envelope member (T-09-01), proven with a scratch probe"
  - "Kernel note-lifecycle sweep (finite/bounded across gate-on/attack/sustain/gate-off/release, one algorithm per taxonomy group, plus a max-feedback/max-level worst case)"
  - "Silence-at-rest guard (never-gated renders zero; completed release against a zero target stays zero)"
  - "Modulator-envelope reachability proof — this phase's single highest-value mechanical guard — with a scratch probe confirming it has teeth"
  - "Held-note re-patch continuity guard (routing change and operator-parameter change mid-note do not restart the envelope)"
  - "End-to-end velocity regression protecting Pitfall 2 (dropped velocity) after the dedicated voice-gain node's removal, with a scratch probe"
  - "Explicit regression coverage for Phase 8's already-shipped ratio/fixed frequency-mode math (the ROADMAP's Phase 9 criterion)"
  - "Rate-curve full-scale-duration regression, re-derived from the exported endpoint constants rather than hardcoded"
  - "Gated-note bundle parity between the built worklet bundle and the in-repo GraphRouter kernel"
affects: [09-03, 09-04]

# Actuals (#2632)
actuals:
  tokens: 10393
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Index-parameterised hostile-payload generation: a loop over rates/levels x 4 indices x {wrong-type, non-integer, non-finite, below-min, above-max} builds the envelope entry-value matrix, rather than 48 hand-written literal cases"
    - "Deterministic envelope-difference fixture: two envelopes sharing the same MAX_ENVELOPE_RATE (so both reach plateau within the same WARM_UP_BLOCK_COUNT) but different plateau LEVELs, so a reachability comparison is not a timing race"
    - "Break-then-restore scratch probes recorded inline as PR-visible edits, run, observed to fail the target case only, then reverted with a `git diff --stat` empty-diff check before committing"

key-files:
  created: []
  modified:
    - src/app/domain/dx7/dsp/worklet-messages.spec.ts
    - src/app/core/audio/worklet-processor-bundle.spec.ts
    - src/app/domain/dx7/dsp/graph-router.spec.ts
    - src/app/core/audio/worklet-synth-engine.spec.ts
    - src/app/domain/dx7/audio/value-conversion.spec.ts

key-decisions:
  - "The gate-message hostile-payload matrix is its own new describe block (following the file's existing per-message-kind precedent: separate blocks already exist for setAlgorithm/setOperatorParameters/setFeedback) rather than forced into an unrelated existing block; the envelope hostile-payload shapes were instead appended into the EXISTING setOperatorParameters table per the plan's explicit instruction, since envelope is a member of that message kind, not a new kind"
  - "Modulator-envelope reachability fixture uses two envelopes at the SAME MAX_ENVELOPE_RATE (fast, deterministic plateau timing via the existing WARM_UP_BLOCK_COUNT) but different plateau LEVELs (99 vs 40) — isolates the comparison to 'does the envelope's amplitude reach the output' rather than conflating it with attack-timing differences"
  - "Held-note continuity is asserted on block peak-amplitude ratio (>= 50% of the pre-change peak), not raw sample equality — routing changes reset operator phase (Phase 8 behaviour, unchanged), so a byte-for-byte comparison would be a false negative; peak-amplitude continuity is the correct level at which 'the envelope did not restart' is falsifiable"
  - "The end-to-end velocity regression lives in worklet-synth-engine.spec.ts (matching the plan's own file list) but drives GraphRouter directly, not WorkletSynthEngine — the engine itself no longer performs the velocity->amplitude conversion (that moved to the render thread in 09-01), so only the kernel can prove the conversion survived"
  - "CENTS_PER_OCTAVE is exported from value-conversion.ts; the frequency-mode regression imports it (with CENTS_PER_DETUNE_STEP) so the expected octave calculation is derived from the shipped constant rather than a hardcoded 1200"

patterns-established:
  - "Rate-curve regression re-derives the expected full-scale duration from the two exported endpoint constants (ENVELOPE_MIN/MAX_FULL_SCALE_SECONDS) via the same geometric-interpolation formula, rather than asserting against a hardcoded millisecond literal — this proves the function implements geometric interpolation (not just that it passes through the two endpoints), and stays correct if the endpoint constants are ever recalibrated"

requirements-completed: [ENGINE-03]

coverage:
  - id: D1
    description: "Hostile-payload matrix for the setGate message (open/velocity: wrong type, non-integer, non-finite, out-of-range, throwing getter) and for the widened envelope member (container shapes, tuple-length shapes either side of 4, per-index entry-value shapes at every one of the 4 rate/level indices) — proven with a scratch probe that loosened the gate branch"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/worklet-messages.spec.ts#parseWorkletMessage — hostile-payload matrix for setGate (T-09-01)"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/dsp/worklet-messages.spec.ts#parseWorkletMessage — hostile-payload matrix for setOperatorParameters (T-08-01) [envelope cases]"
        status: pass
    human_judgment: false
  - id: D2
    description: "Kernel note-lifecycle sweep proven finite and bounded across gate-on/attack/long-sustain/gate-off/release on one algorithm per teaching-taxonomy group (selected by reading teachingTags from the dataset), repeated once at maximum feedback with every operator at maximum output level"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/graph-router.spec.ts#GraphRouter note-lifecycle sweep (T-09-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Silence-at-rest guard: a never-gated router renders exactly zero, and a router whose release has completed against DEFAULT_ENVELOPE's zero release target stays exactly zero across many further blocks, on every taxonomy-sweep algorithm"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/graph-router.spec.ts#GraphRouter silence at rest (T-09-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Modulator-envelope reachability (this plan's highest-value case): changing only a modulator-role operator's envelope changes the rendered block; a mirrored carrier-only case proves symmetry. Proven with a scratch probe that moved the envelope multiply into the carrier-summing loop — the modulator case failed (0 differing samples) while the carrier case and all other cases still passed"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/graph-router.spec.ts#GraphRouter modulator-envelope reachability (T-09-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Held-note re-patch continuity: a routing-config change and, separately, an operator-parameter change applied while gated do not restart the envelope (post-change block peak stays within 50% of the pre-change peak)"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/graph-router.spec.ts#GraphRouter held-note re-patch continuity (D-04)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Velocity survival end-to-end after the removed voice-gain ramp: exactly one gain node is built, no gain-parameter scheduling occurs across a note lifecycle, and two GraphRouter instances gated at different velocities produce peak amplitudes in the curve-predicted direction and ratio — proven with a scratch probe that forced the velocity multiplier to a constant"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-synth-engine.spec.ts#End-to-end velocity regression (Pitfall 2)"
        status: pass
      - kind: unit
        ref: "src/app/core/audio/worklet-synth-engine.spec.ts#WorkletSynthEngine (exactly-one-gain-node and no-scheduling cases)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Explicit regression coverage for Phase 8's already-shipped ratio/fixed frequency-mode math (ratio mode across every coarse ratio position and both detune extremes; fixed mode across several note frequencies with a deliberately extreme ignored ratio; a six-operator mixed-mode case) — the ROADMAP's Phase 9 frequency-mode success criterion"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/audio/value-conversion.spec.ts#operatorFrequencyHz — frequency-mode regression coverage"
        status: pass
    human_judgment: false
  - id: D8
    description: "Rate-curve full-scale-duration regression: DEFAULT_ENVELOPE's four rates re-derived from the exported ENVELOPE_MIN/MAX_FULL_SCALE_SECONDS constants via the geometric-interpolation formula, proving the formula itself rather than only its two endpoints"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/audio/value-conversion.spec.ts#envelopeRateToLevelUnitsPerSample — DEFAULT_ENVELOPE's full-scale durations"
        status: pass
    human_judgment: false
  - id: D9
    description: "Gated-note bundle parity: the built worklet bundle, driven through a gate-on message, renders the same enveloped samples as the in-repo GraphRouter kernel — asserting the compared block is non-silent before asserting parity, so the case cannot pass by comparing zeros to zeros"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-processor-bundle.spec.ts#worklet-processor-bundle (gated-note parity case)"
        status: pass
    human_judgment: false

duration: ~1h10m
completed: 2026-08-15
status: complete
---

# Phase 9 Plan 02: Test-only hardening — hostile-payload matrix, kernel lifecycle proofs, and Phase 8/9 regression guards Summary

**Every pitfall documented for this phase (malformed gate/envelope payloads, an unbounded note lifecycle, a carrier-only envelope, dropped velocity) now has a named mechanical guard proven with a break-then-restore scratch probe, plus explicit regression coverage for Phase 8's frequency-mode math and Phase 9's rate curve — 251 new/extended test cases across 5 spec files, zero production code changed.**

## Performance

- **Duration:** ~1h10m
- **Tasks:** 3/3
- **Files modified:** 5 (all spec-only)

## Accomplishments

- **Task 1 — hostile-payload matrix + bundle parity.** `worklet-messages.spec.ts` gained a new `setGate` hostile-payload describe block (10 rejection cases + throwing-getter case + 2 positive-boundary cases, all bounds imported rather than literal) and the existing `setOperatorParameters` table gained container/tuple-length/per-index envelope entry-value cases (48 index-parameterised cases via a loop over `rates`/`levels` × 4 indices × 5 malformed-value shapes, plus 6 container/tuple-length cases and a throwing-getter case). `worklet-processor-bundle.spec.ts` gained a gated-note parity case proving the built worklet bundle renders the same enveloped samples as the in-repo `GraphRouter` kernel, with an explicit non-silence assertion before the parity assertion.
- **Task 2 — kernel lifecycle proofs.** `graph-router.spec.ts` gained four new describe blocks: a note-lifecycle sweep (finite + bounded across gate-on/attack/sustain/gate-off/release, one algorithm per teaching-taxonomy group read from the dataset, repeated at max feedback/max output level); a silence-at-rest guard (never-gated renders zero; post-release renders zero for many blocks); the modulator-envelope reachability proof (this plan's highest-value case, with a mirrored carrier-only symmetry check); and a held-note re-patch continuity guard (routing-config and operator-parameter changes mid-note don't restart the envelope).
- **Task 3 — velocity, removed-ramp, and Phase 8/9 regressions.** `worklet-synth-engine.spec.ts` gained an exactly-one-gain-node case, a no-gain-scheduling-across-a-lifecycle case, and an end-to-end velocity regression driving `GraphRouter` directly (since the engine itself no longer converts velocity). `value-conversion.spec.ts` gained the ROADMAP's frequency-mode regression group (ratio mode at every coarse ratio × both detune extremes; fixed mode at several note frequencies with a deliberately-extreme ignored ratio; a six-operator mixed-mode case) and a rate-curve full-scale-duration group that re-derives expected durations from the exported endpoint constants rather than a hardcoded literal.
- **Three scratch probes, all recorded and all reverted clean** (each confirmed via `git diff --stat` on the production file returning empty before committing):
  1. **Gate-branch loosening** (Task 1): replaced `parseWorkletMessage`'s `setGate` branch with an unconditional `setGateMessage(Boolean(open), Number(velocity))`. Result: **17 cases failed** (all `setGate`-kind rejection/positive cases across both the base table and the new hostile-payload matrix), all other 161 cases still passed.
  2. **Envelope multiply relocated to the carrier-summing loop** (Task 2): removed the per-operator `block[i] *= envelopeScratch[i]` multiply from `GraphRouter.render()`'s main loop and instead rendered+applied the envelope only for carriers, inside the final carrier-summing loop — exactly reproducing "an envelope applied only where carriers are summed." Result: **the modulator-envelope-reachability case failed** (`expected 0 to be greater than or equal to 100` — zero differing samples), the carrier-envelope-reachability case and all 15 other `graph-router.spec.ts` cases still passed.
  3. **Velocity multiplier forced constant** (Task 3): `GraphRouter.setGate`'s `this.velocityAmplitude = velocityToAmplitude(velocity)` replaced with `this.velocityAmplitude = 1`. Result: **the end-to-end velocity regression failed** (`expected 0.0849... to be greater than 0.0849...` — both velocities produced the identical peak once the multiplier was pinned), all 33 other `worklet-synth-engine.spec.ts` cases still passed.

## Task Commits

1. **Task 1: Hostile-payload matrix for the gate message and the widened envelope member, plus gated-note bundle parity** - `cb5d085` (test) — 2 files, 266 insertions.
2. **Task 2: Kernel note-lifecycle sweep, modulator-envelope reachability, silence at rest, and held-note re-patch continuity** - `ae6b6f9` (test) — 1 file, 270 insertions.
3. **Task 3: Velocity survival, removed-ramp proof, and the frequency-mode regression the ROADMAP criterion needs** - `4175dc0` (test) — 2 files, 196 insertions.

## Files Created/Modified

- `src/app/domain/dx7/dsp/worklet-messages.spec.ts` - `setGate` hostile-payload matrix; envelope container/tuple-length/per-index entry-value hostile-payload cases appended to the existing `setOperatorParameters` table; envelope throwing-getter case.
- `src/app/core/audio/worklet-processor-bundle.spec.ts` - Gated-note bundle-parity case (non-silence asserted before parity).
- `src/app/domain/dx7/dsp/graph-router.spec.ts` - Note-lifecycle sweep, silence-at-rest guard, modulator-envelope-reachability proof (+ carrier symmetry case), held-note re-patch continuity guard.
- `src/app/core/audio/worklet-synth-engine.spec.ts` - Exactly-one-gain-node case, no-gain-scheduling case, end-to-end velocity regression describe block.
- `src/app/domain/dx7/audio/value-conversion.spec.ts` - Frequency-mode regression group (ratio/fixed/mixed), rate-curve full-scale-duration regression group.

## Decisions Made

See `key-decisions` in frontmatter above for the four load-bearing design choices (gate-matrix placement as a new describe block vs. envelope-matrix placement inside the existing table; the same-rate/different-level envelope-difference fixture that removes timing as a confound from the reachability proof; peak-amplitude rather than raw-sample continuity assertion for the held-note case; driving `GraphRouter` directly rather than `WorkletSynthEngine` for the velocity regression since the engine no longer performs that conversion; and exporting `CENTS_PER_OCTAVE` so the frequency-mode regression derives the expected octave from the shipped constant).

**Algorithm selection for the taxonomy sweep:** `TAXONOMY_SWEEP_ALGORITHMS` is computed as `TEACHING_TAGS.map((tag) => ALGORITHMS.find((algorithm) => algorithm.teachingTags.includes(tag))!)` — this resolves at module load to the first algorithm in dataset order carrying each of the four `TEACHING_TAGS` entries (`'additive-stacks'`, `'tree-branch'`, `'rooting'`, `'parallel'`), i.e. Algorithms 1, 7, 19, and 26 under the current dataset order. No id is hardcoded; a future reordering of `ALGORITHMS` would still select one algorithm per group.

**Modulator/carrier operator selection for the reachability case:** Algorithm 1's carrier set is `[1, 3]` (already proven by the existing `buildRoutingConfig` test); `REACHABILITY_MODULATORS` is `OPERATOR_IDS.filter((id) => !REACHABILITY_CARRIERS.includes(id))` = `[2, 4, 5, 6]`. The test uses `modulatorId = REACHABILITY_MODULATORS[0]` (operator 2, which modulates carrier 1 via the `2->1` edge) and `carrierId = REACHABILITY_CARRIERS[0]` (operator 1) — both derived programmatically from `deriveCarriers`, never hardcoded as bare literals.

**End-to-end velocity regression location:** the plan's `<files>` list names `worklet-synth-engine.spec.ts` for this case, and it landed there as a new top-level `describe('End-to-end velocity regression (Pitfall 2) — GraphRouter, since WorkletSynthEngine no longer converts velocity', ...)` block, alongside (not inside) the existing `describe('WorkletSynthEngine', ...)` block, since it exercises `GraphRouter` directly rather than the engine class the rest of the file tests.

## Deviations from Plan

None - plan executed exactly as written. All three scratch probes specified in the acceptance criteria were performed, observed to fail the target case(s) while leaving every other case green, and reverted with an empty `git diff --stat` confirmed before each task's commit.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every one of this phase's four documented pitfalls (missing note-lifecycle message validation, dropped velocity, carrier-only envelope, per-block-instead-of-per-sample segment check) now has a named, teeth-proven mechanical guard.
- The ROADMAP's frequency-mode success criterion (Phase 8's already-shipped ratio/fixed math) now has explicit regression coverage independent of the plan that implemented it.
- No production file under `src/` or `worklets/` was modified by this plan (`git diff --stat` against the plan's base commit touches only the 5 spec files listed above) — the phase's implementation surface from 09-01 is untouched, only its proof surface grew.
- Plans 09-03 and 09-04 inherit a fully-hardened envelope/gate/frequency-mode kernel and worklet-message boundary to build parameter-mapping and dev-harness gate wiring on top of.

---
*Phase: 09-dx7-style-envelopes-and-parameter-mapping*
*Completed: 2026-08-15*

## Self-Check: PASSED

- `.planning/phases/09-dx7-style-envelopes-and-parameter-mapping/09-02-SUMMARY.md` — FOUND
- Commit `cb5d085` — FOUND
- Commit `ae6b6f9` — FOUND
- Commit `4175dc0` — FOUND
