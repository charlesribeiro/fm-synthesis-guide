import { isUnresolvedAlgorithm, TEACHING_TAGS, type AlgorithmDefinition } from './algorithm-definition';

/**
 * Regression test for WR-03: TEACHING_TAGS is the authoritative whitelist
 * `validate-algorithm.ts` checks every algorithm's teachingTags against, so
 * it must be runtime-frozen like every other dataset array in this module,
 * not just compile-time `readonly`-typed.
 */
describe('TEACHING_TAGS', () => {
  it('is frozen at module load and rejects a push attempt', () => {
    const lengthBefore = TEACHING_TAGS.length;
    expect(() => {
      (TEACHING_TAGS as unknown as string[]).push('bogus-tag');
    }).toThrow();
    expect(TEACHING_TAGS).toHaveLength(lengthBefore);
  });
});

/**
 * D-09 review-status metadata: a downstream consumer should be able to ask
 * "is this row unresolved?" by reading `reviewStatus`, not by comparing
 * `algorithm.id` against a hardcoded id it has to know in advance.
 */
describe('isUnresolvedAlgorithm', () => {
  const baseFixture: Omit<AlgorithmDefinition, 'reviewStatus'> = {
    id: 1,
    name: 'a synthetic fixture, not a real algorithm',
    edges: [],
    teachingTags: ['additive-stacks'],
  };

  it('returns true when reviewStatus is "unresolved"', () => {
    expect(isUnresolvedAlgorithm({ ...baseFixture, reviewStatus: 'unresolved' })).toBe(true);
  });

  it('returns false when reviewStatus is absent', () => {
    expect(isUnresolvedAlgorithm(baseFixture)).toBe(false);
  });
});
