# Phase 9: DX7-style envelopes and parameter mapping - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 11 (2 new, 9 modified)
**Analogs found:** 11 / 11 (all modified files are their own analog — extend in place; new files map to closest existing sibling)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/domain/dx7/dsp/envelope-generator.ts` (NEW) | model/service (pure DSP state machine) | streaming (per-sample block render) | `src/app/domain/dx7/dsp/operator.ts` | exact (same role: pure, allocation-free, per-sample instance-field kernel class) |
| `src/app/domain/dx7/dsp/envelope-generator.spec.ts` (NEW) | test | transform (state-machine assertions) | `src/app/domain/dx7/dsp/operator.spec.ts` | exact |
| `src/app/domain/dx7/models/operator-parameters.ts` | model | CRUD (field widen + validation) | itself (extend `envelopeLevel` → `envelope: Dx7Envelope`) | exact — in-place widen, docstring already anticipates this |
| `src/app/domain/dx7/models/operator-parameters.spec.ts` | test | CRUD | itself | exact |
| `src/app/domain/dx7/dsp/graph-router.ts` | service (kernel orchestrator) | streaming (per-block render) | itself; `operator.ts`'s `renderWithFeedback` for per-sample-safe patterns | exact — extend `render()`/`recomputeDerivedValues()`, add `envelopesById`, add `setGate` |
| `src/app/domain/dx7/dsp/graph-router.spec.ts` | test | streaming | itself | exact |
| `src/app/domain/dx7/dsp/worklet-messages.ts` | model/middleware (validation choke point) | request-response (message parse) | itself — extend union + `parseWorkletMessage` with new `setGate` kind | exact |
| `src/app/domain/dx7/dsp/worklet-messages.spec.ts` | test | request-response | itself | exact |
| `src/app/core/audio/worklet-synth-engine.ts` | service (browser adapter) | event-driven (note on/off → postMessage) | itself — remove `voiceGain`/`WORKLET_ATTACK_SECONDS`/`WORKLET_RELEASE_TIME_CONSTANT`, post `setGateMessage` instead | exact |
| `src/app/domain/dx7/lessons/try-this.ts`, `lesson-definition.ts` (+ specs) | model/config | transform (field union + label map) | itself | exact — add `'envelope'` to `Exclude<...>` list |
| `worklets/dx7-worklet-processor.ts` | route/controller (worklet message dispatcher) | event-driven | itself — add `setGate` case to `handleMessage` | exact |
| `src/app/domain/dx7/models/patch.ts` (`DEFAULT_PATCH`) | model/config | CRUD | itself | exact — no structural change, just reads the widened field via `DEFAULT_OPERATOR_PARAMETERS` |

## Pattern Assignments

### `src/app/domain/dx7/dsp/envelope-generator.ts` (NEW — model, streaming)

**Analog:** `src/app/domain/dx7/dsp/operator.ts` (`PhaseModulatedOperator`)

**File header / purity framing** (operator.ts lines 1-15):
```typescript
/**
 * Pure phase-modulation operator kernel (Phase 7, D-03/D-05 from
 * `07-CONTEXT.md`; ENGINE-01). Zero Angular imports, enforced by the
 * domain-purity ESLint gate (DOMAIN-04) — every formula here is
 * independently unit-testable in Node with no browser, no `AudioContext`,
 * and no jsdom Web Audio surface. This is the one primitive every operator
 * instance ... is built from.
 *
 * This is an original phase-modulation implementation built toward
 * DX7-style behaviour, written from first principles ... never a
 * transcription of, or derived from, any DX7/Dexed source. It must never
 * be described as an exact DX7 emulation.
 */
```
Copy this exact framing for `EnvelopeGenerator`'s header — same DOMAIN-04 zero-Angular-imports claim, same "original implementation, never an exact DX7 emulation" language (matches CLAUDE.md licensing rules and RESEARCH.md's explicit non-transcription requirement for MSFA/tlbflush sources).

**Instance-field, no-allocation, per-sample loop pattern** (operator.ts lines 47-69, 98-106, 132-144):
```typescript
export class PhaseModulatedOperator {
  private sampleRate: number;
  private frequencyHz: number;
  private phase = 0;
  private previousSample = 0;

  constructor(sampleRate: number, frequencyHz: number) {
    validateSampleRate(sampleRate);
    validateFrequencyHz(frequencyHz);
    this.sampleRate = sampleRate;
    this.frequencyHz = frequencyHz;
  }

  render(output: Float32Array, modulationInput?: Float32Array): void {
    const increment = this.frequencyHz / this.sampleRate;
    for (let i = 0; i < output.length; i++) {
      const rawModulation = modulationInput ? modulationInput[i] : 0;
      const modulation = Number.isFinite(rawModulation) ? rawModulation : 0;
      output[i] = Math.sin(TWO_PI * this.phase + modulation);
      this.phase = (this.phase + increment) % 1;
    }
  }
}
```
`EnvelopeGenerator` must follow this exact shape: private mutable instance fields (`segmentIndex`, `currentLevel`, `held`), a validated constructor (mirror `validateSampleRate`), and a `render(output: Float32Array): void` method that loops `for (let i = 0; i < output.length; i++)` advancing `currentLevel` and checking target-reached **per sample** (RESEARCH.md Pitfall 4 — never once per block), writing `outputLevelToAmplitude(currentLevel)` into `output[i]`. Never allocates inside the loop.

**`resetPhase`-style reset pattern to mirror for `gateOn`/`gateOff`** (operator.ts lines 77-86):
```typescript
resetPhase(): void {
  this.phase = 0;
  this.previousSample = 0;
}
```
`gateOn()`/`gateOff()` follow this same "small, explicit state-transition method" shape — but per D-04/A8, they must NOT reset `currentLevel`, only `segmentIndex`/`held` (documented explicitly as a deliberate divergence from this reset pattern — see RESEARCH.md Anti-Patterns).

**Validation helper pattern** (operator.ts lines 27-37):
```typescript
function validateSampleRate(sampleRate: number): void {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`sampleRate must be a finite, positive number, received ${sampleRate}`);
  }
}
```
Mirror this exact `RangeError`-with-interpolated-received-value convention for any constructor-time validation the `EnvelopeGenerator` needs.

---

### `src/app/domain/dx7/dsp/envelope-generator.spec.ts` (NEW — test)

**Analog:** `src/app/domain/dx7/dsp/operator.spec.ts`

Not read in full this session (RESEARCH.md already cites it), but RESEARCH.md's Validation Architecture confirms its existing precedent: `toBeCloseTo(expected, 6)` for amplitude-value assertions (6 decimal places, float32-precision-appropriate) — reuse this exact tolerance for envelope *amplitude* output. For segment-*timing* assertions (samples until a segment completes), use exact integer equality instead (RESEARCH.md Open Question 2's explicit recommendation), since Pattern 2's linear-ramp-at-computed-speed model gives closed-form exact sample counts.

---

### `src/app/domain/dx7/models/operator-parameters.ts` (model, CRUD — in-place widen)

**Analog:** itself — this is a type change on one field per its own docstring (line 17-20 quoted below), not a new pattern to import from elsewhere.

**Field to widen** (lines 39-41, 48-49, 72-80):
```typescript
export interface OperatorParameters {
  ...
  readonly outputLevel: number;
  readonly envelopeLevel: number;   // → readonly envelope: Dx7Envelope;
}

export const MIN_ENVELOPE_LEVEL = 0;
export const MAX_ENVELOPE_LEVEL = 99;

export const DEFAULT_OPERATOR_PARAMETERS: OperatorParameters = Object.freeze({
  enabled: true,
  mode: 'ratio',
  ratio: 1.0,
  fixedFrequencyHz: 440,
  detune: 0,
  outputLevel: 50,
  envelopeLevel: 99,   // → envelope: DEFAULT_ENVELOPE (per D-06, identical across all 6 operators)
});
```

**Validation block to widen** (lines 114-126):
```typescript
if ('envelopeLevel' in changes) {
  const envelopeLevel = changes.envelopeLevel;
  if (
    envelopeLevel === undefined ||
    !Number.isInteger(envelopeLevel) ||
    envelopeLevel < MIN_ENVELOPE_LEVEL ||
    envelopeLevel > MAX_ENVELOPE_LEVEL
  ) {
    throw new RangeError(
      `envelopeLevel must be an integer in ${MIN_ENVELOPE_LEVEL}..${MAX_ENVELOPE_LEVEL}, received ${envelopeLevel}`,
    );
  }
}
```
Replace with a structural check over `changes.envelope.rates`/`.levels` — each of the 8 values must independently satisfy the same `Number.isInteger(...) && value >= MIN_ENVELOPE_LEVEL && value <= MAX_ENVELOPE_LEVEL` bounds, using the exact same `'field' in changes` presence-check convention (not `!== undefined`) documented in the surrounding docstring (lines 82-97) — this is load-bearing for partial `updateOperator` edits.

---

### `src/app/domain/dx7/dsp/graph-router.ts` (service, streaming — extend)

**Analog:** itself; per-sample-safe technique from `operator.ts`'s `renderWithFeedback`.

**Parallel per-operator table pattern to mirror for `envelopesById`** (graph-router.ts lines 108-141):
```typescript
private readonly operatorsById: readonly PhaseModulatedOperator[];
private readonly operatorBlocks: readonly Float32Array[];
...
constructor(sampleRate: number, blockSize: number) {
  ...
  const operators: PhaseModulatedOperator[] = [];
  const blocks: Float32Array[] = [];
  for (let index = 0; index < OPERATOR_TABLE_LENGTH; index++) {
    operators.push(new PhaseModulatedOperator(sampleRate, 0));
    blocks.push(new Float32Array(blockSize));
  }
  this.operatorsById = operators;
  this.operatorBlocks = blocks;
  this.modulationAccumulator = new Float32Array(blockSize);
}
```
Add a parallel `envelopesById: readonly EnvelopeGenerator[]` array constructed the same way (one `EnvelopeGenerator` per operator index, all allocation happening once in the constructor), plus a reusable `envelopeScratchBlock: Float32Array` scratch buffer mirroring `modulationAccumulator`'s "allocated once, `.fill`/overwritten every render call" convention.

**Where to apply envelope in `render()`** (graph-router.ts lines 248-284, specifically 269-275):
```typescript
const block = this.operatorBlocks[id]!;
if (id === this.feedbackOperatorId) {
  this.operatorsById[id]!.renderWithFeedback(block, this.feedbackIndexValue, this.modulationAccumulator);
} else {
  this.operatorsById[id]!.render(block, this.modulationAccumulator);
}
// INSERT HERE (per RESEARCH.md Pattern 3): envelopesById[id].render(envelopeScratchBlock);
//   then block[i] *= envelopeScratchBlock[i] for all i — strictly AFTER operator.render/
//   renderWithFeedback returns, so the feedback delay line's own previousSample (read
//   INSIDE renderWithFeedback) stays raw/unscaled per Phase 8's D-06/D-07 "feedback is not
//   tamed anywhere in this kernel" stance.
```

**`recomputeDerivedValues` dual-table pattern — envelope must NOT be folded in here** (graph-router.ts lines 196-222, specifically 204 and 213-215):
```typescript
this.carrierAmplitudeTable[id] = outputLevelToAmplitude(parameters.outputLevel) * enabledMultiplier;
...
this.modulationIndexTable[id] = frequencyIsUsable
  ? (outputLevelToModulationDepthHz(parameters.outputLevel, frequencyHz) / frequencyHz) * enabledMultiplier
  : 0;
```
Both tables are computed once per parameter change, not per sample. Per RESEARCH.md Pattern 3/Pitfall 3 (highest-impact pitfall in this phase): envelope is a **third, dynamic, per-sample multiplier** applied in `render()` directly to `block[i]` — it must never be folded into either of these two static tables, or a modulator's envelope becomes silently inaudible (since only `carrierAmplitudeTable` is read at final carrier summing; `modulationIndexTable` is what modulators' amplitude changes must actually reach).

**Setter pattern to add `setGate`** (graph-router.ts lines 160-173):
```typescript
setOperatorParameters(operators: OperatorParameterSet): void {
  this.operatorParametersValue = operators;
  this.recomputeDerivedValues();
}

setFeedbackLevel(level: number): void {
  this.feedbackLevel = level;
  this.recomputeDerivedValues();
}
```
Add `setGate(open: boolean, velocity: number): void` on the same one-responsibility setter shape, with a single integer MIDI velocity contract from `MIN_VELOCITY` through `MAX_VELOCITY`. Validate and convert that velocity once (`velocityToAmplitude`) before applying the amplitude to every `envelopesById` entry; store the converted amplitude as the output-stage multiplier (mirroring `MASTER_GAIN`'s existing per-sample multiply at line 287 — see Pitfall 2 in RESEARCH.md). Preserve the stored amplitude when closing the gate — `gateOff()` does not overwrite it. Close-gate messages use `setGateMessage(false, MIN_VELOCITY)`, never a raw `0`. Do not take a pre-converted `velocityAmplitude` argument or offer a raw-versus-converted alternative at this boundary.

---

### `src/app/domain/dx7/dsp/worklet-messages.ts` (middleware/model, request-response — extend)

**Analog:** itself — extend the existing narrow-and-reject-malformed choke point with one new message kind.

**Message interface + union pattern** (lines 53-94):
```typescript
export interface SetFeedbackMessage {
  readonly kind: 'setFeedback';
  readonly level: number;
}

export type WorkletMessage =
  | SetFrequencyMessage
  | SetModeMessage
  | SetAlgorithmMessage
  | SetOperatorParametersMessage
  | SetFeedbackMessage;
```
Add `SetGateMessage { readonly kind: 'setGate'; readonly open: boolean; readonly velocity: number }` (or velocity pre-converted to amplitude — planner's discretion per A6) to this union, plus a `setGateMessage(open, velocity)` constructor function mirroring `setFeedbackMessage` (line 115-117):
```typescript
export function setFeedbackMessage(level: number): SetFeedbackMessage {
  return { kind: 'setFeedback', level };
}
```

**Validator branch pattern to add** (lines 233-273, specifically the `setFeedback` branch at 264-266):
```typescript
if (kind === 'setFeedback') {
  const level = (data as { level?: unknown }).level;
  return isValidFeedbackLevel(level) ? setFeedbackMessage(level) : null;
}
```
Add an identical `if (kind === 'setGate') { ... }` branch validating `open: boolean` and `velocity: number` (finite, in range) via a new `isValidGatePayload`-style guard function mirroring `isValidFeedbackLevel` (lines 217-224) — never throw, return `null` on any malformed shape, same as every existing branch.

**`isValidOperatorParametersEntry` widen** (lines 166-199) — the `envelopeLevel` checks (176, 194-197) must be replaced with structural validation of the new `envelope.rates`/`envelope.levels` 4-tuples, reusing imported `MIN_ENVELOPE_LEVEL`/`MAX_ENVELOPE_LEVEL` constants exactly as today (never re-declared as literals — this file already imports these from `operator-parameters.ts` specifically so the two validators cannot drift).

---

### `src/app/core/audio/worklet-synth-engine.ts` (service, event-driven — remove ramp, add gate message)

**Analog:** itself — this file's own doc comment already names "Phase 9 (ENGINE-03)" as the phase that replaces `envelopeLevel`.

**`voiceGain`/ramp code to remove (D-02)** (lines 55-65, 403-420, 425-449, 451-464 — quoted key excerpts):
```typescript
export const WORKLET_ATTACK_SECONDS = 0.015;
export const WORKLET_RELEASE_TIME_CONSTANT = 0.015;
const WORKLET_RELEASE_TIME_CONSTANT_COUNT = 5;
export const WORKLET_RELEASE_SECONDS = WORKLET_RELEASE_TIME_CONSTANT * WORKLET_RELEASE_TIME_CONSTANT_COUNT;
...
noteOn(note: number, velocity: number): void {
  validateNote(note);
  validateVelocity(velocity);
  if (this.context === null || this.node === null || this.voiceGain === null) {
    return;
  }
  const now = this.context.currentTime;
  const frequencyHz = midiNoteToFrequency(note);
  const targetLevel = velocityToAmplitude(velocity);

  this.node.port.postMessage(setFrequencyMessage(frequencyHz));
  this.heldNote = note;

  this.voiceGain.gain.cancelAndHoldAtTime(now);
  this.voiceGain.gain.linearRampToValueAtTime(targetLevel, now + WORKLET_ATTACK_SECONDS);
}

private releaseVoice(): void {
  if (this.context === null || this.voiceGain === null) {
    return;
  }
  const now = this.context.currentTime;
  this.voiceGain.gain.cancelAndHoldAtTime(now);
  this.voiceGain.gain.setTargetAtTime(0, now, WORKLET_RELEASE_TIME_CONSTANT);
  this.voiceGain.gain.setValueAtTime(0, now + WORKLET_RELEASE_SECONDS);
}
```
Per Pitfall 2 (RESEARCH.md): do not simply delete `targetLevel = velocityToAmplitude(velocity)` — relocate it into the new `setGateMessage(open, velocity)` payload posted alongside/instead of `setFrequencyMessage`. `noteOn` becomes:
```typescript
noteOn(note: number, velocity: number): void {
  validateNote(note);
  validateVelocity(velocity);
  if (this.context === null || this.node === null) { return; }
  const frequencyHz = midiNoteToFrequency(note);
  this.node.port.postMessage(setFrequencyMessage(frequencyHz));
  this.node.port.postMessage(setGateMessage(true, velocity));
  this.heldNote = note;
}
```
`releaseVoice()` becomes a `this.node.port.postMessage(setGateMessage(false, 0))` call — no `AudioParam` scheduling at all, since click-safety now lives entirely inside the kernel's per-operator EG release segment (D-04). Also remove the `voiceGain: GainNodeLike | null` field, its construction in `buildAndStart` (lines ~281-296), and its disconnect calls in `teardownGraph`/`destroy` (lines 310, 460-464, 485, 489) — all in-scope per RESEARCH.md's "blast radius" list.

---

### `worklets/dx7-worklet-processor.ts` (route/controller — extend `handleMessage`)

**Analog:** itself — not read in full this session, but RESEARCH.md's System Architecture Diagram and Pitfall 1 confirm the exact insertion point: the `handleMessage` dispatcher that currently forwards `setFrequency`/`setMode`/`setAlgorithm`/`setOperatorParameters`/`setFeedback` to `GraphRouter`'s matching setters needs one more `case 'setGate':` branch calling `this.router.setGate(message.open, message.velocity)`.

---

### `src/app/domain/dx7/lessons/lesson-definition.ts` (model/config — extend exclusion list)

**Analog:** itself.

**Pattern to extend** (per RESEARCH.md Open Question 1, quoted from file read this session):
```typescript
export type TryThisParam = Exclude<keyof OperatorParameters, 'enabled' | 'mode' | 'fixedFrequencyHz'>;
```
Add `'envelope'` to this `Exclude<...>` union — same reasoning already applied to `enabled`/`mode`/`fixedFrequencyHz`: a whole-object field has no meaningful increase/decrease direction for the `try-this` increment/decrement UI. `TRY_THIS_PARAM_LABELS`'s field-label map needs no new entry once `'envelope'` is excluded from `TryThisParam`.

## Shared Patterns

### Zero-allocation, per-sample, instance-field render loop
**Source:** `src/app/domain/dx7/dsp/operator.ts` lines 47-69, 98-106, 132-144
**Apply to:** `envelope-generator.ts` (new), `graph-router.ts`'s `render()` extension
```typescript
// One persistent instance field per piece of mutable state; validated constructor;
// render(output: Float32Array): void loops per-sample, never allocates, guards
// non-finite inputs with Number.isFinite(...) ? value : 0.
```

### Narrow-and-reject-malformed worklet message validation
**Source:** `src/app/domain/dx7/dsp/worklet-messages.ts` lines 226-273
**Apply to:** New `setGate` message kind — single `parseWorkletMessage` choke point, never throw, return `null` on any malformed shape, wrap entire body in `try`/`catch`.

### Squared-normalized DX7-scale → amplitude curve
**Source:** `src/app/domain/dx7/audio/value-conversion.ts` lines 67-77 (`outputLevelToAmplitude`)
**Apply to:** `EnvelopeGenerator.render()`'s `currentLevel` (0-99 DX7 scale) → amplitude conversion — reuse this exact function, do not write a second curve (Don't Hand-Roll table, RESEARCH.md).
```typescript
export function outputLevelToAmplitude(outputLevel: number): number {
  const normalized = (outputLevel - MIN_OUTPUT_LEVEL) / OUTPUT_LEVEL_RANGE;
  return Math.pow(normalized, OUTPUT_LEVEL_CURVE_EXPONENT);
}
```

### Presence-checked (`'field' in changes`) partial-update validation
**Source:** `src/app/domain/dx7/models/operator-parameters.ts` lines 99-169 (`validateOperatorParameters`)
**Apply to:** The widened `envelope` field's validation block — same `'envelope' in changes` presence check (not `!== undefined`), same `RangeError` with interpolated received-value message.

### Setter → `recomputeDerivedValues()` cadence
**Source:** `src/app/domain/dx7/dsp/graph-router.ts` lines 160-173
**Apply to:** Any new `GraphRouter` setter — but note `setGate` is the one exception: it does NOT call `recomputeDerivedValues()` (that method is for discrete parameter/routing changes only, per Anti-Patterns — envelope advance happens inside `render()`'s per-sample loop, not as a cached derived value).

## No Analog Found

None. Every file in this phase's scope either has a direct in-place analog (the 9 modified files extend their own existing conventions) or a strong structural analog for the 2 new files (`operator.ts` for `envelope-generator.ts` and its spec).

## Metadata

**Analog search scope:** `src/app/domain/dx7/dsp/`, `src/app/domain/dx7/models/`, `src/app/domain/dx7/audio/`, `src/app/domain/dx7/lessons/`, `src/app/core/audio/`, `worklets/`
**Files scanned:** 7 read in full this session (`operator.ts`, `operator-parameters.ts`, `graph-router.ts`, `worklet-messages.ts`, `value-conversion.ts`, `worklet-synth-engine.ts` excerpt), plus RESEARCH.md's own already-cited reads of `patch.ts`, `dx7-worklet-processor.ts`, `lesson-definition.ts`, `try-this.ts` (not re-read here — RESEARCH.md's excerpts were sufficiently concrete and citing them again would duplicate ranges already in context via RESEARCH.md)
**Pattern extraction date:** 2026-08-14
