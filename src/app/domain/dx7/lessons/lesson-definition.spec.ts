import { LESSON_IDS, TRY_THIS_PARAM_LABELS, isLessonId, type TryThisParam } from './lesson-definition';

describe('isLessonId', () => {
  it('accepts every member of LESSON_IDS', () => {
    for (const id of LESSON_IDS) {
      expect(isLessonId(id)).toBe(true);
    }
  });

  it('rejects a non-member string', () => {
    expect(isLessonId('algorithm-2')).toBe(false);
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
});

describe('TRY_THIS_PARAM_LABELS', () => {
  const expectedParams: readonly TryThisParam[] = ['ratio', 'detune', 'outputLevel', 'envelopeLevel'];

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
