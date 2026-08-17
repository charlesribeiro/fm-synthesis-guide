/**
 * Pure DX7-style four-rate/four-level envelope generator (Phase 9, D-01/D-04
 * from `09-CONTEXT.md`; ENGINE-03). Zero Angular imports, enforced by the
 * domain-purity ESLint gate (DOMAIN-04) — every formula here is
 * independently unit-testable in Node with no browser, no `AudioContext`,
 * and no jsdom Web Audio surface.
 *
 * This is an original implementation written from first principles toward
 * DX7-style envelope behaviour (a constant-per-sample-step state machine
 * driven by {@link envelopeRateToLevelUnitsPerSample}) — never a
 * transcription of, or derived from, any DX7 ROM disassembly or Dexed
 * (GPLv3) source. It must never be described as an exact DX7 emulation.
 */
import {
  DEFAULT_ENVELOPE,
  ENVELOPE_SEGMENT_COUNT,
  MIN_ENVELOPE_LEVEL,
  RELEASE_SEGMENT_INDEX,
  type Dx7Envelope,
} from '../models/operator-parameters';
import { envelopeRateToLevelUnitsPerSample, outputLevelToAmplitude } from '../audio/value-conversion';

function validateSampleRate(sampleRate: number): void {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`sampleRate must be a finite, positive number, received ${sampleRate}`);
  }
}

/**
 * One operator's independent envelope state machine. Six of these live
 * inside `GraphRouter` (D-01) — one per operator — each scaling that
 * operator's own rendered block before it is read either as a carrier
 * contribution or as another operator's modulation source.
 *
 * D-04's rate semantics: a rate is speed-toward-the-current-segment's-target
 * from wherever the level currently sits, never a fixed-duration ADSR
 * plateau from a canonical starting point. `gateOn`/`gateOff` therefore
 * never assign the level a fixed starting value — the level is untouched by
 * either transition, which is what makes a mid-attack release or a
 * mid-release retrigger move continuously instead of popping.
 */
export class EnvelopeGenerator {
  private readonly sampleRate: number;

  /** One precomputed per-sample step per segment, derived from the current
   * envelope's rates via {@link envelopeRateToLevelUnitsPerSample}. Allocated
   * once in the constructor and refilled in place by {@link setEnvelope} —
   * never reallocated, mirroring `operator.ts`'s allocate-once convention
   * (CLAUDE.md's audio rule). */
  private readonly stepsPerSegment: Float64Array;

  private envelope: Dx7Envelope;

  /** The envelope's current position on the DX7 0-99 level scale. Starts at
   * the minimum level, in the release segment (see `segmentIndex` below) —
   * together these two facts are what makes a freshly constructed, never-
   * gated generator render silence. Untouched by `gateOn`/`gateOff` (D-04). */
  private currentLevel = MIN_ENVELOPE_LEVEL;

  /** Which of the four segments is currently active. Starts at
   * {@link RELEASE_SEGMENT_INDEX} so an ungated generator idles at the
   * envelope's own release target rather than at an arbitrary value. */
  private segmentIndex = RELEASE_SEGMENT_INDEX;

  /** Whether a note is currently held — gates whether the segment index is
   * allowed to auto-advance past the held progression in {@link render}. */
  private held = false;

  constructor(sampleRate: number, envelope: Dx7Envelope = DEFAULT_ENVELOPE) {
    validateSampleRate(sampleRate);
    this.sampleRate = sampleRate;
    this.envelope = envelope;
    this.stepsPerSegment = new Float64Array(ENVELOPE_SEGMENT_COUNT);
    this.refillSteps();
  }

  /**
   * Stores a new envelope and refills the precomputed step array from
   * {@link envelopeRateToLevelUnitsPerSample}. Deliberately does not touch
   * `currentLevel` or `segmentIndex` — a live parameter edit during a held
   * note re-targets the envelope without restarting it, which is what keeps
   * a slider drag from popping (D-04).
   */
  setEnvelope(envelope: Dx7Envelope): void {
    this.envelope = envelope;
    this.refillSteps();
  }

  private refillSteps(): void {
    for (let index = 0; index < ENVELOPE_SEGMENT_COUNT; index++) {
      this.stepsPerSegment[index] = envelopeRateToLevelUnitsPerSample(this.envelope.rates[index]!, this.sampleRate);
    }
  }

  /**
   * Starts the held progression from the first segment. A deliberate
   * divergence from `operator.ts`'s `resetPhase` reset pattern (D-04): a
   * note retriggered mid-release must move from its actual current level at
   * the first segment's rate, so assigning a fixed starting value here is
   * precisely the bug this design exists to prevent.
   */
  gateOn(): void {
    this.held = true;
    this.segmentIndex = 0;
  }

  /**
   * Jumps straight to the release segment from wherever the level currently
   * sits — never a fixed starting value (D-04), for the same reason as
   * {@link gateOn}.
   */
  gateOff(): void {
    this.held = false;
    this.segmentIndex = RELEASE_SEGMENT_INDEX;
  }

  /**
   * Writes exactly `output.length` per-sample amplitude values — never
   * allocates (CLAUDE.md's audio rule). Per sample: moves `currentLevel`
   * toward the active segment's target by at most that segment's
   * precomputed step, clamping exactly at the target so the level can never
   * overshoot; guards against a non-finite level the same way `operator.ts`
   * guards its own per-sample inputs; then, while held and the segment index
   * is below the release segment's predecessor (index
   * {@link RELEASE_SEGMENT_INDEX} - 1 — the de-facto sustain plateau) and the
   * current level already equals that segment's target, advances the
   * segment index — a bounded loop of at most two further advances, so an
   * envelope whose consecutive targets are identical settles in the same
   * sample instead of spending one sample per zero-distance segment. This
   * check happens once per sample, never once per block: at the fastest
   * rates a full-scale segment completes in under a hundred samples, so a
   * per-block check would hold a stale target for most of a render quantum.
   *
   * The third segment's target is the de-facto sustain plateau: once
   * reached while held, there is nothing further to advance to, and the
   * generator simply holds there. The release segment is entered only by
   * {@link gateOff}, from whatever level is current, regardless of which
   * segment was active.
   */
  render(output: Float32Array): void {
    for (let i = 0; i < output.length; i++) {
      const target = this.envelope.levels[this.segmentIndex]!;
      const step = this.stepsPerSegment[this.segmentIndex]!;

      // Never-gated rest must not ramp toward a non-zero release target.
      if (!this.held && this.currentLevel === MIN_ENVELOPE_LEVEL && this.segmentIndex === RELEASE_SEGMENT_INDEX) {
        output[i] = 0;
        continue;
      }

      if (this.currentLevel < target) {
        this.currentLevel = Math.min(target, this.currentLevel + step);
      } else if (this.currentLevel > target) {
        this.currentLevel = Math.max(target, this.currentLevel - step);
      }
      if (!Number.isFinite(this.currentLevel)) {
        this.currentLevel = MIN_ENVELOPE_LEVEL;
      }

      while (this.held && this.segmentIndex < RELEASE_SEGMENT_INDEX - 1) {
        const segmentTarget = this.envelope.levels[this.segmentIndex]!;
        if (this.currentLevel !== segmentTarget) {
          break;
        }
        this.segmentIndex++;
      }

      // Once release has reached its target with no note held, mute even if
      // that target is above zero so the engine cannot drone after note-off.
      // Reset the stored level to silence so a later gateOn retrigger attacks
      // from rest, not from a non-zero L4.
      if (!this.held && this.segmentIndex === RELEASE_SEGMENT_INDEX && this.currentLevel === target) {
        this.currentLevel = MIN_ENVELOPE_LEVEL;
        output[i] = 0;
        continue;
      }

      output[i] = outputLevelToAmplitude(this.currentLevel);
    }
  }
}
