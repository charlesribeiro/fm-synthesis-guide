# Phase 11: Curriculum across all 32 algorithms - Research

**Researched:** 2026-08-23
**Domain:** Content-generation-at-scale over an existing canonical dataset (DX7-style algorithm
routing) and existing Phase 6 lesson/UI code. No new library, framework, or external integration.
**Confidence:** HIGH (every claim below is read directly from source files in this repo, this
session, not from training knowledge or web search)

## Summary

Phase 11 adds 30 rows to an already-proven `LessonDefinition` shape (`LESSONS`/`LESSON_IDS` in
`src/app/domain/dx7/lessons/`), extends the `/learn` index to a 4-group, 32-card view with
aggregate progress counts, and leaves `LessonProgress` untouched. Every fact the 30 new lessons
need — carrier/modulator roles, feedback operator, chain depth — is already derivable from the
existing `ALGORITHMS` dataset (`src/app/domain/dx7/models/algorithms.ts`) via `deriveCarriers`/
`getFeedbackOperator` (`derive-role.ts`). No new domain types are needed; this phase is entirely
about (1) writing one shared builder function that folds over that existing structural data to
produce 30 `InstrumentPatch` values, (2) writing 30 lesson prose rows that follow the established
paragraph/objective/tryThis templates, and (3) adding a grouping + aggregate-count view over the
existing `/learn` index.

The single most important finding for planning: **the canonical dataset contains several clusters
of algorithms that are topologically 100% identical** (same edges AND same feedback operator) —
most severely Algorithm 1 / 13 / 14 (three-way identical) and Algorithm 24 / 25 / 31 (three-way
identical, and Algorithm 31's own dataset `name` field already calls this "approaching pure
additive"). A purely structure-driven builder function (D-04) will generate **byte-identical**
`startingPatch` data for every member of a cluster, which the planner must explicitly reconcile
with D-10's "must call out that specific algorithm's concrete distinguishing feature" requirement.
The dataset's own `name` field already handles this by documenting the duplication honestly rather
than inventing a false distinction — the plan should follow that same precedent for lesson prose.

**Primary recommendation:** Write one shared builder function (in `lessons.ts`, alongside the
existing `buildAlgorithm32StartingPatch`/`buildAlgorithm1StartingPatch`) that takes an
`AlgorithmDefinition` and returns an `InstrumentPatch`, driven only by `deriveCarriers`,
`getFeedbackOperator`, and a per-operator hop-distance-from-output computed from `algorithm.edges`.
Do not attempt per-algorithm structural novelty where the dataset itself declares none — three
duplicate clusters exist and the lesson prose should say so, matching the dataset's own honesty
convention.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Preset/patch generation (30 `startingPatch` values) | Domain (pure TS, no Angular) | — | Must be independently unit-testable per CLAUDE.md ("keep domain logic independent of Angular"); mirrors existing `buildAlgorithm32StartingPatch`/`buildAlgorithm1StartingPatch` |
| Lesson content data (`LESSONS` rows) | Domain | — | `LessonDefinition` is already a pure-data interface with zero Angular imports |
| Lesson grouping by `teachingTags` (D-13) | Domain (pure function) | Frontend Server/Component (consumes it via `computed()`) | Grouping is a pure transform of existing data (`LESSONS` + `ALGORITHMS.teachingTags`), not template layout — CLAUDE.md's "algorithm topology is data, never hardcoded template layout" applies to grouping too |
| Aggregate progress counts (D-14) | Component facade (`computed()` in `Learn`) | Domain (a plain count-over-set helper, optional) | Reads a live Angular `Signal` (`LessonProgress.completed`), so the reactive wiring itself must live in the component/facade layer; the pure "count how many ids in a set" arithmetic can be a plain function either domain-side or component-local |
| `/learn` index rendering (group headers + counts) | Component (`Learn`) | — | Presentation of the above view-model |
| Lesson completion tracking | State facade (`LessonProgress`) | — | Already exists, unchanged (D-15) |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CURR-01 | Every algorithm has a concise lesson, experiment, and original preset | This document's structural survey (below) gives every fact the builder function and lesson prose need per algorithm; the duplicate-cluster finding directly affects how "concise lesson... not rote memorization" (Phase 11 success criterion 1) is satisfied for structurally identical algorithms |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Lesson grouping & order**
- **D-01:** Curriculum structure reuses the dataset's existing four `teachingTags` groups verbatim
  (Additive Stacks 1-6, Tree/Branch 7-18, Rooting 19-25, Parallel 26-32) — no new taxonomy invented
  for this phase.
- **D-02:** The four groups are reordered so the curriculum opens with the Parallel group (26-32,
  containing Algorithm 32) rather than `teachingTags`' own additive-stacks-first ordering, so the
  curriculum sequence matches the two lessons already built (Algorithm 32 is the existing opener,
  Algorithm 1's group — Additive Stacks — comes second).
- **D-03:** Within each reordered group, Algorithm 32 and Algorithm 1 specifically stay first in
  their respective groups (not just lowest-id-in-group by coincidence) — pinned openers, matching
  the two lessons already built. All other within-group ordering is ascending algorithm id.

**Original preset depth (the 30 new `startingPatch` values)**
- **D-04:** The 30 remaining `startingPatch` values are generated by one shared, documented builder
  function driven by each algorithm's own graph structure (`deriveCarriers`, edges, feedback
  operator) — not 30 individually hand-tuned patches like Algorithm 32/1.
- **D-05:** Every derived modulator gets one single shared envelope shape (structurally the same
  role `ALGORITHM_1_MODULATOR_ENVELOPE` plays today, reused across all 30 algorithms rather than a
  family of shapes); every derived carrier keeps `DEFAULT_ENVELOPE`. No per-algorithm or
  per-chain-depth envelope variation.
- **D-06:** Output level per operator is computed by a fixed structural rule (role + hop-distance
  from output, mirroring the descending-by-hop pattern Algorithm 1's chain already uses) — no
  hand-picked numeric levels, no per-algorithm listening/tuning pass.
- **D-07:** Ratio defaults to 1 on every operator (routing/structure carries the lesson, matching
  Algorithm 1), **except** algorithms whose teaching point is independent-partials-summing in the
  Algorithm-32 sense, which get distinct integer ratios the same way Algorithm 32 does. —
  **Reversibility:** reversible — this is a data-generation rule inside a builder function, not a
  contract; changing which algorithms count as "Algorithm-32-like" only touches that function.
- **D-08:** Feedback level follows one fixed rule: every algorithm whose canonical dataset declares
  a feedback self-loop gets the same fixed mid-scale non-zero value (e.g. `3`, matching Algorithm
  1) so the loop is reliably audible; algorithms with no feedback edge get `0`. No per-algorithm
  feedback tuning.

**Per-lesson content depth (the 30 new lessons' `explanation`/`objective`/`tryThis`)**
- **D-09:** Each lesson's `explanation` follows the same paragraph structure Algorithm 32/1 use
  (what the routing does → what that implies for independence/coupling → the specific
  timbral/teaching payoff), written to 2-3 paragraphs — consistent structure, more concise prose per
  lesson than the two hand-authored originals (which ran 3 rich paragraphs each).
- **D-10:** Lessons within the same `teachingTags` group may share substantial explanatory template
  and language (family resemblance is expected and honest for structurally similar algorithms), but
  each lesson's explanation must call out that specific algorithm's concrete distinguishing feature
  (chain length, branch count, feedback operator position, independent-path count) — not literal
  copy-paste, not a strained hunt for false distinctions either.
- **D-11:** `tryThis` (targetOperator/targetParam/direction) is chosen by a systematic rule derived
  from the algorithm's own graph structure (e.g. the deepest-chain modulator's ratio, the feedback
  operator, or an independent-path carrier's output level — whichever best isolates that
  algorithm's distinguishing structural feature) — same "derived from the graph" discipline as the
  preset-generation rules above, not hand-picked per algorithm.
- **D-12:** Every lesson's `objective` follows the fixed "Hear X, then prove it by Y" grammatical
  pattern Algorithm 32/1 already use — consistent and scannable across all 32 cards on the `/learn`
  index.

**Progress aggregation (`/learn` index at 32 lessons)**
- **D-13:** The `/learn` index renders the four `teachingTags` groups as labelled sections in
  curriculum order (per D-01/D-02), each containing its group's lesson cards — not a flat
  32-item list — so the "grouped by recurring structure" success criterion is visible in the UI,
  not just in internal data ordering.
- **D-14:** The index adds an aggregate progress readout: an overall "X/32 complete" count plus a
  per-group "Y/N complete" count for each of the four sections. Both are computed selectors derived
  from `LessonProgress.completed` (the existing `ReadonlySet<LessonId>`) — no new state, no new
  facade method beyond a read-through count.
- **D-15:** `LessonProgress` stays session-only (in-memory, resets on reload) exactly as it is
  today — no persistence work pulled forward into this phase. `PERSIST-01`/Phase 12 remains the
  owner of durability for progress (and everything else that needs it).
- **D-16:** Cards never reorder based on completion state — fixed curriculum order (per D-01/D-02/
  D-03) always, regardless of what's completed. Completion is communicated only via each card's
  existing complete/not-started badge plus the new D-14 counts, never by moving cards around.

### Claude's Discretion
- Which specific algorithms qualify as "Algorithm-32-like" under D-07's ratio exception (independent
  partials summing) — Claude judges this from each algorithm's derived carrier/modulator structure,
  not from a hand-maintained list. **This document provides a concrete candidate list with
  reasoning below** (see "Algorithm-32-like ratio exception — candidate analysis").
- The exact wording of each lesson's title, explanation paragraphs, and `tryThis`
  instruction/expectedEffect sentences, within the structural constraints of D-09 through D-12.
- The precise fixed mid-scale feedback numeric value under D-08 (Algorithm 1's precedent is `3`;
  Claude may reuse that value or pick another fixed value with equivalent reasoning, applied
  uniformly).
- Exact visual/markup treatment of the D-13 group headers and D-14 aggregate counts on `/learn`,
  within the existing card-list styling conventions.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Persistence (raised explicitly in the Progress
aggregation discussion) is confirmed as already-scoped to Phase 12 (PERSIST-01), not a new deferral.
</user_constraints>

## Project Constraints (from CLAUDE.md)

These directives govern every task in this phase's plan:

- Standalone Angular 22 components only; zoneless; strict TypeScript/templates.
- Prefer signal inputs/outputs, `signal`, `computed`, read-only facades; `effect()` only for
  imperative external-state sync (the narrow `LessonDetail` exception already exists and is
  untouched by this phase).
- Domain/graph/frequency/envelope/patch/DSP logic (including the new builder function and any
  grouping helper) must have **no Angular dependency** and must be independently unit-tested — a
  domain-purity ESLint gate already enforces `no-restricted-imports` on `src/app/domain/**/*.ts`
  (confirmed in `STATE.md`'s Phase 02 decision log), so the new builder function/grouping helper
  must live under `src/app/domain/...` and must not import from `@angular/*`.
- All algorithm topology is data, never hardcoded template layout — applies directly to D-13's
  grouping (must be a data transform, not hardcoded group boundaries in `learn.html`).
- One canonical algorithm dataset; no duplicated routing knowledge — the builder function and
  lesson prose must read `ALGORITHMS`/`deriveCarriers`/`getFeedbackOperator`, never restate edges
  or roles as literals.
- Immutable readonly models; validate external data at boundaries — every generated patch must be
  frozen at every level (object, `operators` record, each operator's parameters, matching the
  existing `buildAlgorithm32StartingPatch`/`buildAlgorithm1StartingPatch` convention).
- Add invariant tests whenever an algorithm-data bug is fixed — the existing `lessons.spec.ts`
  already iterates `LESSON_IDS`/`LESSONS` via `describe.each`, so all 30 new rows automatically
  inherit that invariant suite with zero spec changes (confirmed, see Testing section below).
- Vitest is mandatory; new domain behavior requires tests; a bug fix needs a regression test; keep
  fixtures small and named by pedagogical intent.
- No copyrighted patch ROMs, commercial banks, manual scans, copied diagrams — all 30 new presets
  and lesson prose must be original, generated from this project's own structural data.

## Standard Stack

No new libraries. This phase is 100% additive within the existing stack:

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@angular/core` | `^22.1.0` [VERIFIED: package.json] | Existing framework | Already the project's stack |
| `vitest` | `^4.0.8` [VERIFIED: package.json] | Existing test runner | Already the project's stack |
| `typescript` | `~6.0.2` [VERIFIED: package.json] | Existing language | Already the project's stack |

**Installation:** None required — no `npm install` for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages; all work is new TypeScript files
and edits to existing domain/state/component files within the existing dependency set. The
Package Legitimacy Gate is skipped per its own trigger condition ("every phase that installs
external packages") — no packages are installed.

## Architecture Patterns

### System Architecture Diagram

```
ALGORITHMS (canonical dataset, algorithms.ts)
        │
        │  algorithm.edges, algorithm.teachingTags
        ▼
deriveCarriers() / getFeedbackOperator()  (derive-role.ts — pure functions, no Angular)
        │
        │  carrier set, feedback operator id
        ▼
buildLessonStartingPatch(algorithm)  ◄── NEW shared builder function (lessons.ts)
        │  reads: role (carrier/modulator), hop-distance-from-output, feedback presence
        │  applies: D-05 envelope rule, D-06 output-level rule, D-07 ratio rule, D-08 feedback rule
        ▼
InstrumentPatch  (frozen at every level)
        │
        ▼
LessonDefinition row  { id, algorithmId, title, objective, explanation[], startingPatch, tryThis }
        │
        │  one row per LessonId, 32 total, in curriculum order (D-01/D-02/D-03)
        ▼
LESSONS (frozen array) ──► LESSONS_BY_ID (Map) ──► getLesson(id)
        │                                                  │
        │  read by                                         │  read by
        ▼                                                  ▼
groupLessonsByTeachingTag(LESSONS)  ◄── NEW pure grouping   LessonDetail (unchanged — per-lesson
  function, curriculum group order                          route, already applies startingPatch
  (D-13)                                                     via InstrumentState, unaffected by
        │                                                    this phase's decisions)
        ▼
Learn component (computed() view-model: grouped sections +
  D-14 aggregate counts, reading LessonProgress.completed
  live)
        │
        ▼
learn.html (renders group headers + cards; no hardcoded
  group boundaries — D-13/CLAUDE.md)
```

A learner's primary path: `/learn` → sees 4 grouped sections with aggregate counts (D-13/D-14) →
clicks a card → `/learn/:lessonId` (`LessonDetail`, unchanged) → plays the derived `startingPatch`
→ `tryThis` completion check (unchanged, `try-this.ts`) → `LessonProgress.markComplete` → back on
`/learn`, that card's badge and the aggregate counts update live.

### Recommended Project Structure

No new directories. All new code is additive within existing files/directories:

```
src/app/domain/dx7/
├── lessons/
│   ├── lesson-definition.ts   # LessonId union grows from 2 to 32 members; LESSON_IDS grows to 32
│   ├── lessons.ts             # +1 shared builder function, +30 LESSONS rows
│   ├── lesson-grouping.ts     # NEW FILE (suggested) — pure groupLessonsByTeachingTag() (D-13)
│   └── try-this.ts            # unchanged — already generic over TryThisParam
├── models/
│   ├── algorithms.ts          # unchanged — read-only source of structural truth
│   └── derive-role.ts         # unchanged — read-only source of role/feedback truth
src/app/state/
└── lesson-progress.ts         # unchanged (D-15)
src/app/features/learn/
├── learn.ts                   # gains grouped + aggregate-count computed() signals
└── learn.html                 # gains group-header markup, no hardcoded group boundaries
```

### Pattern 1: Shared structural builder function (D-04 through D-08)

**What:** One function, e.g. `buildStructuralStartingPatch(algorithm: AlgorithmDefinition):
InstrumentPatch`, that never receives per-algorithm hand-picked constants — only the algorithm
itself, plus a fixed set of module-level constants (the shared modulator envelope, the shared
feedback level, the output-level step size, the "Algorithm-32-like" predicate).

**When to use:** For all 30 new lesson rows. Algorithm 1 and Algorithm 32 keep their existing
hand-authored builder functions untouched (D-04 explicitly scopes the shared builder to "the 30
remaining" patches).

**Example (shape, not exact values — mirrors the existing hand-authored functions' construction
style):**
```typescript
// Source: this repo, src/app/domain/dx7/lessons/lessons.ts (existing pattern, 06-02-PLAN.md)
function buildStructuralStartingPatch(algorithm: AlgorithmDefinition): InstrumentPatch {
  const carriers = deriveCarriers(algorithm);
  const feedbackOperator = getFeedbackOperator(algorithm); // null is unreachable in this
                                                            // dataset today — every one of the
                                                            // 32 rows declares exactly one
                                                            // self-loop (verified, see Pitfall
                                                            // "D-08's zero-feedback branch is
                                                            // unreachable" below)
  const isAlgorithm32Like = /* structural predicate, see candidate analysis below */;

  const operatorEntries = OPERATOR_IDS.map((operatorId) => {
    const role = carriers.includes(operatorId) ? 'carrier' : 'modulator';
    const hop = hopDistanceFromOutput(algorithm, operatorId); // 0 for every carrier
    const parameters: OperatorParameters = Object.freeze({
      ...DEFAULT_OPERATOR_PARAMETERS,
      ratio: isAlgorithm32Like ? operatorId : 1,
      outputLevel: computeOutputLevel(role, hop),
      envelope: role === 'carrier' ? DEFAULT_ENVELOPE : SHARED_MODULATOR_ENVELOPE,
    });
    return [operatorId, parameters] as const;
  });
  const operators = Object.freeze(Object.fromEntries(operatorEntries)) as OperatorParameterSet;

  return Object.freeze({
    algorithmId: algorithm.id,
    operators,
    feedback: feedbackOperator !== null ? SHARED_FEEDBACK_LEVEL : 0,
  });
}
```

### Pattern 2: Hop-distance-from-output computation (needed for D-06)

**What:** A pure helper computing, for each operator, how many modulation hops separate it from
the output (0 for carriers, 1+ for modulators, following the outgoing edge chain).

**When to use:** Feeds D-06's output-level rule. No such helper exists yet in `derive-role.ts` —
this phase needs to add one (or inline the BFS/recursion inside the builder function).

**Structural fact confirmed this session:** every multi-target fan-out in the dataset (Algorithm
19's operator 5 → {2,3,4}; Algorithm 22's operator 6 → {3,4,5}) sends **directly to carriers only**
(all targets are hop-0), so there is no fan-out case in the current 32-row dataset where a single
operator's targets sit at different hop-depths — hop-distance is unambiguous everywhere in this
dataset. [VERIFIED: src/app/domain/dx7/models/algorithms.ts:293-307 (Algorithm 19), :329-340
(Algorithm 22) — read this session, see full structural survey below.]

### Pattern 3: Pure grouping function for D-13

**What:** `groupLessonsByTeachingTag(lessons: readonly LessonDefinition[], algorithms: readonly
AlgorithmDefinition[]): readonly LessonGroup[]` — looks up each lesson's algorithm by
`lesson.algorithmId`, reads its `teachingTags[0]`, buckets into the 4 known groups, and returns
them in the D-02 curriculum order (parallel, additive-stacks, tree-branch, rooting), with each
group's lessons in D-03's pinned-opener-then-ascending order (which — if `LESSON_IDS` is already
built in that exact order per the ordering derived below — collapses to "iterate `LESSONS` once,
bucket by group in a single pass," no re-sorting needed).

**When to use:** Consumed by `Learn`'s `computed()` view-model for D-13's grouped rendering.

### Anti-Patterns to Avoid

- **Hardcoding group boundaries in `learn.html`** (e.g., `@for (lesson of lessons.slice(0,7))`) —
  violates CLAUDE.md's "algorithm topology is data, never hardcoded template layout"; use the
  grouping function's output instead.
- **Re-deriving carrier/feedback roles from a hand-typed per-algorithm list** — every fact must
  come from `deriveCarriers`/`getFeedbackOperator` called on the actual `ALGORITHMS` row, never
  restated as a literal (mirrors the existing Algorithm 1 lesson's own documented discipline).
  **Do not read the `name` field's prose as a source of truth for roles** — see Pitfall 3 below.
- **Inventing a false structural distinction for the three duplicate clusters** (Algorithm
  1/13/14; Algorithm 3/4/11; Algorithm 24/25/31 — see the Duplicate-Topology Clusters section) —
  D-10 explicitly permits family resemblance and explicitly forbids "a strained hunt for false
  distinctions."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Carrier/modulator role per operator | A per-algorithm hardcoded role map | `deriveCarriers`/`getOperatorRole` (`derive-role.ts`) | Already exists, already the single source of truth (DOMAIN-03), used by Algorithm 1's lesson today |
| Feedback operator identification | Scanning `edges` inline in the builder | `getFeedbackOperator` (`derive-role.ts`) | Already exists, returns `null` when absent (never reachable in this dataset, but the contract exists) |
| Coarse-ratio legality / try-this ladder | A new bounds array | `COARSE_RATIOS` (`operator-parameters.ts`), `tryThisParamValues` (`try-this.ts`) | Already generic over `TryThisParam`; used unchanged by the two existing lessons |
| Try-this "moved in direction" check | A new comparator | `hasMovedTowardTarget` (`try-this.ts`) | Already generic, already tested, unchanged by this phase |
| Lesson lookup / not-found handling | A new Map or switch | `LESSONS_BY_ID`/`getLesson` (`lessons.ts`) | Already exists; 30 new rows plug into the same array |

**Key insight:** Every mechanism this phase needs already exists in the codebase in a form generic
enough to reuse without modification. The only genuinely new code is (1) the shared structural
builder function, (2) a hop-distance helper, (3) the "Algorithm-32-like" predicate, and (4) the
grouping function for `/learn`. Everything else is data (30 `LESSONS` rows, 30 `LessonId` members).

## Structural Survey of the 30 Algorithms Needing New Lessons

This is the concrete data the builder function (D-04–D-08, D-11) and lesson prose (D-09, D-10)
fold over. All facts below are read directly from
`src/app/domain/dx7/models/algorithms.ts` (full file read this session; algorithm entries begin at
line 76 and run to line 438) and cross-checked against `derive-role.ts`'s derivation rules (read
this session, lines 1–55). Quoted edge lists below are copied verbatim from the file.

**Legend:** *Isolated carrier* = a carrier with no incoming edge at all (a bare, unmodulated
partial — structurally identical to one of Algorithm 32's six operators). *Chain-terminal carrier*
= a carrier that receives an incoming edge from a modulator chain. *Hop* = hop-distance from
output (0 for every carrier; 1 + hop of the operator it feeds, for a modulator). *FB* = feedback
operator (every one of the 32 rows declares exactly one self-loop — see Pitfall below).

### Additive Stacks group (1–6) — Algorithm 1 already built

| Algo | Edges (excl. fb) [VERIFIED: algorithms.ts] | Carriers | Isolated carriers | FB op | Hops (non-carrier) | Notes |
|------|-------|----------|---|----|---|-------|
| 2 | `6→5,5→4,4→3,2→1` | 1,3 | none | 2 | 4=1,5=2,6=3 (chain); 2=1 (pair) | Same shape as Algo 1, **fb relocated** to the pair's modulator (op2) instead of the chain-top (op6) — identical edges to Algo 1/13/14 cluster, differs only in fb operator |
| 3 | `6→5,5→4,3→2,2→1` | 1,4 | none | 6 | chain A: 5=1,6=2; chain B: 2=1,3=2 | Two symmetric 3-op chains (hop-depth 2 each), no short pair |
| 4 | `6→5,5→4,3→2,2→1` | 1,4 | none | 6 | identical to Algo 3 | **Topologically 100% identical to Algo 3** (same edges, same fb) — dataset's own `name` field calls this a "probable near-duplicate pair" |
| 5 | `6→5,4→3,2→1` | 1,3,5 | none (all 3 carriers are chain-terminal, fed by their pair's modulator) | 6 | 2=1,4=1,6=1 (all three modulators hop1, uniform depth) | Three independent 2-op FM pairs — every operator participates in modulation, none isolated |
| 6 | `6→5,4→3,2→1` | 1,3,5 | none | 6 | identical to Algo 5 | **Topologically 100% identical to Algo 5** — another dataset-flagged duplicate pair |

### Tree/Branch group (7–18)

| Algo | Edges (excl. fb) | Carriers | Isolated carriers | FB op | Hops (non-carrier) | Notes |
|------|-------|----------|---|----|---|-------|
| 7 | `6→5,5→4,4→2,2→1` | 1,3 | **3** | 6 | 2=1,4=2,5=3,6=4 | Five-op chain (deepest chain-only depth in the whole 30, hop4) ending at op1, **plus one isolated carrier (op3)** |
| 8 | `6→5,5→3,4→3,2→1` | 1,3 | none | **4** | 2=1; 5=1,4=1 (fan-in to carrier 3); 6=2 | Fan-in convergence (5 and 4 both feed carrier 3 directly, both hop1). **FB is on op4, a hop-1 modulator directly feeding a carrier — NOT the deepest operator (op6, hop2)** |
| 9 | `6→5,5→3,4→3,2→1` | 1,3 | none | 2 | same shape as Algo 8 | Same fan-in shape as Algo 8, **fb relocated** to the short pair's modulator (op2) |
| 10 | `6→5,5→4,2→1,3→2` | 1,4 | none | **3** | chain A: 5=1,6=2; chain B: 2=1,3=2 | Same two-3-op-chain shape as Algo 3/4/11, but **fb on chain B's top (op3)** rather than op6 |
| 11 | `6→5,5→4,2→1,3→2` | 1,4 | none | 6 | identical to Algo 3/4/10 | **Topologically 100% identical to Algo 3 and Algo 4** (dataset's own comment: "Topologically identical to Algorithms 3 and 4... once repaired") |
| 12 | `6→5,5→4,4→3,2→1` | 1,3 | none | 2 | identical to Algo 2 | **Topologically 100% identical to Algo 2** (dataset comment: "topologically identical to Algorithm 2") |
| 13 | `6→5,5→4,4→3,2→1` | 1,3 | none | 6 | identical to Algo 1 | **Topologically 100% identical to Algorithm 1** (dataset comment: "topologically identical to Algorithm 1") — see Duplicate-Cluster section |
| 14 | `6→5,5→4,4→3,2→1` | 1,3 | none | 6 | identical to Algo 1/13 | **Topologically 100% identical to Algorithm 1 AND Algorithm 13** (dataset comment: "topologically identical to Algorithms 1 and 13") — three-way identical cluster |
| 15 | `6→5,5→2,4→2,2→1` | 1,3 | **1** (op3, fully unconnected) | 2 | 2=1(feeds carrier1); 5=2,4=2(fan-in feeding op2, which is itself a **modulator**, not a carrier — see Pitfall 3); 6=3 | **FB (op2) is not the deepest operator (op6, hop3)**. The dataset's own `name` prose calls op2 "carrier 2" loosely even though `deriveCarriers` derives it as a modulator — trust the derivation, not the prose (Pitfall 3) |
| 16 | `6→5,5→1,4→3,3→1,2→1` | 1 only | none | 6 | chain 6→5→1: 5=1,6=2; chain 4→3→1: 3=1,4=2; direct 2→1: 2=1 | Three chains converge on a **single** carrier (op1) — the opposite extreme from Algorithm 32 (max convergence vs. max independence); no additive summing at all |
| 17 | `6→5,5→1,4→3,3→1,2→1` | 1 only | none | 2 | identical shape to Algo 16 | Same triple-convergence shape, **fb relocated** to the shortest chain's modulator (op2, hop1) instead of the longest chain's top (op6, hop2) |
| 18 | `6→5,5→4,4→1,2→1,3→1` | 1 only | none | **3** | chain 6→5→4→1: 4=1,5=2,6=3; direct 2→1: 2=1; direct 3→1: 3=1 | Triple convergence again (chain + two direct modulators into op1), **fb on op3, a hop-1 direct modulator, not the chain-top (op6, hop3)** |

### Rooting group (19–25)

| Algo | Edges (excl. fb) | Carriers | Isolated carriers | FB op | Hops (non-carrier) | Notes |
|------|-------|----------|---|----|---|-------|
| 19 | `6→5,5→4,5→3,5→2` | 1,2,3,4 | **1** (op1) | 6 | 5=1 (fans to 3 carriers, all hop0 — unambiguous); 6=2 | **`reviewStatus: 'unresolved'`** [VERIFIED: algorithms.ts:293-307] — see Pitfall "Algorithm 19 is unresolved" below. Fan-out of op5 to three simultaneous carriers |
| 20 | `5→4,3→2,6→5` | 1,2,4 | **1** (op1) | 3 | chain 6→5→4: 5=1,6=2; pair 3→2: 3=1 (carries fb) | Chain + pair + 1 isolated carrier; fb on the pair (not the deeper chain) |
| 21 | `6→5,3→2` | 1,2,4,5 | **2** (op1, op4) | 3 | 6=1(feeds5); 3=1(feeds2, fb) | Two independent 2-op pairs + 2 isolated carriers — **strong Algorithm-32-like candidate** (4/6 operators are carriers, only 2 shallow hop-1 modulators) |
| 22 | `6→5,6→4,6→3,2→1` | 1,3,4,5 | none (all 4 carriers are fed) | 6 | 6=1 (fans to 3 carriers directly, unambiguous); 2=1 | Single operator (op6) fans out to 3 simultaneous carriers, plus a separate pair — shallow (all modulation hop1) but **no isolated carriers**, so weaker Algorithm-32-like case than 21/23/24/25/29/31 |
| 23 | `6→5,3→1` | 1,2,4,5 | **2** (op2, op4) | 6 | 6=1(feeds5,fb); 3=1(feeds1) | Same shape as Algo 21 (2 isolated + 2 shallow modulators) — **strong Algorithm-32-like candidate** |
| 24 | `6→5` | 1,2,3,4,5 | **4** (op1,2,3,4) | 6 | 6=1 (only modulator) | **Strongest Algorithm-32-like candidate**: 5/6 operators are carriers, 4/6 fully isolated, only one 2-op FM pair — nearly Algorithm 32 plus one small pair |
| 25 | `6→5` | 1,2,3,4,5 | **4** | 6 | identical to Algo 24 | **Topologically 100% identical to Algorithm 24** (dataset comment: "topologically identical to Algorithm 24 once repaired") |

### Parallel group (26–31) — Algorithm 32 already built

| Algo | Edges (excl. fb) | Carriers | Isolated carriers | FB op | Hops (non-carrier) | Notes |
|------|-------|----------|---|----|---|-------|
| 26 | `6→4,5→4,3→2` | 1,2,4 | **1** (op1) | 6 | 6=1,5=1 (fan-in to carrier4, both hop1); 3=1(feeds2) | Fan-in convergence (like Algo 8/9) on carrier 4; fb on one of the two converging modulators |
| 27 | `6→4,5→4,3→2` | 1,2,4 | 1 (op1) | **3** | identical shape to Algo 26 | Same non-feedback shape as Algo 26 (dataset comment), **fb relocated** to op3 (feeds carrier2) instead of op6 (fan-in to carrier4) |
| 28 | `5→4,4→3,2→1` | 1,3,6 | **1** (op6) | 5 | chain 5→4→3: 4=1,5=2(fb); pair 2→1: 2=1 | Same chain+pair shape as Algorithm 1, plus **one extra isolated carrier (op6)** not present in Algorithm 1; fb correctly on chain-top (consistent with the "usual" pattern, unlike several Tree/Branch/Rooting rows above) |
| 29 | `6→5,4→3` | 1,2,3,5 | **2** (op1,op2) | 6 | 6=1(feeds5,fb); 4=1(feeds3) | Same shape as Algo 21/23 — **strong Algorithm-32-like candidate** |
| 30 | `5→4,4→3` | 1,2,3,6 | **3** (op1,op2,op6) | 5 | 4=1(feeds3); 5=2(feeds4,fb) | 4/6 carriers, 3 isolated, but has a genuine hop-2-deep chain — **borderline** Algorithm-32-like (see analysis below) |
| 31 | `6→5` | 1,2,3,4,5 | **4** | 6 | 6=1 | **Topologically 100% identical to Algorithm 24 and Algorithm 25** — three-way identical cluster. Dataset's own `name` field: "minimal modulation, **approaching pure additive**" — the strongest textual confirmation of Algorithm-32-like character anywhere in the dataset |

## Duplicate-Topology Clusters (critical planning input)

A structure-only builder function (D-04) cannot distinguish algorithms with identical edges *and*
identical feedback operator — it will produce byte-identical `startingPatch` output for every
member of a cluster. Confirmed clusters this session:

| Cluster | Edges (identical within cluster) | FB (identical within cluster) | Distinguishing feature available? |
|---------|-----------------------------------|-------------------------------|-----------------------------------|
| Algorithm 1 (existing), 13, 14 | `6→5,5→4,4→3,2→1` | 6 | **None** — three-way fully identical |
| Algorithm 3, 4, 11 | `6→5,5→4,3→2,2→1` | 6 | **None** — three-way fully identical |
| Algorithm 24, 25, 31 | `6→5` | 6 | **None** — three-way fully identical |
| Algorithm 2, 12 | `6→5,5→4,4→3,2→1` | 2 | None (identical to each other; differ from the Algo 1/13/14 cluster only by fb operator) |
| Algorithm 5, 6 | `6→5,4→3,2→1` | 6 | **None** — pair fully identical |
| Algorithm 8, 9 | `6→5,5→3,4→3,2→1` | differs (4 vs 2) | Differ only by fb operator |
| Algorithm 16, 17 | `6→5,5→1,4→3,3→1,2→1` | differs (6 vs 2) | Differ only by fb operator |
| Algorithm 26, 27 | `6→4,5→4,3→2` | differs (6 vs 3) | Differ only by fb operator |
| Algorithm 3/4/11 vs. 10 | same edge *set* | 10 differs (fb=3) | Algo 10 differs from the 3/4/11 cluster only by fb operator |

**Planning implication:** D-10 requires each lesson to "call out that specific algorithm's concrete
distinguishing feature" but also explicitly permits "family resemblance" and forbids "a strained
hunt for false distinctions." For the three fully-identical clusters (1/13/14, 3/4/11, 24/25/31),
there is **no structural distinguishing feature to find** — the plan should have each of those
lessons' prose acknowledge the structural identity honestly (mirroring the dataset's own `name`
field convention, e.g. Algorithm 13's/14's descriptive names already say "topologically identical
to Algorithm 1"), rather than task-level acceptance criteria that implicitly assume every lesson
has a unique structural hook. For the feedback-relocated pairs (2/12 vs. 1/13/14; 8 vs. 9; 16 vs.
17; 26 vs. 27; 10 vs. 3/4/11), the one legitimate distinguishing feature is **which operator
carries the feedback** — the plan should make this the explicit D-11 `tryThis` hook for those
lessons (targeting the feedback operator itself, or contrasting it against the sibling algorithm).

## "Algorithm-32-like" Ratio Exception — Candidate Analysis (D-07)

Ranked by structural closeness to Algorithm 32 (all-carrier, zero modulation):

**Strong candidates (recommend distinct integer ratios):**
- **Algorithm 24, 25, 31** — identical triple; 5/6 operators are carriers, 4/6 fully isolated, only
  one 2-op pair. Algorithm 31's own dataset `name` field already says "approaching pure additive."
- **Algorithm 21, 23, 29** — 4/6 carriers, 2/6 fully isolated, remaining 2 modulators both hop-1
  (shallow, symmetric pairs feeding the other 2 carriers). Same shape repeated three times with
  different specific operator ids.

**Borderline (recommend ratio=1, i.e. NOT Algorithm-32-like) — flag for planner/discuss-phase confirmation:**
- **Algorithm 30** — 4/6 carriers, 3/6 isolated, but has a genuine hop-2-deep chain (5→4→3) — the
  teaching point here is arguably still "a chain plus loose partials," closer to a scaled-down
  Algorithm 1 than to Algorithm 32.
- **Algorithm 20, 26, 27** — only 1/6 isolated carrier; majority of operators are modulators or
  chain-terminal carriers; recommend ratio=1 (routing/chain structure carries the lesson, as with
  Algorithm 1).
- **Algorithm 22** — 4/6 carriers but **zero** isolated carriers (every carrier is fed by the
  fan-out operator) — every voice is still individually modulated, unlike Algorithm 32's totally
  unmodulated voices; recommend ratio=1 despite the high carrier count.

**Clearly NOT Algorithm-32-like (ratio=1, high confidence):** all of Additive Stacks 2–6, all of
Tree/Branch 7–18 (dominated by deep chains or full convergence), and Rooting 19 (chain-dominated,
also unresolved-status).

This candidate list is offered as scoping input for task-level acceptance criteria; final
selection remains Claude's Discretion per CONTEXT.md, but the planner should not leave this fully
open-ended — recommend locking in at minimum the "strong candidates" list (24, 25, 31, 21, 23, 29)
during planning or an early task, since it is unambiguous from the structural data, and treating
20/22/26/27/30 as ratio=1 by default.

## Common Pitfalls

### Pitfall 1: D-08's "no feedback edge → 0" branch is unreachable in the current dataset
**What goes wrong:** A task or test might be written expecting some algorithms to have
`feedback: 0` in their generated patch.
**Why it happens:** D-08 is phrased as a general rule ("algorithms with no feedback edge get 0"),
but every one of the 32 rows in `ALGORITHMS` declares exactly one feedback self-loop (confirmed by
reading the full file this session — every entry's `edges` array ends with a `{ from: N, to: N }`
self-loop and an inline `// feedback self-loop, D-01` comment, lines 76–438).
**How to avoid:** Write the builder function to still branch on `getFeedbackOperator(algorithm) ===
null` for correctness/future-proofing (mirrors the existing production code's defensive style —
see the 02-03 precedent in `STATE.md`: "D-04's 'mislabeled feedback edge' clause is unrepresentable,
not validated"), but do not require a test asserting `feedback === 0` for any of the current 30
rows — that branch is dead code against today's dataset, not a bug.
**Warning signs:** A task acceptance criterion phrased as "at least one algorithm has feedback 0"
would fail for the wrong reason (a correct implementation, an untestable claim about the dataset).

### Pitfall 2: Feedback operator is not reliably the "deepest" or "chain-top" operator
**What goes wrong:** A hop-distance-based rule might assume the feedback operator is always the
highest-hop modulator in its algorithm (true for Algorithm 1, where fb sits on op6 at hop3).
**Why it happens:** Several algorithms place feedback on a shallow, hop-1 modulator instead:
Algorithm 8 (fb=op4, hop1, not the hop2 op6); Algorithm 15 (fb=op2, hop1, not the hop3 op6);
Algorithm 17 (fb=op2, hop1, not the hop2 op6); Algorithm 18 (fb=op3, hop1, not the hop3 op6);
Algorithm 20 (fb=op3, hop1, on the pair not the deeper chain); Algorithm 21/23/26/29/30 (fb on one
of two symmetric hop-1 modulators, arbitrary which).
**How to avoid:** D-08's fixed-value rule already sidesteps this (feedback level is fixed
regardless of hop-depth) — but if D-11's `tryThis` selection rule uses "the feedback operator" as
one of its candidate hooks, do not assume it doubles as "the deepest-chain operator." Treat them as
two independent facts to read separately from `getFeedbackOperator` and the hop-distance helper.
**Warning signs:** A `tryThis` rule that silently conflates "feedback operator" with "deepest
modulator" will pick the wrong operator for roughly a third of the 30 new lessons.

### Pitfall 3: The dataset's free-text `name` field is not always role-accurate — trust `deriveCarriers`, not prose
**What goes wrong:** Algorithm 15's `name` field says "Two modulators (operators 5 and 4) both
feeding carrier 2, which itself feeds carrier 1" — but `deriveCarriers` derives operator 2 as a
**modulator** (it has an outgoing edge, `2→1`), not a carrier, because the `name` field was written
descriptively/pre-theoretically and uses "carrier" loosely for "the node two other modulators
converge on," not in `derive-role.ts`'s strict sense (a carrier has zero outgoing edges to another
operator). [VERIFIED: algorithms.ts:243-253 for the `name` text; derive-role.ts:23-31 for the
strict role rule — both read this session.]
**Why it happens:** The `name` field is documentation/prose, not structural data — `edges` is the
only structural source of truth (per `algorithm-definition.ts`'s own documented invariant: "No
stored operator-role/`carriers` field... role is always derived from `edges` on demand").
**How to avoid:** The builder function and lesson prose generation must call `deriveCarriers`/
`getOperatorRole` directly on the algorithm's `edges`, never parse or trust the `name` string for
role information.
**Warning signs:** Lesson prose that says "carrier N" where N is not actually in
`deriveCarriers(algorithm)`'s output would misinform the learner and could also break the
D-06/D-07 output-level/ratio rule if the same mistake leaks into the builder function.

### Pitfall 4: Algorithm 19 carries `reviewStatus: 'unresolved'` — no locked decision covers how its lesson should treat this
**What goes wrong:** A task might silently generate Algorithm 19's lesson exactly like any other
row, or might silently add UI/prose flagging it as provisional, without an explicit decision either
way.
**Why it happens:** `AlgorithmReviewStatus`/`isUnresolvedAlgorithm` exist specifically to flag that
Algorithm 19's edges (`6→5,5→4,5→3,5→2`) are "the stated RESEARCH.md routing... retained under a
stop-condition, pending topology review" rather than a confidently reconciled edge list.
[VERIFIED: algorithm-definition.ts:19-28, :59-61; algorithms.ts:293-307 — both read this session.]
`validateAlgorithm` does **not** gate structural acceptance on this flag (confirmed in
`algorithm-definition.ts`'s comment: "provenance metadata only"), so nothing currently prevents
Algorithm 19 from getting a normal lesson.
**How to avoid:** CONTEXT.md's D-01 through D-16 do not mention `reviewStatus` at all — this is a
genuine gap. Recommend the plan proceed with Algorithm 19 exactly like every other row (its edges
are structurally valid and pass `validateAlgorithm`; only the *provenance confidence* of the edge
list is flagged, not its runtime validity), and record this as an explicit open question rather
than silently deciding either way.
**Warning signs:** A reviewer might ask "why does Algorithm 19's lesson look normal despite the
flag" — the plan should have an answer ready (this pitfall entry) rather than have missed the flag
entirely.

### Pitfall 5: Fan-out hop-distance is unambiguous today, but only because every fan-out target is a carrier
**What goes wrong:** A hop-distance helper implemented as "1 + hop of the first outgoing edge's
target" (rather than checking all outgoing edges agree) would silently produce a wrong answer if a
future algorithm had a fan-out to targets at different depths.
**Why it happens:** Today's only two fan-out cases (Algorithm 19's op5 → {2,3,4}; Algorithm 22's
op6 → {3,4,5}) happen to send to targets that are **all carriers** (all hop-0), so "first edge" and
"all edges agree" give the same answer by coincidence, not by a general guarantee.
**How to avoid:** Implement the hop-distance helper to compute hop-distance over **all** outgoing
edges and either assert they agree (throw if not, mirroring the codebase's existing "throw on
contract violation" convention) or explicitly take a max/min — do not silently read only the first
edge.
**Warning signs:** A silently-wrong hop-distance would only surface as a slightly-off output level
on a fan-out operator, not a test failure, unless a test specifically exercises Algorithm 19/22.

## Code Examples

### Existing shared-envelope-by-role pattern (D-05's precedent — copy this shape)
```typescript
// Source: this repo, src/app/domain/dx7/lessons/lessons.ts, lines 121-127 (read this session)
envelope: carriers.includes(operatorId) ? DEFAULT_ENVELOPE : ALGORITHM_1_MODULATOR_ENVELOPE,
```
Note: `ALGORITHM_1_MODULATOR_ENVELOPE` (lines 30-33 of the same file) is currently a **module-local
`const`, not exported**. The new shared builder function can reference it directly if defined in
the same file (`lessons.ts`), which is the simplest integration path — no export needed unless the
builder function is split into its own module.

### Existing frozen-at-every-level construction pattern (copy this shape for the new builder)
```typescript
// Source: this repo, src/app/domain/dx7/lessons/lessons.ts, lines 58-73 (read this session)
function buildAlgorithm32StartingPatch(): InstrumentPatch {
  const operatorEntries = OPERATOR_IDS.map((operatorId) => {
    const parameters: OperatorParameters = Object.freeze({
      ...DEFAULT_OPERATOR_PARAMETERS,
      ratio: operatorId,
    });
    return [operatorId, parameters] as const;
  });
  const operators = Object.freeze(Object.fromEntries(operatorEntries)) as OperatorParameterSet;

  return Object.freeze({
    algorithmId: 32,
    operators,
    feedback: 0,
  });
}
```

### Existing dataset-iterating invariant test pattern (T-06-03/T-06-06 — already covers all 32 for free)
```typescript
// Source: this repo, src/app/domain/dx7/lessons/lessons.spec.ts, lines 58-124 (read this session)
describe.each([...LESSONS])('Lesson $id ($title)', (lesson) => {
  it("resolves algorithmId to a real entry in the canonical ALGORITHMS dataset", () => { /* ... */ });
  it('has a startingPatch.operators entry for all six OPERATOR_IDS, each accepted by validateOperatorParameters', () => { /* ... */ });
  it('has a try-this step that is reachable: the starting value has room to move in the stated direction', () => { /* ... */ });
  // ...
});
```
This `describe.each` already iterates `LESSONS` (not a hardcoded count), so growing `LESSONS` from
2 to 32 rows requires **zero changes to `lessons.spec.ts`** to inherit the full invariant suite
(frozen-at-every-level, valid operator parameters, valid feedback level, non-empty prose fields,
reachable try-this direction) for all 30 new rows automatically. Confirmed also by `STATE.md`'s own
Phase 06 decision log: "lessons.spec.ts iterates LESSON_IDS/LESSONS (describe.each) rather than
hardcoding a row count, so Phase 11's future lesson rows automatically inherit the dataset invariant
suite... with zero spec changes."

### LessonId / LESSON_IDS current shape (confirm before extending)
```typescript
// Source: this repo, src/app/domain/dx7/lessons/lesson-definition.ts, lines 14, 19 (read this session)
export type LessonId = 'algorithm-32' | 'algorithm-1';
export const LESSON_IDS: readonly LessonId[] = Object.freeze(['algorithm-32', 'algorithm-1']);
```
The `algorithm-{n}` naming pattern is confirmed (both existing members follow it exactly). The 30
new `LessonId` union members are `'algorithm-2' | 'algorithm-3' | ... | 'algorithm-31'` (every
integer 2 through 31 inclusive — 30 values, matching the 30 new lessons). `LESSON_IDS` must list
all 32 in the exact curriculum order below (required by `lessons.spec.ts`'s existing invariant:
"has one row per member of LESSON_IDS, in the same order").

### Required LESSON_IDS curriculum order (derived from D-01/D-02/D-03)
```typescript
// NOT existing code — derived this session from D-01 (four teachingTags groups verbatim),
// D-02 (Parallel group opens the curriculum), D-03 (Algorithm 32 and Algorithm 1 pinned first
// in their respective groups; all other within-group ordering ascending by id).
[
  'algorithm-32',                                          // Parallel group, pinned opener
  'algorithm-26', 'algorithm-27', 'algorithm-28',
  'algorithm-29', 'algorithm-30', 'algorithm-31',           // Parallel group, ascending
  'algorithm-1',                                            // Additive Stacks group, pinned opener
  'algorithm-2', 'algorithm-3', 'algorithm-4',
  'algorithm-5', 'algorithm-6',                             // Additive Stacks, ascending
  'algorithm-7', 'algorithm-8', 'algorithm-9', 'algorithm-10',
  'algorithm-11', 'algorithm-12', 'algorithm-13', 'algorithm-14',
  'algorithm-15', 'algorithm-16', 'algorithm-17', 'algorithm-18',  // Tree/Branch, ascending
  'algorithm-19', 'algorithm-20', 'algorithm-21', 'algorithm-22',
  'algorithm-23', 'algorithm-24', 'algorithm-25',                  // Rooting, ascending
]
```
This is the exact 32-element ordering `LESSON_IDS`/`LESSONS` must follow. [Derived from CONTEXT.md
D-01/D-02/D-03, cross-checked against `algorithms.ts`'s `teachingTags` group boundaries (lines
66-69, 86, 156, 305, 378) read this session.]

### Existing `/learn` grouping-relevant test to extend (learn.spec.ts)
```typescript
// Source: this repo, src/app/features/learn/learn.spec.ts, lines 26-36 (read this session)
it('renders one card per LESSONS row, in dataset order, with Algorithm 32 first', () => {
  const cards = compiled.querySelectorAll('.lesson-card');
  expect(cards.length).toBe(LESSONS.length);
  // ...
  expect(algorithmLabels[0]).toBe('Algorithm 32');
  expect(algorithmLabels).toEqual(LESSONS.map((lesson) => `Algorithm ${lesson.algorithmId}`));
});
```
This test currently asserts a **flat** card list matching `LESSONS` order 1:1. D-13's grouped
rendering (group headers + sectioned cards) will very likely require **updating** this test's
selector strategy (e.g., querying cards within each `.lesson-group` section rather than a single
flat `.lesson-card` NodeList) — flag this as a task-level concern: D-13 is not purely additive to
`learn.html`, it changes the DOM structure this existing test depends on.

## Runtime State Inventory

Not applicable — this is a greenfield-within-phase content addition, not a rename/refactor/
migration phase. No stored data, live service config, OS-registered state, secrets, or build
artifacts carry any renamed identifier this phase touches. Explicitly confirmed: no file paths,
env vars, or external service names change in this phase's scope.

## Testing

### Established local Vitest/Angular 22 zoneless patterns (confirmed from existing spec files, read this session)

- **Domain dataset invariants:** `describe.each([...LESSONS])` in `lessons.spec.ts` — already
  generic over row count; the 30 new rows need **zero new describe/it blocks** for the invariants
  it already checks (frozen-at-every-level, valid parameters/feedback, non-empty prose, reachable
  try-this).
- **Cross-check tables:** `lessons.spec.ts`'s "Algorithm 1 lesson role cross-check" describes a
  pattern of hand-populating an independent `EXPECTED_CARRIERS`/`EXPECTED_FEEDBACK_OP`-style
  constant and asserting `deriveCarriers`/`getFeedbackOperator` against it — mirrors
  `algorithms.spec.ts`'s convention. For 30 new algorithms this is likely too expensive to hand-
  populate individually; recommend the plan instead lean on this document's structural survey
  table (already an independently-authored second witness, hand-derived from `algorithms.ts` this
  session) as the source for any such assertions, or scope cross-checks only to the small number of
  structurally-notable rows (the duplicate clusters, Algorithm 19's unresolved status, the
  feedback-position pitfalls).
- **Component tests:** `ComponentFixture` + `TestBed.configureTestingModule` + `fixture.detectChanges()`
  + `await fixture.whenStable()` — zoneless-safe pattern already used in `learn.spec.ts`,
  `lesson-detail.spec.ts`. New `Learn` grouping/count tests should follow this exact setup.
- **Router integration tests:** `RouterTestingHarness.create()` + `harness.navigateByUrl(...)` — used
  for the browse-to-lesson round trip in `learn.spec.ts`; no new pattern needed for this phase.
- **State facade tests:** plain `TestBed.configureTestingModule({})` + `TestBed.inject(LessonProgress)`
  — `lesson-progress.spec.ts`'s existing pattern; unchanged, since `LessonProgress` itself is
  unchanged (D-15).
- **Fixture naming convention:** existing fixtures/constants are named by pedagogical intent (e.g.
  `EXPECTED_ALGORITHM_1_CARRIERS`, `ALGORITHM_1_MODULATOR_ENVELOPE`) — new shared constants (e.g.
  the shared modulator envelope, the shared feedback level, the "Algorithm-32-like" predicate)
  should follow the same naming style, generalized (e.g. `SHARED_MODULATOR_ENVELOPE`, not
  `ALGORITHM_N_MODULATOR_ENVELOPE`, since D-05 is explicit that one shape covers all 30).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.8` via `@angular/build:unit-test` [VERIFIED: package.json] |
| Config file | None — Angular's builder owns Vitest config (confirmed in `STATE.md`'s Phase 1<br>decision log: `ng test` is a `@angular/build:unit-test` builder wrapping Vitest, not a raw CLI<br>proxy) |
| Quick run command | `npm test` (runs once, exits outside a TTY, per `STATE.md`'s Phase 1 note) |
| Full suite command | `npm test` (same command — no separate "quick" vs "full" split exists in<br>this project; `npm run build`/`npm test`/`npm run lint` are the three verification gates per<br>CLAUDE.md) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CURR-01 | All 32 algorithms have a valid, frozen, non-empty lesson row | unit (dataset invariant) | `npm test -- lessons.spec` (via `describe.each`) | ✅ already covers all `LESSONS` rows generically |
| CURR-01 | 30 new `LessonId` members are legal, `isLessonId` accepts them | unit | existing `lesson-definition.spec.ts` pattern (`describe.each(LESSON_IDS)` style, currently a flat loop) | ✅ pattern exists, needs no structural change, just grows with `LESSON_IDS` |
| CURR-01 (success criterion 1) | `/learn` renders 4 grouped sections in curriculum order | component | new test in `learn.spec.ts` (or a new spec for the grouping helper) | ❌ Wave 0 — grouping is new behavior, existing `learn.spec.ts` asserts a flat list today (see Code Examples note above) |
| CURR-01 (success criterion 2) | Aggregate "X/32" and per-group "Y/N" counts update live as lessons complete | component | new test in `learn.spec.ts`, mirroring the existing "marking one lesson complete changes only that lesson's card wording, live" test | ❌ Wave 0 — new behavior |
| CURR-01 | Shared builder function produces a valid patch for every one of the 30 algorithms (frozen, valid params, valid feedback) | unit | inherited automatically via `describe.each([...LESSONS])` once the 30 rows exist | ✅ inherited, no new spec file strictly required (though a dedicated builder-function spec is recommended — see Wave 0 gaps) |
| CURR-01 | Duplicate-cluster lessons (1/13/14, 3/4/11, 24/25/31) do not silently break D-10's distinguishing-feature requirement | manual/prose review | none (prose quality is not machine-checkable) | N/A — recommend a plan-level checklist item calling out the 3 clusters explicitly, not a test |

### Sampling Rate
- **Per task commit:** `npm test` (fast enough as the full suite per current project convention —
  no separate quick-run split exists)
- **Per wave merge:** `npm test` again, plus `npm run build` and `npm run lint` per CLAUDE.md's
  three-gate verification requirement
- **Phase gate:** All three (`build`, `test`, `lint`) green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] A dedicated spec for the new shared builder function (e.g.
  `lessons.spec.ts` additions or a new `structural-starting-patch.spec.ts`) directly asserting the
  D-05/D-06/D-07/D-08 rules per role (carrier vs. modulator envelope, hop-distance-based output
  level, ratio exception membership, fixed feedback value) — the existing `describe.each` invariant
  suite checks *validity*, not that the *specific rules* were applied correctly.
- [ ] A dedicated spec for the new hop-distance helper, including explicit coverage of the two
  fan-out cases (Algorithm 19, Algorithm 22) per Pitfall 5.
- [ ] A dedicated spec for the "Algorithm-32-like" predicate, asserting it returns `true` for the
  locked-in strong candidates (24, 25, 31, 21, 23, 29) and `false` for at least one clear
  non-candidate (e.g. Algorithm 16, full convergence).
- [ ] `learn.spec.ts` needs new assertions for grouped rendering and aggregate counts (D-13/D-14) —
  the existing flat-list assertions will need restructuring, not just addition (see Code Examples
  note).
- [ ] No new framework install needed — Vitest/Angular test harness already fully covers this
  phase's needs.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in this app |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | Same as existing: `isLessonId` guards untrusted `:lessonId` route segments before any `LESSONS_BY_ID` lookup (unchanged mechanism, now covering 32 legal values instead of 2); `validateOperatorParameters`/`validateFeedbackLevel` already validate every generated patch (inherited via the existing invariant test suite) |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Untrusted `:lessonId` route segment reaching `LESSONS_BY_ID` without validation | Tampering | `isLessonId` guard, already exists, already tested with a rejected-address matrix in `lesson-detail.spec.ts` (near-miss casing, trailing junk, numeric segment, punctuation) — the 30 new legal ids extend the accept-list but the guard mechanism itself is unchanged |
| A malformed/invalid generated `startingPatch` reaching `InstrumentState` | Tampering / DoS (crash) | `validateOperatorParameters`/`validateFeedbackLevel` throwing guards, already invoked at the `LessonDetail` → `InstrumentState` boundary (unchanged); the `describe.each([...LESSONS])` invariant suite catches an invalid generated patch at test time, before it ever reaches that boundary |

No new threat surface is introduced by this phase — it produces more instances of an
already-validated data shape, through an already-guarded route boundary.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended candidate list for D-07's "Algorithm-32-like" exception (24, 25, 31 strong; 21, 23, 29 strong; 20/22/26/27/30 borderline-excluded) | "Algorithm-32-like Ratio Exception — Candidate Analysis" | If the planner/executor picks a different set, only the ratio-assignment branch of the builder function and a handful of lesson prose sentences change — reversible per D-07's own "Reversibility: reversible" note; low risk |
| A2 | The suggested `LessonId` literal pattern (`algorithm-{n}` for n=2..31) exactly matches what the planner will choose | Code Examples, "LessonId / LESSON_IDS current shape" | Low risk — directly confirmed from the two existing members' actual pattern (`'algorithm-32'`, `'algorithm-1'`), not inferred from training knowledge |
| A3 | The exact `LESSON_IDS` 32-element curriculum order derived here (Parallel-then-Additive-then-Tree-then-Rooting, with pinned openers) is what the planner will lock in | Code Examples, "Required LESSON_IDS curriculum order" | Medium risk if the planner interprets D-01/D-02/D-03 differently — but the derivation here is mechanical from the locked decisions' own text, not a judgment call; flagged so the planner can verify against CONTEXT.md directly rather than re-deriving from scratch |
| A4 | Algorithm 19's `reviewStatus: 'unresolved'` should be treated as "proceed normally, structurally valid" rather than requiring special lesson-UI handling | Pitfall 4 | Medium risk — this is a genuine gap CONTEXT.md does not address; if wrong, a task may need to add UI/prose flagging Algorithm 19 as provisional, which is additional (not corrective) scope |
| A5 | Grouping (D-13) and aggregate-count (D-14) logic can be implemented without any new Angular-facing state beyond `computed()` signals in `Learn` itself, per the existing `LessonProgress.completed` signal | Architectural Responsibility Map, Pattern 3 | Low risk — directly follows from D-14's own text ("no new state, no new facade method beyond a read-through count") |

## Open Questions

1. **Should `groupLessonsByTeachingTag` live in `lessons.ts` or a new file (`lesson-grouping.ts`)?**
   - What we know: it must be pure domain code (no Angular import), consuming `LESSONS` and
     `ALGORITHMS`.
   - What's unclear: whether the project prefers one growing `lessons.ts` file or splitting
     concerns into smaller files — no existing precedent in `dx7/lessons/` for a multi-file split
     (currently just `lesson-definition.ts`, `lessons.ts`, `try-this.ts`).
   - Recommendation: new file `lesson-grouping.ts`, consistent with the existing one-concern-per-file
     pattern (`try-this.ts` already demonstrates this convention for the try-this domain).

2. **Does `learn.spec.ts`'s existing flat-list test get replaced or extended?**
   - What we know: D-13 changes the DOM structure (group headers + sectioned cards) that the
     existing "renders one card per LESSONS row... with Algorithm 32 first" test queries against.
   - What's unclear: whether the plan should treat this as a breaking change to an existing test
     (acceptable, since behavior genuinely changed) or preserve some flat-query capability
     alongside grouping.
   - Recommendation: update the existing test's queries to work within the new grouped DOM
     structure (e.g., query all `.lesson-card` elements regardless of which group section contains
     them — likely still works unchanged if group sections are additive wrapper elements, not
     replacements) — verify this concretely during planning by sketching the exact `learn.html`
     structure before finalizing test tasks.

## Sources

### Primary (HIGH confidence — all read directly, this session)
- `src/app/domain/dx7/models/algorithms.ts` (full file, 442 lines) — canonical dataset, all 32 rows
- `src/app/domain/dx7/models/derive-role.ts` (full file) — `deriveCarriers`, `getOperatorRole`,
  `getFeedbackOperator`, `hasFeedbackLoop`
- `src/app/domain/dx7/models/algorithm-definition.ts` (full file) — `TeachingTag`,
  `AlgorithmReviewStatus`, `isUnresolvedAlgorithm`
- `src/app/domain/dx7/models/operator.ts`, `operator-parameters.ts`, `patch.ts` (full files) —
  `OperatorId`, `Dx7Envelope`, `DEFAULT_ENVELOPE`, `DEFAULT_OPERATOR_PARAMETERS`, `COARSE_RATIOS`,
  `InstrumentPatch`
- `src/app/domain/dx7/lessons/lessons.ts`, `lesson-definition.ts`, `try-this.ts` (full files) —
  existing builder functions, `LessonId`/`LESSON_IDS`/`LessonDefinition`/`TryThisStep` shapes,
  `tryThisParamValues`/`hasMovedTowardTarget`
- `src/app/domain/dx7/lessons/lessons.spec.ts`, `lesson-definition.spec.ts` (full files) — existing
  test patterns/invariants
- `src/app/state/lesson-progress.ts`, `lesson-progress.spec.ts` (full files) — `LessonProgress`
  facade and its test pattern
- `src/app/features/learn/learn.ts`, `learn.html`, `learn.spec.ts` (full files) — current `/learn`
  index implementation and tests
- `src/app/features/learn/lesson-detail/lesson-detail.spec.ts` (full file) — confirms
  `LessonDetail` is untouched by this phase's decisions, and the not-found/route-reuse behavior
  this phase must not break
- `.planning/phases/11-curriculum-across-all-32-algorithms/11-CONTEXT.md` — locked decisions D-01
  through D-16, Claude's Discretion items
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (Phase 11 section) —
  requirement CURR-01, project decision history, phase success criteria
- `package.json` — verified `@angular/core ^22.1.0`, `vitest ^4.0.8`, `typescript ~6.0.2`
- `.planning/config.json` — confirmed no `nyquist_validation`/`security_enforcement` overrides
  (both default to enabled)

### Secondary (MEDIUM confidence)
None — no web/external documentation was needed for this phase; everything required is in-repo.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, versions read directly from `package.json`
- Architecture: HIGH — every pattern is copied from existing, working, tested code in this repo
- Structural survey (30-algorithm data): HIGH — every edge list, carrier set, feedback operator,
  and hop-distance computed by hand from `algorithms.ts`'s actual `edges` arrays, cross-checked
  against `derive-role.ts`'s documented derivation rule, read in full this session
- Pitfalls: HIGH — each pitfall traces to a specific, quoted, line-cited fact in the dataset
- Algorithm-32-like candidate ranking: MEDIUM — this is a judgment call explicitly left to Claude's
  Discretion by CONTEXT.md; the underlying structural facts (carrier/isolation counts) are HIGH
  confidence, but the threshold for "counts as Algorithm-32-like" is inherently a design choice,
  not a fact

**Research date:** 2026-08-23
**Valid until:** No expiry driver — this research is grounded in this repo's own committed source
files, not external/versioned documentation subject to drift. Re-verify only if `algorithms.ts`,
`derive-role.ts`, `lessons.ts`, or `lesson-definition.ts` change before planning begins.
