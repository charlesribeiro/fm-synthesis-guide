# Phase 10: Visualizers and comparison tools - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 delivers three Playground-mode tools, all reading the live worklet-driven sound:

1. An oscilloscope (time-domain waveform) and a labelled spectrum (frequency-domain), both
   driven by a new `AnalyserNode` on the master audio output, redrawn via `requestAnimationFrame`
   without going through Angular signals/change detection per frame (VIZ-01).
2. A/B snapshot compare, wiring UI controls onto `InstrumentState`'s already-complete
   `captureSnapshot`/`recallSnapshot`/`hasSnapshot`/`reset` facade from Phase 3 (VIZ-02).
3. Constrained randomization of the current patch — a new command that nudges all six operators'
   parameters and feedback depth by a bounded random walk from their current values (VIZ-02).

Algorithm selection/routing is explicitly untouched by randomization — only operator parameters
and feedback depth are in scope for the random walk.

</domain>

<decisions>
## Implementation Decisions

### Visualizer Rendering & Audio Tap
- **D-01:** Canvas 2D for both the oscilloscope and spectrum, not SVG or WebGL — imperative
  per-frame redraw is the right fit for continuously-updating waveform/spectrum data; SVG's DOM
  churn at 60fps would fight the "no CD per animation frame" success criterion, and WebGL is
  unjustified overkill for a 2-lane display.
- **D-02:** Tap the master output only, via one new `AnalyserNode` inserted between the worklet's
  `masterGain` and `destination` — not a per-operator tap. Requires adding `createAnalyser` (and
  a minimal `AnalyserNodeLike`/`getByteTimeDomainData`/`getByteFrequencyData` surface) to
  `AudioContextLike` in `audio-context.token.ts`, alongside its existing `createGain`/
  `createDelay`, plus the corresponding fake in `testing/fake-audio-context.ts`. —
  **Reversibility:** costly — the boundary interface (`AudioContextLike`) is shared by
  `WorkletSynthEngine`, `WebAudioSynthEngine`, and every audio spec's fake; widening it now is
  cheap, but narrowing or replacing the tap point later touches all of those call sites.
- **D-03:** Draw loop runs via `requestAnimationFrame`, started/stopped from the visualizer
  component's lifecycle (or the narrow `effect()` exception CLAUDE.md carves out for imperative
  external-system sync) — never a `setInterval` poll, and analyser reads must never be routed
  through a signal/computed that would re-trigger CD.
- **D-04:** The visualizer panel is a new, always-visible region in `playground.html` below
  `PlaySurface`, replacing the existing `comingSoon` list item "Oscilloscope and spectrum
  display". No show/hide toggle — it renders flat/silent when audio is suspended or no note is
  sounding, consistent with the app's existing suspended/ready status handling.

### Spectrum Display
- **D-05:** Logarithmic frequency axis — matches perceived pitch/timbre and keeps FM sidebands
  near the fundamental legible, rather than crowding all musically relevant content into a
  linear scale's low-frequency sliver.
- **D-06:** "Labelled" (VIZ-01) means both a few frequency-axis tick labels (e.g. 100 Hz / 1 kHz /
  10 kHz) on the canvas AND an accessible text description alongside it — canvas content is
  otherwise invisible to assistive tech, mirroring CLAUDE.md's "include accessible text
  descriptions" rule already applied to the SVG algorithm diagrams.
- **D-07:** Bar/column ("graphic EQ") rendering, not a continuous line — keeps the spectrum
  visually distinct from the oscilloscope's line-based waveform and reads unambiguously as
  per-band amplitude.
- **D-08:** `fftSize` of 2048 (the `AnalyserNode` default range) — enough resolution to
  distinguish FM sidebands at typical note frequencies without over-smoothing, cheap enough for
  a 60fps redraw.

### A/B Compare UX
- **D-09:** Five explicit controls — Capture A, Capture B, Recall A, Recall B, Reset — each
  mapping 1:1 onto `InstrumentState`'s existing methods. No new state logic; this is UI wiring
  only. A single A/B toggle switch was explicitly considered and rejected because `recallSnapshot`
  just sets the patch — there's no "currently on A or B" concept in the facade to toggle between;
  a future toggle would need new derived state, not just a UI change.
- **D-10:** Recall/Capture buttons communicate slot state via text + disabled state (e.g. "Recall A
  (empty)" disabled until `hasSnapshot('a')`), not color or icon shape alone — matches CLAUDE.md's
  "do not communicate carrier/modulator state by color alone" spirit and reuses `hasSnapshot()`
  directly.
- **D-11:** Recall applies immediately to the live patch with no click-safety gating — Phase 9's
  per-operator envelope continuity (D-04 in `09-CONTEXT.md`) already guarantees the sound jumps
  continuously from wherever it sits, so swapping the patch under a live worklet graph mid-note is
  already click-safe. No new audio-side work needed for this.

### Randomization
- **D-12:** Randomize touches every operator's full `OperatorParameters` (ratio/fixed mode +
  frequency, output level, detune, envelope rates/levels ×4) plus instrument-level feedback depth
  — the whole sound-shaping surface Phase 9 finished building. Algorithm/routing selection is
  explicitly excluded; randomizing topology would undercut the pedagogical point of studying one
  algorithm's routing at a time.
- **D-13:** Ranges stay musically sensible via a bounded random walk from the *current* patch's
  values (e.g. a delta bounded to roughly ±20% of each field's valid range) rather than uniform
  sampling across each field's full raw bounds — keeps results audibly related to what's currently
  playing and avoids common uniform-random failure modes (e.g. every envelope level landing near
  0, silence-prone results).
- **D-14:** Randomize writes directly into the live patch via a new `InstrumentState` command,
  the same posture as `setAlgorithm`/`updateOperator`. No implicit auto-capture before
  randomizing and no separate undo stack — the just-built A/B capture flow (D-09) is the
  intentional "undo": capture to a slot first if you want the prior sound back.
- **D-15:** One "Randomize" button lives in the same tools panel as the A/B controls — a single
  explicit action, no automatic/implicit randomization triggered by other events.
- **D-16:** Randomize only nudges continuous/numeric fields — ratio-or-fixed-frequency (whichever
  mode an operator is currently in), output level, detune, the four envelope rates/levels, and
  feedback depth — via the D-13 bounded random walk. It never flips an operator's `mode`
  (ratio↔fixed) or `enabled` state. Resolved during planning (RESEARCH.md Open Question A1):
  D-13's "bounded walk from current value" has no natural meaning for a discrete flip, and this
  mirrors D-12's own rationale for excluding algorithm/routing topology from randomization — a
  mode/enabled flip is a structural change, not a nudge.

### Claude's Discretion
- Exact bounded-random-walk delta magnitude/formula per field (D-13) — the ±20% figure above is
  illustrative, not a locked number; tune during planning/implementation against what actually
  sounds musically reasonable.
- Exact visual layout/grouping of the A/B and Randomize button row within the new tools panel.
- Canvas pixel dimensions, colors (respecting the project's existing token/reduced-motion rules),
  and exact tick-label formatting on the spectrum axis.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and phase framing
- `CLAUDE.md` — binding project instructions: audio rules (no `AudioNode` in signal state, never
  construct `AudioContext` at module eval time, smooth gain changes), UI rules (SVG for graphs,
  no color-only state encoding, reduced motion, accessible text descriptions), zoneless/OnPush
  Angular rules.
- `.planning/ROADMAP.md` §"Phase 10: Visualizers and comparison tools" — goal and success
  criteria this phase must satisfy.
- `.planning/REQUIREMENTS.md` — VIZ-01 (oscilloscope + labelled spectrum, off the Angular CD
  path), VIZ-02 (A/B comparison + constrained randomization).
- `.planning/PROJECT.md` — core value statement ("see a routing diagram, hear the sound, change a
  parameter, immediately understand why the sound changed"); Phase 9 completion note confirms the
  envelope-driven engine is the live sound this phase visualizes.

### Audio boundary (tap point work)
- `src/app/core/audio/audio-context.token.ts` — `AudioContextLike`, `GainNodeLike`,
  `DelayNodeLike`, and friends; the minimal hand-rolled Web Audio surface D-02's `AnalyserNode`
  addition extends. No spec ever touches a real `AudioContext` (jsdom has none).
- `src/app/core/audio/worklet-synth-engine.ts` — `WorkletSynthEngine`, the only integration point
  Playground/lessons consume; owns `masterGain` and the graph the new analyser taps.
- `src/app/core/audio/synth-engine.ts` — the `SynthEngine` interface and `AudioEngineStatus`;
  visualizer must handle `suspended`/`unavailable`/`error` states gracefully (flat/silent, no
  crash).
- `src/app/core/audio/testing/fake-audio-context.ts` — the hand-rolled fake `AudioContextLike`
  implementation specs use; needs a fake analyser alongside D-02's real one.

### State facade (A/B and randomization)
- `src/app/state/instrument-state.ts` — `InstrumentState`: `captureSnapshot`, `recallSnapshot`,
  `hasSnapshot`, `reset`, `snapshots` signal, `SnapshotSlot`/`SNAPSHOT_SLOTS`/`isSnapshotSlot`
  (D-09's UI wires directly onto these); `updateOperator`/`setFeedback` as the pattern D-14's new
  randomize command should follow (validate-first, immutable-write, `RangeError` on bad input).
- `src/app/domain/dx7/models/operator-parameters.ts` — `OperatorParameters`,
  `validateOperatorParameters`, `Dx7Envelope` — the field set and valid-range info D-12/D-13's
  random walk must respect and stay within.
- `src/app/domain/dx7/models/patch.ts` — `DEFAULT_PATCH`, `OperatorParameterSet`,
  `validateFeedbackLevel` — feedback depth bounds for D-13's randomization.

### Existing UI surface
- `src/app/features/playground/playground.ts` / `playground.html` — `Playground` component and
  its `comingSoon` list (D-04 replaces the "Oscilloscope and spectrum display" and "A/B snapshot
  compare and constrained randomization" entries with real UI).
- `src/app/features/play-surface/` — `PlaySurface`, the existing note-lifecycle component
  Playground embeds; the new visualizer/tools panel sits alongside it, not inside it.

No external specs beyond the above — requirements and prior-phase decisions fully captured here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InstrumentState`'s A/B snapshot facade (`captureSnapshot`/`recallSnapshot`/`hasSnapshot`/
  `reset`) is fully built and tested (Phase 3) — VIZ-02's A/B half of this phase is UI wiring, not
  new state design.
- `updateOperator`/`setFeedback`'s validate-first-then-immutable-write pattern in
  `instrument-state.ts` is the template a new `randomize()` (or similar) command should follow.
- `AudioContextLike`'s hand-rolled minimal-surface convention (`audio-context.token.ts`) — the
  precedent for how D-02's `AnalyserNode` addition should be shaped (just enough surface for the
  engine + specs, not the full Web Audio API).

### Established Patterns
- Domain layer (`src/app/domain/dx7/`) has zero Angular imports (DOMAIN-04 ESLint gate) —
  randomization's range/bounds logic belongs there if it's pure math, not in `InstrumentState` or
  a component.
- Zoneless app: `requestAnimationFrame` callbacks don't trigger CD by default (D-03) — the
  existing constraint that makes VIZ-01's "without driving Angular CD per animation frame"
  requirement achievable without special-casing.
- Blocking human-verification listening checkpoints have preceded every audio-affecting phase
  (05-04, 06-04, 07-03, 08-04, 09-04) — Phase 10 doesn't change the audible engine, but D-11's
  recall-click-safety claim rests on Phase 9's envelope work, which was itself checkpoint-verified.

### Integration Points
- `WorkletSynthEngine` is the single integration point for D-02's analyser tap — no other engine
  implementation (`WebAudioSynthEngine`) is the live path per Phase 8's D-01 cutover, so it does
  not need the same analyser wiring.
- Phase 11 (curriculum) assumes visualizers already exist by the time it starts, per the
  roadmap's phase ordering — nothing in this phase should be scoped as "come back in Phase 11."

</code_context>

<specifics>
## Specific Ideas

No specific visual mockups were provided. The concrete "feel" decisions are D-05/D-07 (logarithmic,
bar-style spectrum reading like a classic graphic EQ) and D-13 (randomization as a bounded nudge
from the current sound rather than a jump to an unrelated one) — both grounded in the core value
of understanding *why* the sound changed, not just that it changed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. A single A/B toggle-switch UI (D-09) and an
auto-capture-before-randomize safety net (D-14) were both raised and explicitly rejected during
discussion, not deferred as future ideas — they're recorded as decisions, not backlog items.

</deferred>

---

*Phase: 10-Visualizers and comparison tools*
*Context gathered: 2026-08-17*
