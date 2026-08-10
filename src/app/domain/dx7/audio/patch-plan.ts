import type { AlgorithmDefinition } from '../models/algorithm-definition';
import { getFeedbackOperator } from '../models/derive-role';
import type { OperatorId } from '../models/operator';

/**
 * Pure, data-driven patch plan (D-01, `05-02-PLAN.md`) — the single
 * traversal every one of the 32 algorithms goes through to become an
 * ordered list of Web Audio connections. Zero Angular and zero Web Audio
 * references live here (DOMAIN-04's ESLint gate rejects even a type-only
 * `@angular/*` import on `src/app/domain/**`); the engine in
 * `src/app/core/audio/web-audio-synth-engine.ts` is the only place this
 * plan is ever applied against real `AudioNode`s.
 */
export interface OperatorConnection {
  readonly from: OperatorId;
  readonly to: OperatorId;
  /** True only for the feedback self-loop: `from === to` and that
   * operator equals `getFeedbackOperator(algorithm)`. Other outgoing
   * edges from the feedback operator stay false. */
  readonly isFeedback: boolean;
}

/**
 * Maps `algorithm.edges` to an ordered, feedback-flagged connection list —
 * one traversal, no per-algorithm special case. Declaration order is
 * preserved verbatim; nothing is filtered or reordered. Mirrors
 * `algorithms.ts`'s own `edges()` helper freezing convention: the
 * returned array and every entry are frozen, and the source algorithm is
 * never mutated.
 */
export function planConnections(algorithm: AlgorithmDefinition): readonly OperatorConnection[] {
  const feedbackOperator = getFeedbackOperator(algorithm);
  return Object.freeze(
    algorithm.edges.map((edge) =>
      Object.freeze({
        from: edge.from,
        to: edge.to,
        isFeedback: edge.from === edge.to && edge.from === feedbackOperator,
      }),
    ),
  );
}
