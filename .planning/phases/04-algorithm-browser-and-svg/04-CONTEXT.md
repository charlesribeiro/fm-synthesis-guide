# Phase 4: Algorithm browser and SVG - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A browsable, accessible view of all 32 DX7-style algorithms: a grouped 32-item browser, a
dedicated per-algorithm detail route rendering a data-driven SVG routing diagram, and an
accessible text description generated from the same canonical dataset. Covers: browse-view
organization and navigation, per-algorithm SVG layout/rendering, carrier/modulator and feedback
visual encoding, and the accessible title/description text. Does NOT cover: audio engine wiring
or sound (Phase 5+), live instrument-state param editing (Playground, later phases), envelope/
parameter UI, guided-lesson prose (Phase 6, 11), or oscilloscope/spectrum visualizers (Phase 10).
The SVG component receives a view model built from `AlgorithmDefinition`; it must not query
`InstrumentState` or the audio engine directly (`docs/ARCHITECTURE.md` §"Rendering strategy").

</domain>

<decisions>
## Implementation Decisions

### Browse view organization and navigation
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

### Diagram layout strategy
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

### Feedback and role encoding (non-color-only, VIS-02/VIS-03)
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

### Accessible text description
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and rendering strategy
- `docs/ARCHITECTURE.md` §"Algorithm graph model" — six nodes, directed edges, carriers, explicit
  feedback metadata, and the layout-hint-layer-separate-from-truth rule this phase's D-05 follows.
- `docs/ARCHITECTURE.md` §"Rendering strategy" — one `<g>` per operator, directed paths with arrow
  markers, separate output-bus paths, distinct feedback path/label, data attributes for testing,
  CSS custom properties for state/intensity, and "the SVG component receives a view model; it must
  not query the audio engine directly."
- `docs/ARCHITECTURE.md` §"4. UI features" — Algorithms as a named top-level feature area.
- `GSD_NEW_PROJECT_PROMPT.md` §"Routes" (~line 243) — `/algorithms` and `/algorithms/:id` route
  sketch this phase's D-02 follows.
- `GSD_NEW_PROJECT_PROMPT.md` §"Visual design" (~line 205) — "carriers and modulators must be
  distinguishable by more than color alone," "the feedback loop must be visually explicit," edge
  thickness/intensity as an optional future enhancement (see Claude's Discretion above).

### Project state and requirements
- `.planning/REQUIREMENTS.md` §"Algorithm Visualization" — VIS-01 through VIS-03, this phase's
  binding acceptance criteria.
- `.planning/ROADMAP.md` §"Phase 4: Algorithm browser and SVG" — success criteria (selector renders
  all 32 + detail route, SVG renders expected operator/edge counts from fixture data,
  carrier/modulator + feedback exposed accessibly not color-only).
- `CLAUDE.md` §"UI and accessibility rules" — original design (no cloned Dexed/Yamaha artwork),
  semantic HTML, no color-only state communication, keyboard operation, reduced motion, SVG with
  accessible text descriptions.
- `.planning/phases/03-signal-instrument-state/03-CONTEXT.md` — "selected operator" tracking was
  explicitly deferred to Phase 4 as local UI state (this phase's D-10), and `InstrumentState`'s
  read-only selector surface (algorithm, operator parameters, feedback) that this diagram must NOT
  bypass ARCHITECTURE.md's view-model boundary to read directly.
- `.planning/phases/02-algorithm-domain/02-CONTEXT.md` — D-05 (carrier = zero outgoing edges to
  other operators, drives D-06's top-to-bottom convention), D-01/D-03 (feedback = self-loop edge,
  `from === to`), D-10 (`teachingTags` four-group taxonomy this phase's D-01 groups by).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/features/algorithms/algorithms.ts`, `.html`, `.scss` — the existing placeholder route
  and component, already grouping by the four teaching taxonomies (D-01) with a `groups` array;
  this phase replaces the placeholder status message with real browse cards and wires the detail
  route.
- `src/app/domain/dx7/models/algorithms.ts` — the canonical `ALGORITHMS` dataset this phase's
  browser and diagram both read from (no duplicated routing knowledge, CLAUDE.md).
- `src/app/domain/dx7/models/derive-role.ts` — `getOperatorRole`, `deriveCarriers`,
  `getFeedbackOperator` — the diagram view model derives carrier/modulator/feedback facts through
  these, never re-derives or duplicates the logic (Phase 2 D-07).
- `src/app/domain/dx7/models/operator.ts` — `OperatorId`, `OPERATOR_IDS` for iterating the six
  operator nodes in a fixed order.
- `src/app/app.routes.ts` — existing lazy-route pattern (`loadComponent`) to extend with the new
  `/algorithms/:id` child route.

### Established Patterns
- Every feature route is lazy-loaded via `loadComponent`, even for what's currently a single
  component (Phase 1 convention, `app.routes.ts`) — the detail route should follow the same shape.
- Domain layer (`src/app/domain/dx7/models/`) has zero Angular imports, machine-enforced by a
  scoped ESLint rule (Phase 2, DOMAIN-04) — any pure layout-hint/description-generation function
  belongs there or in an equally Angular-free module; only the SVG-rendering component itself is
  Angular.
- `src/app/state/instrument-state.ts` (Phase 3) — the app's only existing signal-based facade
  pattern (private writable signal, `.asReadonly()` public signal, explicit command methods) — if
  the diagram's local node-selection state (D-10) becomes non-trivial, mirror this shape at the
  component level rather than the facade level.

### Integration Points
- Phase 5 (audio engine), Phase 6 (guided lessons), and Playground all eventually need to point at
  a specific algorithm's diagram — `/algorithms/:id` (D-02) is the stable integration surface they
  link into. No other phase should define a second algorithm-detail route or a second SVG diagram
  renderer.

</code_context>

<specifics>
## Specific Ideas

No specific visual mockups or external references were provided. The concrete "feel" decisions are
D-06 (top-to-bottom signal flow, consistent across all 32) and D-08/D-09 (shape- and path-based,
not color-only, encoding) — both grounded in `docs/ARCHITECTURE.md` and
`GSD_NEW_PROJECT_PROMPT.md`'s existing visual-design constraints rather than new user references.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Edge thickness/intensity reflecting live modulation
amount, from `GSD_NEW_PROJECT_PROMPT.md`'s visual-design wishlist, was not decided as in/out —
left as Claude's Discretion above since it depends on state this phase deliberately doesn't wire
in, per D-10.)

</deferred>

---

*Phase: 4-Algorithm browser and SVG*
*Context gathered: 2026-08-05*
