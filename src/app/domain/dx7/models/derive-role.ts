import { OPERATOR_IDS, type OperatorId } from './operator';
import type { AlgorithmDefinition } from './algorithm-definition';

/**
 * Only two roles exist (D-06) — feedback is an orthogonal boolean layered on
 * top of either role, never a third `feedbackModulator` value.
 */
export type OperatorRole = 'carrier' | 'modulator';

/**
 * Pure, on-demand role derivation (D-07) — never precomputed or persisted on
 * `AlgorithmDefinition` itself; every call recomputes the answer from
 * `edges`. An operator is a carrier iff it has zero
 * outgoing edges to *another* operator (D-05); its own feedback self-loop
 * does not count as "modulates another operator".
 *
 * The `edge.to !== operatorId` conjunct is load-bearing: without it, an
 * operator's own feedback self-loop (`from === to === operatorId`) would
 * satisfy `edge.from === operatorId` and misclassify a feedback-carrying
 * carrier (e.g. Algorithm 32's operator 6) as a modulator (RESEARCH.md
 * Pitfall 1).
 */
export function getOperatorRole(
  algorithm: AlgorithmDefinition,
  operatorId: OperatorId,
): OperatorRole {
  const modulatesAnotherOperator = algorithm.edges.some(
    (edge) => edge.from === operatorId && edge.to !== operatorId,
  );
  return modulatesAnotherOperator ? 'modulator' : 'carrier';
}

/**
 * Filters the fixed, ascending `OPERATOR_IDS` array rather than scanning the
 * edges array for absent sources — this fixes the output order to 1..6
 * regardless of the order edges were declared in.
 */
export function deriveCarriers(algorithm: AlgorithmDefinition): readonly OperatorId[] {
  return OPERATOR_IDS.filter((id) => getOperatorRole(algorithm, id) === 'carrier');
}

export function hasFeedbackLoop(algorithm: AlgorithmDefinition, operatorId: OperatorId): boolean {
  return algorithm.edges.some((edge) => edge.from === operatorId && edge.to === operatorId);
}

/**
 * Returns the operator that carries the algorithm's feedback self-loop, or
 * `null` when none exists — absence of a self-loop is how "no feedback" is
 * represented (D-03), not an explicit `hasFeedback: false` marker.
 */
export function getFeedbackOperator(algorithm: AlgorithmDefinition): OperatorId | null {
  const feedbackEdge = algorithm.edges.find((edge) => edge.from === edge.to);
  return feedbackEdge ? feedbackEdge.from : null;
}
