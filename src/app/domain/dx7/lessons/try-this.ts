import {
  COARSE_RATIOS,
  MAX_DETUNE,
  MAX_ENVELOPE_LEVEL,
  MAX_OUTPUT_LEVEL,
  MIN_DETUNE,
  MIN_ENVELOPE_LEVEL,
  MIN_OUTPUT_LEVEL,
  type OperatorParameters,
} from '../models/operator-parameters';
import type { TryThisParam, TryThisStep } from './lesson-definition';

/**
 * D-06's "moved `targetParam` in `direction`" half, as a pure predicate:
 * compares the specific `targetParam` value on `baseline` vs. `current`,
 * never the whole `OperatorParameters` object by reference —
 * `InstrumentState.updateOperator` deliberately keeps every untouched
 * operator's parameters object reference-identical to the one read before
 * the call (RESEARCH.md Pitfall 4), so a reference comparison here would
 * silently never fire for the operator that actually changed, and would
 * wrongly fire for one that merely lost reference identity for an
 * unrelated reason.
 */
export function hasMovedTowardTarget(
  baseline: OperatorParameters,
  current: OperatorParameters,
  tryThis: TryThisStep,
): boolean {
  const baselineValue = baseline[tryThis.targetParam];
  const currentValue = current[tryThis.targetParam];
  return tryThis.direction === 'increase' ? currentValue > baselineValue : currentValue < baselineValue;
}

/**
 * The ascending ladder of legal values for a given try-this parameter — the
 * domain-owned source the try-this range control's positions index into, so
 * every value the control can write is already valid by construction
 * (T-06-04) and `InstrumentState.updateOperator`'s `RangeError` guards stay
 * the last line of defence, never a bypassed one.
 *
 * Total over `TryThisParam` with no default branch: adding a member to that
 * union without extending this `switch` is a compile error, not a silent
 * gap. Every bound is read from `operator-parameters.ts`'s exported
 * constants — no numeric literal bound is written in this file.
 */
export function tryThisParamValues(param: TryThisParam): readonly number[] {
  switch (param) {
    case 'ratio':
      return COARSE_RATIOS;
    case 'detune':
      return integerRange(MIN_DETUNE, MAX_DETUNE);
    case 'outputLevel':
      return integerRange(MIN_OUTPUT_LEVEL, MAX_OUTPUT_LEVEL);
    case 'envelopeLevel':
      return integerRange(MIN_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL);
  }
}

function integerRange(min: number, max: number): readonly number[] {
  return Object.freeze(Array.from({ length: max - min + 1 }, (_, index) => min + index));
}
