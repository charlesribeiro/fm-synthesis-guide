# Phase 6: Guided lessons for Algorithm 32 and Algorithm 1 - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A guided-lesson framework, plus its first two content instances — Algorithm 32 (pure additive
synthesis, six independent carriers) and Algorithm 1 (a stack and a tower: two carriers, one
simple pair, one four-operator modulation chain with feedback). Covers: a data-driven
`LessonDefinition` model (domain layer, no Angular), a generic `LessonPlayer`/lesson-detail
component that renders any lesson from that data, an in-memory `LessonProgress` facade tracking
per-lesson completion, the `/learn` index (replacing today's static placeholder list) and
`/learn/:lessonId` detail route, and the two lesson content records themselves — each with an
objective, explanation, an embedded try-this experience (diagram + play surface), and a
behavior-verified completion check. Ends the milestone's first end-to-end vertical slice: browse →
hear → adjust → understand, on one page. Does NOT cover: the accurate AudioWorklet engine (Phase
7), the full 32-algorithm curriculum or per-algorithm curated presets (Phase 11, CURR-01),
persisting lesson progress across reload (Phase 12, PERSIST-01), oscilloscope/spectrum
visualizers (Phase 10), or any new play-surface implementation — the lesson embeds the *same*
play-surface component Playground uses, never a second one.

</domain>

<decisions>
## Implementation Decisions

### Lesson framework generality
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

### "Try this" interactive surface
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

### Completion check mechanism
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

### Lesson navigation structure
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Lesson domain and architecture
- `docs/ARCHITECTURE.md` §"1. Pure DX7 learning domain" — "Lesson definitions and completion
  rules" as framework-independent TypeScript, the source for D-01's domain-layer placement.
- `docs/ARCHITECTURE.md` §"2. Application state" — "Lesson/progress state" as its own
  signal-based facade, separate from instrument state — source for D-07's `LessonProgress` shape.
- `docs/ARCHITECTURE.md` §"Audio roadmap" → "Approximation engine" — "Useful for early UI/lesson
  development... keep behind the same engine interface," confirming the lesson's play surface
  must go through the existing `SynthEngine` boundary, not a new one.
- `GSD_NEW_PROJECT_PROMPT.md` §"Learning experience" → "Guided Learn mode" (~line 182) — full
  source for the lesson concept: curriculum of small lessons, carrier-vs-modulator framing,
  Algorithm 32 then Algorithm 1 ordering, "each lesson has an objective, a short explanation, a
  'try this' action, an expected audible effect, and a completion check," and "avoid forcing the
  learner to memorize all 32 diagrams" (informs Claude's Discretion on lesson copy).
- `GSD_NEW_PROJECT_PROMPT.md` §"Application state" (~line 140) — "Lesson step and completion
  state" listed as suggested facade state, and "Reset a lesson to a known educational preset"
  (line 18) — source for D-04 and D-07.
- `GSD_NEW_PROJECT_PROMPT.md` §"Routes" (~line 243) — `/learn` and `/learn/:lessonId` route
  sketch, source for D-09.
- `docs/ROADMAP_SEED.md` §"Phase 6: Guided lessons for Algorithm 32 and Algorithm 1" — "Lesson
  framework," the two named lessons, "interactive 'try this' checks," "first end-to-end vertical
  slice" — this phase's binding scope summary.
- `docs/ACCEPTANCE_CRITERIA.md` — "follow a guided experiment," "Keyboard access covers
  navigation, operator editing, and note triggering" (applies to the embedded play surface).

### Project state and requirements
- `.planning/REQUIREMENTS.md` §"Guided Learning" — LESSON-01, LESSON-02, this phase's binding
  acceptance criteria.
- `.planning/ROADMAP.md` §"Phase 6: Guided lessons for Algorithm 32 and Algorithm 1" — success
  criteria (learner can complete each lesson; each lesson has objective/explanation/try-this/
  completion check).
- `CLAUDE.md` §"Domain rules" and §"Angular rules" — algorithm topology as data never hardcoded
  layout (extends to lesson content: no per-lesson special-casing beyond the data model), signal
  inputs/outputs, read-only facades, `effect` only for imperative sync.
- `.planning/phases/05-first-playable-approximation/05-CONTEXT.md` — the `SynthEngine`
  implementation and Playground's play surface this phase must reuse, not duplicate (integration
  point: "Phase 6... build[s] on top of whatever `SynthEngine` implementation and Playground
  play-surface this phase establishes — no other phase should define a second... play surface").
- `.planning/phases/04-algorithm-browser-and-svg/04-CONTEXT.md` — D-02 (`/algorithms/:id` stable
  route), the browse-index → detail-route pattern D-09 follows, and the SVG diagram component
  D-05 embeds.
- `.planning/phases/03-signal-instrument-state/03-CONTEXT.md` — `InstrumentState`'s
  `setAlgorithm`/reset commands (D-04's auto-setup mechanism) and `OperatorParameters`' DX7-scale
  shape (`outputLevel`, `ratio`, `detune`, `mode`) that D-02's `targetParam` selects from.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/features/learn/learn.ts`/`.html`/`.scss` — the existing placeholder with a static
  `upcomingLessons` array already naming Algorithm 32 ("Pure additive synthesis") and Algorithm 1
  ("A stack and a tower") — this phase replaces the placeholder with the real `/learn` index (D-09)
  built from `LessonDefinition` data instead of the hardcoded array.
- `src/app/state/instrument-state.ts` — `setAlgorithm`, `updateOperator`, `setFeedback`, reset —
  the command surface D-04's auto-setup and D-06's completion-check watching both read/act through.
- `src/app/features/playground/playground.ts`, `keyboard-note-map.ts` — the existing on-screen/
  computer-keyboard play surface and note-mapping logic; D-03's embedded play surface reuses this,
  per Claude's Discretion on exact extraction shape.
- `src/app/core/audio/synth-engine.ts` (`SYNTH_ENGINE` token) — the injected engine boundary the
  embedded play surface must go through, same as Playground does.
- `src/app/features/algorithms/algorithm-detail/algorithm-detail.ts` and its SVG diagram
  component — reused inline per D-05.
- `src/app/domain/dx7/models/algorithms.ts`, `derive-role.ts`, `operator.ts`,
  `operator-parameters.ts` — the canonical dataset and derivation functions a `LessonDefinition`
  for a given `AlgorithmId` reads through; `OperatorId`/`OPERATOR_IDS` and `OperatorParameters`'
  field names are what D-02's `targetOperator`/`targetParam` are typed against.

### Established Patterns
- Every feature route is lazy-loaded via `loadComponent` (Phase 1 convention) — `/learn/:lessonId`
  follows the same shape as `/algorithms/:id`.
- Domain layer (`src/app/domain/dx7/models/`, and now `src/app/domain/dx7/lessons/` per D-01) has
  zero Angular imports, machine-enforced by the scoped ESLint rule (Phase 2, DOMAIN-04) —
  `LessonDefinition` and any pure completion-check logic belong there.
- Signal-based facade pattern (private `WritableSignal`, `.asReadonly()` public `Signal`) —
  `InstrumentState` (Phase 3) is the template `LessonProgress` (D-07) should mirror.
- Phase 4 already replaced a feature's static placeholder with a real data-driven browse index
  (`algorithms.ts`) — D-09 follows the identical precedent for `learn.ts`.

### Integration Points
- `InstrumentState` remains the single source of truth for algorithm/operator/feedback state; the
  lesson reads AND writes it (via existing commands) but never forks a parallel copy.
- `SynthEngine`/Playground's play surface is the one integration point for actually making sound;
  this phase's embedded try-this UI must go through it, not stand up a second implementation.
- Phase 11 (curriculum for all 32 algorithms) builds directly on `LessonDefinition` (D-01) and
  `LessonProgress` (D-07) — no other phase should define a second lesson data model or a second
  progress facade.
- Phase 12 (persistence) will eventually persist whatever shape `LessonProgress` (D-07) lands on
  this phase — keeping its shape clean/serializable now avoids a breaking change later, though
  building the persistence itself is explicitly out of scope.

</code_context>

<specifics>
## Specific Ideas

No specific visual mockups or external references were provided. The concrete "feel" decisions are
D-08 (one scrolling page, everything visible at once — no wizard) and D-03/D-05 (diagram, sound,
and explanation together on the same page) — both grounded in the core value ("see the diagram,
hear the sound, change a parameter, immediately understand why the sound changed") rather than new
user references. The two lessons' exact pedagogical copy is left to Claude's Discretion, informed
by `GSD_NEW_PROJECT_PROMPT.md`'s existing framing language for each lesson.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (The full 32-algorithm curriculum, per-algorithm
curated presets, and lesson-progress persistence across reload were all named during discussion as
explicitly out of scope for this phase — CURR-01/Phase 11 and PERSIST-01/Phase 12 respectively —
and are recorded as such in the Phase Boundary above, not as new deferred ideas.)

</deferred>

---

*Phase: 6-Guided lessons for Algorithm 32 and Algorithm 1*
*Context gathered: 2026-08-10*
