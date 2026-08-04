/**
 * A DX7 algorithm id, 1–32. Left as `number` (rather than a literal union
 * like `OperatorId`) because 32 members adds no compile-time safety over a
 * runtime boundary check — validate with {@link isAlgorithmId} wherever an
 * id crosses an external boundary (route params, imported patches, etc.).
 *
 * The canonical dataset of all 32 algorithms is built in Phase 2.
 */
export type AlgorithmId = number;

export const MIN_ALGORITHM_ID = 1;
export const MAX_ALGORITHM_ID = 32;

export function isAlgorithmId(value: number): value is AlgorithmId {
  return Number.isInteger(value) && value >= MIN_ALGORITHM_ID && value <= MAX_ALGORITHM_ID;
}
