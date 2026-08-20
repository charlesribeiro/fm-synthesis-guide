# Phase 8: Algorithm routing and feedback - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 14 (5 new, 7 modified, 2 read-only)
**Analogs found:** 14 / 14 (all in-repo — this phase extends Phase 5/7 modules directly, so every
new file has a same-repo sibling to copy shape from; no external-reference fallback needed)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/app/domain/dx7/dsp/graph-router.ts` (NEW) | service (pure DSP kernel) | transform (per-sample render) | `src/app/domain/dx7/dsp/additive-fixture.ts` | exact — same "N persistent `PhaseModulatedOperator`s + pre-allocated scratch, sum into output" shape |
| `src/app/domain/dx7/dsp/graph-router.spec.ts` (NEW) | test | transform | `src/app/domain/dx7/dsp/additive-fixture.ts` (paired spec, not read but same convention) / `operator.ts`'s own doc-referenced spec pattern | role-match |
| `src/app/domain/dx7/dsp/reference-evaluator.ts` (NEW) | service (pure, test-only reference impl) | transform | `src/app/domain/dx7/models/derive-role.ts` (recursive/functional pure-derivation style) | role-match — independent-implementation constraint means it must NOT mirror graph-router.ts itself |
| `src/app/domain/dx7/dsp/reference-evaluator.spec.ts` (NEW) | test | transform | `src/app/domain/dx7/dsp/operator.spec.ts` (analytical self-tests / finiteness idiom) | role-match |
| `src/app/domain/dx7/dsp/algorithm-routing.spec.ts` (NEW) | test | batch (32-row cross-check) | none existing (new cross-check shape) — model on Vitest conventions in `operator.ts`'s finite/NaN test idiom (per RESEARCH "Don't Hand-Roll" table) | no analog — see below |
| `src/app/domain/dx7/dsp/operator.ts` (EXTEND) | service (DSP kernel primitive) | transform | itself (existing `render()` method is the pattern `renderWithFeedback()` must match) | exact |
| `src/app/domain/dx7/dsp/worklet-messages.ts` (EXTEND) | utility (message contract / validation) | request-response (postMessage protocol) | itself — extend existing `SetFrequencyMessage`/`parseWorkletMessage` shape | exact |
| `worklets/dx7-worklet-processor.ts` (EXTEND) | controller (AudioWorkletProcessor adapter) | streaming (per-quantum render) | itself — existing `handleMessage`/`process()` shape | exact |
| `src/app/core/audio/worklet-synth-engine.ts` (EXTEND) | service (Angular DI facade over Web Audio) | event-driven (signal-effect-driven) | `src/app/core/audio/web-audio-synth-engine.ts` | exact — this phase's stated job is to give `WorkletSynthEngine` the same `effect()`/`applyRouting` shape `WebAudioSynthEngine` already has |
| `src/app/core/audio/worklet-synth-engine.spec.ts` (EXTEND) | test | event-driven | `src/app/core/audio/web-audio-synth-engine.ts`'s paired spec (not read, but same fixture/fake-node convention implied) | role-match |
| `src/app/core/audio/synth-engine.token.ts` (EDIT) | config (DI token factory) | request-response | itself — one-line factory swap | exact |
| `worklets/harness/harness-main.ts` (EXTEND) | controller (cross-layer integration; dev-only) | event-driven | `src/app/core/audio/worklet-synth-engine.ts` (same `ALGORITHMS` / `DEFAULT_PATCH` / `buildRoutingConfig` / routed worklet-message / live held-note update path, isolated from Angular) | role-match — not additive UI-only |
| `src/app/domain/dx7/models/patch.ts` (READ-ONLY reuse) | model | CRUD/validation | n/a — `validateFeedbackLevel` reused as-is, not modified | n/a |
| `src/app/domain/dx7/audio/value-conversion.ts` (READ-ONLY reuse) | utility (pure conversions) | transform | n/a — `operatorFrequencyHz`/`outputLevelToAmplitude`/`outputLevelToModulationDepthHz`/`feedbackLevelToDepthHz` reused as-is | n/a |

## Pattern Assignments

### `src/app/domain/dx7/dsp/graph-router.ts` (service, transform) — NEW

**Analog:** `src/app/domain/dx7/dsp/additive-fixture.ts` (full file, 120 lines — read in full, small file)

**Header/purity doc-comment pattern** (lines 1-14):
```typescript
/**
 * Synthetic six-operator additive fixture (Phase 7, D-04 from
 * `07-CONTEXT.md`; ENGINE-01). Zero Angular imports, enforced by the
 * domain-purity ESLint gate (DOMAIN-04).
 * ...
 */
import { PhaseModulatedOperator } from './operator';
```
Graph-router must carry the same "zero Angular imports, DOMAIN-04" doc-comment convention, plus a
statement it is the first module allowed to import `algorithms.ts`/`derive-role.ts` (per RESEARCH
Architectural note — `additive-fixture.ts`'s header explicitly documents why it does NOT do this,
which graph-router's header should mirror-and-invert).

**Pre-allocated scratch buffer + constructor validation pattern** (lines 42-67):
```typescript
export class AdditiveOperatorBank {
  private readonly blockSize: number;
  private readonly operators: readonly PhaseModulatedOperator[];
  private readonly frequencyMultipliers: readonly number[];
  /** Allocated once here — `render` never allocates (CLAUDE.md's audio rule). */
  private readonly scratch: Float32Array;

  constructor(
    sampleRate: number,
    blockSize: number,
    frequencies: readonly number[] = ADDITIVE_FIXTURE_FREQUENCIES_HZ,
  ) {
    if (frequencies.length !== ADDITIVE_FIXTURE_HARMONIC_MULTIPLIERS.length) {
      throw new RangeError(...);
    }
    validateBlockSize(blockSize);
    this.blockSize = blockSize;
    this.frequencyMultipliers = deriveFrequencyMultipliers(frequencies);
    this.operators = frequencies.map((frequencyHz) => new PhaseModulatedOperator(sampleRate, frequencyHz));
    this.scratch = new Float32Array(blockSize);
  }
```
`GraphRouter` follows the identical shape: six persistent `PhaseModulatedOperator`s built once in
the constructor, one scratch `Float32Array` per operator plus one shared modulation-accumulator
buffer, all allocated once — never inside `render()`.

**Accumulate-into-output render pattern** (lines 89-104):
```typescript
render(output: Float32Array): void {
  if (output.length !== this.blockSize) {
    throw new RangeError(`output.length must equal the configured block size ${this.blockSize}, received ${output.length}`);
  }
  output.fill(0);
  for (const operator of this.operators) {
    operator.render(this.scratch);
    for (let i = 0; i < output.length; i++) {
      output[i] += this.scratch[i]!;
    }
  }
}
```
`GraphRouter.render()` copies this "validate length → fill(0) → accumulate" shape, but walks
`DESCENDING_OPERATOR_IDS` instead of ascending array order, sums per-operator modulation into a
scratch buffer before each operator renders (RESEARCH Pattern 3), calls `renderWithFeedback()` for
the one feedback operator, and applies the `[-1,1]` hard clamp (D-08) as the final step — see
08-RESEARCH.md Pattern 3's full code example for the exact accumulation shape to copy.

---

### `src/app/domain/dx7/dsp/operator.ts` (service, transform) — EXTEND

**Analog:** itself (full file, 95 lines)

**Existing `render()` to mirror in shape** (lines 76-94):
```typescript
render(output: Float32Array, modulationInput?: Float32Array): void {
  const increment = this.frequencyHz / this.sampleRate;
  for (let i = 0; i < output.length; i++) {
    const rawModulation = modulationInput ? modulationInput[i] : 0;
    const modulation = Number.isFinite(rawModulation) ? rawModulation : 0;
    output[i] = Math.sin(TWO_PI * this.phase + modulation);
    this.phase = (this.phase + increment) % 1;
  }
}
```
Add `private previousSample = 0` field and a new `renderWithFeedback(output, feedbackIndex,
externalModulation?)` method with the identical per-sample loop shape (non-finite-input guard,
`Math.sin(TWO_PI * this.phase + modulation)`, `this.phase = (this.phase + increment) % 1`), plus
`this.previousSample = sample` at the end of each iteration. Also extend `resetPhase()` (lines
70-74) to reset `this.previousSample = 0` alongside `this.phase = 0` — required so an algorithm
switch reassigning which operator carries feedback never leaks stale feedback history (Common
Pitfall 4 in RESEARCH.md). See RESEARCH.md Pattern 2 for the full method body to copy.

**Validation-helper pattern to reuse for any new validated setter** (lines 27-37):
```typescript
function validateSampleRate(sampleRate: number): void {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`sampleRate must be a finite, positive number, received ${sampleRate}`);
  }
}
function validateFrequencyHz(frequencyHz: number): void {
  if (!Number.isFinite(frequencyHz) || frequencyHz < 0) {
    throw new RangeError(`frequencyHz must be a finite, non-negative number, received ${frequencyHz}`);
  }
}
```
Any new numeric input to `graph-router.ts` (feedback index, modulation index) should validate with
this exact "reject before assignment, `RangeError` with the received value interpolated" shape.

---

### `src/app/domain/dx7/dsp/worklet-messages.ts` (utility, request-response) — EXTEND

**Analog:** itself (full file, 88 lines)

**Message interface + constructor-function pattern** (lines 35-53):
```typescript
export interface SetFrequencyMessage {
  readonly kind: 'setFrequency';
  readonly frequencyHz: number;
}
export interface SetModeMessage {
  readonly kind: 'setMode';
  readonly mode: WorkletRenderMode;
}
export type WorkletMessage = SetFrequencyMessage | SetModeMessage;

export function setFrequencyMessage(frequencyHz: number): SetFrequencyMessage {
  return { kind: 'setFrequency', frequencyHz };
}
export function setModeMessage(mode: WorkletRenderMode): SetModeMessage {
  return { kind: 'setMode', mode };
}
```
New `SetAlgorithmMessage`, `SetOperatorParametersMessage`, `SetFeedbackMessage` (D-14, plus the
operator-parameters message RESEARCH.md's Summary fact 3 says is structurally required) must widen
the `WorkletMessage` union the same way, each with its own `kind` discriminant and a matching
`xMessage(...)` constructor function.

**Narrow-and-reject-null choke-point pattern** (lines 66-88):
```typescript
export function parseWorkletMessage(data: unknown): WorkletMessage | null {
  try {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return null;
    }
    const kind = (data as { kind?: unknown }).kind;
    if (kind === 'setFrequency') {
      const frequencyHz = (data as { frequencyHz?: unknown }).frequencyHz;
      return isValidFrequencyHz(frequencyHz) ? setFrequencyMessage(frequencyHz) : null;
    }
    if (kind === 'setMode') {
      const mode = (data as { mode?: unknown }).mode;
      return isWorkletRenderMode(mode) ? setModeMessage(mode) : null;
    }
    return null;
  } catch {
    return null;
  }
}
```
Every new message kind gets one more `if (kind === '...')` branch inside this same `try`/`catch`,
each validating every field with an `isValidX` type-guard before constructing the message (never a
type assertion that skips a check) — this is the single security choke point (T-07-01); no second
validator anywhere else in the processor.

---

### `worklets/dx7-worklet-processor.ts` (controller, streaming) — EXTEND

**Analog:** itself (full file, 96 lines)

**Message-dispatch pattern** (lines 56-70):
```typescript
private handleMessage(data: unknown): void {
  const message = parseWorkletMessage(data);
  if (message === null) {
    return;
  }
  if (message.kind === 'setFrequency') {
    this.frequencyHz = message.frequencyHz;
    this.operator.setFrequencyHz(message.frequencyHz);
    this.bank.setBaseFrequencyHz(message.frequencyHz);
    return;
  }
  this.mode = message.mode;
}
```
Extend with new `if (message.kind === 'setAlgorithm')` / `'setOperatorParameters'` /
`'setFeedback'` branches, each mutating only cached kernel-facing state (routing table, per-operator
params, feedback depth) — never re-deriving carrier/feedback roles locally (RESEARCH.md's named
anti-pattern).

**Render-dispatch pattern** (lines 72-93):
```typescript
process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
  const output = outputs[0];
  const channel = output[0];
  if (this.mode === 'additive') {
    if (channel.length !== this.bankBlockSize) {
      channel.fill(0);
    } else {
      this.bank.render(channel);
    }
  } else {
    this.operator.render(channel);
  }
  for (let channelIndex = 1; channelIndex < output.length; channelIndex++) {
    output[channelIndex].set(channel);
  }
  return true; // Chrome compatibility: keep the node alive regardless of spec default.
}
```
Replace the `this.operator`/`this.bank` pair with a single persistent `GraphRouter` instance
(constructed once, block-size-checked the same way — fall back to `channel.fill(0)` on an
unexpected quantum size rather than allocating), keeping the same "render then copy channel 0 into
every other output channel" tail and the same `return true` comment.

**File-header "holds zero DSP math" constraint** (lines 1-15) — extend this comment to name
`GraphRouter` alongside `PhaseModulatedOperator`/`AdditiveOperatorBank` as the imported kernel, and
keep the "never imported from `src/app/`" boundary note unchanged.

---

### `src/app/core/audio/worklet-synth-engine.ts` (service, event-driven) — EXTEND

**Analog:** `src/app/core/audio/web-audio-synth-engine.ts` (targeted reads: lines 130-330)

**Constructor `effect()` shape to add** (`web-audio-synth-engine.ts` lines 153-178, adapted):
```typescript
constructor() {
  this.destroyRef.onDestroy(() => this.destroy());

  // The one sanctioned effect() in this phase (CLAUDE.md: imperative sync
  // with an external system, never a computed() deriving graph shape).
  // Reading all three signals BEFORE the early return is load-bearing...
  effect(() => {
    this.applyInstrumentStateToWorklet();
  });
}

private applyInstrumentStateToWorklet(): void {
  const algorithm = this.instrumentState.algorithm();
  const operators = this.instrumentState.operators();
  const feedback = this.instrumentState.feedback();

  if (this.node === null) {
    return;
  }

  if (algorithm !== this.lastAppliedAlgorithm) {
    const routingConfig = buildRoutingConfig(algorithm);
    this.node.port.postMessage(setAlgorithmMessage(routingConfig.connections, routingConfig.carriers));
    this.lastAppliedAlgorithm = algorithm;
  }
  if (operators !== this.lastAppliedOperators) {
    this.node.port.postMessage(setOperatorParametersMessage(operators));
    this.lastAppliedOperators = operators;
  }
  if (feedback !== this.lastAppliedFeedback) {
    this.node.port.postMessage(setFeedbackMessage(feedback));
    this.lastAppliedFeedback = feedback;
  }
}
```
`WorkletSynthEngine` adds `inject(InstrumentState)`, a constructor `effect()`, and **independent**
reference-equality checks against `lastAppliedAlgorithm`, `lastAppliedOperators`, and
`lastAppliedFeedback` — not an all-or-nothing `hasAppliedRoutingState`/`rememberAppliedRoutingState`
guard. An algorithm change posts only `setAlgorithm` (unchanged operator/feedback snapshots are not
resent); a parameter edit posts only `setOperatorParameters` (routing is not resent); a feedback
edit posts only `setFeedback`. `planConnections` / `deriveCarriers` (via `buildRoutingConfig`) remain
the algorithm-translation path. Independent checks also keep a synchronous `setAlgorithm()` call and
the `effect()`'s flush of the same write from double-applying routing.

**`applyRouting` → postMessage translation pattern** (`web-audio-synth-engine.ts` lines 275-309,
and RESEARCH.md Pattern 4's excerpt of the target shape):
```typescript
private applyRouting(
  algorithm: AlgorithmDefinition,
  operators: OperatorParameterSet,
  feedback: number,
): void {
  if (this.voiceGain === null || this.operatorNodes === null) {
    return;
  }
  ...
  for (const connection of planConnections(algorithm)) {
    const source = operatorNodes.get(connection.from);
    const target = operatorNodes.get(connection.to);
    ...
  }
}
```
`WorkletSynthEngine`'s equivalent `applyRoutingToWorklet` posts **only the changed** message of the
three (`setAlgorithmMessage(planConnections(algorithm), deriveCarriers(algorithm))`,
`setOperatorParametersMessage(operators)`, `setFeedbackMessage(feedback)`), reusing the same
`planConnections`/`deriveCarriers` imports `web-audio-synth-engine.ts` already uses — never
re-deriving routing locally. Algorithm changes do not resend unchanged operator or feedback state;
parameter edits do not resend routing.

**No-op methods to turn real** (`worklet-synth-engine.ts` lines 285-305):
```typescript
setAlgorithm(algorithmId: AlgorithmId): void {
  validateAlgorithmId(algorithmId);
  // Phase 8 (ENGINE-02): routing across the canonical dataset is not yet
  // implemented on this engine — validated no-op, ...
}
setFeedback(level: number): void {
  validateFeedbackLevel(level);
  // Phase 8 (ENGINE-02): feedback depth is not yet wired to the kernel — validated no-op.
}
updateOperatorLevel(operatorId: OperatorId, level: number): void {
  validateOperatorId(operatorId);
  validateOperatorParameters({ outputLevel: level });
  // Phase 9 (ENGINE-03): per-operator level shaping is not yet implemented on this engine — validated no-op.
}
```
D-13/D-14 turn `setAlgorithm`/`setFeedback` into thin forward-then-reapply wrappers (matching
`web-audio-synth-engine.ts`'s own three-line pattern at its `setAlgorithm`/`setFeedback` — read
`web-audio-synth-engine.ts` lines ~420-457 for that exact "immediately re-patch, independent of
effect scheduling" wrapper shape if not already in context); D-16 makes `updateOperatorLevel` do the
same via `setOperatorParametersMessage`. Keep the existing validation calls
(`validateAlgorithmId`/`validateFeedbackLevel`/`validateOperatorId`/`validateOperatorParameters`)
unchanged — only the trailing no-op comment is replaced with real behavior.

---

### `src/app/core/audio/synth-engine.token.ts` (config, request-response) — EDIT

**Analog:** itself (full file, 16 lines)

```typescript
export const SYNTH_ENGINE = new InjectionToken<SynthEngine>('SYNTH_ENGINE', {
  providedIn: 'root',
  factory: () => inject(WebAudioSynthEngine),
});
```
D-01's cutover is a one-line change: swap the `WebAudioSynthEngine` import and `factory: () =>
inject(WorkletSynthEngine)`. Keep the file's doc comment about "the one seam every consumer
injects" — update only the concrete class name it names as the currently-wired implementation.

---

### `src/app/domain/dx7/dsp/reference-evaluator.ts` (service, transform) — NEW

**Analog:** `src/app/domain/dx7/models/derive-role.ts` (pure-function, no-class, recursive/functional
derivation style) — full file, 54 lines, already in context above.

The evaluator must be genuinely independent of `graph-router.ts` (D-10) — do not import
`planConnections`/`deriveCarriers`/`getFeedbackOperator` from `derive-role.ts`/`patch-plan.ts`
either (RESEARCH.md's explicit anti-pattern: "defeats the entire purpose of D-10"). Instead mirror
`derive-role.ts`'s *style* only — small pure exported functions reading `algorithm.edges` directly,
e.g. `isCarrier`/`modulatorsOf`/`hasSelfLoop` local helpers — see 08-RESEARCH.md's full
`evaluateAlgorithmReference` code example (already includes this exact shape) for the function to
write.

---

## Shared Patterns

### Domain purity header comment
**Source:** every file under `src/app/domain/dx7/dsp/` (`operator.ts` lines 1-15,
`additive-fixture.ts` lines 1-14)
**Apply to:** `graph-router.ts`, `reference-evaluator.ts`, and any new spec files
```typescript
/**
 * ... (Phase N, D-xx from `0N-CONTEXT.md`; REQ-ID). Zero Angular imports, enforced by the
 * domain-purity ESLint gate (DOMAIN-04) — every formula here is independently unit-testable in
 * Node with no browser, no `AudioContext`, and no jsdom Web Audio surface.
 *
 * This is an original phase-modulation implementation built toward DX7-style behaviour ...
 * never a transcription of, or derived from, any DX7/Dexed source. It must never be described
 * as an exact DX7 emulation.
 */
```

### Validated-input, never-throw-past-the-boundary
**Source:** `worklet-messages.ts`'s `parseWorkletMessage` (lines 66-88), `operator.ts`'s
`validateSampleRate`/`validateFrequencyHz` (lines 27-37)
**Apply to:** every new worklet message field, every new `GraphRouter`/`PhaseModulatedOperator`
constructor or setter parameter — reject with a `RangeError` naming the received value at the
domain-kernel boundary; reject with `null` (never throw) at the worklet-message boundary.

### Pre-allocate once, never inside render()/process()
**Source:** `additive-fixture.ts`'s `scratch` field (line 49), `operator.ts`'s stateless per-sample
loop
**Apply to:** `GraphRouter`'s six per-operator output buffers and its shared modulation-scratch
buffer — all built once in the constructor.

### Reactive signal-effect → postMessage translation
**Source:** `web-audio-synth-engine.ts`'s constructor `effect()` (lines 153-178) +
`hasAppliedRoutingState`/`rememberAppliedRoutingState` guard pair (lines 460-472, not fully read
this session but named/referenced at lines 171/176)
**Apply to:** `worklet-synth-engine.ts`'s new constructor `effect()` — same three-signal read order,
same skip-if-unchanged guard, same "apply then remember" sequencing.

### Reuse canonical routing/derivation functions, never re-derive
**Source:** `derive-role.ts`'s `getFeedbackOperator`/`deriveCarriers`/`getOperatorRole`,
`patch-plan.ts`'s `planConnections`
**Apply to:** `graph-router.ts`'s routing-config setter and `worklet-synth-engine.ts`'s
`applyRoutingToWorklet` — both call these functions directly; `worklets/dx7-worklet-processor.ts`
must never re-derive carrier/feedback roles locally, only consume the already-translated message.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/domain/dx7/dsp/algorithm-routing.spec.ts` | test | batch (32-row cross-check) | No existing test in the repo cross-checks two independent implementations across a full dataset sweep; RESEARCH.md's own Pattern 5 code example is the closest available template — follow `operator.spec.ts`'s finite/NaN assertion idiom (per RESEARCH "Don't Hand-Roll" table) for the per-sample assertions, but the 32-row×D-11-feedback-sweep loop structure itself is new. |
| `worklets/harness/harness-main.ts` | component (dev harness) | event-driven | Not read this session (existing Phase 7 file, low structural risk — only additive algorithm-select/feedback-depth controls needed); read this file directly before extending rather than relying on this pattern map. |

## Metadata

**Analog search scope:** `src/app/domain/dx7/dsp/`, `src/app/domain/dx7/audio/`,
`src/app/domain/dx7/models/`, `src/app/core/audio/`, `worklets/`
**Files scanned (read in full or targeted):** `operator.ts` (full), `additive-fixture.ts` (full),
`worklet-messages.ts` (full), `patch-plan.ts` (full), `value-conversion.ts` (full),
`worklet-synth-engine.ts` (full), `dx7-worklet-processor.ts` (full), `derive-role.ts` (full),
`synth-engine.token.ts` (full), `web-audio-synth-engine.ts` (targeted, lines 1/130-330),
`validate-algorithm.ts` (grep + targeted)
**Pattern extraction date:** 2026-08-12
