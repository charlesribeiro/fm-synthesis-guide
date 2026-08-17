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
import { LESSON_IDS } from './lesson-definition';
import { getLesson, LESSONS } from './lessons';
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
