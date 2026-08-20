import {
  MAX_RANDOM_FIXED_FREQUENCY_HZ,
  MIN_RANDOM_FIXED_FREQUENCY_HZ,
  RANDOM_WALK_DELTA_FRACTION,
  randomWalkFixedFrequencyHz,
  randomWalkInteger,
  randomWalkOperatorParameters,
  randomWalkPatch,
  randomWalkRatio,
  type RandomSource,
} from './random-walk-patch';
import { COARSE_RATIOS, validateOperatorParameters, type OperatorParameters } from '../models/operator-parameters';
import { DEFAULT_PATCH, validateFeedbackLevel } from '../models/patch';
import { OPERATOR_IDS } from '../models/operator';

/** A deterministic source that cycles through a fixed list of unit-interval values. */
function cyclingSource(values: readonly number[]): RandomSource {
  let index = 0;
  return () => {
    const value = values[index % values.length]!;
    index++;
    return value;
  };
}

/** A deterministic source that sweeps linearly across the closed unit interval. */
function sweepSource(steps: number): RandomSource {
  let index = 0;
  return () => {
    const value = index / (steps - 1);
    index = (index + 1) % steps;
    return value;
  };
}

const THOUSAND_ITERATION_SOURCES: readonly [string, () => RandomSource][] = [
  ['cycling source', () => cyclingSource([0, 0.1, 0.25, 0.5, 0.75, 0.9, 1])],
  ['sweep source', () => sweepSource(97)],
];

describe('randomWalkInteger', () => {
  // Identity case: a source at the midpoint produces a zero delta.
  it('returns the current value unchanged for a midpoint source', () => {
    expect(randomWalkInteger(50, 0, 99, 0.2, () => 0.5)).toBe(50);
  });

  // Extreme-source cases: the extremes produce the full negative/positive delta.
  it('returns the full negative delta for a source of 0 and the full positive delta for a source of 1', () => {
    expect(randomWalkInteger(50, 0, 99, 0.2, () => 0)).toBe(30);
    expect(randomWalkInteger(50, 0, 99, 0.2, () => 1)).toBe(70);
  });

  // Clamp cases at both bounds.
  it('clamps at the minimum and maximum bounds', () => {
    expect(randomWalkInteger(0, 0, 99, 0.2, () => 0)).toBe(0);
    expect(randomWalkInteger(99, 0, 99, 0.2, () => 1)).toBe(99);
  });

  it('is always an integer within bounds for every source value in 0..1', () => {
    for (let i = 0; i <= 20; i++) {
      const source = i / 20;
      const result = randomWalkInteger(50, 0, 99, 0.2, () => source);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(99);
    }
  });

  // Non-finite source: substitutes the midpoint, producing no movement.
  it('treats a non-finite source value as the midpoint, producing no movement', () => {
    expect(randomWalkInteger(50, 0, 99, 0.2, () => NaN)).toBe(50);
    expect(randomWalkInteger(50, 0, 99, 0.2, () => Infinity)).toBe(50);
    expect(randomWalkInteger(50, 0, 99, 0.2, () => -Infinity)).toBe(50);
  });
});

describe('randomWalkRatio', () => {
  it('always returns a value present in COARSE_RATIOS, for every source value and every starting member', () => {
    const sources = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    for (const current of COARSE_RATIOS) {
      for (const source of sources) {
        const result = randomWalkRatio(current, () => source);
        expect(COARSE_RATIOS).toContain(result);
      }
    }
  });

  it('starts from the numerically nearest member when the current value is absent from the list', () => {
    // 1.6 is absent; nearest member is 2 (COARSE_RATIOS = [0.5, 1, 2, 3, ...], |1.6-1|=0.6, |1.6-2|=0.4).
    const result = randomWalkRatio(1.6, () => 0.5);
    expect(result).toBe(2);
  });

  it('moves at most six positions within the list in either direction, and clamps at both ends', () => {
    // From index 0 (value 0.5), a source of 0 must clamp at index 0 (value 0.5) — cannot go negative.
    expect(randomWalkRatio(0.5, () => 0)).toBe(0.5);
    // From the last index (value 31), a source of 1 must clamp at the last index (value 31).
    expect(randomWalkRatio(31, () => 1)).toBe(31);
    // From a mid-list value, the position can move at most 6 slots (deltaFraction 0.2 * 31 = 6.2 -> 6).
    const midIndex = 15; // COARSE_RATIOS[15] = 15
    const current = COARSE_RATIOS[midIndex]!;
    const movedUp = randomWalkRatio(current, () => 1);
    const movedDown = randomWalkRatio(current, () => 0);
    expect(COARSE_RATIOS.indexOf(movedUp) - midIndex).toBeLessThanOrEqual(6);
    expect(midIndex - COARSE_RATIOS.indexOf(movedDown)).toBeLessThanOrEqual(6);
  });
});

describe('randomWalkFixedFrequencyHz', () => {
  it('returns a finite value within the randomization-local range for every source value', () => {
    const sources = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    for (const source of sources) {
      const result = randomWalkFixedFrequencyHz(440, () => source);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(MIN_RANDOM_FIXED_FREQUENCY_HZ);
      expect(result).toBeLessThanOrEqual(MAX_RANDOM_FIXED_FREQUENCY_HZ);
    }
  });

  it('handles a current value below the floor, above the ceiling, zero, negative, or non-finite', () => {
    const badCurrents = [0, -100, 1, 100000, NaN, Infinity, -Infinity];
    for (const current of badCurrents) {
      const result = randomWalkFixedFrequencyHz(current, () => 0.5);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(MIN_RANDOM_FIXED_FREQUENCY_HZ);
      expect(result).toBeLessThanOrEqual(MAX_RANDOM_FIXED_FREQUENCY_HZ);
    }
  });

  it('returns a mid-range current value unchanged for a midpoint source', () => {
    expect(randomWalkFixedFrequencyHz(440, () => 0.5)).toBe(440);
  });
});

describe('randomWalkOperatorParameters', () => {
  const ratioOperator: OperatorParameters = {
    enabled: true,
    mode: 'ratio',
    ratio: 1,
    fixedFrequencyHz: 440,
    detune: 0,
    outputLevel: 50,
    envelope: { rates: [74, 74, 74, 55], levels: [99, 99, 99, 0] },
  };

  const fixedOperator: OperatorParameters = {
    ...ratioOperator,
    mode: 'fixed',
  };

  it('keeps enabled and mode identical to the input', () => {
    const result = randomWalkOperatorParameters(ratioOperator, () => 0.9);
    expect(result.enabled).toBe(ratioOperator.enabled);
    expect(result.mode).toBe(ratioOperator.mode);
  });

  it('walks ratio only when mode is ratio, and fixedFrequencyHz only when mode is fixed', () => {
    const ratioResult = randomWalkOperatorParameters(ratioOperator, () => 0.9);
    expect(ratioResult.fixedFrequencyHz).toBe(ratioOperator.fixedFrequencyHz);

    const fixedResult = randomWalkOperatorParameters(fixedOperator, () => 0.9);
    expect(fixedResult.ratio).toBe(fixedOperator.ratio);
  });

  it('walks all four envelope rates and levels independently, not identically', () => {
    const alternatingSource = cyclingSource([0, 1]);
    const result = randomWalkOperatorParameters(ratioOperator, alternatingSource);
    const allEnvelopeValues = [...result.envelope.rates, ...result.envelope.levels];
    const distinctValues = new Set(allEnvelopeValues);
    expect(distinctValues.size).toBeGreaterThan(1);
  });
});

describe('randomWalkPatch', () => {
  for (const [label, makeSource] of THOUSAND_ITERATION_SOURCES) {
    it(`produces a valid patch over 1000 iterations (${label})`, () => {
      const source = makeSource();
      for (let i = 0; i < 1000; i++) {
        const result = randomWalkPatch(DEFAULT_PATCH, source);
        expect(result.algorithmId).toBe(DEFAULT_PATCH.algorithmId);
        for (const operatorId of OPERATOR_IDS) {
          expect(() => validateOperatorParameters(result.operators[operatorId])).not.toThrow();
          expect(result.operators[operatorId].mode).toBe(DEFAULT_PATCH.operators[operatorId].mode);
          expect(result.operators[operatorId].enabled).toBe(DEFAULT_PATCH.operators[operatorId].enabled);
          expect(COARSE_RATIOS).toContain(result.operators[operatorId].ratio);
        }
        expect(() => validateFeedbackLevel(result.feedback)).not.toThrow();
      }
    });
  }

  it('never mutates the input patch or any object reachable from it', () => {
    const snapshot = structuredClone(DEFAULT_PATCH);
    const source = sweepSource(53);

    const result = randomWalkPatch(DEFAULT_PATCH, source);

    expect(DEFAULT_PATCH).toEqual(snapshot);
    expect(result.operators).not.toBe(DEFAULT_PATCH.operators);
  });

  it('never silences a sounding DEFAULT_PATCH in a single press, across 1000 iterations', () => {
    const source = cyclingSource([0, 0.15, 0.3, 0.5, 0.7, 0.85, 1]);
    for (let i = 0; i < 1000; i++) {
      const result = randomWalkPatch(DEFAULT_PATCH, source);
      for (const operatorId of OPERATOR_IDS) {
        expect(result.operators[operatorId].outputLevel).toBeGreaterThanOrEqual(30);
        expect(result.operators[operatorId].envelope.levels[2]).toBeGreaterThanOrEqual(79);
      }
    }
  });
});

// Pins the tuning constant this module documents as adjustable without structural change.
describe('RANDOM_WALK_DELTA_FRACTION', () => {
  it('is 0.2', () => {
    expect(RANDOM_WALK_DELTA_FRACTION).toBe(0.2);
  });
});
