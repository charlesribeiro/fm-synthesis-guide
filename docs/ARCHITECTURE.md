# Architecture seed

This is a starting hypothesis for GSD discussion and planning, not a frozen design.

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
- Optional pure DSP kernel.

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
- Glossary.
- Settings/About.

## Proposed audio interfaces

```ts
export interface SynthEngine {
  readonly status: Signal<AudioEngineStatus>;

  initialize(): Promise<void>;
  setPatch(patch: SynthPatch): void;
  setAlgorithm(algorithm: AlgorithmDefinition): void;
  updateOperator(id: OperatorId, params: OperatorParameters): void;
  setFeedback(level: number): void;
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  allNotesOff(): void;
  destroy(): void;
}
```

Do not require the pure domain package to know Angular's `Signal`; an Angular-facing facade can expose engine status while the low-level engine uses callbacks/events.

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

## Audio roadmap

### Approximation engine

Useful for early UI/lesson development and browser lifecycle work. Keep behind the same engine interface.

### AudioWorklet engine

One processor can own a single voice initially:

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
- Use `@defer` for noncritical visualizers and secondary educational panels.
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
