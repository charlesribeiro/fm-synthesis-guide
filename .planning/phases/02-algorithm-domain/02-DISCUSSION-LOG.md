# Phase 2: Algorithm domain - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 2-Algorithm domain
**Areas discussed:** Feedback representation, Carrier/modulator derivation rule, Routing-matrix sourcing

---

## Feedback representation

| Option | Description | Selected |
|--------|-------------|----------|
| Self-loop edge | Feedback is a `ModulationEdge` interpreted as feedback when `from === to`. Reuses the edge model. | ✓ |
| Separate FeedbackDefinition field | Keep feedback as its own top-level field, decoupled from edges array. | |
| You decide | Pick whichever keeps validation invariants simplest. | |

**User's choice:** Self-loop edge (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Structural only | Algorithm data says "operator 6 has a feedback loop"; 0-7 level is instrument state (Phase 3). | ✓ |
| Include a default level | Algorithm dataset also carries a suggested default feedback level. | |

**User's choice:** Structural only (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Absence of self-loop edge | No feedback = no edge with `from === to`. No special marker needed. | ✓ |
| Explicit hasFeedback: false flag | Every algorithm carries an explicit boolean. | |

**User's choice:** Absence of self-loop edge (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Standard set | Reject: >1 feedback edge per algorithm, `from !== to` mislabeled as feedback, feedback edge referencing nonexistent operator id. | ✓ |
| Standard set + carrier feedback | All of the above, plus reject feedback loops on operators with zero outgoing edges elsewhere. | |

**User's choice:** Standard set (recommended)

**Notes:** None.

---

## Carrier/modulator derivation rule

| Option | Description | Selected |
|--------|-------------|----------|
| No outgoing edges = carrier | Operator is a carrier iff zero outgoing edges to other operators (self-feedback doesn't count). | ✓ |
| Explicit carriers list, edges only for modulation | Keep explicit `carriers: OperatorId[]` field, validated against edges rather than derived live. | |

**User's choice:** No outgoing edges = carrier (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Two roles only | carrier \| modulator. Feedback is an orthogonal boolean. | ✓ |
| Three roles | carrier \| modulator \| feedbackModulator as a distinct enum value. | |

**User's choice:** Two roles only (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Pure derivation utility, computed on demand | No cached/duplicated state to go stale; matches "no duplicated routing knowledge." | ✓ |
| Precomputed at module load | Compute once at module load and freeze onto each algorithm object. | |

**User's choice:** Pure derivation utility, computed on demand (recommended)

**Notes:** None.

---

## Routing-matrix sourcing

| Option | Description | Selected |
|--------|-------------|----------|
| Re-derive from public FM theory + cross-check multiple independent sources | Research well-documented DX7 topology across independent sources, not Yamaha manual or Dexed; facts aren't copyrightable, only their expression. Cross-check 2+ sources per algorithm. | ✓ |
| You already have a verified source | User names ground-truth source(s) for the researcher. | |

**User's choice:** Re-derive from public FM theory + cross-check multiple independent sources (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Researcher compiles, you spot-check | gsd-phase-researcher researches/cross-checks all 32, writes routing reference table into RESEARCH.md with sources cited; user reviews the compiled table. | ✓ |
| You review every algorithm's sources | Full source citations per algorithm presented for individual approval. | |

**User's choice:** Researcher compiles, you spot-check (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Verify group + encode structural tags now | Verify four-group taxonomy alongside routing research; add lightweight `teachingTags` field now. | ✓ |
| Defer entirely to Phase 11 (curriculum) | Phase 2 ships bare topology only; grouping/tags are Phase 11's problem. | |

**User's choice:** Verify group + encode structural tags now (recommended)

**Notes:** None.

---

## Claude's Discretion

- Exact TypeScript shape of `AlgorithmDefinition`/`ModulationEdge` and file/module layout.
- Whether validation is build-time invariant tests only, or also an exported runtime guard.
- Exact fixture algorithms chosen for isolated tests.

## Deferred Ideas

None — discussion stayed within phase scope.
