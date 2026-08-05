import { OPERATOR_IDS } from './operator';
import { DEFAULT_OPERATOR_PARAMETERS } from './operator-parameters';
import {
  DEFAULT_ALGORITHM_ID,
  DEFAULT_PATCH,
  MAX_FEEDBACK_LEVEL,
  MIN_FEEDBACK_LEVEL,
  validateFeedbackLevel,
} from './patch';

// Phase 2 D-02: feedback is a 0-7 depth value; validateFeedbackLevel is the
// throwing guard InstrumentState.setFeedback wires in.
describe('validateFeedbackLevel', () => {
  it('accepts the MIN_FEEDBACK_LEVEL and MAX_FEEDBACK_LEVEL boundaries', () => {
    expect(() => validateFeedbackLevel(MIN_FEEDBACK_LEVEL)).not.toThrow();
    expect(() => validateFeedbackLevel(MAX_FEEDBACK_LEVEL)).not.toThrow();
  });

  it('rejects a value below MIN_FEEDBACK_LEVEL, above MAX_FEEDBACK_LEVEL, or non-integer', () => {
    expect(() => validateFeedbackLevel(-1)).toThrow(RangeError);
    expect(() => validateFeedbackLevel(8)).toThrow(RangeError);
    expect(() => validateFeedbackLevel(3.5)).toThrow(RangeError);
  });
});

// D-08/D-09/D-11: DEFAULT_PATCH is the uniform default patch, identical for
// every operator regardless of which algorithm is selected.
describe('DEFAULT_PATCH', () => {
  it('has algorithmId 1 and feedback 0', () => {
    expect(DEFAULT_PATCH.algorithmId).toBe(1);
    expect(DEFAULT_PATCH.algorithmId).toBe(DEFAULT_ALGORITHM_ID);
    expect(DEFAULT_PATCH.feedback).toBe(0);
  });

  it('gives all six OPERATOR_IDS entries the D-11 default operator parameters', () => {
    for (const id of OPERATOR_IDS) {
      expect(DEFAULT_PATCH.operators[id]).toEqual(DEFAULT_OPERATOR_PARAMETERS);
    }
  });

  it('is frozen at every level: the patch, the operators record, and each operator (T-03-01)', () => {
    expect(() => {
      (DEFAULT_PATCH as { feedback: number }).feedback = 5;
    }).toThrow(TypeError);
    expect(() => {
      (DEFAULT_PATCH.operators as unknown as Record<number, unknown>)[1] = {};
    }).toThrow(TypeError);
    expect(() => {
      (DEFAULT_PATCH.operators[1] as { outputLevel: number }).outputLevel = 10;
    }).toThrow(TypeError);
  });
});
