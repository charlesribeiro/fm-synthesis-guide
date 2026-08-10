import {
  COARSE_RATIOS,
  DEFAULT_OPERATOR_PARAMETERS,
  MAX_OUTPUT_LEVEL,
  MIN_OUTPUT_LEVEL,
  type OperatorParameters,
} from '../models/operator-parameters';
import { MAX_FEEDBACK_LEVEL, MIN_FEEDBACK_LEVEL } from '../models/patch';
import { OPERATOR_IDS } from '../models/operator';
import {
  A4_FREQUENCY_HZ,
  A4_MIDI_NOTE,
  CENTS_PER_DETUNE_STEP,
  MASTER_GAIN,
  MAX_FEEDBACK_INDEX,
  MAX_MODULATION_INDEX,
  MAX_VELOCITY,
  MIN_VELOCITY,
  detuneToCents,
  feedbackLevelToDepthHz,
  midiNoteToFrequency,
  operatorFrequencyHz,
  outputLevelToAmplitude,
  outputLevelToModulationDepthHz,
  velocityToAmplitude,
} from './value-conversion';

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

describe('MASTER_GAIN', () => {
  it('WR-01: keeps Algorithm 32-style worst case (every operator a carrier, at MAX_OUTPUT_LEVEL and MAX_VELOCITY, summed in-phase) at or below full scale', () => {
    const perCarrierAmplitude = outputLevelToAmplitude(MAX_OUTPUT_LEVEL) * velocityToAmplitude(MAX_VELOCITY);
    const worstCaseSum = OPERATOR_IDS.length * perCarrierAmplitude * MASTER_GAIN;

    expect(worstCaseSum).toBeLessThanOrEqual(1);
  });
});
