import { AdditiveOperatorBank } from '../../domain/dx7/dsp/additive-fixture';
import { PhaseModulatedOperator } from '../../domain/dx7/dsp/operator';
import { DX7_OPERATOR_PROCESSOR_NAME } from '../../domain/dx7/dsp/worklet-messages';

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
});
