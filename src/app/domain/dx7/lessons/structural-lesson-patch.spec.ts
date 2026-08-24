import { ALGORITHMS } from '../models/algorithms';
import { deriveCarriers, deriveIsolatedCarriers, getFeedbackOperator } from '../models/derive-role';
import { DEFAULT_ENVELOPE, validateOperatorParameters } from '../models/operator-parameters';
import { validateFeedbackLevel } from '../models/patch';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import { isUnresolvedAlgorithm, type AlgorithmDefinition } from '../models/algorithm-definition';
import { getLesson, LESSONS } from './lessons';
import {
  CARRIER_OUTPUT_LEVEL,
  SHARED_MODULATOR_ENVELOPE,
  buildStructuralStartingPatch,
  isAdditiveLikeAlgorithm,
  structuralOutputLevel,
  structuralRatio,
} from './structural-lesson-patch';

function algorithmById(id: number): AlgorithmDefinition {
  const algorithm = ALGORITHMS.find((entry) => entry.id === id);
  if (!algorithm) {
    throw new Error(`no fixture algorithm with id ${id}`);
  }
  return algorithm;
}

describe('structuralOutputLevel', () => {
  it('returns CARRIER_OUTPUT_LEVEL (75) for a carrier regardless of hop distance', () => {
    expect(structuralOutputLevel('carrier', 0)).toBe(75);
  });

  it('returns 60, 55, 50 and 45 for modulators at hop distances 1 through 4', () => {
    expect(structuralOutputLevel('modulator', 1)).toBe(60);
    expect(structuralOutputLevel('modulator', 2)).toBe(55);
    expect(structuralOutputLevel('modulator', 3)).toBe(50);
    expect(structuralOutputLevel('modulator', 4)).toBe(45);
  });

  it('returns an integer accepted by validateOperatorParameters for hop distances 0 through 4', () => {
    for (let hop = 0; hop <= 4; hop++) {
      const carrierLevel = structuralOutputLevel('carrier', hop);
      const modulatorLevel = structuralOutputLevel('modulator', hop);
      expect(() => validateOperatorParameters({ outputLevel: carrierLevel })).not.toThrow();
      expect(() => validateOperatorParameters({ outputLevel: modulatorLevel })).not.toThrow();
    }
  });
});

/**
 * D-07's additive-like predicate membership — the expected list is
 * hand-populated directly from CONTEXT.md D-07 and `11-RESEARCH.md`'s
 * candidate analysis, never computed from the predicate itself, so a slip in
 * the predicate's implementation fails a named test instead of shipping
 * silently.
 */
describe('isAdditiveLikeAlgorithm', () => {
  const EXPECTED_TRUE_IDS: readonly number[] = [21, 23, 24, 25, 29, 31, 32];
  const EXPECTED_FALSE_IDS: readonly number[] = [1, 5, 16, 19, 20, 22, 26, 27, 28, 30];

  it.each(EXPECTED_TRUE_IDS)('accepts Algorithm %i', (id) => {
    expect(isAdditiveLikeAlgorithm(algorithmById(id))).toBe(true);
  });

  it.each(EXPECTED_FALSE_IDS)('rejects Algorithm %i', (id) => {
    expect(isAdditiveLikeAlgorithm(algorithmById(id))).toBe(false);
  });
});

describe('structuralRatio', () => {
  it("gives every operator its own operator number as its ratio for an additive-like algorithm (31)", () => {
    const algorithm31 = algorithmById(31);
    for (const operatorId of OPERATOR_IDS) {
      expect(structuralRatio(algorithm31, operatorId)).toBe(operatorId);
    }
  });

  it('gives every operator ratio 1 for a non-additive-like algorithm (1)', () => {
    const algorithm1 = algorithmById(1);
    for (const operatorId of OPERATOR_IDS) {
      expect(structuralRatio(algorithm1, operatorId)).toBe(1);
    }
  });
});

describe('buildStructuralStartingPatch', () => {
  it("gives Algorithm 26's carriers (1, 2, 4) output level 75 and modulators (3, 5, 6) output level 60, every ratio 1, feedback 3, DEFAULT_ENVELOPE on carriers, SHARED_MODULATOR_ENVELOPE on modulators (by reference)", () => {
    const algorithm26 = algorithmById(26);
    const patch = buildStructuralStartingPatch(algorithm26);

    for (const carrierId of [1, 2, 4] as const) {
      expect(patch.operators[carrierId].outputLevel).toBe(75);
      expect(patch.operators[carrierId].envelope).toBe(DEFAULT_ENVELOPE);
    }
    for (const modulatorId of [3, 5, 6] as const) {
      expect(patch.operators[modulatorId].outputLevel).toBe(60);
      expect(patch.operators[modulatorId].envelope).toBe(SHARED_MODULATOR_ENVELOPE);
    }
    for (const operatorId of OPERATOR_IDS) {
      expect(patch.operators[operatorId].ratio).toBe(1);
    }
    expect(patch.feedback).toBe(3);
  });

  it("gives every operator its own operator number as ratio for an additive-like algorithm (31)", () => {
    const patch = buildStructuralStartingPatch(algorithmById(31));
    for (const operatorId of OPERATOR_IDS) {
      expect(patch.operators[operatorId].ratio).toBe(operatorId);
    }
  });

  it.each(ALGORITHMS.map((algorithm) => algorithm.id))(
    'for Algorithm %i, returns a patch whose algorithmId matches, whose operators pass validateOperatorParameters and validateFeedbackLevel, and which is frozen at every level',
    (id) => {
      const algorithm = algorithmById(id);
      const patch = buildStructuralStartingPatch(algorithm);

      expect(patch.algorithmId).toBe(algorithm.id);
      expect(Object.isFrozen(patch)).toBe(true);
      expect(Object.isFrozen(patch.operators)).toBe(true);
      expect(() => validateFeedbackLevel(patch.feedback)).not.toThrow();
      for (const operatorId of OPERATOR_IDS) {
        const parameters = patch.operators[operatorId];
        expect(Object.isFrozen(parameters)).toBe(true);
        expect(() => validateOperatorParameters(parameters)).not.toThrow();
      }
    },
  );

  it('feedback is SHARED_FEEDBACK_LEVEL (3) whenever the algorithm declares a self-loop — true for every one of the 32 rows today', () => {
    for (const algorithm of ALGORITHMS) {
      const patch = buildStructuralStartingPatch(algorithm);
      const hasFeedback = getFeedbackOperator(algorithm) !== null;
      expect(patch.feedback).toBe(hasFeedback ? 3 : 0);
    }
  });

  it('every carrier keeps role-appropriate output level 75, and role is read from deriveCarriers on every one of the 32 rows', () => {
    for (const algorithm of ALGORITHMS) {
      const carriers = deriveCarriers(algorithm);
      const patch = buildStructuralStartingPatch(algorithm);
      for (const carrierId of carriers as readonly OperatorId[]) {
        expect(patch.operators[carrierId].outputLevel).toBe(75);
        expect(patch.operators[carrierId].envelope).toBe(DEFAULT_ENVELOPE);
      }
    }
  });
});

/**
 * Task 1 acceptance criteria for 11-04-PLAN.md's Algorithms 13-18: the
 * Algorithm 1/13/14 duplicate-cluster preset equality (with Algorithm 13's
 * generated patch explicitly proven NOT equal to Algorithm 1's shipped,
 * hand-authored one despite sharing identical routing), the single-carrier
 * output-level shape for Algorithms 16-18, and Algorithm 15's role
 * derivation taken from the graph rather than from the dataset's loose
 * free-text name.
 */
function patchIgnoringAlgorithmId1104(
  patch: ReturnType<typeof buildStructuralStartingPatch>,
): Pick<ReturnType<typeof buildStructuralStartingPatch>, 'operators' | 'feedback'> {
  return { operators: patch.operators, feedback: patch.feedback };
}

describe('Algorithm 1/13/14 duplicate-cluster preset equality (11-04-PLAN.md Task 1)', () => {
  it('Algorithms 13 and 14 generate identical presets apart from algorithmId', () => {
    expect(patchIgnoringAlgorithmId1104(buildStructuralStartingPatch(algorithmById(13)))).toEqual(
      patchIgnoringAlgorithmId1104(buildStructuralStartingPatch(algorithmById(14))),
    );
  });

  it("Algorithm 13's generated preset is not deeply equal to Algorithm 1's shipped starting-patch output levels, despite identical routing", () => {
    // Algorithm 1's hand-authored levels (60/55/50/45 for its four-operator
    // modulator chain) differ from the structural rule's descending-by-hop
    // levels (60/60/55/50 for Algorithm 13's equivalent chain — its pair
    // modulator, operator 2, and its chain's operator nearest output,
    // operator 4, are both hop 1) — proving the two are not byte-identical
    // even though their routing is.
    const algorithm13Patch = buildStructuralStartingPatch(algorithmById(13));
    expect(algorithm13Patch.operators[4 as OperatorId].outputLevel).toBe(60);
    expect(algorithm13Patch.operators[4 as OperatorId].outputLevel).not.toBe(55);
  });
});

describe('Algorithms 16-18 single-carrier output-level shape (11-04-PLAN.md Task 1)', () => {
  it.each([16, 17, 18])(
    'Algorithm %i derives exactly operator 1 as its carrier, at the shared carrier output level, with every other operator lower',
    (id) => {
      const algorithm = algorithmById(id);
      expect(deriveCarriers(algorithm)).toEqual([1]);

      const patch = buildStructuralStartingPatch(algorithm);
      expect(patch.operators[1 as OperatorId].outputLevel).toBe(CARRIER_OUTPUT_LEVEL);
      for (const operatorId of OPERATOR_IDS) {
        if (operatorId === 1) continue;
        expect(patch.operators[operatorId].outputLevel).toBeLessThan(CARRIER_OUTPUT_LEVEL);
      }
    },
  );
});

describe("Algorithm 15's role derivation taken from the graph, not the dataset's free-text name (11-04-PLAN.md Task 1)", () => {
  const algorithm15 = algorithmById(15);

  it('deriveCarriers for Algorithm 15 does not contain operator 2', () => {
    expect(deriveCarriers(algorithm15)).not.toContain(2 as OperatorId);
  });

  it('deriveIsolatedCarriers for Algorithm 15 is exactly operator 3', () => {
    expect(deriveIsolatedCarriers(algorithm15)).toEqual([3]);
  });
});

/**
 * Task 2 acceptance criteria for 11-04-PLAN.md's Algorithms 19-25: the
 * Algorithm 22-versus-21 additive-like ratio consequence (`isAdditiveLikeAlgorithm`
 * itself is already covered for these ids by the whole-dataset table above,
 * per 11-01-PLAN.md), the 24/25/31 duplicate-cluster preset equality, and
 * Algorithm 19's `unresolved` provenance being handled by an ordinary lesson
 * row rather than silently or with a special-cased shape.
 */
describe("Algorithm 21 (additive-like) versus Algorithm 22 (four carriers, none bare) ratio consequence (11-04-PLAN.md Task 2)", () => {
  it("Algorithm 22's generated preset gives every operator ratio 1", () => {
    const patch = buildStructuralStartingPatch(algorithmById(22));
    for (const operatorId of OPERATOR_IDS) {
      expect(patch.operators[operatorId].ratio).toBe(1);
    }
  });

  it("Algorithm 21's generated preset gives every operator a distinct ratio", () => {
    const patch = buildStructuralStartingPatch(algorithmById(21));
    const ratios = OPERATOR_IDS.map((operatorId) => patch.operators[operatorId].ratio);
    expect(new Set(ratios).size).toBe(6);
  });
});

describe('Algorithm 24/25/31 duplicate-cluster preset equality (11-04-PLAN.md Task 2)', () => {
  it('Algorithms 24, 25 and 31 generate pairwise identical presets apart from algorithmId', () => {
    const p24 = patchIgnoringAlgorithmId1104(buildStructuralStartingPatch(algorithmById(24)));
    const p25 = patchIgnoringAlgorithmId1104(buildStructuralStartingPatch(algorithmById(25)));
    const p31 = patchIgnoringAlgorithmId1104(buildStructuralStartingPatch(algorithmById(31)));
    expect(p24).toEqual(p25);
    expect(p24).toEqual(p31);
  });
});

describe("Algorithm 19's unresolved provenance is handled by an ordinary lesson row (11-04-PLAN.md Task 2)", () => {
  it('isUnresolvedAlgorithm is true for Algorithm 19', () => {
    expect(isUnresolvedAlgorithm(algorithmById(19))).toBe(true);
  });

  it('the Algorithm 19 lesson row has the same field shape as every other row, with no extra provenance flag/badge field', () => {
    const lesson19 = getLesson('algorithm-19');
    const lesson20 = getLesson('algorithm-20');
    expect(Object.keys(lesson19).sort()).toEqual(Object.keys(lesson20).sort());
    expect(() => validateOperatorParameters(lesson19.startingPatch.operators[1 as OperatorId])).not.toThrow();
  });
});

/**
 * Whole-dataset additive-like membership (11-04-PLAN.md Task 3). The
 * expected accepted set is written directly from the structural survey —
 * never computed from the predicate itself — and checked against the
 * predicate's verdict on every one of the 32 `ALGORITHMS` rows, not just the
 * subset the `isAdditiveLikeAlgorithm` describe block above names. Then
 * checks the ratio consequence on shipped `LESSONS` data: every accepted
 * row's lesson has six distinct operator ratios, every rejected row's has
 * every ratio equal to 1.
 */
describe('isAdditiveLikeAlgorithm whole-dataset membership and ratio consequence (11-04-PLAN.md Task 3)', () => {
  const EXPECTED_ADDITIVE_LIKE_IDS: readonly number[] = [21, 23, 24, 25, 29, 31, 32];

  it('matches the predicate’s verdict on all 32 ALGORITHMS rows', () => {
    for (const algorithm of ALGORITHMS) {
      const expected = EXPECTED_ADDITIVE_LIKE_IDS.includes(algorithm.id);
      expect(isAdditiveLikeAlgorithm(algorithm)).toBe(expected);
    }
  });

  it('every lesson whose algorithm the predicate accepts has six distinct operator ratios', () => {
    for (const lesson of LESSONS) {
      if (!EXPECTED_ADDITIVE_LIKE_IDS.includes(lesson.algorithmId)) continue;
      const ratios = OPERATOR_IDS.map((operatorId) => lesson.startingPatch.operators[operatorId].ratio);
      expect(new Set(ratios).size).toBe(6);
    }
  });

  it('every lesson whose algorithm the predicate rejects has every operator ratio equal to 1', () => {
    for (const lesson of LESSONS) {
      if (EXPECTED_ADDITIVE_LIKE_IDS.includes(lesson.algorithmId)) continue;
      const ratios = OPERATOR_IDS.map((operatorId) => lesson.startingPatch.operators[operatorId].ratio);
      expect(ratios).toEqual([1, 1, 1, 1, 1, 1]);
    }
  });
});

/**
 * Duplicate-cluster equality over the complete dataset (11-04-PLAN.md
 * Task 3): hand-populated as a table of id groups, transcribed directly from
 * `11-RESEARCH.md`'s "Duplicate-Topology Clusters" section — never computed
 * by calling `buildStructuralStartingPatch` on itself. Every structurally-
 * built cluster member's starting patch must be deeply equal to every other
 * member's apart from `algorithmId`. Algorithm 1 is deliberately excluded
 * from the 13/14 cluster (it is hand-authored, not structurally built) and
 * separately proven NOT equal to Algorithm 13's structurally-built patch —
 * a real fact about the shipped data, not an oversight to paper over.
 */
describe('Duplicate-cluster preset equality over the complete dataset (11-04-PLAN.md Task 3)', () => {
  const CLUSTERS: readonly (readonly number[])[] = [
    [13, 14],
    [3, 4, 11],
    [24, 25, 31],
    [2, 12],
    [5, 6],
  ];

  it.each(CLUSTERS.map((cluster) => [cluster.join('/'), cluster] as const))(
    'cluster %s has pairwise-equal structurally-built starting patches apart from algorithmId',
    (_label, cluster) => {
      const patches = cluster.map((id) => patchIgnoringAlgorithmId1104(buildStructuralStartingPatch(algorithmById(id))));
      for (let i = 1; i < patches.length; i++) {
        expect(patches[i]).toEqual(patches[0]);
      }
    },
  );

  it("Algorithm 1's hand-authored lesson patch is NOT deeply equal to Algorithm 13's structurally-built patch, despite identical routing", () => {
    const algorithm1Lesson = getLesson('algorithm-1');
    const algorithm13Patch = buildStructuralStartingPatch(algorithmById(13));
    expect(patchIgnoringAlgorithmId1104(algorithm1Lesson.startingPatch)).not.toEqual(
      patchIgnoringAlgorithmId1104(algorithm13Patch),
    );
  });
});
