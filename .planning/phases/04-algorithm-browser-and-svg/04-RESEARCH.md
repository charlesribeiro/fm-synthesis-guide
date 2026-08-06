# Phase 4: Algorithm browser and SVG - Research

**Researched:** 2026-08-05
**Domain:** Angular 22 signal-driven SVG rendering, accessible data-driven diagrams, route-param testing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The 32-algorithm browse view is organized into the four existing teaching-taxonomy
  groups (Additive Stacks 1–6, Tree/Branch 7–18, Rooting 19–25, Parallel 26–32) — the same
  grouping already rendered as placeholder content in `src/app/features/algorithms/algorithms.ts`
  (Phase 1) and backed by Phase 2's `teachingTags` field (D-10, `02-CONTEXT.md`). No flat/ungrouped
  or filterable variant.
- **D-02:** Opening a single algorithm's diagram uses a dedicated route per algorithm,
  `/algorithms/:id` (id = the canonical `AlgorithmId`, 1–32) — matches the route already sketched
  in `GSD_NEW_PROJECT_PROMPT.md` §"Routes" (`/algorithms/:id algorithm detail`). Deep-linkable,
  back-button works, and gives Phase 6's guided lessons a stable URL to link into. —
  **Reversibility:** costly — Phase 6 lessons and any future deep links depend on this URL shape;
  changing it later means updating every link into a specific algorithm.
- **D-03:** Each of the 32 items in the browse view shows number + name/group text only (no mini
  SVG thumbnail) — matches the current placeholder's card style, cheapest to render for all 32 at
  once. The full SVG diagram renders only on the detail view.
- **D-04:** The detail view includes prev/next navigation to step sequentially through algorithms
  (Algorithm N-1 / N+1), plus a link back to the grouped browser — lets a learner page through all
  32, or compare adjacent ones (e.g. 26 vs 27), without returning to the list each time.
- **D-05:** Each algorithm's operator node `(x, y)` layout is hand-authored per algorithm (32
  layout-hint records), not computed algorithmically at render time. Kept as a distinct layout
  layer, separate from the graph-truth dataset, per `docs/ARCHITECTURE.md` §"Algorithm graph
  model" ("a layout hint layer that is separate from synthesis truth"). Guarantees every diagram
  reads cleanly; avoids auto-layout artifacts (crowding, crossing edges) that a 32-topology
  general-purpose layout function would risk. — **Reversibility:** costly — switching to computed
  layout later means either discarding 32 hand-authored records or maintaining two layout code
  paths side by side.
- **D-06:** All 32 hand-authored layouts follow one visual convention: top-to-bottom signal flow,
  modulators positioned above the carriers they feed, carriers at the bottom feeding the output
  bus. Matches the underlying graph direction (higher-id operators modulate lower-id ones, Phase
  2 D-05) as a structural fact, not a copy of Yamaha panel artwork (CLAUDE.md licensing rule —
  original layout expressing an uncopyrightable routing fact). Gives the learner one consistent
  reading direction across all 32 diagrams, reinforced by D-04's prev/next stepping. —
  **Reversibility:** costly — applies to all 32 authored records; changing the convention means
  re-authoring all of them.
- **D-07:** All 32 diagrams share one consistent SVG canvas scale/proportions and operator-node
  size; only the internal layout differs per algorithm. Keeps complexity differences (Algorithm 1
  vs. Algorithm 4) reading as topology, not as artificially bigger/smaller drawings.
- **D-08:** Carrier vs. modulator operators are distinguished by node shape (e.g. carriers as a
  filled/double-ringed shape, modulators as a plain shape), not color alone — perceivable in
  reduced-color/high-contrast modes and by colorblind users, keyed off the per-operator `<g>`'s
  data attribute (`docs/ARCHITECTURE.md` §"Rendering strategy").
- **D-09:** The feedback self-loop renders as a curved path curling back into its own node, drawn
  with a stroke style distinct from straight modulation-edge arrows (e.g. dashed) — matches
  `docs/ARCHITECTURE.md`'s "feedback path with a distinct shape and accessible label." Reads as a
  self-modulating signal path at a glance, not just a badge/icon.
- **D-10:** Clicking an operator node in the detail diagram selects/highlights it (and, at
  planner's discretion, its connected edges) as local UI state owned by the diagram component —
  the seam Phase 3 explicitly deferred to Phase 4 (`03-CONTEXT.md` "Claude's Discretion"). This
  selection does NOT sync to `InstrumentState` — that facade has no "selected operator" concept
  today and nothing downstream reads one yet; a later phase (Playground) decides if/how to wire
  node selection into shared state.
- **D-11:** Each algorithm's accessible SVG title/description text (`<title>`/`<desc>`) is
  auto-generated from `AlgorithmDefinition` by a pure template function, not hand-authored per
  algorithm. Avoids duplicating routing knowledge CLAUDE.md says shouldn't be duplicated, and
  stays automatically correct if the dataset changes (as Phase 2's Algorithm 26/27 correction
  already did once).
- **D-12:** The generated description fully enumerates every modulation edge (e.g. "operator 6
  modulates operator 5, operator 5 modulates operator 4…"), plus the carrier list and feedback
  presence — not a summarized count. A screen-reader user gets the same routing information a
  sighted user reads off the diagram, which is what VIS-02's accessibility requirement is asking
  for.

### Claude's Discretion

- Exact TypeScript shape of the layout-hint data (file location under `src/app/domain/dx7/` or a
  new `src/app/features/algorithms/` view-model layer; per-operator `{x, y}` vs. a richer per-node
  record) — informed by D-05/ARCHITECTURE.md's layout-truth separation.
- Exact SVG markup structure and CSS custom properties for node/edge states — per
  `docs/ARCHITECTURE.md` §"Rendering strategy" (`<g>` per operator, directed paths with arrow
  markers, data attributes for testing).
- Exact node shape choice (circle vs. square vs. ring) and stroke/fill values for D-08, respecting
  CLAUDE.md's reduced-motion and WCAG-AA-where-practical rules.
- Exact wording/grammar of the D-11/D-12 generated-description template.
- Whether D-10's node-click highlight also highlights the node's connected edges/neighbors, or
  just the clicked node itself.
- Fixture algorithms reused for isolated component/unit tests — likely the same Algorithm 1 (stack
  + tower) and Algorithm 32 (pure additive) fixtures established in Phase 2, matching ROADMAP.md's
  Phase 6 focus on those same two algorithms.
- Edge thickness/intensity reflecting modulation amount (`GSD_NEW_PROJECT_PROMPT.md` §"Visual
  design") — no live `outputLevel`/modulation-amount data is wired into the diagram view model in
  this phase (that's `InstrumentState`, deliberately not consumed per D-10); planner's call whether
  to stub a static/uniform edge style now or leave it for whichever phase first wires live state
  into this diagram.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (Edge thickness/intensity reflecting live modulation
amount, from `GSD_NEW_PROJECT_PROMPT.md`'s visual-design wishlist, was not decided as in/out —
left as Claude's Discretion above since it depends on state this phase deliberately doesn't wire
in, per D-10.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-01 | User can browse all 32 algorithms and open an algorithm detail view | Standard Stack (Router, no new packages); Architecture Patterns (route registration, browse-view grouping via existing `teachingTags`); Common Pitfalls 1 & 3 (deep-link param binding, `name` field length); Code Examples (route registration, `RouterTestingHarness` tests); Validation Architecture test map |
| VIS-02 | The routing diagram is SVG, data-driven from the same dataset used by the synth engine, and accessible (title/description, not color-only carrier/modulator distinction) | Architecture Patterns 1 & 2 (Angular-free view-model builder reading `ALGORITHMS`/`derive-role.ts`, presentational SVG component); Don't Hand-Roll (reuse `derive-role.ts`, never re-derive); Common Pitfalls 2 (title/desc id uniqueness); Code Examples (accessible SVG wiring); Security Domain (V5 input validation for `:id`) |
| VIS-03 | The feedback loop is visually explicit in the diagram | Architecture Patterns 2 (distinct curved/dashed feedback `<path>`, D-09); Don't Hand-Roll (`<marker>`/`marker-end` for arrowheads, `getFeedbackOperator`); Validation Architecture test map (feedback-fixture assertions) |
</phase_requirements>

## Summary

Phase 4 is a pure front-end rendering phase: no new npm packages, no new external services, no
audio. Everything it needs — Angular Router, signals, and inline SVG — is already in the
dependency tree. The two technical risk areas are (1) getting the `/algorithms/:id` route's
param → typed `AlgorithmId` conversion right under Angular 22's signal-input router binding
(which has a documented deep-link gap), and (2) building the SVG accessibility contract
(no `role="img"` on the root; `<title>`/`<desc>` + `aria-labelledby`; interactive operators as
`role="button"`) correctly the first time, since it is one of this phase's three binding success
criteria (VIS-02/VIS-03) and easy to get subtly wrong. A blocking manual screen-reader check is
required before marking VIS-02/VIS-03 complete.

The rest of the phase is disciplined data-modeling and template work: a new pure, Angular-free
layout-hint module (32 hand-authored records, D-05/D-06/D-07), a pure description-generator
function (D-11/D-12) that walks `AlgorithmDefinition.edges` through the existing
`derive-role.ts` helpers, and one `@for`-driven SVG template with `marker-end` arrowheads for
directed edges and a distinct curved/dashed path for the feedback self-loop (D-08/D-09). All of
this lives entirely within the codebase's existing established patterns — no new architectural
concepts need to be introduced.

**Primary recommendation:** Read the `:id` route param via injected `ActivatedRoute` with
`toSignal(route.paramMap, { initialValue: route.snapshot.paramMap })` (do **not** add
`withComponentInputBinding()`), validate it with the existing `isAlgorithmId` guard, and route
invalid/out-of-range ids to a not-found state in-component rather than a router redirect. Build the
SVG as a single Angular component that receives a plain-object, Angular-free view model
(`AlgorithmDiagramViewModel`) computed from `ALGORITHMS`, `derive-role.ts`, and the new layout-hint
module — never importing `InstrumentState` or any audio/engine code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Algorithm browse list (32 cards, grouped) | UI feature (`features/algorithms/`) | Domain (`ALGORITHMS`, `teachingTags`) | Rendering is Angular; grouping data is domain-owned, read not duplicated |
| `/algorithms/:id` route + param validation | UI feature (routing) | — | Angular Router owns navigation/param extraction; validation delegates to domain's `isAlgorithmId` |
| Diagram view-model construction (layout + roles + edges) | Domain-adjacent pure module (Angular-free) | UI feature (invokes it via `computed`) | Per `docs/ARCHITECTURE.md` "SVG component receives a view model" — the derivation itself must stay framework-free and testable without Angular, matching Phase 2's `derive-role.ts` precedent |
| SVG rendering (`<g>`/`<path>`/markers) | UI feature (Angular component template) | — | Presentation-only; consumes the view model, never re-derives routing facts |
| Accessible text description (`<title>`/`<desc>`) | Domain-adjacent pure module | UI feature (binds ids into template) | D-11: must be a pure template function over `AlgorithmDefinition`, not hand-authored per algorithm |
| Node-click selection/highlight state | UI feature (component-local signal) | — | D-10: explicitly local UI state, does not sync to `InstrumentState` |
| Layout-hint data (32 `{x, y}` records) | Domain-adjacent pure module | — | D-05: kept as a distinct layer, separate from graph-truth `ALGORITHMS`, but still Angular-free per CLAUDE.md's domain-purity rule |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@angular/router` | ^22.1.0 (already installed) | `/algorithms/:id` route, param binding | Already the project's only router; no alternative under consideration |
| `@angular/core` (signals) | ^22.1.0 (already installed) | `computed()` view models, `input()` signal inputs, component-local selection `signal()` | Matches CLAUDE.md's "prefer signal inputs... `signal`, `computed`" rule |
| Native inline SVG (no library) | — | Diagram rendering | ARCHITECTURE.md prescribes raw SVG with `<g>`/markers/data-attributes; no charting/diagram library is implied or needed for 6-node graphs |

**No new packages are required for this phase.** `package.json` already contains everything needed
(`@angular/router`, `@angular/core`, `vitest`, `jsdom`). `npm view` verification of new packages is
therefore not applicable — see Package Legitimacy Audit below.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@angular/core/testing` (`TestBed`) | ^22.1.0 | Component tests | Same pattern as existing `algorithms.spec.ts`, `app.spec.ts` |
| `@angular/router/testing` (`RouterTestingHarness`) | ^22.1.0 | `/algorithms/:id` param-driven route tests | New to this phase — not yet used anywhere in the codebase; see Code Examples |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `@for`-driven inline SVG | D3.js / a dedicated graph-layout library | Rejected: D-05 already locks layout to 32 hand-authored records, not computed layout — a layout library solves a problem this phase doesn't have, and CLAUDE.md's "original design" rule discourages pulling in a library whose default visual idiom would need heavy overriding anyway |
| `withComponentInputBinding()` signal input for `:id` | Direct `ActivatedRoute.paramMap` + `toSignal()` injection | Both are valid Angular 22 idioms; signal-input binding is more declarative and matches CLAUDE.md's "prefer signal inputs" rule, but has a known deep-link gap (Pitfall 1) that the direct-injection form does not have. Recommendation: use the signal input for ergonomics, but resolve the value from `ActivatedRoute.snapshot.paramMap` as the actual source of truth inside the component, not the bound input directly — see Code Examples |

**Installation:** None required — no `npm install` needed for this phase.

## Package Legitimacy Audit

**Not applicable — this phase introduces zero new external packages.** All libraries used
(`@angular/router`, `@angular/core`, `@angular/core/testing`, `@angular/router/testing`) are
already present in `package.json` at the versions shown above `[VERIFIED: package.json]` (read
this session). No `npm view`/legitimacy check is required per the gate's own scope ("whenever this
phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
Browser navigation
       │
       ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│ /algorithms              │        │ /algorithms/:id           │
│ Algorithms (browse) route│──link─▶│ AlgorithmDetail route     │
└─────────────────────────┘        └──────────────────────────┘
       │ reads                              │ reads :id param
       ▼                                    ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│ ALGORITHMS (domain data) │        │ id validated with         │
│ + teachingTags grouping  │        │ isAlgorithmId()            │
└─────────────────────────┘        └──────────────┬─────────────┘
                                                    │ valid → resolve algorithm
                                                    │ invalid → not-found view
                                                    ▼
                                     ┌──────────────────────────┐
                                     │ computed() view-model      │
                                     │ builder (Angular-free):    │
                                     │  ALGORITHMS[id] +          │
                                     │  derive-role.ts            │
                                     │  (getOperatorRole,         │
                                     │   deriveCarriers,          │
                                     │   getFeedbackOperator) +   │
                                     │  layout-hints[id]          │
                                     └──────────────┬─────────────┘
                                                    │ AlgorithmDiagramViewModel
                                                    ▼
                                     ┌──────────────────────────┐
                                     │ SVG diagram component      │
                                     │  <svg aria-labelledby>     │
                                     │   (no role="img")          │
                                     │   <title>/<desc> (from     │
                                     │    pure description        │
                                     │    generator, D-11/D-12)   │
                                     │   @for node → <g           │
                                     │    role="button"> (shape   │
                                     │    encodes role, D-08)     │
                                     │   @for edge → <path        │
                                     │    marker-end>             │
                                     │   feedback edge → distinct │
                                     │    curved/dashed <path>    │
                                     │    (D-09)                  │
                                     │  click on <g> → local       │
                                     │    selection signal (D-10) │
                                     └──────────────────────────┘
```

### Recommended Project Structure
```
src/app/
├── domain/dx7/
│   ├── models/                        # existing — untouched contracts this phase reads
│   │   ├── algorithms.ts              # ALGORITHMS (existing)
│   │   ├── derive-role.ts             # getOperatorRole/deriveCarriers/getFeedbackOperator (existing)
│   │   └── operator.ts                # OPERATOR_IDS (existing)
│   └── diagram/                       # NEW — Angular-free, per Claude's Discretion
│       ├── algorithm-layout.ts        # 32 hand-authored {operatorId: {x, y}} records (D-05/D-06/D-07)
│       ├── algorithm-layout.spec.ts   # coverage: every AlgorithmId has a layout, all 6 operators present
│       ├── build-diagram-view-model.ts# pure fn: (AlgorithmDefinition, layout) -> AlgorithmDiagramViewModel
│       ├── build-diagram-view-model.spec.ts
│       ├── describe-algorithm.ts      # pure fn: AlgorithmDefinition -> accessible title/desc text (D-11/D-12)
│       └── describe-algorithm.spec.ts
└── features/algorithms/
    ├── algorithms.ts / .html / .scss  # existing — becomes the real grouped browse view (replaces placeholder)
    ├── algorithms.spec.ts             # existing — extend for real card content
    ├── algorithm-detail/              # NEW
    │   ├── algorithm-detail.ts        # route component: :id param → validated AlgorithmId → view model
    │   ├── algorithm-detail.html
    │   ├── algorithm-detail.scss
    │   └── algorithm-detail.spec.ts   # RouterTestingHarness: valid id, invalid id, prev/next nav
    └── algorithm-diagram/             # NEW
        ├── algorithm-diagram.ts       # presentational SVG component: input = view model only
        ├── algorithm-diagram.html
        ├── algorithm-diagram.scss
        └── algorithm-diagram.spec.ts  # fixture-driven: expected node/edge counts, a11y structure
```

**Rationale for `domain/dx7/diagram/` (not `domain/dx7/models/`):** keeps the 32
graph-truth records (`models/algorithms.ts`) visually and directorially separate from the 32
layout-hint records, which is exactly D-05's "distinct layout layer, separate from synthesis
truth" instruction — putting both under `models/` would blur the ARCHITECTURE.md-mandated
separation with a directory layout that doesn't distinguish them. This directory still falls under
`src/app/domain/**/*.ts` so the existing scoped ESLint domain-purity rule
(`DOMAIN-04`) automatically applies to it — verified `[VERIFIED: eslint.config.js:39]`, quote
below.

### Pattern 1: Angular-free layout-hint + view-model module
**What:** A plain TypeScript module with no Angular imports that maps `AlgorithmId` to per-operator
`{x, y}` coordinates, and a second pure function that combines an `AlgorithmDefinition` with its
layout record into a fully-resolved `AlgorithmDiagramViewModel` (nodes with position + role +
selected-state placeholder, edges with endpoints + directed/feedback flag).
**When to use:** Any time the SVG component needs data — it must never call `derive-role.ts`
functions or read `ALGORITHMS` directly inside the template or component class; it consumes only
the already-built view model, matching ARCHITECTURE.md's "SVG component receives a view model; it
must not query the audio engine directly" (the same boundary applies to querying domain data
ad hoc from inside the presentational component).
**Example:**
```typescript
// src/app/domain/dx7/diagram/algorithm-layout.ts — Angular-free (domain-purity ESLint rule applies)
import type { AlgorithmId } from '../models/algorithm';
import type { OperatorId } from '../models/operator';

export interface OperatorPosition {
  readonly x: number;
  readonly y: number;
}

export type AlgorithmLayout = Readonly<Record<OperatorId, OperatorPosition>>;

// One hand-authored record per algorithm (D-05). Coordinates are in a shared
// SVG viewBox unit space common to all 32 diagrams (D-07's "one consistent
// canvas scale") — e.g. a 240x240 viewBox, modulators above carriers (D-06).
export const ALGORITHM_LAYOUTS: ReadonlyMap<AlgorithmId, AlgorithmLayout> = new Map([
  [1, { 1: { x: 60, y: 200 }, 2: { x: 60, y: 140 }, 3: { x: 180, y: 200 }, 4: { x: 180, y: 140 }, 5: { x: 180, y: 80 }, 6: { x: 180, y: 20 } }],
  // ... 31 more records
]);
```

### Pattern 2: `computed()` view-model in the route component, presentational SVG component below it
**What:** The route component (`AlgorithmDetail`) owns the validated `AlgorithmId` and builds the
view model via `computed()`; the `AlgorithmDiagram` component is purely presentational and takes
the finished view model as a signal input.
**When to use:** Keeps the SVG component trivially fixture-testable (VIS-02's "renders expected
operator/edge counts from fixture data" success criterion) without any router/domain wiring in its
own tests.
**Example:**
```typescript
// algorithm-diagram.ts
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { AlgorithmDiagramViewModel } from '../../../domain/dx7/diagram/build-diagram-view-model';
import type { OperatorId } from '../../../domain/dx7/models/operator';

@Component({
  selector: 'app-algorithm-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './algorithm-diagram.html',
  styleUrl: './algorithm-diagram.scss',
})
export class AlgorithmDiagram {
  readonly viewModel = input.required<AlgorithmDiagramViewModel>();

  private readonly instanceId = 1; // stable per component instance in production

  // Ids include algorithmId + instance suffix so two same-algorithm diagrams never collide.
  protected readonly titleId = computed(
    () => `algorithm-${this.viewModel().algorithmId}-diagram-title-${this.instanceId}`,
  );
  protected readonly descId = computed(
    () => `algorithm-${this.viewModel().algorithmId}-diagram-desc-${this.instanceId}`,
  );
  protected readonly arrowMarkerId = computed(
    () => `algorithm-${this.viewModel().algorithmId}-diagram-arrow-${this.instanceId}`,
  );

  // D-10: local-only selection state, never synced to InstrumentState.
  private readonly _selectedOperator = signal<OperatorId | null>(null);
  protected readonly selectedOperator = this._selectedOperator.asReadonly();

  protected selectNode(id: OperatorId): void {
    this._selectedOperator.set(this.selectedOperator() === id ? null : id);
  }
}
```
```html
<!-- algorithm-diagram.html -->
<svg
  [attr.aria-labelledby]="titleId() + ' ' + descId()"
  viewBox="0 0 240 240"
  preserveAspectRatio="xMidYMid meet"
>
  <title [attr.id]="titleId()">{{ viewModel().title }}</title>
  <desc [attr.id]="descId()">{{ viewModel().description }}</desc>

  <defs>
    <marker
      [attr.id]="arrowMarkerId()"
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path d="M0,0 L10,5 L0,10 z" />
    </marker>
  </defs>

  @for (edge of viewModel().edges; track edge.id) {
    @if (edge.kind === 'modulation') {
      <path
        [attr.d]="edge.path"
        class="edge edge--modulation"
        [attr.marker-end]="'url(#' + arrowMarkerId() + ')'"
        [attr.data-from]="edge.from"
        [attr.data-to]="edge.to"
      />
    } @else {
      <!-- D-09: feedback self-loop, distinct dashed curved stroke -->
      <path
        [attr.d]="edge.path"
        class="edge edge--feedback"
        [attr.marker-end]="'url(#' + arrowMarkerId() + ')'"
        [attr.data-from]="edge.from"
        [attr.data-to]="edge.to"
      />
    }
  }

  @for (node of viewModel().nodes; track node.id) {
    <g
      class="operator"
      [class.operator--carrier]="node.role === 'carrier'"
      [class.operator--modulator]="node.role === 'modulator'"
      [class.operator--selected]="selectedOperator() === node.id"
      [attr.data-operator-id]="node.id"
      [attr.data-role]="node.role"
      [attr.transform]="'translate(' + node.x + ',' + node.y + ')'"
      tabindex="0"
      role="button"
      [attr.aria-pressed]="selectedOperator() === node.id"
      [attr.aria-label]="'Operator ' + node.id + ', ' + node.role"
      (click)="selectNode(node.id)"
      (keydown.enter)="selectNode(node.id)"
      (keydown.space)="selectNode(node.id)"
    >
      <!-- D-08: shape, not color alone, encodes role -->
      @if (node.role === 'carrier') {
        <circle r="18" class="operator__shape" />
        <circle r="12" class="operator__shape-ring" />
      } @else {
        <rect x="-16" y="-16" width="32" height="32" class="operator__shape" />
      }
      <text class="operator__label">{{ node.id }}</text>
    </g>
  }
</svg>
```
*Source: pattern synthesized from `docs/ARCHITECTURE.md` §"Rendering strategy" (one `<g>` per
operator, directed paths with arrow markers, distinct feedback path, data attributes for testing,
CSS custom properties) `[CITED: docs/ARCHITECTURE.md]` and MDN's `marker-end`/SVG accessibility
guidance `[CITED: developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-end]`.*

### Anti-Patterns to Avoid
- **Re-deriving carrier/modulator roles inside the SVG template or component:** always call
  `getOperatorRole`/`deriveCarriers` once, in the Angular-free view-model builder, and pass the
  already-resolved `role` field into the view model — never call `derive-role.ts` functions from
  inside `algorithm-diagram.ts` or the `.html` template (violates the single-source-of-truth
  intent behind D-07/DOMAIN-01 and would let the SVG and the future audio engine's derived roles
  drift if `derive-role.ts` ever changed).
- **Coloring carriers/modulators as the only distinguishing signal:** D-08 requires shape (and
  CLAUDE.md's "Do not communicate carrier/modulator state by color alone" is a hard rule, not
  discretionary) — color may reinforce shape, but the `[class.operator--carrier]`/`data-role`
  attributes must be sufficient on their own.
- **Animating the feedback loop or selection highlight with a mandatory transition:** CLAUDE.md
  requires respecting reduced motion; any CSS transition on `.operator--selected` or the feedback
  path must be gated through the existing `--duration-base`/`--duration-fast` tokens (which
  `_tokens.scss` already zeroes out under `prefers-reduced-motion: reduce` — read this session,
  see Verified Values below), not a hardcoded duration.
- **Building the not-found state as a router redirect to a generic 404:** the phase's success
  criteria call for "an algorithm detail route" that behaves predictably for out-of-range ids;
  prefer an in-component not-found view (still under `/algorithms/:id`, still with a link back to
  the browser) over a `redirectTo` guard, so a mistyped id in the URL bar gives useful feedback
  instead of silently bouncing to `/`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Route param → typed id validation | A custom `AlgorithmDetailGuard`/resolver duplicating range logic | Existing `isAlgorithmId` from `src/app/domain/dx7/models/algorithm.ts` | Already implemented, already tested (Phase 2); a second range check anywhere risks drifting from `MIN_ALGORITHM_ID`/`MAX_ALGORITHM_ID` |
| Carrier/modulator/feedback classification for the diagram | A parallel role-derivation function scoped to rendering | `getOperatorRole`, `deriveCarriers`, `getFeedbackOperator` from `derive-role.ts` | DOMAIN-01/DOMAIN-03 forbid duplicated routing knowledge; Phase 2's Algorithm 26/27 correction already proved a second copy would drift |
| Directed-graph auto-layout (force-directed, DAG layering) | Any layout algorithm or graph library | 32 hand-authored `{x, y}` records | D-05 explicitly rejects computed layout for this phase — building or importing a layout algorithm solves a problem that's been deliberately taken off the table |
| Arrowhead/marker geometry | Manual per-edge triangle path math | SVG native `<marker>` + `marker-end` | `<marker>` is a stable, well-supported SVG primitive purpose-built for this; hand-computing triangle points per edge angle is unnecessary complexity for a static (non-animated) diagram |

**Key insight:** every "don't hand-roll" item here maps to an existing, already-tested module in
this codebase (`derive-role.ts`, `isAlgorithmId`) or a browser-native primitive (`<marker>`) — this
phase's actual net-new code is intentionally narrow: layout data, a view-model assembler, a
description generator, and templates.

## Common Pitfalls

### Pitfall 1: `withComponentInputBinding()` signal inputs are `undefined` on deep-link navigation
**What goes wrong:** If the plan wires `id = input.required<string>()` on `AlgorithmDetail` and
relies on it exclusively, a user who pastes/bookmarks `/algorithms/7` directly (a deep link, not
in-app navigation) may see the signal input come back `undefined` on first render, even though
in-app `routerLink` navigation to the same URL works.
**Why it happens:** A documented, closed-as-not-planned Angular router issue: `withComponentInputBinding()`
does not reliably populate signal inputs from route params on the very first (deep-link) navigation
in some Angular versions; only observed reliably fixed via manual `ActivatedRoute` access
`[CITED: github.com/angular/angular/issues/60703]` (reported against Angular 19.2.3; this project
is on Angular 22.1 — re-verify against the installed version during planning, since the issue was
closed "not planned" rather than fixed upstream and may still apply).
**How to avoid:** Resolve the id via `ActivatedRoute.snapshot.paramMap.get('id')` (or an injected
`ActivatedRoute` combined with `toSignal(this.route.paramMap)`) as the actual source of truth
inside `AlgorithmDetail`, rather than trusting a bound signal input alone. This also sidesteps
needing `withComponentInputBinding()` in `app.config.ts` at all if the team prefers to avoid the
extra router config — `ActivatedRoute` injection is the more defensive, framework-guaranteed path
for a route this phase's D-02 marks "costly to reverse" (deep-linkability is load-bearing).
**Warning signs:** A component test using `RouterTestingHarness.create('/algorithms/7')` (deep
link, no prior navigation) shows a different result than one that first navigates to `/algorithms`
and then to `/algorithms/7` (in-app). Write both test shapes to catch this class of bug (see
Validation Architecture below).

### Pitfall 2: SVG `<title>`/`<desc>` ids collide across multiple diagram instances on one page
**What goes wrong:** If the SVG template hardcodes `id="algorithm-title"` and `id="algorithm-desc"`
and the diagram component is ever rendered more than once on a page (e.g. prev/next preview
thumbnails, or a future Playground embed), duplicate DOM ids break `aria-labelledby` resolution —
screen readers will announce the first matching id's content for every instance.
**Why it happens:** Static, literal ids are the simplest thing to write and pass every single-page
test, but VIS-02/VIS-03 are accessibility-critical and this bug is invisible without a screen
reader or an axe-core-style audit.
**How to avoid:** Derive ids from the algorithm id **and** a stable per-component-instance suffix
(e.g. `` `algorithm-${id}-diagram-title-${instanceId}` ``, same for `-desc-` and `-arrow-`) and bind
that marker id from every `marker-end`, so ids stay unique even if two instances of the same
algorithm render simultaneously. Phase 4's own scope (D-02/D-04) only renders one at a time, but the
cost of making the id unique now is near zero and removes a latent a11y bug for any future reuse
(Playground, a future compare view).
**Warning signs:** A dual-instance fixture with the same `AlgorithmDiagramViewModel` still produces
duplicate `title`/`desc`/`marker` ids or `marker-end` values pointing at the wrong instance.

### Pitfall 3: Treating `AlgorithmDefinition.name` as a short label in the browse-view card
**What goes wrong:** A plan that assumes `algorithm.name` is a short string like `"Algorithm 1"`
and lays out the browse card accordingly will overflow — the actual `name` values are long,
full-sentence topology descriptions (e.g. *"Four-deep stack into operator 3, plus a two-deep tower
into operator 1"*) `[VERIFIED: src/app/domain/dx7/models/algorithms.ts:77-78]`, quoted verbatim:
`id: 1, name: 'Four-deep stack into operator 3, plus a two-deep tower into operator 1'`.
**Why it happens:** "Number + name/group text only" (D-03) reads like a compact card, but the
`name` field itself is the multi-clause routing description written for Phase 2's dataset
documentation, not a UI-facing short title.
**How to avoid:** Design the browse card CSS/typography to accommodate a full sentence of text per
card (D-03 doesn't require a short name — it forbids a *thumbnail SVG*, not long text), or have the
component derive a shorter display string (e.g. `"Algorithm {{ id }}"` as the card's heading, with
`name` shown as supporting body text) — either is compatible with D-03, but the plan must pick one
deliberately rather than assuming `name` is already card-sized.
**Warning signs:** A card-layout snapshot/visual check showing severe text truncation or overflow
once real data (not a placeholder short string) is wired in.

### Pitfall 4: `@for` on a view-model array recomputed by object identity every render
**What goes wrong:** If `build-diagram-view-model.ts`'s pure function is called directly inside the
template (or inside a `computed()` that also depends on `selectedOperator`), every click that
changes `selectedOperator` would rebuild the *entire* `nodes`/`edges` array with new object
references, defeating `@for`'s `track` optimization and needlessly re-rendering all six `<g>`
elements and their edges on every selection change.
**Why it happens:** It's tempting to fold "is this node selected" directly into the view-model
object so the template only checks one field, but that couples a stable per-algorithm shape
(topology, layout) to a fast-changing local UI state (selection).
**How to avoid:** Keep `AlgorithmDiagramViewModel` (topology + layout, one `computed()` keyed only
on the algorithm id) and `selectedOperator` (a separate local `signal<OperatorId | null>`) as two
independent reactive sources; the template checks `selectedOperator() === node.id` per node
(Pattern 2's example above already does this) rather than baking `selected: boolean` into each
node object inside the view-model computed. `track node.id` (a stable primitive) then never
invalidates on selection changes.
**Warning signs:** In a zoneless app, an unexpectedly large `OnPush` check subtree on every click,
or `track` on an object reference instead of `node.id`.

## Code Examples

### `/algorithms/:id` route registration (extends existing lazy-route pattern)
```typescript
// src/app/app.routes.ts — extend existing routes array
{
  path: 'algorithms',
  loadComponent: () => import('./features/algorithms/algorithms').then((m) => m.Algorithms),
  title: 'Algorithms — DX7 Algorithm Lab',
},
{
  path: 'algorithms/:id',
  loadComponent: () =>
    import('./features/algorithms/algorithm-detail/algorithm-detail').then(
      (m) => m.AlgorithmDetail,
    ),
  title: 'Algorithm detail — DX7 Algorithm Lab',
},
```
*Source: follows the existing lazy-route convention verified this session
`[VERIFIED: src/app/app.routes.ts]` — the file's own header comment: "Every feature route is
lazy-loaded... even though each feature is a single placeholder component today."*

### `RouterTestingHarness` test for valid id, invalid id, and deep-link vs. in-app navigation
```typescript
// algorithm-detail.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../../app.routes';
import { AlgorithmDetail } from './algorithm-detail';

describe('AlgorithmDetail route', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('renders algorithm 7 when navigated to directly (deep link)', async () => {
    const harness = await RouterTestingHarness.create('/algorithms/7');
    const component = await harness.navigateByUrl('/algorithms/7', AlgorithmDetail);
    expect(component).toBeInstanceOf(AlgorithmDetail);
    // assert on rendered content, not just component existence — Pitfall 1
    expect(harness.routeNativeElement?.textContent).toContain('7');
  });

  it('shows a not-found state for an out-of-range id (33)', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms/33', AlgorithmDetail);
    expect(harness.routeNativeElement?.textContent).toMatch(/not found|doesn't exist/i);
  });

  it('shows a not-found state for a non-numeric id', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms/abc', AlgorithmDetail);
    expect(harness.routeNativeElement?.textContent).toMatch(/not found|doesn't exist/i);
  });
});
```
*Source: `RouterTestingHarness` API confirmed via official docs
`[CITED: angular.dev/api/router/testing/RouterTestingHarness]` — `create(initialUrl?)` and
`navigateByUrl(url, ComponentType)` signatures, `routeNativeElement` for asserting rendered
content.*

### Accessible SVG `<title>`/`<desc>` wiring
```html
<svg [attr.aria-labelledby]="titleId() + ' ' + descId()" viewBox="0 0 240 240">
  <title [attr.id]="titleId()">{{ viewModel().title }}</title>
  <desc [attr.id]="descId()">{{ viewModel().description }}</desc>
  <!-- interactive operators: <g role="button" tabindex="0" …> — do not wrap in role="img" -->
  <!-- marker id + marker-end: algorithm-{id}-diagram-arrow-{instance} -->
</svg>
```
*Source: `<title>`/`<desc>` + `aria-labelledby` for accessible name/description, without
`role="img"` when the SVG contains interactive controls, is the Phase 4 locked pattern (see A2)
`[CITED: css-tricks.com/accessible-svgs, tpgi.com/using-aria-enhance-svg-accessibility]` — MEDIUM
confidence (community/blog sources for title/desc wiring; interactive omission is a deliberate
Phase 4 decision confirmed by Plan 04-05 VoiceOver).*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ActivatedRoute.paramMap` subscription (RxJS) for route params | `withComponentInputBinding()` + signal `input()` | Angular 16 (`withComponentInputBinding`) + 17.1 (signal `input()`) | Declarative, no manual subscription — matches CLAUDE.md's "avoid manual subscriptions" rule; but see Pitfall 1 for its deep-link caveat, which is why this research recommends `ActivatedRoute.snapshot` as the actual source of truth regardless |
| `TestBed` + manual `Router`/`ActivatedRoute` stub wiring for route tests | `RouterTestingHarness` | Angular 15.2+ | Less boilerplate; this codebase has not yet used it (only `provideRouter` in existing specs) — this phase is the first to need param-driven route testing |

**Deprecated/outdated:** none directly relevant — this phase doesn't touch any deprecated Angular
API surface.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `withComponentInputBinding()` deep-link gap (GitHub #60703, reported against Angular 19.2.3) still applies to the installed Angular 22.1 `[VERIFIED: package.json]` | Common Pitfalls, Pitfall 1 | Low-medium: if already fixed upstream in 22.1, the recommended `ActivatedRoute.snapshot` fallback is still valid Angular practice and costs nothing extra — but the plan should not treat the GitHub issue as confirmed-current without a quick empirical check (deep-link test in Code Examples) during execution |
| A2 | For interactive operator diagrams, omit `role="img"` so `role="button"` nodes stay in the AT tree; keep `<title>`/`<desc>` + `aria-labelledby` for the accessible name/description (community guides often assume non-interactive decorative SVGs) | Architecture Patterns Pattern 2, Code Examples | Low-medium: decorative-SVG guides converge on `role="img"`, but that conflicts with D-10 interactive nodes — Phase 4 locks the interactive-friendly variant and requires a blocking VoiceOver check before VIS-02/VIS-03 complete |
| A3 | SVG `<marker>` + `marker-end` is sufficient for both directed modulation-edge arrowheads and the feedback self-loop's arrowhead, without custom path math | Don't Hand-Roll, Code Examples | Low: `<marker>` is a stable SVG1.1/2 primitive; the only real risk is browser-specific `orient="auto-start-reverse"` support nuances, which is worth a manual cross-browser check during execution but does not change the recommended approach |

## Open Questions (RESOLVED)

1. **Should `withComponentInputBinding()` be added to `app.config.ts` at all, or should
   `AlgorithmDetail` inject `ActivatedRoute` directly and skip signal-input route binding
   entirely?**
   - What we know: Both are valid Angular 22 patterns; direct `ActivatedRoute` injection avoids
     Pitfall 1 entirely and needs no router config change.
   - What's unclear: Whether the team wants the more "signals-idiomatic" binding style
     project-wide (it would affect all future routes with params, not just this one) or prefers
     to keep `provideRouter(routes)` unmodified and use `ActivatedRoute` per-route.
   - Recommendation: Planner's discretion — either is compliant with CLAUDE.md; if
     `withComponentInputBinding()` is added, still resolve the id from
     `ActivatedRoute.snapshot.paramMap` as the defensive source of truth (Pitfall 1), making the
     signal input effectively cosmetic either way.
   - **RESOLVED:** `withComponentInputBinding()` was NOT added. Plan 04-01 injects `ActivatedRoute`
     directly in `AlgorithmDetail` and holds
     `toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap })` as the id
     source (04-01-PLAN.md, `<design_decisions>` + Task 3). `app.config.ts`'s router provider is
     unmodified.

2. **Exact not-found UI for an out-of-range/non-numeric `:id`** (e.g. `/algorithms/99`,
   `/algorithms/abc`) — CONTEXT.md's Claude's Discretion list doesn't cover this explicitly, and
   ROADMAP.md's phrasing ("an algorithm detail route") doesn't specify.
   - What we know: The route must exist and be deep-linkable (D-02); VIS-01 requires "open an
     algorithm detail view," implying success-path coverage is the binding requirement.
   - What's unclear: Whether an invalid id should render an in-page not-found message (this
     research's recommendation, Anti-Patterns) or `redirectTo` the browse view.
   - Recommendation: In-page not-found state, matching the Anti-Patterns section's reasoning —
     planner should make this an explicit task with its own test, since it's the one branch of
     VIS-01 not covered by the phase's stated success criteria.
   - **RESOLVED:** In-page not-found state, per the recommendation. Plan 04-01 Task 3 builds the
     initial not-found branch (never reaches `ALGORITHMS`/layout lookup — `isAlgorithmId` gates it,
     T-4-01/ASVS V5); Plan 04-04 Task 2 expands it into the full rejected-id matrix (`0, 33, 99, -1,
     7.5, abc`, empty segment, leading/trailing junk) with a link back to the browse view. No
     `redirectTo` is used anywhere in this phase.

## Environment Availability

Skipped — this phase has no external service/tool dependencies beyond the already-installed
Angular/Vitest toolchain (verified via `package.json`, no new packages needed).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.8 via `@angular/build:unit-test` (Angular CLI's `ng test`) `[VERIFIED: package.json]` |
| Config file | Angular CLI-managed (`angular.json` test builder) — no standalone `vitest.config.ts` found in repo root |
| Quick run command | `npm test` (runs once, non-watch, outside a TTY — documented project quirk, see STATE.md) |
| Full suite command | `npm test` (same command; project has one Vitest project, not split unit/integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-01 | Browse view renders all 32 algorithms grouped, links to each detail route | component | `npm test` (`algorithms.spec.ts`) | ✅ exists (extend), Wave 0: extend fixture assertions |
| VIS-01 | `/algorithms/:id` opens a detail view for a valid id | routed-component | `npm test` (`algorithm-detail.spec.ts` via `RouterTestingHarness`) | ❌ Wave 0 |
| VIS-01 | Invalid/out-of-range id shows a not-found state, not a crash | routed-component | `npm test` (`algorithm-detail.spec.ts`) | ❌ Wave 0 |
| VIS-01 | Prev/next navigation steps sequentially through algorithms (D-04) | routed-component | `npm test` (`algorithm-detail.spec.ts`) | ❌ Wave 0 |
| VIS-02 | SVG renders expected operator/edge counts from fixture data | component (unit) | `npm test` (`algorithm-diagram.spec.ts`, Algorithm 1 + Algorithm 32 fixtures) | ❌ Wave 0 |
| VIS-02 | SVG has no `role="img"`, `<title>`/`<desc>` populated, `aria-labelledby` wired correctly; operators expose `role="button"` (blocking screen-reader check before VIS-02 complete) | component (unit) + manual | `npm test` (`algorithm-diagram.spec.ts`); Plan 04-05 VoiceOver checkpoint | ❌ Wave 0 |
| VIS-02 | Generated description enumerates every edge + carriers + feedback (D-12) | pure-function unit | `npm test` (`describe-algorithm.spec.ts`) | ❌ Wave 0 |
| VIS-03 | Carrier vs. modulator distinguishable via `data-role`/shape class, not color-only | component (unit) | `npm test` (`algorithm-diagram.spec.ts`) | ❌ Wave 0 |
| VIS-03 | Feedback self-loop renders with a distinct class/path from modulation edges | component (unit) | `npm test` (`algorithm-diagram.spec.ts`, Algorithm 1 or 32 fixture with feedback) | ❌ Wave 0 |
| — | Layout-hint data completeness: every `AlgorithmId` 1–32 has a layout record covering all 6 operators | pure-function unit | `npm test` (`algorithm-layout.spec.ts`) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (single Vitest project, whole suite runs each time per project quirk noted above)
- **Per wave merge:** `npm test` + `npm run build` + `npm run lint`
- **Phase gate:** All three green before `/gsd-verify-work`, per CLAUDE.md's "Verification commands"

### Wave 0 Gaps
- [ ] `src/app/domain/dx7/diagram/algorithm-layout.spec.ts` — covers layout-data completeness (no phase requirement directly, but blocks VIS-02's fixture-driven diagram tests)
- [ ] `src/app/domain/dx7/diagram/build-diagram-view-model.spec.ts` — covers view-model correctness feeding VIS-02
- [ ] `src/app/domain/dx7/diagram/describe-algorithm.spec.ts` — covers VIS-02's accessible-description requirement
- [ ] `src/app/features/algorithms/algorithm-detail/algorithm-detail.spec.ts` — covers VIS-01 (new `RouterTestingHarness` pattern for this codebase, first use)
- [ ] `src/app/features/algorithms/algorithm-diagram/algorithm-diagram.spec.ts` — covers VIS-02/VIS-03
- [ ] No new framework install needed — Vitest, `@angular/router/testing`, and jsdom are already present `[VERIFIED: package.json]`

## Security Domain

This phase has no authentication, session, network I/O, or persistence surface — it is a
client-side, read-only rendering feature over an in-memory canonical dataset (`ALGORITHMS`) already
validated at Phase 2. ASVS categories V2 (Authentication), V3 (Session Management), and V6
(Cryptography) do not apply. The one relevant category:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface in this phase |
| V3 Session Management | No | No session/state persistence in this phase |
| V4 Access Control | No | No privileged operations |
| V5 Input Validation | Yes | Route `:id` param is untrusted external input (user-editable URL) — validate with existing `isAlgorithmId` before array/map lookup; never index `ALGORITHMS`/`ALGORITHM_LAYOUTS` with an unvalidated numeric-or-NaN value |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Out-of-range or non-numeric `:id` causing an unhandled exception / blank page | Denial of Service (client-side) | Validate with `isAlgorithmId` before lookup; render an explicit not-found state on failure, per Anti-Patterns/Open Question 2 above |
| Angular template interpolation of `AlgorithmDefinition.name`/description text | Tampering (XSS) | Not exploitable here — all interpolated text originates from the app's own compiled-in `ALGORITHMS` dataset (no user-supplied or externally-fetched string ever reaches the template), and Angular's default template interpolation auto-escapes regardless |

## Sources

### Primary (HIGH confidence)
- `docs/ARCHITECTURE.md` (this repo) — §"Algorithm graph model", §"Rendering strategy" — read this
  session in full.
- `src/app/domain/dx7/models/algorithm-definition.ts`, `derive-role.ts`, `operator.ts`,
  `modulation-edge.ts`, `algorithm.ts`, `algorithms.ts` (this repo) — read this session in full/in
  part, quoted where load-bearing.
- `src/app/app.routes.ts`, `src/app/app.config.ts`, `src/app/features/algorithms/*`,
  `src/app/state/instrument-state.ts`, `src/app/core/browser/motion-preference.ts`,
  `src/styles/_tokens.scss` (this repo) — read this session.
- `eslint.config.js` (this repo) — read this session; domain-purity rule scope confirmed.
- CLAUDE.md (this repo, project instructions) — read this session.

### Secondary (MEDIUM confidence)
- angular.dev/api/router/testing/RouterTestingHarness — official Angular docs, fetched this
  session.
- github.com/angular/angular/issues/60703 — official Angular repo issue tracker, fetched this
  session (reported against 19.2.3; applicability to 22.1 not independently re-verified in this
  session, see Assumption A1).
- developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-end — MDN, from WebSearch
  result snippet.
- css-tricks.com/accessible-svgs, tpgi.com/using-aria-enhance-svg-accessibility — community
  accessibility guides documenting `<title>`/`<desc>`/`aria-labelledby` (often with `role="img"` for
  non-interactive decorative SVGs). Phase 4 deliberately omits `role="img"` so interactive
  `role="button"` operators remain exposed — see Assumption A2.

### Tertiary (LOW confidence)
- None used as the basis for a recommendation without independent corroboration.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, every library already installed and verified against
  `package.json` this session.
- Architecture: HIGH — directly derived from `docs/ARCHITECTURE.md` (read in full this session)
  and existing codebase conventions (read in full this session), not external inference.
- Pitfalls: MEDIUM — Pitfall 1 (router deep-link gap) is sourced from a GitHub issue reported
  against an older Angular minor version; not independently reproduced against the installed
  Angular 22.1 in this session (see Assumption A1). Pitfalls 2–4 are HIGH confidence, derived
  directly from this codebase's own data/patterns.

**Research date:** 2026-08-05
**Valid until:** 30 days (stable Angular minor version, no fast-moving external dependency in this
phase's scope)
