import { isAlgorithmId, MAX_ALGORITHM_ID, MIN_ALGORITHM_ID } from './algorithm';

describe('isAlgorithmId', () => {
  it('accepts the boundary values 1 and 32', () => {
    expect(isAlgorithmId(MIN_ALGORITHM_ID)).toBe(true);
    expect(isAlgorithmId(MAX_ALGORITHM_ID)).toBe(true);
  });

  it('rejects ids outside 1..32', () => {
    expect(isAlgorithmId(0)).toBe(false);
    expect(isAlgorithmId(33)).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(isAlgorithmId(4.2)).toBe(false);
  });
});
