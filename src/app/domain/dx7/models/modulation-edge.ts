import { isOperatorId, type OperatorId } from './operator';

/**
 * A directed modulation connection between two operators: `from` modulates
 * `to`. Per D-01, feedback is modeled as a self-loop on this same type
 * (`from === to`) rather than a separate `FeedbackDefinition` type — reusing
 * the existing edge model instead of introducing a parallel concept, and
 * matching `docs/ARCHITECTURE.md`'s "explicit feedback edge" language.
 *
 * The canonical 32-algorithm dataset built from these edges lives in
 * `algorithms.ts` (Phase 2).
 */
export interface ModulationEdge {
  readonly from: OperatorId;
  readonly to: OperatorId;
}

export function isModulationEdge(value: unknown): value is ModulationEdge {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['from'] === 'number' &&
    typeof candidate['to'] === 'number' &&
    isOperatorId(candidate['from']) &&
    isOperatorId(candidate['to'])
  );
}
