import type { AlgorithmDefinition, TeachingTag } from './algorithm-definition';
import type { ModulationEdge } from './modulation-edge';

/**
 * The single canonical dataset of DX7-style operator-routing algorithms
 * (DOMAIN-01) — no other module may redefine routing data. Routing facts
 * are re-encoded as original structured data and cross-checked across
 * independent sources (D-08); nothing here is copied from any manual scan
 * or existing emulator's source tree, and no name or comment claims
 * bit-accurate hardware emulation.
 *
 * Provenance (D-08):
 * 1. Rows were entered by two routes, never copied from a Yamaha manual
 *    scan or Dexed source tree: 18 rows re-encode dxwire's independently
 *    typed type/fb routing facts as original structured data (verbatim
 *    transcription of facts into this project's shape, not a copy of
 *    diagrams or manual text), and 14 rows were reconciled when the
 *    researched edge list did not reproduce its own researched carrier
 *    set under this project's derivation rule (see point 4). Remaining
 *    MEDIUM-confidence intermediate edges are rule-constrained
 *    reconstructions (higher-modulates-lower plus pattern matching)
 *    where no second independent edge-order source was available this
 *    session — not a claim that every topology was independently
 *    re-derived from scratch.
 * 2. Which operator modulates which is a routing fact, not a copyrightable
 *    expression — only a specific diagram, manual paragraph, or emulator's
 *    source code expressing that fact is protected. This dataset re-encodes
 *    the facts as original structured data; no diagram, manual text, or
 *    emulator source was copied into this file or its comments.
 * 3. Carrier sets and feedback operators are the highest-confidence facts:
 *    sourced directly from a primary reference and cross-validated against
 *    a second independent source for roughly a third of the 32 rows, not
 *    all 32 — a blanket "triangulated across multiple sources" claim would
 *    overstate the research. The exact intermediate modulation edges are
 *    lower-confidence: reconstructed from a structural rule (an operator
 *    only ever modulates a lower-numbered one) plus pattern matching
 *    against the higher-confidence rows, with no independent second source
 *    for the edge order itself. That confidence gap is why, wherever the
 *    two disagreed, the edge list was repaired to match the carrier set —
 *    never the reverse (see `derive-role.ts`'s `deriveCarriers`).
 * 4. Fourteen rows needed such a repair, because their originally researched
 *    edge list did not reproduce its own researched carrier set under this
 *    project's carrier-derivation rule: algorithms 7, 10, 11, 15, 17, 18,
 *    19, 20, 21, 23, 24, 25, 26, and 27. Each repair is recorded in Plan
 *    02-04's SUMMARY.md reconciliation ledger (one line per row: stated
 *    edges -> entered edges, the constraint that forced the change, and a
 *    repaired/ambiguous/unresolved status). Rows marked `ambiguous` below
 *    chose among more than one edge that would have equally satisfied the
 *    carrier constraint; the choice is noted inline and the alternative is
 *    recorded in the ledger. Algorithm 19 is `unresolved`: under the plan's
 *    stop-condition (more than one invented edge) its stated RESEARCH.md
 *    edges are retained pending topology review, flagged at runtime via its
 *    `reviewStatus: 'unresolved'` field (see `algorithm-definition.ts`) so a
 *    downstream consumer can read the flag instead of hardcoding id 19.
 * 5. Historical-fidelity review (D-09) signed off 2026-08-04 as approved
 *    as-is; that approval is **superseded** as of 2026-08-05. Algorithm 26
 *    (and matching Algorithm 27 non-feedback shape) routing was corrected to
 *    6→4, 5→4, 3→2; Algorithm 19 was restored to stated edges and marked
 *    unresolved. Algorithms 4 and 6 remain self-loop feedback (D-01) —
 *    multi-operator return-edge feedback is out of scope for this model.
 *    Full record: `.planning/phases/02-algorithm-domain/02-DATASET-REVIEW.md`.
 *
 * Each entry and its `edges` array is frozen at module load (T-02-01) so a
 * downstream phase cannot mutate the single source of truth in place.
 */
const additiveStacksTags: readonly TeachingTag[] = Object.freeze(['additive-stacks']);
const treeBranchTags: readonly TeachingTag[] = Object.freeze(['tree-branch']);
const rootingTags: readonly TeachingTag[] = Object.freeze(['rooting']);
const parallelTags: readonly TeachingTag[] = Object.freeze(['parallel']);

function edges(list: readonly ModulationEdge[]): readonly ModulationEdge[] {
  return Object.freeze(list.map((edge) => Object.freeze({ ...edge })));
}

export const ALGORITHMS: readonly AlgorithmDefinition[] = [
  Object.freeze({
    id: 1,
    name: 'Four-deep stack into operator 3, plus a two-deep tower into operator 1',
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 4, to: 3 },
      { from: 2, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: additiveStacksTags,
  }),
  Object.freeze({
    id: 2,
    name: "Same stack-and-tower shape as Algorithm 1, with feedback relocated to the tower's modulator (operator 2)",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 4, to: 3 },
      { from: 2, to: 1 },
      { from: 2, to: 2 }, // feedback self-loop, D-01
    ]),
    teachingTags: additiveStacksTags,
  }),
  Object.freeze({
    id: 3,
    name: "Two parallel three-operator chains, one feeding operator 4 (6->5->4) and one feeding operator 1 (3->2->1); feedback on the first chain's top operator",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 3, to: 2 },
      { from: 2, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: additiveStacksTags,
  }),
  Object.freeze({
    id: 4,
    name: "Two parallel three-operator chains, one feeding operator 4 (6->5->4) and one feeding operator 1 (3->2->1); feedback on the first chain's top operator — topologically identical to Algorithm 3 in this dataset (RESEARCH.md flags this as a probable near-duplicate pair)",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 3, to: 2 },
      { from: 2, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: additiveStacksTags,
  }),
  Object.freeze({
    id: 5,
    name: 'Three independent two-operator pairs (6->5, 4->3, 2->1); feedback on the pair feeding operator 5',
    edges: edges([
      { from: 6, to: 5 },
      { from: 4, to: 3 },
      { from: 2, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: additiveStacksTags,
  }),
  Object.freeze({
    id: 6,
    name: 'Three independent two-operator pairs (6->5, 4->3, 2->1); feedback on the pair feeding operator 5 — topologically identical to Algorithm 5 in this dataset (RESEARCH.md flags this as a probable near-duplicate pair)',
    edges: edges([
      { from: 6, to: 5 },
      { from: 4, to: 3 },
      { from: 2, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: additiveStacksTags,
  }),
  Object.freeze({
    id: 7,
    name: "Five-operator chain (6->5->4->2->1) ending at operator 1, plus an independent unmodulated carrier at operator 3; feedback on the chain's top operator — reconciled: the originally researched edge 3->2 was dropped because it made operator 3 a modulator, contradicting its researched carrier status (see head comment, D-08)",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 4, to: 2 },
      { from: 2, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 8,
    name: 'Two modulators (operators 5 and 4) both feeding carrier 3, plus a separate two-operator pair feeding carrier 1 (2->1); feedback on the interior modulator, operator 4',
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 3 },
      { from: 4, to: 3 },
      { from: 2, to: 1 },
      { from: 4, to: 4 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 9,
    name: 'Same branch-merge shape as Algorithm 8 (operators 5 and 4 both feeding carrier 3), with feedback relocated to the pair feeding carrier 1 (operator 2)',
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 3 },
      { from: 4, to: 3 },
      { from: 2, to: 1 },
      { from: 2, to: 2 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 10,
    name: "Two parallel three-operator chains, one feeding operator 4 (6->5->4) and one feeding operator 1 (3->2->1); feedback on the second chain's top operator, operator 3 — reconciled: added edge 3->2 (operator 3 had no edge at all in the original table, contradicting its researched non-carrier status); the other equally valid target, 3->1, is recorded as the alternative in the SUMMARY ledger (ambiguous, D-08)",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 2, to: 1 },
      { from: 3, to: 2 },
      { from: 3, to: 3 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 11,
    name: "Two parallel three-operator chains, one feeding operator 4 (6->5->4) and one feeding operator 1 (3->2->1); feedback on the first chain's top operator — reconciled: added edge 3->2 (operator 3 had no edge at all in the original table, contradicting its researched non-carrier status); the other equally valid target, 3->1, is recorded as the alternative in the SUMMARY ledger (ambiguous, D-08). Topologically identical to Algorithms 3 and 4 in this dataset once repaired.",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 2, to: 1 },
      { from: 3, to: 2 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 12,
    name: "Same stack-and-tower shape as Algorithm 1, with feedback relocated to the tower's modulator (operator 2) — topologically identical to Algorithm 2 in this dataset",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 4, to: 3 },
      { from: 2, to: 1 },
      { from: 2, to: 2 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 13,
    name: "Same stack-and-tower shape as Algorithm 1, feedback retained on the stack's top operator — topologically identical to Algorithm 1 in this dataset",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 4, to: 3 },
      { from: 2, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 14,
    name: "Same stack-and-tower shape as Algorithm 1, feedback retained on the stack's top operator — topologically identical to Algorithms 1 and 13 in this dataset",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 4, to: 3 },
      { from: 2, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 15,
    name: "Two modulators (operators 5 and 4) both feeding carrier 2, which itself feeds carrier 1 (2->1); feedback on the shared modulator, operator 2 — reconciled: added edge 2->1 (operator 2 had no outgoing edge in the original table, contradicting its researched non-carrier status; 1 is the only valid target, so this repair is forced, not chosen, D-08)",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 2 },
      { from: 4, to: 2 },
      { from: 2, to: 1 },
      { from: 2, to: 2 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 16,
    name: "Three chains converging directly on operator 1 (6->5->1, 4->3->1, 2->1); feedback on the first chain's top operator — pure frequency modulation into a single carrier",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 1 },
      { from: 4, to: 3 },
      { from: 3, to: 1 },
      { from: 2, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 17,
    name: "Three chains converging directly on operator 1 (6->5->1, 4->3->1, 2->1); feedback on the shortest chain's modulator, operator 2 — reconciled: added edge 2->1 (operator 2 had no outgoing edge in the original table, contradicting its researched non-carrier status; 1 is the only valid target, so this repair is forced, not chosen, D-08)",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 1 },
      { from: 4, to: 3 },
      { from: 3, to: 1 },
      { from: 2, to: 1 },
      { from: 2, to: 2 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 18,
    name: "A three-operator chain into operator 1 (6->5->4->1) alongside two direct modulators into operator 1 (operators 2 and 3); feedback on operator 3 — reconciled: added edge 3->1 (operator 3 had no outgoing edge in the original table, contradicting its researched non-carrier status); the other equally valid target, 3->2, is recorded as the alternative in the SUMMARY ledger (ambiguous, D-08)",
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 4, to: 1 },
      { from: 2, to: 1 },
      { from: 3, to: 1 },
      { from: 3, to: 3 }, // feedback self-loop, D-01
    ]),
    teachingTags: treeBranchTags,
  }),
  Object.freeze({
    id: 19,
    // Unresolved (D-09 reopen): stop-condition requires unresolved when more than one
    // edge must be invented. Stated RESEARCH.md edges retained (no invented 2→1/3→1).
    name: 'Stated RESEARCH.md routing for Algorithm 19 — 6->5 plus operator-5 fan into 4, 3, and 2; unresolved pending topology review (invented 2->1/3->1 edges withdrawn)',
    edges: edges([
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 5, to: 3 },
      { from: 5, to: 2 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: rootingTags,
    reviewStatus: 'unresolved',
  }),
  Object.freeze({
    id: 20,
    name: "A three-operator chain into carrier 4 (6->5->4), a separate two-operator pair into carrier 2 (3->2), and an independent unmodulated carrier at operator 1; feedback on the pair's modulator, operator 3 — reconciled: the originally researched edge 2->1 was dropped because it made operator 2 a modulator, contradicting its researched carrier status (forced repair, D-08)",
    edges: edges([
      { from: 5, to: 4 },
      { from: 3, to: 2 },
      { from: 6, to: 5 },
      { from: 3, to: 3 }, // feedback self-loop, D-01
    ]),
    teachingTags: rootingTags,
  }),
  Object.freeze({
    id: 21,
    name: "Two independent two-operator pairs (6->5 into carrier 5, and 3->2 into carrier 2) alongside two independent unmodulated carriers (operators 1 and 4); feedback on one pair's modulator, operator 3 — reconciled: the originally researched edge 2->1 was dropped because it made operator 2 a modulator, contradicting its researched carrier status (forced repair, D-08)",
    edges: edges([
      { from: 6, to: 5 },
      { from: 3, to: 2 },
      { from: 3, to: 3 }, // feedback self-loop, D-01
    ]),
    teachingTags: rootingTags,
  }),
  Object.freeze({
    id: 22,
    name: 'Operator 6 fans out directly to three carriers (5, 4, and 3), plus a separate two-operator pair into carrier 1 (2->1); feedback on the fanning operator',
    edges: edges([
      { from: 6, to: 5 },
      { from: 6, to: 4 },
      { from: 6, to: 3 },
      { from: 2, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: rootingTags,
  }),
  Object.freeze({
    id: 23,
    name: "A two-operator pair into carrier 5 (6->5), a single modulator into carrier 1 (3->1), and two independent unmodulated carriers (operators 2 and 4); feedback on the pair's modulator, operator 6 — reconciled: the originally researched edge 5->4 was dropped because it made operator 5 a modulator, contradicting its researched carrier status; operator 3 then needed a new outgoing edge to keep it out of the carrier set, and 3->1 was chosen over the equally valid 3->2 (recorded as the alternative in the SUMMARY ledger, ambiguous, D-08)",
    edges: edges([
      { from: 6, to: 5 },
      { from: 3, to: 1 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: rootingTags,
  }),
  Object.freeze({
    id: 24,
    name: "A single two-operator pair (6->5) alongside four independent unmodulated carriers (operators 1 through 4); feedback on the pair's modulator — reconciled: the originally researched edge 5->4 was dropped because it made operator 5 a modulator, contradicting its researched carrier status (forced repair, D-08)",
    edges: edges([
      { from: 6, to: 5 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: rootingTags,
  }),
  Object.freeze({
    id: 25,
    name: "A single two-operator pair (6->5) alongside four independent unmodulated carriers (operators 1 through 4); feedback on the pair's modulator — topologically identical to Algorithm 24 once repaired; reconciled: the originally researched edge 5->4 was dropped because it made operator 5 a modulator, contradicting its researched carrier status (forced repair, D-08)",
    edges: edges([
      { from: 6, to: 5 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: rootingTags,
  }),
  Object.freeze({
    id: 26,
    name: 'Two modulators into carrier 4 (6->4 and 5->4), modulator 3 into carrier 2, independent carrier 1; feedback self-loop on operator 6 — corrected 2026-08-05 from the prior ambiguous 6->5/5->4/3->1 reconstruction (D-09 reopen)',
    edges: edges([
      { from: 6, to: 4 },
      { from: 5, to: 4 },
      { from: 3, to: 2 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: parallelTags,
  }),
  Object.freeze({
    id: 27,
    name: 'Same non-feedback shape as Algorithm 26 — two modulators into carrier 4 (6->4, 5->4) and 3->2 into carrier 2, independent carrier 1; feedback self-loop on operator 3',
    edges: edges([
      { from: 6, to: 4 },
      { from: 5, to: 4 },
      { from: 3, to: 2 },
      { from: 3, to: 3 }, // feedback self-loop, D-01
    ]),
    teachingTags: parallelTags,
  }),
  Object.freeze({
    id: 28,
    name: 'A three-operator chain into carrier 3 (5->4->3), a separate two-operator pair into carrier 1 (2->1), and an independent unmodulated carrier at operator 6; feedback on the chain\'s top operator, operator 5',
    edges: edges([
      { from: 5, to: 4 },
      { from: 4, to: 3 },
      { from: 2, to: 1 },
      { from: 5, to: 5 }, // feedback self-loop, D-01
    ]),
    teachingTags: parallelTags,
  }),
  Object.freeze({
    id: 29,
    name: 'Two independent two-operator pairs (6->5 into carrier 5, and 4->3 into carrier 3), plus two independent unmodulated carriers (operators 1 and 2); feedback on one pair\'s modulator, operator 6',
    edges: edges([
      { from: 6, to: 5 },
      { from: 4, to: 3 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: parallelTags,
  }),
  Object.freeze({
    id: 30,
    name: "A three-operator chain into carrier 3 (5->4->3), plus three independent unmodulated carriers (operators 1, 2, and 6); feedback on the chain's top operator, operator 5",
    edges: edges([
      { from: 5, to: 4 },
      { from: 4, to: 3 },
      { from: 5, to: 5 }, // feedback self-loop, D-01
    ]),
    teachingTags: parallelTags,
  }),
  Object.freeze({
    id: 31,
    name: "A single two-operator pair (6->5) alongside four independent unmodulated carriers (operators 1 through 4); feedback on the pair's modulator — minimal modulation, approaching pure additive",
    edges: edges([
      { from: 6, to: 5 },
      { from: 6, to: 6 }, // feedback self-loop, D-01
    ]),
    teachingTags: parallelTags,
  }),
  Object.freeze({
    id: 32,
    name: 'Six independent carriers summed with no inter-operator modulation',
    edges: edges([
      { from: 6, to: 6 }, // feedback self-loop, D-01 — the only edge this algorithm declares
    ]),
    teachingTags: parallelTags,
  }),
];

Object.freeze(ALGORITHMS);
