# Phase 4: Algorithm browser and SVG - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-05
**Phase:** 4-Algorithm browser and SVG
**Areas discussed:** Browse & navigation, Diagram layout strategy, Feedback & role encoding, Accessible text description

---

## Browse & navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by taxonomy (Recommended) | Four sections — Additive Stacks, Tree/Branch, Rooting, Parallel — matching the Phase 1 placeholder and Phase 2's `teachingTags`. | ✓ |
| Flat grid of 32 | One uniform grid, sorted by number only. | |
| Flat, filterable by group | Flat grid with a group filter/toggle. | |

**User's choice:** Grouped by taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated route per algorithm (Recommended) | e.g. `/algorithms/17` — deep-linkable, back-button works. | ✓ |
| In-page selector, no route change | Swaps diagram in place, no URL change. | |

**User's choice:** Dedicated route per algorithm

| Option | Description | Selected |
|--------|-------------|----------|
| Number + name/group only (Recommended) | Lightweight cards, full diagram only on detail view. | ✓ |
| Mini SVG thumbnail per item | Small routing-diagram thumbnail for all 32 in browse view. | |

**User's choice:** Number + name/group only

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, prev/next + back to browser (Recommended) | Detail view steps sequentially through algorithms. | ✓ |
| Back to browser only | No sequential stepping. | |

**User's choice:** Yes, prev/next + back to browser

| Option | Description | Selected |
|--------|-------------|----------|
| /algorithms/:id (Recommended) | Canonical AlgorithmId as the route param. | ✓ |
| /algorithms/:slug | Descriptive slug, would require inventing a slug field. | |

**User's choice:** /algorithms/:id

**Notes:** All five questions resolved with the recommended option; user asked for one extra round beyond the initial batch (prev/next nav, route param shape) before moving on.

---

## Diagram layout strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-authored per algorithm (Recommended) | 32 hand-placed layout-hint records, separate from graph truth. | ✓ |
| Computed from graph depth | Pure function derives positions from modulation depth. | |
| Computed, with manual overrides | Algorithmic default + per-algorithm override records. | |

**User's choice:** Hand-authored per algorithm

| Option | Description | Selected |
|--------|-------------|----------|
| Top-to-bottom, modulators above carriers (Recommended) | Matches graph direction (higher id modulates lower id). | ✓ |
| Left-to-right | Modulators left, carriers/output right. | |
| Per-algorithm, whatever reads clearest | No fixed convention. | |

**User's choice:** Top-to-bottom, modulators above carriers

| Option | Description | Selected |
|--------|-------------|----------|
| Consistent scale across all 32 (Recommended) | Same viewBox proportions/node size everywhere. | ✓ |
| Per-algorithm optimized sizing | Canvas adapts to each topology's needs. | |

**User's choice:** Consistent scale across all 32

**Notes:** All three questions resolved with the recommended option in a single round.

---

## Feedback & role encoding

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct node shape (Recommended) | Carriers vs. modulators differ by shape, not just color. | ✓ |
| Icon/label overlay | 'C'/'M' label or icon per node. | |
| Position/grouping only | Rely on layout position alone. | |

**User's choice:** Distinct node shape

| Option | Description | Selected |
|--------|-------------|----------|
| Curved loop path + distinct stroke (Recommended) | Self-loop path with distinct stroke style (e.g. dashed). | ✓ |
| Small badge/icon on the node | Loop icon/badge, no separate path. | |

**User's choice:** Curved loop path + distinct stroke

| Option | Description | Selected |
|--------|-------------|----------|
| Select/highlight only, local to the diagram (Recommended) | Click highlights node, local component state, no facade write. | ✓ |
| Select and sync to InstrumentState | Also updates the shared facade now. | |
| Static diagram, no click interaction | No click behavior at all. | |

**User's choice:** Select/highlight only, local to the diagram

**Notes:** All three questions resolved with the recommended option in a single round.

---

## Accessible text description

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-generated from graph data (Recommended) | Templated sentence from AlgorithmDefinition itself. | ✓ |
| Hand-authored per algorithm | 32 hand-written descriptions, risks drifting out of sync. | |
| Auto-generated base + optional hand-authored gloss | Machine title/desc + optional prose blurb elsewhere. | |

**User's choice:** Auto-generated from graph data

| Option | Description | Selected |
|--------|-------------|----------|
| Full edge enumeration (Recommended) | States every modulation edge explicitly. | ✓ |
| Summarized | High-level summary only, no per-edge detail. | |

**User's choice:** Full edge enumeration

**Notes:** Both questions resolved with the recommended option in a single round.

---

## Claude's Discretion

- Exact TypeScript shape/location of layout-hint data.
- Exact SVG markup structure and CSS custom properties for node/edge states.
- Exact node shape choice and stroke/fill values.
- Exact wording/grammar of the generated-description template.
- Whether node-click highlight also highlights connected edges/neighbors.
- Fixture algorithms for isolated tests (likely Algorithm 1 and 32, reused from Phase 2).
- Whether to stub a static edge style now for future modulation-amount intensity (deferred data
  dependency on InstrumentState, deliberately not wired into the diagram this phase).

## Deferred Ideas

None — discussion stayed within phase scope. Edge thickness/intensity reflecting live modulation
amount (from `GSD_NEW_PROJECT_PROMPT.md`'s visual-design wishlist) was left as Claude's Discretion
rather than formally deferred, since it depends on state this phase deliberately doesn't wire in.
