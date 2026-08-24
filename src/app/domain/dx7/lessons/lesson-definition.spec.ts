import { LESSON_IDS, TRY_THIS_PARAM_LABELS, isLessonId, type TryThisParam } from './lesson-definition';

describe('isLessonId', () => {
  it('accepts every member of LESSON_IDS', () => {
    for (const id of LESSON_IDS) {
      expect(isLessonId(id)).toBe(true);
    }
  });

  it('rejects a non-member string', () => {
    // 'algorithm-2' is deliberately NOT used here: plan 11-03 promotes it to
    // a legal lesson id later in this phase, which would silently turn this
    // rejection case into a proof of acceptance. 'algorithm-33' names an id
    // outside the dataset's 1..32 range entirely, so it stays illegal under
    // the eventual 32-member union too.
    expect(isLessonId('algorithm-33')).toBe(false);
  });

  it('accepts every one of the six new Parallel-group lesson ids', () => {
    for (const id of ['algorithm-26', 'algorithm-27', 'algorithm-28', 'algorithm-29', 'algorithm-30', 'algorithm-31']) {
      expect(isLessonId(id)).toBe(true);
    }
  });

  it('rejects an empty string', () => {
    expect(isLessonId('')).toBe(false);
  });

  it('rejects a numeric-looking string', () => {
    expect(isLessonId('32')).toBe(false);
  });

  it('rejects a string differing only in case from a real lesson id', () => {
    expect(isLessonId('Algorithm-32')).toBe(false);
  });
});

describe('LESSON_IDS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(LESSON_IDS)).toBe(true);
  });

  it("lists Algorithm 32's lesson before Algorithm 1's", () => {
    expect(LESSON_IDS.indexOf('algorithm-32')).toBeLessThan(LESSON_IDS.indexOf('algorithm-1'));
  });

  it('has no duplicate members', () => {
    expect(new Set(LESSON_IDS).size).toBe(LESSON_IDS.length);
  });

  it('has every member matching the algorithm-<digits> naming convention', () => {
    for (const id of LESSON_IDS) {
      expect(id).toMatch(/^algorithm-\d+$/);
    }
  });
});

describe('TRY_THIS_PARAM_LABELS', () => {
  const expectedParams: readonly TryThisParam[] = ['ratio', 'detune', 'outputLevel'];

  it('has an entry for every member of TryThisParam and no extra keys', () => {
    const actualKeys = Object.keys(TRY_THIS_PARAM_LABELS).sort();
    expect(actualKeys).toEqual([...expectedParams].sort());
  });

  it('gives every entry a non-empty label', () => {
    for (const param of expectedParams) {
      expect(TRY_THIS_PARAM_LABELS[param].length).toBeGreaterThan(0);
    }
  });
});
