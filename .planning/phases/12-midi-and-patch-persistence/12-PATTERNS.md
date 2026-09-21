# Phase 12: MIDI and patch persistence - Pattern Map

**Mapped:** 2026-09-09
**Files analyzed:** 34
**Analogs found:** 32 / 34

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/core/browser/midi-access.token.ts` | provider | event-driven | `src/app/core/audio/audio-context.token.ts` | exact |
| `src/app/core/midi/midi-session.ts` | service | event-driven | `src/app/core/audio/worklet-synth-engine.ts` | role-match |
| `src/app/core/midi/testing/fake-midi-access.ts` | utility | event-driven | `src/app/core/audio/testing/fake-audio-context.ts` | exact |
| `src/app/core/midi/midi-session.spec.ts` | test | event-driven | `src/app/core/browser/motion-preference.spec.ts` | exact |
| `src/app/domain/dx7/midi/parse-midi-note-message.ts` | utility | transform | `src/app/domain/dx7/dsp/worklet-messages.ts` | role-match |
| `src/app/domain/dx7/midi/parse-midi-note-message.spec.ts` | test | transform | `src/app/domain/dx7/dsp/worklet-messages.spec.ts` | exact |
| `src/app/core/persistence/storage.token.ts` | provider | file-I/O | `src/app/core/browser/animation-frame.token.ts` | exact |
| `src/app/core/persistence/testing/fake-storage.ts` | utility | file-I/O | `src/app/core/browser/testing/fake-animation-frame-scheduler.ts` | exact |
| `src/app/domain/dx7/persistence/saved-document.ts` | model | transform | `src/app/domain/dx7/models/patch.ts` | exact |
| `src/app/domain/dx7/persistence/parse-saved-document.ts` | utility | transform | `src/app/domain/dx7/dsp/worklet-messages.ts` | exact |
| `src/app/domain/dx7/persistence/parse-saved-document.spec.ts` | test | transform | `src/app/domain/dx7/dsp/worklet-messages.spec.ts` | exact |
| `src/app/state/saved-document-store.ts` | store | CRUD | `src/app/state/lesson-progress.ts` | role-match |
| `src/app/state/saved-document-store.spec.ts` | test | CRUD | `src/app/state/lesson-progress.spec.ts` | role-match |
| `src/app/state/playground-patch-slot.ts` | store | CRUD | `src/app/state/instrument-state.ts` | exact |
| `src/app/state/playground-patch-slot.spec.ts` | test | CRUD | `src/app/state/instrument-state.spec.ts` | exact |
| `src/app/state/lesson-progress.ts` | store | CRUD | itself | exact |
| `src/app/state/lesson-progress.spec.ts` | test | CRUD | itself | exact |
| `src/app/state/instrument-state.ts` | store | CRUD | itself (`reset` / `recallSnapshot` / `randomize`) | exact |
| `src/app/state/instrument-state.spec.ts` | test | CRUD | itself | exact |
| `src/app/features/play-surface/play-surface.ts` | component | event-driven | itself (`pressKey` / `noteHoldCount`) | exact |
| `src/app/features/play-surface/play-surface.html` | component | event-driven | itself (`Enable audio` gate) | exact |
| `src/app/features/play-surface/play-surface.spec.ts` | test | event-driven | itself | exact |
| `src/app/features/playground/playground.ts` | component | request-response | itself | exact |
| `src/app/features/playground/playground.spec.ts` | test | request-response | itself | exact |
| `src/app/features/playground/tools-panel/tools-panel.ts` | component | CRUD | itself (`resetPatch` / `randomizePatch`) | exact |
| `src/app/features/playground/tools-panel/tools-panel.spec.ts` | test | CRUD | itself | exact |
| `src/app/features/settings/settings.ts` | component | request-response | `src/app/features/playground/tools-panel/tools-panel.ts` | role-match |
| `src/app/features/settings/settings.html` | component | request-response | `src/app/features/about/about.html` | role-match |
| `src/app/features/settings/settings.scss` | component | request-response | `src/app/features/about/about.scss` | exact |
| `src/app/features/settings/settings.spec.ts` | test | request-response | `src/app/features/playground/tools-panel/tools-panel.spec.ts` | role-match |
| `src/app/app.routes.ts` | route | request-response | itself (`about` lazy route) | exact |
| `src/app/app.html` | component | request-response | itself (primary nav) | exact |
| `src/app/app.spec.ts` | test | request-response | itself | exact |
| `src/app/features/learn/lesson-detail/lesson-detail.spec.ts` | test | CRUD | itself | exact |

`lesson-detail.ts` is **not** modified — isolation is proven by tests that opening a lesson does not call `PlaygroundPatchSlot.write`.

## Pattern Assignments

### `src/app/core/browser/midi-access.token.ts` (provider, event-driven)

**Analog:** `src/app/core/audio/audio-context.token.ts`

**Imports pattern** (lines 1, 72–107):
```typescript
import { InjectionToken } from '@angular/core';

/** A *constructor*, never an instance — nothing here is ever constructed at
 * module/DI-factory time. */
export type AudioContextConstructorLike = new () => AudioContextLike;

function resolveAudioContextConstructor(): AudioContextConstructorLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  // narrowing cast confined to this one factory
  return globalWindow.AudioContext ?? globalWindow.webkitAudioContext ?? null;
}

export const AUDIO_CONTEXT_CTOR = new InjectionToken<AudioContextConstructorLike | null>(
  'AUDIO_CONTEXT_CTOR',
  { providedIn: 'root', factory: resolveAudioContextConstructor },
);
```

**Core pattern — hand-rolled Like surface, factory never constructs:**
Copy `AudioContextLike` (lines 59–70): a fraction of the real API, only members this app needs. MIDI token must declare `MidiAccessLike` / `MidiInputLike` / `MidiPortLike` / `RequestMidiAccessLike` the same way — TypeScript 6 `lib.dom` has no MIDI types in this repo.

Factory may **read** `typeof navigator.requestMIDIAccess === 'function'` (feature detect → `null` = D-05 `unsupported`). Factory must **not** *call* `requestMIDIAccess` (D-08). RESEARCH names:

```typescript
export const REQUEST_MIDI_ACCESS = new InjectionToken<RequestMidiAccessLike | null>(
  'REQUEST_MIDI_ACCESS',
  {
    providedIn: 'root',
    factory: (): RequestMidiAccessLike | null => {
      if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
        return null;
      }
      return (options) => navigator.requestMIDIAccess(options);
    },
  },
);
```

**Auth/Guard:** none (no accounts). Permission is the Enable MIDI click, not this factory.

**Error handling:** `null` token = honest `unsupported`, matching `AUDIO_CONTEXT_CTOR === null` → `'unavailable'` in `WorkletSynthEngine` lines 117–119. Do not throw from the factory.

---

### `src/app/core/midi/midi-session.ts` (service, event-driven)

**Analog:** `src/app/core/audio/worklet-synth-engine.ts` (status machine + user-gesture `initialize`) plus `src/app/core/browser/motion-preference.ts` (private writable + `DestroyRef` listener cleanup).

**Imports pattern** (`worklet-synth-engine.ts` lines 1, 26–32, 110–122):
```typescript
import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';
import { AUDIO_CONTEXT_CTOR, type AudioContextConstructorLike } from './audio-context.token';

@Injectable({ providedIn: 'root' })
export class WorkletSynthEngine implements SynthEngine {
  private readonly contextCtor = inject(AUDIO_CONTEXT_CTOR);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _status = signal<AudioEngineStatus>(
    this.contextCtor === null || this.nodeCtor === null ? 'unavailable' : 'suspended',
  );
  readonly status: Signal<AudioEngineStatus> = this._status.asReadonly();
```

**Core pattern — null token → terminal unsupported without calling the API** (`worklet-synth-engine.ts` 117–119, 183–189):
```typescript
async initialize(): Promise<void> {
  if (this.contextCtor === null || this.nodeCtor === null || this.context !== null) {
    return;
  }
  if (this.pendingInitialize !== null) {
    return this.pendingInitialize;
  }
```

`MidiSession.enable()` copies this: if `REQUEST_MIDI_ACCESS === null`, set `'unsupported'` and return. Never call the API on construction. Idempotent re-enable: if access already exists, reattach handlers rather than a second `requestMIDIAccess` (RESEARCH Open Question 2).

**Core pattern — DestroyRef cleanup** (`motion-preference.ts` 61–71):
```typescript
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
```

MIDI: attach `access.onstatechange` and selected-port `onmidimessage` only after enable; on disable/`DestroyRef` set both to `null` (W3C GC). Do **not** add an `effect()` to derive status — write `_status` from the port-change handler only.

**Error handling** (`play-surface.ts` 133–142 swallows initialize failures onto engine status):
```typescript
async enableAudio(): Promise<void> {
  this.enabling.set(true);
  try {
    await this.engine.initialize();
  } catch {
    // Failure reporting stays on the engine's `status` signal
  } finally {
    this.enabling.set(false);
  }
}
```

`MidiSession.enable` maps `DOMException.name === 'NotAllowedError'` → `'permission-denied'`, anything else → `'unsupported'`. Catch at the session so the click handler never surfaces an unhandled rejection.

**Status union analog:** copy `AudioEngineStatus` in `synth-engine.ts` lines 9–13 (named string union, UI stays navigable in every state). MIDI internal union includes `'off'` (pre-enable, Pitfall 9) plus D-05: `'unsupported' | 'permission-denied' | 'no-devices' | 'disconnected' | 'ready'`.

**Disable / disconnect analog:** `allNotesOff` at `worklet-synth-engine.ts` 457–460. Session injects `SYNTH_ENGINE` (`synth-engine.token.ts` lines 17–20) and calls `allNotesOff()` on disable and selected-device disconnect (D-09).

Do **not** attach `onmidimessage` to every input (RESEARCH anti-pattern). Select one port: saved id if present else first `inputs.values()` (D-03).

---

### `src/app/core/midi/testing/fake-midi-access.ts` (utility, event-driven)

**Analog:** `src/app/core/audio/testing/fake-audio-context.ts`

**Imports / class shape** (lines 1–9, 196–206, 223–230):
```typescript
import type { AudioContextLike, ... } from '../audio-context.token';

export class FakeAudioContext implements AudioContextLike {
  static readonly instances: FakeAudioContext[] = [];
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
}
```

**Core pattern:** hand-rolled class implementing the Like interface; no test library; record calls so specs assert behavior. MIDI fake needs:
- `FakeMidiInput` with `id`, `name`, `state`, settable `onmidimessage`, helper `emit(data: Uint8Array)`
- `FakeMidiAccess` with a `Map`-backed `inputs` exposing `values()` iterator order (D-03), settable `onstatechange`, helper to add/remove ports
- `createFakeRequestMidiAccess({ rejectWith?: DOMException })` function matching `RequestMidiAccessLike`
- Reset `instances` in `beforeEach` like `FakeAudioContext.instances.length = 0` (`play-surface.spec.ts` 15–16)

**Secondary analog:** `FakeMediaQueryList` in `motion-preference.spec.ts` lines 5–27 (`emit` helper + listener store). Prefer a dedicated `testing/` file like audio, not an inline spec class, because `midi-session.spec.ts`, `play-surface.spec.ts`, and `settings.spec.ts` all need the same fake.

---

### `src/app/core/midi/midi-session.spec.ts` (test, event-driven)

**Analog:** `src/app/core/browser/motion-preference.spec.ts`

**TestBed token override** (lines 30–37):
```typescript
function setup(initialMatches: boolean) {
  const mediaQueryList = new FakeMediaQueryList(initialMatches);
  TestBed.configureTestingModule({
    providers: [{ provide: MATCH_MEDIA, useValue: () => mediaQueryList }],
  });
  return { service: TestBed.inject(MotionPreference), mediaQueryList };
}
```

Copy this: provide `REQUEST_MIDI_ACCESS` as a fake function, never `navigator`. Cases: token `null` → `'unsupported'` without calling; resolve → first `values()` selected; `NotAllowedError` → `'permission-denied'`; disconnect selected id → `'disconnected'`; other port ignored; same id returns → `'ready'`; `TestBed.resetTestingModule()` removes `onstatechange` (lines 57–64).

Also provide `{ provide: SYNTH_ENGINE, useValue: fakeEngine }` when asserting `allNotesOff` on disable — same override style as `playground.spec.ts` lines 39–44.

---

### `src/app/domain/dx7/midi/parse-midi-note-message.ts` (utility, transform)

**Analog:** `src/app/domain/dx7/dsp/worklet-messages.ts` (`parseWorkletMessage` never-throw + ignore unknown kinds) plus bounds from `src/app/domain/dx7/audio/value-conversion.ts`.

**Imports pattern** (`worklet-messages.ts` 22–26, `value-conversion.ts` 26–35):
```typescript
import { OPERATOR_IDS, isOperatorId, type OperatorId } from '../models/operator';
import { MAX_VELOCITY, MIN_VELOCITY } from '../audio/value-conversion';

export const MIN_MIDI_NOTE = 0;
export const MAX_MIDI_NOTE = 127;
export const MIN_VELOCITY = 1;
export const MAX_VELOCITY = 127;
```

Zero Angular imports (DOMAIN-04). Import bounds — do not relitigate `0`/`127`/`1`/`127`.

**Core pattern — unknown in, typed or null, never throw** (`worklet-messages.ts` 265–276, 314–317):
```typescript
export function parseWorkletMessage(data: unknown): WorkletMessage | null {
  try {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return null;
    }
    // ...
    return null;
  } catch {
    return null;
  }
}
```

MIDI parser receives `Uint8Array | null` (not a structured object). Return `null` for short buffers, CC (`0xB0`), pitch bend, SysEx (`>= 0xf0`), out-of-range note. `(status & 0xf0) === 0x90 && velocity === 0` → `{ kind: 'off' }` — **never** `{ kind: 'on', velocity: 0 }` (`WorkletSynthEngine.validateVelocity` lines 77–82 throws on `0`).

**Validation:** reuse `MIN_MIDI_NOTE`/`MAX_MIDI_NOTE`/`MIN_VELOCITY`/`MAX_VELOCITY`. Channel nibble ignored (D-07 omni).

---

### `src/app/domain/dx7/midi/parse-midi-note-message.spec.ts` (test, transform)

**Analog:** `src/app/domain/dx7/dsp/worklet-messages.spec.ts`

**Hostile / rejected matrix** (lines 172–186, 423–425):
```typescript
it.each(rejectedPayloads)('returns null and throws nothing for $name', ({ payload }) => {
  expect(() => parseWorkletMessage(payload)).not.toThrow();
  expect(parseWorkletMessage(payload)).toBeNull();
});

it('returns null and throws nothing for a payload whose `kind` getter throws', () => {
  const hostilePayload = {
    get kind(): string {
      throw new Error('hostile getter');
    },
  };
  expect(() => parseWorkletMessage(hostilePayload)).not.toThrow();
  expect(parseWorkletMessage(hostilePayload)).toBeNull();
});
```

Rows for MIDI: note-on `0x90` vel 1–127; vel 0 → off; `0x80` → off (ignore off-velocity); `0xB0` CC → null; length `< 3` → null; note `128` → null; channel `0x9F` still on (omni). No Angular TestBed — pure `describe` like this file.

---

### `src/app/core/persistence/storage.token.ts` (provider, file-I/O)

**Analog:** `src/app/core/browser/animation-frame.token.ts` (always returns a Like; no-op fallback, never `null`)

**Factory + no-op fallback** (lines 22–45):
```typescript
function resolveAnimationFrameScheduler(): AnimationFrameScheduler {
  if (
    typeof window === 'undefined' ||
    typeof window.requestAnimationFrame !== 'function' ||
    typeof window.cancelAnimationFrame !== 'function'
  ) {
    return {
      request: () => 0,
      cancel: () => undefined,
    };
  }
  return {
    request: (callback) => window.requestAnimationFrame(callback),
    cancel: (handle) => window.cancelAnimationFrame(handle),
  };
}

export const ANIMATION_FRAME_SCHEDULER = new InjectionToken<AnimationFrameScheduler>(
  'ANIMATION_FRAME_SCHEDULER',
  { providedIn: 'root', factory: resolveAnimationFrameScheduler },
);
```

**Do not copy `AUDIO_CONTEXT_CTOR`'s `null`.** RESEARCH: token always yields `StorageLike`. Probe with try/catch `setItem`/`removeItem` (MDN `storageAvailable`) — Safari private mode exposes a quota-zero `Storage` that still throws. Never `localStorage.clear()`.

```typescript
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

---

### `src/app/core/persistence/testing/fake-storage.ts` (utility, file-I/O)

**Analog:** `src/app/core/browser/testing/fake-animation-frame-scheduler.ts`

**In-memory Like** (lines 1–12, 18–22):
```typescript
export class FakeAnimationFrameScheduler implements AnimationFrameScheduler {
  private readonly pending = new Map<number, (timestampMs: number) => void>();
  request(callback: (timestampMs: number) => void): number { /* ... */ }
  cancel(handle: number): void { /* ... */ }
}
```

`FakeStorage` implements `StorageLike` with a `Map<string, string>`. Extra test knobs (mirroring `ThrowingAudioContext` at `fake-audio-context.ts` 273–277): a `throwOnSetItem` flag or subclass so quota failure keeps live state (Pitfall 6). Specs share one instance across two `TestBed` injectors to simulate reload (`lesson-progress.spec.ts` "fresh injector" pattern, but with the same fake storage provided both times).

---

### `src/app/domain/dx7/persistence/saved-document.ts` (model, transform)

**Analog:** `src/app/domain/dx7/models/patch.ts`

**Types + frozen default + throwing validator** (lines 23–27, 50–66):
```typescript
export interface InstrumentPatch {
  readonly algorithmId: AlgorithmId;
  readonly operators: OperatorParameterSet;
  readonly feedback: number;
}

export const DEFAULT_PATCH: InstrumentPatch = Object.freeze({
  algorithmId: DEFAULT_ALGORITHM_ID,
  operators: buildDefaultOperators(),
  feedback: 0,
});

export function validateFeedbackLevel(level: number): void {
  if (!Number.isInteger(level) || level < MIN_FEEDBACK_LEVEL || level > MAX_FEEDBACK_LEVEL) {
    throw new RangeError(/* ... */);
  }
}
```

Copy: `PERSISTENCE_SCHEMA_VERSION`, `PERSISTENCE_STORAGE_KEY`, `EXPORT_FILENAME`, `SavedDocument` interface, `defaultSavedDocument()` returning `DEFAULT_PATCH` + `[]` + `null` (RESEARCH names). Zero Angular. Do not serialize `SnapshotSlots` (Phase 3 D-05).

---

### `src/app/domain/dx7/persistence/parse-saved-document.ts` (utility, transform)

**Analog:** `src/app/domain/dx7/dsp/worklet-messages.ts`

**Exact-six operator keys** (lines 140–142, 227–241) — **do not import** `isOperatorParameterSetLike` (it is private; RESEARCH Open Question 1: duplicate the rule, do not import DSP into persistence):
```typescript
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOperatorParameterSetLike(value: unknown): value is OperatorParameterSet {
  if (!isPlainObject(value)) {
    return false;
  }
  if (Object.keys(value).length !== OPERATOR_IDS.length) {
    return false;
  }
  return OPERATOR_IDS.every((id) => isValidOperatorParametersEntry(value[String(id)]));
}
```

**Fail-closed wrap** (lines 272–276, 315–317): whole body in `try/catch`; non-object / array root → `null`; `schemaVersion !== 1` → `null`. Rebuild `OperatorParameterSet` by iterating `OPERATOR_IDS` and reading `raw[String(id)]` (Pitfall 4 — JSON keys are strings). Call `validateOperatorParameters` / `validateFeedbackLevel` / `isAlgorithmId` / `isLessonId` (`algorithm.ts` 14–16, `lesson-definition.ts` 102–104) inside the try. Unknown extra keys ignored (D-27). Unknown lesson slugs dropped, not fatal (Assumption A3).

**Error handling:** never throw to UI. `null` means malformed. Callers (`SavedDocumentStore`) decide D-26 recovery vs refuse-import.

---

### `src/app/domain/dx7/persistence/parse-saved-document.spec.ts` (test, transform)

**Analog:** `src/app/domain/dx7/dsp/worklet-messages.spec.ts` T-08-01 matrix

Copy `it.each` rejected rows plus throwing-getter case (lines 172–186). Required rows from RESEARCH Wave 0: non-JSON (codec takes `unknown` after `JSON.parse` — also test a wrapper that `JSON.parse`s in try/catch), array root, missing `schemaVersion`, `schemaVersion: 2`, seventh operator key (line 423–425), Dexed-like / SysEx-as-text, `__proto__` key, extra unknown keys on valid v1 (**must succeed**), hostile getters. Round-trip: `JSON.parse(JSON.stringify(defaultSavedDocument()))` rebuilds numeric operator keys.

---

### `src/app/state/saved-document-store.ts` (store, CRUD)

**Analog:** `src/app/state/lesson-progress.ts` (root facade, private writable, validate-then-write) plus `MotionPreference` constructor hydrate from injected browser API.

**Facade shape** (`lesson-progress.ts` 16–51):
```typescript
@Injectable({ providedIn: 'root' })
export class LessonProgress {
  private readonly _completed = signal<ReadonlySet<LessonId>>(new Set());
  readonly completed: Signal<ReadonlySet<LessonId>> = this._completed.asReadonly();

  markComplete(lessonId: LessonId): void {
    if (!isLessonId(lessonId)) {
      throw new RangeError(/* ... */);
    }
    // immutable set write
    this._completed.set(new Set([...previous, lessonId]));
  }
}
```

**Constructor hydrate analog:** `MotionPreference` lines 56–57 read the injected API once at construction. `SavedDocumentStore` injects `STORAGE`, `getItem(PERSISTENCE_STORAGE_KEY)`: missing → `defaultSavedDocument()`; present but `parseSavedDocument` fails → write defaults + set a read-only `recoveryMessage` signal (D-26). Do not throw. Do not use `effect()` to persist.

**Commands:** `persistLessonProgress`, `writePlaygroundPatch`, `setLastMidiDeviceId`, `exportJson` / `importJson` / `clear` (confirm lives in Settings, not here). Import: parse first; only on success `setItem` then hydrate live facades (Pitfall 7). `setItem` still try/catch — quota failure keeps live state, sets Settings explanation (Pitfall 6).

**Do not put storage inside `InstrumentState`** (Phase 3 D-05; `instrument-state.ts` lines 100–103).

---

### `src/app/state/playground-patch-slot.ts` (store, CRUD)

**Analog:** `src/app/state/instrument-state.ts`

**Validate-then-one-write** (`randomize` lines 225–234, `reset` 295–297, `recallSnapshot` 266–275):
```typescript
randomize(rng: RandomSource = Math.random): void {
  const previous = this._patch();
  const candidate = randomWalkPatch(previous, rng);
  for (const operatorId of OPERATOR_IDS) {
    validateOperatorParameters(candidate.operators[operatorId]);
  }
  validateFeedbackLevel(candidate.feedback);
  this._patch.set({ ...previous, operators: candidate.operators, feedback: candidate.feedback });
}

reset(): void {
  this._patch.set(DEFAULT_PATCH);
}
```

Slot is a thin root facade: `read(): InstrumentPatch` / `write(patch: InstrumentPatch): void`. `write` validates then asks `SavedDocumentStore` to persist. **Call-site origin** (RESEARCH Pattern 3): only ToolsPanel Randomize/Reset (and Settings import/clear) call `write`. Do not subscribe to `instrumentState.patch()`.

**New `InstrumentState.replacePatch(patch)`** (needed for Playground restore / import-on-playground): copy `randomize`'s validate-all-six-then-one-`_patch.set`, but replace the whole patch including `algorithmId` via `resolveAlgorithm` first (`setAlgorithm` lines 157–161). Do not add storage here.

---

### `src/app/state/lesson-progress.ts` (store, CRUD) — modify

**Analog:** itself. Add `replaceCompleted(ids: ReadonlySet<LessonId>): void` using the same `isLessonId` RangeError as `markComplete` (lines 42–51). After a successful `markComplete` write, call `SavedDocumentStore.persistLessonProgress`. One-way ratchet stays; clear/import are the only replace path.

**Circular DI:** `LessonProgress` must not construct-inject `SavedDocumentStore` if the store also injects `LessonProgress`. Prefer: store hydrates via `replaceCompleted` after both exist. Do **not** call `inject(SavedDocumentStore)` from `markComplete`: method-level `inject()` can fail with NG0203 when invoked outside an Angular injection context. The working lazy lookup is constructor-injected `Injector` plus `this.injector.get(SavedDocumentStore)` after the set write. Closest existing pattern is `WorkletSynthEngine` injecting `InstrumentState` one-way (`worklet-synth-engine.ts` 115) — keep persistence store as the writer, `LessonProgress` as the live set. Planner: `SavedDocumentStore` injects `LessonProgress` and calls `replaceCompleted`; `markComplete` looks up the store via `Injector.get`. Prefer `LessonProgress` injecting `SavedDocumentStore` only if there is no cycle; otherwise persist inside `markComplete` via `Injector.get(SavedDocumentStore)` after the set write — Angular `providedIn: 'root'` cycles are OK if one injects lazily in a method not the field initializer.

Existing `inject()` field style: `tools-panel.ts` line 25, `learn.ts` line 31. Copy field `inject` if no cycle; otherwise keep the constructor `Injector` plus `Injector.get` workaround for `markComplete` rather than method-level `inject()`.

---

### `src/app/features/play-surface/play-surface.ts` + `.html` (component, event-driven) — modify

**Analog:** itself.

**Ownership / hold count** (lines 83–91, 210–236) — MIDI is a third owner on this path (D-16/D-17):
```typescript
protected pressKey(note: number): boolean {
  if (!this.isReady()) {
    return false;
  }
  this.engine.noteOn(note, PLAYABLE_VELOCITY);
  this.noteHoldCount.set(note, (this.noteHoldCount.get(note) ?? 0) + 1);
  this.markHeld(note);
  this.notePlayed.emit(note);
  return true;
}
```

Change signature to `pressKey(note: number, velocity: number = PLAYABLE_VELOCITY)` (Pitfall 3). Pointer/keyboard omit the second arg. MIDI passes 1–127. Keep `PLAYABLE_VELOCITY = 100` for non-MIDI.

**MIDI held set analog:** `keyboardHeldByCode` Map (lines 79–81, 312–316) — a `midiHeldNotes = new Set<number>()`. Repeat note-on: do not increment hold count again; still `pressKey` to retrigger. Off: delete and `releaseKey`.

**Enable-audio focus (Pitfall 1 / D-10)** — split this (lines 133–153):
```typescript
if (this.isReady()) {
  this.changeDetector.detectChanges();
  const firstKey = this.host.nativeElement.querySelector('.key') as HTMLButtonElement | null;
  firstKey?.focus();
}
```

`initializeAudio()` = gesture + `engine.initialize()`, **no focus**. `enableAudio()` calls it then focuses first `.key`. Enable MIDI calls `initializeAudio()` only (D-06 + D-10).

**Cleanup analog:** constructor `DestroyRef` (lines 119–128) and `onWindowBlur` (345–351) already `allNotesOff` + clear hold maps. MIDI disable/unmount must also clear `midiHeldNotes` and unregister the session callback.

**Template analog** (`play-surface.html` 1–18): persistent `role="status"` + `@if` gate button. Add a second button that reads Enable MIDI / Disable MIDI from session status (D-09). Short status includes device name when ready (D-05). Do not color-only — keep the warning class as a supplement like `status--warning` (line 3).

**Highlight analog:** `[class.key--pressed]="heldNotes().has(key.note)"` already only iterates `PLAYABLE_KEYS` (C4–B4, `keyboard-note-map.ts` 8–9). Full-range MIDI notes in `heldNotes` sound but do not highlight extra keys (D-15) with no template change.

Register a MidiSession message callback in the constructor; unregister on `DestroyRef`. When PlaySurface is unmounted (Settings/About), notes do not sound (D-01).

---

### `src/app/features/play-surface/play-surface.spec.ts` (test, event-driven) — extend

**Analog:** itself (`play-surface.spec.ts` 14–35, 53–63, 66–77)

```typescript
providers: [
  { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioWorkletContext },
  { provide: AUDIO_WORKLET_NODE_CTOR, useValue: FakeAudioWorkletNode },
],
```

Add `{ provide: REQUEST_MIDI_ACCESS, useValue: fakeRequest }` and `{ provide: STORAGE, useValue: new FakeStorage() }`. Keep the enable-audio-focus spec. Add: Enable MIDI does **not** change `document.activeElement`; MIDI note emits `notePlayed`; MIDI+pointer share hold count (existing multi-source describe at line 140). Find Enable MIDI by button text like `tools-panel.spec.ts` `findButton` (lines 22–31), not `button.button--primary` (that selector is Enable audio).

---

### `src/app/features/playground/playground.ts` (component, request-response) — modify

**Analog:** itself (thin host, lines 18–37) plus `lesson-detail.ts` constructor apply (but **without** `effect()`).

Playground constructor (or `afterNextRender` once): `instrumentState.replacePatch(playgroundPatchSlot.read())`. RESEARCH Assumption A5: `loadComponent` creates a new instance per navigation — constructor restore is enough. Do **not** add `effect()` on the route. Do **not** write the slot here.

`playground.html` stays: `<app-play-surface />` then visualizer then tools (lines 6–10). No MIDI chrome on this page beyond PlaySurface.

---

### `src/app/features/playground/tools-panel/tools-panel.ts` (component, CRUD) — modify

**Analog:** itself (`resetPatch` / `randomizePatch` lines 87–96).

After `state.reset()` / `state.randomize()`, call `playgroundPatchSlot.write(this.state.patch())`. Capture/Recall do **not** write (D-19). Component stays a dispatcher — no storage logic of its own (`tools-panel.ts` 7–15).

---

### `src/app/features/settings/settings.ts` + `.html` + `.scss` (component, request-response)

**Analogs:**
- Route/page chrome: `src/app/features/about/about.ts` + `about.html` + `about.scss`
- Labelled controls + `role="status"`: `src/app/features/playground/tools-panel/tools-panel.ts` + `.html`
- Read-through facade, no local mirror: `src/app/features/learn/learn.ts` lines 29–31

**Component class** (`about.ts` 3–9 + `tools-panel.ts` 18–25):
```typescript
@Component({
  selector: 'app-about',
  imports: [],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {}
```

Settings is **not** empty: `changeDetection: ChangeDetectionStrategy.OnPush`, `inject(MidiSession)`, `inject(SavedDocumentStore)`, `inject(PlaygroundPatchSlot)`, `inject(InstrumentState)`, `inject(Router)` (to know if url is `/playground` for D-25 apply). `computed` for MIDI status copy and device list — no `effect()`.

**HTML sections** (`about.html` 3–8):
```html
<section aria-labelledby="what-heading">
  <h2 id="what-heading">What this is</h2>
  <p>...</p>
</section>
```

Two sections (RESEARCH): (1) MIDI — enable/disable, full state explanation, named `<select>` of ports with disconnected marker; (2) Saved data — export, import `<input type="file" accept=".json,application/json">`, clear, recovery/import error live region. Semantic headings. Status text carries the state.

**Control copy analog** (`tools-panel.html` 6–12, 27):
```html
<button type="button" class="button" [disabled]="!hasSnapshotA()" (click)="recallA()">
  {{ recallALabel() }}
</button>
<p class="tools-panel__status" role="status">{{ statusMessage() }}</p>
```

Labels state the condition in words (D-10 tools-panel: not color-only). MIDI `<select>` must include the disconnected selected id (D-04).

**SCSS analog** (`about.scss` 1–20): `@use '../../../styles/layout';` `:host { @include layout.page; }`, section spacing via `--space-*` tokens. No new visual language.

**Confirm analog:** **none in repo.** RESEARCH locked `window.confirm` for import-replace and clear. Call it in the click handler before store methods. Do not add a modal component.

**Export analog:** **none in repo.** RESEARCH `Blob` + `URL.createObjectURL` + `<a download>` + `revokeObjectURL`. Keep that helper next to the store or a tiny function in `core/persistence/` — do not invent a File System Access path.

---

### `src/app/features/settings/settings.spec.ts` (test, request-response)

**Analogs:** `about.spec.ts` (page copy) + `tools-panel.spec.ts` (find controls by accessible text)

```typescript
await TestBed.configureTestingModule({
  imports: [About],
}).compileComponents();
```

Settings TestBed must provide `REQUEST_MIDI_ACCESS`, `STORAGE`, audio fakes if PlaySurface is not on this page (it is not — Settings has its own Enable MIDI). Spy `window.confirm` with `vi.spyOn(window, 'confirm')`. Assert labelled file input, export button, clear button. Do not assert color.

---

### `src/app/app.routes.ts` + `app.html` + `app.spec.ts` (route / nav) — modify

**Analog:** itself.

**Lazy `loadComponent`** (`app.routes.ts` 42–46):
```typescript
{
  path: 'about',
  loadComponent: () => import('./features/about/about').then((m) => m.About),
  title: 'About — DX7 Algorithm Lab',
},
```

Insert `/settings` **after** `playground`, **before** `about`. Title: `'Settings — DX7 Algorithm Lab'`. Keep `path: '**'` last.

**Nav** (`app.html` 10–15): add `<a routerLink="/settings" routerLinkActive="is-active">Settings</a>` after Playground. No footer MIDI indicator (D-05). Footer motion line stays.

**Spec** (`app.spec.ts` 28–36): change `'exposes all four primary nav links'` to five labels `['Learn', 'Algorithms', 'Playground', 'Settings', 'About']` (Pitfall 10).

---

### `src/app/features/learn/lesson-detail/lesson-detail.spec.ts` (test, CRUD) — extend

**Analog:** itself + `lesson-detail.ts` `applyStartingPatch` (197–203).

Prove `startingPatch` still writes `InstrumentState` and does **not** call `PlaygroundPatchSlot.write` (Pitfall 5). Spy the slot. Existing `effect()` (181–194) stays — do not add storage there.

---

## Shared Patterns

### Browser-API InjectionToken (never construct / never call at factory)

**Source:** `src/app/core/audio/audio-context.token.ts` lines 72–107; `src/app/core/browser/motion-preference.ts` lines 29–35; `src/app/core/browser/animation-frame.token.ts` lines 22–45

**Apply to:** `REQUEST_MIDI_ACCESS`, `STORAGE`

- Feature-detect inside the factory; return `null` (MIDI) or no-op Like (storage).
- Tests `provide:` the token — never mock `navigator` / `window.localStorage`.
- The only file allowed to mention the real global is the token factory (audio-context comment lines 78–81).

```typescript
export const MATCH_MEDIA = new InjectionToken<typeof window.matchMedia>('MATCH_MEDIA', {
  providedIn: 'root',
  factory: () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia.bind(window)
      : unsupportedMediaQueryList,
});
```

### Private WritableSignal + read-only public selector

**Source:** `src/app/core/browser/motion-preference.ts` lines 56–59; `src/app/state/lesson-progress.ts` lines 18–21; `src/app/core/audio/worklet-synth-engine.ts` lines 117–122

**Apply to:** `MidiSession`, `SavedDocumentStore`, `PlaygroundPatchSlot`, `LessonProgress`

```typescript
private readonly _prefersReducedMotion = signal(this.matchMedia(REDUCED_MOTION_QUERY).matches);
readonly prefersReducedMotion: Signal<boolean> = this._prefersReducedMotion.asReadonly();
```

No `effect()` to derive UI. Exception remains `LessonDetail` startingPatch only.

### DestroyRef listener / node cleanup

**Source:** `src/app/core/browser/motion-preference.ts` lines 67–70; `src/app/features/play-surface/play-surface.ts` lines 119–128; `src/app/core/audio/worklet-synth-engine.ts` line 160

**Apply to:** `MidiSession` (`onstatechange` / `onmidimessage`), `PlaySurface` MIDI callback

### Fail-closed decode

**Source:** `src/app/domain/dx7/dsp/worklet-messages.ts` lines 265–276, 315–317

**Apply to:** `parseSavedDocument`, `parseMidiNoteMessage`, `JSON.parse` of storage/import text

```typescript
} catch {
  return null;
}
```

### Validate-then-immutable-write

**Source:** `src/app/state/instrument-state.ts` (`updateOperator` 174–188, `randomize` 225–234); `src/app/state/lesson-progress.ts` `markComplete` 42–51

**Apply to:** `replacePatch`, `PlaygroundPatchSlot.write`, `LessonProgress.replaceCompleted`, import hydrate

Live command APIs still throw `RangeError` on programmer error. Persistence **decode** must not throw through the UI (CONTEXT: fail closed into D-26).

### Domain validators at the boundary (do not hand-roll a weaker check)

**Source:** `validateOperatorParameters`, `validateFeedbackLevel` (`patch.ts` 60–66), `isAlgorithmId` (`algorithm.ts` 14–16), `isLessonId` (`lesson-definition.ts` 102–104), exact-six keys (`worklet-messages.ts` 227–241)

**Apply to:** `parseSavedDocument` playground patch. Duplicate exact-six-key + `value[String(id)]` — do not import private DSP helpers.

### TestBed fakes for browser tokens

**Source:** `play-surface.spec.ts` 17–22; `playground.spec.ts` 37–44; `motion-preference.spec.ts` 33–36

**Apply to:** every MIDI and persistence spec

```typescript
providers: [
  { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioWorkletContext },
  { provide: AUDIO_WORKLET_NODE_CTOR, useValue: FakeAudioWorkletNode },
],
```

### Semantic labelled controls + `role="status"` (not color-only)

**Source:** `play-surface.html` 1–7; `tools-panel.html` 1–12, 27; `about.html` section + `aria-labelledby`

**Apply to:** PlaySurface MIDI short status, Settings MIDI/persistence sections

### Lazy feature routes

**Source:** `src/app/app.routes.ts` lines 7–46

**Apply to:** `/settings` — `loadComponent` + `title`, never eagerly import the feature in `app.ts`.

### User-gesture audio start

**Source:** `WorkletSynthEngine.initialize` lines 177–189; `PlaySurface.enableAudio` 133–142

**Apply to:** Enable MIDI (D-06) via split `initializeAudio()` with no focus (D-10). Do not start audio from a MIDI note-on.

### Engine last-note-wins (do not reimplement)

**Source:** `worklet-synth-engine.ts` `noteOn` 429–443, `noteOff` stale-release comment 445–447, `allNotesOff` 457–460

**Apply to:** MIDI overlapping notes (D-13). PlaySurface still calls `pressKey`/`releaseKey`; engine ignores stale releases.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Settings import `<input type="file">` + `file.text()` | component | file-I/O | No file-picker or Blob download exists. Use RESEARCH snippet: labelled file input, size cap `262144`, `parseSavedDocument` before any write. |
| Settings export `Blob` + `<a download>` | utility | file-I/O | Same gap. Copy RESEARCH `downloadJson`; `revokeObjectURL` after click. |
| `window.confirm` for import/clear | component | request-response | No dialog component. RESEARCH locked native `confirm`; spy it in Settings specs. |

MIDI `maplike` `MIDIAccess.inputs` has no existing analog beyond `Map` iteration; implement `values()` order on the fake so D-03 is testable.

## Metadata

**Analog search scope:** `src/app/` (`core/audio`, `core/browser`, `core/audio/testing`, `core/browser/testing`, `domain/dx7`, `state`, `features/play-surface`, `features/playground`, `features/about`, `features/learn`, `app.routes.ts`, `app.html`, `app.spec.ts`)
**Files scanned:** 137 under `src/app/`
**Pattern extraction date:** 2026-09-09
