import { AdditiveOperatorBank } from '../../domain/dx7/dsp/additive-fixture';
import { buildRoutingConfig, GraphRouter } from '../../domain/dx7/dsp/graph-router';
import { PhaseModulatedOperator } from '../../domain/dx7/dsp/operator';
import { DX7_OPERATOR_PROCESSOR_NAME } from '../../domain/dx7/dsp/worklet-messages';
import { ALGORITHMS } from '../../domain/dx7/models/algorithms';
import type { OperatorParameterSet } from '../../domain/dx7/models/patch';

/**
 * Evaluates the esbuild-bundled worklet script (`scripts/build-worklet.mjs`'s
 * output) in Node against stub `AudioWorkletProcessor` / `registerProcessor`
 * / `sampleRate` globals — the automated coverage `07-RESEARCH.md` Pitfall 2
 * assumed was impossible for anything touching `AudioWorkletGlobalScope`.
 * The `pretest` npm lifecycle hook rebuilds the bundle before this spec runs,
 * so it always reads a fresh artifact (RESEARCH.md Pitfall 6).
 *
 * Mechanism that actually worked (recorded per the plan's own
 * "record which mechanism worked" instruction): neither a static `node:fs`
 * import (blocked by `ng test`'s esbuild-based checker without `@types/node`,
 * which this plan does not add) nor a Vite `?raw` static import (this
 * project's `@angular/build:unit-test` Vitest runner uses a bespoke, minimal
 * plugin pipeline — see `node_modules/@angular/build/.../vitest/plugins.js`
 * — that has no raw-asset loader; a `?raw`-suffixed import still executed
 * the file as a real ES module instead of returning its text) produced a
 * usable file-contents string. Instead: stub the three worklet-only globals
 * onto `globalThis` *before* dynamically importing the built bundle by path.
 * Because the bundle is an import-free IIFE that references
 * `AudioWorkletProcessor`/`registerProcessor`/`sampleRate` as bare
 * identifiers, the same fallback filesystem resolution that made the
 * `?raw`-suffixed path execute the real file also makes this dynamic import
 * execute it — but now with our stubs already in scope, so it "evaluates
 * the built bundle in Node against stub globals" exactly as required,
 * without ever needing Node's `fs` module.
 */

const TEST_SAMPLE_RATE = 44100;
const BLOCK_SIZE = 128;
const BUNDLE_MODULE_PATH = '../../../../public/worklets/dx7-worklet-processor.js';

/** Minimal stand-in for the real `AudioWorkletProcessor` base class — just
 * enough surface (`port` with a settable `onmessage` and a no-op
 * `postMessage`) for the bundled `extends AudioWorkletProcessor` to run. */
class StubAudioWorkletProcessor {
  readonly port: { onmessage: ((event: MessageEvent) => void) | null; postMessage: (data: unknown) => void };

  constructor() {
    this.port = { onmessage: null, postMessage: () => undefined };
  }
}

interface CapturedProcessor {
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters?: Record<string, Float32Array>): boolean;
  readonly port: { onmessage: ((event: MessageEvent) => void) | null };
}

type CapturedProcessorConstructor = new (options: unknown) => CapturedProcessor;

interface ProcessorRegistration {
  readonly name: string;
  readonly ctor: CapturedProcessorConstructor;
}

interface EvaluatedBundle {
  readonly registrations: readonly ProcessorRegistration[];
}

/** A minimal stand-in `MessageEvent` — only `data` is read by
 * `Dx7WorkletProcessor`'s `port.onmessage` handler. */
function toMessageEvent(data: unknown): MessageEvent {
  return { data } as unknown as MessageEvent;
}

/** Evaluated once — the bundle is a real ES module import, and a second
 * dynamic import of the same resolved path returns the already-executed,
 * cached module rather than re-running its `registerProcessor` call. */
let evaluatedBundle: EvaluatedBundle | undefined;

const globalRecord = globalThis as unknown as Record<string, unknown>;

async function evaluateBundle(): Promise<EvaluatedBundle> {
  if (evaluatedBundle) {
    return evaluatedBundle;
  }

  const registrations: ProcessorRegistration[] = [];

  // Left installed for the rest of this test file's lifetime, not just
  // during the import call: the real `sampleRate` global is read again by
  // the processor's own constructor every time `new ctor(...)` runs, not
  // only once at module-evaluation time (`afterAll` below tears them down).
  globalRecord['AudioWorkletProcessor'] = StubAudioWorkletProcessor;
  globalRecord['sampleRate'] = TEST_SAMPLE_RATE;
  globalRecord['registerProcessor'] = (processorName: string, processorCtor: CapturedProcessorConstructor): void => {
    registrations.push({ name: processorName, ctor: processorCtor });
  };

  // `BUNDLE_MODULE_PATH` is a variable (not a string literal), so this dynamic import is never
  // module-resolved at typecheck time — the bundle only needs to exist by test run time, per `pretest`.
  await import(/* @vite-ignore */ BUNDLE_MODULE_PATH);

  evaluatedBundle = { registrations };
  return evaluatedBundle;
}

/**
 * Algorithm 8's fixture (T-08-04 parity + routing-replacement cases):
 * `6->5->3` is a two-level chain and `4->3` is a direct second modulator
 * into the same target, so it is not a flat single-level shape; carriers
 * are operators 3 and 1 (more than one); and its feedback operator is 4 —
 * not the highest id (6) — so the case discriminates a bug that only
 * relocates feedback correctly when it happens to land on operator 6.
 */
const ROUTED_ALGORITHM_ID = 8;
/** Algorithm 22's feedback operator is 6, differing from Algorithm 8's 4 —
 * the routing-replacement case switches between these two so a stale
 * feedback-operator id left over from the first algorithm would be
 * detectable. */
const ROUTED_ALGORITHM_SWITCH_ID = 22;
const ROUTED_FEEDBACK_LEVEL = 4;
const ROUTED_NOTE_FREQUENCY_HZ = 220;

/** Every one of the six operators gets a distinct ratio/detune/output/
 * envelope value — a fixture where every operator shared the same
 * parameters could pass a wiring bug that swapped two operators' values. */
function buildDistinctOperatorParameters(): OperatorParameterSet {
  return {
    1: { enabled: true, mode: 'ratio', ratio: 1, fixedFrequencyHz: 440, detune: -3, outputLevel: 40, envelopeLevel: 70 },
    2: { enabled: true, mode: 'ratio', ratio: 2, fixedFrequencyHz: 440, detune: -1, outputLevel: 55, envelopeLevel: 75 },
    3: { enabled: true, mode: 'ratio', ratio: 3, fixedFrequencyHz: 440, detune: 0, outputLevel: 60, envelopeLevel: 80 },
    4: { enabled: true, mode: 'ratio', ratio: 4, fixedFrequencyHz: 440, detune: 2, outputLevel: 65, envelopeLevel: 85 },
    5: { enabled: true, mode: 'ratio', ratio: 5, fixedFrequencyHz: 440, detune: 4, outputLevel: 70, envelopeLevel: 90 },
    6: { enabled: true, mode: 'ratio', ratio: 0.5, fixedFrequencyHz: 440, detune: 6, outputLevel: 75, envelopeLevel: 95 },
  };
}

function expectSingleRegistration(bundle: EvaluatedBundle): ProcessorRegistration {
  expect(bundle.registrations).toHaveLength(1);
  const registration = bundle.registrations[0];
  expect(registration).toBeDefined();
  expect(registration!.name).toBe(DX7_OPERATOR_PROCESSOR_NAME);
  expect(registration!.ctor).toBeDefined();
  return registration!;
}

describe('worklet-processor-bundle', () => {
  afterAll(() => {
    delete globalRecord['AudioWorkletProcessor'];
    delete globalRecord['registerProcessor'];
    delete globalRecord['sampleRate'];
  });

  it('registers exactly one processor under the name "dx7-operator"', async () => {
    const bundle = await evaluateBundle();
    expectSingleRegistration(bundle);
  });

  it('renders a 128-sample block matching a directly-constructed PhaseModulatedOperator at the same frequency', async () => {
    const { ctor } = expectSingleRegistration(await evaluateBundle());

    const processor = new ctor({ processorOptions: { frequencyHz: 440 } });
    const renderedChannel = new Float32Array(BLOCK_SIZE);
    processor.process([], [[renderedChannel]]);

    const reference = new PhaseModulatedOperator(TEST_SAMPLE_RATE, 440);
    const expectedChannel = new Float32Array(BLOCK_SIZE);
    reference.render(expectedChannel);

    expect(renderedChannel).toEqual(expectedChannel);
  });

  it.each([
    { name: 'missing frequencyHz', processorOptions: {} },
    { name: 'NaN frequencyHz', processorOptions: { frequencyHz: Number.NaN } },
    { name: 'Infinity frequencyHz', processorOptions: { frequencyHz: Number.POSITIVE_INFINITY } },
    { name: 'zero frequencyHz', processorOptions: { frequencyHz: 0 } },
    { name: 'negative frequencyHz', processorOptions: { frequencyHz: -440 } },
    { name: 'string frequencyHz', processorOptions: { frequencyHz: '440' } },
  ])('falls back to 440 Hz for hostile processorOptions ($name)', async ({ processorOptions }) => {
    const { ctor } = expectSingleRegistration(await evaluateBundle());

    const processor = new ctor({ processorOptions });
    const renderedChannel = new Float32Array(BLOCK_SIZE);
    processor.process([], [[renderedChannel]]);

    const reference = new PhaseModulatedOperator(TEST_SAMPLE_RATE, 440);
    const expectedChannel = new Float32Array(BLOCK_SIZE);
    reference.render(expectedChannel);

    expect(renderedChannel).toEqual(expectedChannel);
  });

  it('changes rendered output after a valid setMode "additive" + setFrequency message pair', async () => {
    const { ctor } = expectSingleRegistration(await evaluateBundle());

    const processor = new ctor({ processorOptions: { frequencyHz: 440 } });
    const singleModeOutput = new Float32Array(BLOCK_SIZE);
    processor.process([], [[singleModeOutput]]);

    processor.port.onmessage?.(toMessageEvent({ kind: 'setMode', mode: 'additive' }));
    processor.port.onmessage?.(toMessageEvent({ kind: 'setFrequency', frequencyHz: 220 }));

    const additiveModeOutput = new Float32Array(BLOCK_SIZE);
    processor.process([], [[additiveModeOutput]]);

    const referenceBank = new AdditiveOperatorBank(TEST_SAMPLE_RATE, BLOCK_SIZE);
    referenceBank.setBaseFrequencyHz(220);
    const expectedAdditive = new Float32Array(BLOCK_SIZE);
    referenceBank.render(expectedAdditive);

    expect(additiveModeOutput).not.toEqual(singleModeOutput);
    expect(additiveModeOutput).toEqual(expectedAdditive);
  });

  it('leaves rendered output unchanged and throws nothing for a malformed message', async () => {
    const { ctor } = expectSingleRegistration(await evaluateBundle());

    const untouched = new ctor({ processorOptions: { frequencyHz: 440 } });
    const sentMalformed = new ctor({ processorOptions: { frequencyHz: 440 } });

    expect(() =>
      sentMalformed.port.onmessage?.(toMessageEvent({ kind: 'setFrequency', frequencyHz: -1 })),
    ).not.toThrow();

    const untouchedOutput = new Float32Array(BLOCK_SIZE);
    const malformedOutput = new Float32Array(BLOCK_SIZE);
    untouched.process([], [[untouchedOutput]]);
    sentMalformed.process([], [[malformedOutput]]);

    expect(malformedOutput).toEqual(untouchedOutput);
  });

  it('renders the routed path element-for-element identical to a directly-constructed GraphRouter, across two rendered blocks (T-08-04)', async () => {
    const { ctor } = expectSingleRegistration(await evaluateBundle());
    const algorithm = ALGORITHMS.find((entry) => entry.id === ROUTED_ALGORITHM_ID)!;
    const routingConfig = buildRoutingConfig(algorithm);
    const operators = buildDistinctOperatorParameters();

    const processor = new ctor({ processorOptions: { frequencyHz: 440 } });
    processor.port.onmessage?.(toMessageEvent({ kind: 'setMode', mode: 'routed' }));
    processor.port.onmessage?.(
      toMessageEvent({ kind: 'setAlgorithm', connections: routingConfig.connections, carriers: routingConfig.carriers }),
    );
    processor.port.onmessage?.(toMessageEvent({ kind: 'setOperatorParameters', operators }));
    processor.port.onmessage?.(toMessageEvent({ kind: 'setFeedback', level: ROUTED_FEEDBACK_LEVEL }));
    processor.port.onmessage?.(toMessageEvent({ kind: 'setFrequency', frequencyHz: ROUTED_NOTE_FREQUENCY_HZ }));

    const bundleBlock1 = new Float32Array(BLOCK_SIZE);
    const bundleBlock2 = new Float32Array(BLOCK_SIZE);
    processor.process([], [[bundleBlock1]]);
    processor.process([], [[bundleBlock2]]);

    const reference = new GraphRouter(TEST_SAMPLE_RATE, BLOCK_SIZE);
    reference.setRouting(routingConfig);
    reference.setOperatorParameters(operators);
    reference.setFeedbackLevel(ROUTED_FEEDBACK_LEVEL);
    reference.setNoteFrequencyHz(ROUTED_NOTE_FREQUENCY_HZ);

    const referenceBlock1 = new Float32Array(BLOCK_SIZE);
    const referenceBlock2 = new Float32Array(BLOCK_SIZE);
    reference.render(referenceBlock1);
    reference.render(referenceBlock2);

    expect(bundleBlock1).toEqual(referenceBlock1);
    expect(bundleBlock2).toEqual(referenceBlock2);
  });

  it("replaces the processor's cached routing state atomically when a second algorithm with a different feedback operator id is applied (T-08-04)", async () => {
    const { ctor } = expectSingleRegistration(await evaluateBundle());
    const algorithm1 = ALGORITHMS.find((entry) => entry.id === ROUTED_ALGORITHM_ID)!;
    const algorithm2 = ALGORITHMS.find((entry) => entry.id === ROUTED_ALGORITHM_SWITCH_ID)!;
    const routingConfig1 = buildRoutingConfig(algorithm1);
    const routingConfig2 = buildRoutingConfig(algorithm2);
    const operators = buildDistinctOperatorParameters();

    const processor = new ctor({ processorOptions: { frequencyHz: 440 } });
    processor.port.onmessage?.(toMessageEvent({ kind: 'setMode', mode: 'routed' }));
    processor.port.onmessage?.(
      toMessageEvent({ kind: 'setAlgorithm', connections: routingConfig1.connections, carriers: routingConfig1.carriers }),
    );
    processor.port.onmessage?.(toMessageEvent({ kind: 'setOperatorParameters', operators }));
    processor.port.onmessage?.(toMessageEvent({ kind: 'setFeedback', level: ROUTED_FEEDBACK_LEVEL }));
    processor.port.onmessage?.(toMessageEvent({ kind: 'setFrequency', frequencyHz: ROUTED_NOTE_FREQUENCY_HZ }));
    // Render once under algorithm 1 first, to build up real phase and
    // feedback-history state that the switch below must not leak from.
    processor.process([], [[new Float32Array(BLOCK_SIZE)]]);

    processor.port.onmessage?.(
      toMessageEvent({ kind: 'setAlgorithm', connections: routingConfig2.connections, carriers: routingConfig2.carriers }),
    );
    const bundleBlockAfterSwitch = new Float32Array(BLOCK_SIZE);
    processor.process([], [[bundleBlockAfterSwitch]]);

    const freshReference = new GraphRouter(TEST_SAMPLE_RATE, BLOCK_SIZE);
    freshReference.setRouting(routingConfig2);
    freshReference.setOperatorParameters(operators);
    freshReference.setFeedbackLevel(ROUTED_FEEDBACK_LEVEL);
    freshReference.setNoteFrequencyHz(ROUTED_NOTE_FREQUENCY_HZ);
    const freshReferenceBlock = new Float32Array(BLOCK_SIZE);
    freshReference.render(freshReferenceBlock);

    expect(bundleBlockAfterSwitch).toEqual(freshReferenceBlock);
  });

  it('leaves the routed output unchanged and throws nothing for a malformed routing-config message', async () => {
    const { ctor } = expectSingleRegistration(await evaluateBundle());
    const algorithm = ALGORITHMS.find((entry) => entry.id === ROUTED_ALGORITHM_ID)!;
    const routingConfig = buildRoutingConfig(algorithm);
    const operators = buildDistinctOperatorParameters();

    function setUpRoutedProcessor(): CapturedProcessor {
      const processor = new ctor({ processorOptions: { frequencyHz: 440 } });
      processor.port.onmessage?.(toMessageEvent({ kind: 'setMode', mode: 'routed' }));
      processor.port.onmessage?.(
        toMessageEvent({
          kind: 'setAlgorithm',
          connections: routingConfig.connections,
          carriers: routingConfig.carriers,
        }),
      );
      processor.port.onmessage?.(toMessageEvent({ kind: 'setOperatorParameters', operators }));
      processor.port.onmessage?.(toMessageEvent({ kind: 'setFeedback', level: ROUTED_FEEDBACK_LEVEL }));
      processor.port.onmessage?.(toMessageEvent({ kind: 'setFrequency', frequencyHz: ROUTED_NOTE_FREQUENCY_HZ }));
      return processor;
    }

    const untouched = setUpRoutedProcessor();
    const sentMalformed = setUpRoutedProcessor();

    const untouchedFirst = new Float32Array(BLOCK_SIZE);
    const malformedFirst = new Float32Array(BLOCK_SIZE);
    untouched.process([], [[untouchedFirst]]);
    sentMalformed.process([], [[malformedFirst]]);
    expect(malformedFirst).toEqual(untouchedFirst);

    expect(() =>
      sentMalformed.port.onmessage?.(
        toMessageEvent({ kind: 'setAlgorithm', connections: routingConfig.connections, carriers: [] }),
      ),
    ).not.toThrow();

    const untouchedSecond = new Float32Array(BLOCK_SIZE);
    const malformedSecond = new Float32Array(BLOCK_SIZE);
    untouched.process([], [[untouchedSecond]]);
    sentMalformed.process([], [[malformedSecond]]);

    expect(malformedSecond).toEqual(untouchedSecond);
  });

  it('fills silence and throws nothing for an unexpected render-quantum size in routed mode', async () => {
    const { ctor } = expectSingleRegistration(await evaluateBundle());
    const algorithm = ALGORITHMS.find((entry) => entry.id === ROUTED_ALGORITHM_ID)!;
    const routingConfig = buildRoutingConfig(algorithm);

    const processor = new ctor({ processorOptions: { frequencyHz: 440 } });
    processor.port.onmessage?.(toMessageEvent({ kind: 'setMode', mode: 'routed' }));
    processor.port.onmessage?.(
      toMessageEvent({ kind: 'setAlgorithm', connections: routingConfig.connections, carriers: routingConfig.carriers }),
    );

    const unexpectedQuantum = new Float32Array(BLOCK_SIZE * 2);
    expect(() => processor.process([], [[unexpectedQuantum]])).not.toThrow();
    expect(unexpectedQuantum).toEqual(new Float32Array(BLOCK_SIZE * 2));
  });
});
