# Phase 5: First playable approximation - Pattern Map

**Mapped:** 2026-08-06
**Files analyzed:** 10
**Analogs found:** 9 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/core/audio/audio-context.token.ts` | config (DI token) | event-driven | `src/app/core/browser/motion-preference.ts` (`MATCH_MEDIA` token) | exact |
| `src/app/core/audio/synth-engine.token.ts` | config (DI token) | event-driven | `src/app/core/browser/motion-preference.ts` (`MATCH_MEDIA` token) | exact |
| `src/app/core/audio/web-audio-synth-engine.ts` | service | event-driven | `src/app/core/browser/motion-preference.ts` (`MotionPreference`) + `src/app/state/instrument-state.ts` (facade/effect shape) | role-match (composite) |
| `src/app/core/audio/testing/fake-audio-context.ts` | test fixture | event-driven | `src/app/core/browser/motion-preference.spec.ts` (`FakeMediaQueryList`) | exact |
| `src/app/core/audio/web-audio-synth-engine.spec.ts` | test | event-driven | `src/app/core/browser/motion-preference.spec.ts` | exact |
| `src/app/domain/dx7/audio/patch-plan.ts` | utility (pure domain) | transform | `src/app/domain/dx7/models/derive-role.ts` | exact |
| `src/app/domain/dx7/audio/patch-plan.spec.ts` | test | transform | `src/app/domain/dx7/models/operator-parameters.spec.ts` (structure), `derive-role.ts` (subject) | role-match |
| `src/app/domain/dx7/audio/value-conversion.ts` | utility (pure domain) | transform | `src/app/domain/dx7/models/operator-parameters.ts` (validation/scale conventions) | role-match |
| `src/app/domain/dx7/audio/value-conversion.spec.ts` | test | transform | `src/app/domain/dx7/models/operator-parameters.spec.ts` | exact |
| `src/app/features/playground/playground.ts`/`.html`/`.scss` (extended) | component | request-response | itself (existing placeholder) | exact — in-place extension, not a new analog |
| `src/app/features/playground/keyboard-note-map.ts` | utility (pure domain-adjacent) | transform | `src/app/domain/dx7/models/operator-parameters.ts` (`COARSE_RATIOS` frozen-array + guard pattern) | role-match |

## Pattern Assignments

### `src/app/core/audio/audio-context.token.ts` (config, event-driven)

**Analog:** `src/app/core/browser/motion-preference.ts` (`MATCH_MEDIA` token, lines 23-35)

**Full pattern to mirror** (`motion-preference.ts:23-35`):
```typescript
/**
 * DI seam for `window.matchMedia`. Domain/service code must never touch
 * `window` directly; tests provide a fake implementation through this
 * token instead of mocking globals.
 */
export const MATCH_MEDIA = new InjectionToken<typeof window.matchMedia>('MATCH_MEDIA', {
  providedIn: 'root',
  factory: () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia.bind(window)
      : unsupportedMediaQueryList,
});
```

**Apply as:** an `AUDIO_CONTEXT_CTOR` token that returns a *constructor function*, not an
instance (per RESEARCH.md Pattern 1) — never a `factory` that calls `new AudioContext()` itself
(that would run at DI-instantiation time, violating CLAUDE.md's "never construct an AudioContext
at module evaluation time"). `null` fallback (no feature-detected constructor) is the
`'unavailable'` signal, mirroring `unsupportedMediaQueryList`'s "report a safe default rather
than crash" posture:
```typescript
export type AudioContextConstructorLike = new () => AudioContextLike;

export const AUDIO_CONTEXT_CTOR = new InjectionToken<AudioContextConstructorLike | null>(
  'AUDIO_CONTEXT_CTOR',
  {
    providedIn: 'root',
    factory: () => {
      if (typeof window === 'undefined') return null;
      const ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      return ctor ?? null;
    },
  },
);
```

---

### `src/app/core/audio/web-audio-synth-engine.ts` (service, event-driven)

**Analogs:** `src/app/core/browser/motion-preference.ts` (signal-facade shell, DestroyRef cleanup)
and `src/app/state/instrument-state.ts` (private `WritableSignal` + `.asReadonly()`, validate-then-write
command methods, `RangeError` guard convention).

**Signal facade shape** (`motion-preference.ts:51-72`):
```typescript
@Injectable({ providedIn: 'root' })
export class MotionPreference {
  private readonly matchMedia = inject(MATCH_MEDIA);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _prefersReducedMotion = signal(this.matchMedia(REDUCED_MOTION_QUERY).matches);
  readonly prefersReducedMotion: Signal<boolean> = this._prefersReducedMotion.asReadonly();

  constructor() {
    const mediaQueryList = this.matchMedia(REDUCED_MOTION_QUERY);
    const listener = (event: MediaQueryListEvent): void => {
      this._prefersReducedMotion.set(event.matches);
    };
    mediaQueryList.addEventListener('change', listener);
    this.destroyRef.onDestroy(() => {
      mediaQueryList.removeEventListener('change', listener);
    });
  }
}
```

**Apply as:** `WebAudioSynthEngine implements SynthEngine`, injecting `AUDIO_CONTEXT_CTOR` and
`DestroyRef`. `status` is a private `WritableSignal<AudioEngineStatus>` exposed via `.asReadonly()`
exactly like `prefersReducedMotion`. `initialize()` is the one place `new ctor()` runs (called only
from a click handler, never the constructor) — this satisfies RESEARCH.md Pitfall 3.
`destroyRef.onDestroy(...)` is where all persistent oscillators/nodes get `stop()`/`disconnect()`-ed,
mirroring the `removeEventListener` cleanup here.

**Command-method validate-then-write convention** (`instrument-state.ts:148-185`):
```typescript
setAlgorithm(algorithmId: AlgorithmId): void {
  resolveAlgorithm(algorithmId); // throws RangeError before any write on an unknown id
  const previous = this._patch();
  this._patch.set({ ...previous, algorithmId });
}

setFeedback(level: number): void {
  validateFeedbackLevel(level);
  const previous = this._patch();
  this._patch.set({ ...previous, feedback: level });
}
```

**Apply as:** `noteOn(note, velocity)`/`noteOff(note)`/`setAlgorithm(algorithmId)` should validate
inputs (per RESEARCH.md's Security Domain V5 guidance — reject `NaN`/out-of-range `note`/`velocity`
before any `AudioParam` call) before mutating the persistent node graph, matching this
validate-first, no-partial-write discipline.

**Reading `InstrumentState` via `effect()`** — the one legitimate `effect()` use per CLAUDE.md
(imperative sync with an external system, the audio graph). Constructor pattern:
```typescript
constructor() {
  effect(() => {
    const algorithm = this.instrumentState.algorithm();
    this.applyAlgorithm(algorithm); // imperative rewiring of the persistent node graph
  });
}
```
This is new composition, not copied from an existing file — no prior `effect()` example exists in
the codebase yet; follow CLAUDE.md's explicit constraint text plus RESEARCH.md's Anti-Patterns
section ("the one legitimate effect() in this phase... never a computed() trying to derive a
current-graph value").

**Error/validation convention** (`operator-parameters.ts:99-169`, `RangeError` with a message naming
the field, valid range, and received value) — reuse this exact message shape for any new
`SynthEngine` boundary validation (e.g. `note`/`velocity` range checks).

---

### `src/app/core/audio/testing/fake-audio-context.ts` (test fixture, event-driven)

**Analog:** `src/app/core/browser/motion-preference.spec.ts` (`FakeMediaQueryList`, lines 4-28)

```typescript
class FakeMediaQueryList {
  matches: boolean;
  private listener: ((event: MediaQueryListEvent) => void) | null = null;

  constructor(initialMatches: boolean) {
    this.matches = initialMatches;
  }

  addEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listener = listener;
  }

  removeEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    if (this.listener === listener) {
      this.listener = null;
    }
  }

  emit(matches: boolean): void {
    this.matches = matches;
    this.listener?.({ matches } as MediaQueryListEvent);
  }
}
```

**Apply as:** a `FakeAudioContext`/`FakeOscillatorNode`/`FakeGainNode`/`FakeDelayNode` set —
minimal surface, introspectable (track `connect`/`disconnect`/`start`/`stop` calls and scheduled
`AudioParam` automation), same "hand-roll a small fake, no library" posture. RESEARCH.md's Code
Examples section already sketches the exact shape (`FakeAudioContext` with `createOscillator`/
`createGain`/`createDelay`/`resume`/`close`) — treat that sketch as this file's starting point,
extended with call-tracking arrays the specs assert against.

---

### `src/app/core/audio/web-audio-synth-engine.spec.ts` (test, event-driven)

**Analog:** `src/app/core/browser/motion-preference.spec.ts` (full file, 65 lines)

**DI override + assertion shape** (`motion-preference.spec.ts:31-46`):
```typescript
function setup(initialMatches: boolean) {
  const mediaQueryList = new FakeMediaQueryList(initialMatches);
  TestBed.configureTestingModule({
    providers: [{ provide: MATCH_MEDIA, useValue: () => mediaQueryList }],
  });
  return { service: TestBed.inject(MotionPreference), mediaQueryList };
}

it('reflects the initial OS preference', () => {
  const { service } = setup(true);
  expect(service.prefersReducedMotion()).toBe(true);
});
```

**Apply as:** `TestBed.configureTestingModule({ providers: [{ provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioContext }] })`,
then assert on `status()` transitions (`'suspended'` → `'ready'` after `initialize()`), on scheduled
`AudioParam` calls (`setValueAtTime`/`linearRampToValueAtTime`/`setTargetAtTime`) via the fake's
tracked-call arrays, and on "every started oscillator has a matching `stop()`/`disconnect()` after
`destroy()`" (the no-stuck-voice invariant AUDIO-02 requires). The destroy-cleanup assertion mirrors
`motion-preference.spec.ts`'s `removeSpy`/`toHaveBeenCalledWith` pattern (lines 57-64):
```typescript
it('removes its change listener when the service is destroyed', () => {
  const { mediaQueryList } = setup(false);
  const removeSpy = vi.spyOn(mediaQueryList, 'removeEventListener');
  TestBed.resetTestingModule();
  expect(removeSpy).toHaveBeenCalledWith('change', expect.any(Function));
});
```

---

### `src/app/domain/dx7/audio/patch-plan.ts` (utility, transform)

**Analog:** `src/app/domain/dx7/models/derive-role.ts` (full file, 55 lines)

**Pure on-demand derivation pattern, reading `AlgorithmDefinition.edges`** (`derive-role.ts:23-54`):
```typescript
export function getOperatorRole(
  algorithm: AlgorithmDefinition,
  operatorId: OperatorId,
): OperatorRole {
  const modulatesAnotherOperator = algorithm.edges.some(
    (edge) => edge.from === operatorId && edge.to !== operatorId,
  );
  return modulatesAnotherOperator ? 'modulator' : 'carrier';
}

export function getFeedbackOperator(algorithm: AlgorithmDefinition): OperatorId | null {
  const feedbackEdge = algorithm.edges.find((edge) => edge.from === edge.to);
  return feedbackEdge ? feedbackEdge.from : null;
}
```

**Apply as:** `planConnections(algorithm: AlgorithmDefinition): readonly OperatorConnection[]` —
same style: pure function, no caching, reads `algorithm.edges` directly, uses the `from === to`
self-loop test already established here as "this is feedback" (do not re-derive that test
differently — reuse `edge.from === edge.to`, the exact expression `getFeedbackOperator` uses).
Zero Angular imports (must pass the domain-purity ESLint gate, per RESEARCH.md).

---

### `src/app/domain/dx7/audio/patch-plan.spec.ts` (test, transform)

**Analog:** `src/app/domain/dx7/models/operator-parameters.spec.ts` (structure/style — read for
Vitest describe/it conventions in the domain layer) combined with `derive-role.ts` as the function
under test's sibling.

**Apply as:** table-driven assertions against representative `AlgorithmDefinition`s from
`ALGORITHMS` (e.g. Algorithm 1, Algorithm 32) verifying `isFeedback` flags land on the correct
self-loop edges and non-feedback edges are ordered/shaped correctly — no Web Audio types involved
at all, pure data in/out.

---

### `src/app/domain/dx7/audio/value-conversion.ts` (utility, transform)

**Analog:** `src/app/domain/dx7/models/operator-parameters.ts` (constants + validation, lines 43-169)

**DX7-integer-scale-bounds-as-named-constants convention** (`operator-parameters.ts:43-49`):
```typescript
export const MIN_OUTPUT_LEVEL = 0;
export const MAX_OUTPUT_LEVEL = 99;
export const MIN_DETUNE = -7;
export const MAX_DETUNE = 7;
```

**Apply as:** the same named-constant discipline for any new Web-Audio-value constants this file
introduces (e.g. `RAMP_SECONDS`, a `MASTER_GAIN` clamp) — no magic numbers inline, matching this
file's precedent. The conversion functions themselves (`outputLevel` 0-99 → gain,
`ratio`/`detune`/`mode` → Hz) are new pure math with no direct existing analog in this codebase;
RESEARCH.md's Assumptions Log A1/A5 and Pattern 3/Code Example 1 comment are the design reference
since no prior conversion-function file exists to copy from directly. Keep it a pure,
Angular-free function per the domain-purity ESLint gate, exactly like `operator-parameters.ts`.

---

### `src/app/domain/dx7/audio/value-conversion.spec.ts` (test, transform)

**Analog:** `src/app/domain/dx7/models/operator-parameters.spec.ts` — read this file for the
project's domain-layer Vitest conventions (boundary-value tests: min, max, one-below-min,
one-above-max, matching the `RangeError` message format).

---

### `src/app/features/playground/playground.ts` / `.html` / `.scss` (component, request-response)

**Analog:** itself — this is an in-place extension of the existing placeholder (D-06), not a
greenfield component modeled on a different file.

**Current state to extend** (`playground.ts:1-21`):
```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-playground',
  imports: [],
  templateUrl: './playground.html',
  styleUrl: './playground.scss',
})
export class Playground {
  protected readonly comingSoon: readonly string[] = [
    'Full 32-algorithm selector with live routing diagram',
    'Six operator strips: ratio, level, detune, envelope',
    'On-screen and computer keyboard, monophonic to start', // ← D-06: this line is what gets replaced
    'Oscilloscope and spectrum display',
    'A/B snapshot compare and constrained randomization',
  ];
}
```

Current template's placeholder status line to replace (`playground.html:6-9`):
```html
<p class="status" role="status">
  No audio engine is wired up yet — this route is a placeholder from the foundation phase. Audio
  will always require an explicit "Enable audio" action; it never starts on page load.
</p>
```

**Apply as:** inject `SynthEngine`/`WebAudioSynthEngine` and `InstrumentState` via `inject()`, add
D-09's "Enable audio" gate (rendered when `status() !== 'ready'`) and D-08's persistent
approximation label (rendered unconditionally, always visible per D-08 — not inside the same `@if`
branch as the gate). The `comingSoon` array's "On-screen and computer keyboard, monophonic to
start" bullet is removed (fulfilled, not "coming soon" anymore) while the other four bullets stay
verbatim — same partial-list-mutation shape as Phase 4 used for the Algorithms feature.

**Critical:** `playground.spec.ts:17-22`'s existing assertion —
```typescript
it('discloses that no audio engine is wired up yet', () => {
  const compiled = fixture.nativeElement as HTMLElement;
  expect(compiled.querySelector('[role="status"]')?.textContent).toContain(
    'No audio engine is wired up yet',
  );
});
```
must be replaced (not left failing) in the same commit that changes the template — this is a known
Wave 0 gap flagged in RESEARCH.md.

---

### `src/app/features/playground/keyboard-note-map.ts` (utility, transform)

**Analog:** `src/app/domain/dx7/models/operator-parameters.ts`'s `COARSE_RATIOS` frozen-array +
`isCoarseRatio` guard convention (lines 51-64):
```typescript
export const COARSE_RATIOS: readonly number[] = Object.freeze([
  0.5,
  ...Array.from({ length: 31 }, (_, index) => index + 1),
]);

export function isCoarseRatio(value: number): boolean {
  return COARSE_RATIOS.includes(value);
}
```

**Apply as:** a frozen, ordered lookup table (physical key → note number, one fixed octave, D-07)
plus a membership guard, same shape — `Object.freeze([...])` constant + a small predicate function,
not a `Map` built ad hoc inline in the component. This keeps the mapping table-driven and testable
in isolation, matching the project's established "data, not inline logic" convention (also echoed
by `SNAPSHOT_SLOTS`/`isSnapshotSlot` in `instrument-state.ts:31-44`).

## Shared Patterns

### DI-wrapped browser global (InjectionToken + factory + graceful-degradation fallback)
**Source:** `src/app/core/browser/motion-preference.ts` lines 10-35
**Apply to:** `audio-context.token.ts` — every new browser-global touchpoint in this phase must go
through an `InjectionToken` factory that returns `null`/a safe stand-in rather than throwing, never
a direct `window.AudioContext` reference in service code.

### Signal facade: private `WritableSignal` + public `.asReadonly()`
**Source:** `src/app/core/browser/motion-preference.ts` lines 56-59, `src/app/state/instrument-state.ts` lines 98-101
**Apply to:** `WebAudioSynthEngine.status`, and any other Angular-facing state this phase's engine
exposes — never a plain public `WritableSignal`, never a getter.

### Validate-before-write command methods, `RangeError` with field/range/received-value message
**Source:** `src/app/domain/dx7/models/operator-parameters.ts` lines 99-169, `src/app/state/instrument-state.ts` lines 148-234
**Apply to:** `SynthEngine.noteOn`/`noteOff`/`setAlgorithm` boundary validation (RESEARCH.md
Security Domain V5) — reject invalid `note`/`velocity`/`algorithmId` before any state mutation or
`AudioParam` call, using the same `RangeError` message shape (`` `${field} must be ${constraint}, received ${value}` ``).

### `DestroyRef.onDestroy` cleanup for anything started in a constructor/initializer
**Source:** `src/app/core/browser/motion-preference.ts` lines 54, 68-70
**Apply to:** `WebAudioSynthEngine.destroy()` — every persistent oscillator/gain/delay node started
in `initialize()` must have a matching `stop()`/`disconnect()` here, mirroring the
`removeEventListener` cleanup pair.

### Frozen-array constant + membership-guard function for restricted value sets
**Source:** `src/app/domain/dx7/models/operator-parameters.ts` lines 51-64 (`COARSE_RATIOS`/`isCoarseRatio`), `src/app/state/instrument-state.ts` lines 31-44 (`SNAPSHOT_SLOTS`/`isSnapshotSlot`)
**Apply to:** `keyboard-note-map.ts`'s key→note table, and any other fixed lookup table this phase
introduces (e.g. the 12-key octave definition itself).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/domain/dx7/audio/value-conversion.ts` (the conversion *math* itself, not its file shape) | utility | transform | No prior DX7-scale→Web-Audio-value conversion function exists anywhere in the codebase; RESEARCH.md's Pattern 3/Assumptions A1/A5 are the only available design reference (external Web Audio technique, not an internal analog) |
| `WebAudioSynthEngine`'s `effect()`-driven sync with `InstrumentState` | service (constructor wiring) | event-driven | No prior file in this codebase uses `effect()` at all yet — this is the first legitimate use case per CLAUDE.md's constraint; follow CLAUDE.md's rule text directly, not a copied excerpt |

## Metadata

**Analog search scope:** `src/app/core/`, `src/app/state/`, `src/app/domain/dx7/models/`, `src/app/features/playground/`
**Files scanned:** `motion-preference.ts`, `motion-preference.spec.ts`, `synth-engine.ts`
(interface), `synth-engine.token.ts` (DI token — not a rename of the interface),
`instrument-state.ts`, `derive-role.ts`, `operator-parameters.ts`, `operator-parameters.spec.ts`,
`playground.ts`, `playground.html`, `playground.spec.ts`, `algorithm-definition.ts` (edges shape)
**Pattern extraction date:** 2026-08-06
