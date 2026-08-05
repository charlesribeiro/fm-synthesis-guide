import { ALGORITHMS } from './algorithms';
import { validateAlgorithm, validateAlgorithmSet } from './validate-algorithm';
import { deriveCarriers, getFeedbackOperator, getOperatorRole, hasFeedbackLoop } from './derive-role';
import type { OperatorId } from './operator';
import { isUnresolvedAlgorithm, type TeachingTag } from './algorithm-definition';

/**
 * End-to-end tracer suite (not per-layer unit tests): proves a routing fact
 * declared as edges in `algorithms.ts` survives `validateAlgorithm()` and is
 * correctly resolved to a carrier/modulator role, for both original fixture
 * rows from the Plan 02-01 tracer.
 */
describe('ALGORITHMS tracer: Algorithms 1 and 32', () => {
  const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
  const algorithm32 = ALGORITHMS.find((algorithm) => algorithm.id === 32)!;

  it('both tracer algorithms pass structural validation without throwing', () => {
    expect(() => validateAlgorithm(algorithm1)).not.toThrow();
    expect(() => validateAlgorithm(algorithm32)).not.toThrow();
  });

  it('deriveCarriers returns the mixed carrier/modulator pair [1, 3] for Algorithm 1', () => {
    expect(deriveCarriers(algorithm1)).toEqual([1, 3]);
  });

  it('deriveCarriers returns all six operators for Algorithm 32 despite zero declared inter-operator edges', () => {
    expect(deriveCarriers(algorithm32)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('does not misclassify a feedback-carrying carrier as a modulator (Algorithm 32, operator 6)', () => {
    // Regression guard for RESEARCH.md Pitfall 1: a naive `edge.from === operatorId`
    // check without excluding `edge.to === operatorId` would classify operator 6 as
    // a modulator here purely because of its own feedback self-loop.
    expect(getOperatorRole(algorithm32, 6)).toBe('carrier');
  });

  it('still classifies a feedback-carrying operator as a modulator when it also modulates another operator (Algorithm 1, operator 6)', () => {
    expect(getOperatorRole(algorithm1, 6)).toBe('modulator');
  });

  it('hasFeedbackLoop is true for operator 6 on both tracer algorithms', () => {
    expect(hasFeedbackLoop(algorithm1, 6)).toBe(true);
    expect(hasFeedbackLoop(algorithm32, 6)).toBe(true);
  });

  it('getFeedbackOperator returns operator 6 for both tracer algorithms', () => {
    expect(getFeedbackOperator(algorithm1)).toBe(6);
    expect(getFeedbackOperator(algorithm32)).toBe(6);
  });

  it('a mutation attempt against a frozen entry does not change the dataset', () => {
    expect(() => {
      (algorithm1 as { name: string }).name = 'tampered';
    }).toThrow();
    expect(ALGORITHMS.find((algorithm) => algorithm.id === 1)!.name).toBe(algorithm1.name);
    expect(algorithm1.name).not.toBe('tampered');
  });
});

/**
 * Independent second witness to each algorithm's carrier set and feedback
 * operator (DOMAIN-01/03 cross-check, T-02-07).
 *
 * These two tables are populated by hand, directly from RESEARCH.md's
 * "Routing Reference Table" Carriers and Feedback-op columns — the
 * high-confidence, cross-triangulated columns — and are never computed by
 * calling `deriveCarriers`/`getFeedbackOperator` on `ALGORITHMS` itself. If
 * they were derived from the dataset they'd only ever agree with it by
 * construction and would catch nothing.
 *
 * Their entire value is being a second, independently-sourced statement of
 * the same fact: a transcription slip in `algorithms.ts`'s edge list changes
 * what `deriveCarriers`/`getFeedbackOperator` compute, and comparing that
 * output against this table turns the slip into a named test failure instead
 * of a silently wrong diagram three phases later. If you are tidying up
 * "duplicated data" and are tempted to delete one of these tables in favor
 * of reading the other off `ALGORITHMS` — don't. That duplication is
 * deliberate: it's the whole point of this suite.
 */
const EXPECTED_CARRIERS: Readonly<Record<number, readonly OperatorId[]>> = {
  1: [1, 3],
  2: [1, 3],
  3: [1, 4],
  4: [1, 4],
  5: [1, 3, 5],
  6: [1, 3, 5],
  7: [1, 3],
  8: [1, 3],
  9: [1, 3],
  10: [1, 4],
  11: [1, 4],
  12: [1, 3],
  13: [1, 3],
  14: [1, 3],
  15: [1, 3],
  16: [1],
  17: [1],
  18: [1],
  19: [1, 4, 5],
  20: [1, 2, 4],
  21: [1, 2, 4, 5],
  22: [1, 3, 4, 5],
  23: [1, 2, 4, 5],
  24: [1, 2, 3, 4, 5],
  25: [1, 2, 3, 4, 5],
  26: [1, 2, 4],
  27: [1, 2, 4],
  28: [1, 3, 6],
  29: [1, 2, 3, 5],
  30: [1, 2, 3, 6],
  31: [1, 2, 3, 4, 5],
  32: [1, 2, 3, 4, 5, 6],
};

const EXPECTED_FEEDBACK_OP: Readonly<Record<number, OperatorId>> = {
  1: 6,
  2: 2,
  3: 6,
  4: 6,
  5: 6,
  6: 6,
  7: 6,
  8: 4,
  9: 2,
  10: 3,
  11: 6,
  12: 2,
  13: 6,
  14: 6,
  15: 2,
  16: 6,
  17: 2,
  18: 3,
  19: 6,
  20: 3,
  21: 3,
  22: 6,
  23: 6,
  24: 6,
  25: 6,
  26: 6,
  27: 3,
  28: 5,
  29: 6,
  30: 5,
  31: 6,
  32: 6,
};

/**
 * Independently transcribed complete edge lists (including feedback self-loops).
 * Populated by hand from the canonical routing decisions — never computed
 * from ALGORITHMS — so a wrong edge fails a named test (T-02-07 companion).
 * Algorithm 19 retains stated RESEARCH.md edges while unresolved.
 * Algorithms 26/27 use the corrected 6→4, 5→4, 3→2 topology.
 */
const EXPECTED_EDGES: Readonly<Record<number, readonly { readonly from: number; readonly to: number }[]>> = {
  1: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 4, to: 3 }, { from: 2, to: 1 }, { from: 6, to: 6 }],
  2: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 4, to: 3 }, { from: 2, to: 1 }, { from: 2, to: 2 }],
  3: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 3, to: 2 }, { from: 2, to: 1 }, { from: 6, to: 6 }],
  4: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 3, to: 2 }, { from: 2, to: 1 }, { from: 6, to: 6 }],
  5: [{ from: 6, to: 5 }, { from: 4, to: 3 }, { from: 2, to: 1 }, { from: 6, to: 6 }],
  6: [{ from: 6, to: 5 }, { from: 4, to: 3 }, { from: 2, to: 1 }, { from: 6, to: 6 }],
  7: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 4, to: 2 }, { from: 2, to: 1 }, { from: 6, to: 6 }],
  8: [{ from: 6, to: 5 }, { from: 5, to: 3 }, { from: 4, to: 3 }, { from: 2, to: 1 }, { from: 4, to: 4 }],
  9: [{ from: 6, to: 5 }, { from: 5, to: 3 }, { from: 4, to: 3 }, { from: 2, to: 1 }, { from: 2, to: 2 }],
  10: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 2, to: 1 }, { from: 3, to: 2 }, { from: 3, to: 3 }],
  11: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 2, to: 1 }, { from: 3, to: 2 }, { from: 6, to: 6 }],
  12: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 4, to: 3 }, { from: 2, to: 1 }, { from: 2, to: 2 }],
  13: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 4, to: 3 }, { from: 2, to: 1 }, { from: 6, to: 6 }],
  14: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 4, to: 3 }, { from: 2, to: 1 }, { from: 6, to: 6 }],
  15: [{ from: 6, to: 5 }, { from: 5, to: 2 }, { from: 4, to: 2 }, { from: 2, to: 1 }, { from: 2, to: 2 }],
  16: [{ from: 6, to: 5 }, { from: 5, to: 1 }, { from: 4, to: 3 }, { from: 3, to: 1 }, { from: 2, to: 1 }, { from: 6, to: 6 }],
  17: [{ from: 6, to: 5 }, { from: 5, to: 1 }, { from: 4, to: 3 }, { from: 3, to: 1 }, { from: 2, to: 1 }, { from: 2, to: 2 }],
  18: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 4, to: 1 }, { from: 2, to: 1 }, { from: 3, to: 1 }, { from: 3, to: 3 }],
  19: [{ from: 6, to: 5 }, { from: 5, to: 4 }, { from: 5, to: 3 }, { from: 5, to: 2 }, { from: 6, to: 6 }],
  20: [{ from: 5, to: 4 }, { from: 3, to: 2 }, { from: 6, to: 5 }, { from: 3, to: 3 }],
  21: [{ from: 6, to: 5 }, { from: 3, to: 2 }, { from: 3, to: 3 }],
  22: [{ from: 6, to: 5 }, { from: 6, to: 4 }, { from: 6, to: 3 }, { from: 2, to: 1 }, { from: 6, to: 6 }],
  23: [{ from: 6, to: 5 }, { from: 3, to: 1 }, { from: 6, to: 6 }],
  24: [{ from: 6, to: 5 }, { from: 6, to: 6 }],
  25: [{ from: 6, to: 5 }, { from: 6, to: 6 }],
  26: [{ from: 6, to: 4 }, { from: 5, to: 4 }, { from: 3, to: 2 }, { from: 6, to: 6 }],
  27: [{ from: 6, to: 4 }, { from: 5, to: 4 }, { from: 3, to: 2 }, { from: 3, to: 3 }],
  28: [{ from: 5, to: 4 }, { from: 4, to: 3 }, { from: 2, to: 1 }, { from: 5, to: 5 }],
  29: [{ from: 6, to: 5 }, { from: 4, to: 3 }, { from: 6, to: 6 }],
  30: [{ from: 5, to: 4 }, { from: 4, to: 3 }, { from: 5, to: 5 }],
  31: [{ from: 6, to: 5 }, { from: 6, to: 6 }],
  32: [{ from: 6, to: 6 }],
};

/**
 * Hand-transcribed per-id expected teaching tag (D-10). Independent of the
 * range helper — if an algorithm's graph-shape group ever disagreed with its
 * id-range bucket, this table is the expected value the suite checks against.
 */
const EXPECTED_TEACHING_TAGS: Readonly<Record<number, readonly TeachingTag[]>> = {
  1: ['additive-stacks'],
  2: ['additive-stacks'],
  3: ['additive-stacks'],
  4: ['additive-stacks'],
  5: ['additive-stacks'],
  6: ['additive-stacks'],
  7: ['tree-branch'],
  8: ['tree-branch'],
  9: ['tree-branch'],
  10: ['tree-branch'],
  11: ['tree-branch'],
  12: ['tree-branch'],
  13: ['tree-branch'],
  14: ['tree-branch'],
  15: ['tree-branch'],
  16: ['tree-branch'],
  17: ['tree-branch'],
  18: ['tree-branch'],
  19: ['rooting'],
  20: ['rooting'],
  21: ['rooting'],
  22: ['rooting'],
  23: ['rooting'],
  24: ['rooting'],
  25: ['rooting'],
  26: ['parallel'],
  27: ['parallel'],
  28: ['parallel'],
  29: ['parallel'],
  30: ['parallel'],
  31: ['parallel'],
  32: ['parallel'],
};

describe.each([...ALGORITHMS])('Algorithm $id ($name)', (algorithm) => {
  it('passes structural validation without throwing', () => {
    expect(() => validateAlgorithm(algorithm)).not.toThrow();
  });

  it("matches the independently-sourced EXPECTED_CARRIERS entry for this algorithm's id", () => {
    if (isUnresolvedAlgorithm(algorithm)) {
      // Stated edges retained; researched carriers are a known mismatch until review.
      expect(deriveCarriers(algorithm)).not.toEqual(EXPECTED_CARRIERS[algorithm.id]);
      return;
    }
    expect(deriveCarriers(algorithm)).toEqual(EXPECTED_CARRIERS[algorithm.id]);
  });

  it("matches the independently-sourced EXPECTED_FEEDBACK_OP entry for this algorithm's id", () => {
    expect(getFeedbackOperator(algorithm)).toBe(EXPECTED_FEEDBACK_OP[algorithm.id]);
  });

  it("matches the independently-sourced EXPECTED_EDGES entry for this algorithm's id", () => {
    expect(algorithm.edges).toEqual(EXPECTED_EDGES[algorithm.id]);
  });

  it('declares exactly one feedback self-loop', () => {
    const selfLoops = algorithm.edges.filter((edge) => edge.from === edge.to);
    expect(selfLoops).toHaveLength(1);
  });

  it('has from greater than to on every non-self-loop edge (higher-modulates-lower)', () => {
    for (const edge of algorithm.edges) {
      if (edge.from !== edge.to) {
        expect(edge.from).toBeGreaterThan(edge.to);
      }
    }
  });

  it('declares no edge twice', () => {
    const keys = algorithm.edges.map((edge) => `${edge.from}->${edge.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('carries exactly the independently-sourced EXPECTED_TEACHING_TAGS for this algorithm', () => {
    expect(algorithm.teachingTags).toEqual(EXPECTED_TEACHING_TAGS[algorithm.id]);
  });

  it('deriveCarriers output is strictly ascending', () => {
    const carriers = deriveCarriers(algorithm);
    for (let i = 1; i < carriers.length; i += 1) {
      expect(carriers[i]).toBeGreaterThan(carriers[i - 1]);
    }
  });
});

describe('ALGORITHMS set-level invariants', () => {
  it('has length 32', () => {
    expect(ALGORITHMS).toHaveLength(32);
  });

  it('has unique ids covering 1 through 32 with no gap', () => {
    const ids = ALGORITHMS.map((algorithm) => algorithm.id).sort((a, b) => a - b);
    expect(new Set(ids).size).toBe(32);
    expect(ids).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  it('validateAlgorithmSet(ALGORITHMS) does not throw', () => {
    expect(() => validateAlgorithmSet(ALGORITHMS)).not.toThrow();
  });

  it('validateAlgorithmSet throws when one entry is duplicated', () => {
    const withDuplicate = [...ALGORITHMS, ALGORITHMS[0]];
    expect(() => validateAlgorithmSet(withDuplicate)).toThrow();
  });

  it('Algorithm 32 declares only its feedback self-loop and still derives all six operators as carriers', () => {
    const algorithm32 = ALGORITHMS.find((algorithm) => algorithm.id === 32)!;
    expect(algorithm32.edges).toHaveLength(1);
    expect(algorithm32.edges[0]).toEqual({ from: 6, to: 6 });
    expect(deriveCarriers(algorithm32)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('flags Algorithm 19, and only Algorithm 19, unresolved via reviewStatus (D-09)', () => {
    const unresolvedIds = ALGORITHMS.filter(isUnresolvedAlgorithm).map((algorithm) => algorithm.id);
    expect(unresolvedIds).toEqual([19]);
  });
});

/**
 * Structural anti-duplication gate (DOMAIN-01, "no duplicated routing
 * knowledge"): asserts the property D-05/D-07 actually turn on, not just
 * its symptoms. A row that grew an extra member holding a precomputed role
 * or carrier list would still type-check under a structurally-typed
 * excess-property escape (e.g. built via a helper/spread rather than an
 * object literal at the assignment site, where TypeScript's excess-property
 * check does not apply) and would still pass every other test in this file
 * — this key-list assertion is the one that catches it. `reviewStatus`
 * (D-09) is the one legitimate optional fifth member — provenance metadata,
 * never a derived carrier/role fact — so unresolved rows are checked
 * against a five-key list instead of being treated as a violation.
 *
 * Also asserts runtime immutability reaches the nested `edges` array, not
 * only the top-level `ALGORITHMS` array, proving T-02-01's freeze is
 * complete rather than shallow-by-accident.
 */
describe('ALGORITHMS structural invariants', () => {
  const EXPECTED_MEMBERS = ['edges', 'id', 'name', 'teachingTags'];
  const EXPECTED_UNRESOLVED_MEMBERS = ['edges', 'id', 'name', 'reviewStatus', 'teachingTags'];

  it.each([...ALGORITHMS])('Algorithm $id exposes only the expected AlgorithmDefinition members', (algorithm) => {
    const expectedMembers = isUnresolvedAlgorithm(algorithm) ? EXPECTED_UNRESOLVED_MEMBERS : EXPECTED_MEMBERS;
    expect(Object.keys(algorithm).sort()).toEqual(expectedMembers);
  });

  it('attempting to push onto the frozen ALGORITHMS array does not change the dataset', () => {
    const lengthBefore = ALGORITHMS.length;
    expect(() => {
      (ALGORITHMS as unknown as { id: number }[]).push({ id: 99 });
    }).toThrow();
    expect(ALGORITHMS).toHaveLength(lengthBefore);
  });

  it('attempting to push onto a frozen entry\'s edges array does not change the dataset', () => {
    const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
    const lengthBefore = algorithm1.edges.length;
    expect(() => {
      (algorithm1.edges as unknown as { from: number; to: number }[]).push({ from: 2, to: 2 });
    }).toThrow();
    expect(algorithm1.edges).toHaveLength(lengthBefore);
  });

  it('attempting to reassign a member on a frozen entry does not change the dataset', () => {
    const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
    const originalEdges = algorithm1.edges;
    expect(() => {
      (algorithm1 as { edges: unknown }).edges = [];
    }).toThrow();
    expect(algorithm1.edges).toBe(originalEdges);
  });

  it('attempting to mutate a field on an individual frozen edge object does not change the dataset', () => {
    const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
    const originalFrom = algorithm1.edges[0].from;
    expect(() => {
      (algorithm1.edges[0] as { from: number }).from = 99;
    }).toThrow();
    expect(algorithm1.edges[0].from).toBe(originalFrom);
  });
});
