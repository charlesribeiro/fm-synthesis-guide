import {
  COARSE_RATIOS,
  DEFAULT_OPERATOR_PARAMETERS,
  MAX_DETUNE,
  MAX_ENVELOPE_LEVEL,
  MAX_OUTPUT_LEVEL,
  MIN_DETUNE,
  MIN_ENVELOPE_LEVEL,
  MIN_OUTPUT_LEVEL,
  validateOperatorParameters,
  type OperatorParameters,
} from '../models/operator-parameters';
import type { TryThisParam, TryThisStep } from './lesson-definition';
import { hasMovedTowardTarget, tryThisParamValues } from './try-this';

function step(targetParam: TryThisParam, direction: TryThisStep['direction']): TryThisStep {
  return {
    targetOperator: 3,
    targetParam,
    direction,
    instruction: 'test instruction',
    expectedEffect: 'test expected effect',
  };
}

describe('hasMovedTowardTarget', () => {
  const baseline = DEFAULT_OPERATOR_PARAMETERS;

  it('returns true for a strictly higher value under increase', () => {
    const current: OperatorParameters = { ...baseline, outputLevel: 60 };
    expect(hasMovedTowardTarget(baseline, current, step('outputLevel', 'increase'))).toBe(true);
  });

  it('returns true for a strictly lower value under decrease', () => {
    const current: OperatorParameters = { ...baseline, outputLevel: 40 };
    expect(hasMovedTowardTarget(baseline, current, step('outputLevel', 'decrease'))).toBe(true);
  });

  it('returns false for an unchanged value under increase', () => {
    const current: OperatorParameters = { ...baseline };
    expect(hasMovedTowardTarget(baseline, current, step('outputLevel', 'increase'))).toBe(false);
  });

  it('returns false for an unchanged value under decrease', () => {
    const current: OperatorParameters = { ...baseline };
    expect(hasMovedTowardTarget(baseline, current, step('outputLevel', 'decrease'))).toBe(false);
  });

  it('returns false for a value that moved the wrong way under increase', () => {
    const current: OperatorParameters = { ...baseline, outputLevel: 40 };
    expect(hasMovedTowardTarget(baseline, current, step('outputLevel', 'increase'))).toBe(false);
  });

  it('returns false for a value that moved the wrong way under decrease', () => {
    const current: OperatorParameters = { ...baseline, outputLevel: 60 };
    expect(hasMovedTowardTarget(baseline, current, step('outputLevel', 'decrease'))).toBe(false);
  });

  // RESEARCH.md Pitfall 4: updateOperator keeps untouched operators
  // reference-identical — a reference comparison would silently never fire.
  it('returns false when only a non-target parameter changed, even though the parameter objects are different object identities', () => {
    const current: OperatorParameters = { ...baseline, detune: 5 };
    expect(current).not.toBe(baseline);
    expect(hasMovedTowardTarget(baseline, current, step('outputLevel', 'increase'))).toBe(false);
    expect(hasMovedTowardTarget(baseline, current, step('outputLevel', 'decrease'))).toBe(false);
  });
});

describe('tryThisParamValues', () => {
  const cases: readonly {
    readonly param: TryThisParam;
    readonly expectedFirst: number;
    readonly expectedLast: number;
  }[] = [
    { param: 'ratio', expectedFirst: COARSE_RATIOS[0], expectedLast: COARSE_RATIOS.at(-1) as number },
    { param: 'detune', expectedFirst: MIN_DETUNE, expectedLast: MAX_DETUNE },
    { param: 'outputLevel', expectedFirst: MIN_OUTPUT_LEVEL, expectedLast: MAX_OUTPUT_LEVEL },
    { param: 'envelopeLevel', expectedFirst: MIN_ENVELOPE_LEVEL, expectedLast: MAX_ENVELOPE_LEVEL },
  ];

  it.each(cases)(
    'returns an ascending, non-empty ladder for $param whose bounds match the exported constants',
    ({ param, expectedFirst, expectedLast }) => {
      const values = tryThisParamValues(param);

      expect(values.length).toBeGreaterThan(0);
      expect(values[0]).toBe(expectedFirst);
      expect(values.at(-1)).toBe(expectedLast);
      for (let index = 1; index < values.length; index += 1) {
        expect(values[index]).toBeGreaterThan(values[index - 1]);
      }
    },
  );

  it("returns exactly COARSE_RATIOS for 'ratio'", () => {
    expect(tryThisParamValues('ratio')).toEqual(COARSE_RATIOS);
  });

  it.each(cases)('every value returned for $param is accepted by validateOperatorParameters', ({ param }) => {
    for (const value of tryThisParamValues(param)) {
      expect(() => validateOperatorParameters({ [param]: value })).not.toThrow();
    }
  });
});
