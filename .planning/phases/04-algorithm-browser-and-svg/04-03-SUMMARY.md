---
phase: 04-algorithm-browser-and-svg
plan: 03
subsystem: ui
tags: [angular, router, accessibility, dx7-algorithms, browse-view]

# Dependency graph
requires:
  - phase: 04-algorithm-browser-and-svg (Plan 01)
    provides: "/algorithms/:id route, AlgorithmDetail component, buildDiagramViewModelForId — the detail route this plan links into"
provides:
  - "Algorithms component rewritten as a real 32-item browse view, grouped by teachingTags read from ALGORITHMS (no hardcoded id ranges)"
  - "Every browse item routerLink-ed into /algorithms/:id, proven end-to-end through the real router"
affects: [04-05, 06-guided-lessons, playground]

# Actuals (#2632)
actuals:
  tokens: 3810
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level view-model builder (buildGroups()) computed once from ALGORITHMS + TEACHING_TAGS, frozen, exposed as a protected readonly field — same discipline as the ALGORITHMS dataset itself"
    - "RouterTestingHarness two-step navigation (browse route -> read rendered anchor href -> navigate to that href) as the pattern for proving in-app navigation distinct from a cold deep link"

key-files:
  created: []
  modified:
    - src/app/features/algorithms/algorithms.ts
    - src/app/features/algorithms/algorithms.html
    - src/app/features/algorithms/algorithms.scss
    - src/app/features/algorithms/algorithms.spec.ts

key-decisions:
  - "Group membership and the range label are both derived from ALGORITHMS.teachingTags at module load (buildGroups()); only the four human-facing name/description strings live in the component (GROUP_COPY), keyed by TeachingTag — a dataset change can never leave a stale id range in the component"
  - "Card body uses the full AlgorithmDefinition.name sentence, no truncation/ellipsis/line-clamp — CSS uses overflow-wrap: break-word and no fixed height (D-03, RESEARCH Pitfall 3)"
  - "Review flag rendered as a bordered text badge (.algorithm-card__flag, 'Routing under review'), not a color-only signal, reusing the existing --color-warning token already used by algorithm-detail's review-note"
  - "Deviation: the plan named Algorithm 7 for the round-trip navigation test, but Algorithm 7's layout record belongs to sibling wave-2 Plan 02, executing in a separate worktree not yet merged into this one — substituted Algorithm 1 (guaranteed present from Plan 01's tracer), which also cleanly pairs with Plan 01's existing cold-deep-link assertion on the same id via a different navigation path. Logged to .planning/WINDOWS.md (kind: deviation) for ship-gate visibility."

patterns-established:
  - "buildGroups()/GROUP_COPY split: membership derived from data, presentation copy kept in the component — the template for any future view that groups the same dataset by a different data-carried tag"

requirements-completed: [VIS-01]

coverage:
  - id: D1
    description: "/algorithms renders all 32 algorithms as individual browsable items in the four teaching-taxonomy groups, each linking to its own detail route; the Phase 1 placeholder notice is gone"
    requirement: VIS-01
    verification:
      - kind: unit
        ref: "src/app/features/algorithms/algorithms.spec.ts#renders exactly 32 algorithm cards, numbered 1 through 32 in DOM order"
        status: pass
      - kind: unit
        ref: "src/app/features/algorithms/algorithms.spec.ts#removes the Phase 1 placeholder notice"
        status: pass
    human_judgment: false
  - id: D2
    description: "Group membership is read from each row's teachingTags, never a hardcoded id range; groups render in TEACHING_TAGS order with ascending id within each group"
    requirement: VIS-01
    verification:
      - kind: unit
        ref: "src/app/features/algorithms/algorithms.spec.ts#groups algorithms exactly by their dataset teachingTags, not by a hardcoded id range"
        status: pass
      - kind: other
        ref: "grep -Ec '1.6|7.18|19.25|26.32' src/app/features/algorithms/algorithms.ts == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each card shows the algorithm number as heading and the full dataset name as wrapping body text; no mini SVG thumbnail is rendered in the browse view"
    requirement: VIS-01
    verification:
      - kind: unit
        ref: "src/app/features/algorithms/algorithms.spec.ts#renders algorithm 1's full dataset name as card body text"
        status: pass
    human_judgment: false
  - id: D4
    description: "A row flagged reviewStatus 'unresolved' shows a visible, non-color-only review marker; rows without the flag show none"
    requirement: VIS-01
    verification:
      - kind: unit
        ref: "src/app/features/algorithms/algorithms.spec.ts#shows a review marker only on the browse item whose dataset row is flagged unresolved"
        status: pass
    human_judgment: false
  - id: D5
    description: "Activating a rendered browse-item link, through the real router, lands on that algorithm's detail route with its diagram rendered — the in-app navigation counterpart to Plan 01's cold deep link"
    requirement: VIS-01
    verification:
      - kind: integration
        ref: "src/app/features/algorithms/algorithms.spec.ts#follows the rendered Algorithm 1 link from /algorithms into its detail route, in-app (the counterpart to Plan 01s cold deep link on the same id)"
        status: pass
      - kind: integration
        ref: "src/app/features/algorithms/algorithms.spec.ts#follows the rendered Algorithm 32 link from /algorithms into its detail route and reaches the pure-additive end of the dataset"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live browser visual check of /algorithms — four groups, tab order, focus ring, keyboard activation"
    verification: []
    human_judgment: true
    rationale: "No headless-browser tooling installed in this execution environment (same constraint noted in Plan 01's SUMMARY, coverage D9); jsdom-based tests already assert the exact DOM structure a visual check would confirm (32 cards, group membership, href targets, review marker, focus-visible CSS rule present in algorithms.scss)."

# Metrics
duration: ~28min
completed: 2026-08-06
status: complete
---

# Phase 4 Plan 3: Grouped 32-item algorithm browser Summary

**`/algorithms` now renders all 32 DX7 algorithms as data-derived browse cards in four teaching-taxonomy groups, each linking into the `/algorithms/:id` detail route proven end-to-end through the real router.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-08-06T09:16:00-03:00
- **Completed:** 2026-08-06T09:44:28-03:00
- **Tasks:** 2 (1 `tdd="true"`, 1 `type="auto"`)
- **Files modified:** 4

## Accomplishments

- Replaced the Phase 1 placeholder (`role="status"` "not built yet" notice) with a real 32-item browse view built entirely from `ALGORITHMS` and `TEACHING_TAGS` — no algorithm id or id range is written anywhere in `algorithms.ts`
- Group membership, ascending-id ordering within each group, and the range label (`Algorithms {first}–{last}`) are all derived from the dataset at module load (`buildGroups()`); only the four human-facing name/description strings are component-side copy
- Each of the 32 items shows `Algorithm {id}` as heading and the full dataset `name` sentence as wrapping body text (no truncation), routerLink-ed to `/algorithms/:id`; the one row flagged `reviewStatus: 'unresolved'` (Algorithm 19) shows a bordered, non-color-only "Routing under review" badge
- Proved the actual learner path — open the browse list, click an algorithm, see its diagram — through `RouterTestingHarness` reading the rendered anchor's `href` rather than a hand-written URL, for both a general case (Algorithm 1, pairing with Plan 01's existing cold-deep-link test on the same id) and the additive-end edge case (Algorithm 32: six operator nodes, zero modulation edges)

## Task Commits

Each task was committed atomically:

1. **Task 1: Grouped 32-item browse view derived from teachingTags** (`tdd="true"`) - `ce4240b` (test, RED) then `0a6bca1` (feat, GREEN)
2. **Task 2: Prove the in-app round trip from the browse list into a detail route** - `be93686` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/app/features/algorithms/algorithms.ts` — `BrowseAlgorithm`/reshaped `AlgorithmGroup` interfaces, `GROUP_COPY` presentation record, `buildGroups()` view-model builder, `RouterLink` + `OnPush`
- `src/app/features/algorithms/algorithms.html` — placeholder removed; nested `@for` renders one `<a class="algorithm-card">` per algorithm with number, name, and conditional review flag
- `src/app/features/algorithms/algorithms.scss` — `.status` rule removed; `.algorithm-list`/`.algorithm-card`/`.algorithm-card__*` rules added, token-based, with `:hover`/`:focus-visible`
- `src/app/features/algorithms/algorithms.spec.ts` — extended with coverage, grouping, link-target, placeholder-removal, name-text, review-flag, and two-case router round-trip assertions (9 new `it` blocks total)

## Decisions Made

- Group membership and range labels computed from `ALGORITHMS`/`TEACHING_TAGS`, never hardcoded — see `key-decisions` in frontmatter
- Full-sentence card body text, no line-clamp — CSS deliberately allows wrapping across multiple lines
- Review flag styled as a bordered text badge reusing `--color-warning`, matching the existing `algorithm-detail` review-note treatment rather than inventing a new visual language
- Substituted Algorithm 1 for the plan's named Algorithm 7 in the round-trip test (see Deviations below)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Substituted Algorithm 1 for Algorithm 7 in the browse-to-detail round-trip test**
- **Found during:** Task 2 (in-app round trip test)
- **Issue:** The plan's `<action>` named Algorithm 7 as the first round-trip target. Algorithm 7's layout record (`ALGORITHM_LAYOUTS`) is authored by sibling wave-2 Plan 02, which executes in a separate, not-yet-merged worktree. In this worktree, `ALGORITHM_LAYOUTS` only contains Algorithm 1 and Algorithm 32 (from Plan 01's tracer). Navigating to `/algorithms/7` here correctly renders the in-component not-found state ("Algorithm not found") rather than a diagram — confirmed by reading `getAlgorithmLayout`'s `null`-on-absence behavior, not a bug in this plan's own code.
- **Fix:** Substituted Algorithm 1 as the first case's target. This is not a downgrade of the assertion's intent: Algorithm 1 is guaranteed present in every wave-2 worktree (authored by Plan 01, the wave-1 dependency all wave-2 plans share), and reusing the same id Plan 01's cold-deep-link test already covers makes the "in-app navigation counterpart" framing the plan itself calls for even more literal — same target algorithm, two different router code paths (cold URL vs. rendered-anchor click).
- **Files modified:** `src/app/features/algorithms/algorithms.spec.ts`
- **Verification:** `npm test` passes (508/508); confirmed regression teeth by temporarily binding `routerLink` to a constant id (`999`) — both new navigation cases (and the existing link-target test) failed as expected, then restored and re-verified green.
- **Committed in:** `be93686` (Task 2 commit)
- **Logged to ledger:** `.planning/WINDOWS.md` (kind: `deviation`) for ship-gate visibility, since the substitution narrows the test's coverage of a mid-dataset (non-edge-case) algorithm until Plan 02 merges.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The substitution preserves the assertion's full intent (in-app round trip through the real router, read from a rendered anchor, not a hand-written URL) using data guaranteed present in this wave. Once Plan 02 merges, a future maintainer could optionally re-target Algorithm 7 for closer literal alignment with the original plan text — not required, since the current pairing (Algorithm 1) is arguably the stronger test given its direct relationship to Plan 01's existing coverage.

## Issues Encountered

- None beyond the deviation above — first test run against the still-placeholder component produced the expected RED (4 of 7 new assertions failed: coverage, placeholder-removal, name-text, review-flag; the grouping and link-target assertions passed vacuously against zero rendered cards, which is expected TDD noise, not a gap — the four meaningful failures were the RED signal).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `/algorithms` is now a complete, data-driven browse view; VIS-01's "browse all 32 algorithms" half is satisfied alongside Plan 01's existing detail-view half.
- Plan 05 (wave 3, depends on 04-02/03/04) can build on this browse view once Plan 02's remaining 30 layout records and Plan 04's prev/next navigation land in the same branch.
- **Recommended human follow-up:** a live `npm start` visual check of `/algorithms` — four groups with 6/12/7/7 items, the Algorithm 19 review badge, tab order, and focus-visible ring — once Plan 02's layouts are merged so every card's target diagram actually renders (same automation-environment constraint as Plan 01's coverage D9).

---
*Phase: 04-algorithm-browser-and-svg*
*Completed: 2026-08-06*

## Self-Check: PASSED

All modified files and all three task commits verified present on disk / in git history (see below).
