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

    for (let i = 0; i < SAMPLE_RATE; i++) {
      expect(output[i]).toBeCloseTo(closedFormSine(FREQUENCY_HZ, i), 6);
    }
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

  it('treats a shorter modulation buffer as zero for missing samples, matching a zero-padded buffer of output length', () => {
    const shortOp = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
    const paddedOp = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
    const short = new Float32Array(8);
    short[0] = 0.5;
    const padded = new Float32Array(RENDER_QUANTUM_FRAMES);
    padded[0] = 0.5;
    const shortOutput = new Float32Array(RENDER_QUANTUM_FRAMES);
    const paddedOutput = new Float32Array(RENDER_QUANTUM_FRAMES);

    shortOp.render(shortOutput, short);
    paddedOp.render(paddedOutput, padded);

    expect(shortOutput).toEqual(paddedOutput);
    for (const sample of shortOutput) {
      expect(Number.isFinite(sample)).toBe(true);
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

  describe('renderWithFeedback (Phase 8, D-06)', () => {
    it('renderWithFeedback(output, 0) reproduces render(output) exactly — a zero feedback index is the no-feedback case', () => {
      const viaFeedbackPath = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
      const viaPlainPath = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
      const feedbackOutput = new Float32Array(RENDER_QUANTUM_FRAMES);
      const plainOutput = new Float32Array(RENDER_QUANTUM_FRAMES);

      viaFeedbackPath.renderWithFeedback(feedbackOutput, 0);
      viaPlainPath.render(plainOutput);

      expect(feedbackOutput).toEqual(plainOutput);
    });

    it('honours the one-sample delay recurrence: sample i is sin(2*pi*phase_i + external_i + index * sample_(i-1)), with sample_(-1) = 0', () => {
      const feedbackIndex = 0.35;
      const operator = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
      const output = new Float32Array(RENDER_QUANTUM_FRAMES);
      const external = new Float32Array(RENDER_QUANTUM_FRAMES).fill(0.1);

      operator.renderWithFeedback(output, feedbackIndex, external);

      const increment = FREQUENCY_HZ / SAMPLE_RATE;
      let expectedPhase = 0;
      let previousSample = 0;
      for (let i = 0; i < RENDER_QUANTUM_FRAMES; i++) {
        const expectedSample = Math.sin(TWO_PI * expectedPhase + external[i]! + feedbackIndex * previousSample);
        expect(output[i]).toBeCloseTo(expectedSample, 6);
        previousSample = expectedSample;
        expectedPhase = (expectedPhase + increment) % 1;
      }
    });

    it("proves Algorithm 15's combined shape at operator granularity: one operator receiving a summed external buffer (standing in for operators 5 and 4) plus its own self-feedback term in the same call", () => {
      const feedbackIndex = 0.2;
      const operator = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
      const output = new Float32Array(RENDER_QUANTUM_FRAMES);
      // Stand-ins for operator 5's and operator 4's already-rendered blocks,
      // summed exactly the way GraphRouter.render accumulates incoming
      // non-feedback connections before rendering the target operator.
      const fromOperator5 = new Float32Array(RENDER_QUANTUM_FRAMES).fill(0.05);
      const fromOperator4 = new Float32Array(RENDER_QUANTUM_FRAMES).fill(-0.03);
      const combinedExternal = new Float32Array(RENDER_QUANTUM_FRAMES);
      for (let i = 0; i < RENDER_QUANTUM_FRAMES; i++) {
        combinedExternal[i] = fromOperator5[i]! + fromOperator4[i]!;
      }

      operator.renderWithFeedback(output, feedbackIndex, combinedExternal);

      const increment = FREQUENCY_HZ / SAMPLE_RATE;
      let expectedPhase = 0;
      let previousSample = 0;
      for (let i = 0; i < RENDER_QUANTUM_FRAMES; i++) {
        const expectedSample = Math.sin(
          TWO_PI * expectedPhase + combinedExternal[i]! + feedbackIndex * previousSample,
        );
        expect(output[i]).toBeCloseTo(expectedSample, 6);
        previousSample = expectedSample;
        expectedPhase = (expectedPhase + increment) % 1;
      }
    });

    it('treats a non-finite feedback index and a modulation buffer containing NaN/Infinity as zero, yielding only finite samples within [-1, 1]', () => {
      const operator = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
      const output = new Float32Array(RENDER_QUANTUM_FRAMES);
      const external = new Float32Array(RENDER_QUANTUM_FRAMES);
      external[0] = NaN;
      external[1] = Infinity;
      external[2] = -Infinity;

      operator.renderWithFeedback(output, NaN, external);

      for (const sample of output) {
        expect(Number.isFinite(sample)).toBe(true);
        expect(sample).toBeGreaterThanOrEqual(-1);
        expect(sample).toBeLessThanOrEqual(1);
      }
    });

    it('resetPhase() clears the one-sample feedback history, not only the phase, so a re-rendered feedback block equals the first block exactly', () => {
      const operator = new PhaseModulatedOperator(SAMPLE_RATE, FREQUENCY_HZ);
      const firstBlock = new Float32Array(RENDER_QUANTUM_FRAMES);
      const secondBlock = new Float32Array(RENDER_QUANTUM_FRAMES);
      const external = new Float32Array(RENDER_QUANTUM_FRAMES).fill(0.15);

      operator.renderWithFeedback(firstBlock, 0.5, external);
      operator.resetPhase();
      operator.renderWithFeedback(secondBlock, 0.5, external);

      expect(secondBlock).toEqual(firstBlock);
    });
  });
});
