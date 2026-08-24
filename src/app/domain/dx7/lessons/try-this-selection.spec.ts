import { ALGORITHMS } from '../models/algorithms';
import { deriveIsolatedCarriers, getFeedbackOperator } from '../models/derive-role';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import type { AlgorithmDefinition } from '../models/algorithm-definition';
import type { InstrumentPatch } from '../models/patch';
import { LESSON_IDS } from './lesson-definition';
import { getLesson, LESSONS } from './lessons';
import { buildStructuralStartingPatch, CARRIER_OUTPUT_LEVEL } from './structural-lesson-patch';
import { tryThisParamValues } from './try-this';
import { buildStructuralTryThis, selectTryThisTarget, type TryThisTarget } from './try-this-selection';

function algorithmById(id: number): AlgorithmDefinition {
  const algorithm = ALGORITHMS.find((entry) => entry.id === id);
  if (!algorithm) {
    throw new Error(`no fixture algorithm with id ${id}`);
  }
  return algorithm;
}

describe('selectTryThisTarget', () => {
  it('returns operator 6 for Algorithm 26 and operator 3 for Algorithm 27 — two algorithms whose non-feedback edges are equal', () => {
    const algorithm26 = algorithmById(26);
    const algorithm27 = algorithmById(27);
    const nonFeedbackEdges = (algorithm: AlgorithmDefinition) =>
      algorithm.edges.filter((edge) => edge.from !== edge.to);

    expect(nonFeedbackEdges(algorithm26)).toEqual(nonFeedbackEdges(algorithm27));

    expect(selectTryThisTarget(algorithm26)).toEqual({
      targetOperator: 6,
      targetParam: 'ratio',
      direction: 'increase',
    });
    expect(selectTryThisTarget(algorithm27)).toEqual({
      targetOperator: 3,
      targetParam: 'ratio',
      direction: 'increase',
    });
  });

  it('returns operator 1, outputLevel, decrease for Algorithm 31 and Algorithm 29 (both additive-like)', () => {
    expect(selectTryThisTarget(algorithmById(31))).toEqual({
      targetOperator: 1,
      targetParam: 'outputLevel',
      direction: 'decrease',
    });
    expect(selectTryThisTarget(algorithmById(29))).toEqual({
      targetOperator: 1,
      targetParam: 'outputLevel',
      direction: 'decrease',
    });
  });

  it('keeps Algorithms 3 and 10 from selecting the same target — same edges, two operators tied at max depth, different feedback operators', () => {
    const target3 = selectTryThisTarget(algorithmById(3));
    const target10 = selectTryThisTarget(algorithmById(10));
    expect(target3.targetOperator).toBe(6);
    expect(target10.targetOperator).toBe(3);
    expect(target3.targetOperator).not.toBe(target10.targetOperator);
  });

  it.each(ALGORITHMS.map((algorithm) => algorithm.id))(
    'for Algorithm %i, the selected operator is a member of OPERATOR_IDS, and the generated starting value has room to move in the stated direction',
    (id) => {
      const algorithm = algorithmById(id);
      const target = selectTryThisTarget(algorithm);
      expect(OPERATOR_IDS).toContain(target.targetOperator);

      const patch = buildStructuralStartingPatch(algorithm);
      const startingValue = patch.operators[target.targetOperator][target.targetParam];
      const ladder = tryThisParamValues(target.targetParam);

      expect(ladder).toContain(startingValue);
      if (target.direction === 'increase') {
        expect(startingValue).not.toBe(ladder[ladder.length - 1]);
      } else {
        expect(startingValue).not.toBe(ladder[0]);
      }
    },
  );
});

/**
 * Hand-populated cross-check table for the Parallel group (Algorithms 26
 * through 31), written directly from each algorithm's own edge list (see
 * 11-01-PLAN.md Task 2's action table), never by calling
 * `selectTryThisTarget` on itself — mirrors `lessons.spec.ts`'s
 * `EXPECTED_ALGORITHM_1_CARRIERS` convention: its whole value is being an
 * independently sourced second statement of the same fact, so a slip in
 * either the rule or the dataset fails a named test instead of shipping
 * silently.
 */
describe('selectTryThisTarget — Parallel group cross-check table (11-01-PLAN.md Task 2)', () => {
  const EXPECTED_TARGETS: Readonly<Record<number, TryThisTarget>> = {
    26: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    27: { targetOperator: 3, targetParam: 'ratio', direction: 'increase' },
    28: { targetOperator: 5, targetParam: 'ratio', direction: 'increase' },
    29: { targetOperator: 1, targetParam: 'outputLevel', direction: 'decrease' },
    30: { targetOperator: 5, targetParam: 'ratio', direction: 'increase' },
    31: { targetOperator: 1, targetParam: 'outputLevel', direction: 'decrease' },
  };

  it.each(Object.entries(EXPECTED_TARGETS))('matches the hand-populated expectation for Algorithm %s', (id, expected) => {
    expect(selectTryThisTarget(algorithmById(Number(id)))).toEqual(expected);
  });

  it('Algorithms 26 and 27 have identical non-feedback edges, different feedback operators, and different try-this target operators — the concrete proof D-11 distinguishes them', () => {
    const algorithm26 = algorithmById(26);
    const algorithm27 = algorithmById(27);
    const nonFeedbackEdges = (algorithm: AlgorithmDefinition) =>
      algorithm.edges.filter((edge) => edge.from !== edge.to);
    const feedbackEdge = (algorithm: AlgorithmDefinition) => algorithm.edges.find((edge) => edge.from === edge.to);

    expect(nonFeedbackEdges(algorithm26)).toEqual(nonFeedbackEdges(algorithm27));
    expect(feedbackEdge(algorithm26)).not.toEqual(feedbackEdge(algorithm27));
    expect(selectTryThisTarget(algorithm26).targetOperator).not.toBe(selectTryThisTarget(algorithm27).targetOperator);
  });
});

/**
 * Lesson-prose and generated-patch invariants for the five rows this task
 * adds (Algorithms 27-31; Algorithm 26 landed in Task 1). These live here
 * rather than in `lessons.spec.ts` because Task 2's `<files>` list scopes
 * this task's spec ownership to `try-this-selection.spec.ts` — the existing
 * `describe.each([...LESSONS])` dataset-invariant suite in `lessons.spec.ts`
 * stays untouched (T-06-03/T-06-06 precedent), and these are the additional,
 * task-specific checks D-09/D-12/D-07 call for.
 */
describe('Parallel group lesson prose and ratio invariants (11-01-PLAN.md Task 2)', () => {
  const NEW_PARALLEL_ALGORITHM_IDS: readonly number[] = [27, 28, 29, 30, 31];
  const ADDITIVE_LIKE_PARALLEL_IDS: readonly number[] = [29, 31];

  it('LESSONS has at least the eight rows this task shipped, and LESSON_IDS agrees with LESSONS in the same order (existing invariant, updated for later Phase 11 growth)', () => {
    // Was a hardcoded toHaveLength(8) when this plan (11-01) was the only
    // source of LESSONS growth beyond Algorithm 32/1. 11-03-PLAN.md and
    // 11-04-PLAN.md both add further rows to the same array, so a literal
    // "exactly eight" assertion would go stale at the very next plan — the
    // set-level order/length agreement is what this test actually needs to
    // keep proving; `lessons.spec.ts`'s own `LESSONS set-level invariants`
    // suite is the canonical, always-current version of the same check.
    expect(LESSONS.length).toBeGreaterThanOrEqual(8);
    expect(LESSON_IDS.length).toBeGreaterThanOrEqual(8);
    expect(LESSONS.map((lesson) => lesson.id)).toEqual(LESSON_IDS);
  });

  it.each(NEW_PARALLEL_ALGORITHM_IDS)('Algorithm %i lesson has 2 or 3 explanation paragraphs', (algorithmId) => {
    const lesson = getLesson(`algorithm-${algorithmId}` as (typeof LESSON_IDS)[number]);
    expect(lesson.explanation.length).toBeGreaterThanOrEqual(2);
    expect(lesson.explanation.length).toBeLessThanOrEqual(3);
  });

  it.each(NEW_PARALLEL_ALGORITHM_IDS)(
    "Algorithm %i lesson's objective ends in a period and contains the word \"then\" (D-12 grammar)",
    (algorithmId) => {
      const lesson = getLesson(`algorithm-${algorithmId}` as (typeof LESSON_IDS)[number]);
      expect(lesson.objective).toMatch(/\.$/);
      expect(lesson.objective).toContain('then');
    },
  );

  it('exactly the rows for Algorithms 29 and 31 have six distinct operator ratios; the other four Parallel rows have every operator ratio equal to 1', () => {
    for (const algorithmId of [26, 27, 28, 29, 30, 31]) {
      const lesson = getLesson(`algorithm-${algorithmId}` as (typeof LESSON_IDS)[number]);
      const ratios = OPERATOR_IDS.map((operatorId) => lesson.startingPatch.operators[operatorId].ratio);
      const isAdditiveLike = ADDITIVE_LIKE_PARALLEL_IDS.includes(algorithmId);

      if (isAdditiveLike) {
        expect(new Set(ratios).size).toBe(6);
      } else {
        expect(ratios).toEqual([1, 1, 1, 1, 1, 1]);
      }
    }
  });
});

describe('buildStructuralTryThis', () => {
  it('returns a frozen TryThisStep carrying the derived target plus the two supplied prose strings', () => {
    const algorithm26 = algorithmById(26);
    const step = buildStructuralTryThis(algorithm26, 'Raise operator 6.', 'It gets brighter.');

    expect(step.targetOperator).toBe(6);
    expect(step.targetParam).toBe('ratio');
    expect(step.direction).toBe('increase');
    expect(step.instruction).toBe('Raise operator 6.');
    expect(step.expectedEffect).toBe('It gets brighter.');
    expect(Object.isFrozen(step)).toBe(true);
  });

  it('raises a RangeError for an empty instruction', () => {
    expect(() => buildStructuralTryThis(algorithmById(26), '', 'It gets brighter.')).toThrow(RangeError);
  });

  it('raises a RangeError for an empty expected effect', () => {
    expect(() => buildStructuralTryThis(algorithmById(26), 'Raise operator 6.', '')).toThrow(RangeError);
  });
});

/**
 * Structural invariants for 11-03-PLAN.md's eleven new lessons (Algorithms
 * 2 through 12) — the specific "a spec asserts..." acceptance criteria
 * Tasks 1 and 2 name directly: generated-preset equality for the
 * duplicate-topology clusters in range, the full hand-populated
 * expected-target table for the same eleven algorithms, and Algorithm 7's
 * hop-4 output-level/isolated-carrier facts. Lives here rather than in
 * `lessons.spec.ts` for the same file-scoping reason the Parallel-group
 * block above does.
 */
function patchIgnoringAlgorithmId(patch: InstrumentPatch): Pick<InstrumentPatch, 'operators' | 'feedback'> {
  return { operators: patch.operators, feedback: patch.feedback };
}

describe('Additive Stacks + Tree/Branch generated-preset duplicate-cluster equality (11-03-PLAN.md Tasks 1-2)', () => {
  it('Algorithms 3 and 4 generate identical presets apart from algorithmId', () => {
    expect(patchIgnoringAlgorithmId(buildStructuralStartingPatch(algorithmById(3)))).toEqual(
      patchIgnoringAlgorithmId(buildStructuralStartingPatch(algorithmById(4))),
    );
  });

  it('Algorithms 5 and 6 generate identical presets apart from algorithmId', () => {
    expect(patchIgnoringAlgorithmId(buildStructuralStartingPatch(algorithmById(5)))).toEqual(
      patchIgnoringAlgorithmId(buildStructuralStartingPatch(algorithmById(6))),
    );
  });

  it('Algorithms 3, 4 and 11 generate pairwise identical presets apart from algorithmId', () => {
    const p3 = patchIgnoringAlgorithmId(buildStructuralStartingPatch(algorithmById(3)));
    const p4 = patchIgnoringAlgorithmId(buildStructuralStartingPatch(algorithmById(4)));
    const p11 = patchIgnoringAlgorithmId(buildStructuralStartingPatch(algorithmById(11)));
    expect(p3).toEqual(p4);
    expect(p3).toEqual(p11);
  });

  it('Algorithms 2 and 12 generate identical presets apart from algorithmId', () => {
    expect(patchIgnoringAlgorithmId(buildStructuralStartingPatch(algorithmById(2)))).toEqual(
      patchIgnoringAlgorithmId(buildStructuralStartingPatch(algorithmById(12))),
    );
  });
});

/**
 * Hand-populated expected-target table for Algorithms 2 through 12,
 * transcribed directly from each algorithm's own edge list (the tables in
 * 11-03-PLAN.md Tasks 1 and 2's `<action>`), never by calling
 * `selectTryThisTarget` on itself — the same second-witness convention the
 * Parallel-group table above and `lessons.spec.ts`'s
 * `EXPECTED_ALGORITHM_1_CARRIERS` both use.
 */
describe('selectTryThisTarget — Additive Stacks + Tree/Branch cross-check table (11-03-PLAN.md Tasks 1-2)', () => {
  const EXPECTED_TARGETS: Readonly<Record<number, TryThisTarget>> = {
    2: { targetOperator: 2, targetParam: 'ratio', direction: 'increase' },
    3: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    4: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    5: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    6: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    7: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    8: { targetOperator: 4, targetParam: 'ratio', direction: 'increase' },
    9: { targetOperator: 2, targetParam: 'ratio', direction: 'increase' },
    10: { targetOperator: 3, targetParam: 'ratio', direction: 'increase' },
    11: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    12: { targetOperator: 2, targetParam: 'ratio', direction: 'increase' },
  };

  it.each(Object.entries(EXPECTED_TARGETS))('matches the hand-populated expectation for Algorithm %s', (id, expected) => {
    expect(selectTryThisTarget(algorithmById(Number(id)))).toEqual(expected);
  });

  // Sorted-copy comparison rather than declaration-order `toEqual`: the
  // canonical dataset declares edges in whatever order each row's own
  // reconciliation produced (11-RESEARCH.md), so two algorithms with the
  // same edge *set* can still list them in a different array order —
  // Algorithm 10 vs. Algorithm 3 is exactly such a case (`3->2` and `2->1`
  // appear in opposite positions).
  const sortedNonFeedbackEdges = (algorithm: AlgorithmDefinition) =>
    algorithm.edges
      .filter((edge) => edge.from !== edge.to)
      .map((edge) => `${edge.from}->${edge.to}`)
      .sort();

  it('Algorithm 2 shares its non-feedback edges exactly with Algorithm 1, but selects a different try-this target', () => {
    const algorithm1 = algorithmById(1);
    const algorithm2 = algorithmById(2);

    expect(sortedNonFeedbackEdges(algorithm1)).toEqual(sortedNonFeedbackEdges(algorithm2));
    expect(selectTryThisTarget(algorithm1).targetOperator).not.toBe(selectTryThisTarget(algorithm2).targetOperator);
  });

  it('Algorithm 8 and Algorithm 9 share their non-feedback edges exactly, but select different try-this targets', () => {
    const algorithm8 = algorithmById(8);
    const algorithm9 = algorithmById(9);

    expect(sortedNonFeedbackEdges(algorithm8)).toEqual(sortedNonFeedbackEdges(algorithm9));
    expect(selectTryThisTarget(algorithm8).targetOperator).not.toBe(selectTryThisTarget(algorithm9).targetOperator);
  });

  it('Algorithm 10 and Algorithm 3 share their non-feedback edges exactly, but select different try-this targets', () => {
    const algorithm10 = algorithmById(10);
    const algorithm3 = algorithmById(3);

    expect(sortedNonFeedbackEdges(algorithm10)).toEqual(sortedNonFeedbackEdges(algorithm3));
    expect(selectTryThisTarget(algorithm10).targetOperator).not.toBe(selectTryThisTarget(algorithm3).targetOperator);
  });

  /**
   * The converse of the three feedback-relocation cases above (11-03-PLAN.md
   * Task 3): for the duplicate-topology clusters, non-feedback edges,
   * feedback operator, AND try-this target must all agree — the rule must
   * not manufacture a difference the dataset does not declare.
   */
  it('Algorithms 3, 4 and 11 share equal non-feedback edges, equal feedback operators, and equal try-this targets', () => {
    const algorithm3 = algorithmById(3);
    const algorithm4 = algorithmById(4);
    const algorithm11 = algorithmById(11);

    expect(sortedNonFeedbackEdges(algorithm3)).toEqual(sortedNonFeedbackEdges(algorithm4));
    expect(sortedNonFeedbackEdges(algorithm3)).toEqual(sortedNonFeedbackEdges(algorithm11));
    expect(getFeedbackOperator(algorithm3)).toBe(getFeedbackOperator(algorithm4));
    expect(getFeedbackOperator(algorithm3)).toBe(getFeedbackOperator(algorithm11));
    expect(selectTryThisTarget(algorithm3)).toEqual(selectTryThisTarget(algorithm4));
    expect(selectTryThisTarget(algorithm3)).toEqual(selectTryThisTarget(algorithm11));
  });

  it('Algorithms 2 and 12 share equal non-feedback edges, equal feedback operators, and equal try-this targets', () => {
    const algorithm2 = algorithmById(2);
    const algorithm12 = algorithmById(12);

    expect(sortedNonFeedbackEdges(algorithm2)).toEqual(sortedNonFeedbackEdges(algorithm12));
    expect(getFeedbackOperator(algorithm2)).toBe(getFeedbackOperator(algorithm12));
    expect(selectTryThisTarget(algorithm2)).toEqual(selectTryThisTarget(algorithm12));
  });
});

describe('Algorithm 7 hop-4 output-level and isolated-carrier facts (11-03-PLAN.md Task 2)', () => {
  const algorithm7 = algorithmById(7);
  const patch7 = buildStructuralStartingPatch(algorithm7);

  it("gives operator 6 (hop 4, the deepest operator in the dataset) output level 45", () => {
    expect(patch7.operators[6 as OperatorId].outputLevel).toBe(45);
  });

  it('gives operator 3 (the bare, isolated carrier) the shared carrier output level', () => {
    expect(patch7.operators[3 as OperatorId].outputLevel).toBe(CARRIER_OUTPUT_LEVEL);
  });

  it('deriveIsolatedCarriers for Algorithm 7 is exactly operator 3', () => {
    expect(deriveIsolatedCarriers(algorithm7)).toEqual([3]);
  });
});

/**
 * Hand-populated expected-target table for Algorithms 13 through 25,
 * transcribed directly from each algorithm's own edge list (the tables in
 * 11-04-PLAN.md Tasks 1 and 2's `<action>`), never by calling
 * `selectTryThisTarget` on itself — the same second-witness convention every
 * earlier cross-check table in this file uses.
 */
describe('selectTryThisTarget — Tree/Branch tail + Rooting cross-check table (11-04-PLAN.md Tasks 1-2)', () => {
  const EXPECTED_TARGETS: Readonly<Record<number, TryThisTarget>> = {
    13: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    14: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    15: { targetOperator: 2, targetParam: 'ratio', direction: 'increase' },
    16: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    17: { targetOperator: 2, targetParam: 'ratio', direction: 'increase' },
    18: { targetOperator: 3, targetParam: 'ratio', direction: 'increase' },
    19: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    20: { targetOperator: 3, targetParam: 'ratio', direction: 'increase' },
    21: { targetOperator: 1, targetParam: 'outputLevel', direction: 'decrease' },
    22: { targetOperator: 6, targetParam: 'ratio', direction: 'increase' },
    23: { targetOperator: 2, targetParam: 'outputLevel', direction: 'decrease' },
    24: { targetOperator: 1, targetParam: 'outputLevel', direction: 'decrease' },
    25: { targetOperator: 1, targetParam: 'outputLevel', direction: 'decrease' },
  };

  it.each(Object.entries(EXPECTED_TARGETS))('matches the hand-populated expectation for Algorithm %s', (id, expected) => {
    expect(selectTryThisTarget(algorithmById(Number(id)))).toEqual(expected);
  });

  const sortedNonFeedbackEdges = (algorithm: AlgorithmDefinition) =>
    algorithm.edges
      .filter((edge) => edge.from !== edge.to)
      .map((edge) => `${edge.from}->${edge.to}`)
      .sort();

  /**
   * The feedback-relocation pair 11-RESEARCH.md flags as this plan's
   * remaining `ordering`-probe instance: Algorithms 16 and 17 have two
   * modulators tied at maximum hop depth (op4 and op6, both hop 2), and the
   * feedback-operator tie-break stated in 11-01-PLAN.md (prefer the feedback
   * operator when it is among the deepest, else lowest operator id) is what
   * makes the two select different targets.
   */
  it('Algorithms 16 and 17 have equal non-feedback edges, different feedback operators, and different try-this targets', () => {
    const algorithm16 = algorithmById(16);
    const algorithm17 = algorithmById(17);

    expect(sortedNonFeedbackEdges(algorithm16)).toEqual(sortedNonFeedbackEdges(algorithm17));
    expect(getFeedbackOperator(algorithm16)).not.toBe(getFeedbackOperator(algorithm17));
    expect(selectTryThisTarget(algorithm16).targetOperator).not.toBe(
      selectTryThisTarget(algorithm17).targetOperator,
    );
  });

  /**
   * The converse case: the 24/25/31 duplicate-topology cluster (identical
   * edges, identical feedback operator) must receive identical try-this
   * targets — the rule must not manufacture a difference the dataset does
   * not declare.
   */
  it('Algorithms 24, 25 and 31 receive identical try-this targets', () => {
    const target24 = selectTryThisTarget(algorithmById(24));
    const target25 = selectTryThisTarget(algorithmById(25));
    const target31 = selectTryThisTarget(algorithmById(31));

    expect(target24).toEqual(target25);
    expect(target24).toEqual(target31);
  });
});
