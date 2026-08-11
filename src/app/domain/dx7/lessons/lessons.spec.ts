import { ALGORITHMS } from '../models/algorithms';
import { deriveCarriers, getFeedbackOperator } from '../models/derive-role';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import { validateOperatorParameters } from '../models/operator-parameters';
import { validateFeedbackLevel } from '../models/patch';
import { LESSON_IDS } from './lesson-definition';
import { getLesson, LESSONS } from './lessons';
import { tryThisParamValues } from './try-this';

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
