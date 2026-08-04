# Project request: DX7 Algorithm Lab

Build **DX7 Algorithm Lab**, an unofficial educational web application that teaches Yamaha DX7-style six-operator FM/phase-modulation synthesis through the 32 operator-routing algorithms, one algorithm at a time.

The project must be created and maintained using **Angular 22**, **Claude Code**, and the locally installed **open-gsd/gsd-core** workflow. Treat GSD's discuss → plan → execute → verify → ship phase loop and its `.planning/` artifacts as mandatory project governance.

## Product vision

The application should make the invisible structure of FM synthesis visible, audible, and playful. A learner should be able to:

- Browse all 32 algorithms.
- See a clear six-operator routing diagram for each algorithm.
- Understand which operators are carriers, modulators, stacked modulators, and feedback sources.
- Learn one concept at a time through guided lessons and small experiments.
- Play notes from an on-screen keyboard and the computer keyboard.
- Change operator ratios, output levels, detune, envelopes, and feedback while hearing the result immediately.
- Compare two parameter states with an A/B control.
- Reset a lesson to a known educational preset.
- See a waveform and spectrum visualization that responds to the current sound.
- Progress from simple additive layouts to increasingly complex modulation networks.

The experience may be inspired by the immediacy of Dexed, but it must have an original visual identity and implementation. Do not copy Dexed UI artwork, source code, patch banks, Yamaha panel artwork, or copyrighted manual illustrations. Draw algorithm diagrams from structured data as original SVG. Generate original demonstration sounds from the app's own engine.

## Target users

1. Synth enthusiasts who own or are considering a DX7.
2. Musicians confused by the original six-operator interface.
3. Web developers learning Angular 22 through a serious audio project.
4. Sound-design learners who want to understand algorithms instead of merely browsing presets.

## Mandatory technology and engineering constraints

- Angular 22.x.
- Standalone components only; no feature NgModules.
- Zoneless application.
- Strict TypeScript and strict Angular template checking.
- Angular signals as the default local and application-state primitive.
- Use `signal`, `computed`, `effect`, signal inputs/outputs where appropriate, and modern built-in control flow (`@if`, `@for`, `@switch`).
- Use RxJS only at genuine asynchronous stream boundaries, not as a replacement for signal state.
- Lazy-loaded route-level features.
- SCSS with design tokens via CSS custom properties.
- Responsive and keyboard-accessible UI.
- Vitest for unit/component tests.
- Dependency injection around browser APIs, especially AudioContext, MIDI, storage, animation timing, and feature detection.
- No `any` except at a narrowly documented interoperability boundary.
- No mutable shared state exposed from services.
- No direct browser-global access inside domain logic.
- Use Git commits as atomic checkpoints through GSD execution tasks.

## Angular scaffold

Create the workspace in the existing repository root with:

```bash
npx @angular/cli@22 new dx7-algorithm-lab \
  --directory=. \
  --routing \
  --style=scss \
  --standalone \
  --strict \
  --test-runner=vitest \
  --zoneless \
  --skip-git \
  --defaults
```

Preserve Angular 22's concise 2025 file naming style unless there is a concrete tooling incompatibility.

## Architecture principles

Organize by product feature and domain responsibility, not by generic Angular artifact type.

Suggested source layout:

```text
src/app/
  core/
    audio/
    browser/
    persistence/
    accessibility/
  shared/
    ui/
    visualization/
    utilities/
  features/
    learn/
    playground/
    algorithms/
    glossary/
    settings/
  domain/
    dx7/
      models/
      algorithms/
      synthesis/
      lessons/
```

Keep the synthesis domain framework-agnostic wherever practical. Angular services should adapt the pure domain model to the UI and browser APIs.

## Data model

Represent every algorithm as immutable structured data, not custom component markup.

At minimum, define typed concepts similar to:

```ts
type OperatorId = 1 | 2 | 3 | 4 | 5 | 6;
type AlgorithmId = number; // validate 1..32 at boundaries

interface AlgorithmDefinition {
  readonly id: AlgorithmId;
  readonly name: string;
  readonly carriers: readonly OperatorId[];
  readonly edges: readonly ModulationEdge[];
  readonly feedback: FeedbackDefinition;
  readonly teachingTags: readonly string[];
  readonly lessonSummary: string;
}

interface ModulationEdge {
  readonly from: OperatorId;
  readonly to: OperatorId;
}

interface OperatorParameters {
  readonly enabled: boolean;
  readonly mode: 'ratio' | 'fixed';
  readonly ratio: number;
  readonly fixedFrequencyHz: number;
  readonly detune: number;
  readonly outputLevel: number;
  readonly envelope: Dx7Envelope;
}
```

Store the 32 algorithm definitions in one canonical, validated dataset. Add invariants and tests that reject missing operators, invalid edges, impossible IDs, duplicate algorithm IDs, and malformed feedback declarations. Research and cross-check the routing matrix before treating it as authoritative.

## Application state

Create a signal-based facade/store with narrowly scoped writable signals and read-only public selectors. Suggested state:

- Selected algorithm.
- Selected operator.
- Six operator parameter records.
- Feedback level.
- Master volume.
- Current note/velocity.
- Lesson step and completion state.
- A/B snapshots.
- Audio-engine status: unavailable, suspended, ready, error.
- MIDI status and selected input.
- Visualizer state.

Use immutable updates. Derived values such as carrier IDs, modulator IDs, active edges, lesson hints, and formatted ratios must be computed signals.

Do not put AudioNode objects inside reactive application state. The audio engine owns them privately.

## Audio strategy: educational first, accurate by design

Architect the engine behind an interface so implementations can evolve.

### Stage A — educational MVP

A limited monophonic engine may use Web Audio nodes for quick validation of ratios, modulation depth, envelopes, feedback behavior, and UI responsiveness. This engine must be clearly described as a teaching approximation, not a bit-accurate DX7 emulator.

### Stage B — six-operator AudioWorklet engine

Implement the serious engine as an `AudioWorkletProcessor` with six phase accumulators, sine lookup or `Math.sin` initially, explicit phase modulation, per-operator envelope state, routing from the selected algorithm, feedback state, note lifecycle, and parameter messages. Keep the DSP core pure enough to test offline outside Angular.

The architecture must not imply that simply patching an OscillatorNode into another oscillator's frequency parameter is identical to the DX7's digital phase-modulation implementation.

Start monophonic. Add polyphony only after the single-voice engine and note cleanup are deterministic.

Prevent clicks with short gain ramps and deterministic note release. Audio must start only after a user gesture. Show a friendly “Enable audio” state when the context is suspended.

## Learning experience

Create two primary modes:

### Guided Learn mode

- A curriculum of small lessons.
- Explain carrier versus modulator.
- Introduce ratio relationships using audible experiments.
- Start with Algorithm 32 to explain six additive carriers.
- Use Algorithm 1 to introduce a simple stack plus a deeper modulation chain.
- Gradually introduce branching, multiple carriers, stacked modulation, and feedback.
- Each lesson has an objective, a short explanation, a “try this” action, an expected audible effect, and a completion check.
- Avoid forcing the learner to memorize all 32 diagrams. Highlight recurring two- and three-operator substructures.

### Playground mode

- Full algorithm selector.
- Six operator strips.
- Algorithm SVG.
- On-screen keyboard.
- Master controls.
- Oscilloscope and spectrum display.
- A/B snapshots.
- Randomize with constrained, musically safe ranges.
- Undo/reset.

## Visual design

Create an original, modern instrument-lab aesthetic: dark neutral background, high-contrast panels, restrained retro-digital references, large readable numbers, and obvious signal flow.

Requirements:

- Use semantic HTML first.
- Use SVG for algorithm diagrams so operators and edges are accessible and data-driven.
- Carriers and modulators must be distinguishable by more than color alone.
- Edge thickness or intensity may reflect modulation amount.
- The feedback loop must be visually explicit.
- Provide reduced-motion behavior.
- Meet WCAG AA contrast where practical.
- All sliders require labels, value text, keyboard operation, and sensible step sizes.
- Mobile layout remains usable, but desktop/tablet is the primary instrument-editing experience.

## Visualizations

- Oscilloscope from an `AnalyserNode` or engine-provided sample buffer.
- Spectrum display with labelled frequency scale.
- Optional harmonic markers for integer ratios.
- Visualizer rendering must not trigger Angular change detection for every animation frame. Keep the animation loop outside component reactive state and clean it up deterministically.

## Browser MIDI

Treat Web MIDI as progressive enhancement:

- Detect support.
- Request permission only from an explicit user action.
- Support note on/off and velocity.
- Handle device connect/disconnect.
- The app must remain fully usable without MIDI.
- Hide or explain unavailable MIDI features rather than failing.

## Persistence

Persist only serializable user settings, progress, and custom patches. Version the storage schema. Provide import/export as JSON later. Do not persist AudioNode instances or transient note state.

## Routes

Suggested routes:

```text
/                 landing and continue-learning dashboard
/learn            curriculum index
/learn/:lessonId  guided lesson
/algorithms       32-algorithm browser
/algorithms/:id   algorithm detail
/playground       full instrument playground
/glossary         synthesis glossary
/settings         audio, MIDI, accessibility, persistence
/about            methodology, limitations, credits, disclaimer
```

## Testing requirements

Unit and component tests are mandatory from the first phase.

### Pure domain tests

- All 32 algorithm definitions pass schema/invariant validation.
- Carrier derivation matches graph structure.
- Topological evaluation order is correct where applicable.
- Ratio-to-frequency calculations.
- MIDI note-to-frequency conversion.
- Envelope segment transitions.
- Feedback mapping and parameter clamping.
- Patch serialization and migration.

### Signal store/facade tests

- Selecting an algorithm updates all computed selectors synchronously.
- Immutable operator updates do not mutate prior snapshots.
- A/B snapshots restore exactly.
- Reset produces a known deterministic state.
- Invalid external input is clamped or rejected.

### Component tests

- Algorithm selector renders 32 options.
- SVG graph renders the expected operator and edge counts from fixture data.
- Carrier/modulator semantics are exposed accessibly.
- Operator controls update signals.
- Keyboard interaction changes notes.
- Audio unavailable/suspended/error states render correctly.
- Modern control flow updates the DOM correctly.

### Audio tests

- Inject an audio-engine abstraction; do not depend on the machine's real AudioContext in unit tests.
- Verify engine commands and lifecycle calls through fakes/spies.
- Test the pure DSP core with deterministic sample blocks.
- Assert no NaN/Infinity output.
- Assert bounded output and cleanup after note-off.
- Use OfflineAudioContext or browser-level tests only where it adds meaningful confidence.

### Browser smoke tests, later phase

Use Playwright for:

- Enabling audio after user gesture.
- Playing and releasing a note.
- Switching algorithms without uncaught errors or stuck notes.
- Keyboard-only lesson completion.
- Basic mobile layout.

## Quality gates

Every phase must finish with:

```bash
npm run build
npm test -- --run
npm run lint
```

No phase is complete with failing tests, TypeScript errors, Angular template errors, leaked animation loops, leaked audio voices, or undocumented disabled checks.

Set meaningful coverage thresholds after the scaffold phase. Prioritize branch coverage for the domain graph and DSP state machine instead of chasing superficial template percentages.

## Initial roadmap expectation

The roadmap should be decomposed into small GSD phases. A sensible outline is:

1. Angular 22 scaffold, shell, quality gates, design tokens, routing.
2. Canonical algorithm domain model and validated dataset.
3. Signal state facade and operator editing primitives.
4. SVG algorithm graph and algorithm browser.
5. Monophonic educational audio engine and on-screen keyboard.
6. First guided vertical slice: Algorithm 32 and Algorithm 1.
7. AudioWorklet six-operator phase-modulation engine.
8. Envelopes, feedback, visualizers, and A/B snapshots.
9. Full 32-algorithm curriculum and progress persistence.
10. Web MIDI, import/export, accessibility and performance hardening.
11. Playwright smoke tests, documentation, deployment, and portfolio polish.

The planner may refine this, but avoid a giant first phase.

## Phase 1 acceptance criteria

Phase 1 should produce a runnable Angular 22 application with:

- Confirmed Angular 22 versions in package metadata.
- Standalone and zoneless configuration.
- Vitest passing.
- Strict build passing.
- Lazy route shell for Learn, Algorithms, Playground, and About.
- Initial responsive layout and design tokens.
- One simple signal-based example state proving the chosen pattern.
- Accessibility baseline.
- README with setup, commands, architecture summary, and project disclaimer.
- No synthesis engine yet beyond a typed placeholder interface.

## Legal and product disclaimer

The project is unofficial and educational, with no affiliation with Yamaha or the Dexed project. “Yamaha” and “DX7” are used descriptively. Do not bundle copyrighted ROMs, commercial patches, sampled performances, proprietary manuals, or copied interface artwork. Track third-party licenses in the repository.

## Working behavior expected from Claude/GSD

- Ask focused questions during `/gsd-discuss-phase`; record decisions instead of leaving them in chat history.
- Research version-sensitive APIs from official Angular, Web Audio, Web MIDI, and GSD documentation.
- Prefer small vertical slices with tests.
- Commit atomic tasks.
- Do not silently lower requirements to make tests pass.
- Record technical compromises, especially audio-accuracy compromises.
- Keep a clear boundary between educational approximation and DX7-compatible behavior.
