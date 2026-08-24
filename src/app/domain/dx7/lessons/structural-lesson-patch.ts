import { deriveCarriers, deriveIsolatedCarriers, getFeedbackOperator, type OperatorRole } from '../models/derive-role';
import { hopDistanceFromOutput, maxModulatorHopDistance } from '../models/hop-distance';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import {
  DEFAULT_ENVELOPE,
  DEFAULT_OPERATOR_PARAMETERS,
  MAX_OUTPUT_LEVEL,
  MIN_OUTPUT_LEVEL,
  type Dx7Envelope,
  type OperatorParameters,
} from '../models/operator-parameters';
import { MAX_FEEDBACK_LEVEL, MIN_FEEDBACK_LEVEL, type InstrumentPatch, type OperatorParameterSet } from '../models/patch';
import type { AlgorithmDefinition } from '../models/algorithm-definition';

/**
 * D-05's "one single shared envelope shape" (Phase 11): the exact rates and
 * levels `lessons.ts`'s former module-local `ALGORITHM_1_MODULATOR_ENVELOPE`
 * carried, promoted to one shared exported constant so the "one envelope"
 * rule is literally one object rather than two identical ones that could
 * later drift. Rate 16 takes the 99-to-40 drop roughly one second under the
 * geometric rate curve (`value-conversion.ts`), so a held note opens bright
 * and audibly mellows — the same timbral-evolution shape Algorithm 1's
 * lesson already demonstrated. Now serves every modulator in every lesson,
 * including Algorithm 1's own. Frozen at every level, mirroring
 * `DEFAULT_ENVELOPE`.
 */
export const SHARED_MODULATOR_ENVELOPE: Dx7Envelope = Object.freeze({
  rates: Object.freeze([80, 16, 16, 55] as const),
  levels: Object.freeze([99, 70, 40, 0] as const),
});

/** D-06: every carrier's output level, regardless of algorithm. */
export const CARRIER_OUTPUT_LEVEL = 75;
/** D-06: a modulator one hop from output. */
export const MODULATOR_BASE_OUTPUT_LEVEL = 60;
/** D-06: each extra hop from output costs this many output-level points. */
export const MODULATOR_OUTPUT_LEVEL_STEP = 5;
/**
 * D-08: the one fixed mid-scale feedback value every algorithm with a
 * feedback self-loop gets, matching Algorithm 1's existing hand-authored
 * value so the self-loop is reliably audible — applied uniformly rather than
 * a per-algorithm tuning knob. Mid-scale on the `MIN_FEEDBACK_LEVEL`..
 * `MAX_FEEDBACK_LEVEL` range.
 */
export const SHARED_FEEDBACK_LEVEL = 3;

// SHARED_FEEDBACK_LEVEL must actually sit on the feedback depth scale it
// documents itself against — a compile-time-adjacent sanity check, not a
// runtime branch (the two bounds are both frozen module constants).
if (SHARED_FEEDBACK_LEVEL < MIN_FEEDBACK_LEVEL || SHARED_FEEDBACK_LEVEL > MAX_FEEDBACK_LEVEL) {
  throw new RangeError(
    `SHARED_FEEDBACK_LEVEL (${SHARED_FEEDBACK_LEVEL}) must be within ${MIN_FEEDBACK_LEVEL}..${MAX_FEEDBACK_LEVEL}`,
  );
}

/** D-07's additive-like predicate: minimum number of derived carriers. */
export const MIN_ADDITIVE_LIKE_CARRIERS = 4;
/** D-07's additive-like predicate: minimum number of isolated carriers. */
export const MIN_ADDITIVE_LIKE_ISOLATED_CARRIERS = 2;

/**
 * D-06's output-level rule: a carrier always lands on `CARRIER_OUTPUT_LEVEL`;
 * a modulator descends by `MODULATOR_OUTPUT_LEVEL_STEP` for every hop beyond
 * the first, clamped into `MIN_OUTPUT_LEVEL`..`MAX_OUTPUT_LEVEL`. Reproduces
 * the descending-by-hop shape Algorithm 1's hand-authored chain already
 * uses — carriers well above modulators, each chain step one notch quieter
 * than the one closer to output — structurally rather than verbatim. The
 * deepest operator in the whole dataset sits at hop 4 (Algorithm 7's
 * operator 6), which lands on 45 and never approaches the clamp.
 */
export function structuralOutputLevel(role: OperatorRole, hopDistance: number): number {
  if (role === 'carrier') {
    return CARRIER_OUTPUT_LEVEL;
  }
  const level = MODULATOR_BASE_OUTPUT_LEVEL - MODULATOR_OUTPUT_LEVEL_STEP * (hopDistance - 1);
  return Math.min(MAX_OUTPUT_LEVEL, Math.max(MIN_OUTPUT_LEVEL, level));
}

/**
 * D-07's ratio exception expressed as a structural predicate over the
 * algorithm's own graph, rather than a hand-maintained id list. True when
 * all three hold: `deriveCarriers` returns at least
 * `MIN_ADDITIVE_LIKE_CARRIERS` operators; the algorithm has at least
 * `MIN_ADDITIVE_LIKE_ISOLATED_CARRIERS` isolated carriers; and no modulator
 * sits deeper than hop 1 (`maxModulatorHopDistance` is at most `1`).
 * Together the three clauses mean: mostly-carrier, several of them bare and
 * unmodulated, and no chain deeper than one hop — the structural shape that
 * makes the algorithm's teaching point independent partials summing, in the
 * Algorithm 32 sense, rather than routing depth. `11-RESEARCH.md` calls this
 * the Algorithm-32-like set: it accepts Algorithms 21, 23, 24, 25, 29 and 31
 * (plus Algorithm 32 itself, which trivially satisfies all three clauses).
 * It rejects the borderline rows: 20/26/27 have too few isolated carriers
 * (only 1 of 6), 22 has zero isolated carriers despite 4 derived carriers
 * (every carrier is fed by its fan-out operator), and 30 has a genuine
 * hop-2-deep chain (`5→4→3`) that disqualifies it on the third clause alone.
 */
export function isAdditiveLikeAlgorithm(algorithm: AlgorithmDefinition): boolean {
  const carriers = deriveCarriers(algorithm);
  const isolatedCarriers = deriveIsolatedCarriers(algorithm);
  return (
    carriers.length >= MIN_ADDITIVE_LIKE_CARRIERS &&
    isolatedCarriers.length >= MIN_ADDITIVE_LIKE_ISOLATED_CARRIERS &&
    maxModulatorHopDistance(algorithm) <= 1
  );
}

/**
 * D-07's ratio rule: an additive-like algorithm gives every operator its own
 * id as its ratio (operator ids 1 through 6 are all members of
 * `COARSE_RATIOS`, so both branches are legal by construction), matching
 * Algorithm 32's hand-authored lesson exactly. Every other algorithm gets
 * ratio `1` on every operator — routing carries the lesson, matching
 * Algorithm 1.
 */
export function structuralRatio(algorithm: AlgorithmDefinition, operatorId: OperatorId): number {
  return isAdditiveLikeAlgorithm(algorithm) ? operatorId : 1;
}

/**
 * D-04 through D-08's shared builder: derives every operator's role from
 * `deriveCarriers`, every output level from `structuralOutputLevel` fed the
 * role and `hopDistanceFromOutput`, every ratio from `structuralRatio`,
 * every envelope from role (`DEFAULT_ENVELOPE` for a carrier,
 * `SHARED_MODULATOR_ENVELOPE` for a modulator), and feedback from
 * `getFeedbackOperator`. Mirrors `lessons.ts`'s existing
 * `buildAlgorithm32StartingPatch`/`buildAlgorithm1StartingPatch`
 * construction style: frozen at every level (each operator's parameters
 * object, the `operators` record, and the returned patch itself).
 *
 * The `getFeedbackOperator(algorithm) === null` branch (feedback `0`) is
 * unreachable against today's dataset — every one of the 32 rows declares
 * exactly one self-loop — and is kept for the same defensive reason the
 * codebase keeps other unrepresentable-but-contractual branches (mirrors
 * `getFeedbackOperator`'s own D-03 defensive posture).
 */
export function buildStructuralStartingPatch(algorithm: AlgorithmDefinition): InstrumentPatch {
  const carriers = deriveCarriers(algorithm);
  const feedbackOperator = getFeedbackOperator(algorithm);

  const operatorEntries = OPERATOR_IDS.map((operatorId) => {
    const role: OperatorRole = carriers.includes(operatorId) ? 'carrier' : 'modulator';
    const hop = hopDistanceFromOutput(algorithm, operatorId);
    const parameters: OperatorParameters = Object.freeze({
      ...DEFAULT_OPERATOR_PARAMETERS,
      ratio: structuralRatio(algorithm, operatorId),
      outputLevel: structuralOutputLevel(role, hop),
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
