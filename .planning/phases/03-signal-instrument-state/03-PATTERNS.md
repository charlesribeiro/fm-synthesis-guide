# Phase 3: Signal instrument state - Pattern Map

**Mapped:** 2026-08-05
**Files analyzed:** 5 (new) + 1 (implied test)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/app/domain/dx7/models/operator-parameters.ts` (new) | model | transform | `src/app/domain/dx7/models/algorithm-definition.ts` | exact (domain interface + doc-comment style) |
| `src/app/core/instrument/instrument-state.ts` (new, exact path Claude's discretion) | store/service | CRUD (in-memory, immutable) | `src/app/core/browser/motion-preference.ts` | role-match (only existing signal facade) |
| `src/app/core/instrument/instrument-state.spec.ts` (new) | test | request-response (sync signal reads) | `src/app/core/browser/motion-preference.spec.ts` | exact (only existing service-with-signal spec) |
| default patch constant (co-located in `operator-parameters.ts` or `instrument-state.ts`) | config | transform | `src/app/domain/dx7/models/algorithm-definition.ts` (`TEACHING_TAGS` frozen-array pattern) | role-match |
| domain model unit test for `operator-parameters.ts` | test | transform | `src/app/domain/dx7/models/algorithm-definition.spec.ts` | exact |

## Pattern Assignments

### `src/app/domain/dx7/models/operator-parameters.ts` (model, transform)

**Analog:** `src/app/domain/dx7/models/algorithm-definition.ts`, `src/app/domain/dx7/models/operator.ts`

**Doc-comment + interface pattern** (algorithm-definition.ts lines 30-52):
```typescript
/**
 * A single DX7-style algorithm: an id, a display name, and its full set of
 * modulation edges (including any feedback self-loop, per D-01).
 *
 * Deliberately excludes two fields a naive sketch might include:
 * - No stored operator-role/`carriers` field (D-05, D-07) — role is always
 *   derived from `edges` on demand by `derive-role.ts`, never cached here...
 */
export interface AlgorithmDefinition {
  readonly id: AlgorithmId;
  readonly name: string;
  readonly edges: readonly ModulationEdge[];
  readonly teachingTags: readonly TeachingTag[];
  readonly reviewStatus?: AlgorithmReviewStatus;
}
```
Apply this shape for `OperatorParameters`: every field `readonly`, a doc comment stating what's deliberately excluded (e.g. no stored role — that's still `getOperatorRole`'s job) and citing the CONTEXT.md decision IDs (D-06, D-07, D-10) that justify each field's presence/shape.

**Restricted-literal-type pattern** (`operator.ts` lines 1-18):
```typescript
export type OperatorId = 1 | 2 | 3 | 4 | 5 | 6;
export const OPERATOR_IDS: readonly OperatorId[] = [1, 2, 3, 4, 5, 6];
export function isOperatorId(value: number): value is OperatorId {
  return OPERATOR_IDS.includes(value as OperatorId);
}
```
Mirror for `OperatorParameters['mode']` (`'ratio' | 'fixed'`, D-06) — a plain union is enough, no runtime array needed since there are only two literals, but keep the "restrict the type, don't use `string`/`number`" instinct for `outputLevel`/`detune`/`envelopeLevel`: document the valid integer range in a comment (D-10) even though TypeScript can't enforce numeric ranges — follow `algorithm.ts`'s `isAlgorithmId` boundary-validation convention (lines 11-16) if a runtime validator is needed at a boundary.

**Frozen-array default pattern** (`algorithm-definition.ts` lines 12-17, from `TEACHING_TAGS`):
```typescript
export const TEACHING_TAGS: readonly TeachingTag[] = Object.freeze([
  'additive-stacks',
  'tree-branch',
  'rooting',
  'parallel',
]);
```
Use this exact `Object.freeze([...])` shape for the default patch constant (`DEFAULT_OPERATOR_PARAMETERS` / `DEFAULT_PATCH`), per D-11's literal values, so nothing downstream can mutate the shared default object in place.

---

### `src/app/core/instrument/instrument-state.ts` (store/service, CRUD in-memory)

**Analog:** `src/app/core/browser/motion-preference.ts` (the only existing signal-based facade in the codebase)

**Imports pattern** (motion-preference.ts lines 1-1):
```typescript
import { DestroyRef, Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';
```
For instrument-state, drop `DestroyRef`/`InjectionToken` (no external browser source to unsubscribe from — commands set state directly per CONTEXT.md's discretion note) and add domain imports:
```typescript
import { Injectable, Signal, computed, signal } from '@angular/core';
import { ALGORITHMS } from '../../domain/dx7/models/algorithms';
import type { AlgorithmDefinition } from '../../domain/dx7/models/algorithm-definition';
import { getOperatorRole, deriveCarriers, getFeedbackOperator } from '../../domain/dx7/models/derive-role';
import { OPERATOR_IDS, type OperatorId } from '../../domain/dx7/models/operator';
import { DEFAULT_OPERATOR_PARAMETERS, type OperatorParameters } from '../../domain/dx7/models/operator-parameters';
```

**Private-writable / public-readonly signal pattern** (motion-preference.ts lines 51-59):
```typescript
@Injectable({ providedIn: 'root' })
export class MotionPreference {
  private readonly _prefersReducedMotion = signal(this.matchMedia(REDUCED_MOTION_QUERY).matches);

  /** Read-only: true when the user has requested reduced motion. */
  readonly prefersReducedMotion: Signal<boolean> = this._prefersReducedMotion.asReadonly();
```
Apply the same private-`_field` + `.asReadonly()` public-`Signal` pairing for each of: selected algorithm id, the six operators' parameters (likely one signal holding a `ReadonlyMap<OperatorId, OperatorParameters>` or a readonly tuple/record keyed 1-6, per D-06), and feedback level. Derive "role of operator X" and "carriers" as `computed()` selectors that call `getOperatorRole`/`deriveCarriers` against the currently-selected `AlgorithmDefinition` — never store role, per Phase 2 D-05/D-07 (echoed in this phase's canonical_refs).

**Constructor-as-single-imperative-source pattern** (motion-preference.ts lines 61-71) does NOT apply directly — CONTEXT.md's discretion note flags this explicitly: "commands can just `.set()`/`.update()` the private signal directly," no `effect`/listener needed since there's no external system to sync from. Command methods (`setAlgorithm`, `updateOperator`, `setFeedback`, `captureSnapshot('a'|'b')`, `recallSnapshot('a'|'b')`, `reset`) are the imperative surface instead — model each as a plain method body doing an immutable `.update(state => ({ ...state, ... }))`, never a direct mutation of the previous object (ROADMAP SC: "immutable updates never mutate prior snapshots").

**Command-method shape to mirror** (from `SynthEngine` interface, `synth-engine.ts` lines 32-43 — a strong signal for command naming, not a class to copy code from):
```typescript
export interface SynthEngine {
  setAlgorithm(algorithmId: AlgorithmId): void;
  updateOperatorLevel(operatorId: OperatorId, level: number): void;
  setFeedback(level: number): void;
  ...
}
```
Name the facade's commands consistently with these so Phase 5's `SynthEngine` implementation can wire 1:1 to facade command calls later (e.g. facade's `setAlgorithm(algorithmId)` / `setFeedback(level)` match verbatim; `updateOperator(operatorId, patch: Partial<OperatorParameters>)` generalizes `updateOperatorLevel`).

---

### `src/app/core/instrument/instrument-state.spec.ts` (test)

**Analog:** `src/app/core/browser/motion-preference.spec.ts`

**TestBed setup + signal-read assertions** (lines 30-46):
```typescript
describe('MotionPreference', () => {
  function setup(initialMatches: boolean) {
    ...
    TestBed.configureTestingModule({ providers: [...] });
    return { service: TestBed.inject(MotionPreference), ... };
  }

  it('reflects the initial OS preference', () => {
    const { service } = setup(true);
    expect(service.prefersReducedMotion()).toBe(true);
  });
```
For instrument-state, there is no DI token/fake to inject (no external system) — `TestBed.inject(InstrumentState)` with no custom providers is likely sufficient. Structure specs around: (1) default-patch selectors read D-11's exact values on fresh injection, (2) command methods produce a new object each call (assert prior read-out reference !== new read-out reference — "immutable updates never mutate prior snapshots"), (3) algorithm switch carries over operator params and feedback unchanged (D-01/D-02), (4) capture/recall A and B round-trip exactly (D-03), (5) reset always restores the D-11 default regardless of A/B contents (D-04), (6) role/carrier selectors delegate to `getOperatorRole`/`deriveCarriers` rather than reimplementing them (spy or cross-check against `derive-role.ts` directly).

**Regression-test-with-decision-ID-comment pattern** (`algorithm-definition.spec.ts` lines 3-8, 19-23):
```typescript
/**
 * Regression test for WR-03: TEACHING_TAGS is the authoritative whitelist...
 */
```
Follow this convention: every test block whose existence is driven by a specific CONTEXT.md decision (D-01 through D-11) should carry a one-line comment citing the decision ID, so a future reader can trace test intent back to the locked decision.

---

## Shared Patterns

### Signal-based facade skeleton
**Source:** `src/app/core/browser/motion-preference.ts` (whole file, 72 lines — the only precedent in the repo)
**Apply to:** `instrument-state.ts`
- `@Injectable({ providedIn: 'root' })` class.
- Private `WritableSignal` fields prefixed `_`, each paired with a public `readonly ... : Signal<T> = this._field.asReadonly()`.
- Every mutation goes through `.set()`/`.update()` on the private field only — nothing outside the class ever calls `.set` on a public signal (public ones are read-only by type).
- Derived facts (`role of operator`, `carriers`, `feedback-carrying operator`) are `computed()` signals or plain getter methods delegating to `derive-role.ts`, never separately-stored state (this generalizes Phase 2's D-05/D-07 "never cache derived facts" rule into Phase 3).

### Domain-model doc-comment discipline
**Source:** `src/app/domain/dx7/models/algorithm-definition.ts` (lines 4-45), `derive-role.ts` (lines 4-22)
**Apply to:** `operator-parameters.ts`, default-patch constant
- Every exported type/const gets a doc comment explaining *why* the shape is what it is, citing decision IDs (D-06, D-07, D-10, D-11) and explicitly naming what was deliberately excluded or deferred (e.g., "no full 4-rate/4-level envelope yet — Phase 9/ENGINE-03's job, D-07").

### Frozen literal collections
**Source:** `src/app/domain/dx7/models/algorithm-definition.ts` lines 12-17 (`TEACHING_TAGS`)
**Apply to:** `DEFAULT_OPERATOR_PARAMETERS` / default patch constant
- Wrap any exported constant object/array intended as an immutable shared default in `Object.freeze(...)`, verified by a regression test mirroring `algorithm-definition.spec.ts` lines 9-17 (attempt a mutation, assert it throws or is a no-op).

### Restricted numeric/union types over bare `number`/`string`
**Source:** `src/app/domain/dx7/models/operator.ts` lines 12-18, `algorithm.ts` lines 9-16
**Apply to:** `OperatorParameters['mode']`, and boundary validators if any external data ever populates `OperatorParameters` (not needed for this in-memory-only phase per D-05, but keep the pattern in mind for Phase 12/PERSIST-01)

## No Analog Found

None — every new file for this phase has a reasonably close existing analog (the codebase is small; `motion-preference.ts` and the domain `models/` directory cover all needed precedent).

## Metadata

**Analog search scope:** `src/app/core/`, `src/app/domain/dx7/models/`
**Files scanned:** operator.ts, algorithm.ts, algorithm-definition.ts, algorithms.ts, derive-role.ts, modulation-edge.ts, validate-algorithm.ts, motion-preference.ts, motion-preference.spec.ts, algorithm-definition.spec.ts, synth-engine.ts
**Pattern extraction date:** 2026-08-05
