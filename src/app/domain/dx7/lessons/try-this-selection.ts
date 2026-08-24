import { deriveCarriers, deriveIsolatedCarriers, getFeedbackOperator, getOperatorRole } from '../models/derive-role';
import { deepestModulators, maxModulatorHopDistance } from '../models/hop-distance';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import type { AlgorithmDefinition } from '../models/algorithm-definition';
import { isAdditiveLikeAlgorithm } from './structural-lesson-patch';
import type { TryThisDirection, TryThisParam, TryThisStep } from './lesson-definition';

/**
 * The three structured fields of a `TryThisStep` without the two prose
 * fields — what `selectTryThisTarget` derives from an algorithm's own graph,
 * before any lesson-specific instruction/expectedEffect text is attached.
 */
export interface TryThisTarget {
  readonly targetOperator: OperatorId;
  readonly targetParam: TryThisParam;
  readonly direction: TryThisDirection;
}

/**
 * D-11's systematic try-this selection rule: four ordered clauses, first
 * match winning, each isolating a different structural feature. Never
 * conflates the feedback operator with the deepest modulator — they
 * disagree on roughly a third of the dataset (`11-RESEARCH.md` Pitfall 2),
 * which is precisely what clauses two and three exploit.
 */
export function selectTryThisTarget(algorithm: AlgorithmDefinition): TryThisTarget {
  // Clause 1 — additive-like: the distinguishing feature is independence.
  // Removing one bare partial from the sum is how Algorithm 32's own
  // hand-authored lesson proves it.
  if (isAdditiveLikeAlgorithm(algorithm)) {
    const isolatedCarriers = deriveIsolatedCarriers(algorithm);
    const target = isolatedCarriers[0];
    if (target === undefined) {
      // Unreachable: isAdditiveLikeAlgorithm requires at least
      // MIN_ADDITIVE_LIKE_ISOLATED_CARRIERS (2) isolated carriers.
      throw new RangeError('selectTryThisTarget: additive-like algorithm has no isolated carriers');
    }
    return { targetOperator: target, targetParam: 'outputLevel', direction: 'decrease' };
  }

  const feedbackOperator = getFeedbackOperator(algorithm);
  const feedbackIsModulator =
    feedbackOperator !== null && getOperatorRole(algorithm, feedbackOperator) === 'modulator';
  const deepest = deepestModulators(algorithm);
  const maxHop = maxModulatorHopDistance(algorithm);

  // Clause 2 — the feedback loop has been relocated off the chain top: the
  // one legitimate difference between the feedback-relocated sibling pairs
  // 11-RESEARCH.md catalogues.
  if (feedbackIsModulator && feedbackOperator !== null && !deepest.includes(feedbackOperator)) {
    return { targetOperator: feedbackOperator, targetParam: 'ratio', direction: 'increase' };
  }

  // Clause 3 — chain depth: target the feedback operator when it is among
  // the deepest modulators, otherwise the lowest-id deepest modulator. The
  // feedback-operator preference is the stated tie-break that keeps
  // Algorithms 3 and 10 (same edges, different feedback operator, two
  // operators tied at the maximum depth) from selecting the same target.
  if (maxHop >= 2) {
    const target = feedbackOperator !== null && deepest.includes(feedbackOperator) ? feedbackOperator : deepest[0];
    if (target === undefined) {
      // Unreachable: maxHop >= 2 implies at least one modulator, so
      // deepestModulators cannot be empty here.
      throw new RangeError('selectTryThisTarget: maxModulatorHopDistance >= 2 but no deepest modulator found');
    }
    return { targetOperator: target, targetParam: 'ratio', direction: 'increase' };
  }

  // Clause 4 — everything else: every modulator sits one hop from output.
  if (feedbackIsModulator && feedbackOperator !== null) {
    return { targetOperator: feedbackOperator, targetParam: 'ratio', direction: 'increase' };
  }
  const modulators = OPERATOR_IDS.filter((id) => getOperatorRole(algorithm, id) === 'modulator');
  const lowestModulator = modulators[0];
  if (lowestModulator !== undefined) {
    return { targetOperator: lowestModulator, targetParam: 'ratio', direction: 'increase' };
  }
  // Unreachable against today's dataset: every one of the 32 algorithms has
  // at least one modulator. Kept only so this function is total.
  const carriers = deriveCarriers(algorithm);
  const fallbackCarrier = carriers[0];
  if (fallbackCarrier === undefined) {
    throw new RangeError('selectTryThisTarget: algorithm has neither modulators nor carriers');
  }
  return { targetOperator: fallbackCarrier, targetParam: 'outputLevel', direction: 'decrease' };
}

/**
 * Builds a frozen `TryThisStep` by spreading `selectTryThisTarget`'s result
 * and adding the two prose fields — routing every lesson row through this
 * factory is what makes it impossible for a row's try-this target to drift
 * away from the rule. Raises a `RangeError` when either prose string is
 * empty so a row can never ship with blank learner-facing copy.
 */
export function buildStructuralTryThis(
  algorithm: AlgorithmDefinition,
  instruction: string,
  expectedEffect: string,
): TryThisStep {
  if (instruction.length === 0) {
    throw new RangeError('buildStructuralTryThis: instruction must not be empty');
  }
  if (expectedEffect.length === 0) {
    throw new RangeError('buildStructuralTryThis: expectedEffect must not be empty');
  }
  const target = selectTryThisTarget(algorithm);
  return Object.freeze({
    ...target,
    instruction,
    expectedEffect,
  });
}
