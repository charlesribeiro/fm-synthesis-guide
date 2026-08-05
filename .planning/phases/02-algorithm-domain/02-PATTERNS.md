# Phase 2: Algorithm domain - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 10 (5 implementation + 5 spec)
**Analogs found:** 10 / 10 (all via the two Phase 1 model files)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/domain/dx7/models/modulation-edge.ts` | model | transform | `src/app/domain/dx7/models/operator.ts` | exact |
| `src/app/domain/dx7/models/modulation-edge.spec.ts` | test | transform | `src/app/domain/dx7/models/operator.spec.ts` | exact |
| `src/app/domain/dx7/models/algorithm-definition.ts` | model | transform | `src/app/domain/dx7/models/algorithm.ts` | exact |
| `src/app/domain/dx7/models/algorithms.ts` | model (dataset) | batch | `src/app/domain/dx7/models/operator.ts` (`OPERATOR_IDS` const-array pattern) | role-match |
| `src/app/domain/dx7/models/algorithms.spec.ts` | test | batch | `src/app/domain/dx7/models/operator.spec.ts` + `algorithm.spec.ts` | role-match |
| `src/app/domain/dx7/models/derive-role.ts` | utility (pure fn) | transform | `src/app/domain/dx7/models/algorithm.ts` (`isAlgorithmId` guard-as-pure-fn pattern) | role-match |
| `src/app/domain/dx7/models/derive-role.spec.ts` | test | transform | `src/app/domain/dx7/models/algorithm.spec.ts` | exact |
| `src/app/domain/dx7/models/validate-algorithm.ts` | utility (validation guard) | request-response (boundary guard) | `src/app/domain/dx7/models/algorithm.ts` (`isAlgorithmId`) | role-match |
| `src/app/domain/dx7/models/validate-algorithm.spec.ts` | test | request-response | `src/app/domain/dx7/models/algorithm.spec.ts` | exact |

No files outside `src/app/domain/dx7/models/` are covered by this pattern map. Separately, Plan
02-02 implemented the DOMAIN-04 domain-purity gate in `eslint.config.js` (machine-enforced
`@typescript-eslint/no-restricted-imports` for `src/app/domain/**/*.ts`); `angular.json` is not
part of that gate.

## Pattern Assignments

### `src/app/domain/dx7/models/modulation-edge.ts` (model, transform)

**Analog:** `src/app/domain/dx7/models/operator.ts` (full file, 19 lines — reproduced above)

**Doc-comment pattern** (lines 1-11 of operator.ts):
```typescript
/**
 * The DX7 architecture has exactly six operators per algorithm, always
 * numbered 1–6. Restricting the type (rather than using `number`) lets the
 * compiler catch out-of-range operator references at the call site instead
 * of at runtime.
 *
 * The canonical 32-algorithm dataset and its graph validation are built in
 * Phase 2 (`docs/ROADMAP_SEED.md`); ...
 */
export type OperatorId = 1 | 2 | 3 | 4 | 5 | 6;
```
Lead with a short rationale comment explaining *why* the shape was chosen, referencing the phase/decision that motivated it (mirror this for `ModulationEdge`, citing D-01 self-loop-as-feedback).

**Core type + guard pattern** (lines 12-18):
```typescript
export const OPERATOR_IDS: readonly OperatorId[] = [1, 2, 3, 4, 5, 6];

export function isOperatorId(value: number): value is OperatorId {
  return OPERATOR_IDS.includes(value as OperatorId);
}
```
Apply the same "type + type guard co-located, guard named `is<Type>`" shape:
```typescript
import type { OperatorId } from './operator';

export interface ModulationEdge {
  readonly from: OperatorId;
  readonly to: OperatorId;
}

export function isModulationEdge(value: unknown): value is ModulationEdge {
  // structural check against OperatorId via isOperatorId, per RESEARCH.md Pattern 1
}
```
Import convention: relative sibling import (`from './operator'`), `import type` for type-only imports — matches project's strict-TS-friendly style seen throughout Phase 1 files.

---

### `src/app/domain/dx7/models/modulation-edge.spec.ts` (test, transform)

**Analog:** `src/app/domain/dx7/models/operator.spec.ts` (full file, 19 lines)

```typescript
import { OPERATOR_IDS, isOperatorId } from './operator';

describe('isOperatorId', () => {
  it('accepts every valid operator id 1 through 6', () => {
    for (const id of OPERATOR_IDS) {
      expect(isOperatorId(id)).toBe(true);
    }
  });

  it('rejects ids outside the six-operator range', () => {
    expect(isOperatorId(0)).toBe(false);
    expect(isOperatorId(7)).toBe(false);
    expect(isOperatorId(-1)).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(isOperatorId(1.5)).toBe(false);
  });
});
```
Pattern: no test-file imports of a test framework (global `describe`/`it`/`expect` — Vitest globals are configured project-wide, confirmed by absence of `import { describe, it, expect } from 'vitest'` in this file). One `describe` block per guard/function under test, small `it` blocks per boundary case (valid range, out-of-range, malformed/non-integer input). Apply this exact shape to `isModulationEdge` tests: valid edge, self-loop edge (feedback case), edge with out-of-range operator id.

Note: RESEARCH.md's own code examples (`algorithms.spec.ts` sample) import `describe`/`expect`/`it` from `'vitest'` explicitly — follow the **existing codebase convention (global, no import)** shown in `operator.spec.ts`/`algorithm.spec.ts` over RESEARCH.md's illustrative snippet, since the codebase pattern is the authoritative one per this agent's mandate.

---

### `src/app/domain/dx7/models/algorithm-definition.ts` (model, transform)

**Analog:** `src/app/domain/dx7/models/algorithm.ts` (full file, 17 lines)

```typescript
/**
 * A DX7 algorithm id, 1–32. Left as `number` (rather than a literal union
 * like `OperatorId`) because 32 members adds no compile-time safety over a
 * runtime boundary check — validate with {@link isAlgorithmId} wherever an
 * id crosses an external boundary (route params, imported patches, etc.).
 *
 * The canonical dataset of all 32 algorithms is built in Phase 2.
 */
export type AlgorithmId = number;

export const MIN_ALGORITHM_ID = 1;
export const MAX_ALGORITHM_ID = 32;

export function isAlgorithmId(value: number): value is AlgorithmId {
  return Number.isInteger(value) && value >= MIN_ALGORITHM_ID && value <= MAX_ALGORITHM_ID;
}
```

Reuse `AlgorithmId` and `isAlgorithmId` as-is (import, don't redefine — CONTEXT.md "Reusable Assets"). Build `AlgorithmDefinition` alongside as a new interface in a new file, following the same doc-comment-explains-the-shape-choice convention:

```typescript
import type { AlgorithmId } from './algorithm';
import type { ModulationEdge } from './modulation-edge';

export type TeachingTag = 'additive-stacks' | 'tree-branch' | 'rooting' | 'parallel';

/**
 * No stored `carriers` field — per D-05, carrier/modulator role is always
 * derived from `edges` (see derive-role.ts), never cached here, to avoid
 * duplicated routing knowledge that can drift from the edge list.
 */
export interface AlgorithmDefinition {
  readonly id: AlgorithmId;
  readonly name: string;
  readonly edges: readonly ModulationEdge[];
  readonly teachingTags: readonly TeachingTag[]; // D-10 — group tag(s), structural only
}
```
Explicitly avoid the `readonly carriers: readonly OperatorId[]` field from `GSD_NEW_PROJECT_PROMPT.md:115` (Pitfall 3 in RESEARCH.md) — do not copy that sketch verbatim.

---

### `src/app/domain/dx7/models/algorithms.ts` (model/dataset, batch)

**Analog (const-array-of-canonical-values shape):** `src/app/domain/dx7/models/operator.ts` lines 14 (`OPERATOR_IDS`)

```typescript
export const OPERATOR_IDS: readonly OperatorId[] = [1, 2, 3, 4, 5, 6];
```

Apply the same "one `readonly` exported const array, typed against the sibling interface" shape at dataset scale:
```typescript
import type { AlgorithmDefinition } from './algorithm-definition';

function edges(list: AlgorithmDefinition['edges']): AlgorithmDefinition['edges'] {
  return Object.freeze(list.map((edge) => Object.freeze({ ...edge })));
}

export const ALGORITHMS: readonly AlgorithmDefinition[] = Object.freeze([
  Object.freeze({
    id: 1,
    name: 'Stack + Tower',
    edges: edges([
      { from: 6, to: 5 }, { from: 5, to: 4 }, { from: 4, to: 3 },
      { from: 2, to: 1 }, { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: ['additive-stacks'],
  }),
  // ... 31 more rows, transcribed from RESEARCH.md § Routing Reference Table
]);
```
Source the 32 rows directly from RESEARCH.md's "Routing Reference Table" (already 1-indexed per Pitfall 2 — copy from that table, not from any external source, per D-08/D-09). Apply `Object.freeze()` at every level: the top-level `ALGORITHMS` array, every algorithm entry, each entry's `edges` array, **and every individual edge object** — this is mandatory, not discretionary. `Object.freeze` is shallow, so freezing an array of edge objects does not freeze the objects it holds references to; a downstream consumer can otherwise mutate `algorithm.edges[0].from` in place while the array itself stays immutable. (Confirmed the hard way: this exact gap shipped past Task 1 in Plan 02-01 and was only caught by phase-level code review as CR-01 — see `02-REVIEW.md`.) TypeScript `readonly` typing alone is compile-time only and does not stop this at runtime.

---

### `src/app/domain/dx7/models/algorithms.spec.ts` (test, batch)

**Analog:** `src/app/domain/dx7/models/operator.spec.ts` + `algorithm.spec.ts` (boundary-value `describe`/`it` shape)

Structure per RESEARCH.md's own worked example (§ Code Examples, "it.each/describe.each invariant suite") — this is a phase-specific pattern with no direct Phase-1 precedent (Phase 1 has no multi-row dataset), but it extends the established `describe('<subject>', () => { it('<boundary case>', () => {...}) })` shape from `operator.spec.ts`/`algorithm.spec.ts` to a `describe.each(ALGORITHMS)` loop:
```typescript
describe.each(ALGORITHMS)('Algorithm $id ($name)', (algorithm) => {
  it('passes structural validation', () => {
    expect(() => validateAlgorithm(algorithm)).not.toThrow();
  });
  it('has at least one carrier', () => {
    expect(deriveCarriers(algorithm).length).toBeGreaterThan(0);
  });
});

it('has exactly 32 algorithms with unique ids', () => {
  const ids = ALGORITHMS.map((a) => a.id);
  expect(ids).toHaveLength(32);
  expect(new Set(ids).size).toBe(32);
});
```
Match codebase convention: omit the `import { describe, expect, it } from 'vitest'` line (globals, per operator.spec.ts/algorithm.spec.ts), unlike RESEARCH.md's illustrative snippet which includes it.

---

### `src/app/domain/dx7/models/derive-role.ts` (utility/pure fn, transform)

**Analog:** `src/app/domain/dx7/models/algorithm.ts` (`isAlgorithmId`, lines 14-16) — closest existing example of a small pure exported function operating on a domain type.

```typescript
export function isAlgorithmId(value: number): value is AlgorithmId {
  return Number.isInteger(value) && value >= MIN_ALGORITHM_ID && value <= MAX_ALGORITHM_ID;
}
```
Same "single-expression-body pure function, explicit param/return types, no side effects" shape. RESEARCH.md's own worked example (§ Pattern 2, lines 244-260) is the concrete target implementation — reproduced here as the load-bearing excerpt to copy from directly:
```typescript
import { OPERATOR_IDS, type OperatorId } from '../operator';
import type { AlgorithmDefinition } from './algorithm-definition';

export type OperatorRole = 'carrier' | 'modulator';

export function getOperatorRole(
  algorithm: AlgorithmDefinition,
  operatorId: OperatorId,
): OperatorRole {
  const modulatesAnotherOperator = algorithm.edges.some(
    (edge) => edge.from === operatorId && edge.to !== operatorId, // self-loop excluded — D-05
  );
  return modulatesAnotherOperator ? 'modulator' : 'carrier';
}

export function deriveCarriers(algorithm: AlgorithmDefinition): readonly OperatorId[] {
  return OPERATOR_IDS.filter((id) => getOperatorRole(algorithm, id) === 'carrier');
}

export function hasFeedbackLoop(algorithm: AlgorithmDefinition, operatorId: OperatorId): boolean {
  return algorithm.edges.some((edge) => edge.from === operatorId && edge.to === operatorId);
}
```
Note the RESEARCH.md example's import path `'../operator'` is illustrative for a hypothetical subfolder — since `derive-role.ts` lives flat in `models/` alongside `operator.ts`, use `'./operator'` (sibling), matching `algorithm-definition.ts`'s own import of `operator.ts`.

**Critical pitfall to avoid** (RESEARCH.md Pitfall 1): never write `edges.some(e => e.from === operatorId)` alone — must exclude `e.to === operatorId` or every feedback-carrying carrier (e.g. Algorithm 32 operator 6) misclassifies as modulator.

---

### `src/app/domain/dx7/models/derive-role.spec.ts` (test, transform)

**Analog:** `src/app/domain/dx7/models/algorithm.spec.ts` (full file, 17 lines — boundary-value test shape)

```typescript
import { isAlgorithmId, MAX_ALGORITHM_ID, MIN_ALGORITHM_ID } from './algorithm';

describe('isAlgorithmId', () => {
  it('accepts the boundary values 1 and 32', () => {
    expect(isAlgorithmId(MIN_ALGORITHM_ID)).toBe(true);
    expect(isAlgorithmId(MAX_ALGORITHM_ID)).toBe(true);
  });
  it('rejects ids outside 1..32', () => {
    expect(isAlgorithmId(0)).toBe(false);
    expect(isAlgorithmId(33)).toBe(false);
  });
  it('rejects non-integer values', () => {
    expect(isAlgorithmId(4.2)).toBe(false);
  });
});
```
Apply per RESEARCH.md's Fixture Algorithm Recommendations: one `describe` per function (`getOperatorRole`, `deriveCarriers`, `hasFeedbackLoop`), `it` blocks using named small fixtures per CLAUDE.md testing rules ("Keep fixtures small and named by pedagogical intent") — e.g. `describe('getOperatorRole')` with cases for Algorithm 32 (carrier-with-feedback), Algorithm 1 (modulator-with-feedback, per Pitfall 1's warning), and a plain carrier/modulator pair.

---

### `src/app/domain/dx7/models/validate-algorithm.ts` (utility/validation guard, request-response boundary)

**Analog:** `src/app/domain/dx7/models/algorithm.ts` (`isAlgorithmId` guard pattern) — closest existing validation-style function, though it's a type predicate rather than a throwing guard. No throwing-guard analog exists yet in the codebase; RESEARCH.md's own worked skeleton (§ Code Examples) is the concrete target and should be copied near-verbatim:

```typescript
import { isOperatorId } from './operator';
import type { AlgorithmDefinition } from './algorithm-definition';

export class InvalidAlgorithmError extends Error {}

export function validateAlgorithm(algorithm: AlgorithmDefinition): void {
  const feedbackEdges = algorithm.edges.filter((e) => e.from === e.to);

  // D-04: reject more than one feedback self-loop.
  if (feedbackEdges.length > 1) {
    throw new InvalidAlgorithmError(
      `Algorithm ${algorithm.id}: expected at most one feedback self-loop, found ${feedbackEdges.length}`,
    );
  }

  // D-04: reject a feedback edge referencing a nonexistent operator id.
  for (const edge of algorithm.edges) {
    if (!isOperatorId(edge.from) || !isOperatorId(edge.to)) {
      throw new InvalidAlgorithmError(
        `Algorithm ${algorithm.id}: edge references an operator id outside 1..6`,
      );
    }
  }

  // DOMAIN-02: reject a DAG violation among non-feedback edges (higher-modulates-lower rule).
  for (const edge of algorithm.edges) {
    if (edge.from !== edge.to && edge.from <= edge.to) {
      throw new InvalidAlgorithmError(
        `Algorithm ${algorithm.id}: edge ${edge.from}->${edge.to} violates the higher-modulates-lower rule`,
      );
    }
  }
}
```
Import convention: reuse `isOperatorId` from the sibling `operator.ts` (do not reimplement operator-id range checking — RESEARCH.md's "Don't Hand-Roll" table explicitly calls this out).

**Error handling pattern:** throw a small custom `Error` subclass with a descriptive message including the algorithm id and offending edge — no existing codebase precedent for error classes yet (Phase 1 files have no error paths), so this establishes the first one; keep it minimal (message-only, no error codes/statuses since this is a pure-domain guard, not an HTTP boundary).

---

### `src/app/domain/dx7/models/validate-algorithm.spec.ts` (test, request-response)

**Analog:** `src/app/domain/dx7/models/algorithm.spec.ts` (boundary-value shape, adapted to throwing-guard assertions)

```typescript
describe('validateAlgorithm', () => {
  it('accepts a well-formed algorithm', () => {
    expect(() => validateAlgorithm(wellFormedFixture)).not.toThrow();
  });
  it('rejects more than one feedback self-loop', () => { /* D-04 */ });
  it('rejects an edge referencing a nonexistent operator id', () => { /* D-04 */ });
  it('rejects an edge violating the higher-modulates-lower rule', () => { /* DOMAIN-02 */ });
});
```
Use `expect(() => fn(...)).toThrow(InvalidAlgorithmError)` idiom (Vitest globals, no import, matching codebase convention). Author small malformed fixtures inline per case, named for the invariant they violate (CLAUDE.md fixture-naming rule).

## Shared Patterns

### File layout / one-concept-per-file with co-located type guard
**Source:** `src/app/domain/dx7/models/operator.ts`, `src/app/domain/dx7/models/algorithm.ts`
**Apply to:** All 5 new implementation files
Every domain file: (1) leading doc-comment explaining the type/rationale, (2) the type/interface, (3) any canonical const array, (4) a co-located type guard or validation function, (5) sibling `.spec.ts` with matching filename.

### Relative sibling imports, no path aliases
**Source:** All Phase 1 files use bare relative imports (`./operator`, `./algorithm`) — no `@app/` or barrel-file aliases observed.
**Apply to:** All new files — `modulation-edge.ts` imports `OperatorId` from `'./operator'`; `algorithm-definition.ts` imports from `'./algorithm'` and `'./modulation-edge'`; `algorithms.ts` imports from `'./algorithm-definition'`; `derive-role.ts` and `validate-algorithm.ts` import from `'./operator'` and `'./algorithm-definition'`.

### `import type` for type-only imports
**Source:** Implicit convention (strict TS project per CLAUDE.md); confirmed by RESEARCH.md's own worked examples consistently using `import type { AlgorithmDefinition } from './algorithm-definition';`.
**Apply to:** All new files — use `import type` for interfaces/type aliases, plain `import` only for runtime values (`OPERATOR_IDS`, `isOperatorId`, `ALGORITHMS`).

### Vitest globals, no explicit test-framework import
**Source:** `src/app/domain/dx7/models/operator.spec.ts`, `algorithm.spec.ts` — both use bare `describe`/`it`/`expect` with zero `import ... from 'vitest'` line.
**Apply to:** All 5 new `.spec.ts` files. This diverges from RESEARCH.md's own illustrative snippets (which do `import { describe, expect, it } from 'vitest'`) — codebase convention wins.

### Zero Angular imports (DOMAIN-04)
**Source:** Verified by inspection — no `@angular/*` import anywhere in `src/app/domain/dx7/models/`.
**Apply to:** All new files in this phase; RESEARCH.md flags this as currently enforced only by convention, not lint — planner may choose to add an ESLint `no-restricted-imports` rule for `src/app/domain/**` as a Wave 0 task, but that is a discretionary addition, not a pattern to copy from existing code (no analog exists).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/app/domain/dx7/models/algorithms.ts` (32-row static dataset) | model (dataset) | batch | No existing multi-row canonical dataset in the codebase yet — Phase 1 only has scalar/small-array constants (`OPERATOR_IDS`, 6 items). Structural shape (const-array pattern) is reused from `operator.ts`, but the *scale and per-row provenance* (32 rows sourced from RESEARCH.md's cross-checked routing table) has no precedent — treat RESEARCH.md's Routing Reference Table as the authoritative data source instead. |
| `src/app/domain/dx7/models/validate-algorithm.ts` (throwing guard + custom Error class) | utility | request-response | No existing throwing-guard or custom `Error` subclass anywhere in `src/app/domain/dx7/` — Phase 1's only guards (`isOperatorId`, `isAlgorithmId`) are boolean type predicates, not throwing validators. Use RESEARCH.md's `validateAlgorithm()`/`InvalidAlgorithmError` skeleton (§ Code Examples) as the concrete template since no codebase precedent exists. |

## Metadata

**Analog search scope:** `src/app/domain/dx7/models/` (only directory containing domain model files; confirmed via RESEARCH.md's Architecture Patterns diagram and CONTEXT.md's Reusable Assets list — no broader search needed since Phase 1 established this as the sole location for DX7 domain types)
**Files scanned:** 4 (`operator.ts`, `operator.spec.ts`, `algorithm.ts`, `algorithm.spec.ts`) — full contents, all ≤ 19 lines, single Read call each
**Pattern extraction date:** 2026-08-04
