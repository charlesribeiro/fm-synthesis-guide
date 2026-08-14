# Phase 6: Guided lessons for Algorithm 32 and Algorithm 1 - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 15 (new) + 2 (modified)
**Analogs found:** 15 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/app/domain/dx7/lessons/lesson-definition.ts` | model | transform | `src/app/domain/dx7/models/operator.ts` | exact (restricted-literal + guard pattern) |
| `src/app/domain/dx7/lessons/lessons.ts` | model | CRUD (read-only dataset) | `src/app/domain/dx7/models/algorithms.ts` + `instrument-state.ts`'s `ALGORITHMS_BY_ID` | exact |
| `src/app/domain/dx7/lessons/try-this.ts` | utility | transform | `src/app/domain/dx7/models/derive-role.ts` (pure derivation function) | role-match |
| `src/app/state/lesson-progress.ts` | store | event-driven (command-based signal facade) | `src/app/state/instrument-state.ts` | exact |
| `src/app/features/play-surface/play-surface.ts` (+ html/scss) | component | event-driven (DOM input → engine command → output) | `src/app/features/playground/playground.ts` | exact (this IS the extraction source) |
| `src/app/features/playground/playground.ts` (modified: thin wrapper) | component | request-response | itself, pre-extraction version (same file, before/after) | exact |
| `src/app/features/learn/learn.ts` (+ html) (modified) | component | request-response (index/list) | `src/app/features/algorithms/algorithms.ts` (browse index, if present) — else `algorithm-detail.ts`'s composition style | role-match |
| `src/app/features/learn/lesson-detail/lesson-detail.ts` (+ html/scss) | route/component | request-response | `src/app/features/algorithms/algorithm-detail/algorithm-detail.ts` | exact |
| `src/app/domain/dx7/lessons/lesson-definition.spec.ts` | test | transform | `src/app/domain/dx7/models/operator.ts`'s sibling spec pattern | role-match |
| `src/app/domain/dx7/lessons/lessons.spec.ts` | test | CRUD | analog to `algorithms.ts` dataset spec | role-match |
| `src/app/domain/dx7/lessons/try-this.spec.ts` | test | transform | pure-function spec convention (domain layer) | role-match |
| `src/app/state/lesson-progress.spec.ts` | test | event-driven | `instrument-state.spec.ts` (facade test convention) | role-match |
| `src/app/features/play-surface/play-surface.spec.ts` | test | event-driven | `src/app/features/playground/playground.spec.ts` | exact (behavior-parity gate) |
| `src/app/features/learn/learn.spec.ts` (rewrite) | test | request-response | `algorithm-detail.spec.ts`'s route/component test style | role-match |
| `src/app/features/learn/lesson-detail/lesson-detail.spec.ts` | test | request-response | `algorithm-detail.spec.ts` | exact |
| `src/app/app.routes.ts` (modified: add `/learn/:lessonId`) | config | request-response | existing `/algorithms/:id` route entry | exact |

## Pattern Assignments

### `src/app/domain/dx7/lessons/lesson-definition.ts` (model, transform)

**Analog:** `src/app/domain/dx7/models/operator.ts` (full file, 18 lines)

**Restricted-literal + runtime guard pattern** (lines 12-18, quoted verbatim):
```typescript
export type OperatorId = 1 | 2 | 3 | 4 | 5 | 6;

export const OPERATOR_IDS: readonly OperatorId[] = [1, 2, 3, 4, 5, 6];

export function isOperatorId(value: number): value is OperatorId {
  return OPERATOR_IDS.includes(value as OperatorId);
}
```

Apply the identical shape for `LessonId` (string-literal union, e.g. `'algorithm-32' | 'algorithm-1'`)
with a frozen `LESSON_IDS` array and an `isLessonId(value: string): value is LessonId` guard — mirrors
this file exactly, just string instead of numeric literals.

**`InstrumentPatch` shape to reuse for `startingPatch`** — `src/app/domain/dx7/models/patch.ts:23-27`:
```typescript
export interface InstrumentPatch {
  readonly algorithmId: AlgorithmId;
  readonly operators: OperatorParameterSet;
  readonly feedback: number;
}
```
`LessonDefinition.startingPatch: InstrumentPatch` — do not invent a parallel shape.

**Frozen-immutability convention to mirror** — `src/app/domain/dx7/models/patch.ts:41-54` (comment
quoted verbatim: "Frozen at every level ... so no consumer can corrupt the shared reset/init target in
place (T-03-01)"). Each lesson's `startingPatch` must be built as its own new object (spread), never
by mutating `DEFAULT_PATCH`/`DEFAULT_OPERATOR_PARAMETERS`.

---

### `src/app/domain/dx7/lessons/lessons.ts` (model, CRUD/read-only dataset)

**Analog:** `src/app/state/instrument-state.ts` lines 55-58 (dataset-to-map lookup convention) and
`src/app/domain/dx7/models/algorithms.ts` (the dataset array itself)

**O(1) lookup-map pattern** (`src/app/state/instrument-state.ts:55-58`, quoted verbatim):
```typescript
/** O(1) selected-algorithm lookup — `ALGORITHMS` has no by-id helper of its own. */
const ALGORITHMS_BY_ID: ReadonlyMap<AlgorithmId, AlgorithmDefinition> = new Map(
  ALGORITHMS.map((algorithm) => [algorithm.id, algorithm]),
);
```
Apply identically: `export const LESSONS: readonly LessonDefinition[] = [...]` (the two content rows)
plus `const LESSONS_BY_ID: ReadonlyMap<LessonId, LessonDefinition> = new Map(LESSONS.map((l) => [l.id, l]))`.

**Ground-truth data for the two lesson rows** — `src/app/domain/dx7/models/algorithms.ts` (Algorithm 1
around line 77-87, Algorithm 32 around line 432-438):
```typescript
// Algorithm 1
{
  id: 1,
  name: 'Four-deep stack into operator 3, plus a two-deep tower into operator 1',
  edges: edges([
    { from: 6, to: 5 },
    { from: 5, to: 4 },
    { from: 4, to: 3 },
    { from: 2, to: 1 },
    { from: 6, to: 6 }, // feedback self-loop
  ]),
}

// Algorithm 32
{
  id: 32,
  name: 'Six independent carriers summed with no inter-operator modulation',
  edges: edges([
    { from: 6, to: 6 }, // feedback self-loop — the only edge
  ]),
}
```
Carrier/modulator roles must be read through `deriveCarriers`/`getOperatorRole` from
`src/app/domain/dx7/models/derive-role.ts` (Phase 2) — never hardcoded/restated in lesson copy.

---

### `src/app/domain/dx7/lessons/try-this.ts` (utility, transform)

**Analog:** pure-function domain convention (no single close analog file exists yet for "pure
predicate over two operator-parameter values" — nearest sibling is `derive-role.ts`'s pure-function
style: takes an `AlgorithmDefinition`, returns a derived value, zero Angular imports, zero side
effects).

**Required signature shape** (per RESEARCH.md, narrow `targetParam` to avoid Pitfall 3):
```typescript
export function hasMovedTowardTarget(
  baseline: OperatorParameters,
  current: OperatorParameters,
  tryThis: TryThisStep,
): boolean {
  const baselineValue = baseline[tryThis.targetParam];
  const currentValue = current[tryThis.targetParam];
  return tryThis.direction === 'increase' ? currentValue > baselineValue : currentValue < baselineValue;
}
```
Compare the specific `targetParam` value, never whole `OperatorParameters` objects by reference
(Pitfall 4). `targetParam` should be typed as
`Exclude<keyof OperatorParameters, 'enabled' | 'mode' | 'fixedFrequencyHz'>` per
`src/app/domain/dx7/models/operator-parameters.ts:28-41`'s field list — drop non-numeric
`enabled`/`mode` (no meaningful direction) and `fixedFrequencyHz` (documented inert in ratio
mode, so it cannot gate note-verified completion).

---

### `src/app/state/lesson-progress.ts` (store, event-driven)

**Analog:** `src/app/state/instrument-state.ts` (full file, 249 lines)

**Facade class shape / private-signal + `.asReadonly()`** (lines 96-101, quoted verbatim):
```typescript
@Injectable({ providedIn: 'root' })
export class InstrumentState {
  private readonly _patch = signal<InstrumentPatch>(DEFAULT_PATCH);

  /** Read-only: the full current patch (algorithm id + operators + feedback). */
  readonly patch: Signal<InstrumentPatch> = this._patch.asReadonly();
```
`LessonProgress` mirrors this: `private readonly _completed = signal<ReadonlySet<LessonId>>(new Set())`,
`readonly completed = this._completed.asReadonly()`.

**Parameterized-reader-method convention** (`hasSnapshot`, lines 228-234, quoted verbatim):
```typescript
/** D-03: whether the given slot currently holds a captured patch. Rejects a `slot` outside the fixed A/B contract with a `RangeError`. */
hasSnapshot(slot: SnapshotSlot): boolean {
  if (!isSnapshotSlot(slot)) {
    throw new RangeError(`slot must be one of ${SNAPSHOT_SLOTS.join(', ')}, received ${slot}`);
  }
  return this._snapshots()[slot] !== null;
}
```
`LessonProgress.isComplete(lessonId: LessonId): boolean` should follow this exact validate-then-read
shape.

**Validate-before-write command convention** (`setFeedback`, lines 181-185, quoted verbatim):
```typescript
setFeedback(level: number): void {
  validateFeedbackLevel(level);
  const previous = this._patch();
  this._patch.set({ ...previous, feedback: level });
}
```
`LessonProgress.markComplete(lessonId: LessonId): void` should validate `lessonId` via `isLessonId`
first (throwing `RangeError` on an unknown id, matching every `InstrumentState` command's posture),
then write immutably: `this._completed.set(new Set([...this._completed(), lessonId]))`. Per RESEARCH.md
Open Question 2, `markComplete` is a one-way ratchet — never removes from the set.

---

### `src/app/features/play-surface/play-surface.ts` (component, event-driven — extracted from Playground)

**Analog:** `src/app/features/playground/playground.ts` (full file, 275 lines) — this is a cut-and-paste
extraction source, not a stylistic analog. Move the code; do not rewrite it (Pitfall 5).

**Imports + component metadata to carry over** (lines 1-31, quoted verbatim):
```typescript
import { Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { SYNTH_ENGINE } from '../../core/audio/synth-engine.token';
import { PLAYABLE_KEYS, noteForKeyCode, type PlayableKey } from './keyboard-note-map';

const PLAYABLE_VELOCITY = 100;
const ACTIVATION_CODES = new Set(['Space', 'Enter']);

function isEditableTarget(target: EventTarget | null): boolean { /* ... */ }

@Component({
  selector: 'app-playground', // -> rename 'app-play-surface'
  imports: [],
  templateUrl: './playground.html',
  styleUrl: './playground.scss',
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
    '(document:keyup)': 'onDocumentKeyup($event)',
    '(window:blur)': 'onWindowBlur()',
  },
})
```
The `host` binding block MUST move with the component — only a component (not a directive/service) can
carry both a template and document-level listeners together.

**Core state fields to move verbatim** (lines 33-89): `engine`, `host`, `status`, `enabling`,
`isReady`, `_heldNote`/`heldNote`, `keyboardHeldCode`, `pointerHeldNote`, `buttonHeldNote`, `keys`.
Every one of these is load-bearing for the documented edge cases (right-click WR-07, Tab-mid-press
stranding, window-blur cleanup, OS auto-repeat) — do not reorder or drop any.

**`pressKey` — the one method that gains the new `notePlayed` output** (lines 157-164, quoted verbatim,
modified per RESEARCH.md Pattern 4):
```typescript
protected pressKey(note: number): boolean {
  if (!this.isReady()) {
    return false;
  }
  this.engine.noteOn(note, PLAYABLE_VELOCITY);
  this._heldNote.set(note);
  return true; // ADD: this.notePlayed.emit(note); before the return
}
```

**New `output()` to add** (first use of `output()` in this codebase — no prior import found):
```typescript
import { Component, output } from '@angular/core';

/** Emits the MIDI note number every time a note actually starts sounding
 * (i.e. only when pressKey() returns true — engine was ready). */
readonly notePlayed = output<number>();
```

**All other handlers** (`onKeyPointerDown`/`onKeyPointerUp`/`onKeyButtonKeydown`/`onKeyButtonKeyup`/
`onDocumentKeydown`/`onDocumentKeyup`/`onWindowBlur`/`releaseKey`/`enableAudio`, lines 95-275) move
unmodified — cleanup on destroy (line 92: `inject(DestroyRef).onDestroy(() => this.engine.allNotesOff())`)
must be preserved exactly (CLAUDE.md: "every voice ... must have an explicit cleanup path").

**`Playground` post-extraction** becomes a thin wrapper embedding `<app-play-surface />`; its own
`comingSoon` list (lines 84-89) and `enableAudio` gating stay if still relevant, or move into
`PlaySurface` — exact split is Claude's Discretion per CONTEXT.md.

---

### `src/app/features/learn/lesson-detail/lesson-detail.ts` (route/component, request-response)

**Analog:** `src/app/features/algorithms/algorithm-detail/algorithm-detail.ts` (full file, 85 lines)

**Imports pattern** (lines 1-11, quoted verbatim):
```typescript
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { AlgorithmId } from '../../../domain/dx7/models/algorithm';
import { MAX_ALGORITHM_ID, MIN_ALGORITHM_ID, isAlgorithmId } from '../../../domain/dx7/models/algorithm';
import {
  buildDiagramViewModelForId,
  type AlgorithmDiagramViewModel,
} from '../../../domain/dx7/diagram/build-diagram-view-model';
import { AlgorithmDiagram } from '../algorithm-diagram/algorithm-diagram';
```

**Route-param resolution pattern (cold-deep-link-safe)** (lines 34-52, quoted verbatim):
```typescript
@Component({
  selector: 'app-algorithm-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlgorithmDiagram, RouterLink],
  templateUrl: './algorithm-detail.html',
  styleUrl: './algorithm-detail.scss',
})
export class AlgorithmDetail {
  private readonly route = inject(ActivatedRoute);

  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly rawId = computed<string | null>(() => this.paramMap().get('id'));
```
Use identically for `:lessonId`, but validate via a set-membership guard (`isLessonId` against a
frozen `LESSON_IDS` array) instead of `AlgorithmDetail`'s `STRICT_INTEGER_ID_PATTERN` regex — the
lesson id is a string slug, not an integer.

**Not-found / validated-lookup pattern** (lines 54-68, quoted verbatim):
```typescript
protected readonly algorithmId = computed<AlgorithmId | null>(() => {
  const raw = this.rawId();
  if (raw === null || !STRICT_INTEGER_ID_PATTERN.test(raw)) {
    return null;
  }
  const parsed = Number(raw);
  return isAlgorithmId(parsed) ? parsed : null;
});

protected readonly viewModel = computed<AlgorithmDiagramViewModel | null>(() => {
  const id = this.algorithmId();
  return id === null ? null : buildDiagramViewModelForId(id);
});

protected readonly isUnresolved = computed(() => this.viewModel()?.reviewStatus === 'unresolved');
```
For `LessonDetail`: `computed<LessonId | null>` from raw param via `isLessonId`, then
`computed<LessonDefinition | null>` via `LESSONS_BY_ID.get(id)`, with an explicit not-found template
branch (never throw, per ASVS V5 posture already established here).

**D-04 setup on mount** — apply `lesson.startingPatch` via existing `InstrumentState` commands (not a
new bulk setter):
```typescript
// Composed from InstrumentState's existing command surface — instrument-state.ts:148-185
this.instrumentState.setAlgorithm(lesson.algorithmId);
for (const operatorId of OPERATOR_IDS) {
  this.instrumentState.updateOperator(operatorId, lesson.startingPatch.operators[operatorId]);
}
this.instrumentState.setFeedback(lesson.startingPatch.feedback);
```

**Embedding `AlgorithmDiagram` inline** (D-05) — same `[input]`-driven composition already used by
`AlgorithmDetail`'s template (`imports: [AlgorithmDiagram, RouterLink]`, line 37); `LessonDetail`
imports `AlgorithmDiagram` the same way and feeds it `buildDiagramViewModelForId(lesson.algorithmId)`.

**Untrusted-param-as-text-only security posture** (comment at lines 48-52, quoted verbatim): "The raw,
untrusted `:id` route param string — never bound into an attribute, a URL, or `innerHTML`; only ever
interpolated as text in the not-found branch." Apply identically to `:lessonId`.

---

### `src/app/features/learn/learn.ts` (component, request-response — rebuilt index)

**Analog:** itself pre-rewrite (`src/app/features/learn/learn.ts`, full file, 33 lines) plus the
browse-index → detail-route precedent Phase 4 established for `/algorithms`.

**Current placeholder shape to replace** (lines 1-33, quoted verbatim):
```typescript
import { Component } from '@angular/core';

interface UpcomingLesson {
  readonly algorithm: number;
  readonly title: string;
  readonly teaches: string;
}

@Component({
  selector: 'app-learn',
  imports: [],
  templateUrl: './learn.html',
  styleUrl: './learn.scss',
})
export class Learn {
  protected readonly upcomingLessons: readonly UpcomingLesson[] = [ /* static rows */ ];
}
```
Replace `upcomingLessons`/`UpcomingLesson` with `protected readonly lessons = LESSONS` (imported from
the new domain dataset) and inject `LessonProgress` to read `.isComplete(lesson.id)` per card for the
done/not-done checkmark (D-09). Add `RouterLink` to `imports` for the `/learn/:lessonId` links,
mirroring `AlgorithmDetail`'s `imports: [AlgorithmDiagram, RouterLink]` convention.

---

### `src/app/app.routes.ts` (config, request-response)

**Analog:** the existing `/algorithms/:id` lazy route entry (Phase 4 convention, confirmed via
RESEARCH.md: "Every feature route is lazy-loaded via `loadComponent`"). Add
`{ path: 'learn/:lessonId', loadComponent: () => import('./features/learn/lesson-detail/lesson-detail').then((m) => m.LessonDetail) }`
following the identical `loadComponent` shape already used for `algorithms/:id`.

---

## Shared Patterns

### Signal-facade shape (private writable signal + `.asReadonly()`)
**Source:** `src/app/state/instrument-state.ts:96-101`
**Apply to:** `src/app/state/lesson-progress.ts`
```typescript
private readonly _patch = signal<InstrumentPatch>(DEFAULT_PATCH);
readonly patch: Signal<InstrumentPatch> = this._patch.asReadonly();
```

### Restricted-literal type + frozen array + runtime guard
**Source:** `src/app/domain/dx7/models/operator.ts:12-18`
**Apply to:** `LessonId`/`LESSON_IDS`/`isLessonId` in `lesson-definition.ts`
```typescript
export type OperatorId = 1 | 2 | 3 | 4 | 5 | 6;
export const OPERATOR_IDS: readonly OperatorId[] = [1, 2, 3, 4, 5, 6];
export function isOperatorId(value: number): value is OperatorId {
  return OPERATOR_IDS.includes(value as OperatorId);
}
```

### Validate-before-write command posture
**Source:** `src/app/state/instrument-state.ts:181-185` (`setFeedback`), `:165-175` (`updateOperator`)
**Apply to:** `LessonProgress.markComplete`, any future lesson-domain command
```typescript
setFeedback(level: number): void {
  validateFeedbackLevel(level);
  const previous = this._patch();
  this._patch.set({ ...previous, feedback: level });
}
```

### Cold-deep-link-safe route param resolution
**Source:** `src/app/features/algorithms/algorithm-detail/algorithm-detail.ts:42-46`
**Apply to:** `LessonDetail`'s `:lessonId` resolution
```typescript
private readonly route = inject(ActivatedRoute);
private readonly paramMap = toSignal(this.route.paramMap, {
  initialValue: this.route.snapshot.paramMap,
});
```

### Untrusted route param — text-only interpolation, never innerHTML/attribute/URL
**Source:** `src/app/features/algorithms/algorithm-detail/algorithm-detail.ts:48-52` (comment)
**Apply to:** `LessonDetail`'s not-found branch for an unresolved `:lessonId`

### No `effect()` for cross-signal derivation
**Source:** CLAUDE.md Angular rules + RESEARCH.md Pitfall 1
**Apply to:** the D-06 completion check — split into a pure `computed()` ("moved in direction") plus an
imperative read from the `(notePlayed)` DOM-originated output event handler.
**Approved carve-out:** `LessonDetail` may use `effect()` solely for route-reuse-safe `startingPatch`
sync into `InstrumentState` (imperative sync with an external facade on the same component instance
when `:lessonId` changes). That is not cross-signal derivation and is the one narrow exception to
"no `effect` import in this phase."

### Cleanup-on-destroy for anything touching the audio engine
**Source:** `src/app/features/playground/playground.ts:91-93`
```typescript
constructor() {
  inject(DestroyRef).onDestroy(() => this.engine.allNotesOff());
}
```
**Apply to:** `PlaySurface` (carried over verbatim from `Playground`).

## No Analog Found

None — every file in this phase has at least a role-match analog already in the codebase (this phase
is pure composition of existing patterns per RESEARCH.md's "no genuinely new domain logic to invent"
finding). `try-this.ts`'s `hasMovedTowardTarget` is the closest thing to genuinely new logic, but it
still follows the established pure-function domain-layer convention (`derive-role.ts`) rather than
inventing a new one.

## Metadata

**Analog search scope:** `src/app/state/`, `src/app/features/algorithms/`, `src/app/features/playground/`,
`src/app/features/learn/`, `src/app/domain/dx7/models/`
**Files scanned:** `instrument-state.ts`, `playground.ts`, `algorithm-detail.ts`, `algorithms.ts`,
`operator.ts`, `patch.ts`, `operator-parameters.ts`, `learn.ts`, `derive-role.ts` (referenced)
**Pattern extraction date:** 2026-08-10
