# Phase 2: Algorithm domain - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

One canonical, immutable, validated dataset of all 32 DX7-style operator-routing algorithms,
independent of Angular. Covers: the `AlgorithmId`/edge/feedback data model, the 32-algorithm
dataset itself, structural validation (invariant tests rejecting malformed data), and
carrier/modulator role derivation from graph structure. Does NOT cover: instrument/patch state
(Phase 3), SVG rendering (Phase 4), audio engine wiring (Phase 5+), or lesson/curriculum content
(Phase 6, 11) — teaching-group tags are captured as structural data here, but lesson prose is not.

</domain>

<decisions>
## Implementation Decisions

### Feedback representation
- **D-01:** Feedback is modeled as a self-loop `ModulationEdge` (`from === to`) rather than a
  separate `FeedbackDefinition` type — reuses the existing edge model instead of a parallel
  concept, and matches `docs/ARCHITECTURE.md`'s "explicit feedback edge" language.
- **D-02:** The algorithm dataset carries only the structural fact of feedback wiring (which
  operator, if any, has a self-loop). The 0–7 feedback *level* is instrument/patch state, owned by
  Phase 3 — not part of `AlgorithmDefinition`.
- **D-03:** "No feedback" is represented by simple absence of a self-loop edge — no explicit
  `hasFeedback: false` marker needed.
- **D-04:** Validation (DOMAIN-02) must reject: more than one feedback self-loop edge per
  algorithm, and a feedback edge referencing a nonexistent operator id. (A clause rejecting
  "feedback edges with `from !== to` mislabeled as feedback" is unrepresentable under D-01 —
  feedback is identified solely by `from === to`, so there is no separate marker that could
  disagree with the edge endpoints.)

### Carrier/modulator derivation
- **D-05:** An operator is a **carrier** iff it has zero outgoing modulation edges to *other*
  operators (a self-feedback edge does not count as "to another operator"); otherwise it's a
  **modulator**. This satisfies DOMAIN-03 literally — role is derived, never hardcoded per
  algorithm — and supersedes the `readonly carriers: OperatorId[]` field sketched in
  `GSD_NEW_PROJECT_PROMPT.md` (that sketch predates this decision; do not reintroduce a stored
  carriers list). — **Reversibility:** costly — changing the derivation rule later means
  re-verifying all 32 algorithms' role output and every call site that reads `role`.
- **D-06:** Only two roles exist: `carrier | modulator`. Feedback is an orthogonal boolean
  (`hasFeedbackLoop` or equivalent, itself derived from D-01's self-loop edge) layered on top of
  either role — no third `feedbackModulator` enum value.
- **D-07:** Carrier/modulator role is a pure derivation function (e.g. `deriveCarriers(algorithm)`
  / `getOperatorRole(algorithm, operatorId)`) computed on demand, not precomputed/cached on the
  `AlgorithmDefinition` object at module load — avoids duplicated state going stale, matches
  CLAUDE.md's "no duplicated routing knowledge."

### Routing-matrix sourcing and verification
- **D-08:** The 32-algorithm operator-routing topology is entered as original structured
  data — dxwire re-encoding (verbatim transcription of routing facts into this project's
  shape), reconciled repairs where researched edges disagreed with researched carriers, and
  rule-constrained reconstruction for remaining MEDIUM-confidence intermediate edges —
  cross-checked against independent public sources where available, never copied from Yamaha
  manual scans or Dexed source/diagrams. Routing facts (which operator modulates which) are
  not copyrightable; only specific diagrams/text/code expressing them are, so original
  structured data encoding the same topology is the licensing-safe path (CLAUDE.md licensing
  rules). Recorded counts after Plan 02-04: 18 dxwire-re-encoded rows, 14 reconciled rows.
- **D-09:** `gsd-phase-researcher` compiles the full 32-algorithm routing reference table (with
  cited sources) into `RESEARCH.md` during Phase 2 research. The user reviews/spot-checks the
  compiled table before planning locks it in — not a per-source, per-algorithm approval pass.
- **D-10:** The four-group teaching taxonomy (Additive Stacks 1–6, Tree/Branch 7–18, Rooting
  19–25, Parallel 26–32) — currently flagged in PROJECT.md as unverified research input — is
  verified alongside the routing research and encoded now as a lightweight structural
  `teachingTags` field per algorithm (group derives from graph shape, same research pass as
  topology). Specs must check each algorithm's `teachingTags` against an independently
  sourced per-id expected-tag table (or equivalent graph-shape assertions), not by re-deriving
  the tag solely from D-10 ID ranges in the test helper. Lesson prose/content itself stays out
  of scope for Phase 2 (Phase 6, 11).

### Claude's Discretion
- Exact TypeScript shape of `AlgorithmDefinition`/`ModulationEdge` (readonly interfaces vs.
  branded types), file/module layout under `src/app/domain/dx7/`, and whether validation runs as
  a build-time invariant-test suite only or also as an exported runtime `validateAlgorithm()`
  guard usable at boundaries — planner's call, informed by CLAUDE.md's "validate external data at
  boundaries" rule (the dataset itself is internal/trusted, but imported/patched data later isn't).
- Exact fixture algorithms used for isolated tests (ROADMAP.md Phase 2 plan note) — planner/
  researcher picks representative cases (e.g. Algorithm 32 all-carriers, Algorithm 1 stack+tower,
  one with feedback, one without).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & data model
- `docs/ARCHITECTURE.md` §"Algorithm graph model", §"Rendering strategy" — graph model
  requirements (six nodes, directed edges, carriers, explicit feedback metadata, deterministic
  eval order, layout-hints-separate-from-truth) that Phase 2's dataset must satisfy for later
  phases to consume without rework.
- `GSD_NEW_PROJECT_PROMPT.md` §"Data model" (around line ~100-140) — original sketched
  `AlgorithmDefinition`/`ModulationEdge`/`OperatorParameters` shapes. Treat as a starting
  hypothesis only: D-05 explicitly supersedes its stored `carriers` field with derivation.
- `docs/ROADMAP_SEED.md` §"Phase 2: Algorithm domain" — phase deliverable list (canonical
  dataset, carrier/modulator derivation, fixture algorithms).

### Project state and requirements
- `.planning/PROJECT.md` — Key Decisions table, licensing constraints, and the note that the
  four-group taxonomy is unverified research input (now addressed by D-10).
- `.planning/REQUIREMENTS.md` §"Algorithm Domain" — DOMAIN-01 through DOMAIN-04, the phase's
  binding acceptance criteria.
- `.planning/ROADMAP.md` §"Phase 2: Algorithm domain" — success criteria (schema/invariant
  validation for all 32, carrier derivation matching graph structure, zero Angular imports).
- `CLAUDE.md` §"Domain rules", §"Licensing and content" — immutable readonly models, restricted
  operator-id type, one canonical dataset with no duplicated routing knowledge, and the
  no-copyrighted-source constraint that motivates D-08.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/domain/dx7/models/operator.ts` — `OperatorId` (`1|2|3|4|5|6`), `OPERATOR_IDS`,
  `isOperatorId()` guard. Already built in Phase 1 specifically so Phase 2 has a real type to
  build on; reuse as-is.
- `src/app/domain/dx7/models/algorithm.ts` — `AlgorithmId` (`number`, 1–32), `MIN_ALGORITHM_ID`,
  `MAX_ALGORITHM_ID`, `isAlgorithmId()` guard. Reuse as-is; Phase 2 adds `AlgorithmDefinition`,
  `ModulationEdge`, the 32-item dataset, and derivation/validation functions alongside these.
- `src/app/domain/dx7/models/operator.spec.ts`, `algorithm.spec.ts` — existing Vitest patterns
  (boundary-value tests, `describe`/`it` structure, small named fixtures) to match for new domain
  tests.
- `src/app/core/audio/synth-engine.ts` — placeholder `SynthEngine` interface already references
  `OperatorId`; will need `AlgorithmDefinition` once Phase 2 lands, but wiring that up is out of
  scope for Phase 2 itself (Phase 5).

### Established Patterns
- Domain types live under `src/app/domain/dx7/models/` with one concept per file, a runtime type
  guard exported alongside each type, and a co-located `.spec.ts`. Phase 2 should continue this
  layout (e.g. `algorithm-definition.ts`, `modulation-edge.ts`, `algorithms.ts` for the dataset,
  a `derive-role.ts` or similar for D-05/D-07's pure function).
- Existing domain code has zero Angular imports already (verified in Phase 1) — DOMAIN-04
  continues an established constraint, not a new one.

### Integration Points
- The 32-algorithm dataset becomes the single source of truth that Phase 3 (instrument state),
  Phase 4 (SVG diagrams), and Phase 5+ (audio engine) all read from — no other phase should ever
  redefine routing data.

</code_context>

<specifics>
## Specific Ideas

No specific visual/UX references — this phase is data-only, no UI surface.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Algorithm domain*
*Context gathered: 2026-08-04*
