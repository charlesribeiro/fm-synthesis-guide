/**
 * The project's first and only `AudioWorkletProcessor` adapter (Phase 7,
 * D-02/D-06 from `07-CONTEXT.md`). Imports the pure kernel and the
 * shared message contract by relative path across the `src/` boundary and
 * holds zero DSP math of its own — every audible sample rendered here is
 * already covered by `operator.spec.ts`/`additive-fixture.spec.ts`'s
 * Vitest suites.
 *
 * This file must NEVER be imported from anywhere under `src/app/`
 * (RESEARCH.md Pitfall 1) — the only thing that reads it is
 * `scripts/build-worklet.mjs`, which bundles it into a standalone,
 * import-free IIFE script for `audioWorklet.addModule()`. It lives outside
 * `tsconfig.app.json`'s `include` glob and is typechecked independently by
 * `tsconfig.worklet.json` against `@types/audioworklet`.
 */
import { AdditiveOperatorBank } from '../src/app/domain/dx7/dsp/additive-fixture';
import { PhaseModulatedOperator } from '../src/app/domain/dx7/dsp/operator';
import {
  DX7_OPERATOR_PROCESSOR_NAME,
  isValidFrequencyHz,
  parseWorkletMessage,
  type WorkletRenderMode,
} from '../src/app/domain/dx7/dsp/worklet-messages';

const DEFAULT_FREQUENCY_HZ = 440;
/** Fixed render quantum used for the additive bank — allocated once before
 * rendering starts so `process()` never constructs an `AdditiveOperatorBank`. */
const RENDER_QUANTUM = 128;

class Dx7WorkletProcessor extends AudioWorkletProcessor {
  private readonly operator: PhaseModulatedOperator;
  private readonly bank: AdditiveOperatorBank;
  private readonly bankBlockSize = RENDER_QUANTUM;
  private frequencyHz: number;
  private mode: WorkletRenderMode = 'single';

  constructor(options: AudioWorkletNodeOptions) {
    super();
    const processorOptions = options.processorOptions as { frequencyHz?: number } | undefined;
    const rawFrequency = processorOptions?.frequencyHz;
    this.frequencyHz = isValidFrequencyHz(rawFrequency) ? rawFrequency : DEFAULT_FREQUENCY_HZ;
    // `sampleRate` here resolves to the AudioWorkletGlobalScope global
    // (declared by @types/audioworklet), never the pure kernel's own
    // constructor parameter of the same name.
    this.operator = new PhaseModulatedOperator(sampleRate, this.frequencyHz);
    this.bank = new AdditiveOperatorBank(sampleRate, this.bankBlockSize);
    this.bank.setBaseFrequencyHz(this.frequencyHz);
    this.port.onmessage = (event: MessageEvent): void => this.handleMessage(event.data);
  }

  /**
   * Validates every inbound payload via `parseWorkletMessage` before
   * mutating any kernel field (T-07-01's single choke point) — an invalid
   * message is a silent no-op, never a throw.
   */
  private handleMessage(data: unknown): void {
    const message = parseWorkletMessage(data);
    if (message === null) {
      return;
    }

    if (message.kind === 'setFrequency') {
      this.frequencyHz = message.frequencyHz;
      this.operator.setFrequencyHz(message.frequencyHz);
      this.bank.setBaseFrequencyHz(message.frequencyHz);
      return;
    }

    this.mode = message.mode;
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0];
    const channel = output[0];

    if (this.mode === 'additive') {
      if (channel.length !== this.bankBlockSize) {
        // Variable quantum is unsupported without allocating in the render
        // loop — keep the node alive with silence rather than constructing a
        // new bank here.
        channel.fill(0);
      } else {
        this.bank.render(channel);
      }
    } else {
      this.operator.render(channel);
    }

    for (let channelIndex = 1; channelIndex < output.length; channelIndex++) {
      output[channelIndex].set(channel);
    }
    return true; // Chrome compatibility: keep the node alive regardless of spec default.
  }
}

registerProcessor(DX7_OPERATOR_PROCESSOR_NAME, Dx7WorkletProcessor);
