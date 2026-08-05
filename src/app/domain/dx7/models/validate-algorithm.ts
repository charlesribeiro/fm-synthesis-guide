import { isAlgorithmId, MAX_ALGORITHM_ID, MIN_ALGORITHM_ID } from './algorithm';
import { isModulationEdge } from './modulation-edge';
import { TEACHING_TAGS } from './algorithm-definition';
import type { AlgorithmDefinition } from './algorithm-definition';
import { deriveCarriers } from './derive-role';

/**
 * Thrown by {@link validateAlgorithm} and {@link validateAlgorithmSet} for
 * any structural violation. Message-only — no codes or statuses, since this
 * is a pure-domain guard, not an HTTP boundary.
 */
export class InvalidAlgorithmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAlgorithmError';
  }
}

/**
 * Formats an arbitrary diagnostic value for error messages without throwing.
 * `String()` / template interpolation can throw on Symbol (in templates) or on
 * objects whose `toString`/`valueOf` throws — any of which would escape the
 * InvalidAlgorithmError contract. Falls back to `Object.prototype.toString`.
 */
function formatDiagnosticValue(value: unknown): string {
  try {
    if (typeof value === 'bigint') {
      return `${value}n`;
    }
    return String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/**
 * Formats an edge for error messages without throwing. `JSON.stringify` can
 * throw on values such as BigInt (`6n`), which would escape the
 * InvalidAlgorithmError contract for malformed edges.
 */
function formatEdgeForError(edge: unknown): string {
  if (edge == null || typeof edge !== 'object') {
    return formatDiagnosticValue(edge);
  }
  const record = edge as { from?: unknown; to?: unknown };
  return `{ from: ${formatDiagnosticValue(record.from)}, to: ${formatDiagnosticValue(record.to)} }`;
}

/**
 * Formats a teachingTag for error messages without throwing.
 */
function formatTagForError(tag: unknown): string {
  return formatDiagnosticValue(tag);
}

/**
 * Throwing structural guard for `AlgorithmDefinition` (DOMAIN-02). Exported
 * as a reusable runtime guard, not a test-only helper, so a future boundary
 * (e.g. Phase 12's patch-import surface) can apply the same rules to
 * externally supplied data (CLAUDE.md "validate external data at
 * boundaries").
 *
 * Rule order matters for one pair: the zero-carriers check runs before the
 * higher-modulates-lower check. Operator 1 can never satisfy
 * `edge.from === 1 && edge.to !== 1` while also respecting the
 * higher-modulates-lower rule (no operator id is lower than 1), so it is
 * unconditionally a carrier in any algorithm that also passes that rule —
 * meaning zero carriers is only reachable via an edge that *also* violates
 * higher-modulates-lower. Checking zero-carriers first surfaces the more
 * specific zero-output diagnostic for that shared edge.
 */
export function validateAlgorithm(algorithm: AlgorithmDefinition): void {
  // Defensive top-level shape checks (WR-02): the doc comment above
  // documents future use against externally supplied, untrusted data (e.g.
  // Phase 12's patch-import surface) that is not guaranteed to already be
  // TypeScript-shaped the way ALGORITHMS's own rows are. Malformed input
  // here must still surface as InvalidAlgorithmError, not an unstructured
  // TypeError, so every caller can rely on catching a single error type.
  if (algorithm == null || typeof algorithm !== 'object') {
    throw new InvalidAlgorithmError('Algorithm <unknown>: value is not an object');
  }
  const algorithmLabel =
    algorithm.id === undefined || algorithm.id === null
      ? '<unknown>'
      : formatDiagnosticValue(algorithm.id);
  if (!Array.isArray(algorithm.teachingTags)) {
    throw new InvalidAlgorithmError(`Algorithm ${algorithmLabel}: teachingTags must be an array`);
  }
  if (!Array.isArray(algorithm.edges)) {
    throw new InvalidAlgorithmError(`Algorithm ${algorithmLabel}: edges must be an array`);
  }
  if (typeof algorithm.name !== 'string') {
    throw new InvalidAlgorithmError(`Algorithm ${algorithmLabel}: name must be a string`);
  }

  // Impossible IDs.
  if (!isAlgorithmId(algorithm.id)) {
    throw new InvalidAlgorithmError(
      `Algorithm ${algorithmLabel}: id is not a valid algorithm id (expected an integer ${MIN_ALGORITHM_ID}..${MAX_ALGORITHM_ID})`,
    );
  }

  // teachingTags must be non-empty and every value must be a recognized D-10 tag.
  if (algorithm.teachingTags.length === 0) {
    throw new InvalidAlgorithmError(`Algorithm ${algorithm.id}: teachingTags must not be empty`);
  }
  for (const tag of algorithm.teachingTags) {
    if (!TEACHING_TAGS.includes(tag)) {
      throw new InvalidAlgorithmError(
        `Algorithm ${algorithm.id}: teachingTag "${formatTagForError(tag)}" is not one of ${TEACHING_TAGS.join(', ')}`,
      );
    }
  }

  // name must carry a non-blank display label.
  if (algorithm.name.trim().length === 0) {
    throw new InvalidAlgorithmError(`Algorithm ${algorithm.id}: name must not be empty or whitespace-only`);
  }

  // Invalid edges: every entry must be a structurally valid ModulationEdge —
  // this also catches an operator id outside 1..6, including on a self-loop.
  for (const edge of algorithm.edges) {
    if (!isModulationEdge(edge)) {
      throw new InvalidAlgorithmError(
        `Algorithm ${algorithm.id}: edge ${formatEdgeForError(edge)} is not a valid modulation edge`,
      );
    }
  }

  // Invalid edges: the same from/to pair must not be declared twice.
  const seenEdgeKeys = new Set<string>();
  for (const edge of algorithm.edges) {
    const key = `${edge.from}->${edge.to}`;
    if (seenEdgeKeys.has(key)) {
      throw new InvalidAlgorithmError(
        `Algorithm ${algorithm.id}: edge ${edge.from}->${edge.to} is declared more than once`,
      );
    }
    seenEdgeKeys.add(key);
  }

  // Malformed feedback declarations (D-04): at most one feedback self-loop.
  const feedbackEdges = algorithm.edges.filter((edge) => edge.from === edge.to);
  if (feedbackEdges.length > 1) {
    const pairs = feedbackEdges.map((edge) => `${edge.from}->${edge.to}`).join(', ');
    throw new InvalidAlgorithmError(
      `Algorithm ${algorithm.id}: expected at most one feedback self-loop, found ${feedbackEdges.length} (${pairs})`,
    );
  }

  // Missing operators: the observable form is zero carriers (see
  // 02-03-PLAN.md "Missing operators needs interpretation" — role derivation
  // is total over all six operators by construction, and Algorithm 32
  // declares no inter-operator edges at all, so "every operator appears in
  // an edge" would wrongly reject it).
  if (deriveCarriers(algorithm).length === 0) {
    throw new InvalidAlgorithmError(
      `Algorithm ${algorithm.id}: has zero carriers — every operator modulates another, so the sound reaches no output`,
    );
  }

  // DOMAIN-02: reject a non-self-loop edge violating the higher-modulates-lower
  // rule confirmed across RESEARCH.md's sources for all 32 rows. This single
  // check also guarantees the edge set is acyclic among distinct operators:
  // every such edge strictly decreases the operator number, so following any
  // path strictly decreases a bounded integer and no cycle can exist — no
  // separate cycle-detection helper is needed.
  for (const edge of algorithm.edges) {
    if (edge.from !== edge.to && edge.from <= edge.to) {
      throw new InvalidAlgorithmError(
        `Algorithm ${algorithm.id}: edge ${edge.from}->${edge.to} violates the higher-modulates-lower rule`,
      );
    }
  }
}

/**
 * Throwing structural guard for a full 32-algorithm dataset (DOMAIN-02, set
 * level). Validates every member with {@link validateAlgorithm}, then
 * rejects a set with a duplicated id or one whose ids do not cover
 * `MIN_ALGORITHM_ID..MAX_ALGORITHM_ID` exactly once.
 */
export function validateAlgorithmSet(algorithms: readonly AlgorithmDefinition[]): void {
  if (!Array.isArray(algorithms)) {
    throw new InvalidAlgorithmError('Algorithm set: expected an array of AlgorithmDefinition');
  }

  for (const algorithm of algorithms) {
    validateAlgorithm(algorithm);
  }

  const seenIds = new Set<number>();
  const duplicateIds = new Set<number>();
  for (const algorithm of algorithms) {
    if (seenIds.has(algorithm.id)) {
      duplicateIds.add(algorithm.id);
    }
    seenIds.add(algorithm.id);
  }
  if (duplicateIds.size > 0) {
    throw new InvalidAlgorithmError(
      `Algorithm set: duplicate id(s) found: ${[...duplicateIds].sort((a, b) => a - b).join(', ')}`,
    );
  }

  // Note: no separate "unexpected id" check is needed here. Every id in
  // `seenIds` has already passed `validateAlgorithm`'s `isAlgorithmId` check
  // in the loop above (which throws for any id outside
  // MIN_ALGORITHM_ID..MAX_ALGORITHM_ID before this function ever builds
  // `seenIds`), so an out-of-range id can never reach this point — only
  // missing coverage of the expected range is reachable here.
  const expectedIds: number[] = [];
  for (let id = MIN_ALGORITHM_ID; id <= MAX_ALGORITHM_ID; id += 1) {
    expectedIds.push(id);
  }
  const missingIds = expectedIds.filter((id) => !seenIds.has(id));
  if (missingIds.length > 0) {
    throw new InvalidAlgorithmError(
      `Algorithm set: expected ids ${MIN_ALGORITHM_ID}..${MAX_ALGORITHM_ID} exactly once each; missing: ${missingIds.join(', ')}`,
    );
  }
}
