import { PhaseModulatedOperator, RENDER_QUANTUM_FRAMES, TWO_PI } from './operator';

const SAMPLE_RATE = 44100;
const FREQUENCY_HZ = 440;

function closedFormSine(frequencyHz: number, sampleIndex: number, phaseOffset = 0): number {
  return Math.sin((TWO_PI * frequencyHz * sampleIndex) / SAMPLE_RATE + phaseOffset);
}

describe('PhaseModulatedOperator', () => {
  it('renders a 128-sample block matching the closed-form sin(2*pi*f*i/sampleRate) reference to 6 decimal places', () => {
    const operator = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
    const output = new Float32Array(RENDER_QUANTUM_FRAMES);

    operator.render(output);

    for (let i = 0; i < RENDER_QUANTUM_FRAMES; i++) {
      expect(output[i]).toBeCloseTo(closedFormSine(FREQUENCY_HZ, i), 6);
    }
  });

  it('keeps the analytical match flat (not drifting) across a full one-second block (44100 samples)', () => {
    const operator = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
    const output = new Float32Array(SAMPLE_RATE);

    operator.render(output);

    for (let i = 0; i < SAMPLE_RATE; i += 1000) {
      expect(output[i]).toBeCloseTo(closedFormSine(FREQUENCY_HZ, i), 6);
    }
    const lastIndex = SAMPLE_RATE - 1;
    expect(output[lastIndex]).toBeCloseTo(closedFormSine(FREQUENCY_HZ, lastIndex), 6);
  });

  it('shifts output by a constant Math.PI / 2 modulation buffer to sin(2*pi*f*i/sampleRate + pi/2)', () => {
    const operator = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
    const output = new Float32Array(RENDER_QUANTUM_FRAMES);
    const modulation = new Float32Array(RENDER_QUANTUM_FRAMES).fill(Math.PI / 2);

    operator.render(output, modulation);

    for (let i = 0; i < RENDER_QUANTUM_FRAMES; i++) {
      expect(output[i]).toBeCloseTo(closedFormSine(FREQUENCY_HZ, i, Math.PI / 2), 6);
    }
  });

  it('produces output identical, element for element, to an all-zero modulation buffer when the argument is omitted', () => {
    const withOmitted = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
    const withZeroBuffer = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
    const omittedOutput = new Float32Array(RENDER_QUANTUM_FRAMES);
    const zeroBufferOutput = new Float32Array(RENDER_QUANTUM_FRAMES);
    const zeroModulation = new Float32Array(RENDER_QUANTUM_FRAMES);

    withOmitted.render(omittedOutput);
    withZeroBuffer.render(zeroBufferOutput, zeroModulation);

    expect(omittedOutput).toEqual(zeroBufferOutput);
  });

  it('yields only finite samples within [-1, 1] when the modulation buffer contains NaN and Infinity', () => {
    const operator = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
    const output = new Float32Array(RENDER_QUANTUM_FRAMES);
    const modulation = new Float32Array(RENDER_QUANTUM_FRAMES);
    modulation[0] = NaN;
    modulation[1] = Infinity;
    modulation[2] = -Infinity;

    operator.render(output, modulation);

    for (const sample of output) {
      expect(Number.isFinite(sample)).toBe(true);
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });

  it('throws a RangeError naming the offending value for a non-finite or non-positive sampleRate', () => {
    expect(() => new PhaseModulatedOperator(0, FREQUENCY_HZ)).toThrow(RangeError);
    expect(() => new PhaseModulatedOperator(0, FREQUENCY_HZ)).toThrow(/0/);
    expect(() => new PhaseModulatedOperator(-44100, FREQUENCY_HZ)).toThrow(RangeError);
    expect(() => new PhaseModulatedOperator(NaN, FREQUENCY_HZ)).toThrow(RangeError);
    expect(() => new PhaseModulatedOperator(Infinity, FREQUENCY_HZ)).toThrow(RangeError);
  });

  it('throws a RangeError naming the offending value when setFrequencyHz receives a non-finite or negative value', () => {
    const operator = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
    expect(() => operator.setFrequencyHz(-1)).toThrow(RangeError);
    expect(() => operator.setFrequencyHz(-1)).toThrow(/-1/);
    expect(() => operator.setFrequencyHz(NaN)).toThrow(RangeError);
    expect(() => operator.setFrequencyHz(Infinity)).toThrow(RangeError);
  });

  it('resetPhase() returns the accumulator to 0 so a re-rendered block equals the first block exactly', () => {
    const operator = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
    const firstBlock = new Float32Array(RENDER_QUANTUM_FRAMES);
    const secondBlock = new Float32Array(RENDER_QUANTUM_FRAMES);

    operator.render(firstBlock);
    operator.resetPhase();
    operator.render(secondBlock);

    expect(secondBlock).toEqual(firstBlock);
  });
});
