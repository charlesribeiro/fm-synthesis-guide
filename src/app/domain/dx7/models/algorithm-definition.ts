import type { AlgorithmId } from './algorithm';
import type { ModulationEdge } from './modulation-edge';

/**
 * The four-group teaching taxonomy (D-10), verified against carrier-set data
 * and an independent taxonomy description in `RESEARCH.md`. Group derives
 * from graph shape (Additive Stacks 1–6, Tree/Branch 7–18, Rooting 19–25,
 * Parallel 26–32); lesson prose itself stays out of scope for Phase 2.
 */
export type TeachingTag = 'additive-stacks' | 'tree-branch' | 'rooting' | 'parallel';

export const TEACHING_TAGS: readonly TeachingTag[] = Object.freeze([
  'additive-stacks',
  'tree-branch',
  'rooting',
  'parallel',
]);

/**
 * Historical-fidelity review status (D-09) for an algorithm's entered edge
 * list. Absent (`undefined`) is the default and means the entered edges are
 * confirmed; `'unresolved'` flags a definition whose edges are the stated
 * research routing retained under a stop-condition, pending topology review
 * (see `02-DATASET-REVIEW.md`). This is provenance metadata only —
 * `validateAlgorithm` does not gate structural acceptance on it, and it is
 * never derived, only ever authored alongside the row it describes.
 */
export type AlgorithmReviewStatus = 'unresolved';

/**
 * A single DX7-style algorithm: an id, a display name, and its full set of
 * modulation edges (including any feedback self-loop, per D-01).
 *
 * Deliberately excludes two fields a naive sketch might include:
 * - No stored operator-role/`carriers` field (D-05, D-07) — role is always
 *   derived from `edges` on demand by `derive-role.ts`, never cached here,
 *   so it cannot drift from the edge list it would summarize. This
 *   supersedes the `readonly carriers` (an `OperatorId[]` field) sketched in
 *   `GSD_NEW_PROJECT_PROMPT.md` — do not reintroduce it (RESEARCH.md
 *   Pitfall 3).
 * - No feedback level/depth/amount field (D-02) — that is instrument/patch
 *   state owned by Phase 3, not structural algorithm data. This interface
 *   only carries the structural fact of *which* operator (if any) has a
 *   feedback self-loop, and only implicitly, via `edges`.
 */
export interface AlgorithmDefinition {
  readonly id: AlgorithmId;
  readonly name: string;
  readonly edges: readonly ModulationEdge[];
  readonly teachingTags: readonly TeachingTag[];
  readonly reviewStatus?: AlgorithmReviewStatus;
}

/**
 * Reads review-status metadata rather than comparing `algorithm.id` against
 * a hardcoded id — the id of the next algorithm review flags is a data fact,
 * not something a caller should need to know in advance.
 */
export function isUnresolvedAlgorithm(algorithm: AlgorithmDefinition): boolean {
  return algorithm.reviewStatus === 'unresolved';
}
