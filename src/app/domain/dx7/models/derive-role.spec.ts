import { getOperatorRole, deriveCarriers, hasFeedbackLoop, getFeedbackOperator } from './derive-role';
import { validateAlgorithm } from './validate-algorithm';
import { OPERATOR_IDS } from './operator';
import type { AlgorithmDefinition } from './algorithm-definition';

/** Algorithm-32-like: a single self-loop and no other edges at all. */
const allCarriersWithFeedback: AlgorithmDefinition = {
  id: 32,
  name: 'All-carriers-with-feedback fixture',
  edges: [{ from: 6, to: 6 }],
  teachingTags: ['parallel'],
};

/** Algorithm-1-like: a descending stack + tower, feedback on operator 6 (a modulator). */
const stackAndTowerWithFeedback: AlgorithmDefinition = {
  id: 1,
  name: 'Stack-and-tower-with-feedback fixture',
  edges: [
    { from: 6, to: 5 },
    { from: 5, to: 4 },
    { from: 4, to: 3 },
    { from: 2, to: 1 },
    { from: 6, to: 6 },
  ],
  teachingTags: ['additive-stacks'],
};

describe('getOperatorRole', () => {
  it('regression: classifies an operator as carrier when its only outgoing edge is its own feedback self-loop', () => {
    // RESEARCH.md Pitfall 1 — omitting the `edge.to !== operatorId` exclusion
    // makes every feedback-carrying carrier misclassify as a modulator. A
    // suite built only on Algorithm 1 (feedback on a pure modulator) would
    // not catch this; Algorithm 32's operator 6 is a carrier that also owns
    // the feedback loop, so it is the fixture that exercises the bug.
    expect(getOperatorRole(allCarriersWithFeedback, 6)).toBe('carrier');
  });

  it('classifies an operator as modulator when it has both a feedback self-loop and an edge to another operator', () => {
    expect(getOperatorRole(stackAndTowerWithFeedback, 6)).toBe('modulator');
  });

  it('classifies an operator with no outgoing edges at all as carrier', () => {
    expect(getOperatorRole(stackAndTowerWithFeedback, 1)).toBe('carrier');
  });
});

describe('deriveCarriers', () => {
  it('ordering-determinism: returns an identical ascending array regardless of edge declaration order', () => {
    // This is the property Phase 4's SVG renderer and Phase 5's audio engine
    // will silently depend on — a refactor that derived order from the edges
    // array instead of filtering OPERATOR_IDS would pass every other check
    // but fail this one.
    const ascendingDeclarationOrder: AlgorithmDefinition = {
      ...stackAndTowerWithFeedback,
      edges: [
        { from: 6, to: 5 },
        { from: 5, to: 4 },
        { from: 4, to: 3 },
        { from: 2, to: 1 },
        { from: 6, to: 6 },
      ],
    };
    const reversedDeclarationOrder: AlgorithmDefinition = {
      ...stackAndTowerWithFeedback,
      edges: [
        { from: 6, to: 6 },
        { from: 2, to: 1 },
        { from: 4, to: 3 },
        { from: 5, to: 4 },
        { from: 6, to: 5 },
      ],
    };

    const resultAscending = deriveCarriers(ascendingDeclarationOrder);
    const resultReversed = deriveCarriers(reversedDeclarationOrder);

    expect(resultReversed).toEqual(resultAscending);
    expect(resultAscending).toEqual([1, 3]);
  });

  it('returns all six operators for a fixture whose edges array holds only a self-loop', () => {
    expect(deriveCarriers(allCarriersWithFeedback)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('hasFeedbackLoop', () => {
  it('is true only for the operator that owns the self-loop, false for the other five', () => {
    for (const operatorId of OPERATOR_IDS) {
      expect(hasFeedbackLoop(stackAndTowerWithFeedback, operatorId)).toBe(operatorId === 6);
    }
  });
});

describe('getFeedbackOperator', () => {
  it('returns the operator carrying the self-loop when one exists', () => {
    expect(getFeedbackOperator(stackAndTowerWithFeedback)).toBe(6);
  });

  it('D-03: returns null for a synthetic fixture declaring no self-loop, which still passes validateAlgorithm', () => {
    // No real DX7 algorithm lacks a feedback-capable operator (RESEARCH.md §
    // Fixture Algorithm Recommendations), so this path can only be exercised
    // by a hand-authored, clearly-non-canonical fixture, kept in this spec
    // file only and never added to ALGORITHMS. Uses an id inside the valid
    // 1..32 range (deliberately not RESEARCH.md's out-of-range illustrative
    // value) so it also satisfies isAlgorithmId, which Task 1 added to
    // validateAlgorithm.
    const syntheticNoFeedbackFixture: AlgorithmDefinition = {
      id: 4,
      name: 'SYNTHETIC — not a real DX7 algorithm — exercises D-03s no-feedback path only',
      edges: [{ from: 2, to: 1 }],
      teachingTags: ['additive-stacks'],
    };

    expect(getFeedbackOperator(syntheticNoFeedbackFixture)).toBeNull();
    expect(() => validateAlgorithm(syntheticNoFeedbackFixture)).not.toThrow();
  });
});
