import type { AlgorithmId } from '../models/algorithm';
import type { OperatorId } from '../models/operator';
import type { OperatorParameters } from '../models/operator-parameters';
import type { InstrumentPatch } from '../models/patch';

/**
 * The restricted set of guided lessons this phase (and Phase 11's future
 * curriculum) can address. A distinct string-slug union rather than a reuse
 * of `AlgorithmId` (06-01-PLAN.md `<phase_decisions>`) — a lesson and an
 * algorithm are related but not guaranteed 1:1 forever, and the URL shape
 * `/learn/:lessonId` this type backs is costly to reverse once Phase 11's
 * thirty further lessons and any deep links depend on it.
 */
export type LessonId = 'algorithm-32' | 'algorithm-1';

/** Frozen, in curriculum order (D-01: Algorithm 32's lesson is the simplest
 * and comes first) — mirrors `OPERATOR_IDS`'s restricted-literal + frozen
 * array convention (`operator.ts`). */
export const LESSON_IDS: readonly LessonId[] = Object.freeze(['algorithm-32', 'algorithm-1']);

/** Runtime membership guard for `LessonId`, mirroring `isOperatorId`. Every
 * untrusted `:lessonId` route segment must pass through this before any
 * `LESSONS`/`LESSONS_BY_ID` lookup (T-06-01, ASVS V5). */
export function isLessonId(value: string): value is LessonId {
  return LESSON_IDS.includes(value as LessonId);
}

/** The direction a try-this step asks the learner to move `targetParam` in. */
export type TryThisDirection = 'increase' | 'decrease';

/**
 * The subset of `OperatorParameters` fields a try-this step can target.
 * Narrower than CONTEXT.md D-02's literal `keyof OperatorParameters`
 * wording (06-01-PLAN.md `<phase_decisions>`):
 * - `enabled`/`mode` are excluded because neither has a meaningful
 *   increase/decrease direction (a boolean and a two-member enum have no
 *   "more" or "less").
 * - `fixedFrequencyHz` is excluded because it is documented inert while an
 *   operator is in `'ratio'` mode (`operator-parameters.ts` lines 32-37) —
 *   a try-this step targeting it would be silent, and an inaudible
 *   try-this step cannot satisfy D-06's "so the change was actually heard."
 * This is a strict subset of D-02's shape, so it preserves D-02's intent
 * (structured, verifiable data) without reducing what any lesson in this
 * phase can express.
 */
export type TryThisParam = Exclude<
  keyof OperatorParameters,
  'enabled' | 'mode' | 'fixedFrequencyHz'
>;

/** Learner-facing label for each `TryThisParam` — the one place a component
 * may read a parameter's display name, so no template hardcodes it. */
export const TRY_THIS_PARAM_LABELS: Readonly<Record<TryThisParam, string>> = Object.freeze({
  ratio: 'Frequency ratio',
  detune: 'Detune',
  outputLevel: 'Output level',
  envelopeLevel: 'Envelope level',
});

/**
 * D-02's structured, verifiable try-this shape — never free-text
 * instructional copy. This is what makes D-06's behavior-verified
 * completion check possible, and it is the reusable data shape every
 * future Phase 11 lesson's try-this step also uses.
 */
export interface TryThisStep {
  readonly targetOperator: OperatorId;
  readonly targetParam: TryThisParam;
  readonly direction: TryThisDirection;
  /** The imperative sentence the learner reads (e.g. "Pull operator 3's
   * output level down."). */
  readonly instruction: string;
  /** What the learner should hear once they do it. */
  readonly expectedEffect: string;
}

/**
 * A single guided lesson (D-01): pure domain data, no Angular import, no
 * rendering logic. `startingPatch` reuses `InstrumentPatch` — the existing
 * shape from `patch.ts` — rather than a parallel shape, so `LessonDetail`
 * can apply it through `InstrumentState`'s existing validated commands
 * without any new bulk setter (T-06-03).
 */
export interface LessonDefinition {
  readonly id: LessonId;
  readonly algorithmId: AlgorithmId;
  readonly title: string;
  readonly objective: string;
  /** One entry per paragraph. */
  readonly explanation: readonly string[];
  readonly startingPatch: InstrumentPatch;
  readonly tryThis: TryThisStep;
}
