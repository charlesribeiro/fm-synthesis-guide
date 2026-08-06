# Phase 4: Algorithm browser and SVG - Pattern Map

**Mapped:** 2026-08-05
**Files analyzed:** 12
**Analogs found:** 10 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/app/domain/dx7/diagram/algorithm-layout.ts` | model (static data) | transform | `src/app/domain/dx7/models/algorithms.ts` | exact |
| `src/app/domain/dx7/diagram/algorithm-layout.spec.ts` | test | transform | `src/app/domain/dx7/models/algorithms.spec.ts` | exact |
| `src/app/domain/dx7/diagram/build-diagram-view-model.ts` | utility (pure fn) | transform | `src/app/domain/dx7/models/derive-role.ts` | exact |
| `src/app/domain/dx7/diagram/build-diagram-view-model.spec.ts` | test | transform | `src/app/domain/dx7/models/derive-role.spec.ts` | exact |
| `src/app/domain/dx7/diagram/describe-algorithm.ts` | utility (pure fn) | transform | `src/app/domain/dx7/models/derive-role.ts` | exact |
| `src/app/domain/dx7/diagram/describe-algorithm.spec.ts` | test | transform | `src/app/domain/dx7/models/derive-role.spec.ts` | exact |
| `src/app/app.routes.ts` (modified) | route config | request-response | `src/app/app.routes.ts` (existing) | exact |
| `src/app/features/algorithms/algorithms.ts/.html/.scss/.spec.ts` (modified) | component | CRUD (read-only list) | itself (existing placeholder) | exact |
| `src/app/features/algorithms/algorithm-detail/algorithm-detail.ts/.html/.scss/.spec.ts` | component (route) | request-response | `src/app/features/algorithms/algorithms.ts` + `src/app/state/instrument-state.ts` (resolve-by-id pattern) | role-match |
| `src/app/features/algorithms/algorithm-diagram/algorithm-diagram.ts/.html/.scss/.spec.ts` | component (presentational, SVG) | transform (input signal → render) | `src/app/core/browser/motion-preference.ts` (signal facade shape) + `src/app/features/algorithms/algorithms.ts` (template `@for` style) | partial |
| `src/app/app.config.ts` | config | request-response | itself (existing) | exact |

## Pattern Assignments

### `src/app/domain/dx7/diagram/algorithm-layout.ts` (model, transform)

**Analog:** `src/app/domain/dx7/models/algorithms.ts`

**Module-level frozen dataset pattern** (lines 66-87 of `algorithms.ts`):
```typescript
const additiveStacksTags: readonly TeachingTag[] = Object.freeze(['additive-stacks']);
// ...
function edges(list: readonly ModulationEdge[]): readonly ModulationEdge[] {
  return Object.freeze(list.map((edge) => Object.freeze({ ...edge })));
}

export const ALGORITHMS: readonly AlgorithmDefinition[] = [
  Object.freeze({
    id: 1,
    name: 'Four-deep stack into operator 3, plus a two-deep tower into operator 1',
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 4, to: 3 },
      { from: 2, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: additiveStacksTags,
  }),
  // ...
];
```
**Apply this shape to `ALGORITHM_LAYOUTS`:** one frozen record per algorithm id, keyed via `Map` (per RESEARCH.md Pattern 1), each `{x, y}` position frozen individually — mirrors the "frozen at module load so a downstream phase cannot mutate the single source of truth in place" discipline already established.

**Doc-comment provenance/rationale style** (lines 1-65 of `algorithms.ts`): a top-of-file block comment stating what invariant the data enforces and why it's structured this way (D-05/D-06/D-07 references) — replicate at the top of `algorithm-layout.ts`.

**No-Angular-imports constraint:** `algorithms.ts` imports only from sibling domain files (`./algorithm-definition`, `./modulation-edge`), never Angular — `algorithm-layout.ts` must do the same (ESLint domain-purity rule, `eslint.config.js`).

---

### `src/app/domain/dx7/diagram/build-diagram-view-model.ts` and `describe-algorithm.ts` (utility, transform)

**Analog:** `src/app/domain/dx7/models/derive-role.ts`

**Pure-function-over-`AlgorithmDefinition` pattern** (full file, lines 1-55):
```typescript
import { OPERATOR_IDS, type OperatorId } from './operator';
import type { AlgorithmDefinition } from './algorithm-definition';

export type OperatorRole = 'carrier' | 'modulator';

export function getOperatorRole(
  algorithm: AlgorithmDefinition,
  operatorId: OperatorId,
): OperatorRole {
  const modulatesAnotherOperator = algorithm.edges.some(
    (edge) => edge.from === operatorId && edge.to !== operatorId,
  );
  return modulatesAnotherOperator ? 'modulator' : 'carrier';
}

export function deriveCarriers(algorithm: AlgorithmDefinition): readonly OperatorId[] {
  return OPERATOR_IDS.filter((id) => getOperatorRole(algorithm, id) === 'carrier');
}

export function getFeedbackOperator(algorithm: AlgorithmDefinition): OperatorId | null {
  const feedbackEdge = algorithm.edges.find((edge) => edge.from === edge.to);
  return feedbackEdge ? feedbackEdge.from : null;
}
```
**Apply this shape:** `build-diagram-view-model.ts` and `describe-algorithm.ts` must be plain exported functions taking `AlgorithmDefinition` (plus layout, for the former) and returning plain readonly objects — no classes, no Angular. `build-diagram-view-model.ts` MUST call `getOperatorRole`/`deriveCarriers`/`getFeedbackOperator` from `derive-role.ts` rather than re-deriving (RESEARCH.md Anti-Patterns — single source of truth).

**Fixed-order iteration convention:** `deriveCarriers` filters the fixed `OPERATOR_IDS` array (ascending) rather than scanning edges — mirror this in the view-model builder so node/edge arrays have deterministic order for `@for track`.

**Error-free/no-throw posture:** `derive-role.ts` functions never throw — they return `null`/empty on absence (`getFeedbackOperator` returns `null`, not throws). Both new pure functions should follow this — always resolvable once given a valid `AlgorithmDefinition`.

---

### `src/app/domain/dx7/diagram/*.spec.ts` (test)

**Analog:** `src/app/domain/dx7/models/derive-role.spec.ts` (and `algorithms.spec.ts` for dataset-completeness style tests)

Read only the corresponding `.ts` source was needed; both spec files follow standard Vitest `describe`/`it` blocks with no Angular `TestBed` (pure-function tests). Use the same import style: `import { functionUnderTest } from './module';` with fixture `AlgorithmDefinition` objects (reuse Algorithm 1 / Algorithm 32 fixtures per CONTEXT.md's Claude's Discretion note).

---

### `src/app/app.routes.ts` (modified) (route config, request-response)

**Analog:** itself, existing file (full content read, lines 1-38)

**Lazy-route registration pattern** (lines 18-22, existing `/algorithms` entry):
```typescript
{
  path: 'algorithms',
  loadComponent: () => import('./features/algorithms/algorithms').then((m) => m.Algorithms),
  title: 'Algorithms — DX7 Algorithm Lab',
},
```
**Apply directly** — add a new `path: 'algorithms/:id'` entry immediately after, following the exact same `loadComponent`/`title` shape (see RESEARCH.md Code Examples for the literal snippet). Preserve the existing top-of-file comment style explaining the lazy-load rationale.

---

### `src/app/features/algorithms/algorithms.ts/.html/.scss/.spec.ts` (modified) (component, CRUD read-only list)

**Analog:** itself — the existing placeholder (full content read)

**Component shape** (`algorithms.ts`, lines 1-43):
```typescript
import { Component } from '@angular/core';

interface AlgorithmGroup {
  readonly name: string;
  readonly range: string;
  readonly description: string;
}

@Component({
  selector: 'app-algorithms',
  imports: [],
  templateUrl: './algorithms.html',
  styleUrl: './algorithms.scss',
})
export class Algorithms {
  protected readonly groups: readonly AlgorithmGroup[] = [ /* four groups */ ];
}
```
**Template `@for` grouping pattern** (`algorithms.html`, lines 12-20):
```html
<ul class="group-list">
  @for (group of groups; track group.name) {
    <li class="group-card">
      <span class="group-card__range">{{ group.range }}</span>
      <h2>{{ group.name }}</h2>
      <p>{{ group.description }}</p>
    </li>
  }
</ul>
```
**Extension for this phase:** nest a second `@for` inside each group card iterating the group's `ALGORITHMS` entries (filtered by `teachingTags`) rendering number + `name` text (Pitfall 3: `name` is a long sentence, size the card CSS accordingly) with a `routerLink` to `/algorithms/:id`. Replace the `role="status"` placeholder paragraph (lines 7-10 of `algorithms.html`) entirely — it exists only to announce "not built yet."

**Test pattern** (`algorithms.spec.ts`, full file): `TestBed.configureTestingModule({ imports: [Algorithms] }).compileComponents()`, then query rendered DOM by CSS class and assert `textContent`. Extend with assertions that every algorithm number 1–32 renders and each links to the correct `/algorithms/:id` href.

---

### `src/app/features/algorithms/algorithm-detail/*` (component route, request-response)

**Analog (id resolution + not-found guard style):** `src/app/state/instrument-state.ts`, `resolveAlgorithm` helper (lines 55-66):
```typescript
const ALGORITHMS_BY_ID: ReadonlyMap<AlgorithmId, AlgorithmDefinition> = new Map(
  ALGORITHMS.map((algorithm) => [algorithm.id, algorithm]),
);

function resolveAlgorithm(algorithmId: AlgorithmId): AlgorithmDefinition {
  const algorithm = ALGORITHMS_BY_ID.get(algorithmId);
  if (!algorithm) {
    throw new RangeError(`algorithmId ${algorithmId} is not a known algorithm (expected 1..32)`);
  }
  return algorithm;
}
```
**Adapt for the route component:** don't throw — `isAlgorithmId` (from `src/app/domain/dx7/models/algorithm.ts`, lines 14-16) should gate the lookup, and a failed lookup routes to an in-component not-found template state (RESEARCH.md Anti-Patterns) rather than a `RangeError`/redirect. The `Map`-by-id build-once pattern (module-level `ReadonlyMap`) is directly reusable for `ALGORITHMS_BY_ID` in the diagram view-model module too, avoiding a second copy of this map (build it once, e.g. exported from `algorithm-layout.ts` or a shared diagram-domain module, and import it in both `algorithm-detail.ts` and `build-diagram-view-model.ts` if useful).

**`isAlgorithmId` guard** (`src/app/domain/dx7/models/algorithm.ts`, lines 14-16):
```typescript
export function isAlgorithmId(value: number): value is AlgorithmId {
  return Number.isInteger(value) && value >= MIN_ALGORITHM_ID && value <= MAX_ALGORITHM_ID;
}
```
Use this directly to validate the route `:id` param before any lookup (Security Domain V5, RESEARCH.md).

**No existing routed-component analog in this codebase** (`algorithm-detail.ts` is the first component to read `ActivatedRoute`/route params) — RESEARCH.md's Code Examples section (Pitfall 1, `RouterTestingHarness`) is the primary source for this file's test shape since no in-repo precedent exists yet. `app.routes.ts` supplies the lazy-load registration convention (see above).

---

### `src/app/features/algorithms/algorithm-diagram/*` (presentational SVG component, transform)

**Analog for signal-facade / readonly-signal shape:** `src/app/core/browser/motion-preference.ts` (full file, lines 1-73):
```typescript
@Injectable({ providedIn: 'root' })
export class MotionPreference {
  private readonly _prefersReducedMotion = signal(this.matchMedia(REDUCED_MOTION_QUERY).matches);
  readonly prefersReducedMotion: Signal<boolean> = this._prefersReducedMotion.asReadonly();
  // constructor wires an external system's imperative event to signal.set(), with DestroyRef cleanup
}
```
**Apply to `AlgorithmDiagram`'s local selection state (D-10):** private writable `signal<OperatorId | null>(null)`, public `.asReadonly()` exposed as `selectedOperator`, mutated only through an explicit method (`selectNode`) — same private-signal/public-readonly-signal/explicit-mutator shape used everywhere state is held in this codebase (`InstrumentState` uses the identical pattern for `_patch`/`patch`).

**Template `@for` + data-attribute style analog:** `algorithms.html` (lines 12-20, shown above) — `@for (x of xs; track x.stableKey)`. Apply `track node.id` / `track edge.id` in the SVG template per RESEARCH.md Pitfall 4 (never track by object reference on a view-model rebuilt per selection change).

**No existing SVG or accessible-diagram component exists in this codebase** — this is the first. RESEARCH.md's Pattern 2 (`algorithm-diagram.ts`/`.html` code block, lines ~318-409 of RESEARCH.md) is the authoritative source for markup shape (no `role="img"` on the root SVG; `<title>`/`<desc>`/`aria-labelledby`; interactive `<g role="button">` per operator with `data-operator-id`/`data-role`; instance-scoped `algorithm-{id}-diagram-{title|desc|arrow}-{instance}` ids with matching `marker-end` bindings; shape-not-color encoding per D-08; dashed feedback path per D-09). Treat that code block as the primary pattern source for this file since no in-repo precedent exists.

**Reduced-motion CSS token analog:** per RESEARCH.md's Anti-Patterns, any CSS transition on `.operator--selected` or the feedback path must reuse the existing `_tokens.scss` `--duration-base`/`--duration-fast` custom properties (already zeroed under `prefers-reduced-motion: reduce`), not a hardcoded duration — inspect `src/styles/_tokens.scss` during implementation for the exact token names.

---

## Shared Patterns

### Signal-facade state pattern (private writable + public readonly)
**Source:** `src/app/core/browser/motion-preference.ts` lines 56-59; `src/app/state/instrument-state.ts` lines 98-101
**Apply to:** `AlgorithmDiagram`'s local `selectedOperator` state (D-10)
```typescript
private readonly _selectedOperator = signal<OperatorId | null>(null);
protected readonly selectedOperator = this._selectedOperator.asReadonly();
```

### Domain-purity / no-Angular-imports in `domain/dx7/**`
**Source:** `src/app/domain/dx7/models/derive-role.ts`, `algorithms.ts`, `algorithm.ts` — none import from `@angular/*`; `eslint.config.js` line 39 scopes a domain-purity rule to this path (per RESEARCH.md).
**Apply to:** all files under the new `src/app/domain/dx7/diagram/` directory (`algorithm-layout.ts`, `build-diagram-view-model.ts`, `describe-algorithm.ts`).

### Validate-before-lookup guard pattern
**Source:** `src/app/domain/dx7/models/algorithm.ts` (`isAlgorithmId`), applied in `src/app/state/instrument-state.ts` (`setAlgorithm`, `updateOperator`, `captureSnapshot` — validate the identifier/enum value *before* touching any signal/state)
**Apply to:** `algorithm-detail.ts` resolving the `:id` route param — validate with `isAlgorithmId` before any `ALGORITHMS`/layout lookup; on failure render not-found state rather than throwing (route params are untrusted input, unlike `InstrumentState`'s programmer-facing API which throws `RangeError`).

### Frozen, module-level canonical dataset
**Source:** `src/app/domain/dx7/models/algorithms.ts` lines 63-87 (`Object.freeze` on every record and nested array)
**Apply to:** `ALGORITHM_LAYOUTS` in `algorithm-layout.ts` — freeze each per-algorithm layout record so it can't be mutated in place, matching the "single source of truth" discipline already enforced for `ALGORITHMS`.

### Lazy route registration
**Source:** `src/app/app.routes.ts` lines 18-22
**Apply to:** the new `algorithms/:id` route entry — identical `loadComponent`/`title` shape, appended after the existing `algorithms` entry.

### Component test scaffolding (non-routed)
**Source:** `src/app/features/algorithms/algorithms.spec.ts` (full file)
**Apply to:** `algorithm-diagram.spec.ts` — `TestBed.configureTestingModule({ imports: [ComponentUnderTest] }).compileComponents()`, then `fixture.componentRef.setInput(...)` for the required `viewModel` input, then query rendered DOM.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/features/algorithms/algorithm-detail/*` | routed component | request-response | First component in this codebase to read `ActivatedRoute`/route params — no in-repo `RouterTestingHarness` usage yet. Use RESEARCH.md's Code Examples section as the primary pattern source instead. |
| `src/app/features/algorithms/algorithm-diagram/*` | presentational SVG component | transform | First SVG/diagram-rendering component in this codebase — no accessible-SVG precedent exists. Use RESEARCH.md's Pattern 2 code block (full `algorithm-diagram.ts`/`.html` example) as the primary pattern source instead. |

## Metadata

**Analog search scope:** `src/app/` (full tree), with targeted reads of `src/app/domain/dx7/models/*`, `src/app/features/algorithms/*`, `src/app/features/*` (other features), `src/app/state/instrument-state.ts`, `src/app/core/browser/motion-preference.ts`, `src/app/app.routes.ts`, `src/app/app.config.ts`
**Files scanned:** ~30 (full `find src/app -type f` listing reviewed; 10 read in full)
**Pattern extraction date:** 2026-08-05
