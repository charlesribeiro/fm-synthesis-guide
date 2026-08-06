---
phase: 04-algorithm-browser-and-svg
reviewed: 2026-08-06T14:30:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/app/app.routes.ts
  - src/app/domain/dx7/diagram/algorithm-layout.spec.ts
  - src/app/domain/dx7/diagram/algorithm-layout.ts
  - src/app/domain/dx7/diagram/build-diagram-view-model.spec.ts
  - src/app/domain/dx7/diagram/build-diagram-view-model.ts
  - src/app/domain/dx7/diagram/describe-algorithm.spec.ts
  - src/app/domain/dx7/diagram/describe-algorithm.ts
  - src/app/features/algorithms/algorithm-detail/algorithm-detail.html
  - src/app/features/algorithms/algorithm-detail/algorithm-detail.scss
  - src/app/features/algorithms/algorithm-detail/algorithm-detail.spec.ts
  - src/app/features/algorithms/algorithm-detail/algorithm-detail.ts
  - src/app/features/algorithms/algorithm-diagram/algorithm-diagram.coverage.spec.ts
  - src/app/features/algorithms/algorithm-diagram/algorithm-diagram.html
  - src/app/features/algorithms/algorithm-diagram/algorithm-diagram.scss
  - src/app/features/algorithms/algorithm-diagram/algorithm-diagram.spec.ts
  - src/app/features/algorithms/algorithm-diagram/algorithm-diagram.ts
  - src/app/features/algorithms/algorithms.html
  - src/app/features/algorithms/algorithms.scss
  - src/app/features/algorithms/algorithms.spec.ts
  - src/app/features/algorithms/algorithms.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-08-06T14:30:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the algorithm-browser and SVG-diagram feature slice: the pure `algorithm-layout` / `build-diagram-view-model` / `describe-algorithm` domain modules, the `algorithms` (browse) and `algorithm-detail` (route) feature components, and the presentational `algorithm-diagram` component. `npm run build`, `npm test`, and `npm run lint` all pass (537/537 tests, no lint errors). Route-param handling is properly hardened against invalid `:id` values (`STRICT_INTEGER_ID_PATTERN` + `isAlgorithmId`, never throws, never indexes a collection with an unvalidated value). Carrier/modulator role is encoded by shape and `data-*` attributes, never by color alone, matching D-08. No `innerHTML`, no `eval`, no hardcoded secrets, no empty catch blocks.

The issues found are all robustness/defensive-coding gaps in otherwise-correct logic — none currently reproducible against the shipped 32-algorithm dataset (which is why the extensive invariant test suites here pass), but each is a latent correctness risk that a future data edit could trigger silently (no thrown error, no failing type check) rather than loudly.

## Warnings

### WR-01: `buildOutputBusPath` divides by an implicit non-empty-array assumption and degrades to `Infinity` in SVG path data if it is ever violated

**File:** `src/app/domain/dx7/diagram/build-diagram-view-model.ts:104-110` (called from line 163, fed by `carrierPositions` at line 154-155)
**Issue:** `buildOutputBusPath` computes `Math.min(...xs)` / `Math.max(...xs)` over `carrierPositions`, which is built directly from `deriveCarriers(algorithm)` with no guard. If `deriveCarriers` ever returns an empty array for some algorithm (e.g. a future dataset edit introduces a routing graph with no true carrier — a data-entry mistake, not something the type system prevents), `Math.min(...[])` is `Infinity` and `Math.max(...[])` is `-Infinity`. `round2(Infinity - 24)` is still `Infinity`, and the function then emits `d="M Infinity 280 L -Infinity 280"` — a value that is not a legal SVG path but produces no error, exception, or console warning; the `<path class="output-bus">` element simply fails to render (or renders unpredictably) with no diagnostic pointing at the cause. Nothing in `buildDiagramViewModel` fails fast on this precondition.
**Fix:**
```ts
function buildOutputBusPath(carrierPositions: readonly OperatorPosition[]): string {
  if (carrierPositions.length === 0) {
    throw new Error('buildOutputBusPath requires at least one carrier position');
  }
  const xs = carrierPositions.map((position) => position.x);
  const leftX = round2(Math.min(...xs) - 24);
  const rightX = round2(Math.max(...xs) + 24);
  const busY = round2(OUTPUT_BUS_Y);
  return `M ${leftX} ${busY} L ${rightX} ${busY}`;
}
```
Failing loudly here turns a silent rendering corruption into an immediate, attributable error the next time the dataset changes.

### WR-02: `buildGroups()` silently renders `"Algorithms undefined–undefined"` if a teaching-tag group is ever empty

**File:** `src/app/features/algorithms/algorithms.ts:66-73`
**Issue:** `firstId = rows[0]?.id` and `lastId = rows[rows.length - 1]?.id` are optional-chained against `rows`, which is filtered from `ALGORITHMS` by `teachingTags`. If a future edit to `ALGORITHMS` (or `TEACHING_TAGS`) ever leaves a tag with zero matching rows, `firstId`/`lastId` become `undefined`, and the template renders `range: "Algorithms undefined–undefined"` directly into the page (`algorithms.html:10`) with no error, no test failure outside this exact page's copy, and no compiler warning (`tsconfig.json` does not set `noUncheckedIndexedAccess`, so `rows[0]` is typed as `AlgorithmDefinition` rather than `AlgorithmDefinition | undefined`, masking the risk at the type level too).
**Fix:**
```ts
const firstId = rows[0]?.id;
const lastId = rows.at(-1)?.id;
if (firstId === undefined || lastId === undefined) {
  throw new Error(`Teaching tag "${tag}" has no matching algorithms`);
}
```
or equivalently assert non-empty before destructuring, so a future empty group fails the build/test suite instead of shipping broken copy.

### WR-03: Diagram edge `id` is derived from `from-to` alone, so a duplicate edge pair in the dataset would silently collide with Angular's `@for` track key

**File:** `src/app/domain/dx7/diagram/build-diagram-view-model.ts:146`
**Issue:** `id: \`${edge.from}-${edge.to}\`` assumes every `(from, to)` pair in `algorithm.edges` is unique within an algorithm. That assumption currently holds and is exercised by an accompanying dataset-wide test (`algorithm-layout.spec.ts:280-294`), but the uniqueness guarantee lives entirely in a test that iterates the current 32-row dataset — nothing in `build-diagram-view-model.ts` itself defends against a duplicate edge being added later (e.g. a copy-paste error in `models/algorithms.ts`, which is out of this phase's scope but is exactly the kind of data-entry mistake the module's own comments cite as a prior real incident — the "Algorithm 26/27 correction"). A duplicate `id` reaching `algorithm-diagram.html:28` (`@for (edge of viewModel().edges; track edge.id)`) causes Angular to reuse/misplace the DOM node for the colliding edges, a rendering bug that would not throw and would be easy to miss visually.
**Fix:** Make the id collision-proof at the source instead of relying only on an external data invariant test:
```ts
const edges: DiagramEdge[] = algorithm.edges.map((edge, index) => {
  ...
  return {
    id: `${index}-${edge.from}-${edge.to}`,
    ...
  };
});
```

## Info

### IN-01: Leading-zero route segments (e.g. `/algorithms/007`) resolve to the same algorithm as the canonical path

**File:** `src/app/features/algorithms/algorithm-detail/algorithm-detail.ts:20,56`
**Issue:** `STRICT_INTEGER_ID_PATTERN = /^\d+$/` accepts any run of ASCII digits, including strings with leading zeros (`"007"`, `"01"`), which `Number()` then normalizes to `7`, `1`, etc. This is intentional and safe (no crash, no dataset-index issue), but it means `/algorithms/7` and `/algorithms/007` both render Algorithm 7 as two distinct, non-redirecting URLs for the same content — a minor canonicalization gap the not-found matrix test suite doesn't cover (it tests `'0'`, `'33'`, `'-1'`, etc., but not a zero-padded in-range id).
**Fix:** If canonical single-URL-per-algorithm matters here, reject leading zeros explicitly: `/^(0|[1-9]\d*)$/` and treat `"07"` the same as `"abc"` (not-found). Otherwise, no action needed — flagging for awareness only.

### IN-02: `onNodeKeydown` calls `preventDefault()` only for Space, not Enter

**File:** `src/app/features/algorithms/algorithm-diagram/algorithm-diagram.ts:68-75`
**Issue:** The keydown handler special-cases `' '`/`'Spacebar'` with `event.preventDefault()` (to stop page scroll) but not `'Enter'`. On the SVG `<g role="button">` element this is harmless in current browsers (Enter has no default scroll/submit action on a non-form, non-anchor element), but it's an inconsistency relative to native `<button>` keyboard-activation handling, where both keys are typically normalized the same way. Low risk, purely a consistency nit.
**Fix:** For consistency/documentation clarity, call `event.preventDefault()` unconditionally once either key is matched, or add a short comment noting why Enter needs no `preventDefault()` on this element.

---

_Reviewed: 2026-08-06T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
