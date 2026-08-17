# Phase 9: DX7-style envelopes and parameter mapping - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

A real DX7-style four-rate/four-level (R1-R4/L1-L4) envelope generator, independent per operator,
replacing the current single global voice-level click-prevention ramp
(`WORKLET_ATTACK_SECONDS`/`WORKLET_RELEASE_TIME_CONSTANT` on `WorkletSynthEngine`'s `voiceGain`).
Each of the 6 operators gets its own EG driving that operator's output amplitude, so carriers and
modulators can evolve independently over the life of a note — the timbral-evolution behavior that
is central to how FM/PM patches actually sound. Covers: the envelope state-machine itself (segment
advance on reaching each target level, holding/continuing-toward-L3 while a note is held, jumping
to the release segment from wherever the envelope currently sits on note-off — not a fixed-duration
ADSR plateau), DX7-authentic rate semantics (a rate is speed-toward-target-from-current-level, so
mid-segment retriggers/releases never pop or restart from a fixed point), widening
`OperatorParameters.envelopeLevel` (today's single sustain-level stand-in, per its own docstring) into
a structured per-operator rate/level shape — matching `GSD_NEW_PROJECT_PROMPT.md`'s own
`Dx7Envelope` field sketch on `OperatorParameters` — full removal of the now-redundant global
`voiceGain` ramp, and a Lesson 6 (Algorithm 1) regression check against the new engine (mirroring
Phase 8 D-03). Ratio/fixed-frequency operator pitch math (`operatorFrequencyHz`) was already pulled
forward and wired live in Phase 8 (D-15) — this phase's "ratio and fixed-frequency modes produce
correct frequencies" success criterion is a regression/verification concern on already-shipped code,
not new implementation. Does NOT cover: any new Playground/operator-editor UI for the rate/level
values — Playground has no per-operator parameter editor of any kind yet (ratio/level/detune/
envelope are all still listed under its "Coming in later phases" placeholder) and this phase stays
data-model + DSP + tests only, same as ratio/mode/detune are today (set via `InstrumentState` and
lesson try-this data, not a UI control); widening or role-differentiating the uniform default patch
(`DEFAULT_OPERATOR_PARAMETERS`, Phase 3 D-09) — the new envelope field's default stays identical
across all 6 operators on every algorithm, exactly like every other default field today; oscilloscope/
spectrum visualizers (Phase 10); per-algorithm curriculum beyond the Lesson 6 regression check
(Phase 11).

</domain>

<decisions>
## Implementation Decisions

### Envelope generator architecture
- **D-01:** The envelope generator is per-operator and kernel-integrated — each of the 6 operators
  gets its own independent EG inside the DSP kernel, scaling that operator's output before it feeds
  modulation/carrier summing, not a single voice-level envelope applied to the final routed output.
  — **Reversibility:** costly — `GraphRouter`'s per-operator render path and every algorithm's
  routing translation build directly on this shape; reverting to a voice-level-only model later
  means re-deriving the render path and losing the per-operator timbral evolution lessons/Playground
  will come to depend on.
- **D-02:** The existing global click-prevention voice ramp (`WORKLET_ATTACK_SECONDS` linear ramp +
  `WORKLET_RELEASE_TIME_CONSTANT` exponential decay on `voiceGain`) is fully removed. The new
  per-operator EGs' own attack/release segments are the sole amplitude-shaping and click-safety
  mechanism going forward. — **Reversibility:** costly — once removed, click-safety depends entirely
  on the new EG's own segment shape; reintroducing a redundant outer ramp later means re-verifying
  every existing note-trigger/algorithm-switch listening checkpoint against the combined behavior.
- **D-03:** Lesson 6's Algorithm 1 lesson gets an explicit regression check against the new
  envelope-driven engine — mirrors Phase 8's D-03 precedent (`08-CONTEXT.md`) for any change to what
  the live engine actually sounds like.

### Rate/segment semantics
- **D-04:** Envelope rates are DX7-authentic: a rate is speed-toward-the-current-segment's-target
  from wherever the envelope's level currently sits, never a fixed segment duration from a canonical
  starting point. A note released mid-attack (or retriggered mid-release) moves smoothly from its
  actual current level at the new segment's rate — no snap to a fixed starting value, no
  discontinuity introduced by any segment transition. This is also what makes the design click-safe
  by construction, serving the "note release and parameter smoothing never produce audible clicks"
  success criterion directly. — **Reversibility:** one-way — every envelope test, tolerance
  derivation, and the per-algorithm correctness proof gets built against this exact state-machine
  behavior; switching to fixed-restart-per-segment later would require re-deriving expected output
  for every retrigger/interrupt test case, not just a parameter tweak.

### Parameter surface scope
- **D-05:** No new Playground/operator-editor UI is built this phase. Envelope rate/level values are
  exercised through `InstrumentState`, lesson `try-this` data, and tests only — matching how
  ratio/mode/detune/outputLevel are exercised today (Playground has no operator-parameter editor of
  any kind yet). Follows the ROADMAP's Phase 9 success criteria, which are all DSP-correctness
  statements with no UI criterion.

### Default patch
- **D-06:** `DEFAULT_OPERATOR_PARAMETERS`' new envelope field stays one identical shape across all 6
  operators on every algorithm — Phase 3's D-09 (uniform, role-agnostic default patch) is honored,
  not revisited, since carrier/modulator role is derived per-algorithm (`derive-role.ts`) and isn't
  data the flat default object has access to. Playground has no separate initial/reset patch and
  remains unchanged this phase. Envelope differentiation (carriers sustained, modulators decaying
  faster) currently occurs only in each lesson's starting patch — the same mechanism that already
  customizes per-operator values today — extended to cover the new envelope field.

### Claude's Discretion
- Exact TypeScript shape of the widened envelope field (field names/nesting for the 4 rate/4 level
  pairs — `GSD_NEW_PROJECT_PROMPT.md`'s sketch names it `envelope: Dx7Envelope` but does not define
  `Dx7Envelope`'s own shape) — informed by `operator-parameters.ts`'s existing docstring ("a type
  change on this one field, not a rename or a new field") and the DX7-authentic 0-99 integer-scale
  convention every other field in that file already follows.
- Exact rate (0-99) → time-per-unit-level curve mapping — DX7 rates are not linear; informed by
  research, mirroring Phase 7 D-05 and Phase 8 D-10's "Claude's Discretion, informed by research"
  precedent for numeric-fidelity choices.
- Whether envelope state lives inside `PhaseModulatedOperator` itself or a small companion/wrapper
  class — informed by CLAUDE.md's "DSP code must not allocate excessively inside the audio render
  loop" and the existing `previousSample`-as-instance-field pattern `renderWithFeedback` already
  uses for its own per-sample state.
- Exact per-block vs. per-sample update granularity for envelope segment-position tracking —
  informed by the same allocation/render-loop constraint and the existing 128-sample
  `RENDER_QUANTUM_FRAMES` convention.
- Exact numeric tolerance for envelope segment-transition and rate-curve tests, mirroring Phase 7
  D-05/Phase 8 D-10's precedent.
- Exact new default rate/level values chosen for Playground's initial patch and each lesson's
  starting patch to make D-06's carrier-sustains/modulator-decays differentiation audible — informed
  by each lesson's existing pedagogical intent (`06-CONTEXT.md`) and each algorithm's carrier/
  modulator structure from the Phase 2 dataset.
- Whether the routing/frequency-mode regression coverage implied by the "ratio and fixed-frequency
  modes produce correct frequencies" success criterion is satisfied by extending Phase 8's existing
  per-algorithm correctness suite or by a new dedicated test file — informed by
  `value-conversion.ts`'s existing `operatorFrequencyHz` test coverage from Phase 5/8.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and audio interfaces
- `docs/ARCHITECTURE.md` §"1. Pure DX7 learning domain" — "Envelope state machine" as
  framework-independent TypeScript, the source for keeping the envelope generator in the domain/dsp
  layer, not Angular.
- `docs/ARCHITECTURE.md` §"Audio roadmap" → "AudioWorklet engine" — "Envelope generators" and
  "Per-operator frequency increment" listed as sibling per-operator concerns alongside "Operator
  output scaling," confirming the per-operator (not voice-level) placement D-01 chose.
- `docs/ARCHITECTURE.md` §"Polyphony" → "Per-voice envelope/note state" — the note this phase's
  per-operator EG state must stay compatible with once a future phase adds polyphony (not this
  phase's job, but the state shape should not preclude it).
- `GSD_NEW_PROJECT_PROMPT.md` lines ~126-135 (`interface OperatorParameters`) — sketches
  `readonly envelope: Dx7Envelope;` replacing a flat level field, the direct precedent for D-06's
  Claude's-Discretion envelope-shape item and confirmation that widening `envelopeLevel` was always
  the intended direction.
- `GSD_NEW_PROJECT_PROMPT.md` §"Stage B — six-operator AudioWorklet engine" (~line 170) —
  "per-operator envelope state" as an explicit item alongside routing/feedback/note-lifecycle.
- `GSD_NEW_PROJECT_PROMPT.md` §"Pure domain tests" (~line 270) — "Envelope segment transitions" as
  an explicitly named required test category.
- `docs/ROADMAP_SEED.md` §"Phase 9: DX7-style envelopes and parameter mapping" — "Four-rate/four-level
  envelope model," "Output-level mapping," "Ratio/fixed frequency modes," "Smoothing and release
  cleanup" — this phase's binding scope summary.
- `CLAUDE.md` §"Audio rules" — "Smooth gain changes to avoid clicks," explicit cleanup path per
  voice/oscillator/worklet, "DSP code must not allocate excessively inside the audio render loop" —
  governs D-04's click-safe-by-construction design and the Claude's Discretion granularity items.
- `CLAUDE.md` §"Domain rules" — immutable readonly models, one canonical dataset — governs the
  widened envelope field's shape staying in `operator-parameters.ts`, not duplicated elsewhere.

### Project state and requirements
- `.planning/REQUIREMENTS.md` §"Accurate Synthesis Engine" — ENGINE-03 (this phase), and the note
  that ENGINE-01/ENGINE-02 (Phase 7/8) are already complete with ratio/fixed-frequency math already
  live per Phase 8 D-15.
- `.planning/ROADMAP.md` §"Phase 9: DX7-style envelopes and parameter mapping" — success criteria
  (envelope segment transitions match the modeled rate/level state machine; ratio and fixed-frequency
  modes both produce correct frequencies; note release and parameter smoothing never produce audible
  clicks or NaN output).
- `.planning/phases/08-algorithm-routing-and-feedback/08-CONTEXT.md` — D-03 (Lesson 6 regression
  check precedent for D-03 here), D-15 (ratio/fixed-frequency math already pulled forward and wired
  live — narrows this phase to envelope work only), D-16 (`updateOperatorLevel` already real),
  D-06 (one-sample feedback delay pattern envelope state-per-sample tracking should mirror).
- `.planning/phases/07-audioworklet-dsp-foundation/07-CONTEXT.md` — D-03 (the per-sample modulation
  input port the envelope's amplitude scaling composes with), D-05 (analytical-match test rigor
  precedent for the Claude's Discretion tolerance item).
- `.planning/phases/03-signal-instrument-state/03-CONTEXT.md` — D-09 (uniform, role-agnostic default
  patch), the decision D-06 here explicitly honors rather than revisits.

### Existing code this phase implements against or integrates with
- `src/app/domain/dx7/models/operator-parameters.ts` — `OperatorParameters.envelopeLevel`, the field
  D-01/D-06 widen into the new rate/level shape; its own docstring already anticipates this as "a
  type change on this one field, not a rename or a new field."
- `src/app/domain/dx7/dsp/operator.ts` — `PhaseModulatedOperator`; D-01's per-operator EG state and
  the Claude's-Discretion "companion class vs. instance field" question both concern this class's
  `render`/`renderWithFeedback` methods and its existing `previousSample`-as-instance-field pattern.
- `src/app/domain/dx7/dsp/graph-router.ts` — `GraphRouter`, `buildRoutingConfig`,
  `DESCENDING_OPERATOR_IDS`; the per-operator render loop D-01's EG scaling integrates into, and
  where `outputLevelToAmplitude` is currently applied per operator (the envelope becomes an
  additional multiplicative factor alongside it, not a replacement for it).
- `src/app/core/audio/worklet-synth-engine.ts` — `WorkletSynthEngine`; owns
  `WORKLET_ATTACK_SECONDS`/`WORKLET_RELEASE_TIME_CONSTANT`/`WORKLET_RELEASE_SECONDS` and the
  `voiceGain` ramp logic in `noteOn`/`noteOff` that D-02 removes; its own doc comment already names
  "Phase 9 (ENGINE-03)" as the phase that replaces the current `envelopeLevel` stand-in.
- `src/app/domain/dx7/dsp/worklet-messages.ts` — `parseWorkletMessage`,
  `setOperatorParametersMessage`; the existing `envelopeLevel` validation block this phase's widened
  field replaces, following the same narrow-and-reject-malformed choke-point pattern.
- `src/app/domain/dx7/audio/value-conversion.ts` — `operatorFrequencyHz` (already live, Phase 8
  D-15), `outputLevelToAmplitude` (the per-operator level-scaling this phase's EG multiplies
  against), `MASTER_GAIN`.
- `src/app/domain/dx7/lessons/lessons.ts`, `try-this.ts`, `lesson-definition.ts` — `envelopeLevel`
  already appears in `try-this.ts`'s target-param union and `lesson-definition.ts`'s field-label map;
  D-03's Lesson 6 regression check and D-06's lesson-starting-patch differentiation both touch these
  files.
- `src/app/features/playground/playground.ts`/`.html` — `comingSoon` list explicitly names "Six
  operator strips: ratio, level, detune, envelope" as future scope; D-05's no-new-UI decision is
  grounded directly in this existing placeholder.
- `src/app/domain/dx7/models/patch.ts` — `OperatorParameterSet`, `DEFAULT_PATCH`; D-06's uniform
  default-patch constraint applies to whatever this file's default construction does with the widened
  envelope field.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PhaseModulatedOperator.renderWithFeedback`'s `previousSample`-as-instance-field, guarded-once,
  never-allocates pattern (`operator.ts`) — the template the new per-operator EG's own
  segment-position state should follow.
- `outputLevelToAmplitude`, `feedbackLevelToDepthHz` (`value-conversion.ts`) — the existing
  squared-normalized-curve convention any new rate/level-to-time-or-amplitude conversion should
  match stylistically.
- `parseWorkletMessage`'s narrow-and-reject-malformed pattern (`worklet-messages.ts`) — the template
  the widened envelope field's worklet-message validation must continue to follow.

### Established Patterns
- Domain layer (`src/app/domain/dx7/`) has zero Angular imports, machine-enforced by the DOMAIN-04
  ESLint gate — the envelope generator belongs there, not in `core/audio`.
- Per-algorithm independent reference-evaluator correctness proof (Phase 8 D-10) — the precedent for
  how deep the envelope's own state-machine correctness proof should go.
- Blocking human-verification checkpoint as a phase-gate (05-04, 06-04, 07-03, 08-04) — likely
  continues for this phase given the audible, click-safety-critical nature of the change, though the
  exact checkpoint scope is left to planning/research.

### Integration Points
- `WorkletSynthEngine` is the one integration point Playground/lessons consume; D-02's ramp removal
  and D-01's per-operator EG both land inside the worklet processor/kernel path this engine drives,
  not in `WorkletSynthEngine` itself beyond removing the now-redundant `voiceGain` ramp code.
- Phase 10 (visualizers) and Phase 11 (curriculum) both assume the envelope-driven engine is already
  the live sound by the time they start — no other phase should introduce a second envelope model.
- `WebAudioSynthEngine` (Phase 5, unused fallback per Phase 8 D-04) is untouched by this phase — its
  own attack/release ramps stay as-is, matching the established precedent that phase does not receive
  parallel updates.

</code_context>

<specifics>
## Specific Ideas

No specific visual mockups were provided — this phase has no new UI surface (D-05). The concrete
"feel" decisions are D-01 (per-operator, not voice-level, so carriers and modulators can audibly
diverge over a note's life) and D-04 (envelope motion is always continuous from wherever it
currently sits — no pops, no fixed-point restarts) — both grounded in the core value ("hear the
sound it produces... immediately understand why the sound changed") and DX7-authentic behavior
rather than new external references.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (A Playground/operator-editor UI for the new rate/level
values was raised and explicitly deferred per D-05 — it remains future scope, consistent with
Playground's existing "Coming in later phases" placeholder, not recorded as a new idea since it was
already implicitly scoped out. Role-aware default-patch envelope differentiation was raised and
explicitly resolved as out of scope per D-06, honoring Phase 3's D-09 rather than deferring it as a
new idea for a future phase.)

</deferred>

---

*Phase: 9-DX7-style envelopes and parameter mapping*
*Context gathered: 2026-08-14*
