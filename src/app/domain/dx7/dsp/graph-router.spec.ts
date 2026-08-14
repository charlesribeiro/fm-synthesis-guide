import { MASTER_GAIN, outputLevelToAmplitude, outputLevelToModulationDepthHz } from '../audio/value-conversion';
import { ALGORITHMS } from '../models/algorithms';
import { DEFAULT_OPERATOR_PARAMETERS, MAX_OUTPUT_LEVEL, type OperatorParameters } from '../models/operator-parameters';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import { DEFAULT_PATCH, type OperatorParameterSet } from '../models/patch';
import { PhaseModulatedOperator, RENDER_QUANTUM_FRAMES } from './operator';
import { DESCENDING_OPERATOR_IDS, GraphRouter, buildRoutingConfig } from './graph-router';

const SAMPLE_RATE = 44100;
const NOTE_FREQUENCY_HZ = 440;

const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;

function configuredRouter(algorithmId: number, feedbackLevel = 0): GraphRouter {
  const algorithm = ALGORITHMS.find((candidate) => candidate.id === algorithmId)!;
  const router = new GraphRouter(SAMPLE_RATE, RENDER_QUANTUM_FRAMES);
  router.setRouting(buildRoutingConfig(algorithm));
  router.setOperatorParameters(DEFAULT_PATCH.operators);
  router.setFeedbackLevel(feedbackLevel);
  router.setNoteFrequencyHz(NOTE_FREQUENCY_HZ);
  return router;
}

describe('DESCENDING_OPERATOR_IDS', () => {
  it('is the fixed descending render order [6, 5, 4, 3, 2, 1], equal to a reversed OPERATOR_IDS', () => {
    expect(DESCENDING_OPERATOR_IDS).toEqual([6, 5, 4, 3, 2, 1]);
    expect(DESCENDING_OPERATOR_IDS).toEqual([...OPERATOR_IDS].reverse());
  });
});

describe('buildRoutingConfig', () => {
  it("Algorithm 1's carrier set is exactly [1, 3] — operator 2 (a modulator) is not summed into the output", () => {
    const config = buildRoutingConfig(algorithm1);
    expect(config.carriers).toEqual([1, 3]);
  });
});

describe('PhaseModulatedOperator.renderWithFeedback (zero-index equivalence)', () => {
  it('renderWithFeedback(output, 0) matches render(output) exactly on a separately-constructed instance at the same frequency', () => {
    const viaFeedbackPath = new PhaseModulatedOperator(SAMPLE_RATE, NOTE_FREQUENCY_HZ);
    const viaPlainPath = new PhaseModulatedOperator(SAMPLE_RATE, NOTE_FREQUENCY_HZ);
    const feedbackOutput = new Float32Array(RENDER_QUANTUM_FRAMES);
    const plainOutput = new Float32Array(RENDER_QUANTUM_FRAMES);

    viaFeedbackPath.renderWithFeedback(feedbackOutput, 0);
    viaPlainPath.render(plainOutput);

    expect(feedbackOutput).toEqual(plainOutput);
  });
});

describe('GraphRouter', () => {
  it('rejects a mismatched output.length with a RangeError', () => {
    const router = configuredRouter(1);

    expect(() => router.render(new Float32Array(RENDER_QUANTUM_FRAMES + 1))).toThrow(RangeError);
  });

  it('at feedback level 0 with every operator at DEFAULT_OPERATOR_PARAMETERS, renders Algorithm 1 identically to a hand-built reference computed independently in this spec', () => {
    const router = configuredRouter(1, 0);
    const actual = new Float32Array(RENDER_QUANTUM_FRAMES);
    router.render(actual);

    const expected = renderAlgorithm1Reference();

    // Both sides accumulate through Float32Array (32-bit) storage at every
    // intermediate stage, so tolerance is set to float32's own ~7-decimal-
    // digit precision rather than float64's — a tighter bound would fail on
    // ordinary float32 rounding, not a real mismatch.
    for (let i = 0; i < RENDER_QUANTUM_FRAMES; i++) {
      expect(actual[i]).toBeCloseTo(expected[i]!, 6);
    }
  });
});

describe('ALGORITHMS dataset invariant (higher-modulates-lower)', () => {
  it('every non-self-loop edge across all 32 ALGORITHMS rows satisfies from > to, naming the offending row if not', () => {
    for (const algorithm of ALGORITHMS) {
      for (const edge of algorithm.edges) {
        if (edge.from === edge.to) {
          continue; // the feedback self-loop is exempt by definition
        }
        expect(
          edge.from > edge.to,
          `Algorithm ${algorithm.id}: edge ${edge.from}->${edge.to} violates the higher-modulates-lower invariant DESCENDING_OPERATOR_IDS relies on`,
        ).toBe(true);
      }
    }
  });
});

describe('GraphRouter routing-change hygiene (T-08-04)', () => {
  it('applying Algorithm 2 after Algorithm 1 has built up non-zero feedback history renders identically to a freshly-constructed router configured with Algorithm 2 from the start', () => {
    const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
    const algorithm2 = ALGORITHMS.find((algorithm) => algorithm.id === 2)!;

    const router = new GraphRouter(SAMPLE_RATE, RENDER_QUANTUM_FRAMES);
    router.setRouting(buildRoutingConfig(algorithm1));
    router.setOperatorParameters(DEFAULT_PATCH.operators);
    router.setFeedbackLevel(7); // MAX_FEEDBACK_LEVEL — feedback operator is 6 for Algorithm 1
    router.setNoteFrequencyHz(NOTE_FREQUENCY_HZ);

    const scratch = new Float32Array(RENDER_QUANTUM_FRAMES);
    for (let block = 0; block < 3; block++) {
      router.render(scratch); // builds up operator 6's feedback history
    }

    // Algorithm 2's feedback operator is 2, a different id from Algorithm
    // 1's operator 6 — the case the hygiene guarantee exists for.
    router.setRouting(buildRoutingConfig(algorithm2));
    router.setOperatorParameters(DEFAULT_PATCH.operators);
    router.setFeedbackLevel(7);
    router.setNoteFrequencyHz(NOTE_FREQUENCY_HZ);
    const afterReuse = new Float32Array(RENDER_QUANTUM_FRAMES);
    router.render(afterReuse);

    const fresh = configuredRouter(2, 7);
    const freshOutput = new Float32Array(RENDER_QUANTUM_FRAMES);
    fresh.render(freshOutput);

    expect(afterReuse).toEqual(freshOutput);
  });
});

describe('GraphRouter output bound placement (T-08-03)', () => {
  it('a six-carrier algorithm (Algorithm 32) with every operator at maximum output level and feedback level 0 stays finite and within [-1, 1]', () => {
    const algorithm32 = ALGORITHMS.find((algorithm) => algorithm.id === 32)!;
    const maxLevelOperators = buildOperatorParameterSet({
      ...DEFAULT_OPERATOR_PARAMETERS,
      outputLevel: MAX_OUTPUT_LEVEL,
    });

    const router = new GraphRouter(SAMPLE_RATE, RENDER_QUANTUM_FRAMES);
    router.setRouting(buildRoutingConfig(algorithm32));
    router.setOperatorParameters(maxLevelOperators);
    router.setFeedbackLevel(0);
    router.setNoteFrequencyHz(NOTE_FREQUENCY_HZ);

    const output = new Float32Array(RENDER_QUANTUM_FRAMES);
    router.render(output);

    for (const sample of output) {
      expect(Number.isFinite(sample)).toBe(true);
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });
});

/** Builds a full six-operator `OperatorParameterSet` from one parameters
 * value applied uniformly, mirroring `DEFAULT_PATCH`'s own uniform-default
 * construction. */
function buildOperatorParameterSet(parameters: OperatorParameters): OperatorParameterSet {
  const entries = OPERATOR_IDS.map((id) => [id, parameters] as const);
  return Object.freeze(Object.fromEntries(entries)) as OperatorParameterSet;
}

/**
 * Independent hand-built reference for Algorithm 1 (edges 6->5, 5->4,
 * 4->3, 2->1, plus the 6->6 feedback self-loop) at feedback level 0 with
 * every operator at `DEFAULT_PATCH.operators`'s uniform default — built
 * directly from six standalone `PhaseModulatedOperator` instances and the
 * same pure `value-conversion.ts` functions `GraphRouter` uses internally,
 * but never calling `GraphRouter` itself. Algorithm 1's edges are mirrored
 * explicitly here rather than read back from `algorithms.ts`, so this
 * reference cannot accidentally share a bug with `buildRoutingConfig`.
 */
function renderAlgorithm1Reference(): Float32Array {
  const parameters = DEFAULT_PATCH.operators[1];
  // ratio 1.0, detune 0 under the uniform default — every operator resolves
  // to the same frequency as the held note.
  const frequencyHz = NOTE_FREQUENCY_HZ * parameters.ratio;
  const amplitude = outputLevelToAmplitude(parameters.outputLevel);
  const modulationIndex = outputLevelToModulationDepthHz(parameters.outputLevel, frequencyHz) / frequencyHz;
  // feedbackLevelToDepthHz(0, frequencyHz) is 0 at MIN_FEEDBACK_LEVEL regardless of frequency.
  const feedbackIndex = 0;

  const operators = new Map<OperatorId, PhaseModulatedOperator>(
    OPERATOR_IDS.map((id) => [id, new PhaseModulatedOperator(SAMPLE_RATE, frequencyHz)]),
  );
  const blocks = new Map<OperatorId, Float32Array>(
    OPERATOR_IDS.map((id) => [id, new Float32Array(RENDER_QUANTUM_FRAMES)]),
  );

  operators.get(6)!.renderWithFeedback(blocks.get(6)!, feedbackIndex);
  operators.get(5)!.render(blocks.get(5)!, scale(blocks.get(6)!, modulationIndex));
  operators.get(4)!.render(blocks.get(4)!, scale(blocks.get(5)!, modulationIndex));
  operators.get(3)!.render(blocks.get(3)!, scale(blocks.get(4)!, modulationIndex));
  operators.get(2)!.render(blocks.get(2)!);
  operators.get(1)!.render(blocks.get(1)!, scale(blocks.get(2)!, modulationIndex));

  const output = new Float32Array(RENDER_QUANTUM_FRAMES);
  for (let i = 0; i < RENDER_QUANTUM_FRAMES; i++) {
    const carrierSum = blocks.get(1)![i]! + blocks.get(3)![i]!;
    output[i] = Math.min(1, Math.max(-1, carrierSum * amplitude * MASTER_GAIN));
  }
  return output;
}

function scale(block: Float32Array, factor: number): Float32Array {
  const scaled = new Float32Array(block.length);
  for (let i = 0; i < block.length; i++) {
    scaled[i] = block[i]! * factor;
  }
  return scaled;
}
