import type { AlgorithmId } from './algorithm';
import { OPERATOR_IDS, type OperatorId } from './operator';
import { DEFAULT_OPERATOR_PARAMETERS, type OperatorParameters } from './operator-parameters';

/**
 * All six operators' parameters, keyed on the restricted `OperatorId`
 * literal union rather than a partial map — keying on the literal union
 * makes all six entries compiler-required, so a patch can never be missing
 * an operator's parameters.
 */
export type OperatorParameterSet = Readonly<Record<OperatorId, OperatorParameters>>;

/**
 * The full in-memory instrument patch (Phase 3, STATE-01/STATE-02): which of
 * the 32 algorithms is selected, all six operators' parameters, and the
 * global feedback depth.
 *
 * `feedback` is the depth value only (0-7, Phase 2 D-02's scale) — *which*
 * operator that depth applies to is always derived from the selected
 * algorithm's self-loop edge (`derive-role.ts`'s `getFeedbackOperator`),
 * never stored here.
 */
export interface InstrumentPatch {
  readonly algorithmId: AlgorithmId;
  readonly operators: OperatorParameterSet;
  readonly feedback: number;
}

/** Phase 2 D-02's feedback depth scale. */
export const MIN_FEEDBACK_LEVEL = 0;
export const MAX_FEEDBACK_LEVEL = 7;

/** D-11: algorithm 1 — the dataset's first row — is the default selection. */
export const DEFAULT_ALGORITHM_ID: AlgorithmId = 1;

function buildDefaultOperators(): OperatorParameterSet {
  const entries = OPERATOR_IDS.map((id) => [id, DEFAULT_OPERATOR_PARAMETERS] as const);
  return Object.freeze(Object.fromEntries(entries)) as OperatorParameterSet;
}

/**
 * D-08/D-09/D-11: the uniform default patch used both on first load and by a
 * future `reset` command — the same formula for every operator, independent
 * of which algorithm is selected. Frozen at every level (the patch object,
 * the operators record, and — via the already-frozen
 * `DEFAULT_OPERATOR_PARAMETERS` reused for all six entries — each operator's
 * parameters object) so no consumer can corrupt the shared reset/init
 * target in place (T-03-01).
 */
export const DEFAULT_PATCH: InstrumentPatch = Object.freeze({
  algorithmId: DEFAULT_ALGORITHM_ID,
  operators: buildDefaultOperators(),
  feedback: 0,
});

/**
 * Throwing guard for the instrument-level feedback depth, mirroring
 * `validateOperatorParameters`'s `RangeError` convention.
 */
export function validateFeedbackLevel(level: number): void {
  if (!Number.isInteger(level) || level < MIN_FEEDBACK_LEVEL || level > MAX_FEEDBACK_LEVEL) {
    throw new RangeError(
      `feedback must be an integer in ${MIN_FEEDBACK_LEVEL}..${MAX_FEEDBACK_LEVEL}, received ${level}`,
    );
  }
}
