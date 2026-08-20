# Phase 10: Visualizers and comparison tools - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 10 (new + modified)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/core/audio/audio-context.token.ts` (extend: `AnalyserNodeLike`, `createAnalyser`) | config/boundary interface | streaming (audio graph node surface) | same file, `GainNodeLike`/`DelayNodeLike` (lines 36-42, 51-54) | exact (extending an existing file's own pattern) |
| `src/app/core/audio/testing/fake-audio-context.ts` (extend: `FakeAnalyserNode`, `createdAnalysers`) | test double | streaming | same file, `FakeGainNode`/`FakeDelayNode` (lines 128-134), `createGain`/`createdGains` (lines 183-187) | exact |
| `src/app/core/audio/worklet-synth-engine.ts` (extend: analyser field, insertion point, read methods, teardown) | service (audio engine) | streaming / event-driven | same file, `masterGain` construction (lines ~275-291) and `teardownGraph`/`discardLocalGraph` | exact (extending existing pattern in same file) |
| `src/app/core/audio/worklet-synth-engine.spec.ts` (extend: fix `findMasterGain`, new analyser tests) | test | request-response (spec assertions) | same file, `findMasterGain` helper (lines 77-83) | exact |
| `src/app/domain/dx7/randomization/random-walk-patch.ts` (new) | utility (pure domain function) | transform | `src/app/domain/dx7/models/operator-parameters.ts` (`validateOperatorParameters`, bounds constants) + `src/app/domain/dx7/dsp/envelope-generator.ts` (pure domain fn precedent) | role-match |
| `src/app/domain/dx7/randomization/random-walk-patch.spec.ts` (new) | test | transform | `src/app/domain/dx7/dsp/envelope-generator.spec.ts` / `operator-parameters` bounds-invariant tests | role-match |
| `src/app/state/instrument-state.ts` (extend: `randomize()` command) | service (signal facade / store) | CRUD (command-mutates-signal) | same file, `updateOperator`/`setFeedback` (lines 173-198) | exact |
| `src/app/features/playground/visualizer/visualizer.ts` (+html/scss/spec, new component) | component | streaming (RAF poll of AnalyserNode) | `src/app/features/play-surface/play-surface.ts` (component shape, `inject(SYNTH_ENGINE)`, `DestroyRef`, host bindings) — but note **no existing component uses `viewChild`/`afterNextRender`** (confirmed by RESEARCH.md); this is a new pattern first introduced here | role-match (no data-flow-exact analog exists) |
| `src/app/features/playground/tools-panel/tools-panel.ts` (+html/scss/spec, new component) | component | request-response (button → command call) | `src/app/features/play-surface/play-surface.ts` (component shape, `inject`, host bindings for keyboard) | role-match |
| `src/app/features/playground/playground.ts` / `playground.html` (extend: embed new components, trim `comingSoon`) | component (route host) | request-response | same file (already embeds `PlaySurface`) | exact |

## Pattern Assignments

### `src/app/core/audio/audio-context.token.ts` (config/boundary interface, streaming)

**Analog:** same file — `GainNodeLike`/`DelayNodeLike` and `AudioContextLike.createGain`/`createDelay`

**Existing minimal-surface pattern** (lines 36-54):
```typescript
export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface DelayNodeLike extends AudioNodeLike {
  readonly delayTime: AudioParamLike;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: AudioNodeLike;
  resume(): Promise<unknown>;
  close(): Promise<unknown>;
  createOscillator(): OscillatorNodeLike;
  createGain(): GainNodeLike;
  createDelay(maxDelayTime?: number): DelayNodeLike;
}
```

**Pattern to copy:** add `AnalyserNodeLike extends AudioNodeLike` with exactly `fftSize: number`,
`readonly frequencyBinCount: number`, `getByteTimeDomainData(target: Uint8Array): void`,
`getByteFrequencyData(target: Uint8Array): void` — mirrors `GainNodeLike`'s "just the members this
app needs" shape, not the full DOM `AnalyserNode` interface. Add `createAnalyser(): AnalyserNodeLike;`
to `AudioContextLike` next to `createGain`/`createDelay`. No auth/error-handling patterns apply to
this file (pure interface declarations).

---

### `src/app/core/audio/testing/fake-audio-context.ts` (test double, streaming)

**Analog:** same file — `FakeGainNode`/`FakeDelayNode` and `createGain`/`createdGains`

**Imports pattern** (lines 1-8):
```typescript
import type {
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  DelayNodeLike,
  GainNodeLike,
  OscillatorNodeLike,
} from '../audio-context.token';
```

**Core pattern — fake node class + registry** (lines 94-134, 183-193):
```typescript
abstract class FakeAudioNode implements AudioNodeLike {
  readonly connections = new Set<AudioNodeLike | AudioParamLike>();
  connect(destination: AudioNodeLike | AudioParamLike): AudioNodeLike | AudioParamLike {
    this.connections.add(destination);
    return destination;
  }
  disconnect(destination?: AudioNodeLike | AudioParamLike): void {
    if (destination === undefined) { this.connections.clear(); return; }
    this.connections.delete(destination);
  }
}

export class FakeGainNode extends FakeAudioNode implements GainNodeLike {
  readonly gain = new FakeAudioParam(1);
}

// in FakeAudioContext:
createGain(): FakeGainNode {
  const gain = new FakeGainNode();
  this.createdGains.push(gain);
  return gain;
}
```

**Pattern to copy:** add `FakeAnalyserNode extends FakeAudioNode implements AnalyserNodeLike` with
settable `fftSize` (default 2048), a computed `frequencyBinCount` (`fftSize / 2`), and
`getByteTimeDomainData`/`getByteFrequencyData` methods that fill the passed buffer with
deterministic canned bytes (e.g. all-128 for silent time-domain, a settable array for frequency) —
no `Math.random`/real FFT. Add `createdAnalysers: FakeAnalyserNode[]` registry and a
`createAnalyser()` method following the exact `createGain`/`createdGains` shape above. Also update
the `createdNodes` getter (lines 200-203) to include `createdAnalysers` if teardown-assertion specs
need it.

---

### `src/app/core/audio/worklet-synth-engine.ts` (service, streaming)

**Analog:** same file — `masterGain` construction/teardown (this phase extends this exact file, not a sibling)

**Current graph-construction pattern this phase modifies** (verbatim, read this session):
```typescript
const masterGain = context.createGain();
const now = context.currentTime;
masterGain.gain.setValueAtTime(0, now);

node.connect(masterGain);
masterGain.connect(context.destination);

built.masterGain = masterGain;
return built;
```

**Pattern to copy — insertion point:**
```typescript
const masterGain = context.createGain();
const analyser = context.createAnalyser();
analyser.fftSize = ANALYSER_FFT_SIZE; // 2048, D-08
const now = context.currentTime;
masterGain.gain.setValueAtTime(0, now);

node.connect(masterGain);
masterGain.connect(analyser);
analyser.connect(context.destination);

built.masterGain = masterGain;
built.analyser = analyser;
return built;
```
Add `analyser: AnalyserNodeLike | null` to `BuiltWorkletGraph` (currently `context`/`node`/
`masterGain` fields only, lines ~38-42). Update `discardLocalGraph` (`built.masterGain?.disconnect();`
pattern) and `teardownGraph` (`this.masterGain?.disconnect();` pattern, near end of file) to also
disconnect `analyser` alongside `masterGain`, following the exact `X?.disconnect()` idiom already
used for `masterGain`.

**Error-handling / null-guard pattern to copy** — every existing read/write method in this file
starts with a `if (this.node === null) return;`-style guard; new `readTimeDomainInto`/
`readFrequencyInto` plain methods must follow the same convention with `if (this.analyser === null)
return;`.

**CRITICAL — breaks an existing test:** `worklet-synth-engine.spec.ts`'s `findMasterGain()` helper
(lines 77-83) identifies `masterGain` by `gain.connections.has(context.destination)`. Once
`masterGain.connect(analyser)` replaces the direct `masterGain.connect(context.destination)`, this
helper breaks for every call site (4+ locations). The plan MUST update this helper (e.g. locate the
gain connected to the new analyser instead) as an explicit task, not a side effect.

---

### `src/app/state/instrument-state.ts` (service/store, CRUD)

**Analog:** same file — `updateOperator`/`setFeedback` (lines 173-198)

**Core validate-first-then-immutable-write pattern to copy** (lines 173-188, 194-198):
```typescript
updateOperator(operatorId: OperatorId, changes: Partial<OperatorParameters>): void {
  if (!isOperatorId(operatorId)) {
    throw new RangeError(`operatorId must be one of ${OPERATOR_IDS.join(', ')}, received ${operatorId}`);
  }
  validateOperatorParameters(changes);
  const previous = this._patch();
  const previousOperatorParameters = previous.operators[operatorId];
  const { envelope: envelopeChange, ...otherChanges } = changes;
  const nextOperatorParameters: OperatorParameters = {
    ...previousOperatorParameters,
    ...otherChanges,
    envelope: envelopeChange !== undefined ? cloneEnvelope(envelopeChange) : previousOperatorParameters.envelope,
  };
  const nextOperators = { ...previous.operators, [operatorId]: nextOperatorParameters } as OperatorParameterSet;
  this._patch.set({ ...previous, operators: nextOperators });
}

setFeedback(level: number): void {
  validateFeedbackLevel(level);
  const previous = this._patch();
  this._patch.set({ ...previous, feedback: level });
}
```

**Pattern to copy for `randomize()`:** delegate the actual per-field delta/clamp math to the new
pure `domain/dx7/randomization/random-walk-patch.ts` function, then funnel every computed operator
through `validateOperatorParameters` and the feedback value through `validateFeedbackLevel` exactly
like `updateOperator`/`setFeedback` do, before a single `this._patch.set({...})` write. Must never
touch `algorithmId` (D-12) — read `previous.algorithmId` and copy it through unchanged, mirroring
`setAlgorithm`'s converse (only `algorithmId` changes there; here everything except `algorithmId`
changes).

**A/B facade already complete — no new pattern needed, only UI wiring** (lines 212-260):
```typescript
captureSnapshot(slot: SnapshotSlot): void { /* ... */ }
recallSnapshot(slot: SnapshotSlot): boolean { /* ... */ }
hasSnapshot(slot: SnapshotSlot): boolean { /* ... */ }
reset(): void { this._patch.set(DEFAULT_PATCH); }
```
`tools-panel.ts` calls these five methods directly (D-09); `hasSnapshot('a')`/`hasSnapshot('b')`
drive the disabled state described in D-10.

---

### `src/app/domain/dx7/randomization/random-walk-patch.ts` (new, utility/transform)

**Analog:** `src/app/domain/dx7/models/operator-parameters.ts` — bounds constants and
`validateOperatorParameters`/`validateBoundedIntegerTuple` (lines 60-70, 181-203, 223-236)

**Bounds-constant pattern to copy** (lines 60-70 of `operator-parameters.ts`):
```typescript
export const MIN_OUTPUT_LEVEL = 0;
export const MAX_OUTPUT_LEVEL = 99;
export const MIN_DETUNE = -7;
export const MAX_DETUNE = 7;
export const MIN_ENVELOPE_LEVEL = 0;
export const MAX_ENVELOPE_LEVEL = 99;
export const MIN_ENVELOPE_RATE = 0;
export const MAX_ENVELOPE_RATE = 99;
```
And `patch.ts` lines 30-31: `MIN_FEEDBACK_LEVEL = 0` / `MAX_FEEDBACK_LEVEL = 7`.

**Domain-purity convention to copy:** zero Angular imports (DOMAIN-04 ESLint gate) — this file must
import only from sibling `domain/dx7/models/*` files, never from `@angular/core` or `state/`.
Inject the RNG as a parameter (`rng: () => number`, default `Math.random` at the call site in
`instrument-state.ts`, not inside this pure function) so a spec can pass a deterministic sequence —
mirrors this codebase's "no hidden global reads" posture (no `Math.random` usage exists anywhere
else in `src/app` per RESEARCH.md).

**Recommended shape:**
```typescript
export function randomWalkInteger(
  current: number, min: number, max: number, deltaFraction: number, rng: () => number,
): number {
  const range = max - min;
  const delta = Math.round((rng() * 2 - 1) * deltaFraction * range);
  return Math.min(max, Math.max(min, current + delta));
}
```
`ratio` must walk the `COARSE_RATIOS` array *index* (not the value) and snap back via
`COARSE_RATIOS[index]` — never interpolate a value absent from that frozen list, since
`isCoarseRatio`/`validateOperatorParameters`'s `ratio` branch rejects anything not in
`COARSE_RATIOS`. `fixedFrequencyHz` has no domain-declared upper bound (confirmed:
`operator-parameters.ts` validates only `> 0` and finite) — this file must define its own
phase-local constant (RESEARCH.md recommends 20–8000 Hz) rather than inventing a new domain-wide
bound. `mode` and `enabled` are excluded from the walk entirely (A1) — never write these two
fields.

**Every output field must still pass through `validateOperatorParameters`/`validateFeedbackLevel`**
at the `InstrumentState.randomize()` call site — this pure function computing in-range values is a
design intent, not a substitute for that validation gate.

---

### `src/app/features/playground/visualizer/visualizer.ts` (new component, streaming)

**Analog:** `src/app/features/play-surface/play-surface.ts` (component shell shape) — **no exact
data-flow analog exists**; this is confirmed the first `viewChild`/`afterNextRender` usage in the
repo.

**Component shell pattern to copy** (lines 1-45 of `play-surface.ts`):
```typescript
import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef,
  computed, inject, output, signal,
} from '@angular/core';
import { SYNTH_ENGINE } from '../../core/audio/synth-engine.token';

@Component({
  selector: 'app-play-surface',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './play-surface.html',
  styleUrl: './play-surface.scss',
  host: { /* ... */ },
})
export class PlaySurface {
  private readonly engine = inject(SYNTH_ENGINE);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly changeDetector = inject(ChangeDetectorRef);
  protected readonly status = this.engine.status;
  // ...
}
```

**Pattern to copy:** `inject(SYNTH_ENGINE)` for the engine handle (same DI token as `PlaySurface`),
read `this.engine.status` for the suspended/unavailable/error gating D-04 requires (render
flat/silent, no crash — reuse the exact status signal `PlaySurface` already reads rather than
re-deriving it). New pattern (no in-repo analog, must be introduced per RESEARCH.md Pattern 4):
`viewChild.required<ElementRef<HTMLCanvasElement>>('oscilloscope')` /
`viewChild.required<ElementRef<HTMLCanvasElement>>('spectrum')`, `afterNextRender(() => {...})` to
start the RAF loop once after first render, `inject(DestroyRef).onDestroy(() =>
cancelAnimationFrame(...))` for cleanup — this last piece *does* mirror an existing convention
(`WorkletSynthEngine`'s `destroy()`/`DestroyRef` usage and `MotionPreference`'s cleanup pattern),
even though the RAF-specific wiring is new. **Never** wrap `readTimeDomainInto`/`readFrequencyInto`
calls in a `signal`/`computed` — read into a pre-allocated `Uint8Array` inside the RAF callback and
draw directly with the 2D context, per D-03 and CLAUDE.md's "never store AudioNodes in signal
state."

---

### `src/app/features/playground/tools-panel/tools-panel.ts` (new component, request-response)

**Analog:** `src/app/features/play-surface/play-surface.ts` (component shell shape + `inject`
convention)

**Pattern to copy:** `inject(InstrumentState)` directly (no new service needed — `InstrumentState`
is already `providedIn: 'root'`), five template-bound button handlers calling
`captureSnapshot('a')`/`captureSnapshot('b')`/`recallSnapshot('a')`/`recallSnapshot('b')`/`reset()`
plus one `randomize()` call, each a direct 1:1 method call per D-09/D-14/D-15 — no new state,
component-local, or derived signals beyond what's needed to read `hasSnapshot('a')`/`hasSnapshot('b')`
for the D-10 disabled-state text (e.g. `computed(() => this.state.hasSnapshot('a'))`).
`ChangeDetectionStrategy.OnPush` throughout, matching every other component in this codebase.

---

### `src/app/features/playground/playground.ts` / `playground.html` (extend, request-response)

**Analog:** same file — existing `PlaySurface` embedding

**Current pattern** (verbatim, lines 1-27 of `playground.ts` and full `playground.html`):
```typescript
@Component({
  selector: 'app-playground',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaySurface],
  templateUrl: './playground.html',
  styleUrl: './playground.scss',
})
export class Playground {
  protected readonly comingSoon: readonly string[] = [
    'Full 32-algorithm selector with live routing diagram',
    'Six operator strips: ratio, level, detune, envelope',
    'Oscilloscope and spectrum display',
    'A/B snapshot compare and constrained randomization',
  ];
}
```
```html
<app-play-surface />
<h2>Coming in later phases</h2>
<ul class="feature-list">
  @for (item of comingSoon; track item) { <li>{{ item }}</li> }
</ul>
```

**Pattern to copy:** add `Visualizer` and `ToolsPanel` to the `imports` array exactly like
`PlaySurface` is imported today, embed `<app-visualizer />` and `<app-tools-panel />` in
`playground.html` below `<app-play-surface />` per D-04, and remove exactly the two `comingSoon`
strings ("Oscilloscope and spectrum display", "A/B snapshot compare and constrained randomization")
from the array — leave the other two entries (algorithm selector, operator strips) untouched since
those remain future-phase work.

## Shared Patterns

### Minimal `*Like` Web Audio surface extension (D-02)
**Source:** `src/app/core/audio/audio-context.token.ts` (`GainNodeLike`/`DelayNodeLike`), fake
counterpart in `src/app/core/audio/testing/fake-audio-context.ts`
**Apply to:** `AnalyserNodeLike` interface, `FakeAnalyserNode` class
```typescript
export interface DelayNodeLike extends AudioNodeLike {
  readonly delayTime: AudioParamLike;
}
// AudioContextLike.createDelay(maxDelayTime?: number): DelayNodeLike;
```
Never expose more of the real DOM interface than the app needs (no `minDecibels`/`maxDecibels`/
`smoothingTimeConstant` unless a task specifically needs to tune them per RESEARCH.md Assumption A3).

### Validate-first-then-immutable-write command (D-14)
**Source:** `src/app/state/instrument-state.ts`, `updateOperator`/`setFeedback` (lines 173-198)
**Apply to:** `InstrumentState.randomize()`
```typescript
validateOperatorParameters(changes); // or validateFeedbackLevel(level)
const previous = this._patch();
// ...build next immutable value...
this._patch.set({ ...previous, /* changed fields */ });
```

### Null-guard-before-read on optional engine fields
**Source:** `src/app/core/audio/worklet-synth-engine.ts` — every method already guards on
`this.node === null` before acting
**Apply to:** new `readTimeDomainInto`/`readFrequencyInto` methods, guarding on
`this.analyser === null`

### `X?.disconnect()` teardown idiom
**Source:** `src/app/core/audio/worklet-synth-engine.ts`, `discardLocalGraph`/`teardownGraph`
(`built.masterGain?.disconnect();` / `this.masterGain?.disconnect();`)
**Apply to:** analyser cleanup in both teardown paths, added alongside the existing `masterGain`
disconnect call

### `RangeError` with named field + received value
**Source:** `src/app/domain/dx7/models/operator-parameters.ts` (`validateOperatorParameters`,
`validateBoundedIntegerTuple`), `src/app/domain/dx7/models/patch.ts` (`validateFeedbackLevel`)
**Apply to:** any new validation surface the random-walk function's output must pass through (it
reuses these exact existing validators rather than writing new ones)

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/app/features/playground/visualizer/visualizer.ts` RAF/`viewChild`/`afterNextRender` lifecycle wiring specifically | component | streaming | Confirmed by RESEARCH.md: zero existing usages of `viewChild`/`ElementRef` template refs/`afterNextRender`/`afterRenderEffect` anywhere under `src/app` — this is the first canvas/native-DOM-owning component in the repo. Use RESEARCH.md's Pattern 4 code example directly as the primary reference; `PlaySurface` only supplies the surrounding component-shell/DI/cleanup conventions, not the RAF-specific mechanics. |
| Log-frequency bucketing math (`binIndexForHz`, `barEdgesHz`) | utility (pure function, likely `features/playground/visualizer/` or a small domain helper) | transform | No existing code in this repo does frequency-axis bucketing of any kind (first spectrum/FFT-adjacent feature). Use RESEARCH.md Pattern 3's formulas directly — they are original derivations from the `AnalyserNode`/MDN spec, not adapted from an in-repo analog. |

## Metadata

**Analog search scope:** `src/app/core/audio/`, `src/app/state/`, `src/app/domain/dx7/models/`,
`src/app/domain/dx7/dsp/`, `src/app/features/playground/`, `src/app/features/play-surface/`
**Files scanned:** `audio-context.token.ts`, `worklet-synth-engine.ts` (+ `.spec.ts`),
`fake-audio-context.ts`, `instrument-state.ts`, `operator-parameters.ts`, `patch.ts`,
`playground.ts`/`.html`, `play-surface.ts`
**Pattern extraction date:** 2026-08-17
