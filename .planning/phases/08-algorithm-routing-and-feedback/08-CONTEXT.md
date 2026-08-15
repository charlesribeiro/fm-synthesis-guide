# Phase 8: Algorithm routing and feedback - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

All 32 canonical DX7 algorithm topologies routed through the pure phase-modulation DSP kernel
(Phase 7's `PhaseModulatedOperator`), including each algorithm's feedback self-loop, with output
proven bounded and finite at maximum feedback and no stuck notes across algorithm switches. This
phase also cuts the live `SYNTH_ENGINE` token over from `WebAudioSynthEngine` (Phase 5's
oscillator approximation) to `WorkletSynthEngine`, making the routed worklet engine the actual
sound Playground and the `/learn` lessons produce — and, because that cutover must sound musically
correct (not just topologically correct), reuses the existing DX7-scale conversions
(`operatorFrequencyHz` for ratio/detune/fixed-mode pitch, `outputLevelToAmplitude`/
`outputLevelToModulationDepthHz` for per-operator level) so operator pitch and level are real,
audible parameters on the worklet engine this phase, not deferred no-ops. Covers: graph-to-kernel
routing translation from the canonical dataset (`algorithms.ts`/`derive-role.ts`/`patch-plan.ts`),
a one-sample feedback delay in the kernel (the Web Audio engine's 128-sample `DelayNode` workaround
does not apply — the pure kernel has no zero-delay-cycle constraint), a hard `[-1, 1]` safety clamp,
per-algorithm correctness proof against an independently-written reference evaluator, a live
audible re-patch on algorithm switch under a held note (matching Phase 5 D-02), a blocking
human-listening checkpoint sampling one algorithm per taxonomy group plus max feedback, and an
explicit Lesson 6 (Algorithm 1) regression check against the newly-live engine. Does NOT cover:
DX7-style four-rate/four-level envelope shaping — attack/release stay the existing click-prevention
gain ramps, not real ADSR-style segments (Phase 9, ENGINE-03's remaining scope once pitch/level
conversion is pulled forward into this phase); oscilloscope/spectrum visualizers (Phase 10);
per-algorithm curriculum beyond Lesson 6's regression check (Phase 11); removing or deleting
`WebAudioSynthEngine` (kept as an unused fallback, not wired to anything).

</domain>

<decisions>
## Implementation Decisions

### Live-engine cutover scope
- **D-01:** `SYNTH_ENGINE` is cut over to `WorkletSynthEngine` this phase — Playground and the
  `/learn` lessons hear the routed, feedback-capable worklet engine, not the Phase 5 approximation.
  — **Reversibility:** costly — every lesson/Playground interaction becomes a live regression
  surface for the new engine from this phase forward; reverting later means re-auditing whichever
  UI/lesson behavior came to depend on the worklet engine's specific timing/behavior.
- **D-02:** A blocking human-listening checkpoint (mirrors 05-04/06-04/07-03 precedent) is required
  before the phase can close, even though it duplicates prior phases' pattern — the cutover changes
  what real users/lessons actually hear, and the automated correctness suite alone was judged
  insufficient confidence for that.
- **D-03:** Lesson 6's Algorithm 1 lesson (a modulation stack + tower, with feedback) gets an
  explicit regression check — a test or checkpoint step specifically re-verifying its try-this
  completion flow (target operator/param move + note trigger, per `06-CONTEXT.md` D-02/D-06)
  against `WorkletSynthEngine` — not just coverage from the general 32-algorithm correctness suite.
- **D-04:** `WebAudioSynthEngine` is kept in the codebase as an unused fallback — not deleted, not
  auto-selected when AudioWorklet is unsupported (that would need `AudioEngineStatus` branching
  logic this phase does not build). It stays reachable as a reference/manual-swap option only.
- **D-05:** The persistent "educational approximation" label (Phase 5 D-08, AUDIO-03) keeps its
  existing wording — CLAUDE.md's "do not claim exact DX7 emulation" stance does not change just
  because routing/feedback are now real; no copy change this phase.

### Kernel feedback architecture
- **D-06:** The kernel's feedback self-loop uses a true one-sample delay (the operator's own
  previous rendered sample fed back as phase-modulation input) — not the 128-sample
  render-quantum delay `WebAudioSynthEngine` uses to work around Web Audio's zero-delay-cycle
  restriction. The pure kernel has no such restriction, so the more accurate model is free to use.
  — **Reversibility:** costly — `additive-fixture.spec.ts`/`operator.spec.ts`'s existing
  render-loop shape and any Phase 8 correctness tests get built against this delay model; changing
  it later means re-deriving every feedback-bearing algorithm's expected reference output.
- **D-07:** Maximum feedback is allowed to sound authentically harsh/edgy (matching real DX7
  feedback character) — the only ceiling is a hard safety clamp, never a musical soft-limiter that
  tames the tone. Teaches learners what feedback actually does rather than sanding off the effect.
- **D-08:** The safety clamp is a hard per-sample clamp to `[-1, 1]` — not a soft-clip/saturating
  curve. Simplest, cheapest, deterministic; the resulting harmonic distortion at the clip point is
  in keeping with D-07's "authentic edge" choice rather than fighting it.
- **D-09:** Feedback depth reuses the existing 0–7 DX7 feedback scale
  (`value-conversion.ts`'s `feedbackLevelToDepthHz`, `patch.ts`'s `validateFeedbackLevel`) — same
  parameter drives both engines, no new UI, no new patch field.

### Correctness-proof breadth
- **D-10:** All 32 algorithms are deep-verified individually, each checked against an independent,
  hand-written reference evaluator (a second, deliberately separate phase-modulation implementation
  built directly from each algorithm's edges/carriers/feedback) — not a lighter structural-only
  assertion, and not a "verify one per group, generic-proof the rest" shortcut. Catches
  graph-to-render translation bugs a shared-code test couldn't, mirroring Phase 7 D-05's
  analytical-match rigor extended across all 32 rows.
- **D-11:** Bounded-and-finite output at maximum feedback is proven for every algorithm, not just
  the ones with a declared feedback self-loop — matches ROADMAP's literal "bounded and finite under
  feedback at maximum" wording across the full set.
- **D-12:** The blocking human-listening checkpoint samples one algorithm per taxonomy group
  (Additive Stacks 1–6, Tree/Branch 7–18, Rooting 19–25, Parallel 26–32 — the grouping already
  established by `teachingTags`/Phase 4's browse view) plus feedback at maximum depth — four
  algorithms plus the feedback case, not just the two lesson algorithms Phase 7 used as its minimal
  precedent.

### Held-note algorithm switch and operator pitch/level wiring
- **D-13:** Switching the selected algorithm while a note is held re-patches that held voice live
  and audibly on the worklet engine too — matching `WebAudioSynthEngine`'s existing D-02 behavior
  (`05-CONTEXT.md`) exactly, not a simpler cut-and-restart. Preserves the UX Playground/lessons
  already have today; the core value ("change a parameter, immediately understand why the sound
  changed") applies to algorithm choice, not only operator params.
- **D-14:** The algorithm switch reaches the running worklet processor via a new worklet message
  (extending `worklet-messages.ts`'s existing `setFrequency`/`setMode` pattern) carrying the new
  algorithm's routing config (edges/carriers/feedback operator), translated from the canonical
  dataset on the main thread — the processor rebuilds its internal routing table on receipt.
- **D-15:** The worklet engine reuses `operatorFrequencyHz` (ratio/detune/fixed-mode conversion,
  already pure domain code, already proven in Phase 5) for each operator's pitch — not naive/flat
  per-operator frequencies. Makes this phase's own listening checkpoint musically meaningful and
  narrows ENGINE-03 (Phase 9) to real envelope shaping only, since frequency-mode math is already
  solved and doesn't require any envelope work to wire in.
- **D-16:** The worklet engine likewise reuses `outputLevelToAmplitude`/
  `outputLevelToModulationDepthHz` for per-operator level — `updateOperatorLevel` becomes a real,
  audible implementation this phase rather than staying the validated no-op it is today (per
  `worklet-synth-engine.ts`'s current "Phase 9 (ENGINE-03)" comment, which this decision
  supersedes for level/pitch specifically — ADSR-style envelope segments remain Phase 9's job).
  — **Reversibility:** costly — once `updateOperatorLevel` is a real implementation and lessons/
  Playground depend on it working, no-opping it again would be a user-visible regression.

### Claude's Discretion
- Exact TypeScript shape of the new routing-config worklet message (D-14) — field names/nesting
  for edges/carriers/feedback-operator, and whether it's one message or several — informed by
  `worklet-messages.ts`'s existing `parseWorkletMessage` choke-point pattern (never throws, rejects
  malformed shapes by returning `null`) and `patch-plan.ts`'s `OperatorConnection` shape.
- Exact module/file layout for the kernel's graph-routing logic (e.g. a new
  `src/app/domain/dx7/dsp/graph-router.ts` or similar) and for the independent reference evaluator
  used by D-10's correctness proof — informed by the domain-purity ESLint gate (DOMAIN-04) and the
  existing `dsp/operator.ts`/`dsp/additive-fixture.ts` module boundary.
- Exact numeric tolerance for D-10's per-algorithm analytical-match assertions, mirroring Phase 7
  D-05's precedent of Claude's Discretion informed by research.
- Exact deterministic evaluation order for a routed algorithm's operators inside a single render
  block — the codebase's existing "higher-modulates-lower" invariant
  (`validate-algorithm.ts`, `derive-role.ts`) already guarantees every non-feedback edge goes from
  a higher operator id to a lower one, which constrains (and likely fixes) this to a simple
  descending-id evaluation order; confirm and document this as the derivation rather than building
  a general topological sort.
- Exact one-sample feedback delay implementation detail (D-06) — e.g. whether the previous-sample
  value is stored per-operator inside the kernel class itself or in a small wrapper — informed by
  CLAUDE.md's "DSP code must not allocate excessively inside the audio render loop."
- Whether the new routing-config worklet message is sent proactively on every `setAlgorithm()` call
  (even before a note is held) or lazily deferred until the next `noteOn` — informed by D-13's
  live-re-patch requirement and `WebAudioSynthEngine.applyRouting`'s existing "apply immediately,
  independent of note state" precedent.
- Exact wording/structure of the independent reference evaluator used in D-10 (recursive vs.
  iterative, exact function signature) — as long as it is genuinely a second, separately-authored
  implementation and not a thin wrapper around the kernel's own routing code.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and audio interfaces
- `docs/ARCHITECTURE.md` §"Algorithm graph model" — six operator nodes, directed modulation edges,
  one-or-more carriers routed to output, explicit feedback edge/source/target metadata, derivable
  incoming/outgoing relationships, "a deterministic evaluation order for DSP" — the exact shape
  this phase's graph-to-kernel routing translation must satisfy.
- `docs/ARCHITECTURE.md` §"Audio roadmap" → "AudioWorklet engine" — "Algorithm routing," "Feedback
  memory," "Master gain and limiter/safety clamp" as this phase's named scope items; "Main-thread
  messages should update compact parameter structures. Avoid per-frame object churn" — governs
  D-14's routing-config message shape.
- `docs/ARCHITECTURE.md` §"Error handling" — the "Worklet loading failure" state Phase 7's
  CONTEXT.md flagged as a still-open Claude's Discretion item; relevant if D-04's fallback question
  is revisited later.
- `GSD_NEW_PROJECT_PROMPT.md` §"Audio strategy" → "Stage B — six-operator AudioWorklet engine"
  (~line 168) — "routing from the selected algorithm, feedback state, note lifecycle, and parameter
  messages" — this phase's binding scope description; also the "must not imply that simply patching
  an OscillatorNode... is identical to the DX7's digital phase-modulation implementation" caution
  that D-05's unchanged-label decision honors.
- `docs/ROADMAP_SEED.md` §"Phase 8: Algorithm routing and feedback" — "All graph topologies in
  DSP," "Feedback state," "Bounded output and stability tests," "Switch algorithms without stuck
  notes" — this phase's binding scope summary.
- `docs/ACCEPTANCE_CRITERIA.md` §"Test evidence" — "DSP tests render deterministic sample blocks
  and reject non-finite output" — the floor D-10/D-11's correctness and bounded-output proofs
  build on top of.
- `CLAUDE.md` §"Audio rules" — explicit cleanup path per voice/oscillator/worklet/timer, smooth
  gain changes, "DSP code must not allocate excessively inside the audio render loop," "do not
  claim exact DX7 emulation," AudioWorklet as the accurate architecture target this phase advances.
- `CLAUDE.md` §"Domain rules" — algorithm topology as data never hardcoded, one canonical dataset
  with no duplicated routing knowledge — governs D-14's routing translation and forbids a second
  hardcoded topology table anywhere near the worklet message layer.

### Project state and requirements
- `.planning/REQUIREMENTS.md` §"Accurate Synthesis Engine" — ENGINE-02 (this phase: all 32
  topologies + feedback state), ENGINE-03 (Phase 9: envelopes + ratio/fixed frequency modes — D-15
  pulls the frequency-mode half of this forward into Phase 8, leaving Phase 9 to envelopes only).
- `.planning/ROADMAP.md` §"Phase 8: Algorithm routing and feedback" — success criteria (every
  algorithm's topology routes correctly; output stays bounded and finite under feedback at
  maximum; switching algorithms never leaves a stuck note).
- `.planning/phases/07-audioworklet-dsp-foundation/07-CONTEXT.md` — D-01 (isolation precedent this
  phase's D-01 explicitly reverses), D-03 (the modulation-input port this phase's routing builds
  on), D-04 (the additive-fixture-not-canonical-dataset boundary this phase's routing translation
  now crosses), D-05 (analytical-match rigor precedent for D-10), D-06/D-07 (blocking
  listening-checkpoint precedent D-02 continues).
- `.planning/phases/06-guided-lessons-for-algorithm-32-and-algorithm-1/06-CONTEXT.md` — D-02
  (structured try-this data), D-06 (behavior-verified completion check) — the mechanism D-03's
  Lesson 6 regression check must continue to satisfy against the newly-live engine.
- `.planning/phases/05-first-playable-approximation/05-CONTEXT.md` — D-02 (live held-note re-patch
  on algorithm switch, the precedent D-13 matches), D-03/D-08 (fixed safety-clamped gain and the
  persistent approximation label D-05 keeps unchanged).

### Existing code this phase implements against or integrates with
- `src/app/domain/dx7/dsp/operator.ts` — `PhaseModulatedOperator`, the kernel primitive every
  routed operator instance is built from; D-06's one-sample feedback delay extends this class or a
  thin wrapper around it.
- `src/app/domain/dx7/dsp/additive-fixture.ts` — `AdditiveOperatorBank`, explicitly NOT reading the
  canonical dataset (07-CONTEXT.md D-04) — this phase's graph router is the first module allowed to
  bridge `algorithms.ts`/`derive-role.ts` into kernel configuration.
- `src/app/domain/dx7/dsp/worklet-messages.ts` — `parseWorkletMessage`'s single-choke-point
  pattern, `WorkletMessage` union — D-14 extends this union with a routing-config message.
- `src/app/domain/dx7/audio/patch-plan.ts` — `planConnections`/`OperatorConnection`, the existing
  edge-to-connection-list traversal `WebAudioSynthEngine` uses; this phase's kernel-facing routing
  translation should reuse or closely mirror this shape rather than re-deriving edge/feedback logic.
- `src/app/domain/dx7/models/derive-role.ts` — `getFeedbackOperator`, `deriveCarriers`,
  `getOperatorRole`, `hasFeedbackLoop` — the single source of truth this phase's routing and
  feedback logic must read through, never re-derive.
- `src/app/domain/dx7/models/validate-algorithm.ts` — the "higher-modulates-lower" invariant
  (edges always `from > to`, except the feedback self-loop `from === to`) — the structural fact the
  Claude's-Discretion evaluation-order item derives its descending-id order from.
- `src/app/domain/dx7/audio/value-conversion.ts` — `operatorFrequencyHz` (D-15),
  `outputLevelToAmplitude`/`outputLevelToModulationDepthHz` (D-16), `feedbackLevelToDepthHz`
  (D-09) — all reused as-is by the worklet engine this phase, not reimplemented.
- `worklets/dx7-worklet-processor.ts` — the one `AudioWorkletProcessor` adapter; D-14's routing
  message and the multi-operator routed render path land here, still holding zero DSP math of its
  own per its existing file-header comment.
- `src/app/core/audio/worklet-synth-engine.ts` — `WorkletSynthEngine`; D-01 wires this into
  `SYNTH_ENGINE`, D-13 adds live re-patch, D-15/D-16 turn `updateOperatorLevel`/pitch handling from
  validated no-ops into real implementations, superseding the file's current
  "Phase 8 (ENGINE-02)"/"Phase 9 (ENGINE-03)" no-op comments accordingly.
- `src/app/core/audio/synth-engine.token.ts` — `SYNTH_ENGINE` DI token D-01 repoints.
- `src/app/core/audio/web-audio-synth-engine.ts` — kept per D-04, untouched otherwise; its
  `applyRouting`/`FEEDBACK_DELAY_RENDER_QUANTUM_FRAMES`/128-sample-delay approach is explicitly
  NOT the model D-06 follows for the worklet kernel.
- `src/app/domain/dx7/diagram/*` (`algorithm-layout.ts` teachingTags grouping used by Phase 4's
  browse view) — the source of the four taxonomy groups D-12's listening checkpoint samples from.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `planConnections`/`OperatorConnection` (`patch-plan.ts`) — proven edge-to-connection-list
  traversal; the kernel-facing routing translation should mirror or directly reuse this rather than
  re-deriving from `algorithm.edges` a second time.
- `operatorFrequencyHz`, `outputLevelToAmplitude`, `outputLevelToModulationDepthHz`,
  `feedbackLevelToDepthHz` (`value-conversion.ts`) — all pure, already-tested DX7-scale conversions
  this phase pulls into the worklet engine per D-15/D-16/D-09.
- `parseWorkletMessage`'s narrow-and-reject-malformed pattern (`worklet-messages.ts`) — the template
  D-14's new routing message must follow.

### Established Patterns
- Domain layer (`src/app/domain/dx7/`) has zero Angular imports, machine-enforced by the DOMAIN-04
  ESLint gate — this phase's graph router and reference evaluator both belong there.
- Signal-based facade / DI-token-swap pattern (`SYNTH_ENGINE`) already exists specifically to make
  D-01's cutover a "drop-in provider change, not a rewrite" (07-CONTEXT.md D-02's own stated intent).
- Blocking human-verification checkpoint as a phase-gate (05-04, 06-04, 07-03) — D-02/D-12 continue
  this precedent rather than introducing a new gate mechanism.

### Integration Points
- `SYNTH_ENGINE` token is the one integration point Playground/lessons consume; D-01 is the only
  place this phase touches that wiring.
- Phase 9 (envelopes) builds directly on this phase's routed, pitch/level-aware worklet engine —
  its remaining scope is now real ADSR-style segment shaping only, not frequency or level math.
- Phase 10 (visualizers) and Phase 11 (curriculum) both assume the worklet engine is already the
  live sound by the time they start — no other phase should perform this cutover a second time.

</code_context>

<specifics>
## Specific Ideas

No specific visual mockups were provided — this phase has no new UI success criterion. The
concrete "feel" decisions are D-07/D-08 (feedback allowed to sound authentically harsh, bounded
only by a hard clamp, not tamed) and D-13 (live audible re-patch on algorithm switch, matching
Phase 5's existing UX) — both grounded in the core value ("change a parameter, immediately
understand why the sound changed") and the project's existing precedent rather than new external
references.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (DX7-style four-rate/four-level envelope segment
shaping remains explicitly Phase 9/ENGINE-03's job — D-15/D-16 pull only the already-solved
pitch/level conversion math forward into this phase, not envelope work itself. Oscilloscope/
spectrum visualizers [Phase 10] and per-algorithm curriculum beyond the Lesson 6 regression check
[Phase 11] were named during discussion as explicitly out of scope and are recorded in the Phase
Boundary above, not as new deferred ideas.)

</deferred>

---

*Phase: 8-Algorithm routing and feedback*
*Context gathered: 2026-08-12*
