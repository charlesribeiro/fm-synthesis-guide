import type { AlgorithmDefinition } from '../models/algorithm-definition';
import type { ModulationEdge } from '../models/modulation-edge';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import { evaluateAlgorithmReference, type ReferenceEvaluationInput } from './reference-evaluator';

const SAMPLE_RATE = 44100;
const BLOCK_SIZE = 6;

/** Builds a minimal `AlgorithmDefinition`-shaped fixture from an edge list —
 * these tests exercise `evaluateAlgorithmReference` entirely on its own
 * hand-built fixtures, never against `GraphRouter` (that cross-check is
 * `algorithm-routing.spec.ts`'s job). */
function buildAlgorithm(edges: readonly ModulationEdge[]): AlgorithmDefinition {
  return {
    id: 1,
    name: 'reference-evaluator test fixture',
    edges,
    teachingTags: ['additive-stacks'],
  };
}

/** An all-zero `Record<OperatorId, number>`, overridden per test with only
 * the operator ids that matter to that case. */
function record(overrides: Partial<Record<OperatorId, number>> = {}): Record<OperatorId, number> {
  const base = Object.fromEntries(OPERATOR_IDS.map((id) => [id, 0])) as Record<OperatorId, number>;
  return { ...base, ...overrides };
}

function expectFiniteAndBounded(output: Float32Array): void {
  for (const sample of output) {
    expect(Number.isFinite(sample)).toBe(true);
    expect(sample).toBeGreaterThanOrEqual(-1);
    expect(sample).toBeLessThanOrEqual(1);
  }
}

describe('evaluateAlgorithmReference', () => {
  it('a single carrier with no modulation edges returns carrierAmplitude * outputGain * sin(2*pi*f*i/sampleRate), bounded', () => {
    const algorithm = buildAlgorithm([]); // no edges: every operator is a carrier (D-05); only id 1 has non-zero amplitude
    const carrierAmplitude = 0.8;
    const outputGain = 0.5;
    const frequencyHz = 440;
    const input: ReferenceEvaluationInput = {
      sampleRate: SAMPLE_RATE,
      blockSize: BLOCK_SIZE,
      operatorFrequenciesHz: record({ 1: frequencyHz }),
      modulationIndices: record(),
      carrierAmplitudes: record({ 1: carrierAmplitude }),
      feedbackIndex: 0,
      outputGain,
    };

    const output = evaluateAlgorithmReference(algorithm, input);

    for (let i = 0; i < BLOCK_SIZE; i++) {
      const phase = ((frequencyHz * i) / SAMPLE_RATE) % 1;
      const expected = carrierAmplitude * outputGain * Math.sin(2 * Math.PI * phase);
      expect(output[i]).toBeCloseTo(expected, 6);
    }
    expectFiniteAndBounded(output);
  });

  it('a two-operator chain (modulator 2 into carrier 1, no feedback) matches sin(2*pi*fc*i/N + index_m * sin(2*pi*fm*i/N))', () => {
    const algorithm = buildAlgorithm([{ from: 2, to: 1 }]);
    const fc = 300;
    const fm = 50;
    const modulationIndex = 2.5;
    const input: ReferenceEvaluationInput = {
      sampleRate: SAMPLE_RATE,
      blockSize: BLOCK_SIZE,
      operatorFrequenciesHz: record({ 1: fc, 2: fm }),
      modulationIndices: record({ 2: modulationIndex }),
      carrierAmplitudes: record({ 1: 1 }),
      feedbackIndex: 0,
      outputGain: 1,
    };

    const output = evaluateAlgorithmReference(algorithm, input);

    for (let i = 0; i < BLOCK_SIZE; i++) {
      const fcPhase = ((fc * i) / SAMPLE_RATE) % 1;
      const fmPhase = ((fm * i) / SAMPLE_RATE) % 1;
      const modulatorSample = Math.sin(2 * Math.PI * fmPhase);
      const expected = Math.sin(2 * Math.PI * fcPhase + modulationIndex * modulatorSample);
      expect(output[i]).toBeCloseTo(expected, 6);
    }
  });

  it("an operator carrying only a self-loop is treated as a carrier and contributes to the output, with the self term zero at i=0 and using sample i-1 thereafter", () => {
    const algorithm = buildAlgorithm([{ from: 1, to: 1 }]);
    const frequencyHz = 500;
    const feedbackIndex = 0.6;
    const input: ReferenceEvaluationInput = {
      sampleRate: SAMPLE_RATE,
      blockSize: BLOCK_SIZE,
      operatorFrequenciesHz: record({ 1: frequencyHz }),
      modulationIndices: record(),
      carrierAmplitudes: record({ 1: 1 }),
      feedbackIndex,
      outputGain: 1,
    };

    const output = evaluateAlgorithmReference(algorithm, input);

    let previousSample = 0;
    let anyNonZero = false;
    for (let i = 0; i < BLOCK_SIZE; i++) {
      const phase = ((frequencyHz * i) / SAMPLE_RATE) % 1;
      const modulation = feedbackIndex * previousSample;
      const expected = Math.sin(2 * Math.PI * phase + modulation);
      expect(output[i]).toBeCloseTo(expected, 6);
      previousSample = expected;
      if (Math.abs(expected) > 1e-9) {
        anyNonZero = true;
      }
    }
    // i = 0 always has a zero self term, since sample_(-1) = 0 by definition.
    expect(output[0]).toBeCloseTo(0, 6);
    // The self-loop carrier still contributes real audio, proving a bare
    // self-loop never disqualifies it from being summed into the output.
    expect(anyNonZero).toBe(true);
  });

  it('an operator with two incoming edges receives the sum of both scaled modulator samples', () => {
    const algorithm = buildAlgorithm([
      { from: 2, to: 1 },
      { from: 3, to: 1 },
    ]);
    const f1 = 220;
    const f2 = 60;
    const f3 = 90;
    const index2 = 1.2;
    const index3 = 0.7;
    const input: ReferenceEvaluationInput = {
      sampleRate: SAMPLE_RATE,
      blockSize: BLOCK_SIZE,
      operatorFrequenciesHz: record({ 1: f1, 2: f2, 3: f3 }),
      modulationIndices: record({ 2: index2, 3: index3 }),
      carrierAmplitudes: record({ 1: 1 }),
      feedbackIndex: 0,
      outputGain: 1,
    };

    const output = evaluateAlgorithmReference(algorithm, input);

    for (let i = 0; i < BLOCK_SIZE; i++) {
      const phase1 = ((f1 * i) / SAMPLE_RATE) % 1;
      const phase2 = ((f2 * i) / SAMPLE_RATE) % 1;
      const phase3 = ((f3 * i) / SAMPLE_RATE) % 1;
      const sample2 = Math.sin(2 * Math.PI * phase2);
      const sample3 = Math.sin(2 * Math.PI * phase3);
      const modulation = index2 * sample2 + index3 * sample3;
      const expected = Math.sin(2 * Math.PI * phase1 + modulation);
      expect(output[i]).toBeCloseTo(expected, 6);
    }
  });

  it('an operator with both incoming edges and a self-loop receives all three contributions in the same sample phase argument', () => {
    const algorithm = buildAlgorithm([
      { from: 2, to: 1 },
      { from: 3, to: 1 },
      { from: 1, to: 1 },
    ]);
    const f1 = 180;
    const f2 = 40;
    const f3 = 65;
    const index2 = 0.9;
    const index3 = 0.5;
    const feedbackIndex = 0.4;
    const input: ReferenceEvaluationInput = {
      sampleRate: SAMPLE_RATE,
      blockSize: BLOCK_SIZE,
      operatorFrequenciesHz: record({ 1: f1, 2: f2, 3: f3 }),
      modulationIndices: record({ 2: index2, 3: index3 }),
      carrierAmplitudes: record({ 1: 1 }),
      feedbackIndex,
      outputGain: 1,
    };

    const output = evaluateAlgorithmReference(algorithm, input);

    let previousSample = 0;
    for (let i = 0; i < BLOCK_SIZE; i++) {
      const phase1 = ((f1 * i) / SAMPLE_RATE) % 1;
      const phase2 = ((f2 * i) / SAMPLE_RATE) % 1;
      const phase3 = ((f3 * i) / SAMPLE_RATE) % 1;
      const sample2 = Math.sin(2 * Math.PI * phase2);
      const sample3 = Math.sin(2 * Math.PI * phase3);
      const modulation = index2 * sample2 + index3 * sample3 + feedbackIndex * previousSample;
      const expected = Math.sin(2 * Math.PI * phase1 + modulation);
      expect(output[i]).toBeCloseTo(expected, 6);
      previousSample = expected;
    }
  });

  it('yields only finite samples within the hard bound even when every carrier is driven at maximum amplitude', () => {
    const algorithm = buildAlgorithm([]); // every operator a carrier, worst-case summed amplitude
    const carrierAmplitudes = record({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 });
    const frequenciesHz = record({ 1: 100, 2: 133, 3: 177, 4: 211, 5: 251, 6: 293 });
    const input: ReferenceEvaluationInput = {
      sampleRate: SAMPLE_RATE,
      blockSize: BLOCK_SIZE,
      operatorFrequenciesHz: frequenciesHz,
      modulationIndices: record(),
      carrierAmplitudes,
      feedbackIndex: 0,
      // Six unity carriers can sum to 6 before this gain — mirrors the
      // MASTER_GAIN role in GraphRouter, needed here only to keep the raw
      // sum inside the bound without relying on the clamp alone.
      outputGain: 1 / 6,
    };

    const output = evaluateAlgorithmReference(algorithm, input);

    expectFiniteAndBounded(output);
  });

  it('the hard bound clamps even an unnormalised worst case (outputGain = 1, six unity carriers) rather than producing an out-of-range sample', () => {
    const algorithm = buildAlgorithm([]);
    const carrierAmplitudes = record({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 });
    const frequenciesHz = record({ 1: 100, 2: 133, 3: 177, 4: 211, 5: 251, 6: 293 });
    const input: ReferenceEvaluationInput = {
      sampleRate: SAMPLE_RATE,
      blockSize: BLOCK_SIZE,
      operatorFrequenciesHz: frequenciesHz,
      modulationIndices: record(),
      carrierAmplitudes,
      feedbackIndex: 0,
      outputGain: 1,
    };

    const output = evaluateAlgorithmReference(algorithm, input);

    expectFiniteAndBounded(output);
  });
});
