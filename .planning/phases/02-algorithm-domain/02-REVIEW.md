---
phase: 02-algorithm-domain
reviewed: 2026-08-05T00:57:55Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - eslint.config.js
  - src/app/domain/dx7/models/algorithm-definition.ts
  - src/app/domain/dx7/models/algorithms.spec.ts
  - src/app/domain/dx7/models/algorithms.ts
  - src/app/domain/dx7/models/derive-role.spec.ts
  - src/app/domain/dx7/models/derive-role.ts
  - src/app/domain/dx7/models/modulation-edge.spec.ts
  - src/app/domain/dx7/models/modulation-edge.ts
  - src/app/domain/dx7/models/validate-algorithm.spec.ts
  - src/app/domain/dx7/models/validate-algorithm.ts
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-05T00:57:55Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the pure-TypeScript DX7 algorithm domain layer: the `AlgorithmDefinition`/`ModulationEdge`
types, the 32-row `ALGORITHMS` dataset, `derive-role.ts`'s carrier/modulator/feedback derivation,
`validate-algorithm.ts`'s structural guards, and the new `eslint.config.js` domain-purity gate.

`npm run build`, `npx ng test --watch=false` (358/358 passing), and `npx ng lint` all pass clean.
I independently re-derived carriers/feedback operators for every one of the 32 rows against the
dataset's own `EXPECTED_CARRIERS`/`EXPECTED_FEEDBACK_OP` cross-check tables in `algorithms.spec.ts`
and found no discrepancy — the higher-modulates-lower / self-loop-exclusion logic in
`getOperatorRole` is correct, and I found no copied Yamaha/Dexed text. I also live-tested the new
`no-restricted-imports` ESLint rule against both a direct `@angular/core` import and a deep subpath
(`@angular/core/testing`) import placed under `src/app/domain/`; both are correctly rejected.

Despite the dataset itself being sound, I found one BLOCKER: the dataset's own module-load freeze
is shallow and does **not** actually satisfy the invariant the code comments and CLAUDE.md claim
("frozen... so a downstream phase cannot mutate the single source of truth in place") — individual
`ModulationEdge` objects inside a frozen `edges` array are still mutable at runtime. I also found
three WARNING-level issues: dead/unreachable code in `validateAlgorithmSet`, a robustness gap in
`validateAlgorithm` relative to its own documented future use as an external-boundary guard, and an
un-frozen `TEACHING_TAGS` whitelist that directly feeds a validation check.

## Critical Issues

### CR-01: `ALGORITHMS`' module-load freeze is shallow — individual edge objects remain mutable, contradicting the documented T-02-01 invariant

**File:** `src/app/domain/dx7/models/algorithms.ts:51-52, 59-61`

**Issue:** The head comment states as a hard guarantee:

> Each entry and its `edges` array is frozen at module load (T-02-01) so a downstream phase cannot
> mutate the single source of truth in place.

and CLAUDE.md's domain rules require "Use immutable readonly models." The implementation only
achieves this partially. `edges()` does `Object.freeze(list)`, and each algorithm row is wrapped in
`Object.freeze({...})`. `Object.freeze` is shallow: it prevents adding/removing array elements and
reassigning object members, but it does **not** freeze the individual `{ from, to }` objects that
the array holds references to. Those edge objects are ordinary mutable object literals.

Proof (reproduced against the exact freezing pattern used in this file):

```js
function edges(list) { return Object.freeze(list); }
const algo = Object.freeze({ id: 1, name: 'test', edges: edges([{ from: 6, to: 5 }]) });

algo.edges[0].from = 99;
console.log(algo.edges[0]); // { from: 99, to: 5 } — mutation succeeded
```

This means any downstream code — including the Phase 4 SVG renderer and Phase 5 audio engine that
`derive-role.spec.ts`'s own comments explicitly name as consumers relying on this dataset staying
stable — can silently corrupt the canonical routing data for the remaining lifetime of the module
(a singleton; the corruption persists across every future read of `ALGORITHMS`, not just the call
site that caused it), by writing through a `readonly`-typed reference cast the same way this file's
own tests already demonstrate is possible for the top-level array (`algorithms.spec.ts:250-266`
casts around `readonly` to test `push`/reassignment — proving the pattern of a downstream consumer
bypassing the type system is anticipated, yet the individual-edge-object vector was left
unprotected and untested).

**Fix:** Freeze each edge object before freezing the array that holds it:

```ts
function edges(list: readonly ModulationEdge[]): readonly ModulationEdge[] {
  return Object.freeze(list.map((edge) => Object.freeze({ ...edge })));
}
```

Add a regression test alongside the existing structural-invariants suite in `algorithms.spec.ts`
(next to the `push` and full-array-reassignment tests) asserting that mutating
`algorithm1.edges[0].from` also throws in strict mode / leaves the value unchanged.

## Warnings

### WR-01: `validateAlgorithmSet`'s `unexpectedIds` branch is dead code, and the test that appears to cover it exercises a different code path

**File:** `src/app/domain/dx7/models/validate-algorithm.ts:122-157`

**Issue:** `validateAlgorithmSet` first runs `validateAlgorithm(algorithm)` over every entry
(lines 123-125), which throws `InvalidAlgorithmError` for any entry whose `id` fails
`isAlgorithmId` (i.e. is not an integer in `MIN_ALGORITHM_ID..MAX_ALGORITHM_ID`). Only after that
loop completes without throwing does the function build `seenIds` (line 129) and later compute:

```ts
const unexpectedIds = [...seenIds].filter((id) => id < MIN_ALGORITHM_ID || id > MAX_ALGORITHM_ID);
```

By the time this line runs, every `id` in `seenIds` has already been proven to satisfy
`MIN_ALGORITHM_ID <= id <= MAX_ALGORITHM_ID` by the per-item `validateAlgorithm` call above (which
would have thrown otherwise, aborting the function before this line is ever reached). `unexpectedIds`
can therefore never be non-empty — it is unreachable dead code, and the `unexpectedPart` string
built from it (lines 149-151) can never appear in a thrown message.

This also means the existing test titled "rejects a set holding an extra id outside 1..32"
(`validate-algorithm.spec.ts:193-199`) does not actually exercise the `unexpectedIds` branch it
appears to target: `wellFormedAlgorithm(33)` fails the very first `validateAlgorithm` call in the
loop (id 33 is out of range), so the test passes for the "wrong" reason — a regression that broke
only the dead `unexpectedIds` logic would not be caught by any test in this suite.

**Fix:** Either remove the dead `unexpectedIds` computation and the corresponding message segment
(since it can never fire, given `validateAlgorithm` already rejects any out-of-range id per entry),
or, if defense-in-depth against a future refactor that might call the id-set logic before
per-item validation is desired, add a comment explaining that intent and add a unit test that
actually reaches it (e.g. by directly unit-testing a hypothetical extracted "check id coverage"
helper with a constructed `Set` containing an out-of-range id, bypassing `validateAlgorithm`
entirely).

### WR-02: `validateAlgorithm` throws raw `TypeError`s instead of `InvalidAlgorithmError` for malformed top-level shapes, despite being documented for future external-boundary use

**File:** `src/app/domain/dx7/models/validate-algorithm.ts:19-24, 35-113`

**Issue:** The function's doc comment states it is:

> Exported as a reusable runtime guard, not a test-only helper, so a future boundary (e.g. Phase
> 12's patch-import surface) can apply the same rules to externally supplied data (CLAUDE.md
> "validate external data at boundaries").

This documents intent for `validateAlgorithm` to eventually run against untrusted, externally
supplied data — not just the trusted, TypeScript-shaped `ALGORITHMS` rows it is exercised against
today. However, the function assumes the top-level shape is already correct: it never checks that
`algorithm` itself is non-null, or that `algorithm.teachingTags`, `algorithm.edges`, and
`algorithm.name` are actually an array/array/string before calling `.length` (line 44),
`.trim()` (line 56), or iterating with `for...of` (line 62 / line 47). Externally supplied JSON
with a missing or wrong-typed field (e.g. `{ id: 1, name: 'x' }` with no `edges` key at all, which
is exactly the shape untrusted patch-import data could plausibly take) throws an unstructured
`TypeError: algorithm.edges is not iterable` rather than the documented `InvalidAlgorithmError`,
breaking the single-error-type contract the rest of the module (and any caller catching
`InvalidAlgorithmError` specifically) relies on.

**Fix:** Add defensive top-level shape checks before the existing rules, e.g.:

```ts
if (algorithm == null || typeof algorithm !== 'object') {
  throw new InvalidAlgorithmError('Algorithm: value is not an object');
}
if (!Array.isArray(algorithm.teachingTags)) {
  throw new InvalidAlgorithmError(`Algorithm ${algorithm.id}: teachingTags must be an array`);
}
if (!Array.isArray(algorithm.edges)) {
  throw new InvalidAlgorithmError(`Algorithm ${algorithm.id}: edges must be an array`);
}
if (typeof algorithm.name !== 'string') {
  throw new InvalidAlgorithmError(`Algorithm ${algorithm.id}: name must be a string`);
}
```

If the intent is instead that `validateAlgorithm` only ever runs on data that has already passed a
separate JSON-schema/shape check at the actual external boundary (making this a pure
already-well-shaped structural guard), narrow the doc comment to say so explicitly and drop the
"future boundary... externally supplied data" framing, so the contract matches the implementation.

### WR-03: `TEACHING_TAGS` (the validation whitelist) is not frozen, unlike every other array in the same module

**File:** `src/app/domain/dx7/models/algorithm-definition.ts:12-17`

**Issue:** `TEACHING_TAGS` is declared as a plain array literal with a `readonly` compile-time type
but no runtime `Object.freeze`:

```ts
export const TEACHING_TAGS: readonly TeachingTag[] = [
  'additive-stacks',
  'tree-branch',
  'rooting',
  'parallel',
];
```

This is inconsistent with `algorithms.ts`, where the equivalent per-row tag arrays
(`additiveStacksTags`, `treeBranchTags`, `rootingTags`, `parallelTags`) are all explicitly wrapped
in `Object.freeze(...)`. `TEACHING_TAGS` is not just inert data — `validate-algorithm.ts:48` uses
it as the authoritative whitelist (`TEACHING_TAGS.includes(tag)`) for every algorithm's
`teachingTags` values. Any code path that mutates it at runtime (via a `readonly`-bypassing cast,
the same pattern this codebase's own tests use elsewhere to probe immutability) silently changes
what the validator considers a legal tag for every algorithm, for the remaining lifetime of the
module.

**Fix:**

```ts
export const TEACHING_TAGS: readonly TeachingTag[] = Object.freeze([
  'additive-stacks',
  'tree-branch',
  'rooting',
  'parallel',
]);
```

---

_Reviewed: 2026-08-05T00:57:55Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
