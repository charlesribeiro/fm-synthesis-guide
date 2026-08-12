/**
 * Pure phase-modulation operator kernel (Phase 7, D-03/D-05 from
 * `07-CONTEXT.md`; ENGINE-01). Zero Angular imports, enforced by the
 * domain-purity ESLint gate (DOMAIN-04) — every formula here is
 * independently unit-testable in Node with no browser, no `AudioContext`,
 * and no jsdom Web Audio surface. This is the one primitive every operator
 * instance — the single-operator case, the additive fixture (Task 3), and
 * Phase 8's routed graph — is built from.
 *
 * This is an original phase-modulation implementation built toward
 * DX7-style behaviour, written from first principles (a wrapped phase
 * accumulator driving `Math.sin`) — never a transcription of, or derived
 * from, any DX7/Dexed source. It must never be described as an exact DX7
 * emulation.
 */

/** 2π, hoisted once so the render loop never recomputes it. */
export const TWO_PI = 2 * Math.PI;

/**
 * The Web Audio render-quantum size — every `process()` call renders
 * exactly this many samples. Mirrors `web-audio-synth-engine.ts`'s
 * `FEEDBACK_DELAY_RENDER_QUANTUM_FRAMES` (same value, same rationale).
 */
export const RENDER_QUANTUM_FRAMES = 128;

function validateSampleRate(sampleRate: number): void {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`sampleRate must be a finite, positive number, received ${sampleRate}`);
  }
}

function validateFrequencyHz(frequencyHz: number): void {
  if (!Number.isFinite(frequencyHz) || frequencyHz < 0) {
    throw new RangeError(`frequencyHz must be a finite, non-negative number, received ${frequencyHz}`);
  }
}

/**
 * A single phase-modulation operator: a phase accumulator driving
 * `Math.sin`, with an optional per-sample phase-modulation input (D-03) —
 * the first-class port Phase 8's routed graph builds on. Reads no global;
 * `sampleRate` is an explicit constructor parameter (never the worklet
 * global of the same name), which is what makes this class runnable under
 * Vitest with zero browser globals (D-05).
 */
export class PhaseModulatedOperator {
  private sampleRate: number;
  private frequencyHz: number;

  /** In `[0, 1)` — wrapped every sample so it never grows unbounded on a
   * long-held note (Pitfall 4: unbounded growth eventually loses
   * floating-point precision in `Math.sin`'s argument, making the
   * analytical match drift instead of staying flat). */
  private phase = 0;

  constructor(sampleRate: number, frequencyHz: number) {
    validateSampleRate(sampleRate);
    validateFrequencyHz(frequencyHz);
    this.sampleRate = sampleRate;
    this.frequencyHz = frequencyHz;
  }

  /** Retunes the operator; takes effect starting with the next `render` call. */
  setFrequencyHz(frequencyHz: number): void {
    validateFrequencyHz(frequencyHz);
    this.frequencyHz = frequencyHz;
  }

  /** Returns the phase accumulator to 0 so a subsequent `render` call
   * reproduces the operator's very first rendered block exactly. */
  resetPhase(): void {
    this.phase = 0;
  }

  /**
   * Writes exactly `output.length` samples in place — never allocates
   * (CLAUDE.md's audio rule: "DSP code must not allocate excessively
   * inside the audio render loop"; Pitfall 5). `modulationInput`, when
   * supplied, is added to the phase argument sample-for-sample (D-03) —
   * omitting it is equivalent to passing an all-zero buffer. A non-finite
   * modulation sample is treated as 0 rather than propagating `NaN`/
   * `Infinity` into the kernel (T-07-02 defence-in-depth, behind
   * `worklet-messages.ts`'s `parseWorkletMessage` choke point).
   */
  render(output: Float32Array, modulationInput?: Float32Array): void {
    const increment = this.frequencyHz / this.sampleRate;
    for (let i = 0; i < output.length; i++) {
      const rawModulation = modulationInput ? modulationInput[i] : 0;
      const modulation = Number.isFinite(rawModulation) ? rawModulation : 0;
      output[i] = Math.sin(TWO_PI * this.phase + modulation);
      this.phase = (this.phase + increment) % 1;
    }
  }
}
