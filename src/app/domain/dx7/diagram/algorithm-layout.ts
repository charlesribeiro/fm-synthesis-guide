import type { AlgorithmId } from '../models/algorithm';
import { isAlgorithmId } from '../models/algorithm';
import type { OperatorId } from '../models/operator';

/**
 * The layout-hint layer for algorithm routing diagrams — kept as a distinct
 * module from the graph-truth dataset in `models/algorithms.ts` (D-05).
 * Nothing here carries routing meaning: a position is a rendering hint only,
 * never consulted to decide role, carrier status, or feedback (those facts
 * always come from `derive-role.ts` against the `AlgorithmDefinition`
 * itself). Every position sits on one of the two shared coordinate ladders
 * below (`ROW_Y`/`COLUMN_X`) — modulators strictly above the carriers they
 * feed, carriers on the bottom `CARRIER_ROW_Y` band (D-06) — and all 32
 * diagrams (this file plus Plan 02's remaining 30 records) share the exact
 * same canvas and node size (D-07).
 *
 * The coordinates below are an original expression of the routing facts
 * already encoded in `models/algorithms.ts` — not traced, measured, or
 * copied from any Yamaha panel artwork, manual diagram, or third-party
 * emulator source (CLAUDE.md licensing rule).
 */

export interface OperatorPosition {
  readonly x: number;
  readonly y: number;
}

export type AlgorithmLayout = Readonly<Record<OperatorId, OperatorPosition>>;

export const DIAGRAM_VIEWBOX_WIDTH = 420;
export const DIAGRAM_VIEWBOX_HEIGHT = 300;
export const DIAGRAM_VIEWBOX = '0 0 420 300';
export const NODE_RADIUS = 18;

/**
 * Five shared rows. Five is exactly enough for this dataset's deepest
 * modulation chain (five operators, Algorithm 7) — measured against
 * `ALGORITHMS`, not assumed. Index 4 is the carrier band; every carrier's
 * `y` must equal `CARRIER_ROW_Y`, and for every modulation edge the source
 * operator's `y` must be strictly less than the target's (D-06).
 */
export const ROW_Y: readonly number[] = Object.freeze([56, 104, 152, 200, 248]);
export const CARRIER_ROW_Y = 248;

/** Six shared columns — enough for Algorithm 32's six side-by-side carriers. */
export const COLUMN_X: readonly number[] = Object.freeze([40, 105, 170, 235, 300, 365]);

export const OUTPUT_BUS_Y = 280;

function frozenPosition(x: number, y: number): OperatorPosition {
  return Object.freeze({ x, y });
}

function frozenLayout(layout: Record<OperatorId, OperatorPosition>): AlgorithmLayout {
  return Object.freeze(layout);
}

/**
 * Private mutable builder for the 32 layout records. Never export this Map —
 * consumers must go through the read-only `ALGORITHM_LAYOUTS` facade so
 * `set`/`delete`/`clear` cannot alter production layout data at runtime.
 */
const ALGORITHM_LAYOUTS_STORE = new Map<AlgorithmId, AlgorithmLayout>([
  // Algorithm 1: 6->5->4->3 descending chain occupies rows 1-4 of the
  // centre-left column (170); 2->1 tower occupies rows 3-4 of the
  // centre-right column (235) — the two columns straddle the 420-unit
  // canvas midpoint (202.5) so the pair reads centred. Carriers 1 and 3
  // both land on CARRIER_ROW_Y.
  [
    1,
    frozenLayout({
      6: frozenPosition(170, ROW_Y[1]),
      5: frozenPosition(170, ROW_Y[2]),
      4: frozenPosition(170, ROW_Y[3]),
      3: frozenPosition(170, CARRIER_ROW_Y),
      2: frozenPosition(235, ROW_Y[3]),
      1: frozenPosition(235, CARRIER_ROW_Y),
    }),
  ],
  // Algorithms 2-31 below are authored following the depth/column/centring
  // procedure in 04-02-PLAN.md's design_decisions: each operator's row is
  // `5 - depth` (carrier = depth 1, CARRIER_ROW_Y), connected components of
  // the (non-self-loop) modulation graph are ordered left-to-right by their
  // lowest carrier id, and each component occupies the column(s) of its
  // carrier(s) — spread across adjacent columns whenever two operators in
  // one component would otherwise share a row and column.
  [
    2,
    frozenLayout({
      6: frozenPosition(COLUMN_X[3], ROW_Y[1]),
      5: frozenPosition(COLUMN_X[3], ROW_Y[2]),
      4: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
    }),
  ],
  // Algorithm 3: two independent three-operator chains (6->5->4, 3->2->1),
  // each its own component/column — carrier-1's chain ordered left of
  // carrier-4's chain (ascending lowest carrier id, D-06/D-07).
  [
    3,
    frozenLayout({
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[2], ROW_Y[2]),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      6: frozenPosition(COLUMN_X[3], ROW_Y[2]),
    }),
  ],
  // Algorithm 4: topologically identical to Algorithm 3 in this dataset
  // (RESEARCH.md near-duplicate pair) — same layout.
  [
    4,
    frozenLayout({
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[2], ROW_Y[2]),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      6: frozenPosition(COLUMN_X[3], ROW_Y[2]),
    }),
  ],
  // Algorithm 5: three independent two-operator pairs, one component/column
  // each, ordered left-to-right by carrier id (1, 3, 5).
  [
    5,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[1], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      5: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[3], ROW_Y[3]),
    }),
  ],
  // Algorithm 6: topologically identical to Algorithm 5 in this dataset —
  // same layout.
  [
    6,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[1], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      5: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[3], ROW_Y[3]),
    }),
  ],
  // Algorithm 7: five-operator chain (6->5->4->2->1, depths 5..1) occupies
  // one column; operator 3, an independent unmodulated carrier, is its own
  // one-node component in the adjacent column.
  [
    7,
    frozenLayout({
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      4: frozenPosition(COLUMN_X[2], ROW_Y[2]),
      5: frozenPosition(COLUMN_X[2], ROW_Y[1]),
      6: frozenPosition(COLUMN_X[2], ROW_Y[0]),
      3: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
    }),
  ],
  // Algorithm 8: operators 5 and 4 both modulate carrier 3 and share depth 2
  // — a same-row collision, so the component spreads across two columns:
  // the 6->5->3 lineage stays in one column, operator 4 (the other branch
  // into carrier 3) takes the adjacent column. Equally valid alternative
  // not chosen: swap which of 4/5 anchors the primary column.
  [
    8,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[1], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      6: frozenPosition(COLUMN_X[2], ROW_Y[2]),
      4: frozenPosition(COLUMN_X[3], ROW_Y[3]),
    }),
  ],
  // Algorithm 9: same branch-merge shape as Algorithm 8 (operators 5 and 4
  // both feeding carrier 3), feedback relocated — same layout.
  [
    9,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[1], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      6: frozenPosition(COLUMN_X[2], ROW_Y[2]),
      4: frozenPosition(COLUMN_X[3], ROW_Y[3]),
    }),
  ],
  // Algorithm 10: two independent three-operator chains (3->2->1, 6->5->4),
  // one component/column each, ordered by carrier id (1, 4).
  [
    10,
    frozenLayout({
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[2], ROW_Y[2]),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      6: frozenPosition(COLUMN_X[3], ROW_Y[2]),
    }),
  ],
  // Algorithm 11: same chain shapes as Algorithm 10 (3->2->1, 6->5->4) —
  // same layout.
  [
    11,
    frozenLayout({
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[2], ROW_Y[2]),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      6: frozenPosition(COLUMN_X[3], ROW_Y[2]),
    }),
  ],
  // Algorithm 12: same stack-and-tower edges as Algorithm 2 — same layout.
  [
    12,
    frozenLayout({
      6: frozenPosition(COLUMN_X[3], ROW_Y[1]),
      5: frozenPosition(COLUMN_X[3], ROW_Y[2]),
      4: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
    }),
  ],
  // Algorithm 13: same stack-and-tower edges as Algorithm 2 — same layout.
  [
    13,
    frozenLayout({
      6: frozenPosition(COLUMN_X[3], ROW_Y[1]),
      5: frozenPosition(COLUMN_X[3], ROW_Y[2]),
      4: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
    }),
  ],
  // Algorithm 14: same stack-and-tower edges as Algorithm 2 — same layout.
  [
    14,
    frozenLayout({
      6: frozenPosition(COLUMN_X[3], ROW_Y[1]),
      5: frozenPosition(COLUMN_X[3], ROW_Y[2]),
      4: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
    }),
  ],
  // Algorithm 15: operators 5 and 4 both modulate carrier 2 and share depth
  // 3 — a same-row collision. The 6->5->2->1 lineage anchors the primary
  // column; operator 4 (the other modulator into carrier 2) takes the
  // adjacent column. Operator 3 is an independent one-node component.
  [
    15,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[1], ROW_Y[3]),
      5: frozenPosition(COLUMN_X[1], ROW_Y[2]),
      6: frozenPosition(COLUMN_X[1], ROW_Y[1]),
      4: frozenPosition(COLUMN_X[2], ROW_Y[2]),
      3: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
    }),
  ],
  // Algorithm 16: three chains (6->5, 4->3, 2) converge directly on the
  // single carrier, operator 1 — a three-branch fan-in. Each branch takes
  // its own column; the shortest branch (operator 2) is centred over the
  // carrier for a straight vertical edge. Branch left/right ordering is a
  // discretion call (5/6 left, 3/4 right chosen over the mirror image).
  [
    16,
    frozenLayout({
      5: frozenPosition(COLUMN_X[1], ROW_Y[3]),
      6: frozenPosition(COLUMN_X[1], ROW_Y[2]),
      2: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      4: frozenPosition(COLUMN_X[3], ROW_Y[2]),
    }),
  ],
  // Algorithm 17: same three-branch fan-in shape as Algorithm 16 — same
  // layout.
  [
    17,
    frozenLayout({
      5: frozenPosition(COLUMN_X[1], ROW_Y[3]),
      6: frozenPosition(COLUMN_X[1], ROW_Y[2]),
      2: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      4: frozenPosition(COLUMN_X[3], ROW_Y[2]),
    }),
  ],
  // Algorithm 18: a three-operator chain (6->5->4) plus two direct
  // modulators (2, 3) all converge on carrier 1 — another three-branch
  // fan-in. The 6->5->4 lineage anchors the carrier's own column; operators
  // 2 and 3 flank it. Left/right assignment of 2 vs 3 is a discretion call.
  [
    18,
    frozenLayout({
      3: frozenPosition(COLUMN_X[1], ROW_Y[3]),
      6: frozenPosition(COLUMN_X[2], ROW_Y[1]),
      5: frozenPosition(COLUMN_X[2], ROW_Y[2]),
      4: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      1: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[3], ROW_Y[3]),
    }),
  ],
  // Algorithm 19 (unresolved, D-09 reopen — see algorithms.ts): laid out
  // from the actual stated edges (6->5, 5->4/3/2), not the disputed
  // research carrier table. Operators 2, 3 and 4 are the real carriers
  // here (each has zero outgoing edges) and share depth 1 — a three-way
  // fan-out from operator 5, each carrier its own column, ordered by
  // ascending operator id; operator 1 is a separate, unconnected
  // one-node component placed first (lowest carrier id).
  [
    19,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[4], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      6: frozenPosition(COLUMN_X[3], ROW_Y[2]),
    }),
  ],
  // Algorithm 20: three independent components (carrier 1 alone, 3->2, and
  // 6->5->4), one column each, ordered by ascending carrier id (1, 2, 4).
  [
    20,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      6: frozenPosition(COLUMN_X[3], ROW_Y[2]),
    }),
  ],
  // Algorithm 21: four independent components (carriers 1 and 4 alone,
  // 3->2, 6->5), one column each, ordered by ascending carrier id.
  [
    21,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[4], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[4], ROW_Y[3]),
    }),
  ],
  // Algorithm 22: operator 6 fans out directly to carriers 5, 4 and 3 (a
  // three-way same-depth fan-out, one column per carrier ordered by
  // ascending id, modulator 6 centred above the middle carrier); the
  // independent 2->1 pair is a separate component placed first (lowest
  // carrier id).
  [
    22,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[1], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      5: frozenPosition(COLUMN_X[4], CARRIER_ROW_Y),
    }),
  ],
  // Algorithm 23: four independent components (carriers 2 and 4 alone,
  // 3->1, 6->5), one column each, ordered by ascending carrier id.
  [
    23,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[1], ROW_Y[3]),
      2: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[4], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[4], ROW_Y[3]),
    }),
  ],
  // Algorithm 24: four independent unmodulated carriers (1-4) plus the
  // 6->5 pair, five components/columns ordered by ascending carrier id —
  // uses five columns (COLUMN_X[0] through COLUMN_X[4]) under the k=5
  // centering rule.
  [
    24,
    frozenLayout({
      1: frozenPosition(COLUMN_X[0], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[4], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[4], ROW_Y[3]),
    }),
  ],
  // Algorithm 25: topologically identical to Algorithm 24 once repaired —
  // same layout.
  [
    25,
    frozenLayout({
      1: frozenPosition(COLUMN_X[0], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[4], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[4], ROW_Y[3]),
    }),
  ],
  // Algorithm 26: operators 6 and 5 both modulate carrier 4 and share depth
  // 2 — a same-row collision, split across two columns (6 anchors the
  // carrier's own column with a straight edge, 5 takes the adjacent
  // column); the independent 3->2 pair and carrier 1 are separate
  // components placed first, ordered by ascending carrier id.
  [
    26,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      5: frozenPosition(COLUMN_X[4], ROW_Y[3]),
    }),
  ],
  // Algorithm 27: same non-feedback shape as Algorithm 26 — same layout.
  [
    27,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      5: frozenPosition(COLUMN_X[4], ROW_Y[3]),
    }),
  ],
  // Algorithm 28: three independent components (2->1, 5->4->3, carrier 6
  // alone), one column each, ordered by ascending carrier id (1, 3, 6).
  [
    28,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[1], ROW_Y[3]),
      3: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[2], ROW_Y[3]),
      5: frozenPosition(COLUMN_X[2], ROW_Y[2]),
      6: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
    }),
  ],
  // Algorithm 29: four independent components (carriers 1 and 2 alone,
  // 4->3, 6->5), one column each, ordered by ascending carrier id.
  [
    29,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      5: frozenPosition(COLUMN_X[4], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[4], ROW_Y[3]),
    }),
  ],
  // Algorithm 30: four independent components (carriers 1 and 2 alone,
  // 5->4->3, carrier 6 alone), one column each, ordered by ascending
  // carrier id.
  [
    30,
    frozenLayout({
      1: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[3], ROW_Y[3]),
      5: frozenPosition(COLUMN_X[3], ROW_Y[2]),
      6: frozenPosition(COLUMN_X[4], CARRIER_ROW_Y),
    }),
  ],
  // Algorithm 31: same shape as Algorithm 24 (four independent unmodulated
  // carriers plus the 6->5 pair) — same layout.
  [
    31,
    frozenLayout({
      1: frozenPosition(COLUMN_X[0], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[4], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[4], ROW_Y[3]),
    }),
  ],
  // Algorithm 32: all six operators side by side on the carrier row, one
  // per COLUMN_X entry, in ascending operator order.
  [
    32,
    frozenLayout({
      1: frozenPosition(COLUMN_X[0], CARRIER_ROW_Y),
      2: frozenPosition(COLUMN_X[1], CARRIER_ROW_Y),
      3: frozenPosition(COLUMN_X[2], CARRIER_ROW_Y),
      4: frozenPosition(COLUMN_X[3], CARRIER_ROW_Y),
      5: frozenPosition(COLUMN_X[4], CARRIER_ROW_Y),
      6: frozenPosition(COLUMN_X[5], CARRIER_ROW_Y),
    }),
  ],
]);

/**
 * Read-only facade over the private layout store: lookup and iteration only.
 * Does not expose `set`, `delete`, or `clear` (even under a cast-to-Map attempt
 * those methods are absent, so production entries cannot be replaced at runtime).
 */
export const ALGORITHM_LAYOUTS: ReadonlyMap<AlgorithmId, AlgorithmLayout> = {
  get(key: AlgorithmId): AlgorithmLayout | undefined {
    return ALGORITHM_LAYOUTS_STORE.get(key);
  },
  has(key: AlgorithmId): boolean {
    return ALGORITHM_LAYOUTS_STORE.has(key);
  },
  get size(): number {
    return ALGORITHM_LAYOUTS_STORE.size;
  },
  keys(): IterableIterator<AlgorithmId> {
    return ALGORITHM_LAYOUTS_STORE.keys();
  },
  values(): IterableIterator<AlgorithmLayout> {
    return ALGORITHM_LAYOUTS_STORE.values();
  },
  entries(): IterableIterator<[AlgorithmId, AlgorithmLayout]> {
    return ALGORITHM_LAYOUTS_STORE.entries();
  },
  forEach(
    callbackfn: (
      value: AlgorithmLayout,
      key: AlgorithmId,
      map: ReadonlyMap<AlgorithmId, AlgorithmLayout>,
    ) => void,
    thisArg?: unknown,
  ): void {
    ALGORITHM_LAYOUTS_STORE.forEach((value, key) => {
      callbackfn.call(thisArg, value, key, ALGORITHM_LAYOUTS);
    });
  },
  [Symbol.iterator](): IterableIterator<[AlgorithmId, AlgorithmLayout]> {
    return ALGORITHM_LAYOUTS_STORE.entries();
  },
};

/**
 * `getAlgorithmLayout` never throws — validates with `isAlgorithmId` first,
 * mirroring `derive-role.ts`'s never-throw posture, and returns `null` for
 * anything outside 1..32 or for an id not yet authored in
 * `ALGORITHM_LAYOUTS`. This is the only lookup function this module ships —
 * see `04-02-PLAN.md`'s design decision against a shipped position-computing
 * function.
 */
export function getAlgorithmLayout(algorithmId: number): AlgorithmLayout | null {
  if (!isAlgorithmId(algorithmId)) {
    return null;
  }
  return ALGORITHM_LAYOUTS.get(algorithmId) ?? null;
}
