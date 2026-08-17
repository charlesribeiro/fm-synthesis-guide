/**
 * D-10 and D-11 proof (Phase 8 plan 08-02; ENGINE-02): every one of the 32
 * `ALGORITHMS` rows is cross-checked, sample for sample, against the
 * independently-derived `evaluateAlgorithmReference` (`reference-evaluator.ts`,
 * which imports nothing from `graph-router.ts`), and every row is proven to
 * stay finite and inside the hard output bound at maximum feedback with
 * every operator at maximum output level.
 */
import {
  MASTER_GAIN,
  MAX_VELOCITY,
  envelopeRateToLevelUnitsPerSample,
  feedbackLevelToDepthHz,
  operatorFrequencyHz,
  outputLevelToAmplitude,
  outputLevelToModulationDepthHz,
} from '../audio/value-conversion';
import { ALGORITHMS } from '../models/algorithms';
import {
  MAX_ENVELOPE_LEVEL,
  MAX_ENVELOPE_RATE,
  MAX_OUTPUT_LEVEL,
  MIN_ENVELOPE_LEVEL,
  type Dx7Envelope,
  type OperatorParameters,
} from '../models/operator-parameters';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import { MAX_FEEDBACK_LEVEL, type OperatorParameterSet } from '../models/patch';
import { PhaseModulatedOperator, RENDER_QUANTUM_FRAMES } from './operator';
import { GraphRouter, buildRoutingConfig, type RoutingConfig } from './graph-router';
import { evaluateAlgorithmReference, type ReferenceEvaluationInput } from './reference-evaluator';

const SAMPLE_RATE = 44100;
const BLOCK_SIZE = RENDER_QUANTUM_FRAMES;
const NOTE_FREQUENCY_HZ = 440;

/**
 * Phase 9: the render path now requires the router to be gated, and every
 * operator's envelope needs to have reached its maximum-amplitude plateau,
 * before its output is arithmetically identical to Phase 8's un-enveloped
 * expected values. This fixture envelope's first three levels are the level
 * maximum and its rates are the rate maximum — at the maximum level the
 * envelope's amplitude factor is exactly one
 * (`outputLevelToAmplitude(MAX_ENVELOPE_LEVEL) === 1`), so once every
 * operator's envelope has reached that plateau the router's output is
 * unchanged from Phase 8's. The release segment (index 3) is never reached
 * in this suite — no case gates off — so its values are irrelevant and set
 * to the same maximum for consistency.
 */
const GATED_MAX_ENVELOPE: Dx7Envelope = Object.freeze({
  rates: Object.freeze([MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE] as const),
  levels: Object.freeze([MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL] as const),
});

/**
 * The number of full render blocks needed for {@link GATED_MAX_ENVELOPE}'s
 * fastest-possible segment to reach its target level, computed from the
 * exported rate curve rather than hardcoded: the full level range divided
 * by the rate-maximum per-sample step, divided by the block size, rounded
 * up. Every cross-check case below renders this many warm-up blocks (which
 * it then discards) before rendering the block under comparison.
 */
const WARM_UP_BLOCK_COUNT = Math.ceil(
  Math.ceil((MAX_ENVELOPE_LEVEL - MIN_ENVELOPE_LEVEL) / envelopeRateToLevelUnitsPerSample(MAX_ENVELOPE_RATE, SAMPLE_RATE)) /
    BLOCK_SIZE,
);

/**
 * Gates `router` open at maximum velocity with every operator's envelope
 * set to {@link GATED_MAX_ENVELOPE}, then renders and discards
 * {@link WARM_UP_BLOCK_COUNT} blocks so every envelope has reached its
 * maximum-amplitude plateau before the caller renders the block under
 * comparison. At the maximum velocity the velocity factor is exactly one
 * (`velocityToAmplitude(MAX_VELOCITY) === 1`), so combined with the
 * maximum-level envelope plateau, the router's post-warm-up output is
 * arithmetically identical to Phase 8's.
 */
function gateAndWarmUp(router: GraphRouter, operators: OperatorParameterSet): void {
  const gatedOperators = buildOperatorParameterSet(
    (id) => ({ ...operators[id], envelope: GATED_MAX_ENVELOPE }) as OperatorParameters,
  );
  router.setOperatorParameters(gatedOperators);
  router.setGate(true, MAX_VELOCITY);

  const scratch = new Float32Array(BLOCK_SIZE);
  for (let block = 0; block < WARM_UP_BLOCK_COUNT; block++) {
    router.render(scratch);
  }
}

/**
 * D-10's tolerance: how many decimal places `toBeCloseTo` requires between
 * the router's output and the reference's output. Matches the Phase 7
 * analytical-match precedent (float32 storage precision, ~7 decimal
 * digits). Never loosened silently — see the comment above the
 * `describe.each` block below for the measured worst-case deviation this
 * value was validated against.
 */
const CROSS_CHECK_DECIMAL_PLACES = 6;

/**
 * Builds a full six-operator `OperatorParameterSet` from a per-operator-id
 * factory — every operator's parameters are independently computed, never
 * copied from one shared object, so a fixture that must give every operator
 * a distinct value (the cross-check fixture below) can do so directly.
 */
function buildOperatorParameterSet(factory: (id: OperatorId) => OperatorParameters): OperatorParameterSet {
  const entries = OPERATOR_IDS.map((id) => [id, factory(id)] as const);
  return Object.freeze(Object.fromEntries(entries)) as OperatorParameterSet;
}

/**
 * The cross-check fixture (D-10): every operator gets a distinct coarse
 * ratio (`id` itself — a member of `COARSE_RATIOS`, 1 through 6), a distinct
 * `outputLevel` spread across the DX7 0..99 range, and a distinct `detune`
 * inside the -7..7 bounds. Making every operator individually
 * distinguishable is load-bearing: a fixture that reused one uniform default
 * parameter set for every operator could let a routing bug that swaps or
 * drops an operator cancel out and pass undetected, since two
 * identically-tuned operators are interchangeable in the summed output.
 */
const CROSS_CHECK_OPERATORS: OperatorParameterSet = buildOperatorParameterSet((id) => ({
  enabled: true,
  mode: 'ratio',
  ratio: id,
  fixedFrequencyHz: 440,
  detune: id - 4, // -3, -2, -1, 0, 1, 2 — distinct, all inside -7..7
  outputLevel: 10 + (id - 1) * 17, // 10, 27, 44, 61, 78, 95 — distinct, spread across 0..99
  // Overridden by gateAndWarmUp before every render — present here only to
  // satisfy OperatorParameters' shape.
  envelope: GATED_MAX_ENVELOPE,
}));

/**
 * The bounded-output sweep's worst-case operator set (D-11): the same
 * distinct ratio/detune identity as {@link CROSS_CHECK_OPERATORS}, but every
 * operator pinned to {@link MAX_OUTPUT_LEVEL} — the loudest every carrier and
 * every modulator can simultaneously be.
 */
const MAX_LEVEL_OPERATORS: OperatorParameterSet = buildOperatorParameterSet((id) => ({
  enabled: true,
  mode: 'ratio',
  ratio: id,
  fixedFrequencyHz: 440,
  detune: id - 4,
  outputLevel: MAX_OUTPUT_LEVEL,
  // Overridden by gateAndWarmUp before every render — present here only to
  // satisfy OperatorParameters' shape.
  envelope: GATED_MAX_ENVELOPE,
}));

/**
 * Builds both implementations' inputs from the identical
 * {@link CROSS_CHECK_OPERATORS} parameter set, deriving every *scalar* input
 * (frequencies, modulation indices, carrier amplitudes, feedback index, gain)
 * through the same already-proven `value-conversion.ts` functions
 * `GraphRouter` itself uses (D-15/D-16 mandate reusing them — they are
 * Phase 5 code, already tested in isolation). What stays independent is the
 * *graph traversal and per-sample evaluation*, which is exactly what
 * `evaluateAlgorithmReference` performs without ever calling into
 * `GraphRouter`, `derive-role.ts`, or `patch-plan.ts`.
 */
function buildCrossCheckFixture(
  algorithm: Parameters<typeof buildRoutingConfig>[0],
  feedbackLevel: number,
  noteFrequencyHz: number,
): { router: GraphRouter; referenceInput: ReferenceEvaluationInput } {
  const routingConfig = buildRoutingConfig(algorithm);

  const router = new GraphRouter(SAMPLE_RATE, BLOCK_SIZE);
  router.setRouting(routingConfig);
  router.setOperatorParameters(CROSS_CHECK_OPERATORS);
  router.setFeedbackLevel(feedbackLevel);
  router.setNoteFrequencyHz(noteFrequencyHz);
  // Gates the router and warms every envelope up to its maximum-amplitude
  // plateau (Phase 9) — from here on the router's output is arithmetically
  // identical to Phase 8's un-enveloped expected values.
  gateAndWarmUp(router, CROSS_CHECK_OPERATORS);

  const frequenciesHz = {} as Record<OperatorId, number>;
  const modulationIndices = {} as Record<OperatorId, number>;
  const carrierAmplitudes = {} as Record<OperatorId, number>;
  for (const id of OPERATOR_IDS) {
    const parameters = CROSS_CHECK_OPERATORS[id];
    const frequencyHz = operatorFrequencyHz(parameters, noteFrequencyHz);
    frequenciesHz[id] = frequencyHz;
    modulationIndices[id] = outputLevelToModulationDepthHz(parameters.outputLevel, frequencyHz) / frequencyHz;
    carrierAmplitudes[id] = outputLevelToAmplitude(parameters.outputLevel);
  }

  // The dataset's own self-loop (`from === to`) names the feedback operator
  // independently of `buildRoutingConfig` / `isFeedback`, so a translation
  // bug in that flag cannot silently agree with the reference fixture.
  const feedbackEdge = algorithm.edges.find((edge) => edge.from === edge.to);
  const feedbackOperatorId = feedbackEdge !== undefined ? feedbackEdge.from : null;
  const feedbackIndex = feedbackOperatorId
    ? feedbackLevelToDepthHz(feedbackLevel, frequenciesHz[feedbackOperatorId]) / frequenciesHz[feedbackOperatorId]
    : 0;

  // The reference is evaluated over the warm-up span plus one block —
  // `reference-evaluator.ts` computes phase closed-form from the absolute
  // sample index and never sees an envelope, so this span's tail (the last
  // BLOCK_SIZE samples) is the reference's exact expectation for the
  // router's post-warm-up block, without ever touching
  // `reference-evaluator.ts` itself.
  const referenceInput: ReferenceEvaluationInput = {
    sampleRate: SAMPLE_RATE,
    blockSize: (WARM_UP_BLOCK_COUNT + 1) * BLOCK_SIZE,
    operatorFrequenciesHz: frequenciesHz,
    modulationIndices,
    carrierAmplitudes,
    feedbackIndex,
    outputGain: MASTER_GAIN,
  };

  return { router, referenceInput };
}

// Cross-check tolerance validated at CROSS_CHECK_DECIMAL_PLACES = 6 across
// all 32 rows including Algorithm 1's deepest modulation chain (6->5->4->3,
// four levels deep) — every row passed at this precision, well inside the
// 1e-3 threshold below which a deviation is single-precision (Float32Array)
// storage noise rather than a routing bug. No row required loosening the
// tolerance.
describe.each(ALGORITHMS)('Algorithm $id ($name)', (algorithm) => {
  it('matches the independent reference evaluator sample-for-sample within the declared tolerance', () => {
    const { router, referenceInput } = buildCrossCheckFixture(algorithm, 0, NOTE_FREQUENCY_HZ);
    const actual = new Float32Array(BLOCK_SIZE);
    router.render(actual);

    const expected = evaluateAlgorithmReference(algorithm, referenceInput);
    const expectedTail = expected.slice(expected.length - BLOCK_SIZE);

    for (let i = 0; i < BLOCK_SIZE; i++) {
      expect(actual[i]).toBeCloseTo(expectedTail[i]!, CROSS_CHECK_DECIMAL_PLACES);
    }
  });

  // D-11: this sweep runs for every row, not only ones that declare a
  // feedback self-loop — verified dataset fact: all 32 ALGORITHMS rows
  // already declare one, so "not only the rows with declared feedback" is a
  // design principle this sweep keeps rather than a distinction the current
  // dataset exhibits. Renders more than one block so the one-sample-delay
  // feedback recurrence has actually accumulated non-zero history before
  // the assertion, not just its first zero-history sample.
  it('stays finite and inside the hard bound at feedback level 7 with every operator at maximum output level, across multiple rendered blocks', () => {
    const router = new GraphRouter(SAMPLE_RATE, BLOCK_SIZE);
    router.setRouting(buildRoutingConfig(algorithm));
    router.setOperatorParameters(MAX_LEVEL_OPERATORS);
    router.setFeedbackLevel(MAX_FEEDBACK_LEVEL);
    router.setNoteFrequencyHz(NOTE_FREQUENCY_HZ);
    gateAndWarmUp(router, MAX_LEVEL_OPERATORS);

    const blockCount = 4;
    for (let block = 0; block < blockCount; block++) {
      const output = new Float32Array(BLOCK_SIZE);
      router.render(output);
      for (const sample of output) {
        expect(Number.isFinite(sample)).toBe(true);
        expect(sample).toBeGreaterThanOrEqual(-1);
        expect(sample).toBeLessThanOrEqual(1);
      }
    }
  });
});

/**
 * Degenerate router-API configs the validated 32-row dataset can never
 * itself produce (`validateAlgorithm` already rejects a zero-carrier or
 * direction-invalid graph, DOMAIN-02) but the message boundary theoretically
 * could reach below validation — a defensive backstop at the router's own
 * `setRouting` API, T-08-06.
 */
describe('GraphRouter degenerate routing configs (T-08-06)', () => {
  it('an empty carrier list renders an all-zero block rather than non-finite samples', () => {
    const routingConfig: RoutingConfig = Object.freeze({
      connections: Object.freeze([{ from: 2 as OperatorId, to: 1 as OperatorId, isFeedback: false }]),
      carriers: Object.freeze([]),
    });

    const router = new GraphRouter(SAMPLE_RATE, BLOCK_SIZE);
    router.setRouting(routingConfig);
    router.setOperatorParameters(CROSS_CHECK_OPERATORS);
    router.setFeedbackLevel(0);
    router.setNoteFrequencyHz(NOTE_FREQUENCY_HZ);
    // Gated (and warmed to the envelope's maximum-amplitude plateau) so
    // this all-zero result is proven to come from the empty carrier list,
    // not merely from an ungated router already rendering silence.
    gateAndWarmUp(router, CROSS_CHECK_OPERATORS);

    const output = new Float32Array(BLOCK_SIZE);
    router.render(output);

    for (const sample of output) {
      expect(sample).toBe(0);
    }
  });

  it('a connection list containing only the feedback self-loop leaves every other operator unmodulated', () => {
    const feedbackLevel = 3;
    const routingConfig: RoutingConfig = Object.freeze({
      connections: Object.freeze([{ from: 1 as OperatorId, to: 1 as OperatorId, isFeedback: true }]),
      carriers: Object.freeze([...OPERATOR_IDS]),
    });

    const router = new GraphRouter(SAMPLE_RATE, BLOCK_SIZE);
    router.setRouting(routingConfig);
    router.setOperatorParameters(CROSS_CHECK_OPERATORS);
    router.setFeedbackLevel(feedbackLevel);
    router.setNoteFrequencyHz(NOTE_FREQUENCY_HZ);
    gateAndWarmUp(router, CROSS_CHECK_OPERATORS);

    const actual = new Float32Array(BLOCK_SIZE);
    router.render(actual);

    // Independent expectation built directly from standalone
    // PhaseModulatedOperator instances: operator 1 gets its own feedback
    // term and nothing else; operators 2-6 get no modulation input at all
    // (an unmodulated plain sine each) — proving the router never leaks
    // modulation into an operator absent from `connections`. Evaluated over
    // the warm-up span plus one block, then only the tail compared, for the
    // same reason the cross-check above does.
    const expected = buildUnmodulatedExceptFeedbackReference(feedbackLevel, (WARM_UP_BLOCK_COUNT + 1) * BLOCK_SIZE);
    const expectedTail = expected.slice(expected.length - BLOCK_SIZE);

    for (let i = 0; i < BLOCK_SIZE; i++) {
      expect(actual[i]).toBeCloseTo(expectedTail[i]!, CROSS_CHECK_DECIMAL_PLACES);
    }
  });
});

function buildUnmodulatedExceptFeedbackReference(feedbackLevel: number, sampleCount: number = BLOCK_SIZE): Float32Array {
  const output = new Float32Array(sampleCount);
  for (const id of OPERATOR_IDS) {
    const parameters = CROSS_CHECK_OPERATORS[id];
    const frequencyHz = operatorFrequencyHz(parameters, NOTE_FREQUENCY_HZ);
    const amplitude = outputLevelToAmplitude(parameters.outputLevel);
    const block = new Float32Array(sampleCount);
    const operator = new PhaseModulatedOperator(SAMPLE_RATE, frequencyHz);

    if (id === 1) {
      const feedbackIndex = feedbackLevelToDepthHz(feedbackLevel, frequencyHz) / frequencyHz;
      operator.renderWithFeedback(block, feedbackIndex);
    } else {
      operator.render(block);
    }

    for (let i = 0; i < sampleCount; i++) {
      output[i]! += block[i]! * amplitude;
    }
  }

  for (let i = 0; i < sampleCount; i++) {
    output[i] = Math.min(1, Math.max(-1, output[i]! * MASTER_GAIN));
  }
  return output;
}
