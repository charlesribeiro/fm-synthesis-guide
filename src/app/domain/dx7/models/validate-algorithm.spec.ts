import { validateAlgorithm, validateAlgorithmSet, InvalidAlgorithmError } from './validate-algorithm';
import { getFeedbackOperator } from './derive-role';
import type { AlgorithmDefinition, TeachingTag } from './algorithm-definition';
import type { ModulationEdge } from './modulation-edge';
import { MIN_ALGORITHM_ID, MAX_ALGORITHM_ID } from './algorithm';

/**
 * Small generator for a structurally valid algorithm: descending chain
 * 6→5→4→3→2→1 plus feedback on 6. Used instead of hand-writing 32 literal
 * rows — the real dataset is Plan 02-04's job, and duplicating it here would
 * create a second copy of routing knowledge (CLAUDE.md).
 */
function wellFormedAlgorithm(id: number): AlgorithmDefinition {
  return {
    id,
    name: `Fixture ${id}`,
    edges: [
      { from: 6, to: 5 },
      { from: 5, to: 4 },
      { from: 4, to: 3 },
      { from: 3, to: 2 },
      { from: 2, to: 1 },
      { from: 6, to: 6 },
    ],
    teachingTags: ['additive-stacks'],
  };
}

describe('validateAlgorithm', () => {
  it('accepts a well-formed algorithm', () => {
    expect(() => validateAlgorithm(wellFormedAlgorithm(1))).not.toThrow();
  });

  it('rejects null/undefined and non-object values with InvalidAlgorithmError, not a raw TypeError (WR-02)', () => {
    for (const badValue of [null, undefined, 'not-an-algorithm', 42]) {
      expect(() => validateAlgorithm(badValue as unknown as AlgorithmDefinition)).toThrow(InvalidAlgorithmError);
    }
  });

  it('rejects a malformed algorithm missing teachingTags with InvalidAlgorithmError, not a raw TypeError (WR-02)', () => {
    const malformed = { id: 1, name: 'x', edges: [] } as unknown as AlgorithmDefinition;
    expect(() => validateAlgorithm(malformed)).toThrow(InvalidAlgorithmError);
    try {
      validateAlgorithm(malformed);
    } catch (error) {
      expect((error as Error).message).toContain('teachingTags must be an array');
    }
  });

  it('rejects a malformed algorithm missing edges with InvalidAlgorithmError, not a raw TypeError (WR-02)', () => {
    const malformed = { id: 1, name: 'x', teachingTags: ['additive-stacks'] } as unknown as AlgorithmDefinition;
    expect(() => validateAlgorithm(malformed)).toThrow(InvalidAlgorithmError);
    try {
      validateAlgorithm(malformed);
    } catch (error) {
      expect((error as Error).message).toContain('edges must be an array');
    }
  });

  it('rejects a malformed algorithm with a non-string name with InvalidAlgorithmError, not a raw TypeError (WR-02)', () => {
    const malformed = {
      id: 1,
      name: 42,
      edges: [],
      teachingTags: ['additive-stacks'],
    } as unknown as AlgorithmDefinition;
    expect(() => validateAlgorithm(malformed)).toThrow(InvalidAlgorithmError);
    try {
      validateAlgorithm(malformed);
    } catch (error) {
      expect((error as Error).message).toContain('name must be a string');
    }
  });

  it('rejects an algorithm whose id fails isAlgorithmId (algorithmWithImpossibleId)', () => {
    for (const badId of [0, 33, 4.2]) {
      const algorithmWithImpossibleId: AlgorithmDefinition = {
        ...wellFormedAlgorithm(1),
        id: badId,
      };
      expect(() => validateAlgorithm(algorithmWithImpossibleId)).toThrow(InvalidAlgorithmError);
      try {
        validateAlgorithm(algorithmWithImpossibleId);
      } catch (error) {
        expect((error as Error).message).toContain(String(badId));
      }
    }
  });

  it('rejects an edge referencing an operator id outside 1..6 (algorithmWithOutOfRangeOperator)', () => {
    const algorithmWithOutOfRangeOperator: AlgorithmDefinition = {
      id: 2,
      name: 'Out-of-range operator fixture',
      edges: [{ from: 3, to: 9 } as unknown as ModulationEdge, { from: 6, to: 6 }],
      teachingTags: ['additive-stacks'],
    };
    expect(() => validateAlgorithm(algorithmWithOutOfRangeOperator)).toThrow(InvalidAlgorithmError);

    const algorithmWithOutOfRangeSelfLoop: AlgorithmDefinition = {
      id: 3,
      name: 'Out-of-range self-loop fixture',
      edges: [{ from: 0, to: 0 } as unknown as ModulationEdge],
      teachingTags: ['additive-stacks'],
    };
    expect(() => validateAlgorithm(algorithmWithOutOfRangeSelfLoop)).toThrow(InvalidAlgorithmError);
  });

  it('rejects a BigInt-valued edge with InvalidAlgorithmError without throwing outside that type', () => {
    const algorithmWithBigIntEdge: AlgorithmDefinition = {
      id: 2,
      name: 'BigInt-edge fixture',
      edges: [{ from: 6n, to: 5 } as unknown as ModulationEdge, { from: 6, to: 6 }],
      teachingTags: ['additive-stacks'],
    };
    expect(() => validateAlgorithm(algorithmWithBigIntEdge)).toThrow(InvalidAlgorithmError);
    try {
      validateAlgorithm(algorithmWithBigIntEdge);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidAlgorithmError);
      expect((error as Error).message).toContain('6n');
      expect((error as Error).message).toContain('not a valid modulation edge');
    }
  });

  it('rejects a non-self-loop edge with from lower than to (algorithmWithUpwardEdge)', () => {
    const algorithmWithUpwardEdge: AlgorithmDefinition = {
      id: 4,
      name: 'Upward-edge fixture',
      edges: [
        { from: 2, to: 5 },
        { from: 6, to: 6 },
      ],
      teachingTags: ['tree-branch'],
    };
    expect(() => validateAlgorithm(algorithmWithUpwardEdge)).toThrow(InvalidAlgorithmError);
  });

  it('rejects the same edge declared twice (algorithmWithDuplicateEdge)', () => {
    const algorithmWithDuplicateEdge: AlgorithmDefinition = {
      id: 5,
      name: 'Duplicate-edge fixture',
      edges: [
        { from: 6, to: 5 },
        { from: 6, to: 5 },
        { from: 6, to: 6 },
      ],
      teachingTags: ['additive-stacks'],
    };
    expect(() => validateAlgorithm(algorithmWithDuplicateEdge)).toThrow(InvalidAlgorithmError);
  });

  it('rejects more than one feedback self-loop (algorithmWithTwoFeedbackLoops)', () => {
    const algorithmWithTwoFeedbackLoops: AlgorithmDefinition = {
      id: 6,
      name: 'Two-feedback-loop fixture',
      edges: [
        { from: 6, to: 5 },
        { from: 5, to: 4 },
        { from: 4, to: 3 },
        { from: 3, to: 2 },
        { from: 2, to: 1 },
        { from: 6, to: 6 },
        { from: 5, to: 5 },
      ],
      teachingTags: ['additive-stacks'],
    };
    expect(() => validateAlgorithm(algorithmWithTwoFeedbackLoops)).toThrow(InvalidAlgorithmError);
    try {
      validateAlgorithm(algorithmWithTwoFeedbackLoops);
    } catch (error) {
      expect((error as Error).message).toContain('found 2');
      expect((error as Error).message).toContain('6->6');
      expect((error as Error).message).toContain('5->5');
    }
  });

  it('rejects an empty teachingTags array', () => {
    const algorithmWithEmptyTeachingTags: AlgorithmDefinition = {
      ...wellFormedAlgorithm(7),
      teachingTags: [],
    };
    expect(() => validateAlgorithm(algorithmWithEmptyTeachingTags)).toThrow(InvalidAlgorithmError);
  });

  it('rejects a teachingTag outside TEACHING_TAGS (algorithmWithUnknownTeachingTag)', () => {
    const algorithmWithUnknownTeachingTag: AlgorithmDefinition = {
      ...wellFormedAlgorithm(8),
      teachingTags: ['not-a-real-tag'] as unknown as readonly TeachingTag[],
    };
    expect(() => validateAlgorithm(algorithmWithUnknownTeachingTag)).toThrow(InvalidAlgorithmError);
  });

  it('rejects a Symbol-valued teachingTag with InvalidAlgorithmError, not a raw TypeError', () => {
    // A template literal's implicit ToString throws on a Symbol
    // ("Cannot convert a Symbol value to a string"); the error-formatting
    // path must not let that escape the InvalidAlgorithmError contract.
    const algorithmWithSymbolTeachingTag: AlgorithmDefinition = {
      ...wellFormedAlgorithm(10),
      teachingTags: [Symbol('not-a-real-tag')] as unknown as readonly TeachingTag[],
    };
    expect(() => validateAlgorithm(algorithmWithSymbolTeachingTag)).toThrow(InvalidAlgorithmError);
    try {
      validateAlgorithm(algorithmWithSymbolTeachingTag);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidAlgorithmError);
      expect((error as Error).message).toContain('is not one of');
    }
  });

  it('rejects throwing toString values used as id, edge endpoint, or teachingTag with InvalidAlgorithmError', () => {
    const throwing = {
      toString(): string {
        throw new Error('toString must not escape InvalidAlgorithmError');
      },
      valueOf(): never {
        throw new Error('valueOf must not escape InvalidAlgorithmError');
      },
    };

    expect(() =>
      validateAlgorithm({
        ...wellFormedAlgorithm(1),
        id: throwing as unknown as AlgorithmDefinition['id'],
      }),
    ).toThrow(InvalidAlgorithmError);

    expect(() =>
      validateAlgorithm({
        ...wellFormedAlgorithm(2),
        edges: [
          { from: throwing, to: 5 } as unknown as ModulationEdge,
          { from: 6, to: 6 },
        ],
      }),
    ).toThrow(InvalidAlgorithmError);

    expect(() =>
      validateAlgorithm({
        ...wellFormedAlgorithm(3),
        teachingTags: [throwing as unknown as TeachingTag],
      }),
    ).toThrow(InvalidAlgorithmError);

    try {
      validateAlgorithm({
        ...wellFormedAlgorithm(3),
        teachingTags: [throwing as unknown as TeachingTag],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidAlgorithmError);
      expect((error as Error).message).not.toContain('toString must not escape');
    }
  });

  it('rejects an empty or whitespace-only name', () => {
    const algorithmWithBlankName: AlgorithmDefinition = {
      ...wellFormedAlgorithm(9),
      name: '   ',
    };
    expect(() => validateAlgorithm(algorithmWithBlankName)).toThrow(InvalidAlgorithmError);
  });

  it('rejects an algorithm with zero carriers (algorithmWithNoCarrier)', () => {
    // Operator 1 can never satisfy the higher-modulates-lower rule while
    // modulating another operator (no valid operator id is lower than 1), so
    // this is the only way to eliminate the last carrier — the fixture
    // necessarily also violates higher-modulates-lower on that same edge.
    // Rule order in validate-algorithm.ts checks zero-carriers first, so
    // this fixture proves that specific diagnostic fires.
    const algorithmWithNoCarrier: AlgorithmDefinition = {
      id: 10,
      name: 'Zero-carrier fixture',
      edges: [
        { from: 6, to: 5 },
        { from: 5, to: 4 },
        { from: 4, to: 3 },
        { from: 3, to: 2 },
        { from: 2, to: 1 },
        { from: 1, to: 6 },
      ],
      teachingTags: ['additive-stacks'],
    };
    expect(() => validateAlgorithm(algorithmWithNoCarrier)).toThrow(InvalidAlgorithmError);
    try {
      validateAlgorithm(algorithmWithNoCarrier);
    } catch (error) {
      expect((error as Error).message).toContain('zero carriers');
    }
  });

  it('has no separate feedback marker to mislabel — feedback is defined solely by from === to (D-01)', () => {
    const fixture = wellFormedAlgorithm(11);
    const feedbackEdge = fixture.edges.find((edge) => edge.from === edge.to);
    expect(feedbackEdge).toBeDefined();
    expect(feedbackEdge?.from).toBe(feedbackEdge?.to);
    expect(getFeedbackOperator(fixture)).toBe(6);
  });
});

describe('validateAlgorithmSet', () => {
  it('accepts a well-formed 32-entry set', () => {
    const set = Array.from({ length: MAX_ALGORITHM_ID }, (_, i) =>
      wellFormedAlgorithm(i + MIN_ALGORITHM_ID),
    );
    expect(() => validateAlgorithmSet(set)).not.toThrow();
  });

  it('rejects a null container with InvalidAlgorithmError', () => {
    expect(() => validateAlgorithmSet(null as unknown as AlgorithmDefinition[])).toThrow(
      InvalidAlgorithmError,
    );
  });

  it('rejects a non-array object container with InvalidAlgorithmError', () => {
    expect(() =>
      validateAlgorithmSet({ length: 0 } as unknown as AlgorithmDefinition[]),
    ).toThrow(InvalidAlgorithmError);
  });

  it('rejects a set with two entries sharing an id', () => {
    const set = [wellFormedAlgorithm(1), wellFormedAlgorithm(1)];
    expect(() => validateAlgorithmSet(set)).toThrow(InvalidAlgorithmError);
  });

  it('rejects a set missing an id in 1..32', () => {
    const set = Array.from({ length: MAX_ALGORITHM_ID - 1 }, (_, i) =>
      wellFormedAlgorithm(i + MIN_ALGORITHM_ID),
    );
    expect(() => validateAlgorithmSet(set)).toThrow(InvalidAlgorithmError);
  });

  it('rejects a set holding an entry with an out-of-range id, via the per-item validateAlgorithm check', () => {
    // This exercises validateAlgorithmSet's per-item validateAlgorithm(algorithm)
    // loop rejecting id 33 (isAlgorithmId), not a separate set-level
    // out-of-range check — validateAlgorithmSet never reaches its own id-set
    // logic for an out-of-range id, because the per-item loop throws first.
    // The id-range rule itself is already covered directly by
    // "rejects an algorithm whose id fails isAlgorithmId" above.
    const set = [
      ...Array.from({ length: MAX_ALGORITHM_ID }, (_, i) => wellFormedAlgorithm(i + MIN_ALGORITHM_ID)),
      wellFormedAlgorithm(33),
    ];
    expect(() => validateAlgorithmSet(set)).toThrow(InvalidAlgorithmError);
  });
});
