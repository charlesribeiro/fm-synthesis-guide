# Phase 6: Guided lessons for Algorithm 32 and Algorithm 1 - Research

**Researched:** 2026-08-10
**Domain:** Angular 22 signal-facade composition, event-driven state derivation, in-repo domain-model extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Lesson framework generality**
- **D-01:** Phase 6 builds a generic, data-driven `LessonDefinition` model now (domain layer,
  e.g. `src/app/domain/dx7/lessons/`, matching `docs/ARCHITECTURE.md`'s "Lesson definitions and
  completion rules" as pure domain data) plus one generic lesson-detail component that renders
  any `LessonDefinition` — not two bespoke, hand-written lesson components. — **Reversibility:**
  costly — Phase 11 (all 32 algorithms get a lesson) builds directly on this shape; two bespoke
  components now would mean retrofitting a generic model out of two already-diverging
  implementations later, the same duplication CLAUDE.md's domain rules warn against.
- **D-02:** The try-this step is structured, verifiable data — e.g.
  `{targetOperator: OperatorId, targetParam: keyof OperatorParameters, direction: 'increase' |
  'decrease'}` — not free-text instructional copy. This is what makes D-05's behavior-verified
  completion check possible, and it's reusable data shape for all 30 future Phase 11 lessons.

**"Try this" interactive surface**
- **D-03:** The learner plays the algorithm inline on the lesson page itself, via the same
  play-surface component Playground uses (shared, not duplicated) — not a hand-off/link to
  `/playground`. Keeps the lesson's explanation, diagram, and sound on one page, matching the
  "browse → hear → adjust → understand" core value happening in one place.
- **D-04:** Starting a lesson auto-sets `InstrumentState` to that lesson's algorithm and a known
  starting patch via the existing `setAlgorithm`/reset-to-preset commands (Phase 3), overriding
  whatever the learner had before. Matches `GSD_NEW_PROJECT_PROMPT.md`'s "reset a lesson to a
  known educational preset" — every learner reliably hears the lesson's intended starting sound.
- **D-05:** The lesson embeds Phase 4's SVG routing-diagram component inline, alongside the
  explanation — not just a link out to `/algorithms/:id`. The diagram, the explanation, and the
  play surface are all visible together while the learner works through the try-this step.

**Completion check mechanism**
- **D-06:** A lesson's try-this step is marked complete only once behavior-verified: the learner
  actually moved `targetParam` on `targetOperator` in `direction` (D-02's structured data) via
  `InstrumentState`, AND triggered at least one note afterward (so the change was actually heard,
  not just adjusted with the mouse) — not a self-reported "Mark complete" button. Directly serves
  the core value: "hear the sound it produces... immediately understand why the sound changed" is
  about hearing, not just twiddling a control.
- **D-07:** Per-lesson completion is tracked in-memory this phase via a small `LessonProgress`
  facade (mirrors `InstrumentState`'s private-writable-signal + `.asReadonly()` pattern) and shown
  as a checkmark/done-state on the `/learn` index. It resets on reload — no ad hoc localStorage;
  full persistence is `PERSIST-01` (Phase 12). `GSD_NEW_PROJECT_PROMPT.md`'s suggested application
  state list already names "Lesson step and completion state," so this facade existing in-memory
  now (with a real shape Phase 12 can persist later) is in scope, not scope creep.

**Lesson navigation structure**
- **D-08:** Each lesson is one scrolling page — objective, explanation + embedded diagram
  (D-05), try-this + embedded play surface (D-03), then the completion state — not a
  step-by-step Next/Back wizard. No wizard-state UI needed; the learner can see and re-read
  everything, and glance at the diagram while trying the experiment, without navigating away.
- **D-09:** `/learn` becomes an index of lesson cards (title, algorithm number, done/not-done
  checkmark per D-07) linking to `/learn/:lessonId`, replacing today's static placeholder list —
  matching `GSD_NEW_PROJECT_PROMPT.md`'s suggested route shape and the same browse-index →
  detail-route pattern Phase 4 already established (`/algorithms` → `/algorithms/:id`).
  — **Reversibility:** costly — Phase 11's 30 additional lessons and any future deep links depend
  on this URL shape; changing it later means updating every link into a specific lesson.

### Claude's Discretion
- Exact TypeScript shape of `LessonDefinition` (field names/nesting beyond D-02's try-this shape;
  how objective/explanation copy is represented — plain strings vs. structured paragraphs) and of
  the `LessonProgress` facade's public API (method names for marking/checking completion).
- Exact wording/pedagogical framing of the two lessons' objective and explanation text — informed
  by `GSD_NEW_PROJECT_PROMPT.md`'s "explain carrier versus modulator," "start with Algorithm 32 to
  explain six additive carriers," "use Algorithm 1 to introduce a simple stack plus a deeper
  modulation chain," and "avoid forcing the learner to memorize all 32 diagrams."
- Exact starting patch each lesson auto-sets via D-04 (which operator levels/ratios make the
  lesson's intended effect obvious) — informed by Phase 3's `DEFAULT_PATCH`/reset semantics and
  each algorithm's carrier/modulator structure from the Phase 2 dataset.
- Exact `targetOperator`/`targetParam`/`direction` chosen for each lesson's try-this step (D-02) —
  the specific operator/parameter change that best demonstrates that lesson's concept (e.g.
  toggling a carrier's `outputLevel` for Algorithm 32's additive lesson vs. a modulator's `ratio`
  or the feedback depth for Algorithm 1's stack-and-tower lesson).
- Whether the shared play-surface component (D-03) is extracted from `Playground` into a
  standalone reusable component now, or the lesson imports/composes Playground's existing
  sub-pieces directly — informed by `src/app/features/playground/playground.ts`'s current
  structure and Phase 5's "no second play surface" integration-point constraint.
- Exact visual treatment of the completion checkmark/done state on both the `/learn` index cards
  and the lesson page itself, respecting CLAUDE.md's non-color-only and reduced-motion rules.
- Whether `LessonProgress` lives as its own facade or as a thin extension alongside
  `InstrumentState` — informed by the existing signal-facade pattern and the fact that lesson
  completion is conceptually independent of instrument patch state.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (The full 32-algorithm curriculum, per-algorithm
curated presets, and lesson-progress persistence across reload were all named during discussion as
explicitly out of scope for this phase — CURR-01/Phase 11 and PERSIST-01/Phase 12 respectively —
and are recorded as such in the Phase Boundary, not as new deferred ideas.)

### Phase Boundary
A guided-lesson framework, plus its first two content instances — Algorithm 32 (pure additive
synthesis, six independent carriers) and Algorithm 1 (a stack and a tower: two carriers, one
simple pair, one four-operator modulation chain with feedback). Covers: a data-driven
`LessonDefinition` model (domain layer, no Angular), a generic `LessonPlayer`/lesson-detail
component that renders any lesson from that data, an in-memory `LessonProgress` facade tracking
per-lesson completion, the `/learn` index (replacing today's static placeholder list) and
`/learn/:lessonId` detail route, and the two lesson content records themselves — each with an
objective, explanation, an embedded try-this experience (diagram + play surface), a
behavior-verified completion check, and extracting the shared `PlaySurface` component from
`Playground` so lessons reuse that same component rather than creating a lesson-specific play
surface. Does NOT cover: the accurate AudioWorklet engine (Phase 7), the full 32-algorithm
curriculum or per-algorithm curated presets (Phase 11, CURR-01), persisting lesson progress
across reload (Phase 12, PERSIST-01), oscilloscope/spectrum visualizers (Phase 10), or a second
play-surface implementation that only the lesson page would own.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LESSON-01 | A guided lesson teaches Algorithm 32 as pure additive synthesis | `LessonDefinition`/`LESSONS` domain model (Architecture Patterns, Pattern 1), Algorithm 32's derived carrier set and edges (Code Examples), D-05 diagram reuse, D-06 completion-check design (System Architecture Diagram, Pitfalls 1-4) |
| LESSON-02 | A guided lesson teaches Algorithm 1 as a modulation stack plus tower, ending in the first end-to-end vertical slice (browse → hear → adjust → understand) | Same `LessonDefinition` model applied to Algorithm 1's edges/carriers (Code Examples), `PlaySurface` extraction (Architecture Patterns Pattern 4, Pitfall 5) providing the "hear" and "adjust" steps inline, `/learn` → `/learn/:lessonId` routing (Architecture Patterns Pattern 2) completing the vertical slice |

</phase_requirements>

## Summary

Phase 6 is almost entirely an **in-repo composition problem**, not a new-technology problem. Every
building block already exists in this codebase in a form the phase must mirror: `algorithm-definition.ts`
+ `algorithms.ts` is the template for the new `LessonDefinition` domain model and its `LESSONS` dataset;
`instrument-state.ts` is the template for the new `LessonProgress` facade; `AlgorithmDetail` +
`AlgorithmDiagram`'s injected-view-model composition is the template for embedding the SVG diagram inline
on the lesson page; and `Playground`'s `pressKey`/`releaseKey` note-lifecycle logic is the thing that must
be extracted into a shared, reusable play-surface component. No new package is needed — this phase adds
zero new dependencies.

The one genuinely new architectural problem is D-06's behavior-verified completion check: "moved
`targetParam` on `targetOperator` in `direction`, AND triggered at least one note afterward." Two traps
are live here. First, `SynthEngine.noteOn()` is a **command**, not an **event stream** — nothing in the
current codebase observes "a note was played" from outside the component that called `noteOn`. Second,
CLAUDE.md forbids using `effect()` to derive state, which rules out the naive "effect watches the patch
and fires when it changes" design. The research below resolves both: expose "a note started" as a
component **output signal** on the extracted play-surface component (an ordinary DOM-event-driven Angular
output, not a new `SynthEngine` method — the engine interface boundary Phase 7 must also implement stays
untouched), and implement the "moved in `direction`" half as a pure **computed** signal comparing current
`InstrumentState.operators()` against the lesson's own known starting patch (D-04) — no snapshot capture,
no effect for the completion check, because the starting value is already a compile-time constant on
`LessonDefinition`. (Approved carve-out, separate from completion: `LessonDetail` may use `effect()` for
route-reuse-safe `startingPatch` sync into `InstrumentState` when the same component instance is reused
across `:lessonId` changes — imperative external-state sync, not derived UI state.)

**Primary recommendation:** Build `LessonDefinition` + `LESSONS` in `src/app/domain/dx7/lessons/` (pure,
ESLint-domain-scoped, mirroring `algorithm-definition.ts`/`algorithms.ts`); extract `Playground`'s
note-lifecycle logic into a shared `PlaySurface` component with a `notePlayed = output<number>()`; build
`LessonProgress` in `src/app/state/` mirroring `InstrumentState`'s private-signal/`.asReadonly()` shape;
and wire D-06's completion check as a `computed()` predicate read imperatively from the `(notePlayed)`
event handler — never from an `effect()`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lesson content data (objective, explanation, try-this shape) | Pure domain (`src/app/domain/dx7/lessons/`) | — | Framework-independent per `docs/ARCHITECTURE.md` §1 ("Lesson definitions and completion rules"); no Angular symbol may appear here (ESLint-enforced, DOMAIN-04) |
| Lesson progress/completion state | Application state (`src/app/state/`) | — | `docs/ARCHITECTURE.md` §2 lists "Lesson/progress state" as its own signal-based facade, separate from instrument state |
| "Moved `targetParam` in `direction`" predicate | Application state (computed signal reading `InstrumentState`) | Pure domain (helper comparator function) | The comparison logic itself (given two `OperatorParameters` and a `TryThisStep`) is pure and belongs in domain; the live signal wiring that reads `InstrumentState.operators()` is Angular-facing and belongs in the lesson component/facade |
| "Note triggered" signal | UI feature (`PlaySurface` component output) | — | Not an engine-boundary concern — `SynthEngine`'s command surface (`noteOn`/`noteOff`) is deliberately shared across Phase 5's MVP engine and Phase 7's AudioWorklet engine; adding an event stream there would widen that stable interface for a UI-only need. The component that already calls `engine.noteOn()` is the natural event source |
| Algorithm routing/patch mutation on lesson start | Application state (`InstrumentState.setAlgorithm`, `updateOperator`, `setFeedback` — existing Phase 3 commands) | — | Single source of truth rule: the lesson reads/writes `InstrumentState`, never forks a parallel copy (per CONTEXT.md Integration Points) |
| SVG routing diagram | UI feature (reused `AlgorithmDiagram` component) | Pure domain (`buildDiagramViewModelForId`) | Presentational component takes a fully-resolved view model and never queries audio/state itself (`docs/ARCHITECTURE.md` §"Rendering strategy") |
| Sound production | Browser adapter (`SynthEngine` via `SYNTH_ENGINE` token) | — | Existing Phase 5 boundary; lesson's embedded play surface must go through it, never a second implementation |
| `/learn` index, `/learn/:lessonId` routing | UI feature (lazy-loaded route components) | — | Established Phase 1 convention: every feature route is `loadComponent`-lazy |

## Standard Stack

No new packages. This phase composes existing Angular 22 (`^22.1.0`, confirmed installed —
`node_modules/@angular/core/package.json` reports `22.1.0`) and Vitest (`^4.0.8`) infrastructure already
in `package.json`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@angular/core` | 22.1.0 (installed, `[VERIFIED: node_modules/@angular/core/package.json]`) | signals, `computed`, `output()`, `input()`, standalone components | Already the project's framework; no alternative considered |
| `@angular/router` | 22.1.0 (installed) | `/learn/:lessonId` lazy route, `ActivatedRoute`/`RouterTestingHarness` | Already used identically for `/algorithms/:id` (Phase 4) |
| `vitest` | 4.0.8 (installed) | Unit/component tests | Project-mandated (CLAUDE.md "Vitest is mandatory") |

### Supporting
None — no new runtime or dev dependency is required for this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `output()` signal function on `PlaySurface` for "note played" | `effect()` inside the lesson component watching a shared mutable field | Rejected — CLAUDE.md: "Use `effect` only for imperative synchronization with an external system. Do not use effects to derive state." An effect watching component-internal note state to flag "a note happened" is exactly the derive-state misuse the rule forbids; a genuine DOM-event-driven `output()` is not an effect at all |
| A `computed()` predicate for "moved in direction," compared against a `LessonDefinition`-embedded starting value | Snapshotting `InstrumentState.operators()` at lesson-mount time into a local field, then diffing | Rejected as unnecessary complexity — D-04 already guarantees the starting value is deterministic and known ahead of time (the lesson's own `startingPatch`), so there is nothing to snapshot at runtime; comparing against a constant is simpler and needs no lesson-mount-time side effect |
| A new `LessonId` string-slug type (e.g. `'algorithm-32-additive'`) | Reusing `AlgorithmId` (`1 \| 32`) directly as `LessonId` | `AlgorithmId` reuse looks appealing (`/learn/32` mirrors `/algorithms/32`) but silently assumes exactly one lesson per algorithm forever; Phase 11 (CURR-01, "every algorithm has a concise lesson") is consistent with 1:1 but does not guarantee it stays that way, and a distinct slug type costs nothing now while keeping the door open. Recommend a distinct `LessonId` type; flag as `[ASSUMED]` since it is not locked in CONTEXT.md (left to Claude's Discretion) |

**Installation:** None required.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. Every capability is either already-installed
Angular/Vitest infrastructure or new first-party TypeScript under `src/app/`.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │            LESSONS (pure domain data)        │
                         │  src/app/domain/dx7/lessons/lessons.ts        │
                         │  LessonDefinition[]: id, algorithmId,         │
                         │  objective, explanation, startingPatch,       │
                         │  tryThis: {targetOperator, targetParam,       │
                         │            direction}                         │
                         └───────────────┬───────────────────────────────┘
                                          │ read by id
                 ┌────────────────────────┴─────────────────────────────┐
                 ▼                                                       ▼
   ┌───────────────────────────┐                        ┌────────────────────────────┐
   │  /learn  (Learn, browse)   │  routerLink            │ /learn/:lessonId            │
   │  reads LESSONS + reads     │ ───────────────────▶   │ (LessonDetail)              │
   │  LessonProgress.isComplete │                        │ resolves :lessonId ->       │
   │  for each card checkmark   │                        │ LessonDefinition (validated,│
   └───────────────────────────┘                        │ not-found on miss)          │
                                                          └───────────┬──────────────────┘
                                                                      │ on mount (D-04)
                                                                      ▼
                                          ┌───────────────────────────────────────────┐
                                          │ InstrumentState.setAlgorithm(algorithmId)  │
                                          │ InstrumentState.updateOperator(...)  x N   │
                                          │  — applies lesson.startingPatch            │
                                          └───────────────┬─────────────────────────────┘
                                                           │ InstrumentState.operators()
                                                           │ (read, reactive)
                    ┌──────────────────────────────────────┼───────────────────────────────┐
                    ▼                                      ▼                                ▼
        ┌───────────────────────┐          ┌───────────────────────────┐      ┌──────────────────────────┐
        │ AlgorithmDiagram (D-05)│          │  paramMoved = computed()   │      │  PlaySurface (D-03)       │
        │ [viewModel]=diagramVM  │          │  compares operators()      │      │  shared with Playground   │
        │ (reused, unmodified)   │          │  [targetOperator]          │      │  notePlayed = output<num> │
        └───────────────────────┘          │  [targetParam] against     │      │  emits on real pressKey   │
                                            │  lesson.startingPatch, per │      └────────────┬───────────────┘
                                            │  direction — PURE, no      │                   │ (notePlayed)="..."
                                            │  effect() involved         │                   ▼
                                            └──────────────┬──────────────┘      ┌──────────────────────────┐
                                                            │ read imperatively   │ onNotePlayed(note) {     │
                                                            └────────────────────▶│  if (paramMoved())       │
                                                                                  │    lessonProgress        │
                                                                                  │      .markComplete(id)   │
                                                                                  │ }                        │
                                                                                  └────────────┬──────────────┘
                                                                                               ▼
                                                                                  ┌──────────────────────────┐
                                                                                  │ LessonProgress facade     │
                                                                                  │ src/app/state/            │
                                                                                  │ private signal +          │
                                                                                  │ .asReadonly(), in-memory  │
                                                                                  └──────────────────────────┘
```

The primary use case traced: learner opens `/learn/:lessonId` → route resolves `LessonDefinition` →
component applies `startingPatch` to `InstrumentState` → learner adjusts the target operator's parameter
(read by `paramMoved` computed) → learner plays a note on the embedded `PlaySurface` → `PlaySurface` emits
`notePlayed` → the lesson component's event handler reads `paramMoved()` at that instant and marks the
lesson complete in `LessonProgress` → `/learn`'s index re-renders that lesson's card with a done state.

### Recommended Project Structure
```
src/app/
├── domain/dx7/lessons/
│   ├── lesson-definition.ts       # LessonDefinition interface, TryThisStep, LessonId type + guard
│   ├── lessons.ts                 # LESSONS: readonly LessonDefinition[] — the two content rows
│   ├── try-this.ts                # pure hasMovedTowardTarget(baseline, current, tryThis): boolean
│   ├── lesson-definition.spec.ts
│   ├── lessons.spec.ts
│   └── try-this.spec.ts
├── state/
│   ├── lesson-progress.ts         # LessonProgress facade (mirrors InstrumentState shape)
│   └── lesson-progress.spec.ts
├── features/
│   ├── play-surface/              # extracted from playground/ (D-03/D-05 discretion)
│   │   ├── play-surface.ts        # notePlayed = output<number>(); keys, pointer/keyboard handlers
│   │   ├── play-surface.html
│   │   ├── play-surface.scss
│   │   └── play-surface.spec.ts
│   ├── playground/
│   │   ├── playground.ts          # thin wrapper: <app-play-surface />, unchanged public behavior
│   │   └── ...
│   └── learn/
│       ├── learn.ts               # rebuilt index: reads LESSONS + LessonProgress
│       ├── learn.html
│       ├── learn.spec.ts
│       └── lesson-detail/
│           ├── lesson-detail.ts   # /learn/:lessonId — the new component
│           ├── lesson-detail.html
│           ├── lesson-detail.scss
│           └── lesson-detail.spec.ts
```

### Pattern 1: Domain-layer dataset + lookup map (mirrors `algorithms.ts` + `instrument-state.ts`'s `ALGORITHMS_BY_ID`)
**What:** A frozen `LESSONS: readonly LessonDefinition[]` array plus a derived `Map<LessonId, LessonDefinition>` for O(1) lookup, exactly like `ALGORITHMS_BY_ID` in `instrument-state.ts`.
**When to use:** Any place a route or facade needs to resolve an untrusted id to a definition.
**Example:**
```typescript
// Source: src/app/state/instrument-state.ts:56-58 (existing, in-repo pattern) — quoted verbatim
// [VERIFIED: src/app/state/instrument-state.ts:56-58]
const ALGORITHMS_BY_ID: ReadonlyMap<AlgorithmId, AlgorithmDefinition> = new Map(
  ALGORITHMS.map((algorithm) => [algorithm.id, algorithm]),
);
```
Apply the identical shape for `LESSONS_BY_ID: ReadonlyMap<LessonId, LessonDefinition>`.

### Pattern 2: Validated route-param resolution with explicit not-found state (mirrors `AlgorithmDetail`)
**What:** Resolve `:lessonId` via injected `ActivatedRoute` + `toSignal(route.paramMap)` with
`route.snapshot.paramMap` as `initialValue` — never `withComponentInputBinding()`.
**When to use:** `LessonDetail`'s `:lessonId` resolution, identically to `AlgorithmDetail`'s `:id`.
**Example:**
```typescript
// Source: src/app/features/algorithms/algorithm-detail/algorithm-detail.ts:42-46 — quoted verbatim
// [VERIFIED: src/app/features/algorithms/algorithm-detail/algorithm-detail.ts:42-46]
private readonly route = inject(ActivatedRoute);

private readonly paramMap = toSignal(this.route.paramMap, {
  initialValue: this.route.snapshot.paramMap,
});
```
Rationale in-repo (comment on that same component, lines 27-32): "Reads the param via injected
`ActivatedRoute` + `toSignal(paramMap)` rather than a `withComponentInputBinding()` signal input
(RESEARCH.md Pitfall 1's deep-link gap), with `route.snapshot.paramMap` as the `initialValue` so a cold
deep link resolves correctly on first render." The same deep-link gap applies verbatim to
`/learn/:lessonId` — a learner may bookmark or share a direct lesson link.

Unlike `AlgorithmDetail`'s numeric `:id` (validated via a strict-digit regex then `isAlgorithmId`),
`:lessonId` is a string slug — validate via an `isLessonId(value): value is LessonId` guard checking
membership in a frozen `LESSON_IDS` array (mirrors `isOperatorId`/`isSnapshotSlot`'s runtime-guard
convention — `[VERIFIED: src/app/domain/dx7/models/operator.ts:16-18]`: `export function isOperatorId(value: number): value is OperatorId { return OPERATOR_IDS.includes(value as OperatorId); }`), never a regex against the algorithm-id numeric pattern.

### Pattern 3: Signal-facade with private-writable + `.asReadonly()` (mirrors `InstrumentState`, `MotionPreference`)
**What:** `LessonProgress` exposes a read-only `Signal<ReadonlySet<LessonId>>` (or
`ReadonlyMap<LessonId, boolean>`) of completed lesson ids, written only through an explicit
`markComplete(lessonId)` command.
**Example:**
```typescript
// Source: src/app/state/instrument-state.ts:96-106 — quoted verbatim, the shape to mirror
// [VERIFIED: src/app/state/instrument-state.ts:96-106]
@Injectable({ providedIn: 'root' })
export class InstrumentState {
  private readonly _patch = signal<InstrumentPatch>(DEFAULT_PATCH);

  /** Read-only: the full current patch (algorithm id + operators + feedback). */
  readonly patch: Signal<InstrumentPatch> = this._patch.asReadonly();
```
`LessonProgress` should follow this exact shape: `private readonly _completed = signal<ReadonlySet<LessonId>>(new Set())`, `readonly completed = this._completed.asReadonly()`, plus a `isComplete(lessonId: LessonId): boolean` reader method (mirrors `InstrumentState.hasSnapshot`'s parameterized-reader-method convention — `[VERIFIED: src/app/state/instrument-state.ts:229-233]`: `hasSnapshot(slot: SnapshotSlot): boolean { ... return this._snapshots()[slot] !== null; }`) and a `markComplete(lessonId: LessonId): void` command that validates `lessonId` first (mirrors every `InstrumentState` command's validate-before-write posture).

### Pattern 4: Extracting shared UI logic into a standalone component with a signal `output()`
**What:** Move `Playground`'s `pressKey`/`releaseKey`/keyboard-and-pointer-handling block into a new
`PlaySurface` component; `Playground` becomes a thin host embedding it, and `LessonDetail` embeds the same
component.
**Why this shape over a shared service/directive:** `Playground`'s current logic (`playground.ts:1-275`,
read in full this session) is templated, stateful (`_heldNote`, `keyboardHeldCode`, `pointerHeldNote`,
`buttonHeldNote`), and owns DOM event bindings via the `host` metadata block
(`'(document:keydown)': 'onDocumentKeydown($event)'` etc. — `[VERIFIED: src/app/features/playground/playground.ts:26-30]`). A directive could apply the host bindings but cannot also own the template markup (`.key` buttons, `<app-play-surface>`'s own SVG/DOM), and a plain service cannot own `host` bindings or a template at all — a standalone component is the only option that carries both the template and the document-level listeners together, matching how the codebase already composes `AlgorithmDiagram` (component takes an `[input]`, not a directive/service).
**Example — the output the new component adds:**
```typescript
// New code — first use of output() in this codebase (no other file currently
// imports `output` from '@angular/core' — confirmed via repo-wide grep this
// session). Angular 22 supports output() as of the signal-inputs era already
// in use here (input.required() confirmed at
// src/app/features/algorithms/algorithm-diagram/algorithm-diagram.ts:41).
import { Component, output } from '@angular/core';

export class PlaySurface {
  /** Emits the MIDI note number every time a note actually starts sounding
   * (i.e. only when pressKey() returns true — engine was ready). Consumers
   * that only care "a note was played" can ignore the payload. */
  readonly notePlayed = output<number>();

  protected pressKey(note: number): boolean {
    if (!this.isReady()) {
      return false;
    }
    this.engine.noteOn(note, PLAYABLE_VELOCITY);
    this._heldNote.set(note);
    this.notePlayed.emit(note);
    return true;
  }
}
```
`[ASSUMED]` — `output()` itself is a stable, long-standing Angular signals API (predates this project's
Angular 22 pin), but since it has zero prior usage in this repo, its exact call-site ergonomics here are
new territory for this codebase and should be spot-verified against `@angular/core`'s installed type
declarations during planning/execution rather than assumed correct from training memory alone.

### Anti-Patterns to Avoid
- **Using `effect()` to detect "a note was played":** CLAUDE.md is explicit — `effect` is for imperative
  sync with an external system, never for deriving state. There is no external system to sync to here;
  "a note was played" is a genuine user-input event, which Angular already models as a DOM/component
  event, not a signal to watch reactively. An `effect()` reading some `lastNoteAt` timestamp signal to
  flip a `heard` boolean is state derivation through a side channel and must not be built.
- **Adding a `notePlayed`/event surface to the `SynthEngine` interface itself:** `SynthEngine`
  (`src/app/core/audio/synth-engine.ts:32-43`, read this session) is the shared boundary between Phase 5's
  MVP engine and Phase 7's future AudioWorklet engine (`docs/ARCHITECTURE.md` §"Audio roadmap" —
  "Keep behind the same engine interface"). Widening that interface for a lesson-only UI concern couples
  every future engine implementation to a UI detail it does not need; keep the event at the
  `PlaySurface` component level instead.
- **Snapshotting `InstrumentState.operators()` at lesson-mount time to compute a diff baseline:**
  Unnecessary — D-04 already fixes the starting value (`lesson.startingPatch`) as a compile-time constant
  on `LessonDefinition`. Comparing "current vs. the constant" needs no runtime snapshot, no extra signal,
  and cannot drift from what the lesson claims it reset the learner to.
- **Storing the emitted note number, or any `AudioNode`, in `LessonProgress`'s signal state:** CLAUDE.md:
  "Never store AudioNodes in Angular signal state." `LessonProgress` should only ever hold a
  `ReadonlySet<LessonId>`/boolean-per-lesson shape — never a note number, timestamp, or engine reference.
- **A `LessonDefinition.startingPatch` that silently reuses `DEFAULT_PATCH`'s frozen operator object by
  reference for operators the lesson does not care about, then mutates it:** `DEFAULT_PATCH` and
  `DEFAULT_OPERATOR_PARAMETERS` are frozen (`Object.freeze`) specifically so no consumer can "corrupt the
  shared reset/init target in place" (comment at `src/app/domain/dx7/models/patch.ts:41-49`, read this
  session — quoted: `"Frozen at every level ... so no consumer can corrupt the shared reset/init target in
  place (T-03-01)."`). Build each lesson's `startingPatch` as its own new object (spread, never mutate).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Note-lifecycle click/stuck-voice prevention | A second pointerdown/keydown/pointerup state machine for the lesson's play surface | The extracted `PlaySurface` component (D-03) | `Playground`'s existing logic already solves right-click handling (WR-07), Tab-mid-press stranding, window-blur cleanup, and OS auto-repeat — reproducing any of it is exactly the "no second play surface" risk CONTEXT.md's Integration Points section calls out |
| Route-param validation | A second strict-digit-pattern parser for `:lessonId` | A membership guard against a frozen `LESSON_IDS` array (`isLessonId`), mirroring `isOperatorId`/`isSnapshotSlot` | `:lessonId` is a string slug, not an integer — `AlgorithmDetail`'s `STRICT_INTEGER_ID_PATTERN` approach does not apply; a set-membership check is both simpler and correct for a small, closed set of ids |
| Carrier/modulator role lookup for lesson copy | A second per-algorithm hardcoded role table | `getOperatorRole`/`deriveCarriers` from `derive-role.ts` (Phase 2) | DOMAIN-03 requires roles to be derived, never hardcoded — lesson copy that names "operator 3 is a carrier" must read that fact from the existing derivation, not restate it |
| Diagram rendering | A second SVG diagram tailored for lesson pages | The existing `AlgorithmDiagram` component fed by `buildDiagramViewModelForId` | D-05 explicitly requires reuse; the component already meets VIS-02/VIS-03's accessibility and feedback-loop-visibility bars |

**Key insight:** Every "don't hand-roll" item in this phase is really the same rule restated three ways —
Phase 6 has no genuinely new domain logic to invent; its entire job is composing four already-built,
already-tested subsystems (algorithm dataset, instrument state, SVG diagram, audio engine) behind one new
thin domain model (`LessonDefinition`) and one new thin facade (`LessonProgress`).

## Runtime State Inventory

Not applicable — Phase 6 is a greenfield feature addition (new domain model, new facade, new routes), not
a rename/refactor/migration. No existing stored data, live service config, OS-registered state, secrets,
or build artifacts reference anything this phase renames or moves. (The one file being *edited in place*,
`src/app/features/learn/learn.ts`, is a static placeholder with no runtime state of its own — its
`upcomingLessons` array is replaced by data-driven `LESSONS`, not migrated.)

## Common Pitfalls

### Pitfall 1: Reaching for `effect()` for the completion check
**What goes wrong:** A first-draft implementation watches `InstrumentState.operators()` and `PlaySurface`'s
note state together inside an `effect()` in the lesson component, setting a `LessonProgress` flag when both
conditions look true.
**Why it happens:** `effect()` is the intuitive tool for "when X changes, do Y," and completion genuinely
depends on two different signals changing over time.
**How to avoid:** Split the two halves. The "moved in direction" half is a pure `computed()` — no
side-effect needed, since nothing needs to *happen* when it becomes true, it just needs to be *readable*.
The "and afterward a note was triggered" half is answered by an actual DOM-originated event
(`PlaySurface`'s `notePlayed` output) — read `paramMoved()` from inside that event's handler, imperatively.
Neither half needs `effect()`; CLAUDE.md's rule is satisfied because no effect exists at all in this flow.
(Approved carve-out elsewhere in the lesson feature: `LessonDetail` may use `effect()` for
route-reuse-safe `startingPatch` sync into `InstrumentState` — not for this completion check.)
**Warning signs:** Any lesson-related file importing `effect` from `@angular/core` outside the
approved `LessonDetail` startingPatch carve-out — flag for review in
code review per CLAUDE.md's audio-rules precedent for `WebAudioSynthEngine`'s "the one sanctioned effect()
in this phase" comment style (`src/app/core/audio/web-audio-synth-engine.ts:156-157`, read this session).

### Pitfall 2: Widening `SynthEngine` to add a note-played event
**What goes wrong:** It seems natural to add `readonly notePlayed: Signal<number | null>` (or an
`EventEmitter`) directly to the `SynthEngine` interface, since `noteOn` is already the call site.
**Why it happens:** The engine already "knows" when a note plays; adding an event there feels
DRY compared to duplicating that knowledge in a UI component.
**How to avoid:** Keep `SynthEngine` exactly as Phase 5 shipped it (`initialize`/`setAlgorithm`/
`updateOperatorLevel`/`setFeedback`/`noteOn`/`noteOff`/`allNotesOff`/`destroy`/`status`). The UI-only "a
note was played" fact belongs on the component that already decides whether to call `noteOn` in the first
place (`PlaySurface.pressKey`) — it already knows whether the call actually happened (guarded by
`isReady()`), so emitting there is both correct and free.
**Warning signs:** A diff touching `src/app/core/audio/synth-engine.ts` or
`src/app/core/audio/web-audio-synth-engine.ts` for this phase should be treated as a signal something went
wrong — Phase 6's scope is UI/state/domain composition, not the audio boundary.

### Pitfall 3: `keyof OperatorParameters` accepting non-directional / inaudible fields as `targetParam`
**What goes wrong:** D-02's shape is `targetParam: keyof OperatorParameters`, but `OperatorParameters`
(`[VERIFIED: src/app/domain/dx7/models/operator-parameters.ts:28-41]`) also includes `enabled: boolean` and
`mode: OperatorFrequencyMode` — neither has a meaningful "increase"/"decrease" direction — and
`fixedFrequencyHz`, which is documented inert while an operator is in `'ratio'` mode (the mode every
Phase 6 starting patch uses). A naive `hasMovedTowardTarget` comparator that does `current > baseline`
for `direction === 'increase'` will silently misbehave on `enabled`/`mode`, and a try-this step that
targets `fixedFrequencyHz` can move a number without any audible change — breaking D-06's "so the
change was actually heard."
**How to avoid:** Narrow `targetParam` to the four audible directional parameters only
(`'ratio' | 'detune' | 'outputLevel' | 'envelopeLevel'`, i.e. `Exclude<keyof OperatorParameters,
'enabled' | 'mode' | 'fixedFrequencyHz'>`) — the resolved `TryThisParam` contract in
`lesson-definition.ts` / `06-PATTERNS.md` / `06-01-PLAN.md` `<phase_decisions>`. That type makes the
direction-comparison logic total and keeps note-gated completion on parameters that can be heard.
CONTEXT.md's D-02 states the shape as `keyof OperatorParameters` verbatim; this is a strict subset of
that intent, locked for Phase 6 by the plan rather than left open.
**Warning signs:** A lesson's `tryThis.targetParam` set to `'enabled'`, `'mode'`, or
`'fixedFrequencyHz'` in the `LESSONS` data.

### Pitfall 4: `updateOperator`'s per-operator immutability breaking naive reference-equality checks
**What goes wrong:** `InstrumentState.updateOperator` (`[VERIFIED: src/app/state/instrument-state.ts:165-175]`)
replaces only the changed operator's parameter object — "every other operator's parameters object stays
reference-identical to the one read before the call" (comment at lines 159-163, quoted verbatim). A
`computed()` that reads `operators()[targetOperator]` and expects a *new* object identity on every
unrelated change (e.g. re-running due to feedback changing) will not re-run when it should not, but a
naive component using `===` against a captured object elsewhere could be fooled either way. This is not a
bug in `InstrumentState` — it is a correctness *feature* the lesson's `computed()` must be written to rely
on (Angular's `computed()` already re-runs correctly on any signal read change; the risk is only in
hand-rolled comparisons elsewhere, e.g. inside `hasMovedTowardTarget` if it is accidentally passed whole
`OperatorParameters` objects and compares them by reference instead of by the specific `targetParam` field).
**How to avoid:** `hasMovedTowardTarget` must compare the specific `targetParam` *value*
(`current[targetParam]`), never the whole `OperatorParameters` object by reference.
**Warning signs:** A completion check that never flips to `true` even after the learner visibly changes the
target parameter in the UI.

### Pitfall 5: `PlaySurface` extraction accidentally changing `Playground`'s existing, UAT-approved behavior
**What goes wrong:** `Playground`'s note-lifecycle code (`playground.ts:1-275`) has several
already-fixed, comment-documented edge cases (WR-07 right-click handling, Tab-mid-Space/Enter-press
stranding, window-blur cleanup, OS auto-repeat suppression) that were verified in Phase 5's UAT
(`05-UAT.md`, referenced in STATE.md). A mechanical extraction that reorders guard clauses or drops the
`host` binding block during the move could silently regress one of these.
**How to avoid:** Move the code, do not rewrite it — the extraction should be closer to a cut-and-paste of
lines 1-275 into the new component (renaming only what's needed for the new `output()`), with
`Playground`'s own existing spec suite (`playground.spec.ts`) re-run unmodified (only the component under
test changes from `Playground` to `PlaySurface`, or `Playground`'s spec now tests through the thin wrapper)
as the regression gate.
**Warning signs:** Any of Phase 5's specific test names in `playground.spec.ts` (e.g. "constructs no
AudioContext before the Enable-audio gesture," "schedules a rising ramp on note-on and a release-to-zero
on note-off" — both confirmed present in that file this session) failing after the extraction.

## Code Examples

### Existing `AlgorithmId`-style restricted-literal + guard pattern to mirror for `LessonId`
```typescript
// Source: src/app/domain/dx7/models/operator.ts:12-18 — quoted verbatim
// [VERIFIED: src/app/domain/dx7/models/operator.ts:12-18]
export type OperatorId = 1 | 2 | 3 | 4 | 5 | 6;

export const OPERATOR_IDS: readonly OperatorId[] = [1, 2, 3, 4, 5, 6];

export function isOperatorId(value: number): value is OperatorId {
  return OPERATOR_IDS.includes(value as OperatorId);
}
```
Apply the same shape for `LessonId` (string-literal union of the two lesson slugs this phase adds, e.g.
`'algorithm-32' | 'algorithm-1'` — exact slug text is Claude's Discretion) with `LESSON_IDS` and
`isLessonId`.

### Existing algorithm-1 and algorithm-32 edge data (ground truth for lesson copy and `startingPatch` design)
```typescript
// Source: src/app/domain/dx7/models/algorithms.ts:77-87 (Algorithm 1) and :432-438 (Algorithm 32)
// — quoted verbatim, read this session
// [VERIFIED: src/app/domain/dx7/models/algorithms.ts:77-87,432-438]

// Algorithm 1:
{
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
}

// Algorithm 32:
{
  id: 32,
  name: 'Six independent carriers summed with no inter-operator modulation',
  edges: edges([
    { from: 6, to: 6 }, // feedback self-loop, D-01 — the only edge this algorithm declares
  ]),
  teachingTags: parallelTags,
}
```
Derived facts (via `derive-role.ts`'s rules, applied to the edges above, not re-derived by a new function):
- **Algorithm 1** carriers: operators **1** and **3** (neither has an outgoing edge to another operator).
  Modulators: 2 (→1, "the simple pair"), and 4, 5, 6 (6→5→4→3, "the four-operator modulation chain," with
  operator 6 also carrying the feedback self-loop). This is the "stack and a tower" framing the lesson copy
  (per `GSD_NEW_PROJECT_PROMPT.md`) should use.
- **Algorithm 32** carriers: all six operators (zero edges to another operator exist). Operator 6 alone
  carries the feedback self-loop but is still a carrier (per `derive-role.ts`'s `edge.to !== operatorId`
  guard — a self-loop does not count as "modulates another operator").

A concrete try-this candidate for Algorithm 32 (Claude's Discretion, offered as a starting recommendation,
not locked): `{ targetOperator: 3, targetParam: 'outputLevel', direction: 'decrease' }` — muting/lowering
one of six otherwise-identical independent carriers makes "this is additive synthesis: turning one voice
down removes exactly one component of the sum" audible and legible against the diagram. `[ASSUMED]`.

A concrete try-this candidate for Algorithm 1: `{ targetOperator: 5, targetParam: 'ratio', direction:
'increase' }` — operator 5 is a modulator in the middle of the 6→5→4→3 chain feeding carrier 3; raising its
ratio changes the timbre of the "tower" carrier audibly while leaving the "stack" carrier (operator 1, fed
only by operator 2) untouched, illustrating that the two carriers are independent. `[ASSUMED]`.

### `LessonDefinition`'s `startingPatch` — reuse the existing `InstrumentPatch` shape, don't invent a new one
```typescript
// Source: src/app/domain/dx7/models/patch.ts:23-27 — quoted verbatim
// [VERIFIED: src/app/domain/dx7/models/patch.ts:23-27]
export interface InstrumentPatch {
  readonly algorithmId: AlgorithmId;
  readonly operators: OperatorParameterSet;
  readonly feedback: number;
}
```
`LessonDefinition.startingPatch: InstrumentPatch` lets `LessonDetail`'s D-04 setup collapse to reading
`lesson.startingPatch` and applying it via the *existing* three `InstrumentState` commands
(`setAlgorithm`, then one `updateOperator` per operator that differs from `DEFAULT_PATCH`, then
`setFeedback` if non-zero) — never a new "set whole patch at once" command on `InstrumentState` (that
facade's existing surface is deliberately command-based per operator/algorithm/feedback, not a bulk
setter — inventing one only for this phase would be new API surface CONTEXT.md's Integration Points
section does not call for).

## State of the Art

Not applicable in the traditional sense — this is a first-party, in-repo composition phase with no
external library API to track for staleness. The one "current approach" worth naming: Angular's `output()`
function (replacing the older `@Output() eventName = new EventEmitter()` decorator pattern) is the
signal-era idiom and is already implicitly the project's direction given its exclusive use of `input()`/
`input.required()` for the equivalent inbound case (`algorithm-diagram.ts:41`, confirmed this session).
Using `@Output()`/`EventEmitter` for `PlaySurface.notePlayed` would be inconsistent with the rest of this
codebase's signal-first posture and is not recommended.

**Deprecated/outdated:** N/A for this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `LessonId` should be a distinct string-slug type, not a reuse of `AlgorithmId` | Standard Stack (Alternatives Considered) | Low — reversible; if wrong, planner picks the simpler numeric-id route instead, costing a rename before Phase 11 locks it in (D-09's route shape is "costly to reverse" per CONTEXT.md, so this should be confirmed during planning, not assumed silently through to execution) |
| A2 | `targetParam` (`TryThisParam`) is the four audible directional fields only — `Exclude<keyof OperatorParameters, 'enabled' \| 'mode' \| 'fixedFrequencyHz'>`; `fixedFrequencyHz` is excluded because it is inert in ratio mode and cannot satisfy D-06's audible completion check | Common Pitfalls (Pitfall 3) | Low for Phase 6 — resolved in `lesson-definition.ts` and mirrored by `06-PATTERNS.md` / `06-01-PLAN.md`; Medium if a future Phase 11 lesson re-widens the type without also handling fixed-mode operators, because an inert `fixedFrequencyHz` try-this would complete without a heard change |
| A3 | Algorithm 32's try-this: operator 3 `outputLevel` decrease; Algorithm 1's try-this: operator 5 `ratio` increase | Code Examples | Low — explicitly Claude's Discretion per CONTEXT.md; offered only as a starting recommendation for planning, not a locked design |
| A4 | `output()`'s exact call ergonomics (no prior usage in this codebase to confirm against) | Architecture Patterns, Pattern 4 | Low — `output()` is a stable, well-documented Angular API; risk is purely "first use in this repo," not API instability |
| A5 | `PlaySurface` should be a new standalone component (not a directive or service) | Architecture Patterns, Pattern 4 | Low — directly follows from `Playground`'s existing use of `host` bindings + a template, which only a component can carry; alternative structures were reasoned through and rejected with cited evidence, not left unexamined |

## Open Questions (RESOLVED)

1. **Exact wording of `LessonId` slugs and file/route naming (`'algorithm-32'` vs. `'additive-synthesis'`
   vs. numeric)**
   - What we know: D-09 locks the route *shape* (`/learn/:lessonId`) but not the slug values; CONTEXT.md
     explicitly leaves "exact TypeScript shape of `LessonDefinition`" to Claude's Discretion.
   - What's unclear: whether Phase 11's future 30 lessons will want a naming scheme this phase's two slugs
     should anticipate (e.g. always `algorithm-N`, vs. thematic names for the two "featured" starter
     lessons and numeric slugs for the rest).
   - Recommendation: use `algorithm-32`/`algorithm-1` (matching the phase's own name and this research's
     working examples) — simplest, most consistent with a likely `algorithm-N` scheme for Phase 11's
     remaining 30, and requires no separate slug-to-algorithm mapping table beyond `LessonDefinition.
     algorithmId` itself.
   - **RESOLVED** (06-01-PLAN.md `<phase_decisions>`): slugs are `algorithm-32`/`algorithm-1`, per the
     recommendation above.

2. **Whether `LessonProgress` marks completion permanently once achieved, or can un-complete if the learner
   later moves `targetParam` back past the starting value**
   - What we know: D-07 says completion "resets on reload" (in-memory only) but says nothing about
     within-session un-completion.
   - What's unclear: CONTEXT.md doesn't address whether completion is a one-way ratchet within a session.
   - Recommendation: one-way ratchet (`markComplete` only ever adds to the completed set, never removes) —
     matches the pedagogical intent ("a learner can complete the lesson") better than a flickering
     checkmark, and is simpler to test deterministically.
   - **RESOLVED** (06-01-PLAN.md `<phase_decisions>`): one-way ratchet, per the recommendation above.

## Environment Availability

Skipped — no external tool, service, runtime, or CLI dependency beyond what Phases 1-5 already established
(Node/npm/Angular CLI, already verified working per STATE.md's phase history). This phase adds no new
external dependency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.8 via `@angular/build:unit-test` (Angular CLI's `ng test`/`npm test`) |
| Config file | Angular CLI-managed (no standalone `vitest.config.ts` found in repo root — confirmed via prior phases' STATE.md note: `"npm test -- --run" isn't a real flag on Angular 22's ng test builder`) |
| Quick run command | `npm test` (runs once, exits, per STATE.md Phase 1 note) |
| Full suite command | `npm test` (same — the project has one test command, no separate "quick" vs. "full" split) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LESSON-01 | Learner can complete the Algorithm 32 lesson: objective/explanation/try-this/completion render, try-this actually completes on correct action | component | `npm test` (targets `lesson-detail.spec.ts`) | ❌ Wave 0 |
| LESSON-02 | Learner can complete the Algorithm 1 lesson (same shape, algorithm 1 data) | component | `npm test` (targets `lesson-detail.spec.ts`) | ❌ Wave 0 |
| — | (supporting) `LessonDefinition`/`LESSONS` dataset validity (both rows resolve to a real algorithm, `startingPatch` well-formed) | domain unit | `npm test` (targets `lessons.spec.ts`) | ❌ Wave 0 |
| — | (supporting) `hasMovedTowardTarget` pure predicate — increase/decrease/no-change cases | domain unit | `npm test` (targets `try-this.spec.ts`) | ❌ Wave 0 |
| — | (supporting) `LessonProgress` facade — starts empty, `markComplete` is idempotent, resets on fresh injection | facade unit | `npm test` (targets `lesson-progress.spec.ts`) | ❌ Wave 0 |
| — | (supporting) `PlaySurface` extraction — behavior parity with Phase 5's `playground.spec.ts` assertions, plus `notePlayed` emits on successful `pressKey` only | component | `npm test` (targets `play-surface.spec.ts`) | ❌ Wave 0 |
| — | (supporting) `/learn` index renders both lesson cards with correct done/not-done state from `LessonProgress` | route/component | `npm test` (targets rebuilt `learn.spec.ts`) | ⚠️ Wave 0 (file exists as placeholder test, needs rewrite) |
| — | (supporting) `/learn/:lessonId` cold-deep-link resolution + not-found state for an unknown slug | route | `npm test` (targets `lesson-detail.spec.ts`, mirrors `algorithm-detail.spec.ts`'s `RouterTestingHarness` pattern) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test` + `npm run build` + `npm run lint` (all three are CLAUDE.md's mandatory
  verification commands and should gate every plan, not just the phase gate)
- **Phase gate:** All three green before `/gsd-verify-work`, matching Phase 5's precedent (STATE.md: "05-04
  checkpoint," "9/9 must-haves")

### Wave 0 Gaps
- [ ] `src/app/domain/dx7/lessons/lesson-definition.ts` + `.spec.ts` — `LessonDefinition`, `LessonId`,
      `TryThisStep`, `isLessonId` guard
- [ ] `src/app/domain/dx7/lessons/lessons.ts` + `.spec.ts` — the two `LESSONS` rows
- [ ] `src/app/domain/dx7/lessons/try-this.ts` + `.spec.ts` — `hasMovedTowardTarget` pure predicate
- [ ] `src/app/state/lesson-progress.ts` + `.spec.ts` — `LessonProgress` facade
- [ ] `src/app/features/play-surface/` — extraction, new `play-surface.spec.ts` (behavior-parity gate
      against existing `playground.spec.ts` assertions)
- [ ] `src/app/features/learn/lesson-detail/` — new component + spec + route entry in `app.routes.ts`
- [ ] Rewrite of `src/app/features/learn/learn.spec.ts` — currently tests the static placeholder
      (`upcomingLessons`); must be rewritten against `LESSONS`-driven rendering
- [ ] Framework install: none — Vitest/Angular CLI test runner already fully configured (Phase 1)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface in this app |
| V3 Session Management | No | No session/cookie surface |
| V4 Access Control | No | No access-control boundary — all lessons are open to every visitor |
| V5 Input Validation | Yes | `:lessonId` route param must be validated against a closed `LESSON_IDS` set (`isLessonId`) before any `LESSONS_BY_ID` lookup — same posture as `AlgorithmDetail`'s `isAlgorithmId` gate (`[VERIFIED: src/app/features/algorithms/algorithm-detail/algorithm-detail.ts:54-61]`, confirming the pattern: `computed<AlgorithmId \| null>(() => { const raw = this.rawId(); if (raw === null \|\| !STRICT_INTEGER_ID_PATTERN.test(raw)) { return null; } const parsed = Number(raw); return isAlgorithmId(parsed) ? parsed : null; })`). An unresolved lesson id must render an explicit not-found state, never throw or silently fall through. |
| V6 Cryptography | No | No cryptographic operation in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Untrusted `:lessonId` route segment used to index a lookup map or reflected into the DOM without validation | Tampering / Information Disclosure | `isLessonId` membership guard before lookup; the raw param is only ever interpolated as text (never `innerHTML`/an attribute/a URL) in a not-found message, mirroring `AlgorithmDetail`'s existing T-4-04-tested posture (`[VERIFIED: src/app/features/algorithms/algorithm-detail/algorithm-detail.ts:48-52]`: `"the raw, untrusted :id route param string — never bound into an attribute, a URL, or innerHTML; only ever interpolated as text in the not-found branch"`) |
| A malformed/hand-crafted `LessonDefinition.startingPatch` violating `OperatorParameters`/`InstrumentPatch` invariants (out-of-range `outputLevel`, non-coarse `ratio`, etc.) | Tampering | Route every `startingPatch` application through the *existing* validated `InstrumentState` commands (`setAlgorithm`/`updateOperator`/`setFeedback`), which already throw `RangeError` on invalid values (`[VERIFIED: src/app/domain/dx7/models/operator-parameters.ts:99-169]`) — never bypass those commands with a raw signal `.set()` |

## Sources

### Primary (HIGH confidence)
- `src/app/state/instrument-state.ts` (full file, read this session) — facade shape template
- `src/app/core/audio/synth-engine.ts` (full file, read this session) — engine boundary contract
- `src/app/features/playground/playground.ts` (full file, read this session) — note-lifecycle logic to extract
- `src/app/features/algorithms/algorithm-detail/algorithm-detail.ts` (full file, read this session) — route-param + composition template
- `src/app/domain/dx7/models/algorithm-definition.ts`, `operator-parameters.ts`, `patch.ts`, `operator.ts`, `derive-role.ts`, `algorithms.ts` (all read this session) — domain-layer conventions and Algorithm 1/32 ground truth
- `src/app/core/audio/web-audio-synth-engine.ts` (full file, read this session) — the sanctioned single `effect()` precedent
- `src/app/core/browser/motion-preference.ts` (full file, read this session) — private-signal/`.asReadonly()` pattern origin
- `eslint.config.js` (read this session) — domain-purity import restriction, scoped to `src/app/domain/**/*.ts`
- `docs/ARCHITECTURE.md` §"1. Pure DX7 learning domain," §"2. Application state," §"Audio roadmap" (read this session)
- `GSD_NEW_PROJECT_PROMPT.md` §"Application state," §"Guided Learn mode," §"Routes" (read this session)
- `docs/ROADMAP_SEED.md` §"Phase 6" (read this session)
- `docs/ACCEPTANCE_CRITERIA.md` (read this session)
- `.planning/phases/06-guided-lessons-for-algorithm-32-and-algorithm-1/06-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — requirement text and project history

### Secondary (MEDIUM confidence)
- None used — every claim in this research traces to a file read this session or to CONTEXT.md/
  REQUIREMENTS.md/STATE.md directly; no web search was performed because this phase introduces no new
  external technology (confirmed via `package.json` review — no new dependency is warranted).

### Tertiary (LOW confidence)
- Concrete `targetOperator`/`targetParam`/`direction` choices for each lesson (Code Examples section) —
  reasoned from the dataset's edges but not locked by CONTEXT.md; tagged `[ASSUMED]` and logged in
  Assumptions Log A3.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every pattern cross-checked against an in-repo file read this session
- Architecture: HIGH — all four composition points (domain model, facade, diagram reuse, play-surface extraction) have a direct in-repo precedent file read and quoted this session
- Pitfalls: HIGH — each pitfall traces to a specific CLAUDE.md rule or an in-repo comment documenting the exact failure mode it prevents

**Research date:** 2026-08-10
**Valid until:** No expiry pressure — this research depends on this repo's own code, not an external API;
re-validate only if `InstrumentState`, `SynthEngine`, or the `algorithms.ts` dataset shape changes before
Phase 6 is planned/executed.
