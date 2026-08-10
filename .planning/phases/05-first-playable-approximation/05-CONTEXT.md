# Phase 5: First playable approximation - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning

<domain>
## Phase Boundary

A monophonic Web Audio engine — implementing the existing `SynthEngine` interface with
`OscillatorNode`/`GainNode` as an explicitly-labeled MVP approximation — that a learner can
actually trigger notes on from the UI (on-screen keys and computer keyboard), wired read-only to
`InstrumentState` so the sound tracks whatever algorithm/operator/feedback state is currently
selected. Covers: the `SynthEngine` implementation (gesture-gated `AudioContext` lifecycle,
per-algorithm oscillator/gain patching across all 32 algorithms, note-on/off with no stuck
voices, monophonic retrigger behavior, click-safe gain ramps, a fixed safety-clamped master
gain), the play surface inside Playground (on-screen keys + computer-keyboard mapping, one fixed
octave, an explicit "Enable audio" gate, a persistent teaching-approximation label). Does NOT
cover: the accurate AudioWorklet six-operator engine (Phase 7), guided-lesson content (Phase 6),
oscilloscope/spectrum visualizers (Phase 10), a user-facing master-volume control, an
octave-shift control, polyphony, the full DX7 4-rate/4-level envelope (Phase 9 — this phase's
click-prevention gain ramps are not that envelope), or Playwright browser smoke tests (explicitly
Phase 14/RELEASE-01's job per `docs/ACCEPTANCE_CRITERIA.md`).

</domain>

<decisions>
## Implementation Decisions

### Algorithm coverage
- **D-01:** The MVP engine supports all 32 algorithms this phase, not a focused subset. Since
  `InstrumentState` and the SVG diagram already handle all 32 uniformly off the canonical
  dataset (CLAUDE.md: no per-algorithm special-casing), a generic edge-traversal patching
  approach built once should cost about the same as building for 2 — and it's what makes "no
  stuck voices after algorithm switch" true for any switch, not just a blessed pair.
- **D-02:** Switching the selected algorithm while a note is actively held re-patches that held
  voice live — audibly, immediately — rather than waiting for the next note-on. Matches real DX7
  behavior and the app's core value ("change a parameter, immediately understand why the sound
  changed").

### Gain and retrigger behavior
- **D-03:** Master gain is a fixed, internally safety-clamped level this phase — no user-facing
  volume slider. ROADMAP.md's Phase 5 success criteria say nothing about a volume UI; a slider is
  Playground's later "Master controls" wishlist (`GSD_NEW_PROJECT_PROMPT.md` §"Playground mode"),
  not this phase's scope. Still must use short gain ramps on note start/stop per CLAUDE.md's
  "smooth gain changes to avoid clicks."
- **D-04:** Monophonic retrigger: if a new note-on arrives before the previous note releases, the
  held note is cut (with a short gain ramp, not a hard stop) and the new note starts immediately.
  No legato retrigger, no ignoring the new note. Simplest deterministic single-voice model, and
  the easiest to prove has no stuck voices.

### Input surface
- **D-05:** Both on-screen clickable/tappable keys and computer-keyboard key mapping are in scope
  this phase — matches `docs/ROADMAP_SEED.md`'s explicit "On-screen/computer keyboard" phrasing
  for Phase 5 and `docs/ACCEPTANCE_CRITERIA.md`'s keyboard-access requirement.
- **D-06:** The play surface is built inside Playground, replacing the "On-screen and computer
  keyboard, monophonic to start" bullet of its current placeholder — not a separate route/view.
  Playground's other placeholder bullets (algorithm selector, operator strips, oscilloscope, A/B
  compare) stay "coming soon," matching the same incremental-placeholder-replacement pattern
  Phase 4 already used for the Algorithms feature.
- **D-07:** The playable range is one fixed octave (e.g. C4–B4), 12 keys, no octave-shift control
  this phase. Enough range to hear ratio/timbre changes across several notes without building
  octave-shift UI/state now; widening range later is additive.

### Approximation labeling and gesture gate
- **D-08:** A persistent, always-visible label (e.g. "Educational approximation — not a DX7
  emulator") sits next to the play control at all times — not a one-time intro sentence or a
  tooltip that requires an extra interaction to see. Directly serves AUDIO-03 and CLAUDE.md's "do
  not claim exact DX7 emulation" rule: seen every time the learner plays, not just once.
- **D-09:** AUDIO-01's suspended/unavailable state renders as an explicit, labelled "Enable
  audio" action gating the keyboard — the on-screen/computer keyboard stays visibly inert until
  that gesture resolves `AudioEngineStatus` to `'ready'`. Matches
  `GSD_NEW_PROJECT_PROMPT.md`'s "friendly 'Enable audio' state when suspended," and keeps
  `'unavailable'` (no Web Audio support) a distinct, honest message rather than a silently dead
  keyboard.

### Claude's Discretion
- Exact voice-allocation/patching code shape for the generic 32-algorithm oscillator graph
  (per-operator `OscillatorNode`/`GainNode` construction, how feedback self-loops and multi-hop
  modulation chains are approximated with Web Audio's available node graph) — informed by D-01,
  `docs/ARCHITECTURE.md` §"Algorithm graph model", and the existing `derive-role.ts` derivation
  functions.
- Exact DI-adapter shape for `AudioContext`/oscillator construction (an `InjectionToken` +
  factory + `DestroyRef` cleanup, mirroring `MotionPreference`/`MATCH_MEDIA` in
  `src/app/core/browser/motion-preference.ts`) so tests can inject a fake instead of touching
  real Web Audio globals.
- Exact computer-keyboard-to-note mapping (which physical keys map to which of the 12 notes),
  key-repeat suppression, and focus-management interaction with the rest of the Playground page.
- Exact numeric value of the fixed safety-clamped master gain, and the exact millisecond length
  of the click-prevention gain ramps.
- Exact conversion formulas from `OperatorParameters`' DX7-integer scales (`outputLevel` 0-99,
  `ratio` coarse multiples, `detune` -7..+7, `fixedFrequencyHz`, `mode: 'ratio' | 'fixed'`) to Web
  Audio gain/frequency values, at the `SynthEngine` boundary per Phase 3's D-10.
- Exact wording/placement CSS for the D-08 approximation badge and the D-09 "Enable audio" state,
  respecting CLAUDE.md's non-color-only and reduced-motion rules.
- Whether Vitest-level audio boundary tests fake the whole `AudioContext`/node graph or fake at a
  narrower seam — informed by CLAUDE.md's "audio tests must be deterministic and must not require
  a physical output device" and `docs/ACCEPTANCE_CRITERIA.md`'s "audio boundary tests use fakes."

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and audio interfaces
- `docs/ARCHITECTURE.md` §"Proposed audio interfaces" — the `SynthEngine` interface shape this
  phase implements against (already scaffolded in `src/app/core/audio/synth-engine.ts`).
- `docs/ARCHITECTURE.md` §"Audio roadmap" → "Approximation engine" — explicitly scopes this
  phase's engine as "useful for early UI/lesson development... keep behind the same engine
  interface."
- `docs/ARCHITECTURE.md` §"Algorithm graph model" — the six-node/directed-edge/carrier/feedback
  graph shape D-01's generic patching approach must traverse.
- `docs/ARCHITECTURE.md` §"Performance boundaries" — signals for human-scale parameter/selection
  state; avoid per-frame object churn in the audio path.
- `GSD_NEW_PROJECT_PROMPT.md` §"Audio strategy: educational first" (Stage A) — the MVP engine's
  Web-Audio-nodes approach, "must be clearly described as a teaching approximation," monophonic
  first, click prevention via gain ramps, gesture-gated start with a friendly "Enable audio"
  state (source for D-08/D-09).
- `GSD_NEW_PROJECT_PROMPT.md` §"Application state" (~line 140) — suggested state list including
  master volume; this phase deliberately does not build a UI control for it (D-03).
- `GSD_NEW_PROJECT_PROMPT.md` §"Playground mode" — full Playground scope (algorithm selector,
  operator strips, master controls, oscilloscope, A/B) this phase only partially fulfills (D-06).

### Project state and requirements
- `.planning/REQUIREMENTS.md` §"Playable Audio (MVP approximation)" — AUDIO-01 through AUDIO-03,
  this phase's binding acceptance criteria.
- `.planning/ROADMAP.md` §"Phase 5: First playable approximation" — success criteria (gesture
  gate renders correctly, no stuck voices after note-off or algorithm switch, UI clearly labels
  the engine as an approximation).
- `docs/ROADMAP_SEED.md` §"Phase 5: First playable approximation" — injected browser audio
  boundary, monophonic engine, on-screen/computer keyboard, note lifecycle and cleanup, safe
  master volume (source for D-03/D-05).
- `docs/ACCEPTANCE_CRITERIA.md` — "Audio never starts before a user gesture," "Note-off and route
  changes cannot leave a stuck voice," "Audio boundary tests use fakes"; browser smoke tests
  covering audio enable/note lifecycle/algorithm switching are explicitly scoped to pre-release
  (Phase 14), not this phase.
- `CLAUDE.md` §"Audio rules" — DI'd browser audio, never construct `AudioContext` at module
  evaluation time, resume/start only after an explicit user gesture, never store `AudioNode`s in
  Angular signal state, explicit cleanup path per voice/oscillator/timer, smooth gain changes to
  avoid clicks, do not claim exact DX7 emulation, `OscillatorNode` modulation as the MVP
  approximation with AudioWorklet as the accuracy target.

### Existing code this phase implements against
- `src/app/core/audio/synth-engine.ts` — the `SynthEngine` interface (`status` signal,
  `initialize`/`setAlgorithm`/`updateOperatorLevel`/`setFeedback`/`noteOn`/`noteOff`/
  `allNotesOff`/`destroy`) this phase implements for the first time.
- `src/app/state/instrument-state.ts` — the read-only `InstrumentState` facade (`patch`,
  `algorithmId`, `operators`, `feedback`, `carriers`, `feedbackOperator`, `operatorRole`) the
  engine reads from; this phase does not modify `InstrumentState` itself.
- `src/app/domain/dx7/models/operator-parameters.ts` — `OperatorParameters`' DX7-integer-scale
  shape (`outputLevel` 0-99, `ratio` coarse multiples, `detune` -7..+7, `envelopeLevel` 0-99
  stub) the engine's Web-Audio-value conversion boundary must consume.
- `src/app/domain/dx7/models/derive-role.ts` — `getOperatorRole`/`deriveCarriers`/
  `getFeedbackOperator`, the same derivation functions Phase 3/4 use; the engine must read
  routing through these, never re-derive or duplicate the logic.
- `src/app/core/browser/motion-preference.ts` — the established DI-adapter pattern
  (`InjectionToken` + factory + `DestroyRef` cleanup) for wrapping a browser global; the audio
  engine's `AudioContext`/oscillator construction should follow the same shape.
- `src/app/features/playground/playground.ts`/`.html`/`.scss` — the existing placeholder this
  phase's play surface extends (D-06).
- `.planning/phases/03-signal-instrument-state/03-CONTEXT.md` — D-06/D-07/D-10/D-11 (
  `OperatorParameters` shape, `envelopeLevel` stub rationale, DX7 integer scales, default patch
  values) this phase's engine converts at its boundary.
- `.planning/phases/04-algorithm-browser-and-svg/04-CONTEXT.md` — D-02 (`/algorithms/:id` stable
  route), noting Phase 5 is one of the phases that eventually links to a specific algorithm's
  diagram (no new integration point required here, just awareness).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/core/audio/synth-engine.ts` — the `SynthEngine`/`AudioEngineStatus` placeholder
  interface, purpose-built in Phase 1 so this phase has a stable contract to implement against.
- `src/app/state/instrument-state.ts` — the only existing signal-based facade with real command
  methods (`setAlgorithm`, `updateOperator`, `setFeedback`); the engine subscribes to its
  read-only signals (`algorithm`, `operators`, `feedback`, `carriers`, `feedbackOperator`) to stay
  in sync without owning any of that state itself.
- `src/app/domain/dx7/models/algorithms.ts`, `derive-role.ts`, `operator.ts` — the canonical
  dataset and pure derivation functions the engine's routing/patching logic reads through.
- `src/app/core/browser/motion-preference.ts` — the one existing example of a DI-wrapped browser
  global (`InjectionToken` + factory + `DestroyRef`), the pattern to mirror for `AudioContext`.
- `src/app/features/playground/playground.ts` — already lists "On-screen and computer keyboard,
  monophonic to start" as its own future bullet; this phase fulfills exactly that bullet.

### Established Patterns
- Every feature route is lazy-loaded via `loadComponent` (Phase 1 convention); Playground already
  has its route, no new route needed.
- Domain layer (`src/app/domain/dx7/models/`) has zero Angular imports, machine-enforced by a
  scoped ESLint rule (Phase 2, DOMAIN-04) — any pure DX7-value-to-Web-Audio-value conversion
  function that doesn't touch browser APIs directly could live there; the stateful engine
  implementation itself is Angular (`@Injectable`)/browser-boundary code.
- Signal-based facade pattern (private `WritableSignal`, `.asReadonly()` public `Signal`,
  `effect`/`DestroyRef` only for imperative sync with an external system) — the engine's `status`
  signal and any Angular-facing wrapper should follow this shape, per CLAUDE.md's Angular rules.
- Phase 4 already replaced part of a feature's placeholder (`algorithms.ts`) incrementally rather
  than building a whole new component — D-06 follows the same precedent for Playground.

### Integration Points
- `InstrumentState` is the only source of truth for algorithm/operator/feedback state; the engine
  must read it, never fork a parallel copy.
- Phase 6 (guided lessons), Phase 9 (real envelopes), and Phase 10 (visualizers) all build on top
  of whatever `SynthEngine` implementation and Playground play-surface this phase establishes —
  no other phase should define a second engine implementation or a second play surface.

</code_context>

<specifics>
## Specific Ideas

No specific visual mockups or external references were provided. The concrete "feel" decisions
are D-08/D-09 (a persistent, always-visible approximation label and an explicit gesture-gated
"Enable audio" state) and D-04 (immediate cut-and-restart retrigger, not legato) — all grounded in
CLAUDE.md's audio rules and the seed docs' existing "friendly enable-audio state" language rather
than new user references.

</specifics>

<deferred>
## Deferred Ideas

- A user-facing master volume slider — belongs to Playground's later full "Master controls"
  assembly (`GSD_NEW_PROJECT_PROMPT.md` §"Playground mode"), not this phase's fixed
  safety-clamped gain (D-03).
- An octave-shift control for the on-screen/computer keyboard — this phase ships one fixed octave
  only (D-07); widening range is additive future work.
- Legato retrigger (new note takes over the held voice's envelope without a fresh attack) — this
  phase always cuts and restarts (D-04); legato is a more expressive behavior that could be
  revisited once Phase 9 designs the real envelope.

</deferred>

---

*Phase: 5-First playable approximation*
*Context gathered: 2026-08-06*
