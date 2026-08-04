/**
 * The DX7 architecture has exactly six operators per algorithm, always
 * numbered 1–6. Restricting the type (rather than using `number`) lets the
 * compiler catch out-of-range operator references at the call site instead
 * of at runtime.
 *
 * The canonical 32-algorithm dataset and its graph validation are built in
 * Phase 2 (`docs/ROADMAP_SEED.md`); this file exists now only so the audio
 * engine placeholder interface (`core/audio/synth-engine.ts`) has a real
 * type to reference instead of `number`.
 */
export type OperatorId = 1 | 2 | 3 | 4 | 5 | 6;

export const OPERATOR_IDS: readonly OperatorId[] = [1, 2, 3, 4, 5, 6];

export function isOperatorId(value: number): value is OperatorId {
  return OPERATOR_IDS.includes(value as OperatorId);
}
