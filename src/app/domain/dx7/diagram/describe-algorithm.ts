import type { AlgorithmDefinition } from '../models/algorithm-definition';
import { isUnresolvedAlgorithm } from '../models/algorithm-definition';
import { deriveCarriers, getFeedbackOperator } from '../models/derive-role';

/**
 * Pure, auto-generated accessible title/description text (D-11) — never
 * hand-authored per algorithm, so it can't drift from `AlgorithmDefinition`
 * the way a hand-written description could (the same class of bug Phase 2's
 * Algorithm 26/27 correction already caused once for routing data). Mirrors
 * `derive-role.ts`'s never-throw, always-resolvable posture: given a valid
 * `AlgorithmDefinition`, both functions always return a string.
 */

export function buildDiagramTitle(algorithm: AlgorithmDefinition): string {
  return `Algorithm ${algorithm.id} routing diagram`;
}

function joinWithAnd(items: readonly string[]): string {
  if (items.length === 0) {
    return '';
  }
  if (items.length === 1) {
    return items[0];
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Builds the full D-12 enumeration: every modulation edge individually
 * (never a summarized count), the carrier list, the feedback operator, and
 * — only when the dataset flags the row as `reviewStatus: 'unresolved'` — a
 * routing-note clause that keeps that provenance flag visible to a learner
 * instead of presenting a flagged row as settled fact.
 */
export function buildDiagramDescription(algorithm: AlgorithmDefinition): string {
  const clauses: string[] = [];

  clauses.push(`Algorithm ${algorithm.id}: ${algorithm.name}.`);

  const modulationEdges = algorithm.edges.filter((edge) => edge.from !== edge.to);
  if (modulationEdges.length > 0) {
    const enumeration = modulationEdges
      .map((edge) => `operator ${edge.from} modulates operator ${edge.to}`)
      .join('; ');
    clauses.push(`Modulation routing: ${enumeration}.`);
  } else {
    clauses.push('No operator modulates another; all six operators feed the output directly.');
  }

  const carriers = deriveCarriers(algorithm).map((id) => `operator ${id}`);
  clauses.push(`Carriers reaching the output: ${joinWithAnd(carriers)}.`);

  const feedbackOperator = getFeedbackOperator(algorithm);
  clauses.push(
    feedbackOperator === null
      ? 'Feedback: none.'
      : `Feedback: operator ${feedbackOperator} modulates itself.`,
  );

  if (isUnresolvedAlgorithm(algorithm)) {
    clauses.push(
      "Routing note: this algorithm's edge list is flagged for historical review and may not match the original hardware.",
    );
  }

  return clauses.join(' ');
}
