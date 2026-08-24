import { ALGORITHMS } from '../models/algorithms';
import { deriveCarriers, getFeedbackOperator } from '../models/derive-role';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import {
  DEFAULT_ENVELOPE,
  MIN_ENVELOPE_LEVEL,
  RELEASE_SEGMENT_INDEX,
  validateDx7Envelope,
  validateOperatorParameters,
} from '../models/operator-parameters';
import { validateFeedbackLevel } from '../models/patch';
import { isLessonId, LESSON_IDS } from './lesson-definition';
import { CURRICULUM_GROUP_ORDER, groupLessonsByTeachingTag } from './lesson-grouping';
import { getLesson, LESSONS } from './lessons';
import { SHARED_FEEDBACK_LEVEL } from './structural-lesson-patch';
import { tryThisParamValues } from './try-this';

/**
 * Shipped-envelope invariants applied to a single {@link Dx7Envelope}
 * (T-09-03): passes the same throwing validation guard the user-edit
 * boundary applies, has a zero release-segment level, and is frozen at
 * every level. Extracted so the dataset-iterating suite below and the
 * standalone `DEFAULT_ENVELOPE` check (D-06 — the default and the lesson
 * data are held to one standard) share one implementation rather than two
 * copies that could drift.
 */
function expectShippedEnvelopeInvariants(envelope: { rates: readonly number[]; levels: readonly number[] }): void {
  expect(() => validateDx7Envelope(envelope)).not.toThrow();
  expect(envelope.levels[RELEASE_SEGMENT_INDEX]).toBe(MIN_ENVELOPE_LEVEL);
  expect(Object.isFrozen(envelope)).toBe(true);
  expect(Object.isFrozen(envelope.rates)).toBe(true);
  expect(Object.isFrozen(envelope.levels)).toBe(true);
}

/**
 * Dataset invariant suite (T-06-03, T-06-06) — iterates `LESSONS` rather
 * than asserting a hardcoded row count, so every future lesson (Phase 11's
 * remaining thirty) inherits the same gate for free. Mirrors
 * `algorithms.spec.ts`'s dataset-invariant convention, including its
 * hand-populated cross-check tables.
 */
describe('LESSONS set-level invariants', () => {
  it('has one row per member of LESSON_IDS, in the same order, with no duplicate ids', () => {
    expect(LESSONS).toHaveLength(LESSON_IDS.length);
    expect(LESSONS.map((lesson) => lesson.id)).toEqual(LESSON_IDS);
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(LESSONS.length);
  });

  it('getLesson returns the matching row for each member of LESSON_IDS', () => {
    for (const id of LESSON_IDS) {
      expect(getLesson(id).id).toBe(id);
    }
  });

  it('getLesson throws a RangeError for an id outside LESSON_IDS', () => {
    expect(() => getLesson('not-a-real-lesson' as (typeof LESSON_IDS)[number])).toThrow(RangeError);
  });
});

describe.each([...LESSONS])('Lesson $id ($title)', (lesson) => {
  it("resolves algorithmId to a real entry in the canonical ALGORITHMS dataset", () => {
    expect(ALGORITHMS.some((algorithm) => algorithm.id === lesson.algorithmId)).toBe(true);
  });

  it("has a startingPatch.algorithmId that agrees with the lesson's own algorithmId", () => {
    expect(lesson.startingPatch.algorithmId).toBe(lesson.algorithmId);
  });

  it('has a startingPatch.operators entry for all six OPERATOR_IDS, each accepted by validateOperatorParameters', () => {
    for (const operatorId of OPERATOR_IDS) {
      const parameters = lesson.startingPatch.operators[operatorId];
      expect(parameters).toBeDefined();
      expect(() => validateOperatorParameters(parameters)).not.toThrow();
    }
  });

  it('has a startingPatch.feedback accepted by validateFeedbackLevel', () => {
    expect(() => validateFeedbackLevel(lesson.startingPatch.feedback)).not.toThrow();
  });

  it('freezes startingPatch, its operators record, and every operator parameters object', () => {
    expect(Object.isFrozen(lesson.startingPatch)).toBe(true);
    expect(Object.isFrozen(lesson.startingPatch.operators)).toBe(true);
    for (const operatorId of OPERATOR_IDS) {
      expect(Object.isFrozen(lesson.startingPatch.operators[operatorId])).toBe(true);
    }
  });

  it("has every operator's envelope pass the throwing validation guard, have a zero release-segment level, and be frozen (T-09-03)", () => {
    for (const operatorId of OPERATOR_IDS) {
      expectShippedEnvelopeInvariants(lesson.startingPatch.operators[operatorId].envelope);
    }
  });

  it('freezes the explanation array so paragraphs cannot be push/splice/index-mutated', () => {
    expect(Object.isFrozen(lesson.explanation)).toBe(true);
  });

  it("has a tryThis.targetOperator that is a member of OPERATOR_IDS", () => {
    expect(OPERATOR_IDS).toContain(lesson.tryThis.targetOperator);
  });

  it('has a try-this step that is reachable: the starting value has room to move in the stated direction', () => {
    const { targetOperator, targetParam, direction } = lesson.tryThis;
    const startingValue = lesson.startingPatch.operators[targetOperator][targetParam];
    const ladder = tryThisParamValues(targetParam);

    expect(ladder).toContain(startingValue);
    if (direction === 'increase') {
      expect(startingValue).not.toBe(ladder[ladder.length - 1]);
    } else {
      expect(startingValue).not.toBe(ladder[0]);
    }
  });

  it('has non-empty title, objective, at least one explanation paragraph, and non-empty try-this instruction/expectedEffect', () => {
    expect(lesson.title.length).toBeGreaterThan(0);
    expect(lesson.objective.length).toBeGreaterThan(0);
    expect(lesson.explanation.length).toBeGreaterThan(0);
    for (const paragraph of lesson.explanation) {
      expect(paragraph.length).toBeGreaterThan(0);
    }
    expect(lesson.tryThis.instruction.length).toBeGreaterThan(0);
    expect(lesson.tryThis.expectedEffect.length).toBeGreaterThan(0);
  });
});

/**
 * Prose-shape invariant suite (11-03-PLAN.md Task 3) — iterates `LESSONS`
 * generically, exactly like the dataset-invariant suite above, so plan
 * 11-04's thirteen further rows inherit every one of these checks with zero
 * spec edits. Strengthens (rather than duplicates) the existing
 * non-emptiness check above by trimming whitespace first, and adds D-12's
 * objective-grammar shape, the paragraph-count bound D-09 requires, the
 * `algorithm-<id>` naming convention every row's `id` must follow, and a
 * set-level no-duplicate-`algorithmId` guarantee.
 */
describe.each([...LESSONS])('Lesson $id prose shape (11-03-PLAN.md Task 3)', (lesson) => {
  it('has an explanation with 2 or 3 paragraphs', () => {
    expect(lesson.explanation.length).toBeGreaterThanOrEqual(2);
    expect(lesson.explanation.length).toBeLessThanOrEqual(3);
  });

  it('has an objective ending in a period and containing the word "then" (D-12 grammar)', () => {
    expect(lesson.objective).toMatch(/\.$/);
    expect(lesson.objective).toContain('then');
  });

  it('has a non-empty title, objective, try-this instruction, and try-this expectedEffect after trimming whitespace', () => {
    expect(lesson.title.trim().length).toBeGreaterThan(0);
    expect(lesson.objective.trim().length).toBeGreaterThan(0);
    expect(lesson.tryThis.instruction.trim().length).toBeGreaterThan(0);
    expect(lesson.tryThis.expectedEffect.trim().length).toBeGreaterThan(0);
  });

  it('has an id equal to "algorithm-" followed by its own algorithmId', () => {
    expect(lesson.id).toBe(`algorithm-${lesson.algorithmId}`);
  });
});

describe('LESSONS algorithmId uniqueness (11-03-PLAN.md Task 3)', () => {
  it('has no two rows sharing an algorithmId', () => {
    const algorithmIds = LESSONS.map((lesson) => lesson.algorithmId);
    expect(new Set(algorithmIds).size).toBe(algorithmIds.length);
  });
});

/**
 * Independent second witness to Algorithm 1's carrier set and feedback
 * operator (T-06-06) — populated by hand directly from `algorithms.ts`'s
 * edge list for Algorithm 1 (`6→5, 5→4, 4→3, 2→1, 6→6`), never computed by
 * calling `deriveCarriers`/`getFeedbackOperator` on `ALGORITHMS` itself.
 * Mirrors `algorithms.spec.ts`'s `EXPECTED_CARRIERS`/`EXPECTED_FEEDBACK_OP`
 * cross-check convention: its whole value is being a second, independently
 * sourced statement of the same fact, so a transcription slip in either the
 * dataset or the lesson copy fails a named test instead of shipping
 * silently.
 */
describe('Algorithm 1 lesson role cross-check (T-06-06)', () => {
  const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
  const EXPECTED_ALGORITHM_1_CARRIERS: readonly OperatorId[] = [1, 3];
  const EXPECTED_ALGORITHM_1_FEEDBACK_OP: OperatorId = 6;

  it('deriveCarriers for algorithm 1 equals the hand-populated expected carrier set', () => {
    expect(deriveCarriers(algorithm1)).toEqual(EXPECTED_ALGORITHM_1_CARRIERS);
  });

  it('getFeedbackOperator for algorithm 1 equals the hand-populated expected feedback operator', () => {
    expect(getFeedbackOperator(algorithm1)).toBe(EXPECTED_ALGORITHM_1_FEEDBACK_OP);
  });
});

/**
 * D-06/T-09-03: proves the Algorithm 1 lesson's carrier-versus-modulator
 * envelope differentiation is real, deriving the carrier set from the
 * canonical `ALGORITHMS` dataset rather than from a hardcoded operator-id
 * list — the same role split `lessons.ts` itself reads to assign each
 * operator's envelope, so this test and the production code cannot silently
 * disagree about which operator is which. Held segment index (index
 * `RELEASE_SEGMENT_INDEX - 1`) is the de-facto sustain plateau a note holds
 * at while gated on, mirroring `envelope-generator.ts`'s own naming for it.
 */
describe('Algorithm 1 lesson envelope differentiation (D-06, T-09-03)', () => {
  const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
  const carriers = deriveCarriers(algorithm1);
  const modulators = OPERATOR_IDS.filter((operatorId) => !carriers.includes(operatorId));
  const algorithm1Lesson = getLesson('algorithm-1' as (typeof LESSON_IDS)[number]);
  const heldSegmentIndex = RELEASE_SEGMENT_INDEX - 1;

  it('has at least one carrier and one modulator to actually contrast', () => {
    expect(carriers.length).toBeGreaterThan(0);
    expect(modulators.length).toBeGreaterThan(0);
  });

  it("gives every derived carrier's held-segment level strictly greater than every derived modulator's", () => {
    const carrierLevels = carriers.map(
      (operatorId) => algorithm1Lesson.startingPatch.operators[operatorId].envelope.levels[heldSegmentIndex],
    );
    const modulatorLevels = modulators.map(
      (operatorId) => algorithm1Lesson.startingPatch.operators[operatorId].envelope.levels[heldSegmentIndex],
    );

    for (const carrierLevel of carrierLevels) {
      for (const modulatorLevel of modulatorLevels) {
        expect(carrierLevel).toBeGreaterThan(modulatorLevel);
      }
    }
  });
});

/**
 * D-06: Algorithm 32 has no modulation edges at all (every operator is its
 * own carrier), so there is no carrier-versus-modulator pair for
 * differentiated envelopes to contrast — every operator keeps the shared
 * default envelope *reference*, asserted with `toBe` rather than `toEqual`
 * so a future accidental per-operator copy (which would still pass a
 * structural equality check) fails this test.
 */
describe('Algorithm 32 lesson shares the default envelope reference (D-06)', () => {
  it('gives every operator the exact DEFAULT_ENVELOPE object', () => {
    const algorithm32Lesson = getLesson('algorithm-32' as (typeof LESSON_IDS)[number]);
    for (const operatorId of OPERATOR_IDS) {
      expect(algorithm32Lesson.startingPatch.operators[operatorId].envelope).toBe(DEFAULT_ENVELOPE);
    }
  });
});

/**
 * T-09-03: the shared default envelope is held to the exact same shipped-
 * envelope standard as every lesson's starting patch — one standard for the
 * default and the lesson data, not two.
 */
describe('DEFAULT_ENVELOPE shipped-envelope invariants (T-09-03)', () => {
  it('passes the throwing validation guard, has a zero release-segment level, and is frozen', () => {
    expectShippedEnvelopeInvariants(DEFAULT_ENVELOPE);
  });
});

/**
 * Whole-curriculum completeness, ordering and consistency invariants
 * (11-04-PLAN.md Task 3). These are the tests that turn CURR-01's "every
 * algorithm" claim, and D-01/D-02/D-03's ordering claim, into checked facts
 * over the live, thirty-two-row datasets rather than asserted counts.
 */

/**
 * Coverage bijection (CURR-01's "every algorithm" clause) — derived from the
 * live `LESSONS`/`ALGORITHMS` datasets rather than a literal "32", so the
 * assertion keeps its meaning if the instrument's algorithm count ever
 * changed.
 */
describe('LESSONS-to-ALGORITHMS coverage bijection (11-04-PLAN.md Task 3)', () => {
  it('the set of LESSONS algorithmId values equals the set of ALGORITHMS id values, both of size 32, with no duplicates on either side', () => {
    const lessonAlgorithmIds = LESSONS.map((lesson) => lesson.algorithmId);
    const datasetAlgorithmIds = ALGORITHMS.map((algorithm) => algorithm.id);

    const lessonIdSet = new Set(lessonAlgorithmIds);
    const datasetIdSet = new Set(datasetAlgorithmIds);

    expect(lessonIdSet.size).toBe(lessonAlgorithmIds.length);
    expect(datasetIdSet.size).toBe(datasetAlgorithmIds.length);
    expect(lessonIdSet.size).toBe(32);
    expect(datasetIdSet.size).toBe(32);
    expect([...lessonIdSet].sort((a, b) => a - b)).toEqual([...datasetIdSet].sort((a, b) => a - b));
  });
});

/**
 * Curriculum ordering (D-01/D-02/D-03), checked against the dataset's own
 * teaching tags via `CURRICULUM_GROUP_ORDER` rather than against a literal
 * copy of the expected id array — a future reordering that violates the
 * stated rule fails even if someone updates both `LESSON_IDS` and a literal
 * copy of it in a test.
 */
describe('LESSON_IDS curriculum ordering, checked against the dataset (11-04-PLAN.md Task 3)', () => {
  const algorithmsById = new Map(ALGORITHMS.map((algorithm) => [algorithm.id, algorithm]));

  function groupIndexForLesson(lesson: (typeof LESSONS)[number]): number {
    const algorithm = algorithmsById.get(lesson.algorithmId);
    if (!algorithm) {
      throw new Error(`no ALGORITHMS row for lesson ${lesson.id}`);
    }
    const [tag] = algorithm.teachingTags;
    const index = CURRICULUM_GROUP_ORDER.indexOf(tag!);
    if (index === -1) {
      throw new Error(`algorithm ${algorithm.id}'s teaching tag ${tag} is not in CURRICULUM_GROUP_ORDER`);
    }
    return index;
  }

  it('the sequence of curriculum-group indices across LESSONS is non-decreasing', () => {
    const indices = LESSONS.map(groupIndexForLesson);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]!);
    }
  });

  it('algorithm-32 is the first row whose group is Parallel, and algorithm-1 is the first row whose group is Additive Stacks', () => {
    const parallelIndex = CURRICULUM_GROUP_ORDER.indexOf('parallel');
    const additiveStacksIndex = CURRICULUM_GROUP_ORDER.indexOf('additive-stacks');

    const firstParallelLesson = LESSONS.find((lesson) => groupIndexForLesson(lesson) === parallelIndex);
    const firstAdditiveStacksLesson = LESSONS.find(
      (lesson) => groupIndexForLesson(lesson) === additiveStacksIndex,
    );

    expect(firstParallelLesson?.id).toBe('algorithm-32');
    expect(firstAdditiveStacksLesson?.id).toBe('algorithm-1');
  });

  it('within each group, the non-pinned-opener rows are strictly ascending by algorithmId', () => {
    const pinnedOpenerIds = new Set<number>([32, 1]);

    for (const tag of CURRICULUM_GROUP_ORDER) {
      const groupIndex = CURRICULUM_GROUP_ORDER.indexOf(tag);
      const groupLessons = LESSONS.filter((lesson) => groupIndexForLesson(lesson) === groupIndex);
      const nonOpenerAlgorithmIds = groupLessons
        .map((lesson) => lesson.algorithmId)
        .filter((algorithmId) => !pinnedOpenerIds.has(algorithmId));

      for (let i = 1; i < nonOpenerAlgorithmIds.length; i++) {
        expect(nonOpenerAlgorithmIds[i]).toBeGreaterThan(nonOpenerAlgorithmIds[i - 1]!);
      }
    }
  });
});

/**
 * Grouped shape (D-13's four non-empty curriculum sections): the live,
 * complete dataset groups into exactly the sizes the four teaching-tag
 * groups declare — Parallel 7 (26-32), Additive Stacks 6 (1-6), Tree/Branch
 * 12 (7-18), Rooting 7 (19-25) — none empty, each a contiguous slice of
 * `LESSONS`.
 */
describe('groupLessonsByTeachingTag grouped shape over the complete dataset (11-04-PLAN.md Task 3)', () => {
  it('returns four non-empty groups with lesson counts 7, 6, 12 and 7 in curriculum order', () => {
    const groups = groupLessonsByTeachingTag(LESSONS, ALGORITHMS);
    expect(groups).toHaveLength(4);
    expect(groups.map((group) => group.lessons.length)).toEqual([7, 6, 12, 7]);
    for (const group of groups) {
      expect(group.lessons.length).toBeGreaterThan(0);
    }
  });

  it("every group's lessons are a contiguous slice of LESSONS", () => {
    const groups = groupLessonsByTeachingTag(LESSONS, ALGORITHMS);
    const lessonIds = LESSONS.map((lesson) => lesson.id);
    let cursor = 0;
    for (const group of groups) {
      const expectedSlice = lessonIds.slice(cursor, cursor + group.lessons.length);
      expect(group.lessons.map((lesson) => lesson.id)).toEqual(expectedSlice);
      cursor += group.lessons.length;
    }
  });
});

/**
 * Feedback consistency: every row's `startingPatch.feedback` passes
 * `validateFeedbackLevel` and equals `SHARED_FEEDBACK_LEVEL`, excepting
 * Algorithm 32's row (its own hand-authored zero), asserted explicitly by id
 * so the exception reads as an intended carve-out rather than a hole. Every
 * one of the 32 dataset rows declares a self-loop today, so the
 * feedback-absent branch stays untested here (`11-RESEARCH.md` Pitfall 1).
 */
describe("Every lesson row's feedback level, with Algorithm 32's zero carve-out (11-04-PLAN.md Task 3)", () => {
  it('every row passes validateFeedbackLevel', () => {
    for (const lesson of LESSONS) {
      expect(() => validateFeedbackLevel(lesson.startingPatch.feedback)).not.toThrow();
    }
  });

  it('every row except algorithm-32 has feedback equal to SHARED_FEEDBACK_LEVEL', () => {
    for (const lesson of LESSONS) {
      if (lesson.id === 'algorithm-32') continue;
      expect(lesson.startingPatch.feedback).toBe(SHARED_FEEDBACK_LEVEL);
    }
  });

  it("algorithm-32's row keeps its hand-authored feedback of 0", () => {
    expect(getLesson('algorithm-32').startingPatch.feedback).toBe(0);
  });
});

/**
 * Final guard slug: `isLessonId` still proves it can reject something now
 * that every one of the thirty-two real slugs is legal. Complements the
 * pre-existing case in `lesson-definition.spec.ts` (written before this
 * plan grew `LESSON_IDS` to its final size) with the same assertion living
 * beside the rest of this task's whole-curriculum checks.
 */
describe('isLessonId still rejects a thirty-third-algorithm slug now every real slug is legal (11-04-PLAN.md Task 3)', () => {
  it('rejects algorithm-33', () => {
    expect(isLessonId('algorithm-33')).toBe(false);
  });
});
