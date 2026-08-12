import {
  ADDITIVE_FIXTURE_BASE_FREQUENCY_HZ,
  ADDITIVE_FIXTURE_FREQUENCIES_HZ,
  ADDITIVE_FIXTURE_HARMONIC_MULTIPLIERS,
  AdditiveOperatorBank,
} from './additive-fixture';
import { PhaseModulatedOperator } from './operator';

const SAMPLE_RATE = 44100;
const BLOCK_SIZE = 128;

describe('ADDITIVE_FIXTURE_FREQUENCIES_HZ', () => {
  it('derives each frequency from the base frequency and harmonic multipliers', () => {
    ADDITIVE_FIXTURE_FREQUENCIES_HZ.forEach((frequencyHz, index) => {
      expect(frequencyHz).toBe(ADDITIVE_FIXTURE_BASE_FREQUENCY_HZ * ADDITIVE_FIXTURE_HARMONIC_MULTIPLIERS[index]);
    });
  });
});

describe('AdditiveOperatorBank', () => {
  it('renders the exact ascending-order Float32Array accumulation of six independently-rendered operator blocks', () => {
    const bank = new AdditiveOperatorBank(SAMPLE_RATE, BLOCK_SIZE);
    const bankOutput = new Float32Array(BLOCK_SIZE);
    bank.render(bankOutput);

    const expected = new Float32Array(BLOCK_SIZE);
    for (const frequencyHz of ADDITIVE_FIXTURE_FREQUENCIES_HZ) {
      const operator = new PhaseModulatedOperator(SAMPLE_RATE, frequencyHz);
      const scratch = new Float32Array(BLOCK_SIZE);
      operator.render(scratch);
      for (let i = 0; i < BLOCK_SIZE; i++) {
        expected[i] += scratch[i];
      }
    }

    for (let i = 0; i < BLOCK_SIZE; i++) {
      expect(bankOutput[i]).toBe(expected[i]);
    }
  });

  it('throws a RangeError when render is called with a mismatched output length', () => {
    const bank = new AdditiveOperatorBank(SAMPLE_RATE, BLOCK_SIZE);

    expect(() => bank.render(new Float32Array(BLOCK_SIZE + 1))).toThrow(RangeError);
  });

  it('throws a RangeError when constructed with a frequencies array of the wrong length', () => {
    expect(() => new AdditiveOperatorBank(SAMPLE_RATE, BLOCK_SIZE, [220, 440])).toThrow(RangeError);
  });

  it('throws a RangeError naming the offending value for a non-integer or non-positive blockSize', () => {
    expect(() => new AdditiveOperatorBank(SAMPLE_RATE, 0)).toThrow(RangeError);
    expect(() => new AdditiveOperatorBank(SAMPLE_RATE, -128)).toThrow(RangeError);
    expect(() => new AdditiveOperatorBank(SAMPLE_RATE, 128.5)).toThrow(RangeError);
    expect(() => new AdditiveOperatorBank(SAMPLE_RATE, NaN)).toThrow(RangeError);
  });

  it('setBaseFrequencyHz retunes each operator to base * multiplier, matching six independently-constructed operators', () => {
    const bank = new AdditiveOperatorBank(SAMPLE_RATE, BLOCK_SIZE);
    const newBaseHz = 110;

    bank.setBaseFrequencyHz(newBaseHz);

    const bankOutput = new Float32Array(BLOCK_SIZE);
    bank.render(bankOutput);

    const expected = new Float32Array(BLOCK_SIZE);
    for (const multiplier of ADDITIVE_FIXTURE_HARMONIC_MULTIPLIERS) {
      const operator = new PhaseModulatedOperator(SAMPLE_RATE, newBaseHz * multiplier);
      const scratch = new Float32Array(BLOCK_SIZE);
      operator.render(scratch);
      for (let i = 0; i < BLOCK_SIZE; i++) {
        expected[i] += scratch[i];
      }
    }

    for (let i = 0; i < BLOCK_SIZE; i++) {
      expect(bankOutput[i]).toBe(expected[i]);
    }
  });
});
