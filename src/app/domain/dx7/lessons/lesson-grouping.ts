import { TEACHING_TAGS, type AlgorithmDefinition, type TeachingTag } from '../models/algorithm-definition';
import type { LessonDefinition } from './lesson-definition';

/**
 * Curriculum grouping is a data transform, never hardcoded template layout
 * (CLAUDE.md: "all algorithm topology is data, never hardcoded template
 * layout"). A lesson's curriculum group is read from the canonical dataset's
 * own `teachingTags` (D-01) — it is never restated in lesson data or in a
 * template. `groupLessonsByTeachingTag` takes both `lessons` and `algorithms`
 * as parameters rather than importing `LESSONS`/`ALGORITHMS` directly, so it
 * is testable against small fixtures and its correctness does not depend on
 * how far either live dataset has been filled in — this module runs in wave
 * 1, alongside plan 11-01 concurrently growing the lesson dataset to 32 rows.
 */

/**
 * D-02's reordering of the dataset's own `TEACHING_TAGS` (which lists
 * additive stacks first): the curriculum opens with the Parallel group
 * because Algorithm 32's lesson — the simplest possible case, no modulation
 * at all — is the curriculum's opener and Phase 6 already built it, with
 * Algorithm 1's Additive Stacks group second for the same reason.
 *
 * The four members must remain a permutation of `TEACHING_TAGS` — asserted
 * below at module load (so a group silently added to the taxonomy without
 * being placed here fails immediately for every consumer, not only a spec)
 * and separately asserted by a dedicated spec case.
 */
export const CURRICULUM_GROUP_ORDER: readonly TeachingTag[] = Object.freeze([
  'parallel',
  'additive-stacks',
  'tree-branch',
  'rooting',
]);

assertGroupOrderIsPermutationOfTeachingTags();

/**
 * Learner-facing heading for each curriculum group — the one place a
 * component may read a group's display name, so no template hardcodes it.
 * Total over `TeachingTag` with no index signature: adding a tag to the
 * union without adding its label here is a compile error, not an undefined
 * heading.
 */
export const CURRICULUM_GROUP_LABELS: Readonly<Record<TeachingTag, string>> = Object.freeze({
  parallel: 'Parallel',
  'additive-stacks': 'Additive Stacks',
  'tree-branch': 'Tree and Branch',
  rooting: 'Rooting',
});

/**
 * One original sentence per curriculum group naming the recurring routing
 * shape that group's algorithms share, written from this repository's own
 * taxonomy — no third-party product, patch bank, or manual is named or
 * described. Total over `TeachingTag`, mirroring `CURRICULUM_GROUP_LABELS`.
 */
export const CURRICULUM_GROUP_DESCRIPTIONS: Readonly<Record<TeachingTag, string>> = Object.freeze({
  parallel:
    'Independent carriers and short pairs sound side by side, with no long modulation chain ' +
    'reshaping any of them.',
  'additive-stacks':
    'A handful of independent voices, at least one of them a deep modulator stack, sum together ' +
    'into the final tone.',
  'tree-branch':
    'Two or more modulators feed a single carrier, or a chain forks and merges, before reaching ' +
    'the output.',
  rooting:
    "One operator fans its modulation out to several carriers at once, rooting more than one " +
    'voice in a shared source.',
});

/**
 * A single curriculum section: a teaching-tag group, its presentation copy,
 * and the lessons that landed in it, in their input relative order.
 */
export interface LessonGroup {
  readonly tag: TeachingTag;
  readonly label: string;
  readonly description: string;
  readonly lessons: readonly LessonDefinition[];
}

/**
 * Groups `lessons` into the four curriculum sections `CURRICULUM_GROUP_ORDER`
 * fixes, reading each lesson's group from its algorithm row's own
 * `teachingTags` (D-01) rather than from anything restated on the lesson
 * itself.
 *
 * Total over `CURRICULUM_GROUP_ORDER`: all four groups are always returned,
 * in that order, even when a group has no lessons — so the function's output
 * shape does not depend on how many lesson rows exist yet. Plan 11-04
 * separately asserts every group is non-empty for the shipped
 * thirty-two-row dataset.
 *
 * Neither `LESSONS` nor `ALGORITHMS` is imported directly — both datasets
 * arrive as parameters, so this function is testable against fixtures and
 * cannot be coupled to how far either live dataset has been filled in. It
 * reads only its arguments and mutates neither.
 */
export function groupLessonsByTeachingTag(
  lessons: readonly LessonDefinition[],
  algorithms: readonly AlgorithmDefinition[],
): readonly LessonGroup[] {
  const algorithmsById = new Map(algorithms.map((algorithm) => [algorithm.id, algorithm]));
  const buckets = new Map<TeachingTag, LessonDefinition[]>(
    CURRICULUM_GROUP_ORDER.map((tag) => [tag, []]),
  );

  for (const lesson of lessons) {
    const algorithm = algorithmsById.get(lesson.algorithmId);
    if (!algorithm) {
      throw new RangeError(`algorithmId ${lesson.algorithmId} is not a known algorithm`);
    }
    // A lesson's curriculum group is read from its algorithm row's own
    // teachingTags — every dataset row currently carries exactly one tag
    // (asserted in lesson-grouping.spec.ts); a future multi-tag row still
    // resolves deterministically by reading the first.
    const [tag] = algorithm.teachingTags;
    if (!tag) {
      throw new RangeError(`algorithm ${algorithm.id} carries no teaching tag`);
    }
    // Buckets cover every member of CURRICULUM_GROUP_ORDER, which the
    // module-load assertion above proves is a permutation of TeachingTag's
    // full member set, so this lookup can never miss for a valid tag.
    buckets.get(tag)!.push(lesson);
  }

  return Object.freeze(
    CURRICULUM_GROUP_ORDER.map((tag) =>
      Object.freeze({
        tag,
        label: CURRICULUM_GROUP_LABELS[tag],
        description: CURRICULUM_GROUP_DESCRIPTIONS[tag],
        lessons: Object.freeze([...buckets.get(tag)!]),
      }),
    ),
  );
}

/**
 * Module-load safety net for D-02's permutation requirement: if
 * `CURRICULUM_GROUP_ORDER` and `TEACHING_TAGS` (`algorithm-definition.ts`)
 * ever disagree on membership, every consumer of this module fails
 * immediately rather than a group silently going unplaced. Compared as
 * sorted copies, mirroring the sorted-comparison convention this repository
 * already uses for permutation checks.
 */
function assertGroupOrderIsPermutationOfTeachingTags(): void {
  const sortedOrder = [...CURRICULUM_GROUP_ORDER].sort();
  const sortedTags = [...TEACHING_TAGS].sort();
  const isPermutation =
    sortedOrder.length === sortedTags.length &&
    sortedOrder.every((tag, index) => tag === sortedTags[index]);
  if (!isPermutation) {
    throw new RangeError('CURRICULUM_GROUP_ORDER is not a permutation of TEACHING_TAGS');
  }
}
