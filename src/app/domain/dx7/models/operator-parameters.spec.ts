import {
  COARSE_RATIOS,
  DEFAULT_OPERATOR_PARAMETERS,
  MAX_DETUNE,
  MAX_ENVELOPE_LEVEL,
  MAX_OUTPUT_LEVEL,
  MIN_DETUNE,
  MIN_ENVELOPE_LEVEL,
  MIN_OUTPUT_LEVEL,
  isCoarseRatio,
  validateOperatorParameters,
} from './operator-parameters';

// D-10: COARSE_RATIOS is the DX7's 32 coarse-frequency positions, frozen so
// Phase 4's operator editor can render it directly without a defensive copy.
describe('COARSE_RATIOS', () => {
  it('starts with 0.5 followed by the integers 1 through 31, 32 entries total', () => {
    expect(COARSE_RATIOS).toHaveLength(32);
    expect(COARSE_RATIOS[0]).toBe(0.5);
    expect(COARSE_RATIOS[1]).toBe(1);
    expect(COARSE_RATIOS[31]).toBe(31);
  });

  it('is frozen and rejects a push attempt', () => {
    const lengthBefore = COARSE_RATIOS.length;
    expect(() => {
      (COARSE_RATIOS as unknown as number[]).push(99);
    }).toThrow();
    expect(COARSE_RATIOS).toHaveLength(lengthBefore);
  });
});

// D-10: isCoarseRatio is the membership predicate driving validateOperatorParameters's ratio check.
describe('isCoarseRatio', () => {
  it('is true for the boundary and interior coarse positions', () => {
    expect(isCoarseRatio(0.5)).toBe(true);
    expect(isCoarseRatio(1)).toBe(true);
    expect(isCoarseRatio(31)).toBe(true);
  });

  it('is false for values not on the coarse-ratio list', () => {
    expect(isCoarseRatio(0.75)).toBe(false);
    expect(isCoarseRatio(0)).toBe(false);
    expect(isCoarseRatio(32)).toBe(false);
    expect(isCoarseRatio(NaN)).toBe(false);
  });
});

// D-10: validateOperatorParameters enforces the DX7 integer scales field by field.
describe('validateOperatorParameters', () => {
  it('rejects an outputLevel above MAX_OUTPUT_LEVEL', () => {
    expect(() => validateOperatorParameters({ outputLevel: 100 })).toThrow(RangeError);
  });

  it('accepts outputLevel at the MIN_OUTPUT_LEVEL and MAX_OUTPUT_LEVEL boundaries', () => {
    expect(() => validateOperatorParameters({ outputLevel: MIN_OUTPUT_LEVEL })).not.toThrow();
    expect(() => validateOperatorParameters({ outputLevel: MAX_OUTPUT_LEVEL })).not.toThrow();
  });

  it('rejects a detune outside MIN_DETUNE..MAX_DETUNE', () => {
    expect(() => validateOperatorParameters({ detune: MAX_DETUNE + 1 })).toThrow(RangeError);
    expect(() => validateOperatorParameters({ detune: MIN_DETUNE - 1 })).toThrow(RangeError);
  });

  it('accepts detune at the MIN_DETUNE and MAX_DETUNE boundaries', () => {
    expect(() => validateOperatorParameters({ detune: MIN_DETUNE })).not.toThrow();
    expect(() => validateOperatorParameters({ detune: MAX_DETUNE })).not.toThrow();
  });

  it('rejects a non-integer outputLevel (D-10 integer scales)', () => {
    expect(() => validateOperatorParameters({ outputLevel: 50.5 })).toThrow(RangeError);
  });

  it('rejects an envelopeLevel above MAX_ENVELOPE_LEVEL, accepts the boundary', () => {
    expect(() => validateOperatorParameters({ envelopeLevel: MAX_ENVELOPE_LEVEL + 1 })).toThrow(RangeError);
    expect(() => validateOperatorParameters({ envelopeLevel: MAX_ENVELOPE_LEVEL })).not.toThrow();
    expect(() => validateOperatorParameters({ envelopeLevel: MIN_ENVELOPE_LEVEL })).not.toThrow();
  });

  it('rejects a non-coarse ratio, accepts a coarse one', () => {
    expect(() => validateOperatorParameters({ ratio: 0.75 })).toThrow(RangeError);
    expect(() => validateOperatorParameters({ ratio: 0.5 })).not.toThrow();
  });

  it('rejects a non-positive or non-finite fixedFrequencyHz, accepts a normal one', () => {
    expect(() => validateOperatorParameters({ fixedFrequencyHz: 0 })).toThrow(RangeError);
    expect(() => validateOperatorParameters({ fixedFrequencyHz: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => validateOperatorParameters({ fixedFrequencyHz: 440 })).not.toThrow();
  });

  it('does not throw on an empty changes object (partial-edit contract)', () => {
    expect(() => validateOperatorParameters({})).not.toThrow();
  });

  // Regression: a field present on `changes` with an explicit `undefined`
  // value must still be rejected — it must not be treated the same as an
  // absent field, or an invalid `undefined` would slip past validation and
  // overwrite a valid value when the caller spreads `changes` onto the
  // previous parameters (see updateOperator).
  it('rejects an explicit undefined for every supported field', () => {
    expect(() => validateOperatorParameters({ outputLevel: undefined })).toThrow(RangeError);
    expect(() => validateOperatorParameters({ envelopeLevel: undefined })).toThrow(RangeError);
    expect(() => validateOperatorParameters({ detune: undefined })).toThrow(RangeError);
    expect(() => validateOperatorParameters({ ratio: undefined })).toThrow(RangeError);
    expect(() => validateOperatorParameters({ fixedFrequencyHz: undefined })).toThrow(RangeError);
    expect(() => validateOperatorParameters({ mode: undefined })).toThrow(RangeError);
    expect(() => validateOperatorParameters({ enabled: undefined })).toThrow(RangeError);
  });
});

// D-06/D-11: DEFAULT_OPERATOR_PARAMETERS's literal values, asserted directly
// (not compared to the constant itself) so a future edit to the constant
// fails this test instead of shipping silently.
describe('DEFAULT_OPERATOR_PARAMETERS', () => {
  it('matches D-11 exactly', () => {
    expect(DEFAULT_OPERATOR_PARAMETERS.outputLevel).toBe(50);
    expect(DEFAULT_OPERATOR_PARAMETERS.ratio).toBe(1);
    expect(DEFAULT_OPERATOR_PARAMETERS.detune).toBe(0);
    expect(DEFAULT_OPERATOR_PARAMETERS.envelopeLevel).toBe(99);
    expect(DEFAULT_OPERATOR_PARAMETERS.mode).toBe('ratio');
    expect(DEFAULT_OPERATOR_PARAMETERS.enabled).toBe(true);
  });

  it('is frozen and rejects a mutation attempt (T-03-01)', () => {
    expect(() => {
      (DEFAULT_OPERATOR_PARAMETERS as { outputLevel: number }).outputLevel = 10;
    }).toThrow(TypeError);
  });
});
