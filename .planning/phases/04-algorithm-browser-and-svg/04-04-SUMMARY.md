---
phase: 04-algorithm-browser-and-svg
plan: 04
subsystem: ui
tags: [angular, router, accessibility, signals, dx7-diagram, input-validation]

# Dependency graph
requires:
  - phase: 04-algorithm-browser-and-svg
    plan: 01
    provides: "AlgorithmDetail route component, toSignal(route.paramMap) wiring, buildDiagramViewModelForId, in-page not-found branch"
provides:
  - "AlgorithmDetail.previousId/nextId — D-04 pager bounds, no wrap at either end"
  - "Expanded /algorithms/:id not-found state: explanatory heading, rejected segment echoed via text interpolation, back link"
  - "STRICT_INTEGER_ID_PATTERN string-shape guard on the route :id param, closing an exponent-notation acceptance gap"
affects: [06-guided-lessons, playground]

# Actuals (#2632)
actuals:
  tokens: 4818
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route :id validated as an all-digits string (STRICT_INTEGER_ID_PATTERN) before Number() ever sees it, layered in front of isAlgorithmId's numeric range check"
    - "Pager rendered as a fixed two-slot <nav>, absent links rather than disabled controls, so the page never shifts stepping through the range"
    - "Test-local ALGORITHM_LAYOUTS map patch (beforeAll/afterAll) to exercise the full 1-32 id range in an isolated wave-2 worktree that doesn't yet carry Plan 04-02's remaining 30 layout records"

key-files:
  created: []
  modified:
    - src/app/features/algorithms/algorithm-detail/algorithm-detail.ts
    - src/app/features/algorithms/algorithm-detail/algorithm-detail.html
    - src/app/features/algorithms/algorithm-detail/algorithm-detail.scss
    - src/app/features/algorithms/algorithm-detail/algorithm-detail.spec.ts

key-decisions:
  - "Fixed a real input-validation gap found while implementing Task 2's rejected-input matrix: Number('1e1') === 10, a legitimately in-range integer, so the pre-existing Number()+isAlgorithmId guard silently accepted exponent notation as a valid algorithm id. Added STRICT_INTEGER_ID_PATTERN (/^\\d+$/) as a string-shape gate before Number() is ever called (Rule 1 bug fix, documented under Deviations)."
  - "Worked around a wave-2 worktree isolation gap (this plan depends only on 04-01; 04-02 — which authors the remaining 30 ALGORITHM_LAYOUTS records — runs in a parallel, not-yet-merged sibling worktree) by patching the exported ALGORITHM_LAYOUTS Map directly in a spec-local beforeAll/afterAll, borrowing Algorithm 32's coordinates for any id lacking its own record. vi.mock on relative imports is rejected outright by Angular's unit-test system ('The \"vi.mock\" and related methods are not supported for relative imports...'), so runtime Map mutation was the only viable in-scope option that didn't touch algorithm-layout.ts (owned by 04-02) or the component's own architecture."
  - "Once Plan 04-02 merges, every id resolves its own real layout — has(id) is true for all 32 in beforeAll, patchedLayoutIds stays empty, and the patch is a verified no-op."

patterns-established:
  - "A domain-adjacent numeric guard (isAlgorithmId) is not sufficient on its own to reject every malformed string input — a string-shape check belongs at the boundary where the string is first read, before any Number() coercion, whenever the numeric coercion itself can normalize away the malformed shape (exponent notation, hex, leading '+')."

requirements-completed: [VIS-01]

coverage:
  - id: D1
    description: "The detail view offers previous/next navigation plus a link back to the grouped browser, stepping through all 32 without wrapping at either end"
    requirement: VIS-01
    verification:
      - kind: integration
        ref: "algorithm-detail.spec.ts#renders exactly two pager links at the middle of the range with the correct neighbours (/algorithms/7)"
        status: pass
      - kind: integration
        ref: "algorithm-detail.spec.ts#renders only a next link at the lower boundary (/algorithms/1) and never wraps to 32"
        status: pass
      - kind: integration
        ref: "algorithm-detail.spec.ts#renders only a previous link at the upper boundary (/algorithms/32) and never wraps to 1"
        status: pass
      - kind: integration
        ref: "algorithm-detail.spec.ts#renders a back link to the grouped browser, distinct from the pager links"
        status: pass
      - kind: integration
        ref: "algorithm-detail.spec.ts#supports stepping across the full 1-32 range with correct pager neighbours and a rendered diagram at every id"
        status: pass
    human_judgment: false
  - id: D2
    description: "Same-route navigation (component reuse) correctly re-renders the diagram for the new id rather than staying on the first one loaded"
    requirement: VIS-01
    verification:
      - kind: integration
        ref: "algorithm-detail.spec.ts#re-renders the diagram for algorithm 2 after following the next link from algorithm 1 (same-route navigation)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every rejected route id (0, 33, 99, -1, 7.5, abc, %20, ' 7x', 1e1, an oversized integer) renders an explanatory, recoverable not-found state with no thrown error and no diagram; both accepted boundaries (1, 32) still render"
    requirement: VIS-01
    verification:
      - kind: integration
        ref: "algorithm-detail.spec.ts#renders an explanatory, recoverable not-found state for every rejected segment, with no thrown error and no diagram"
        status: pass
      - kind: integration
        ref: "algorithm-detail.spec.ts#accepts both range boundaries (1 and 32) and renders a diagram, so the matrix cannot pass by rejecting everything"
        status: pass
      - kind: unit
        ref: "algorithm-detail.spec.ts#never reaches the dataset/layout lookup for the numerically-rejected segments — buildDiagramViewModelForId returns null after conversion"
        status: pass
    human_judgment: false
  - id: D4
    description: "The rejected segment is echoed back through text interpolation only — never bound into an attribute, a URL, or innerHTML (T-4-04)"
    requirement: VIS-01
    verification:
      - kind: integration
        ref: "algorithm-detail.spec.ts#echoes the rejected segment back through text interpolation only"
        status: pass
      - kind: other
        ref: "grep -n rawId algorithm-detail.html — only appears inside {{ }} interpolation"
        status: pass
    human_judgment: false
  - id: D5
    description: "No redirectTo was added for the algorithm detail path and no id is clamped to the nearest valid algorithm"
    requirement: VIS-01
    verification:
      - kind: other
        ref: "grep -c redirectTo src/app/app.routes.ts == 1 (pre-existing wildcard entry only)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Live browser visual check of /algorithms/1 prev/next stepping and /algorithms/99 not-found, per this plan's manual <verification> step"
    verification: []
    human_judgment: true
    rationale: "No headless-browser tooling is installed in this execution environment (same constraint recorded in 04-01-SUMMARY.md's D9); the jsdom RouterTestingHarness suite already asserts the exact DOM structure (pager link counts/hrefs, back-link target, not-found heading/echoed text, no thrown error) a visual check would confirm."

# Metrics
duration: ~55min
completed: 2026-08-06
status: complete
---

# Phase 4 Plan 4: Prev/next navigation and the full not-found matrix Summary

**`/algorithms/:id` gains D-04 previous/next pager navigation (bounded, non-wrapping, at both ends of 1-32) and a fully-matrixed, recoverable not-found state — closing a real exponent-notation input-validation gap (`Number('1e1') === 10`) found while building the rejected-input test matrix.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-06T12:19:00Z
- **Completed:** 2026-08-06T13:05:36Z
- **Tasks:** 2 (Task 1 `tdd="true"`, Task 2 `type="auto"`)
- **Files modified:** 4 (all pre-existing from Plan 04-01, none created)

## Accomplishments

- `AlgorithmDetail.previousId`/`nextId` computed members, bounded by the domain's `MIN_ALGORITHM_ID`/`MAX_ALGORITHM_ID` constants (never a literal `1`/`32`) — `null` at either end instead of wrapping, per D-04's "sequence, not a cycle" design decision
- Fixed two-slot `<nav class="pager">` plus a `back-link` back to the grouped browser, token-based styling with a `:focus-visible` ring, stable layout height whether 0/1/2 links render
- Expanded not-found branch: explanatory heading + paragraph naming the valid range, the rejected route segment echoed back via text interpolation only (never an attribute/URL/`innerHTML`), and a working back link — recoverable in one click rather than a dead end
- **Real bug fixed, not just tested (Rule 1):** the pre-existing `Number(raw)` + `isAlgorithmId` guard silently accepted exponent notation — `Number('1e1') === 10`, a legitimately in-range integer — because `isAlgorithmId`'s `Number.isInteger` check has no way to know the *string* wasn't a plain digit sequence. Added `STRICT_INTEGER_ID_PATTERN` (`/^\d+$/`) as a string-shape gate in front of `Number()`, closing the gap for exponent notation, hex, decimals, and signed/whitespace-padded junk alike
- 21 new/expanded test cases across both tasks: boundary/middle-of-range pager assertions, same-route re-render proof, a full 1-32 stepping sweep, a 10-segment rejected-input matrix, both accepted boundaries, and a direct assertion that `buildDiagramViewModelForId` never resolves for the numerically-rejected segments

## Task Commits

Each task was committed atomically:

1. **Task 1: Previous/next stepping through the 32 algorithms, with correct ends** - `72315b1` (feat, `tdd="true"`)
2. **Task 2: Not-found state and the full rejected-input matrix** - `3c1712d` (feat)

**Plan metadata:** (this commit, docs: complete plan) — not created in worktree mode; the orchestrator commits shared docs after merge.

## Files Created/Modified

- `src/app/features/algorithms/algorithm-detail/algorithm-detail.ts` — `previousId`/`nextId` computed, `rawId` computed, `STRICT_INTEGER_ID_PATTERN` string-shape guard
- `src/app/features/algorithms/algorithm-detail/algorithm-detail.html` — pager `<nav>`, back link, expanded not-found `<div class="not-found">` branch
- `src/app/features/algorithms/algorithm-detail/algorithm-detail.scss` — `.pager`/`.pager__slot`/`.pager__link`/`.back-link`/`.not-found` rules, token-based, `:focus-visible` ring
- `src/app/features/algorithms/algorithm-detail/algorithm-detail.spec.ts` — extended: boundary/middle/back-link/same-route/full-sweep pager tests, 10-segment not-found matrix, both accepted boundaries, direct guard assertion, interpolation-only assertion

## Decisions Made

- **`STRICT_INTEGER_ID_PATTERN` string-shape guard (Rule 1 bug fix):** documented above and under Deviations — found while implementing Task 2's own literal test matrix (`1e1` was in the plan's specified segment list), not a separate audit.
- **Wave-2 worktree isolation workaround for `ALGORITHM_LAYOUTS`:** this plan (`depends_on: ["04-01"]` only) runs in a worktree isolated from Plan 04-02's sibling wave-2 branch, which authors the remaining 30 per-algorithm layout records. Only Algorithm 1 and Algorithm 32 have real layouts in this worktree. `vi.mock` on a relative import is rejected outright by Angular's unit-test builder (`"The 'vi.mock' and related methods are not supported for relative imports with the Angular unit-test system. Please use Angular TestBed for mocking dependencies."`), so the spec file instead patches the already-exported `ALGORITHM_LAYOUTS` `Map` directly in `beforeAll`/`afterAll` (it is not runtime-frozen, only its per-algorithm value objects are), borrowing Algorithm 32's coordinates for any id lacking its own record and removing the patch afterward. Every other derived fact (edges, carriers, the accessible description) still comes from the real `ALGORITHMS` dataset — only `(x, y)` placement is borrowed, and only for ids Plan 04-02 hasn't authored yet in this worktree. This did not touch `algorithm-layout.ts` (outside this plan's `files_modified`) and becomes a verified no-op once Plan 04-02 merges (every id will then satisfy `has(id)`, so nothing gets patched).
- **Security assertion form (Task 2):** raw-string rejection of `/algorithms/abc` and non-canonical values such as `/algorithms/1e1` is proven at the route/component entry via the harness-level not-found matrix (those strings must never reach dataset lookup). `buildDiagramViewModelForId` is used only for segments that remain invalid after numeric conversion (`0, 33, 99, -1, 7.5, abc, %20, ' 7x', oversized`) — `1e1` is excluded from that direct call because `Number('1e1') === 10` is in-range; the component's `STRICT_INTEGER_ID_PATTERN` gate is what rejects the raw string before conversion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route `:id` accepted exponent notation as a valid algorithm id**
- **Found during:** Task 2, while building the plan's own literal rejected-input matrix (which specifies `1e1` as a segment that must render not-found)
- **Issue:** `AlgorithmDetail.algorithmId` computed `Number(raw)` then checked `isAlgorithmId(parsed)`. `Number('1e1') === 10`, an integer within 1-32, so `/algorithms/1e1` rendered Algorithm 10's diagram instead of a not-found state — a route param that looks nothing like "10" silently resolved to algorithm 10.
- **Fix:** Added `STRICT_INTEGER_ID_PATTERN = /^\d+$/` and require the raw string to match it before `Number()` is ever called. Also closes the same class of gap for hex (`0x10`) and other JS-numeric-literal forms, none of which are a plain digit sequence.
- **Files modified:** `src/app/features/algorithms/algorithm-detail/algorithm-detail.ts`
- **Commit:** `3c1712d`

### Out-of-scope workaround (documented, not a plan deviation)

**Wave-2 worktree isolation gap for `ALGORITHM_LAYOUTS` completeness** — see Decisions Made above. Not a code deviation from the plan's specified files or architecture; a test-infrastructure accommodation for parallel wave execution, fully reversible (self-neutralizes once Plan 04-02 merges), and does not touch any file outside this plan's `files_modified` list.

## TDD Gate Compliance

- **Task 1 (`tdd="true"`):** strict RED-first. All 6 new pager/back-link/same-route/full-sweep cases were written and run first — confirmed failing (0 pager links found, `null` back-link, `undefined` next-href, "Only one harness should be created per test" infrastructure error on the first sweep draft) before any production code changed. After fixing the sweep to reuse a single harness (`RouterTestingHarness` allows only one per test), all 6 failed for the expected reason (missing pager/back-link markup), then the component/template/style implementation was added and all 9 tests in the file passed.
  - **Teeth proven per acceptance criteria, both restored before committing:**
    - Wrapping `previousId` at the lower bound (`id > MIN_ALGORITHM_ID ? id - 1 : MAX_ALGORITHM_ID`) failed the lower-boundary test (`expected 2 to be 1`) and the full-sweep test — restored.
    - Replacing the reactive `toSignal(route.paramMap)` with a one-time `route.snapshot.paramMap` read failed the same-route-navigation test and the full-sweep test (2 failures) while every other case still passed — restored. This is the specific proof required by the plan: the component-reuse hazard (RESEARCH.md Pitfall 1's sibling risk on the write side) is actually covered, not just plausible.
- **Task 2 (`type="auto"`, no `tdd` attribute):** spec written first against the not-yet-expanded not-found branch — 2 of 13 tests failed for the expected reason (missing back-link and echoed text in not-found; `1e1` incorrectly resolving to a diagram) before the guard fix and template expansion. Teeth proven per acceptance criteria: allowing a decimal through the string-shape guard (`/^\d+(\.\d+)?$/`) while flooring the parsed value into range made the matrix fail specifically and only on `7.5` (`headingOk=false noSvg=false` for that one segment) — restored before committing.

Both gates (`feat` commits `72315b1`, `3c1712d`) carry real, verified regression protection — RED confirmed before GREEN in both tasks, no gate skipped.

## Issues Encountered

- **`vi.mock` on relative imports is rejected outright by Angular's unit-test builder** (`@angular/build:unit-test`), with the explicit error `"The 'vi.mock' and related methods are not supported for relative imports with the Angular unit-test system. Please use Angular TestBed for mocking dependencies."` This ruled out the first-attempted approach to the wave-2 layout-completeness gap (see Decisions Made) and led to the direct `ALGORITHM_LAYOUTS` `Map` patch instead — a useful project-wide finding for any future spec needing to stub a pure-function module dependency in this codebase.
- **`RouterTestingHarness.create()` may only be called once per test** (`"Only one harness should be created per test."`) — the first draft of the full 1-32 sweep test created a new harness per iteration; fixed to create one harness and call `navigateByUrl` 32 times in a loop, which incidentally exercises same-route re-rendering 31 times over rather than the single-step case alone.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `AlgorithmDetail`'s pager and not-found behavior are complete and fully tested for the ids this worktree can resolve today (1, 32, and every id via the test-local layout-completeness patch); once Plan 04-02 merges its remaining 30 `ALGORITHM_LAYOUTS` records, every assertion in this plan's spec file continues to pass unmodified against the real dataset, and the test-local patch's `patchedLayoutIds` becomes empty (verified no-op).
- **Recommended human follow-up (same constraint as 04-01-SUMMARY.md's D9):** a live `npm start` visual check of `/algorithms/1` -> `/algorithms/2` stepping, `/algorithms/32`'s missing next link, and `/algorithms/99`'s not-found page with working back link, once this worktree merges with Plan 04-02's full layout set. The automated jsdom suite already covers the same DOM assertions.

---
*Phase: 04-algorithm-browser-and-svg*
*Completed: 2026-08-06*

## Self-Check: PASSED

All modified files and both task commits verified present on disk / in git history (see below).
