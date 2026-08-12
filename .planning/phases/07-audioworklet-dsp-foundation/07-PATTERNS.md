# Phase 7: AudioWorklet DSP foundation - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 11
**Analogs found:** 8 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/app/domain/dx7/dsp/operator.ts` | model/utility (pure DSP kernel) | streaming (per-sample render) | `src/app/domain/dx7/audio/value-conversion.ts` | role-match (pure domain math, no browser deps) |
| `src/app/domain/dx7/dsp/operator.spec.ts` | test | request-response (deterministic assertion) | `src/app/domain/dx7/audio/value-conversion.spec.ts` | exact (plain Vitest globals, domain-spec convention) |
| `src/app/domain/dx7/dsp/additive-fixture.ts` | utility (test fixture / config-like data) | batch (synthetic fixture) | `src/app/domain/dx7/dsp/operator.ts` (sibling, not yet existing) | role-match — no existing multi-operator fixture; closest analog is the operator primitive itself plus `OPERATOR_IDS` from `src/app/domain/dx7/models/operator.ts` |
| `src/app/domain/dx7/dsp/additive-fixture.spec.ts` | test | batch | `src/app/domain/dx7/audio/value-conversion.spec.ts` | role-match |
| `src/app/core/audio/audio-worklet-node.token.ts` | config/DI token + fake-boundary interfaces | request-response | `src/app/core/audio/audio-context.token.ts` | exact — same `InjectionToken` + factory + `*Like` interface shape |
| `src/app/core/audio/worklet-synth-engine.ts` | service (SynthEngine implementation) | event-driven (note lifecycle) + request-response (addModule) | `src/app/core/audio/web-audio-synth-engine.ts` | exact — same interface, same gesture-gated `initialize()`/`destroy()` lifecycle, same signal-status shape |
| `src/app/core/audio/worklet-synth-engine.spec.ts` | test | event-driven | analog file's own spec (not read this pass — same directory/convention, use `testing/fake-audio-context.ts` pattern as the fake-boundary precedent) | role-match |
| `src/app/core/audio/testing/fake-audio-worklet-node.ts` | test double | request-response | `src/app/core/audio/testing/fake-audio-context.ts` | exact — same hand-rolled-fake, call-recording, static-instances-registry pattern |
| `worklets/dx7-worklet-processor.ts` | adapter (outside tsconfig.app.json) | streaming (render-quantum callback) | none in-repo (new pattern class); modeled directly on RESEARCH.md Pattern 2 | no analog — first worklet adapter in this codebase |
| `worklets/tsconfig.worklet.json` | config | — | `tsconfig.app.json` | role-match (sibling tsconfig, different `include`/`types`) |
| `scripts/build-worklet.mjs` | config/build script | batch (one-shot bundling) | none in-repo | no analog — first non-Angular build script in this project |

## Pattern Assignments

### `src/app/domain/dx7/dsp/operator.ts` (model, streaming)

**Analog:** `src/app/domain/dx7/audio/value-conversion.ts`

**Domain-purity header comment convention** (lines 1-13):
```typescript
/**
 * DX7-integer-scale → Web-Audio-value conversion boundary (Phase 5, D-10 from
 * `03-CONTEXT.md`). Pure math only — zero Angular imports, enforced by the
 * domain-purity ESLint gate (DOMAIN-04) — so every formula here is
 * independently unit-testable without touching Web Audio at all.
 */
```
Mirror this: no Angular imports, explicit ESLint-gate callout, cite the requirement (D-05/ENGINE-01) that motivates purity.

**Exported pure-function/constant convention** (e.g. `midiNoteToFrequency`, lines 49-52): small, single-purpose, doc-commented, no side effects, no allocation inside hot paths. The kernel class (`PhaseModulatedOperator`) should follow the same terse-doc-per-member convention this file uses for every exported constant/function.

**Governing ESLint rule** (`eslint.config.js` lines ~38-58) — `no-restricted-imports` blocks any `@angular/*` import (including type-only) under `src/app/domain/**`; this file's directory must sit inside that glob.

**Concrete kernel implementation to copy nearly verbatim** — RESEARCH.md Pattern 1 (already a project-informed synthesis, not external): phase accumulator wraps every sample (`this.phase = (this.phase + increment) % 1`), constructor takes `sampleRate` explicitly (never reads a browser global — Pitfall 4/6), `render(output, modulationInput?)` writes in place with zero allocation.

---

### `src/app/domain/dx7/dsp/operator.spec.ts` (test, request-response)

**Analog:** `src/app/domain/dx7/audio/value-conversion.spec.ts`

**Plain-Vitest-globals convention** (lines 1-30): no `TestBed`, direct `import { ... } from './value-conversion'`, `describe`/`it` blocks per exported symbol, builder helper functions for fixture objects (`buildOperatorParameters`).

**Analytical-tolerance assertion style** (`toBeCloseTo`, seen throughout, e.g. line 36-38):
```typescript
it('is ~261.63Hz at MIDI note 60 (C4), within a small tolerance', () => {
  expect(midiNoteToFrequency(60)).toBeCloseTo(261.63, 1);
});
```
Use the same `toBeCloseTo(expected, precision)` idiom for the `sin(2πft)` reference check (D-05), per RESEARCH.md's Code Examples section.

---

### `src/app/core/audio/audio-worklet-node.token.ts` (config/DI token)

**Analog:** `src/app/core/audio/audio-context.token.ts`

**Imports pattern** (line 1):
```typescript
import { InjectionToken } from '@angular/core';
```

**Fake-boundary interface pattern** (lines 3-54): define `AudioWorkletPortLike`/`AudioWorkletNodeLike`/`AudioWorkletLike` extending `AudioNodeLike`, minimal method surface only (no full spec shape) — mirrors `AudioParamLike`/`OscillatorNodeLike`/`AudioContextLike` here.

**Constructor-type-not-instance pattern** (lines 56-59):
```typescript
export type AudioContextConstructorLike = new () => AudioContextLike;
```
No equivalent needed for AudioWorkletNode (constructed via `new AudioWorkletNode(context, name, options)` off an already-live context) — but the "never construct at module eval time" doc-comment convention (lines 61-66) should be mirrored on whatever factory resolves the worklet boundary.

**Feature-detection factory + null-safe token pattern** (lines 67-91):
```typescript
export const AUDIO_CONTEXT_CTOR = new InjectionToken<AudioContextConstructorLike | null>(
  'AUDIO_CONTEXT_CTOR',
  {
    providedIn: 'root',
    factory: resolveAudioContextConstructor,
  },
);
```
If a new token is needed (e.g. for the worklet module URL string), follow this exact `InjectionToken` + `providedIn: 'root'` + `factory` shape.

---

### `src/app/core/audio/worklet-synth-engine.ts` (service, event-driven)

**Analog:** `src/app/core/audio/web-audio-synth-engine.ts`

**Imports pattern** (lines 1-32): destructure Angular core (`DestroyRef, Injectable, Signal, effect, inject, signal`), domain types as `type`-only imports, then the DI tokens (`AUDIO_CONTEXT_CTOR`), then `SynthEngine`/`AudioEngineStatus` types last.

**Signal-facade / status pattern** (lines 119-122):
```typescript
private readonly _status = signal<AudioEngineStatus>(this.ctor === null ? 'unavailable' : 'suspended');
readonly status: Signal<AudioEngineStatus> = this._status.asReadonly();
```
Copy verbatim shape — private writable signal, `.asReadonly()` public signal, never a getter (per CLAUDE.md/this file's own doc comment).

**Gesture-gated, idempotent `initialize()` pattern** (lines 180-223): guard `if (this.ctor === null || this.context !== null) return;`, generation counter to guard against stale async resumes racing `destroy()`, try/catch around the async build with explicit `'ready'`/`'error'` status transitions and `context.close()` on failure. The worklet engine's `initialize()` should follow this exact shape, replacing `buildGraph`+`context.resume()` with `context.resume()` → `context.audioWorklet.addModule(url)` → construct `AudioWorkletNode` → connect.

**`DestroyRef.onDestroy` cleanup registration** (line 154):
```typescript
this.destroyRef.onDestroy(() => this.destroy());
```

**`destroy()` teardown pattern** (lines 601-622): bump generation, cancel any live audio param automation, call a private `teardownGraph()`, close the context, reset status to `'unavailable'`/`'suspended'`. The worklet engine's `destroy()` should disconnect the `AudioWorkletNode`, null the port's `onmessage`, and follow the same reset-to-baseline-status idiom.

**`SynthEngine` interface being implemented** (from `src/app/core/audio/synth-engine.ts`, lines 32-43) — the exact method surface (`status`, `initialize`, `setAlgorithm`, `updateOperatorLevel`, `setFeedback`, `noteOn`, `noteOff`, `allNotesOff`, `destroy`) D-02 requires the new class to implement; unsupported calls (routing beyond the additive fixture, `setFeedback`) may no-op or throw per CONTEXT.md's Claude's-Discretion item — but the signature must match exactly.

**Validation-before-mutation pattern** (lines 78-90, `validateNote`/`validateVelocity`):
```typescript
function validateNote(note: number): void {
  if (!Number.isInteger(note) || note < MIN_MIDI_NOTE || note > MAX_MIDI_NOTE) {
    throw new RangeError(`note must be an integer in ${MIN_MIDI_NOTE}..${MAX_MIDI_NOTE}, received ${note}`);
  }
}
```
Mirror for any `noteOn`/`noteOff` validation in the new engine before forwarding a `postMessage`.

**postMessage-forwarding note lifecycle** — new pattern this phase (no existing analog uses `port.postMessage`); model directly on RESEARCH.md Pattern 2/3 — `noteOn`/`noteOff` should validate then `this.node?.port.postMessage({ kind: 'noteOn', ... })`.

---

### `src/app/core/audio/testing/fake-audio-worklet-node.ts` (test double)

**Analog:** `src/app/core/audio/testing/fake-audio-context.ts`

**Hand-rolled fake, call-recording pattern** (lines 1-92, `FakeAudioParam`): record every scheduling call as an ordered entry (`automationEntries`), track direct assignments separately. Not directly reusable for a worklet port (no `AudioParam` involved) but the *recording idiom* — expose an array of recorded calls a spec can assert against — should carry over for `postMessage` payloads:
```typescript
readonly postedMessages: unknown[] = [];
postMessage(data: unknown): void {
  this.postedMessages.push(data);
}
```

**Static instance registry pattern** (lines 143-147, 162-164):
```typescript
static readonly instances: FakeAudioContext[] = [];
constructor() {
  FakeAudioContext.instances.push(this);
}
```
Mirror if the fake `AudioWorkletNode`/`AudioWorklet` needs to prove `addModule()` was called exactly once (analogous to proving `new ctor()` ran once).

**Created-node registry + cleanup-assertion pattern** (lines 153-155, 200-203): track everything created so a spec can assert full teardown — mirror for whatever the fake worklet boundary constructs.

**`FakeAudioContext.addModule` extension point** — none exists yet on `FakeAudioContext`; the new fake `AudioWorkletLike.addModule(url)` should follow the same `resolve immediately, record the call` idiom as `resume()`/`close()` (lines 166-175):
```typescript
resume(): Promise<void> {
  this.state = 'running';
  return Promise.resolve();
}
```

---

### `worklets/dx7-worklet-processor.ts` (adapter, streaming)

**No in-repo analog** — this is the first `AudioWorkletProcessor` in the project. Use RESEARCH.md Pattern 2 verbatim as the template (imports the pure kernel via a relative path outside `src/app`, validates every `port.onmessage` payload before mutating kernel state, `process()` never allocates, returns `true` unconditionally). Directory must stay outside `tsconfig.app.json`'s `"include": ["src/**/*.ts"]` (see Pitfall 3) — confirmed via direct read of `tsconfig.app.json` this session.

---

### `scripts/build-worklet.mjs` (build script)

**No in-repo analog** — first non-Angular build script. Use RESEARCH.md's Code Examples `esbuild` snippet verbatim (`bundle: true, format: 'iife', target: 'es2022'`), writing to `public/worklets/dx7-worklet-processor.js` so Angular's existing `public/` asset glob serves it unmodified.

## Shared Patterns

### Domain purity (ESLint-enforced)
**Source:** `eslint.config.js` (rule block for `files: ['src/app/domain/**/*.ts']`)
**Apply to:** `src/app/domain/dx7/dsp/operator.ts`, `additive-fixture.ts`
```javascript
{
  files: ['src/app/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': 'off',
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        patterns: [{
          group: ['@angular/*', '@angular/*/**'],
          message: 'DOMAIN-04: domain logic ... must stay framework-independent of Angular ...',
          allowTypeImports: false,
        }],
      },
    ],
  },
},
```
Any Angular import (value or type) inside `src/app/domain/dx7/dsp/**` will fail lint — the kernel must take `sampleRate` as a constructor argument rather than reading any global.

### DI token + fake-boundary seam
**Source:** `src/app/core/audio/audio-context.token.ts` + `src/app/core/audio/testing/fake-audio-context.ts`
**Apply to:** `audio-worklet-node.token.ts`, `testing/fake-audio-worklet-node.ts`, `worklet-synth-engine.spec.ts`
Every new browser boundary gets a `*Like` interface pair + `InjectionToken` (never constructed at module eval time) on the production side, and a hand-rolled fake (no test library) that records calls on the test side. No spec may touch a real `AudioContext`/`AudioWorkletNode`.

### `SynthEngine` interface contract
**Source:** `src/app/core/audio/synth-engine.ts`, `src/app/core/audio/synth-engine.token.ts`
**Apply to:** `worklet-synth-engine.ts`
```typescript
export interface SynthEngine {
  readonly status: () => AudioEngineStatus;
  initialize(): Promise<void>;
  setAlgorithm(algorithmId: AlgorithmId): void;
  updateOperatorLevel(operatorId: OperatorId, level: number): void;
  setFeedback(level: number): void;
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  allNotesOff(): void;
  destroy(): void;
}
```
D-01 keeps `SYNTH_ENGINE` (in `synth-engine.token.ts`) pointed at `WebAudioSynthEngine` — do not modify that token's factory this phase; the new class exists standalone, not yet wired to the token.

### Gesture-gated lifecycle + signal status
**Source:** `src/app/core/audio/web-audio-synth-engine.ts` lines 113-223, 601-622
**Apply to:** `worklet-synth-engine.ts`
Idempotent `initialize()`, generation counter against stale async races, `status` as a read-only `Signal<AudioEngineStatus>`, `destroy()` resets to baseline and is registered via `DestroyRef.onDestroy`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `worklets/dx7-worklet-processor.ts` | adapter | streaming | First `AudioWorkletProcessor` in this codebase; no prior worklet exists. Use RESEARCH.md Pattern 2 as the template. |
| `worklets/tsconfig.worklet.json` | config | — | First worklet-scoped tsconfig; base it on `tsconfig.app.json`'s shape but with `"types": ["audioworklet"]` and an `include` limited to `worklets/**`. |
| `scripts/build-worklet.mjs` | build script | batch | First non-Angular build script; use RESEARCH.md's esbuild snippet. |
| `src/app/domain/dx7/dsp/additive-fixture.ts` | utility/fixture | batch | No existing multi-operator synthetic fixture; compose from `OPERATOR_IDS` (`src/app/domain/dx7/models/operator.ts`) and the new `PhaseModulatedOperator`, per D-04 — must not read `algorithms.ts`/`derive-role.ts`. |

## Metadata

**Analog search scope:** `src/app/core/audio/`, `src/app/core/audio/testing/`, `src/app/domain/dx7/audio/`, `src/app/domain/dx7/models/`, root config files (`tsconfig.app.json`, `eslint.config.js`)
**Files scanned:** synth-engine.ts, synth-engine.token.ts, audio-context.token.ts, web-audio-synth-engine.ts, testing/fake-audio-context.ts, domain/dx7/audio/value-conversion.ts + .spec.ts, tsconfig.app.json, eslint.config.js
**Pattern extraction date:** 2026-08-11
