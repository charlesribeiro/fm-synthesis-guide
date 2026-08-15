/**
 * D-10 and D-11 proof (Phase 8 plan 08-02; ENGINE-02): every one of the 32
 * `ALGORITHMS` rows is cross-checked, sample for sample, against the
 * independently-derived `evaluateAlgorithmReference` (`reference-evaluator.ts`,
 * which imports nothing from `graph-router.ts`), and every row is proven to
 * stay finite and inside the hard output bound at maximum feedback with
 * every operator at maximum output level.
 */
import { MASTER_GAIN, feedbackLevelToDepthHz, operatorFrequencyHz, outputLevelToAmplitude, outputLevelToModulationDepthHz } from '../audio/value-conversion';
import { ALGORITHMS } from '../models/algorithms';
import { MAX_OUTPUT_LEVEL, type OperatorParameters } from '../models/operator-parameters';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import { MAX_FEEDBACK_LEVEL, type OperatorParameterSet } from '../models/patch';
import { PhaseModulatedOperator, RENDER_QUANTUM_FRAMES } from './operator';
import { GraphRouter, buildRoutingConfig, type RoutingConfig } from './graph-router';
import { evaluateAlgorithmReference, type ReferenceEvaluationInput } from './reference-evaluator';

const SAMPLE_RATE = 44100;
const BLOCK_SIZE = RENDER_QUANTUM_FRAMES;
const NOTE_FREQUENCY_HZ = 440;

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
  envelopeLevel: 99,
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
  envelopeLevel: 99,
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

  // The routing config's own `isFeedback` flag names the feedback operator
  // (never re-derived here) — consistent with `GraphRouter.setRouting`'s
  // own `findFeedbackOperatorId` reading the same field.
  const feedbackConnection = routingConfig.connections.find((connection) => connection.isFeedback);
  const feedbackOperatorId = feedbackConnection ? feedbackConnection.from : null;
  const feedbackIndex = feedbackOperatorId
    ? feedbackLevelToDepthHz(feedbackLevel, frequenciesHz[feedbackOperatorId]) / frequenciesHz[feedbackOperatorId]
    : 0;

  const referenceInput: ReferenceEvaluationInput = {
    sampleRate: SAMPLE_RATE,
    blockSize: BLOCK_SIZE,
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

    for (let i = 0; i < BLOCK_SIZE; i++) {
      expect(actual[i]).toBeCloseTo(expected[i]!, CROSS_CHECK_DECIMAL_PLACES);
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

    const actual = new Float32Array(BLOCK_SIZE);
    router.render(actual);

    // Independent expectation built directly from standalone
    // PhaseModulatedOperator instances: operator 1 gets its own feedback
    // term and nothing else; operators 2-6 get no modulation input at all
    // (an unmodulated plain sine each) — proving the router never leaks
    // modulation into an operator absent from `connections`.
    const expected = buildUnmodulatedExceptFeedbackReference(feedbackLevel);

    for (let i = 0; i < BLOCK_SIZE; i++) {
      expect(actual[i]).toBeCloseTo(expected[i]!, CROSS_CHECK_DECIMAL_PLACES);
    }
  });
});

function buildUnmodulatedExceptFeedbackReference(feedbackLevel: number): Float32Array {
  const output = new Float32Array(BLOCK_SIZE);
  for (const id of OPERATOR_IDS) {
    const parameters = CROSS_CHECK_OPERATORS[id];
    const frequencyHz = operatorFrequencyHz(parameters, NOTE_FREQUENCY_HZ);
    const amplitude = outputLevelToAmplitude(parameters.outputLevel);
    const block = new Float32Array(BLOCK_SIZE);
    const operator = new PhaseModulatedOperator(SAMPLE_RATE, frequencyHz);

    if (id === 1) {
      const feedbackIndex = feedbackLevelToDepthHz(feedbackLevel, frequencyHz) / frequencyHz;
      operator.renderWithFeedback(block, feedbackIndex);
    } else {
      operator.render(block);
    }

    for (let i = 0; i < BLOCK_SIZE; i++) {
      output[i]! += block[i]! * amplitude;
    }
  }

  for (let i = 0; i < BLOCK_SIZE; i++) {
    output[i] = Math.min(1, Math.max(-1, output[i]! * MASTER_GAIN));
  }
  return output;
}
