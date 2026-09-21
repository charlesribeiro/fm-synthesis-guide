# Architecture

Release documentation for the implementation through Phase 13, with Phase 14 browser
verification. This application is an educational approximation, not bit-accurate DX7 emulation.

Angular 22 standalone components use zoneless change detection and lazy feature routes.
The canonical algorithm dataset drives both SVG view models and the routed DSP engine.
See [release methodology](RELEASE.md) for verification boundaries and hosting status.

## Layers

### 1. Pure DX7 learning domain

Framework-independent TypeScript:

- Algorithm definitions and graph validation.
- Operator parameter models.
- Ratio/frequency calculations.
- Envelope state machine — shipped as of Phase 9
  ([`envelope-generator.ts`](../src/app/domain/dx7/dsp/envelope-generator.ts)), an original,
  from-first-principles implementation, not a transcription of any DX7 ROM disassembly or Dexed
  source.
- Lesson definitions and completion rules.
- Patch serialization/migrations.
- Pure six-operator DSP kernel, bundled separately for AudioWorklet.

### 2. Application state

Signal-based facades:

- Instrument state.
- Lesson/progress state.
- Settings and persistence state.
- MIDI state.
- Audio lifecycle state.

Writable signals remain private. Components consume read-only signals and invoke explicit commands.

### 3. Browser adapters

Dependency-injected boundaries:

- Audio context/worklet adapter.
- MIDI adapter.
- Local storage adapter.
- Animation clock/requestAnimationFrame adapter.
- Browser capability adapter.

### 4. UI features

- Learn.
- Algorithms.
- Playground.
- Settings/About.

## Audio interface and implementation

[`SynthEngine`](../src/app/core/audio/synth-engine.ts) exposes a read-only status function,
`initialize`, `setAlgorithm`, `updateOperatorLevel`, `setFeedback`, `noteOn`, `noteOff`,
`allNotesOff`, and `destroy`. The injected live implementation is
[`WorkletSynthEngine`](../src/app/core/audio/worklet-synth-engine.ts).
`WebAudioSynthEngine` remains a reference implementation, not an automatic fallback.

The browser adapters construct AudioContext/AudioWorkletNode only after a user gesture.
Main-thread patch state is sent as validated worklet messages; the processor runs the
Angular-independent graph router and six envelope generators. Components never own audio
nodes in signal state. The visualizer polls the read-only `AnalysisTap` outside Angular's
change-detection path, and releases its frame callback when destroyed.

Versioned local storage is owned by `SavedDocumentStore`; `LessonProgress` and
`PlaygroundPatchSlot` expose narrower facades. Lesson starting patches do not overwrite the
saved Playground slot. MIDI is optional, with browser permissions/device events behind the
injected MIDI boundary. The app remains navigable without audio or MIDI support.

## Algorithm graph model

The graph should support:

- Six operator nodes.
- Directed modulation edges.
- One or more carriers routed to output.
- Explicit feedback edge/source/target metadata.
- Derivable incoming/outgoing relationships.
- A deterministic evaluation order for DSP.
- A layout hint layer that is separate from synthesis truth.

Separating layout hints from graph truth prevents visual coordinates from becoming business logic.

## Rendering strategy

Use SVG for operator diagrams:

- One `<g>` per operator.
- Directed paths with arrow markers.
- Separate output-bus paths.
- Feedback path with a distinct shape and accessible label.
- Data attributes for testing.
- CSS custom properties for states and intensity.

The SVG component should receive a view model; it must not query the audio engine directly.

## Audio engine and future boundaries

### Approximation engine

Retained as a reference for the original MVP. The live application uses the worklet engine.

### AudioWorklet engine

One processor owns a monophonic voice:

- Six phase accumulators.
- Per-operator frequency increment.
- Envelope generators — shipped as of Phase 9: six independent per-operator four-rate/four-level
  generators live inside the router, each scaling its own operator's block before that block is
  read as a carrier contribution or a modulation source.
- Operator output scaling.
- Algorithm routing.
- Feedback memory.
- Master gain and limiter/safety clamp.

Main-thread messages should update compact parameter structures. Avoid per-frame object churn.

### Polyphony

After deterministic monophony:

- Voice allocation and stealing.
- Per-voice envelope/note state — still future work; the app is monophonic as of Phase 9. The
  Phase 9 envelope generator's state is already scoped per instance (one per operator, six per
  router) rather than as router-wide globals, a shape chosen not to preclude allocating one
  generator set per voice later.
- Global patch parameters.
- All-notes-off recovery.

## Performance boundaries

- Do not push oscilloscope samples into Angular signals every animation frame.
- Use an imperative canvas/SVG drawing loop for high-frequency visualization.
- Use signals for human-scale parameter and selection state.
- Keep visualizers outside Angular change detection; defer noncritical work where appropriate.
- Profile before introducing workers beyond AudioWorklet.

## Error handling

Expose actionable states:

- Browser audio unsupported.
- Audio suspended and awaiting user gesture.
- Worklet loading failure.
- MIDI unsupported or permission denied.
- Invalid imported patch.
- Storage migration failure.

The application must retain a useful read-only learning experience when audio is unavailable.

## Static deployment

Production: https://charlesribeiro.github.io/fm-synthesis-guide/ (publication pending
first merged main deployment). Angular's build-time base href is `/fm-synthesis-guide/`;
the fixed AudioWorklet filename resolves against the document base. A custom 404 shell
preserves SPA deep links on GitHub Pages, including its initial HTTP 404 limitation.
CI gates the reusable Pages deployment workflow and uploads only the tested production
artifact. See [release methodology](RELEASE.md) for exact activation/live verification.
Local development remains `npm start` at the root base path; LAN HTTP is not the canonical
audio environment. Manual audio validation belongs on the deployed HTTPS site.
