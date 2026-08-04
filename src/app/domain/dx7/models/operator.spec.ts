import { OPERATOR_IDS, isOperatorId } from './operator';

describe('isOperatorId', () => {
  it('accepts every valid operator id 1 through 6', () => {
    for (const id of OPERATOR_IDS) {
      expect(isOperatorId(id)).toBe(true);
    }
  });

  it('rejects ids outside the six-operator range', () => {
    expect(isOperatorId(0)).toBe(false);
    expect(isOperatorId(7)).toBe(false);
    expect(isOperatorId(-1)).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(isOperatorId(1.5)).toBe(false);
  });
});
