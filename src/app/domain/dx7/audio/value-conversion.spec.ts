import {
  COARSE_RATIOS,
  DEFAULT_ENVELOPE,
  DEFAULT_OPERATOR_PARAMETERS,
  MAX_DETUNE,
  MAX_OUTPUT_LEVEL,
  MIN_DETUNE,
  MIN_OUTPUT_LEVEL,
  type OperatorParameters,
} from '../models/operator-parameters';
import { MAX_FEEDBACK_LEVEL, MIN_FEEDBACK_LEVEL } from '../models/patch';
import { OPERATOR_IDS } from '../models/operator';
import {
  A4_FREQUENCY_HZ,
  A4_MIDI_NOTE,
  CENTS_PER_DETUNE_STEP,
  CENTS_PER_OCTAVE,
  ENVELOPE_MAX_FULL_SCALE_SECONDS,
  ENVELOPE_MIN_FULL_SCALE_SECONDS,
  MASTER_GAIN,
  MAX_FEEDBACK_INDEX,
  MAX_MODULATION_INDEX,
  MAX_VELOCITY,
  MIN_VELOCITY,
  detuneToCents,
  envelopeRateToLevelUnitsPerSample,
  feedbackLevelToDepthHz,
  midiNoteToFrequency,
  operatorFrequencyHz,
  outputLevelToAmplitude,
  outputLevelToModulationDepthHz,
  velocityToAmplitude,
} from './value-conversion';
import { MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_RATE, MIN_ENVELOPE_LEVEL, MIN_ENVELOPE_RATE } from '../models/operator-parameters';

function buildOperatorParameters(overrides: Partial<OperatorParameters> = {}): OperatorParameters {
  return { ...DEFAULT_OPERATOR_PARAMETERS, ...overrides };
}

describe('midiNoteToFrequency', () => {
  it('is exactly A4_FREQUENCY_HZ at A4_MIDI_NOTE', () => {
    expect(midiNoteToFrequency(A4_MIDI_NOTE)).toBe(A4_FREQUENCY_HZ);
  });

  it('is ~261.63Hz at MIDI note 60 (C4), within a small tolerance', () => {
    expect(midiNoteToFrequency(60)).toBeCloseTo(261.63, 1);
  });

  it('doubles exactly for an octave step', () => {
    const base = midiNoteToFrequency(60);
    const octaveUp = midiNoteToFrequency(72);
    expect(octaveUp).toBeCloseTo(base * 2, 10);
  });
});

describe('outputLevelToAmplitude', () => {
  it('is 0 at MIN_OUTPUT_LEVEL', () => {
    expect(outputLevelToAmplitude(MIN_OUTPUT_LEVEL)).toBe(0);
  });

  it('is 1 at MAX_OUTPUT_LEVEL', () => {
    expect(outputLevelToAmplitude(MAX_OUTPUT_LEVEL)).toBe(1);
  });

  it('is monotonically increasing across the range', () => {
    let previous = outputLevelToAmplitude(MIN_OUTPUT_LEVEL);
    for (let level = MIN_OUTPUT_LEVEL + 1; level <= MAX_OUTPUT_LEVEL; level += 1) {
      const current = outputLevelToAmplitude(level);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });
});

describe('velocityToAmplitude', () => {
  it('is 1 at MAX_VELOCITY', () => {
    expect(velocityToAmplitude(MAX_VELOCITY)).toBe(1);
  });

  it('is monotonically increasing across the valid range', () => {
    let previous = velocityToAmplitude(MIN_VELOCITY);
    for (let velocity = MIN_VELOCITY + 1; velocity <= MAX_VELOCITY; velocity += 1) {
      const current = velocityToAmplitude(velocity);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });
});

describe('operatorFrequencyHz', () => {
  it("in 'ratio' mode, multiplies the note frequency by the operator's coarse ratio", () => {
    const noteFrequencyHz = 261.63; // C4
    const half = buildOperatorParameters({ mode: 'ratio', ratio: 0.5, detune: 0 });
    const doubled = buildOperatorParameters({ mode: 'ratio', ratio: 2, detune: 0 });

    expect(operatorFrequencyHz(half, noteFrequencyHz)).toBeCloseTo(noteFrequencyHz * 0.5, 10);
    expect(operatorFrequencyHz(doubled, noteFrequencyHz)).toBeCloseTo(noteFrequencyHz * 2, 10);
  });

  it("in 'fixed' mode, returns fixedFrequencyHz and ignores noteFrequencyHz and ratio", () => {
    const fixed = buildOperatorParameters({ mode: 'fixed', fixedFrequencyHz: 800, ratio: 4 });

    expect(operatorFrequencyHz(fixed, 100)).toBe(800);
    expect(operatorFrequencyHz(fixed, 999)).toBe(800);
  });

  it('sweeps all COARSE_RATIOS entries in both modes, asserting every result is finite and greater than 0', () => {
    const noteFrequencyHz = 261.63;
    for (const ratio of COARSE_RATIOS) {
      const ratioMode = buildOperatorParameters({ mode: 'ratio', ratio });
      const ratioResult = operatorFrequencyHz(ratioMode, noteFrequencyHz);
      expect(Number.isFinite(ratioResult)).toBe(true);
      expect(ratioResult).toBeGreaterThan(0);

      const fixedMode = buildOperatorParameters({ mode: 'fixed', ratio, fixedFrequencyHz: 440 });
      const fixedResult = operatorFrequencyHz(fixedMode, noteFrequencyHz);
      expect(Number.isFinite(fixedResult)).toBe(true);
      expect(fixedResult).toBeGreaterThan(0);
    }
  });
});

describe('detuneToCents', () => {
  it('is 0 at detune 0', () => {
    expect(detuneToCents(0)).toBe(0);
  });

  it('is equal in magnitude and opposite in sign at +7 and -7, both small enough to read as fine tuning', () => {
    const positive = detuneToCents(7);
    const negative = detuneToCents(-7);

    expect(positive).toBe(-negative);
    expect(Math.abs(positive)).toBe(7 * CENTS_PER_DETUNE_STEP);
    expect(Math.abs(positive)).toBeLessThan(100); // well under one semitone
  });
});

describe('outputLevelToModulationDepthHz', () => {
  it('is 0 at MIN_OUTPUT_LEVEL for any modulator frequency', () => {
    expect(outputLevelToModulationDepthHz(MIN_OUTPUT_LEVEL, 220)).toBe(0);
    expect(outputLevelToModulationDepthHz(MIN_OUTPUT_LEVEL, 880)).toBe(0);
  });

  it('equals MAX_MODULATION_INDEX * f at MAX_OUTPUT_LEVEL', () => {
    const f = 440;
    expect(outputLevelToModulationDepthHz(MAX_OUTPUT_LEVEL, f)).toBeCloseTo(MAX_MODULATION_INDEX * f, 10);
  });

  it('is exactly proportional to the modulator frequency for a fixed output level', () => {
    const level = 70;
    const f = 300;
    expect(outputLevelToModulationDepthHz(level, 2 * f)).toBeCloseTo(2 * outputLevelToModulationDepthHz(level, f), 10);
  });

  it('is a finite, non-negative number at a representative mid-range value', () => {
    const result = outputLevelToModulationDepthHz(50, 440);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('feedbackLevelToDepthHz', () => {
  it('is 0 at MIN_FEEDBACK_LEVEL for any operator frequency', () => {
    expect(feedbackLevelToDepthHz(MIN_FEEDBACK_LEVEL, 220)).toBe(0);
  });

  it('equals MAX_FEEDBACK_INDEX * f at MAX_FEEDBACK_LEVEL', () => {
    const f = 440;
    expect(feedbackLevelToDepthHz(MAX_FEEDBACK_LEVEL, f)).toBeCloseTo(MAX_FEEDBACK_INDEX * f, 10);
  });

  it('MAX_FEEDBACK_INDEX is strictly less than MAX_MODULATION_INDEX', () => {
    expect(MAX_FEEDBACK_INDEX).toBeLessThan(MAX_MODULATION_INDEX);
  });

  it('is a finite, non-negative number at a representative mid-range value', () => {
    const result = feedbackLevelToDepthHz(4, 440);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('envelopeRateToLevelUnitsPerSample', () => {
  const SAMPLE_RATE = 44100;

  it('is finite and strictly greater than zero at both rate bounds, rate 99 faster than rate 0', () => {
    const rate0 = envelopeRateToLevelUnitsPerSample(MIN_ENVELOPE_RATE, SAMPLE_RATE);
    const rate99 = envelopeRateToLevelUnitsPerSample(MAX_ENVELOPE_RATE, SAMPLE_RATE);

    expect(Number.isFinite(rate0)).toBe(true);
    expect(rate0).toBeGreaterThan(0);
    expect(Number.isFinite(rate99)).toBe(true);
    expect(rate99).toBeGreaterThan(0);
    expect(rate99).toBeGreaterThan(rate0);
  });

  it('is monotonically non-decreasing across the whole 0..99 range', () => {
    let previous = envelopeRateToLevelUnitsPerSample(MIN_ENVELOPE_RATE, SAMPLE_RATE);
    for (let rate = MIN_ENVELOPE_RATE + 1; rate <= MAX_ENVELOPE_RATE; rate += 1) {
      const current = envelopeRateToLevelUnitsPerSample(rate, SAMPLE_RATE);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('resolves a non-finite or out-of-range rate to the slowest in-range speed rather than NaN or zero', () => {
    const slowest = envelopeRateToLevelUnitsPerSample(MIN_ENVELOPE_RATE, SAMPLE_RATE);

    expect(envelopeRateToLevelUnitsPerSample(Number.NaN, SAMPLE_RATE)).toBe(slowest);
    expect(envelopeRateToLevelUnitsPerSample(Number.NEGATIVE_INFINITY, SAMPLE_RATE)).toBe(slowest);
    expect(envelopeRateToLevelUnitsPerSample(MIN_ENVELOPE_RATE - 1, SAMPLE_RATE)).toBe(slowest);
    expect(envelopeRateToLevelUnitsPerSample(MAX_ENVELOPE_RATE + 1, SAMPLE_RATE)).toBeGreaterThan(0);
    expect(Number.isFinite(envelopeRateToLevelUnitsPerSample(MAX_ENVELOPE_RATE + 1, SAMPLE_RATE))).toBe(true);
  });

  it('never emits NaN, zero, or a negative speed for a non-finite, zero, or negative sampleRate', () => {
    for (const badSampleRate of [Number.NaN, 0, -44100, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const step = envelopeRateToLevelUnitsPerSample(MIN_ENVELOPE_RATE, badSampleRate);
      expect(Number.isFinite(step)).toBe(true);
      expect(step).toBeGreaterThan(0);
    }
  });
});

describe('MASTER_GAIN', () => {
  it('WR-01: keeps Algorithm 32-style worst case (every operator a carrier, at MAX_OUTPUT_LEVEL and MAX_VELOCITY, summed in-phase) at or below full scale', () => {
    const perCarrierAmplitude = outputLevelToAmplitude(MAX_OUTPUT_LEVEL) * velocityToAmplitude(MAX_VELOCITY);
    const worstCaseSum = OPERATOR_IDS.length * perCarrierAmplitude * MASTER_GAIN;

    expect(worstCaseSum).toBeLessThanOrEqual(1);
  });
});

/**
 * `operatorFrequencyHz`'s ratio/fixed-mode semantics were built in Phase 8
 * (plan 05-02/08-01); this group is the explicit regression coverage the
 * ROADMAP's Phase 9 frequency-mode success criterion requires — a later
 * reader should not go looking for the phase that implemented this
 * function, only the phase that proved it here.
 */
describe('operatorFrequencyHz — frequency-mode regression coverage (Phase 9 ROADMAP criterion, Phase 8 implementation)', () => {
  const NOTE_FREQUENCY_HZ = 261.63; // C4

  function detuneMultiplier(detune: number): number {
    return Math.pow(2, (detune * CENTS_PER_DETUNE_STEP) / CENTS_PER_OCTAVE);
  }

  it('ratio mode: resolves to noteFrequencyHz * ratio * detune-multiplier at every coarse ratio position and both detune extremes', () => {
    for (const ratio of COARSE_RATIOS) {
      for (const detune of [MIN_DETUNE, MAX_DETUNE]) {
        const parameters = buildOperatorParameters({ mode: 'ratio', ratio, detune });
        const expected = NOTE_FREQUENCY_HZ * ratio * detuneMultiplier(detune);
        expect(operatorFrequencyHz(parameters, NOTE_FREQUENCY_HZ)).toBeCloseTo(expected, 10);
      }
    }
  });

  it('fixed mode: resolves to fixedFrequencyHz at several note frequencies spanning the playable range, entirely independent of noteFrequencyHz and ratio — including a deliberately extreme ratio that must be ignored', () => {
    const fixedFrequencyHz = 880;
    const extremeRatio = COARSE_RATIOS[COARSE_RATIOS.length - 1]!; // 31 — deliberately extreme

    for (const noteFrequencyHz of [55, 261.63, 3520]) {
      const parameters = buildOperatorParameters({ mode: 'fixed', fixedFrequencyHz, ratio: extremeRatio });
      expect(operatorFrequencyHz(parameters, noteFrequencyHz)).toBe(fixedFrequencyHz);
    }
  });

  it('mixed-mode: a six-operator patch mixing ratio- and fixed-mode operators resolves each operator independently', () => {
    const noteFrequencyHz = 220;
    const operators: Record<number, OperatorParameters> = {
      1: buildOperatorParameters({ mode: 'ratio', ratio: 1, detune: 0 }),
      2: buildOperatorParameters({ mode: 'fixed', fixedFrequencyHz: 300, ratio: 7 }),
      3: buildOperatorParameters({ mode: 'ratio', ratio: 3, detune: 4 }),
      4: buildOperatorParameters({ mode: 'fixed', fixedFrequencyHz: 900, ratio: 12 }),
      5: buildOperatorParameters({ mode: 'ratio', ratio: 0.5, detune: -7 }),
      6: buildOperatorParameters({ mode: 'fixed', fixedFrequencyHz: 1500, ratio: 31 }),
    };

    expect(operatorFrequencyHz(operators[1]!, noteFrequencyHz)).toBeCloseTo(noteFrequencyHz * 1, 10);
    expect(operatorFrequencyHz(operators[2]!, noteFrequencyHz)).toBe(300);
    expect(operatorFrequencyHz(operators[3]!, noteFrequencyHz)).toBeCloseTo(
      noteFrequencyHz * 3 * detuneMultiplier(4),
      10,
    );
    expect(operatorFrequencyHz(operators[4]!, noteFrequencyHz)).toBe(900);
    expect(operatorFrequencyHz(operators[5]!, noteFrequencyHz)).toBeCloseTo(
      noteFrequencyHz * 0.5 * detuneMultiplier(-7),
      10,
    );
    expect(operatorFrequencyHz(operators[6]!, noteFrequencyHz)).toBe(1500);
  });
});

/**
 * Second half of Phase 9's rate-curve boundary-edge item — the first half
 * lives in `envelope-generator.spec.ts`. Proves `envelopeRateToLevelUnitsPerSample`
 * actually implements the documented geometric interpolation between
 * {@link ENVELOPE_MIN_FULL_SCALE_SECONDS} and {@link ENVELOPE_MAX_FULL_SCALE_SECONDS}
 * (not merely that it passes through those two constants at the range
 * endpoints), by re-deriving the expected full-scale duration from the
 * exported endpoint constants independently inside the spec rather than
 * against a hardcoded millisecond literal.
 */
describe("envelopeRateToLevelUnitsPerSample — DEFAULT_ENVELOPE's full-scale durations", () => {
  const SAMPLE_RATE = 44100;
  const ENVELOPE_LEVEL_RANGE = MAX_ENVELOPE_LEVEL - MIN_ENVELOPE_LEVEL;
  const ENVELOPE_RATE_RANGE = MAX_ENVELOPE_RATE - MIN_ENVELOPE_RATE;

  function expectedFullScaleSeconds(rate: number): number {
    const normalized = (rate - MIN_ENVELOPE_RATE) / ENVELOPE_RATE_RANGE;
    return (
      ENVELOPE_MAX_FULL_SCALE_SECONDS *
      Math.pow(ENVELOPE_MIN_FULL_SCALE_SECONDS / ENVELOPE_MAX_FULL_SCALE_SECONDS, normalized)
    );
  }

  it.each(DEFAULT_ENVELOPE.rates)(
    "produces the geometrically-interpolated full-scale duration at DEFAULT_ENVELOPE's rate %d",
    (rate) => {
      const step = envelopeRateToLevelUnitsPerSample(rate, SAMPLE_RATE);
      const actualDurationSeconds = ENVELOPE_LEVEL_RANGE / (step * SAMPLE_RATE);
      expect(actualDurationSeconds).toBeCloseTo(expectedFullScaleSeconds(rate), 6);
    },
  );
});
