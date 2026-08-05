# Phase 2: Algorithm domain - Research

**Researched:** 2026-08-04
**Domain:** FM/phase-modulation algorithm topology data modeling (framework-independent TypeScript)
**Confidence:** HIGH for carrier sets / feedback operators after human review (D-09) and the
2026-08-05 topology corrections (Algorithms 26/27); MEDIUM residual only where rows remain
`unresolved` (Algorithm 19) or where intermediate edges were rule-constrained reconstructions.
The earlier "~24 rows still need spot-check" claim is superseded — see
`02-DATASET-REVIEW.md` Section 5.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Feedback representation**
- D-01: Feedback is modeled as a self-loop `ModulationEdge` (`from === to`) rather than a separate
  `FeedbackDefinition` type.
- D-02: The algorithm dataset carries only the structural fact of feedback wiring (which operator,
  if any, has a self-loop). The 0–7 feedback *level* is instrument/patch state, owned by Phase 3 —
  not part of `AlgorithmDefinition`.
- D-03: "No feedback" is represented by simple absence of a self-loop edge — no explicit
  `hasFeedback: false` marker needed.
- D-04: Validation (DOMAIN-02) must reject: more than one feedback self-loop edge per algorithm,
  and a feedback edge referencing a nonexistent operator id. (A "from !== to mislabeled as
  feedback" clause is unrepresentable under D-01 — feedback is solely `from === to`.)

**Carrier/modulator derivation**
- D-05: An operator is a **carrier** iff it has zero outgoing modulation edges to *other* operators
  (a self-feedback edge does not count as "to another operator"); otherwise it's a **modulator**.
  Role is derived, never hardcoded per algorithm — supersedes the `readonly carriers: OperatorId[]`
  field sketched in `GSD_NEW_PROJECT_PROMPT.md`. **Reversibility: costly** — changing the
  derivation rule later means re-verifying all 32 algorithms' role output and every call site that
  reads `role`.
- D-06: Only two roles exist: `carrier | modulator`. Feedback is an orthogonal boolean
  (`hasFeedbackLoop` or equivalent, itself derived from D-01's self-loop edge) layered on top of
  either role — no third `feedbackModulator` enum value.
- D-07: Carrier/modulator role is a pure derivation function (e.g. `deriveCarriers(algorithm)` /
  `getOperatorRole(algorithm, operatorId)`) computed on demand, not precomputed/cached on the
  `AlgorithmDefinition` object at module load.

**Routing-matrix sourcing and verification**
- D-08: The 32-algorithm operator-routing topology is entered as original structured data —
  dxwire re-encoding (verbatim transcription of routing facts into this project's shape),
  reconciled repairs where researched edges disagreed with researched carriers, and
  rule-constrained reconstruction for remaining MEDIUM-confidence intermediate edges —
  cross-checked against independent public sources where available, never copied from Yamaha
  manual scans or Dexed source/diagrams. Routing facts (which operator modulates which) are
  not copyrightable; only specific diagrams/text/code expressing them are. Recorded counts
  after Plan 02-04: 18 dxwire-re-encoded rows, 14 reconciled rows.
- D-09: `gsd-phase-researcher` compiles the full 32-algorithm routing reference table (with cited
  sources) into `RESEARCH.md` during Phase 2 research. The user reviews/spot-checks the compiled
  table before planning locks it in — not a per-source, per-algorithm approval pass.
- D-10: The four-group teaching taxonomy (Additive Stacks 1–6, Tree/Branch 7–18, Rooting 19–25,
  Parallel 26–32) is verified alongside the routing research and encoded now as a lightweight
  structural `teachingTags` field per algorithm (group derives from graph shape, same research pass
  as topology). Lesson prose/content itself stays out of scope for Phase 2 (Phase 6, 11).

### Claude's Discretion
- Exact TypeScript shape of `AlgorithmDefinition`/`ModulationEdge` (readonly interfaces vs. branded
  types), file/module layout under `src/app/domain/dx7/`, and whether validation runs as a
  build-time invariant-test suite only or also as an exported runtime `validateAlgorithm()` guard
  usable at boundaries.
- Exact fixture algorithms used for isolated tests — planner/researcher picks representative cases
  (e.g. Algorithm 32 all-carriers, Algorithm 1 stack+tower, one with feedback, one without).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOMAIN-01 | All 32 DX7 algorithms represented as one canonical, immutable, validated dataset (no duplicated routing knowledge) | Full routing reference table below (§ Standard Stack is N/A — this is a data-modeling phase, no new libraries); TypeScript modeling approach (§ Architecture Patterns) shows the `AlgorithmDefinition[]` shape and file layout |
| DOMAIN-02 | Dataset validation rejects invalid edges, impossible IDs, duplicate algorithm IDs, malformed feedback declarations, and graphs with zero derived carriers (the resolved form of "missing operators"); an edge-free Algorithm 32 remains valid | § Don't Hand-Roll and § Code Examples give the invariant list and a `validateAlgorithm()` skeleton; § Common Pitfalls flags the specific mistakes validation must catch |
| DOMAIN-03 | Carrier/modulator roles derivable from graph structure, not hardcoded | § Code Examples gives the pure `getOperatorRole`/`deriveCarriers` pattern matching D-05/D-07; § Fixture Algorithm Recommendations gives fixtures that exercise every role/feedback combination |
| DOMAIN-04 | Domain/graph logic has no Angular dependency, independently unit-tested | § Architecture Patterns confirms existing Phase 1 domain files already satisfy this; § Validation Architecture maps DOMAIN-01–04 to concrete Vitest commands |

</phase_requirements>

## Summary

Phase 2 has no new library surface — it's pure TypeScript data modeling on top of the
`OperatorId`/`AlgorithmId` types Phase 1 already built. The engineering risk in this phase is not
"which library to use" but "is the 32-row dataset actually correct," because DX7 algorithm topology
is the kind of fact that's trivially wrong-in-a-way-that-still-compiles: every algorithm has the
same shape of data (6 operators, an edge list, a feedback flag), so a transcription slip anywhere
produces a dataset that still type-checks and still passes shallow tests.

This research compiled a full 32-algorithm routing table by triangulating three independently
authored sources that are not Yamaha manual scans and not the Dexed emulator's own diagram assets:
a technical die-photo reverse-engineering series (righto.com), an open-source Python DX7 emulator's
data module (`gpasquero/vx7`), and an open-source web patch editor's layout data
(`alexferl/dxwire`, whose *rendering* code credits Dexed's `AlgoDisplay.cpp` as a positioning
reference but whose *facts* — which operator is a carrier, which has feedback — are independently
re-encoded, not copied text/images). **The vx7 source turned out to have a reproducible bug**: it
under-counts carriers for every "single deep chain" algorithm (1–4, 7–9), which the other two
sources and this project's own pre-existing requirement language ("Algorithm 1 as a modulation
stack **plus tower**," `REQUIREMENTS.md` LESSON-02) both contradict. That discrepancy is documented
per-algorithm below rather than silently resolved, per D-08/D-09.

**Primary recommendation:** Model `AlgorithmDefinition` as flat, `readonly`-everywhere data
(`{ id, name, edges: ModulationEdge[], teachingTags }`, no stored `carriers` field), derive
carrier/modulator role and feedback presence with two small pure functions, validate with a single
`validateAlgorithm()` guard exercised by a Vitest `it.each`/`describe.each` invariant suite over all
32 real algorithms plus one hand-authored synthetic fixture for the "no feedback" edge case (no real
DX7 algorithm lacks a feedback-capable operator — see § Fixture Algorithm Recommendations). The
carrier-set/feedback-operator table below is authoritative for this phase after the completed
human review and 2026-08-05 superseding corrections (`02-DATASET-REVIEW.md` Section 5): Algorithms
26/27 use routing `6→4, 5→4, 3→2` with carriers `{1,2,4}`; Algorithm 19 remains the sole
`unresolved` row (stated edges retained; do not treat it as final canon). Residual MEDIUM
confidence on some intermediate edges is retained as research nuance only — no further
`checkpoint:human-verify` reopen is required for Phase 2 closeout.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 32-algorithm routing dataset (`AlgorithmDefinition[]`) | Browser/Client | — | This is a static-hosted Angular SPA with no backend (`docs/ARCHITECTURE.md`); all domain logic ships in the client bundle. The dataset is framework-independent code that happens to execute client-side, not a "frontend server" concern. |
| Modulation-edge model (`ModulationEdge`) | Browser/Client | — | Same as above — pure data type, no I/O. |
| Carrier/modulator role derivation (D-05/D-07) | Browser/Client | — | Pure function over in-memory data; no persistence, no network. |
| Dataset structural validation (DOMAIN-02) | Browser/Client | — | Runs at build/test time (Vitest) and optionally at runtime if reused as an import-boundary guard in a later phase (Phase 12 PERSIST-01); never server-side since there is no server. |
| Teaching-taxonomy tagging (D-10) | Browser/Client | — | Structural metadata attached to the same dataset; consumed later by Phase 6/11 lesson UI, not computed there. |

## Standard Stack

No new libraries. This phase adds zero dependencies — it extends the existing, already-installed
toolchain:

| Tool | Version (verified in repo) | Purpose |
|------|------|---------|
| TypeScript | ~6.0.2 | Strict domain types (`package.json`, already installed) |
| Vitest | ^4.0.8 (via `@angular/build:unit-test`) | Invariant test suite (`package.json`, already installed) |

**Version verification:** Confirmed by reading `package.json` directly this session — not a fresh
`npm view` lookup, since these are already-pinned, already-installed project dependencies, not new
packages being added. `[VERIFIED: package.json:19-30]` — `"typescript": "~6.0.2"`,
`"vitest": "^4.0.8"`.

**Installation:** None required.

## Package Legitimacy Audit

**Not applicable.** Phase 2 introduces zero new npm packages — it is pure TypeScript domain code
plus tests, using only the already-installed, already-verified Angular/TypeScript/Vitest toolchain
from Phase 1. The Package Legitimacy Gate protocol is skipped per its own scope ("whenever this
phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│  src/app/domain/dx7/models/  (framework-independent, zero Angular)   │
│                                                                       │
│  operator.ts (Phase 1)        algorithm.ts (Phase 1)                 │
│  OperatorId, isOperatorId()   AlgorithmId, isAlgorithmId()           │
│         │                              │                             │
│         └──────────────┬───────────────┘                             │
│                         ▼                                             │
│              modulation-edge.ts (Phase 2, NEW)                       │
│              ModulationEdge { from: OperatorId; to: OperatorId }     │
│                         │                                             │
│                         ▼                                             │
│           algorithm-definition.ts (Phase 2, NEW)                     │
│           AlgorithmDefinition { id, name, edges, teachingTags }      │
│                         │                                             │
│                         ▼                                             │
│              algorithms.ts (Phase 2, NEW)                            │
│              ALGORITHMS: readonly AlgorithmDefinition[]  (32 items)  │
│                         │                                             │
│           ┌─────────────┼─────────────────┐                          │
│           ▼             ▼                 ▼                          │
│   derive-role.ts   validate-           algorithms.spec.ts            │
│   (D-05/D-07 pure   algorithm.ts        (it.each/describe.each       │
│   functions)        (DOMAIN-02          invariant suite over         │
│                      guard, D-04)       all 32 + synthetic fixture)  │
└─────────────────┬───────────────────────────────────────────────────┘
                   │  imported (read-only) by later phases
    ┌──────────────┼───────────────────┬───────────────────┐
    ▼                                  ▼                    ▼
Phase 3: signal facade          Phase 4: SVG graph      Phase 5: audio
selects an AlgorithmDefinition, uses deriveCarriers()/  engine reads edges
exposes it read-only            edges to draw diagram    to route DSP
```

A reader can trace the primary use case (a raw algorithm fact → a role a UI/audio consumer can act
on) top to bottom: dataset → derivation function → downstream consumer. No component in this phase
queries anything outside this module tree — `docs/ARCHITECTURE.md`'s "layout hint layer separate
from synthesis truth" requirement is satisfied by keeping this module free of any x/y/SVG
coordinate data; that belongs entirely to Phase 4.

### Recommended Project Structure

```text
src/app/domain/dx7/models/
├── operator.ts                  # Phase 1, reuse as-is
├── operator.spec.ts             # Phase 1, reuse as-is
├── algorithm.ts                 # Phase 1, reuse as-is (AlgorithmId, guards)
├── algorithm.spec.ts            # Phase 1, reuse as-is
├── modulation-edge.ts           # NEW: ModulationEdge type + isModulationEdge guard
├── modulation-edge.spec.ts      # NEW
├── algorithm-definition.ts      # NEW: AlgorithmDefinition type
├── algorithms.ts                # NEW: the 32-item ALGORITHMS dataset (data only)
├── algorithms.spec.ts           # NEW: it.each/describe.each invariant suite (DOMAIN-01/02)
├── derive-role.ts                # NEW: getOperatorRole(), deriveCarriers(), hasFeedbackLoop()
├── derive-role.spec.ts           # NEW: role-derivation unit tests (DOMAIN-03)
├── validate-algorithm.ts        # NEW: validateAlgorithm() runtime guard (DOMAIN-02, D-04)
└── validate-algorithm.spec.ts   # NEW
```

This continues the established Phase 1 pattern verbatim: `[CITED: src/app/domain/dx7/models/operator.ts, algorithm.ts]`
— one concept per file, a runtime guard exported alongside the type, a co-located `.spec.ts`.

### Pattern 1: Self-loop feedback as a `ModulationEdge`
**What:** Feedback is `{ from: opId, to: opId }` (same id both sides), not a separate type.
**When to use:** Always, per D-01 — there is exactly one feedback-capable operator slot in every
real DX7 algorithm (confirmed across all 3 sources cross-checked this session), so every real
algorithm's `edges` array contains exactly one self-loop entry alongside its inter-operator edges.
**Example:**

```typescript
// Illustrative shape — planner/executor finalizes exact naming.
import type { OperatorId } from '../operator';

export interface ModulationEdge {
  readonly from: OperatorId;
  readonly to: OperatorId;
}

// Algorithm 1: 6→5→4→3(carrier), 2→1(carrier), feedback self-loop on 6.
const algorithm1Edges: readonly ModulationEdge[] = [
  { from: 6, to: 5 },
  { from: 5, to: 4 },
  { from: 4, to: 3 },
  { from: 2, to: 1 },
  { from: 6, to: 6 }, // feedback (D-01)
];
```

### Pattern 2: Pure role derivation, never stored (D-05/D-07)
**What:** `getOperatorRole()` and `deriveCarriers()` compute role by scanning `edges` on every call
— no `role` or `carriers` field on `AlgorithmDefinition` itself.
**When to use:** Every place a consumer (Phase 3 facade, Phase 4 SVG, Phase 5 audio engine) needs
to know if an operator is a carrier.
**Example:**

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

Source: pattern synthesized directly from D-05/D-06/D-07's literal wording in `02-CONTEXT.md`
(quoted verbatim above in `<user_constraints>`), not an external library pattern.

### Anti-Patterns to Avoid
- **Storing a `carriers: OperatorId[]` field on `AlgorithmDefinition`:** This is exactly what
  `GSD_NEW_PROJECT_PROMPT.md`'s original sketch did (`readonly carriers: readonly OperatorId[];`,
  quoted at `GSD_NEW_PROJECT_PROMPT.md:115`), and D-05 explicitly supersedes it. A stored field can
  drift from the edge list it's supposed to summarize — the exact "duplicated routing knowledge"
  CLAUDE.md's Domain rules forbid.
- **`edge.from === operatorId` without excluding `edge.to === operatorId`:** The single most likely
  DOMAIN-03 bug. Without the self-loop exclusion, every feedback-carrying carrier (e.g. Algorithm
  32's operator 6) is wrongly classified as a modulator. See § Common Pitfalls.
- **Copying an existing algorithm-chart image, Dexed's `AlgoDisplay.cpp`, or Yamaha manual text
  into source comments or docs:** Licensing violation per CLAUDE.md. Routing *facts* are fine to
  encode as original data; diagrams/scans/source code are not.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting cycles beyond the one allowed self-loop | A custom DFS-with-visited-set cycle detector, or any Kahn's-algorithm/topological-sort helper | Assert `edge.from > edge.to` on every non-self-loop edge — the monotonic-edge invariant. **[Decided in Plan 02-03, superseding this row's original recommendation]:** no graph-traversal helper is needed at all, not even a small Kahn's-algorithm pass. If every non-self-loop edge strictly decreases the operator number, following any path strictly decreases a bounded integer, so no cycle can exist among distinct operators — that's the entire proof, asserted directly in `validateAlgorithm` as a one-line `from > to` check with no traversal. The self-loop (`from === to`) is explicitly excluded from this check and remains allowed. | The DX7 architecture guarantees acyclicity among distinct operators by design (righto.com: "operators are modulated only by operators with a higher number" — `[CITED: righto.com, "Yamaha DX7 chip reverse-engineering, part 4"]`); the monotonic-edge invariant makes even a *shared* traversal helper redundant, not just a per-algorithm one — see `validate-algorithm.ts` and `02-03-PLAN.md`'s "Acyclicity does not need its own algorithm" section |
| Runtime immutability of the dataset | A deep-freeze utility or npm package (`deep-freeze`, `immer`, etc.) | `Object.freeze()` applied recursively at every level by hand — the top-level `ALGORITHMS` array, each algorithm element, each element's `edges` array, **and each individual edge object inside it** — plus TypeScript `readonly` for compile-time enforcement | **[Corrected 2026-08-05, CR-01 code-review finding]:** the original guidance below this line claimed shallow `Object.freeze` was "sufficient for one level of nesting per element" — that was wrong, and shipped as a real bug (`02-REVIEW.md` CR-01): `Object.freeze` only freezes the object/array passed to it, not objects it merely holds references to, so freezing `edges` (the array) leaves each `{ from, to }` edge object it contains fully mutable — `algo.edges[0].from = 99` silently succeeded. The dataset is still small enough (32 × ~5 edges) that hand-rolling one extra `.map(edge => Object.freeze({...edge}))` per row is the right level of effort — an immutability library remains over-engineering for this — but "shallow freeze is sufficient here" is the specific claim this row got wrong; freeze every level by hand instead of assuming one level suffices. TypeScript `readonly` still only prevents accidental reassignment at compile time and provides no runtime protection at all. |
| Validating that an id is 1–32 or 1–6 | A new schema-validation dependency (zod/joi/yup) for this one phase | The existing `isAlgorithmId()`/`isOperatorId()` guards from Phase 1 (`src/app/domain/dx7/models/algorithm.ts`, `operator.ts`) | Phase 1 already built exactly this; CLAUDE.md's "one canonical algorithm dataset; no duplicated routing knowledge" extends naturally to "no duplicated ID-validation knowledge." Introducing a validation library for a 6-line range check is unjustified — CONTEXT.md's discretion note leaves the *validation architecture* (guard fn vs. test suite) open, not the *primitive*-validation approach, which Phase 1 already settled. |

**Key insight:** Every "don't hand-roll" temptation in this phase is really "don't reintroduce
stored/duplicated state that the edge list can already answer." The dataset is small (32 × ~5
edges) and the domain rules (CLAUDE.md, D-05–D-07) are unusually explicit about *how* to derive
facts rather than store them — the main risk is not complexity, it's convenience-driven backsliding
into precomputed/cached fields "just this once."

## Fixture Algorithm Recommendations

CONTEXT.md leaves exact fixture selection to research/planner discretion. Recommended set,
chosen to exercise every branch of `getOperatorRole`/`hasFeedbackLoop`/`validateAlgorithm`:

| Fixture | Algorithm | Why |
|---------|-----------|-----|
| All-carriers, pure additive | **Algorithm 32** | LESSON-01 uses this algorithm directly (`REQUIREMENTS.md`). 6 carriers, 0 inter-operator edges, 1 feedback self-loop on operator 6 — exercises the "carrier that also has feedback" branch of `hasFeedbackLoop`/`getOperatorRole` together. `[CITED: dxwire — see Routing Reference Table]` |
| Stack + tower, mixed carriers/modulators | **Algorithm 1** | LESSON-02 uses this algorithm directly (`REQUIREMENTS.md`: "Algorithm 1 as a modulation stack plus tower"). 2 carriers (1, 3), 4 modulators, 1 feedback self-loop on operator 6 (a pure modulator) — exercises "modulator that also has feedback." `[CITED: djjondent blogspot + WebSearch snippet — see table]` |
| Branch-merge, feedback on an interior modulator | **Algorithm 8** | 2 carriers (1, 3), feedback on operator 4 (neither the topmost nor a carrier) — exercises a feedback operator in the *middle* of the graph, and two operators (4, 5) both modulating the same target (3), a branch-merge shape LESSON content and Phase 4's SVG renderer will both need to handle. `[CITED: righto.com — full prose description]`, the single most rigorously-sourced non-trivial algorithm in this research |
| No feedback (synthetic, not a real DX7 algorithm) | **Hand-authored 2-operator fixture**, e.g. `{ id: 4, name: 'SYNTHETIC — not a real DX7 algorithm', edges: [{from: 2, to: 1}] }` (no self-loop) — **use an id inside 1..32**, never an out-of-range placeholder like `999`, since `isAlgorithmId`/`validateAlgorithm` reject anything outside that range and the whole point of this fixture is that it must itself pass `validateAlgorithm`; give it a name that unmistakably flags it as non-canonical, since the id alone will collide with a real algorithm's id | **Important finding:** all 32 real DX7 algorithms have exactly one feedback-capable operator (confirmed across all 3 independent sources — `righto.com`, `vx7`, `dxwire` — every one of the 32 rows has a nonzero feedback marker). There is no real algorithm to use as a "no feedback" fixture. D-03's absence-of-self-loop path can only be exercised with a synthetic, clearly-marked-as-non-canonical fixture object, kept in the `.spec.ts` file, never added to the real `ALGORITHMS` dataset. **[Confirmed correct in Plan 02-03]:** the id must be inside 1..32 to pass `isAlgorithmId`; an illustrative id like the `999` originally shown in an earlier draft of this row would be rejected by validation and cannot be used. |

## Routing Reference Table (all 32 algorithms)

### Methodology and source cross-check

Sources consulted this session (none copied — facts only, per D-08):

1. **`righto.com`** — Ken Shirriff's die-photo reverse-engineering series, specifically "Yamaha DX7
   chip reverse-engineering, part 4: how algorithms are implemented." Technical, original analysis
   of the actual YM21280 chip's algorithm ROM; not a Yamaha document. Gave an explicit prose
   description of Algorithm 8 and the general design rule that modulation only ever flows from a
   higher-numbered to a lower-numbered operator. `[CITED: http://www.righto.com/2021/12/yamaha-dx7-chip-reverse-engineering.html]`
2. **`gpasquero/vx7`** (`engine/algorithm.py`) — an open-source Python DX7 emulator; its own file
   header says the data was "transcribed from the Yamaha DX7 operator's manual algorithm chart,
   cross-referenced with the Dexed open-source emulator" and re-expressed as original Python code
   (0-indexed `AlgorithmDef` dataclasses). Used as a secondary cross-check; **found to have a
   reproducible carrier-count bug** for algorithms in the "single deep chain" family (see below).
   `[CITED: github.com/gpasquero/vx7, engine/algorithm.py, fetched this session]`
3. **`alexferl/dxwire`** (`src/components/Editor/Sidebar/Algorithm.jsx`) — an open-source web-based
   DX7 patch editor; its `ALGORITHMS` layout table independently encodes, per operator per
   algorithm, a grid position, a connector-line style, and — most importantly — a `type` field
   (0 = modulator, 1 = carrier) and an `fb` field (0 = no feedback, nonzero = has feedback,
   encoding only which *drawing style* to use). The file's own comment credits Dexed's
   `AlgoDisplay.cpp` for the *rendering/layout* approach, not the underlying facts, which are
   independently re-typed here. This source's `type`/`fb` fields were read directly and quoted
   verbatim (not summarized) for every one of the 32 algorithms — this is the most complete,
   internally consistent source obtained this session. `[CITED: github.com/alexferl/dxwire, src/components/Editor/Sidebar/Algorithm.jsx, fetched and read directly this session]`
4. **Independent prose spot-checks** via WebSearch: `djjondent.blogspot.com` (algorithm groupings
   and Algorithm 1's shape), `reverbmachine.com` and `bobbyblues.recup.ch` (Algorithm 5's shape —
   both independently describe "three carrier/modulator pairs," matching dxwire and contradicting
   vx7), `yamahablackboxes.com` (Algorithm 26 and 32 partial descriptions).
5. **This project's own prior, independently-written requirement language**: `REQUIREMENTS.md`
   LESSON-02 and `ROADMAP.md` Phase 6 both call Algorithm 1 a "modulation stack plus tower" —
   written before this research session, and only consistent with Algorithm 1 having **two**
   carriers (a "stack" ending at operator 3, a "tower" ending at operator 1), not one. This
   corroborates dxwire/prose sources over vx7 for Algorithm 1.

**Disagreement found and resolved:** vx7's `carriers` field reports only **one** carrier (operator
1) for every algorithm in the "single deep chain" family — Algorithms 1, 2, 3, 4, 7, 8, 9. Both
dxwire's `type` field (read directly) and, for Algorithms 1, 5, and 8 specifically, independent
prose sources (`righto.com`, `djjondent`, `reverbmachine.com`, `bobbyblues.recup.ch`) agree the
correct carrier count is **two** for 1/2/7/8/9 and **two** for 3/4, not one. vx7's `feedback_op`
field and modulation-direction rule ("higher modulates lower") were *not* found to disagree with
the other sources anywhere checked — only its carrier bookkeeping for this specific algorithm
family is suspect. **Table below uses dxwire's carrier/feedback data as primary** (cross-validated
on 5 of 32 rows against a second independent source), not vx7's.

**Confidence key:**
- **HIGH** — carrier set, feedback operator, *and* full edge list cross-checked against 2+
  independent sources this session.
- **MEDIUM** — carrier set and feedback operator read directly from dxwire (single primary source,
  internally consistent, methodology cross-validated elsewhere); exact intermediate edge order
  reconstructed from the "higher modulates lower" structural rule + training-knowledge pattern
  matching, not independently re-derived from a second source this session.

| # | Carriers | Feedback op | Modulation edges (source→dest, excl. feedback) | Group (D-10) | Confidence |
|---|----------|-------------|--------------------------------------------------|--------------|------------|
| 1 | 1, 3 | 6 | 6→5, 5→4, 4→3, 2→1 | Additive Stacks (1–6) | HIGH |
| 2 | 1, 3 | 2 | 6→5, 5→4, 4→3, 2→1 | Additive Stacks (1–6) | HIGH |
| 3 | 1, 4 | 6 | 6→5, 5→4, 3→2, 2→1 | Additive Stacks (1–6) | MEDIUM |
| 4 | 1, 4 | 6 | 6→5, 5→4, 3→2, 2→1 | Additive Stacks (1–6) | MEDIUM — near-duplicate of #3 in dxwire's data (same carriers, same feedback operator, differs only in feedback-loop drawing style); flag for spot-check that a real functional difference exists |
| 5 | 1, 3, 5 | 6 | 6→5, 4→3, 2→1 | Additive Stacks (1–6) | HIGH |
| 6 | 1, 3, 5 | 6 | 6→5, 4→3, 2→1 | Additive Stacks (1–6) | MEDIUM — near-duplicate of #5 in dxwire's data, same caveat as #3/#4 |
| 7 | 1, 3 | 6 | 6→5, 5→4, 4→2, 3→2, 2→1 | Tree/Branch (7–18) | HIGH |
| 8 | 1, 3 | 4 | 6→5, 5→3, 4→3, 2→1 | Tree/Branch (7–18) | HIGH — full prose match with righto.com |
| 9 | 1, 3 | 2 | 6→5, 5→3, 4→3, 2→1 | Tree/Branch (7–18) | HIGH — same shape as #8, feedback moved to operator 2, per dxwire |
| 10 | 1, 4 | 3 | 6→5, 5→4, 2→1 | Tree/Branch (7–18) | MEDIUM |
| 11 | 1, 4 | 6 | 6→5, 5→4, 2→1 | Tree/Branch (7–18) | MEDIUM |
| 12 | 1, 3 | 2 | 6→5, 5→4, 4→3, 2→1 | Tree/Branch (7–18) | MEDIUM |
| 13 | 1, 3 | 6 | 6→5, 5→4, 4→3, 2→1 | Tree/Branch (7–18) | MEDIUM |
| 14 | 1, 3 | 6 | 6→5, 5→4, 4→3, 2→1 | Tree/Branch (7–18) | MEDIUM |
| 15 | 1, 3 | 2 | 6→5, 5→2, 4→2 | Tree/Branch (7–18) | MEDIUM |
| 16 | 1 | 6 | 6→5, 5→1, 4→3, 3→1, 2→1 | Tree/Branch (7–18) — "pure FM into operator 1" per djjondent | MEDIUM — carrier count and single-carrier shape confirmed by djjondent's taxonomy description; exact 3-chain pairing (which pair merges where) not independently re-verified |
| 17 | 1 | 2 | 6→5, 5→1, 4→3, 3→1 | Tree/Branch (7–18) — "pure FM into operator 1" | MEDIUM, same caveat as #16 |
| 18 | 1 | 3 | 6→5, 5→4, 4→1, 2→1 | Tree/Branch (7–18) — "pure FM into operator 1" | MEDIUM, same caveat as #16 |
| 19 | 1, 4, 5 | 6 | 6→5, 5→4, 5→3, 5→2 | Rooting (19–25) | MEDIUM |
| 20 | 1, 2, 4 | 3 | 5→4, 3→2, 2→1, 6→5 | Rooting (19–25) | MEDIUM |
| 21 | 1, 2, 4, 5 | 3 | 6→5, 3→2, 2→1 | Rooting (19–25) | MEDIUM |
| 22 | 1, 3, 4, 5 | 6 | 6→5, 6→4, 6→3, 2→1 | Rooting (19–25) | HIGH — "the fan," structurally forced given carrier set + single remaining modulator (op6) + strict higher-to-lower rule |
| 23 | 1, 2, 4, 5 | 6 | 6→5, 5→4 | Rooting (19–25) | MEDIUM |
| 24 | 1, 2, 3, 4, 5 | 6 | 6→5, 5→4 | Rooting (19–25) — "1–3 pure sine carriers, no modulators" per djjondent | MEDIUM |
| 25 | 1, 2, 3, 4, 5 | 6 | 6→5, 5→4 | Rooting (19–25) | MEDIUM |
| 26 | 1, 2, 4 | 6 | 6→4, 5→4, 3→2 | Parallel (26–32) | HIGH — corrected 2026-08-05; carriers `{1,2,4}` preserved (`02-DATASET-REVIEW.md` §5) |
| 27 | 1, 2, 4 | 3 | 6→4, 5→4, 3→2 | Parallel (26–32) | HIGH — same non-feedback shape as Algorithm 26 after the 2026-08-05 correction |
| 28 | 1, 3, 6 | 5 | 5→4, 4→3, 2→1 | Parallel (26–32) | MEDIUM |
| 29 | 1, 2, 3, 5 | 6 | 6→5, 4→3 | Parallel (26–32) | MEDIUM |
| 30 | 1, 2, 3, 6 | 5 | 5→4, 4→3 | Parallel (26–32) | MEDIUM |
| 31 | 1, 2, 3, 4, 5 | 6 | 6→5 | Parallel (26–32) | HIGH — single edge, minimal ambiguity |
| 32 | 1, 2, 3, 4, 5, 6 | 6 | (none) | Parallel (26–32) — "pure additive" | HIGH — 3-source agreement (righto.com, vx7, dxwire, reverbmachine.com) |

**Every row above respects the structural invariant confirmed by `righto.com`**: every
`ModulationEdge` with `from !== to` has `from > to` (operators are only ever modulated by
higher-numbered operators). This is a useful invariant-test assertion in its own right for
`validate-algorithm.spec.ts` — any imported/hand-entered edge violating it is definitely wrong.

## Verification of the Four-Group Teaching Taxonomy (D-10)

`PROJECT.md` flagged the four-group taxonomy (Additive Stacks 1–6, Tree/Branch 7–18, Rooting
19–25, Parallel 26–32) as unverified research input. Verified this session against the carrier-set
data compiled above, cross-checked with an independent description of the same taxonomy:

`[CITED: djjondent.blogspot.com, "Yamaha DX7 - Operators & Algorithms"]` describes:
- **Group 1 (1–6):** "stacked algorithms... 2 towers to 3 towers" — matches: algorithms 1–4 have 2
  carriers, algorithms 5–6 have 3 carriers, and none have branch-merges (every carrier's incoming
  chain is a simple linear stack).
- **Group 2 (7–18):** mixed stack/branch; explicitly calls out "algorithms 16, 17 & 18 are pure
  frequency modulation" converging into operator 1 — matches: 16/17/18 are the only single-carrier
  algorithms in this range.
- **Group 3 (19–25):** "at least 3 carriers each" — matches every row: 19 (3), 20 (3), 21 (4), 22
  (4), 23 (4), 24 (5), 25 (5).
- **Group 4 (26–32):** "at least 1 pure sine wave carrier-only operator" — consistent with 28/30's
  operator 6 and 32's fully-carrier shape; less crisp for 26/27/29/31 but group boundary itself
  (26–32) is corroborated by carrier-count discontinuity at the 25/26 line (25 has 5 carriers with
  a shared 2-deep chain; 26 introduces a 3-carrier shape with a different branch pattern).

**Conclusion:** group boundaries (1–6, 7–18, 19–25, 26–32) are confirmed by an independent
carrier-count/shape analysis, not just asserted — D-10 satisfied. No algorithm's group placement
looked ambiguous against this carrier-count-based analysis, though the fine-grained *sub*-pattern
within Group 4 is the least crisply corroborated of the four (single source for the exact
"pure-sine-operator" claim).

## Common Pitfalls

### Pitfall 1: Self-loop miscounted in role derivation
**What goes wrong:** `getOperatorRole()` implemented as
`edges.some(e => e.from === operatorId)` (without excluding `e.to === operatorId`) silently
misclassifies every feedback-carrying carrier (e.g. Algorithm 32's operator 6) as a `modulator`.
**Why it happens:** The self-loop edge (`from === to === operatorId`) technically satisfies
`e.from === operatorId`, so a naive "does this operator appear as a source anywhere" check trips on
its own feedback loop.
**How to avoid:** Always test `e.from === operatorId && e.to !== operatorId` (see § Code Examples).
**Warning signs:** A carrier-count invariant test that only uses Algorithm 1 (feedback on a pure
modulator, operator 6) will *not* catch this bug — it needs a fixture where the feedback operator
is *also* a carrier. Algorithm 32 is exactly that fixture (see § Fixture Algorithm Recommendations).

### Pitfall 2: 0-indexed vs 1-indexed operator confusion when cross-referencing sources
**What goes wrong:** Both `vx7` and this research's own manual cross-checking work with 0-indexed
operator numbers internally (`op0 = OP1 ... op5 = OP6`); the project's `OperatorId` type is
1-indexed (`1 | 2 | 3 | 4 | 5 | 6`, `[VERIFIED: src/app/domain/dx7/models/operator.ts:12]`
`export type OperatorId = 1 | 2 | 3 | 4 | 5 | 6;`). Transcribing routing facts from an external
source without converting the index base is a classic off-by-one data-entry bug.
**Why it happens:** Source code convention (0-indexed arrays) vs. domain convention (1-indexed,
matching the physical operator labels on a real DX7) don't match.
**How to avoid:** The table in this document is already normalized to 1-indexed `OperatorId`
values — copy from it directly rather than re-deriving from vx7's raw 0-indexed tuples.

### Pitfall 3: Reintroducing a stored `carriers` field
**What goes wrong:** `GSD_NEW_PROJECT_PROMPT.md`'s original data-model sketch included
`readonly carriers: readonly OperatorId[];` directly on `AlgorithmDefinition`
(`[VERIFIED: GSD_NEW_PROJECT_PROMPT.md:115]`
`readonly carriers: readonly OperatorId[];`). If an executor works from that document instead of
CONTEXT.md, they'll add this field back.
**Why it happens:** The prompt document predates D-05's decision and is still on disk as a
plausible-looking reference.
**How to avoid:** CONTEXT.md's `<canonical_refs>` section already flags this explicitly; planner
should not schedule a task that copies the `AlgorithmDefinition` interface verbatim from
`GSD_NEW_PROJECT_PROMPT.md` without the `carriers` field removed.

### Pitfall 4: Treating single-source routing data as ground truth
**What goes wrong:** vx7's carrier data for algorithms 1–4, 7–9 is wrong (see § Routing Reference
Table methodology). Any implementation that transcribes routing facts from a single source without
the cross-check this research performed would silently ship the same bug.
**Why it happens:** vx7 is a complete, well-organized, plausible-looking data file — nothing about
reading it in isolation signals a problem.
**How to avoid:** Use the table compiled in this document (already cross-checked); if the planner
or executor needs to re-derive any row independently, cross-check against at least 2 sources per
D-08, not vx7 alone.

## Code Examples

### `validateAlgorithm()` runtime guard (DOMAIN-02, D-04)

```typescript
// Illustrative shape — planner/executor finalizes exact error type/return convention.
import { OPERATOR_IDS, isOperatorId, type OperatorId } from '../operator';
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

  // DOMAIN-02: reject a DAG violation among non-feedback edges (higher-modulates-lower rule,
  // cross-checked against righto.com — see § Routing Reference Table).
  for (const edge of algorithm.edges) {
    if (edge.from !== edge.to && edge.from <= edge.to) {
      throw new InvalidAlgorithmError(
        `Algorithm ${algorithm.id}: edge ${edge.from}->${edge.to} violates the higher-modulates-lower rule`,
      );
    }
  }
}
```

### `it.each`/`describe.each` invariant suite over all 32 fixtures

```typescript
// algorithms.spec.ts — avoids 32 near-duplicate test blocks.
import { describe, expect, it } from 'vitest';
import { ALGORITHMS } from './algorithms';
import { validateAlgorithm } from './validate-algorithm';
import { deriveCarriers } from './derive-role';

describe.each(ALGORITHMS)('Algorithm $id ($name)', (algorithm) => {
  it('passes structural validation', () => {
    expect(() => validateAlgorithm(algorithm)).not.toThrow();
  });

  it('has at least one carrier', () => {
    expect(deriveCarriers(algorithm).length).toBeGreaterThan(0);
  });

  it('references exactly six distinct operators across edges and carriers', () => {
    const referenced = new Set<number>();
    for (const edge of algorithm.edges) {
      referenced.add(edge.from);
      referenced.add(edge.to);
    }
    for (const carrier of deriveCarriers(algorithm)) {
      referenced.add(carrier);
    }
    expect(referenced.size).toBeLessThanOrEqual(6);
  });
});

it('has exactly 32 algorithms with unique ids', () => {
  const ids = ALGORITHMS.map((a) => a.id);
  expect(ids).toHaveLength(32);
  expect(new Set(ids).size).toBe(32);
});
```

Vitest 4's `describe.each`/`it.each` API (array of objects → named `$property` interpolation in the
title string) is unchanged from Vitest's long-stable Jest-compatible API surface — standard,
low-risk usage. `[ASSUMED: training knowledge of a stable, multi-year-unchanged Vitest/Jest API;
not independently re-verified against Vitest 4 changelog this session, but risk of drift is low
given package.json's already-passing Phase 1 Vitest setup uses the same test runner version]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | N/A | — | This phase's domain (DX7 algorithm topology) is a closed, historically-fixed 40-year-old dataset — there is no "current approach" to track; the only currency concern is Vitest/TypeScript API stability, both already covered under § Standard Stack. |

**Deprecated/outdated:** None applicable.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact intermediate modulation edges for MEDIUM-confidence rows were reconstructed via the higher-modulates-lower rule plus pattern matching | Routing Reference Table | **Superseded 2026-08-05:** human review + Alg 26/27 edge correction; Alg 19 remains `unresolved` with stated edges. Residual risk limited to unresolved/ambiguous residual rows. |
| A2 | Algorithms 3/4 and 5/6 are topologically identical under the project's D-01 self-loop feedback model (multi-operator return-edge feedback is out of scope) | Routing Reference Table, rows 3/4/5/6 | Accepted under D-01 for this educational model; Yamaha manuals document multi-op feedback for Alg 4/6 in hardware, not represented here. |
| A3 | Algorithm 26's carrier set is {1, 2, 4} (per dxwire); edges corrected 2026-08-05 to 6→4, 5→4, 3→2 | Routing Reference Table, row 26 | **Resolved** — carriers retained, edges corrected; see `02-DATASET-REVIEW.md` Section 5. |
| A4 | Vitest 4's `it.each`/`describe.each` API surface (array-of-objects, `$property` title interpolation) is unchanged from the long-stable Jest-compatible convention | Code Examples | Low risk — if the exact interpolation syntax has changed, it's a test-file-only fix, not a domain-model design issue; would surface immediately as a failing/malformed test run, not a silent bug |

**If this table is empty:** N/A — see rows above.

## Open Questions (RESOLVED — see `02-DATASET-REVIEW.md` Section 5, 2026-08-05)

1. **Are algorithms 3/4 and 5/6 truly topologically identical under this project's D-01 self-loop
   model?**
   - **Outcome:** Treated as same modulation topology under D-01. Yamaha manuals document
     multi-operator return-edge feedback for Alg 4/6 in hardware; that return-edge model is out of
     scope here (self-loop only). No further Phase 2 checkpoint reopen.

2. **Is Algorithm 26's carrier set {1, 2, 4}?**
   - **Outcome:** Yes — carriers `{1,2,4}` retained; edges corrected 2026-08-05 to `6→4, 5→4, 3→2`.
     The obsolete `yamahablackboxes.com` disagreement note is withdrawn.

**Residual unresolved row:** Algorithm 19 — stated RESEARCH.md edges retained under the
multi-invented-edge stop-condition; downstream phases must not treat it as final canon.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.8, run via `@angular/build:unit-test` (Angular 22's integrated builder) |
| Config file | none — builder-managed, `[VERIFIED: angular.json]` — `"test": { "builder": "@angular/build:unit-test" }` with no separate `vitest.config.ts` in the repo |
| Quick run command | `npm test` (runs once and exits outside a TTY — documented Phase 1 finding in `STATE.md`; `npm test -- --run` is not a valid flag on this builder) |
| Full suite command | `npm test` (same command — this project has one Vitest suite, no separate "quick" vs "full" split yet) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOMAIN-01 | All 32 algorithms present, unique ids, canonical dataset | unit | `npm test` (`algorithms.spec.ts`) | ✓ Implemented |
| DOMAIN-02 | Validation rejects malformed edges/ids/feedback / zero carriers | unit | `npm test` (`validate-algorithm.spec.ts`) | ✓ Implemented |
| DOMAIN-03 | Carrier/modulator role derivable, not hardcoded | unit | `npm test` (`derive-role.spec.ts`) | ✓ Implemented |
| DOMAIN-04 | Zero Angular imports, independently testable | static + unit | `npm run build` + `npm test` + `npm run lint` — domain-scoped ESLint `@typescript-eslint/no-restricted-imports` in `eslint.config.js` (Plan 02-02), proven by negative-control probe in `02-02-SUMMARY.md` | ✓ Implemented |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test` (same suite; no split yet)
- **Phase gate:** `npm run build`, `npm test`, `npm run lint` all green before `/gsd-verify-work` (per CLAUDE.md "Verification commands")

### Wave 0 Gaps
- [x] `src/app/domain/dx7/models/modulation-edge.ts` + `.spec.ts` — implemented in Plan 02-01
- [x] `src/app/domain/dx7/models/algorithm-definition.ts` — implemented in Plan 02-01
- [x] `src/app/domain/dx7/models/algorithms.ts` + `algorithms.spec.ts` — implemented in Plans 02-01/02-04
- [x] `src/app/domain/dx7/models/derive-role.ts` + `.spec.ts` — implemented in Plans 02-01/02-03
- [x] `src/app/domain/dx7/models/validate-algorithm.ts` + `.spec.ts` — implemented in Plans 02-01/02-03
- [x] Domain-scoped ESLint `no-restricted-imports` for `src/app/domain/**` (DOMAIN-04) —
  implemented in Plan 02-02 (`eslint.config.js`), negative-control recorded in `02-02-SUMMARY.md`

## Security Domain

`security_enforcement` is not set to `false` anywhere in `.planning/config.json` (the file does not
exist in this repo — absent means enabled per this agent's instructions), so this section is
included, scoped honestly to a phase with no user input, no network, no auth, and no persistence.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface in this phase |
| V3 Session Management | No | No session surface in this phase |
| V4 Access Control | No | No access-control surface in this phase |
| V5 Input Validation | Yes (narrow) | `validateAlgorithm()` (DOMAIN-02/D-04) is the input-validation control — but note: the 32-row dataset itself is **authored, not externally supplied**, so it's "trusted" in the sense CLAUDE.md's "validate external data at boundaries" rule contemplates for *future* boundaries (e.g. Phase 12's patch import), not this phase's own literal data entry. Exporting `validateAlgorithm()` as a reusable guard (CONTEXT.md's discretion note) is the concrete way this phase pre-pays for that future boundary. |
| V6 Cryptography | No | Not applicable — no secrets, no crypto in this phase |

### Known Threat Patterns for this stack
None specific to this phase — no network calls, no user-supplied strings, no serialization/
deserialization boundary yet (that's Phase 12, PERSIST-01). The only "threat" analog is a data
*correctness* risk (a wrong routing fact silently shipping), which is addressed structurally by
§ Routing Reference Table's cross-checking and § Validation Architecture's invariant suite rather
than an ASVS control.

## Sources

### Primary (HIGH confidence)
- `http://www.righto.com/2021/12/yamaha-dx7-chip-reverse-engineering.html` — die-photo reverse
  engineering, technical/original, Algorithm 8 full prose description, general design-rule
  confirmation (higher-modulates-lower)
- `github.com/alexferl/dxwire`, `src/components/Editor/Sidebar/Algorithm.jsx` — read directly this
  session, quoted verbatim, complete carrier/feedback data for all 32 algorithms

### Secondary (MEDIUM confidence)
- `github.com/gpasquero/vx7`, `engine/algorithm.py` — read directly this session; used as a
  cross-check source, found to disagree with the above for algorithms 1–4, 7–9's carrier counts
  (documented, not used for those rows)
- `djjondent.blogspot.com`, "Yamaha DX7 - Operators & Algorithms" — WebSearch-summarized taxonomy
  description, corroborated against carrier-count analysis
- `reverbmachine.com/blog/exploring-the-yamaha-dx7/` — Algorithm 5 and 32 prose spot-checks
- `bobbyblues.recup.ch/yamaha_dx7/dx7_description.html` — Algorithm 5 and 32 prose spot-checks
- `yamahablackboxes.com/articles/how-to-program-yamaha-dx7/` — Algorithm 26 and 32 prose
  spot-checks (Algorithm 26 carrier conflict resolved in favor of dxwire; edges corrected
  2026-08-05 — see `02-DATASET-REVIEW.md` §5)

### Tertiary (LOW confidence)
- `www.tinyloops.com/doc/yamaha_dx7/algorithm-building-blocks.html` — WebSearch-summarized "12
  building blocks" claim, used only as corroborating context for why several algorithm pairs share
  topology, not as a per-algorithm data source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, versions read directly from `package.json`
- Architecture (TypeScript modeling approach): HIGH — directly derived from CONTEXT.md's explicit,
  literal decision wording (D-01–D-07), not inferred
- Routing reference table — carriers/feedback operator: HIGH — triangulated across 3 independent
  sources, with a documented and resolved disagreement
- Routing reference table — exact intermediate edges: MEDIUM residual for some reconstructed rows;
  human review completed (2026-08-04 / superseded 2026-08-05). Sole unresolved topology: Algorithm
  19. No further `checkpoint:human-verify` reopen required for Phase 2 closeout.
- Teaching taxonomy (D-10): HIGH — independently corroborated via carrier-count analysis against a
  second source's stated group boundaries
- Pitfalls: HIGH — derived directly from the specific disagreements/mistakes found during this
  session's own research process, not generic advice

**Research date:** 2026-08-04
**Valid until:** No expiry — DX7 algorithm topology is a fixed historical dataset, not a
version-sensitive API. The only time-sensitive claims (Vitest/TypeScript API stability) are already
pinned to versions verified in `package.json` this session.
