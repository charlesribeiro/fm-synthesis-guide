# Phase 7: AudioWorklet DSP foundation - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A pure, offline-testable six-operator phase-modulation DSP kernel that runs inside a custom
`AudioWorkletProcessor` — proven this phase with a single operator and an additive (no-modulation)
multi-operator case. Covers: the operator primitive (phase accumulator, frequency/ratio handling,
an optional per-sample phase-modulation input), a thin `AudioWorkletProcessor` adapter around that
primitive, Vitest coverage of the primitive with deterministic sample blocks (no browser required),
and a minimal dev-only harness so a human can actually hear the worklet run in a real browser. Does
NOT cover: arbitrary/all-32 graph topology traversal or feedback state (Phase 8, ENGINE-02),
DX7-style envelopes (Phase 9, ENGINE-03), or wiring the new engine into `SYNTH_ENGINE` as the app's
live sound — Playground and the `/learn` lessons keep using the existing `WebAudioSynthEngine`
(Phase 5) this phase; the swap is a later phase's job once routing and envelopes exist.

</domain>

<decisions>
## Implementation Decisions

### Live-engine cutover scope
- **D-01:** The new worklet engine stays fully isolated this phase — built and Vitest-tested, but
  `SYNTH_ENGINE` keeps resolving to `WebAudioSynthEngine`. Nothing in Playground or the `/learn`
  lessons calls the new engine. Matches the ROADMAP's Phase 7 success criteria exactly ("worklet
  loads and runs," "tested... outside the browser" — nothing about becoming the live sound), and
  avoids regressing Lesson 6 (Algorithm 1 is a modulation stack, which this phase's kernel can't
  route yet).
- **D-02:** The new engine implements the existing `SynthEngine` interface
  (`setAlgorithm`/`updateOperatorLevel`/`setFeedback`/`noteOn`/`noteOff`/`allNotesOff`/`destroy`)
  now, even though nothing consumes it yet. Unsupported calls (routing, feedback) may no-op or
  throw clearly. Proves the interface shape holds today so the eventual swap in a later phase is a
  drop-in provider change, not a rewrite — matching `synth-engine.token.ts`'s own comment that this
  DI seam exists for exactly that swap.

### Kernel/graph boundary
- **D-03:** The operator primitive accepts an optional per-sample phase-modulation input (defaults
  to 0/unconnected) as a first-class part of the kernel — the core PM capability — even though only
  the additive (input-always-0) and single-operator cases are exercised this phase. — **Reversibility:**
  costly — Phase 8 (ENGINE-02, all 32 topologies + feedback) builds its graph traversal directly on
  top of this primitive; if the modulation-input port isn't there from the start, Phase 8 would have
  to rework the operator primitive itself once other code already depends on its shape, not just add
  a routing layer around it.
- **D-04:** The additive multi-operator proof uses a synthetic N-operator fixture (e.g. six
  independent carriers, hand-picked frequencies) — it does not read through the canonical dataset
  (`algorithms.ts`/`derive-role.ts`). Graph-to-kernel-config translation from the real 32-algorithm
  dataset is explicitly Phase 8's job; this keeps Phase 7's diff scoped to `core/audio` (or wherever
  the kernel lands) without pulling a thin slice of graph-reading logic in early.

### Correctness proof
- **D-05:** "Runs... correctly" is proven by matching an analytical reference, not just the
  `docs/ACCEPTANCE_CRITERIA.md` floor ("reject non-finite output"). A single sine operator's
  rendered block is asserted against the closed-form `sin(2πft)` reference within a numeric
  tolerance; the additive case asserts the summed output equals the per-operator sum. Exact
  tolerance/sample-rate/block-size values are Claude's Discretion, informed by research.

### Audible checkpoint this phase
- **D-06:** A minimal dev-only harness is in scope — a small, non-shipped page or standalone script
  that loads the worklet in a real browser and lets a human trigger the single-operator and additive
  cases by ear. Proves "the worklet loads and runs" in a real `AudioWorkletGlobalScope`, which no
  Vitest/jsdom-based test of the pure kernel module can do (jsdom has no Web Audio API at all, per
  `05-RESEARCH.md` Pitfall 6 — the same gap applies to `AudioWorkletGlobalScope`).
- **D-07:** Using the harness to actually listen is a blocking human-verification checkpoint in the
  plan — mirrors the precedent set in Phase 5 (05-04 listening checkpoint) and Phase 6 (06-04
  blocking verification). The phase cannot be marked complete without a human confirming the worklet
  sounds right, since Phase 8 and 9 build directly on top of this kernel being trustworthy.

### Claude's Discretion
- Exact numeric tolerance, sample rate, and block-size assumptions for D-05's analytical-match
  tests.
- Exact file/module layout for the pure DSP kernel (e.g. a new `src/app/domain/dx7/dsp/` or under
  `src/app/core/audio/`) and the thin `AudioWorkletProcessor` adapter around it — informed by
  CLAUDE.md's domain-purity rule (DSP logic independent of Angular) and research into how Angular
  22's esbuild-based `@angular/build:application` builder can emit a worklet as a loadable module
  (`audioWorklet.addModule()` needs a standalone script, not a bundled app chunk).
- Whether the phase-modulation math uses `Math.sin` directly or a sine lookup table this phase —
  `GSD_NEW_PROJECT_PROMPT.md` explicitly leaves this open ("sine lookup or `Math.sin` initially").
- Exact shape/location of D-06's dev harness (a dev-gated Angular route vs. a standalone HTML file
  outside the app bundle vs. an npm script) and how its DI/fake-boundary seam mirrors
  `audio-context.token.ts`'s `AudioContextLike`/`AudioParamLike` pattern so no spec ever touches a
  real Web Audio global.
- Exact operator-primitive API signature (constructor params, per-sample `render`/`process` method
  shape, how the D-03 modulation input is passed in) and whether it's a class, closure, or plain
  function — informed by CLAUDE.md's "DSP code must not allocate excessively inside the audio
  render loop" and "avoid per-frame object churn" (`docs/ARCHITECTURE.md`).
- How D-02's `SynthEngine` methods that aren't yet meaningful (`setAlgorithm` beyond the additive
  fixture, `setFeedback`, multi-operator `updateOperatorLevel` beyond the synthetic fixture) behave
  concretely — no-op, throw, or a documented partial implementation.
- Exposing worklet-loading-failure as an `AudioEngineStatus`-shaped state now (per
  `docs/ARCHITECTURE.md` §"Error handling" listing "Worklet loading failure") vs. deferring that
  wiring to whichever phase does the live cutover — informed by D-01's isolation decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and audio interfaces
- `docs/ARCHITECTURE.md` §"Audio roadmap" → "AudioWorklet engine" — the full end-state design (six
  phase accumulators, per-operator frequency increment, envelope generators, operator output
  scaling, algorithm routing, feedback memory, master gain/limiter) that Phase 7/8/9 build
  incrementally toward; "Main-thread messages should update compact parameter structures. Avoid
  per-frame object churn."
- `docs/ARCHITECTURE.md` §"Error handling" — lists "Worklet loading failure" as an actionable state
  the app should expose (informs the Claude's Discretion item above).
- `docs/ARCHITECTURE.md` §"Performance boundaries" — "Profile before introducing workers beyond
  AudioWorklet."
- `GSD_NEW_PROJECT_PROMPT.md` §"Audio strategy: educational first, accurate by design" →
  "Stage B — six-operator AudioWorklet engine" (~line 168) — "Implement the serious engine as an
  `AudioWorkletProcessor` with six phase accumulators, sine lookup or `Math.sin` initially, explicit
  phase modulation, per-operator envelope state, routing from the selected algorithm, feedback
  state, note lifecycle, and parameter messages. Keep the DSP core pure enough to test offline
  outside Angular" — this phase's slice is the phase-modulation primitive + kernel-purity clause
  only; envelope/routing/feedback/note-lifecycle/parameter-messages are Phase 8/9. Also: "The
  architecture must not imply that simply patching an OscillatorNode into another oscillator's
  frequency parameter is identical to the DX7's digital phase-modulation implementation."
- `docs/ACCEPTANCE_CRITERIA.md` §"Test evidence" — "DSP tests render deterministic sample blocks and
  reject non-finite output" — the floor D-05 builds on top of.
- `docs/ROADMAP_SEED.md` §"Phase 7: AudioWorklet DSP foundation" — this phase's binding scope
  summary.

### Project state and requirements
- `.planning/REQUIREMENTS.md` §"Accurate Synthesis Engine" — ENGINE-01 (this phase, kernel only),
  ENGINE-02 (Phase 8, all 32 topologies + feedback), ENGINE-03 (Phase 9, envelopes) — the split this
  phase's scope boundary depends on.
- `.planning/ROADMAP.md` §"Phase 7: AudioWorklet DSP foundation" — success criteria (worklet loads
  and runs a single operator and an additive multi-operator case correctly; DSP kernel tested with
  deterministic sample blocks outside the browser).
- `CLAUDE.md` §"Audio rules" — DI'd browser-audio boundaries, never construct `AudioContext` at
  module evaluation time, resume/start only after a user gesture, never store `AudioNode`s in
  Angular signal state, explicit cleanup path per voice/oscillator/worklet/timer/animation frame,
  smooth gain changes, "DSP code must not allocate excessively inside the audio render loop," don't
  claim exact DX7 emulation, "native OscillatorNode modulation is an MVP approximation; the accurate
  architecture target is a custom six-operator AudioWorklet phase-modulation engine."
- `CLAUDE.md` §"Domain rules" — algorithm topology as data never hardcoded, keep DSP logic
  independent of Angular, immutable readonly models.
- `CLAUDE.md` §"Testing rules" — "Audio tests must be deterministic and must not require a physical
  output device," "a bug fix needs a regression test."
- `.planning/PROJECT.md` §"Key Decisions" — the still-"Pending" Phase-1-era decision to defer the
  AudioWorklet engine behind the `OscillatorNode` MVP approximation; this phase begins resolving it
  (per D-01, only partially — the live cutover itself remains pending).

### Existing code this phase implements against or integrates with
- `src/app/core/audio/synth-engine.ts` — the `SynthEngine`/`AudioEngineStatus` interface D-02
  implements.
- `src/app/core/audio/synth-engine.token.ts` — the `SYNTH_ENGINE` DI token; its own doc comment
  names "Phase 7's AudioWorklet six-operator engine" as the intended future swap-in target — D-01
  defers the actual swap but D-02 keeps the interface contract intact for it.
- `src/app/core/audio/audio-context.token.ts` — `AUDIO_CONTEXT_CTOR` token and the
  `AudioContextLike`/`AudioParamLike`/`OscillatorNodeLike`/`GainNodeLike` fake-boundary interfaces;
  the DI-seam and fake-typing pattern any worklet-loading boundary should mirror so no spec touches
  a real Web Audio global.
- `src/app/core/audio/web-audio-synth-engine.ts`, `.spec.ts` — the current live `SynthEngine`
  implementation (Phase 5); stays untouched and live per D-01.
- `src/app/core/audio/testing/fake-audio-context.ts` — existing fake-audio testing pattern; a
  worklet-loading harness needs an equivalent seam since jsdom has no `AudioWorkletGlobalScope`
  either (`05-RESEARCH.md` Pitfall 6).
- `.planning/phases/05-first-playable-approximation/05-CONTEXT.md` and
  `.planning/phases/06-guided-lessons-for-algorithm-32-and-algorithm-1/06-CONTEXT.md` — both
  explicitly scoped the accurate AudioWorklet engine out as "Phase 7," and Phase 6's Lesson 1
  (Algorithm 1, a modulation stack) is the concrete reason D-01 keeps the new engine unwired.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SYNTH_ENGINE` / `AUDIO_CONTEXT_CTOR` DI token pattern (`InjectionToken` + factory,
  `providedIn: 'root'`) — mirror for any new worklet-loading token this phase introduces.
- `AudioContextLike`/`AudioParamLike`/`OscillatorNodeLike` fake-boundary interfaces in
  `audio-context.token.ts` — precedent for typing a minimal `AudioWorkletNode`-like boundary so
  Vitest never touches a real Web Audio global.
- `src/app/core/browser/motion-preference.ts` — the project's canonical DI-wrapped-browser-global
  shape, referenced by every prior audio-related CONTEXT.md as the pattern to mirror.

### Established Patterns
- Domain layer (`src/app/domain/dx7/models/`) has zero Angular imports, machine-enforced by a scoped
  ESLint rule (Phase 2, DOMAIN-04) — the pure DSP kernel (phase accumulator/PM math) belongs in an
  equally Angular-free module, which is what makes D-05's Vitest-outside-the-browser proof possible.
- Signal-based facade pattern (private `WritableSignal`, `.asReadonly()` public signal) —
  `WebAudioSynthEngine`'s `status` signal is the shape D-02's new engine should mirror.

### Integration Points
- `SYNTH_ENGINE` stays pointed at `WebAudioSynthEngine` this phase (D-01) — Playground and the
  `/learn` lessons are unaffected by anything built this phase.
- Phase 8 (routing/feedback, ENGINE-02) and Phase 9 (envelopes, ENGINE-03) build directly on this
  phase's operator primitive (D-03's modulation-input port) and its `SynthEngine`-shaped API (D-02)
  — no other phase should define a second DSP kernel or a second worklet processor.

</code_context>

<specifics>
## Specific Ideas

No specific visual or audio mockups were provided — this phase has no UI success criterion. The
concrete "feel" decisions are D-06/D-07 (a minimal dev-only harness, gated as a blocking
human-listening checkpoint before the phase can close) and D-05 (analytical-match rigor, not just a
non-finite floor) — both grounded in the seed docs' Stage B description and the project's existing
precedent of blocking human-verification checkpoints (Phase 5, Phase 6).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Full 32-algorithm graph routing and feedback state
[Phase 8, ENGINE-02] and DX7-style envelopes [Phase 9, ENGINE-03] were named during discussion as
explicitly out of scope for this phase, and are recorded as such in the Phase Boundary above, not as
new deferred ideas. Wiring the new engine into the live `SYNTH_ENGINE` is likewise not deferred as a
new idea — it's the natural continuation once Phase 8/9 land.)

</deferred>

---

*Phase: 7-AudioWorklet DSP foundation*
*Context gathered: 2026-08-11*
