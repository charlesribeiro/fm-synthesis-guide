import {
  MASTER_GAIN,
  MAX_VELOCITY,
  MIN_VELOCITY,
  envelopeRateToLevelUnitsPerSample,
  outputLevelToAmplitude,
  outputLevelToModulationDepthHz,
} from '../audio/value-conversion';
import { ALGORITHMS } from '../models/algorithms';
import { TEACHING_TAGS, type AlgorithmDefinition } from '../models/algorithm-definition';
import { deriveCarriers } from '../models/derive-role';
import {
  DEFAULT_ENVELOPE,
  DEFAULT_OPERATOR_PARAMETERS,
  MAX_ENVELOPE_LEVEL,
  MAX_ENVELOPE_RATE,
  MAX_OUTPUT_LEVEL,
  MIN_ENVELOPE_LEVEL,
  type Dx7Envelope,
  type OperatorParameters,
} from '../models/operator-parameters';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import { DEFAULT_PATCH, MAX_FEEDBACK_LEVEL, type OperatorParameterSet } from '../models/patch';
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

/**
 * Phase 9: the render path now requires the router to be gated, and every
 * operator's envelope to have reached its maximum-amplitude plateau, before
 * its output is arithmetically identical to Phase 8's un-enveloped expected
 * values (see `algorithm-routing.spec.ts`'s identical fixture and rationale).
 */
const GATED_MAX_ENVELOPE: Dx7Envelope = Object.freeze({
  rates: Object.freeze([MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE] as const),
  levels: Object.freeze([MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL] as const),
});

/** Computed from the exported rate curve, matching `algorithm-routing.spec.ts`'s
 * identical derivation — see that file's comment for the full rationale. */
const WARM_UP_BLOCK_COUNT = Math.ceil(
  Math.ceil((MAX_ENVELOPE_LEVEL - MIN_ENVELOPE_LEVEL) / envelopeRateToLevelUnitsPerSample(MAX_ENVELOPE_RATE, SAMPLE_RATE)) /
    RENDER_QUANTUM_FRAMES,
);

/** Every operator's envelope replaced with {@link GATED_MAX_ENVELOPE} —
 * everything else about `operators` is preserved. */
function withGatedEnvelope(operators: OperatorParameterSet): OperatorParameterSet {
  const entries = OPERATOR_IDS.map((id) => [id, { ...operators[id], envelope: GATED_MAX_ENVELOPE }] as const);
  return Object.freeze(Object.fromEntries(entries)) as OperatorParameterSet;
}

/**
 * Gates `router` open at maximum velocity with every operator's envelope
 * set to {@link GATED_MAX_ENVELOPE}, then renders and discards
 * {@link WARM_UP_BLOCK_COUNT} blocks so every envelope has reached its
 * maximum-amplitude plateau before the caller renders the block under test.
 */
function gateAndWarmUp(router: GraphRouter, operators: OperatorParameterSet): void {
  router.setOperatorParameters(withGatedEnvelope(operators));
  router.setGate(true, MAX_VELOCITY);

  const scratch = new Float32Array(RENDER_QUANTUM_FRAMES);
  for (let block = 0; block < WARM_UP_BLOCK_COUNT; block++) {
    router.render(scratch);
  }
}

/**
 * Task 2 (T-09-02/T-09-03): one algorithm per teaching-taxonomy group,
 * selected by reading its own `teachingTags` from the dataset rather than by
 * hardcoding four algorithm ids — a future dataset change cannot silently
 * narrow this sweep.
 */
const TAXONOMY_SWEEP_ALGORITHMS: readonly AlgorithmDefinition[] = TEACHING_TAGS.map(
  (tag) => ALGORITHMS.find((algorithm) => algorithm.teachingTags.includes(tag))!,
);

function assertFiniteAndBounded(block: Float32Array): void {
  for (const sample of block) {
    expect(Number.isFinite(sample)).toBe(true);
    expect(sample).toBeGreaterThanOrEqual(-1);
    expect(sample).toBeLessThanOrEqual(1);
  }
}

/** How many blocks it takes {@link DEFAULT_ENVELOPE}'s attack (rate index 0)
 * or release (rate index 3) segment to traverse the full level range,
 * computed from the exported rate curve rather than hardcoded, plus a
 * one-block margin so the segment has fully settled before the sweep moves
 * on. */
function blocksToTraverseSegment(rate: number): number {
  const step = envelopeRateToLevelUnitsPerSample(rate, SAMPLE_RATE);
  return (
    Math.ceil(Math.ceil((MAX_ENVELOPE_LEVEL - MIN_ENVELOPE_LEVEL) / step) / RENDER_QUANTUM_FRAMES) + 1
  );
}

const ATTACK_BLOCK_COUNT = blocksToTraverseSegment(DEFAULT_ENVELOPE.rates[0]);
const RELEASE_BLOCK_COUNT = blocksToTraverseSegment(DEFAULT_ENVELOPE.rates[3]);
const SUSTAIN_BLOCK_COUNT = 8;

/**
 * Runs the full gate-on/attack/long-sustain/gate-off/release-to-silence
 * lifecycle (T-09-02) on `algorithm`, asserting every rendered sample of
 * every block is finite and inside the existing hard output bound.
 */
function runFullLifecycleSweep(algorithm: AlgorithmDefinition, operators: OperatorParameterSet, feedbackLevel: number): void {
  const router = new GraphRouter(SAMPLE_RATE, RENDER_QUANTUM_FRAMES);
  router.setRouting(buildRoutingConfig(algorithm));
  router.setOperatorParameters(operators);
  router.setFeedbackLevel(feedbackLevel);
  router.setNoteFrequencyHz(NOTE_FREQUENCY_HZ);
  router.setGate(true, MAX_VELOCITY);

  const scratch = new Float32Array(RENDER_QUANTUM_FRAMES);
  for (let block = 0; block < ATTACK_BLOCK_COUNT; block++) {
    router.render(scratch);
    assertFiniteAndBounded(scratch);
  }
  for (let block = 0; block < SUSTAIN_BLOCK_COUNT; block++) {
    router.render(scratch);
    assertFiniteAndBounded(scratch);
  }
  router.setGate(false, MIN_VELOCITY);
  for (let block = 0; block < RELEASE_BLOCK_COUNT; block++) {
    router.render(scratch);
    assertFiniteAndBounded(scratch);
  }
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

  // Phase 9, D-02: with the dedicated per-voice Web Audio gain node gone,
  // silence at rest depends entirely on the router never having been gated.
  it('a router configured with any algorithm but never gated renders an all-zero block', () => {
    for (const algorithm of [1, 8, 22, 32]) {
      const router = configuredRouter(algorithm, 4);
      const output = new Float32Array(RENDER_QUANTUM_FRAMES);
      router.render(output);

      for (const sample of output) {
        expect(sample).toBe(0);
      }
    }
  });

  it('at feedback level 0 with every operator at DEFAULT_OPERATOR_PARAMETERS, renders Algorithm 1 identically to a hand-built reference computed independently in this spec', () => {
    const router = configuredRouter(1, 0);
    // Gated (and warmed to the envelope's maximum-amplitude plateau) so the
    // router's post-warm-up block is arithmetically identical to the
    // un-enveloped hand-built reference below (Phase 9).
    gateAndWarmUp(router, DEFAULT_PATCH.operators);
    const actual = new Float32Array(RENDER_QUANTUM_FRAMES);
    router.render(actual);

    // The reference is evaluated over the warm-up span plus one block, then
    // only the tail (the last RENDER_QUANTUM_FRAMES samples) is compared —
    // mirrors `algorithm-routing.spec.ts`'s identical technique.
    const expectedFull = renderAlgorithm1Reference((WARM_UP_BLOCK_COUNT + 1) * RENDER_QUANTUM_FRAMES);
    const expected = expectedFull.slice(expectedFull.length - RENDER_QUANTUM_FRAMES);

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
    // Gates and warms every envelope to its maximum-amplitude plateau
    // (Phase 9) — once saturated the level stays clamped at the maximum for
    // any further render call while held, so this warm-up is not repeated
    // after the switch below; only the operator phase/feedback-history reset
    // `setRouting` performs needs re-matching (see below).
    gateAndWarmUp(router, DEFAULT_PATCH.operators);

    const scratch = new Float32Array(RENDER_QUANTUM_FRAMES);
    for (let block = 0; block < 3; block++) {
      router.render(scratch); // builds up operator 6's feedback history
    }

    // Algorithm 2's feedback operator is 2, a different id from Algorithm
    // 1's operator 6 — the case the hygiene guarantee exists for. Re-applies
    // the same gated-envelope operator set — recomputeDerivedValues re-
    // targets the already-saturated envelopes without resetting them (D-04).
    router.setRouting(buildRoutingConfig(algorithm2));
    router.setOperatorParameters(withGatedEnvelope(DEFAULT_PATCH.operators));
    router.setFeedbackLevel(7);
    router.setNoteFrequencyHz(NOTE_FREQUENCY_HZ);
    // `setRouting` resets every operator's phase and feedback history to
    // zero (T-08-04) but never resets envelope state — so from here, the
    // reused router's operator/feedback state is at the exact same "zero"
    // starting point a freshly-constructed router's is, while its envelope
    // is already saturated. Rendering the same WARM_UP_BLOCK_COUNT-block
    // warm-up (a no-op for the already-saturated envelope, but real phase/
    // feedback-history progress) before the comparison block puts both
    // sides' operator phase and feedback history at the identical elapsed-
    // sample-count state, for an exact byte-for-byte match below.
    for (let block = 0; block < WARM_UP_BLOCK_COUNT; block++) {
      router.render(scratch);
    }
    const afterReuse = new Float32Array(RENDER_QUANTUM_FRAMES);
    router.render(afterReuse);

    const fresh = configuredRouter(2, 7);
    gateAndWarmUp(fresh, DEFAULT_PATCH.operators);
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
    gateAndWarmUp(router, maxLevelOperators);

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

describe('GraphRouter note-lifecycle sweep (T-09-02)', () => {
  it('stays finite and inside the hard bound across a full gate-on, attack, long sustain, gate-off, release-to-silence lifecycle, one algorithm per teaching-taxonomy group', () => {
    for (const algorithm of TAXONOMY_SWEEP_ALGORITHMS) {
      runFullLifecycleSweep(algorithm, DEFAULT_PATCH.operators, 0);
    }
  });

  it('stays finite and inside the hard bound across the same lifecycle at maximum feedback depth with every operator at maximum output level (the worst case)', () => {
    const maxLevelOperators = buildOperatorParameterSet({
      ...DEFAULT_OPERATOR_PARAMETERS,
      outputLevel: MAX_OUTPUT_LEVEL,
    });
    for (const algorithm of TAXONOMY_SWEEP_ALGORITHMS) {
      runFullLifecycleSweep(algorithm, maxLevelOperators, MAX_FEEDBACK_LEVEL);
    }
  });
});

describe('GraphRouter silence at rest (T-09-03)', () => {
  it('a freshly constructed, never-gated router renders exactly zero across several blocks, on each taxonomy-sweep algorithm', () => {
    for (const algorithm of TAXONOMY_SWEEP_ALGORITHMS) {
      const router = configuredRouter(algorithm.id, 4);
      const output = new Float32Array(RENDER_QUANTUM_FRAMES);
      for (let block = 0; block < 5; block++) {
        router.render(output);
        for (const sample of output) {
          expect(sample).toBe(0);
        }
      }
    }
  });

  it('once the release segment has completed against DEFAULT_ENVELOPE\'s zero release target, every subsequent sample is exactly zero across many further blocks, on each taxonomy-sweep algorithm', () => {
    for (const algorithm of TAXONOMY_SWEEP_ALGORITHMS) {
      const router = configuredRouter(algorithm.id, 0);
      router.setGate(true, MAX_VELOCITY);
      const scratch = new Float32Array(RENDER_QUANTUM_FRAMES);
      for (let block = 0; block < ATTACK_BLOCK_COUNT; block++) {
        router.render(scratch);
      }
      router.setGate(false, MIN_VELOCITY);
      for (let block = 0; block < RELEASE_BLOCK_COUNT; block++) {
        router.render(scratch);
      }

      for (let block = 0; block < 5; block++) {
        router.render(scratch);
        for (const sample of scratch) {
          expect(sample).toBe(0);
        }
      }
    }
  });
});

/**
 * Task 2's highest-value case (T-09-02): proves a modulator-role operator's
 * envelope actually reaches the rendered output, not only the amplitude a
 * modulator's own envelope contributes when it happens to also be a carrier.
 * Algorithm 1 is used because its carrier/modulator split is already proven
 * elsewhere (`buildRoutingConfig` above) and read here from the dataset
 * (`deriveCarriers`) rather than assumed.
 */
describe('GraphRouter modulator-envelope reachability (T-09-02)', () => {
  const REACHABILITY_ALGORITHM = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
  const REACHABILITY_CARRIERS = deriveCarriers(REACHABILITY_ALGORITHM);
  const REACHABILITY_MODULATORS = OPERATOR_IDS.filter((id) => !REACHABILITY_CARRIERS.includes(id));
  const modulatorId = REACHABILITY_MODULATORS[0]!;
  const carrierId = REACHABILITY_CARRIERS[0]!;

  /** Fast (max-rate) like {@link GATED_MAX_ENVELOPE} so the plateau is
   * reached within the same {@link WARM_UP_BLOCK_COUNT}, but plateaus at a
   * different level (40, not 99) — a deterministic, timing-independent
   * difference from the baseline envelope once both have settled. */
  const REACHABILITY_TEST_ENVELOPE: Dx7Envelope = Object.freeze({
    rates: Object.freeze([MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE] as const),
    levels: Object.freeze([40, 40, 40, 0] as const),
  });

  /** A block position counts as "differing" only once it exceeds ordinary
   * float rounding noise. */
  const DIFFERENCE_EPSILON = 1e-6;
  /** At the settled plateau the two envelope amplitudes are constant but
   * unequal across the whole block, so nearly every sample differs — a
   * stated floor well above "at least one sample" proves the effect is
   * pervasive, not a single coincidental rounding difference. */
  const MIN_DIFFERING_SAMPLE_COUNT = 100;

  function withOperatorEnvelope(operators: OperatorParameterSet, id: OperatorId, envelope: Dx7Envelope): OperatorParameterSet {
    return Object.freeze({ ...operators, [id]: { ...operators[id], envelope } }) as OperatorParameterSet;
  }

  /** `overrideId === null` renders the baseline (every operator on
   * {@link GATED_MAX_ENVELOPE}); otherwise exactly one operator's envelope is
   * swapped to {@link REACHABILITY_TEST_ENVELOPE} — every other operator's
   * envelope, output level, ratio and detune stay exactly as they were. */
  function buildReachabilityBlock(overrideId: OperatorId | null): Float32Array {
    const router = new GraphRouter(SAMPLE_RATE, RENDER_QUANTUM_FRAMES);
    router.setRouting(buildRoutingConfig(REACHABILITY_ALGORITHM));
    const baseOperators = withGatedEnvelope(DEFAULT_PATCH.operators);
    const operators = overrideId === null ? baseOperators : withOperatorEnvelope(baseOperators, overrideId, REACHABILITY_TEST_ENVELOPE);
    router.setOperatorParameters(operators);
    router.setFeedbackLevel(0);
    router.setNoteFrequencyHz(NOTE_FREQUENCY_HZ);
    router.setGate(true, MAX_VELOCITY);

    const scratch = new Float32Array(RENDER_QUANTUM_FRAMES);
    for (let block = 0; block < WARM_UP_BLOCK_COUNT; block++) {
      router.render(scratch);
    }
    const output = new Float32Array(RENDER_QUANTUM_FRAMES);
    router.render(output);
    return output;
  }

  function countDifferingSamples(a: Float32Array, b: Float32Array): number {
    let count = 0;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i]! - b[i]!) > DIFFERENCE_EPSILON) {
        count++;
      }
    }
    return count;
  }

  it("changing only a modulator-role operator's envelope, with every carrier's envelope held constant, changes the rendered block", () => {
    const baseline = buildReachabilityBlock(null);
    const withModulatorChanged = buildReachabilityBlock(modulatorId);

    expect(countDifferingSamples(baseline, withModulatorChanged)).toBeGreaterThanOrEqual(MIN_DIFFERING_SAMPLE_COUNT);
  });

  it("changing only a carrier-role operator's envelope changes the rendered block (symmetry check)", () => {
    const baseline = buildReachabilityBlock(null);
    const withCarrierChanged = buildReachabilityBlock(carrierId);

    expect(countDifferingSamples(baseline, withCarrierChanged)).toBeGreaterThanOrEqual(MIN_DIFFERING_SAMPLE_COUNT);
  });
});

describe('GraphRouter held-note re-patch continuity (D-04)', () => {
  /** An envelope restart would drive the block's peak toward zero; staying
   * within half of the pre-change peak is well outside what an ordinary
   * phase-reset-only block-to-block wobble could produce at 440Hz (roughly
   * one full period per 128-sample block), so this margin only tolerates
   * genuine continuity, not a disguised restart. */
  const CONTINUITY_FRACTION = 0.5;

  function peakAbsAmplitude(block: Float32Array): number {
    let peak = 0;
    for (const sample of block) {
      peak = Math.max(peak, Math.abs(sample));
    }
    return peak;
  }

  it('applying a new routing config while gated does not restart the envelope: the post-change block peak stays within the stated fraction of the pre-change peak', () => {
    const router = configuredRouter(1, 0);
    router.setGate(true, MAX_VELOCITY);
    const scratch = new Float32Array(RENDER_QUANTUM_FRAMES);
    for (let block = 0; block < ATTACK_BLOCK_COUNT; block++) {
      router.render(scratch);
    }
    const preChangeBlock = new Float32Array(RENDER_QUANTUM_FRAMES);
    router.render(preChangeBlock);
    const preChangePeak = peakAbsAmplitude(preChangeBlock);
    expect(preChangePeak).toBeGreaterThan(0);

    const algorithm2 = ALGORITHMS.find((algorithm) => algorithm.id === 2)!;
    router.setRouting(buildRoutingConfig(algorithm2));
    const postChangeBlock = new Float32Array(RENDER_QUANTUM_FRAMES);
    router.render(postChangeBlock);
    const postChangePeak = peakAbsAmplitude(postChangeBlock);

    expect(postChangePeak).toBeGreaterThanOrEqual(preChangePeak * CONTINUITY_FRACTION);
  });

  it('pushing a new operator-parameter set while gated does not restart the envelope either', () => {
    const router = configuredRouter(1, 0);
    router.setGate(true, MAX_VELOCITY);
    const scratch = new Float32Array(RENDER_QUANTUM_FRAMES);
    for (let block = 0; block < ATTACK_BLOCK_COUNT; block++) {
      router.render(scratch);
    }
    const preChangeBlock = new Float32Array(RENDER_QUANTUM_FRAMES);
    router.render(preChangeBlock);
    const preChangePeak = peakAbsAmplitude(preChangeBlock);
    expect(preChangePeak).toBeGreaterThan(0);

    const differentOperators = buildOperatorParameterSet({
      ...DEFAULT_OPERATOR_PARAMETERS,
      detune: 3,
    });
    router.setOperatorParameters(differentOperators);
    const postChangeBlock = new Float32Array(RENDER_QUANTUM_FRAMES);
    router.render(postChangeBlock);
    const postChangePeak = peakAbsAmplitude(postChangeBlock);

    expect(postChangePeak).toBeGreaterThanOrEqual(preChangePeak * CONTINUITY_FRACTION);
  });
});

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
function renderAlgorithm1Reference(sampleCount: number = RENDER_QUANTUM_FRAMES): Float32Array {
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
  const blocks = new Map<OperatorId, Float32Array>(OPERATOR_IDS.map((id) => [id, new Float32Array(sampleCount)]));

  operators.get(6)!.renderWithFeedback(blocks.get(6)!, feedbackIndex);
  operators.get(5)!.render(blocks.get(5)!, scale(blocks.get(6)!, modulationIndex));
  operators.get(4)!.render(blocks.get(4)!, scale(blocks.get(5)!, modulationIndex));
  operators.get(3)!.render(blocks.get(3)!, scale(blocks.get(4)!, modulationIndex));
  operators.get(2)!.render(blocks.get(2)!);
  operators.get(1)!.render(blocks.get(1)!, scale(blocks.get(2)!, modulationIndex));

  const output = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
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
