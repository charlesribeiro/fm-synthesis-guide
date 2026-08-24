import { ALGORITHMS } from './algorithms';
import { deriveCarriers } from './derive-role';
import { deepestModulators, hopDistanceFromOutput, maxModulatorHopDistance } from './hop-distance';
import { OPERATOR_IDS } from './operator';
import type { AlgorithmDefinition } from './algorithm-definition';

function algorithmById(id: number): AlgorithmDefinition {
  const algorithm = ALGORITHMS.find((entry) => entry.id === id);
  if (!algorithm) {
    throw new Error(`no fixture algorithm with id ${id}`);
  }
  return algorithm;
}

describe('hopDistanceFromOutput', () => {
  it('returns 0 for every operator deriveCarriers reports as a carrier, on every one of the 32 dataset rows', () => {
    for (const algorithm of ALGORITHMS) {
      const carriers = deriveCarriers(algorithm);
      for (const carrierId of carriers) {
        expect(hopDistanceFromOutput(algorithm, carrierId)).toBe(0);
      }
    }
  });

  it('returns 1, 1, 2 and 3 for Algorithm 1 operators 2, 4, 5 and 6 respectively', () => {
    const algorithm1 = algorithmById(1);
    expect(hopDistanceFromOutput(algorithm1, 2)).toBe(1);
    expect(hopDistanceFromOutput(algorithm1, 4)).toBe(1);
    expect(hopDistanceFromOutput(algorithm1, 5)).toBe(2);
    expect(hopDistanceFromOutput(algorithm1, 6)).toBe(3);
  });

  it("returns the deepest chain in the dataset for Algorithm 7's operators 2, 4, 5 and 6", () => {
    const algorithm7 = algorithmById(7);
    expect(hopDistanceFromOutput(algorithm7, 2)).toBe(1);
    expect(hopDistanceFromOutput(algorithm7, 4)).toBe(2);
    expect(hopDistanceFromOutput(algorithm7, 5)).toBe(3);
    expect(hopDistanceFromOutput(algorithm7, 6)).toBe(4);
  });

  it("returns 1 for Algorithm 19's fan-out operator (5), whose three targets are all carriers at hop 0", () => {
    const algorithm19 = algorithmById(19);
    expect(hopDistanceFromOutput(algorithm19, 5)).toBe(1);
  });

  it("returns 1 for Algorithm 22's fan-out operator (6), whose three targets are all carriers at hop 0", () => {
    const algorithm22 = algorithmById(22);
    expect(hopDistanceFromOutput(algorithm22, 6)).toBe(1);
  });

  it('never treats a feedback self-loop as an outgoing edge: a feedback-carrying carrier still reports hop 0', () => {
    // Algorithm 32's only edge is its operator 6 self-loop; operator 6 is a
    // carrier (zero edges to *another* operator) and must report hop 0, not
    // recurse into itself.
    const algorithm32 = algorithmById(32);
    expect(hopDistanceFromOutput(algorithm32, 6)).toBe(0);
  });

  it('raises a RangeError naming the offending operator when its outgoing edges reach targets at differing depths', () => {
    // Synthetic: operator 6 fans out to operator 5 (a carrier, hop 0) and
    // operator 4 (a modulator feeding carrier 3, hop 1) — a disagreement no
    // real dataset row exhibits (11-RESEARCH.md Pitfall 5).
    const fanOutToDifferingDepths: AlgorithmDefinition = {
      id: 1,
      name: 'SYNTHETIC — fan-out to differing depths',
      edges: [
        { from: 6, to: 5 },
        { from: 6, to: 4 },
        { from: 4, to: 3 },
      ],
      teachingTags: ['additive-stacks'],
    };

    expect(() => hopDistanceFromOutput(fanOutToDifferingDepths, 6)).toThrow(RangeError);
    expect(() => hopDistanceFromOutput(fanOutToDifferingDepths, 6)).toThrow(/operator 6/);
  });

  it('raises a RangeError rather than recursing without bound when the edge list contains a cycle between two distinct operators', () => {
    const cyclicEdges: AlgorithmDefinition = {
      id: 1,
      name: 'SYNTHETIC — two-operator cycle',
      edges: [
        { from: 6, to: 5 },
        { from: 5, to: 6 },
      ],
      teachingTags: ['additive-stacks'],
    };

    // Asserting only `.toThrow(RangeError)` here would not have teeth: V8's
    // own stack-overflow guard also throws a `RangeError` ("Maximum call
    // stack size exceeded"), so an unbounded-recursion implementation would
    // pass a bare RangeError assertion too. The explicit visited-operator
    // guard's own message is what this test must prove fires, so it asserts
    // the specific wording the guard raises rather than the error type alone
    // — confirmed by a break-probe: removing the guard still threw
    // `RangeError` (the stack-overflow one) but no longer matched this
    // message, documented in 11-01-SUMMARY.md's TDD Gate Compliance section.
    expect(() => hopDistanceFromOutput(cyclicEdges, 6)).toThrow(/modulation cycle/);
  });
});

describe('maxModulatorHopDistance', () => {
  it('returns 0 for Algorithm 32 (no modulators)', () => {
    expect(maxModulatorHopDistance(algorithmById(32))).toBe(0);
  });

  it('returns 3 for Algorithm 1', () => {
    expect(maxModulatorHopDistance(algorithmById(1))).toBe(3);
  });

  it('returns 4 for Algorithm 7', () => {
    expect(maxModulatorHopDistance(algorithmById(7))).toBe(4);
  });

  it('returns 1 for Algorithm 22', () => {
    expect(maxModulatorHopDistance(algorithmById(22))).toBe(1);
  });
});

describe('deepestModulators', () => {
  it('returns [6] for Algorithm 1', () => {
    expect(deepestModulators(algorithmById(1))).toEqual([6]);
  });

  it('returns [3, 6] for Algorithm 3, in ascending id order', () => {
    expect(deepestModulators(algorithmById(3))).toEqual([3, 6]);
  });

  it('returns [2, 6] for Algorithm 22, in ascending id order', () => {
    expect(deepestModulators(algorithmById(22))).toEqual([2, 6]);
  });

  it('returns the empty array for Algorithm 32', () => {
    expect(deepestModulators(algorithmById(32))).toEqual([]);
  });
});

describe('hop-distance dataset-wide sanity (all 32 rows)', () => {
  it('every operator id in every row resolves to a finite, non-negative hop distance with no thrown error', () => {
    for (const algorithm of ALGORITHMS) {
      for (const operatorId of OPERATOR_IDS) {
        const hop = hopDistanceFromOutput(algorithm, operatorId);
        expect(Number.isInteger(hop)).toBe(true);
        expect(hop).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
