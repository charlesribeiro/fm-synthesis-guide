import { MAX_OUTPUT_LEVEL, MIN_OUTPUT_LEVEL, type OperatorParameters } from '../models/operator-parameters';
import { MAX_FEEDBACK_LEVEL, MIN_FEEDBACK_LEVEL } from '../models/patch';

/**
 * DX7-integer-scale → Web-Audio-value conversion boundary (Phase 5, D-10 from
 * `03-CONTEXT.md`). Pure math only — zero Angular imports, enforced by the
 * domain-purity ESLint gate (DOMAIN-04) — so every formula here is
 * independently unit-testable without touching Web Audio at all.
 *
 * These are approximations, not a reproduction of the DX7's log-domain ROM
 * tables (`05-RESEARCH.md` Open Question 1) — revisited only if a future
 * phase needs closer fidelity, never silently tightened here.
 */

/** MIDI note-number bounds (T-05-01) — `note` is validated against the full
 * MIDI range, not the 12-key play-surface range, per `05-01-PLAN.md`'s
 * phase decision: the playable octave is a UI property, not an engine one. */
export const MIN_MIDI_NOTE = 0;
export const MAX_MIDI_NOTE = 127;

/** Equal-temperament reference pitch (A4 = MIDI note 69 = 440Hz). */
export const A4_MIDI_NOTE = 69;
export const A4_FREQUENCY_HZ = 440;

/** MIDI-style velocity bounds (T-05-01). */
export const MIN_VELOCITY = 1;
export const MAX_VELOCITY = 127;

/**
 * Fixed safety-clamp master gain (D-03) — internally clamps every possible
 * combination of velocity, operator level, carrier count and feedback depth
 * at or below a single hearing-safe ceiling (T-05-02). Sized against
 * Algorithm 32's worst case: six simultaneous unmodulated carriers, each at
 * `outputLevelToAmplitude(99) = 1` and `velocityToAmplitude(127) = 1`,
 * summed at `voiceGain` before this gain is applied (`05-RESEARCH.md`
 * Assumptions Log A3) — `6 * MASTER_GAIN` must not exceed `1` (WR-01), since
 * Algorithm 32's carriers can share identical frequency and phase (all six
 * oscillators start together with no phase offset in `buildGraph()`), so
 * constructive interference at this peak is physically reachable, not
 * merely theoretical. Revisited by the listening checkpoint in plan
 * `05-04`. No user-facing volume control exists this phase.
 */
export const MASTER_GAIN = 1 / 6;

const SEMITONES_PER_OCTAVE = 12;

/**
 * Equal-temperament MIDI note → frequency (Hz), referenced to
 * {@link A4_FREQUENCY_HZ} at {@link A4_MIDI_NOTE}.
 */
export function midiNoteToFrequency(note: number): number {
  return A4_FREQUENCY_HZ * Math.pow(2, (note - A4_MIDI_NOTE) / SEMITONES_PER_OCTAVE);
}

const VELOCITY_CURVE_EXPONENT = 2;

/**
 * MIDI-style velocity (1..127) → a squared-normalised amplitude (0..1).
 * A non-linear curve reads as more natural to the ear than a direct linear
 * mapping (`05-RESEARCH.md` Assumptions Log A1's perceptual rationale).
 */
export function velocityToAmplitude(velocity: number): number {
  const normalized = velocity / MAX_VELOCITY;
  return Math.pow(normalized, VELOCITY_CURVE_EXPONENT);
}

const OUTPUT_LEVEL_CURVE_EXPONENT = 2;
const OUTPUT_LEVEL_RANGE = MAX_OUTPUT_LEVEL - MIN_OUTPUT_LEVEL;

/**
 * DX7 `outputLevel` (0..99) → a squared-normalised amplitude (0..1), the
 * same non-linear-curve rationale as {@link velocityToAmplitude}.
 */
export function outputLevelToAmplitude(outputLevel: number): number {
  const normalized = (outputLevel - MIN_OUTPUT_LEVEL) / OUTPUT_LEVEL_RANGE;
  return Math.pow(normalized, OUTPUT_LEVEL_CURVE_EXPONENT);
}

const CENTS_PER_OCTAVE = 1200;

/**
 * Fine-tuning step size for the DX7 `detune` scale (-7..+7, `05-02-PLAN.md`
 * Task 2). Applied through the oscillator's own `detune`-equivalent cents
 * math rather than a flat Hz offset (`05-RESEARCH.md` Assumptions Log A5),
 * so a given detune step stays proportional — and therefore audible as fine
 * tuning, not a semitone jump — across the whole playable range. 7 steps ×
 * 2 cents = 14 cents at the extremes, well under a 100-cent semitone.
 */
export const CENTS_PER_DETUNE_STEP = 2;

/**
 * Per-operator modulation-index ceiling (T-05-02) — the largest ratio of
 * peak frequency deviation to modulating frequency any single non-feedback
 * edge in the routing graph may reach. Bounds
 * {@link outputLevelToModulationDepthHz} regardless of `outputLevel`.
 */
export const MAX_MODULATION_INDEX = 8;

/**
 * Feedback self-loop index ceiling (T-05-02) — strictly below
 * {@link MAX_MODULATION_INDEX}. The feedback path is an audio-rate
 * self-loop through a `DelayNode` (`05-RESEARCH.md` Pattern 4) and is the
 * one place in this graph that can build energy on itself; this bound is a
 * stability/hearing-safety limit, not a taste choice.
 */
export const MAX_FEEDBACK_INDEX = 2;

/**
 * DX7 `OperatorParameters` (`mode`/`ratio`/`detune`/`fixedFrequencyHz`) →
 * the operator's own instantaneous frequency in Hz, given the currently
 * playing note's fundamental frequency. `'fixed'` mode returns
 * `fixedFrequencyHz` and ignores both `noteFrequencyHz` and `ratio`
 * entirely, matching DX7 fixed-frequency operator semantics.
 */
export function operatorFrequencyHz(parameters: OperatorParameters, noteFrequencyHz: number): number {
  if (parameters.mode === 'fixed') {
    return parameters.fixedFrequencyHz;
  }
  const detuneMultiplier = Math.pow(2, detuneToCents(parameters.detune) / CENTS_PER_OCTAVE);
  return noteFrequencyHz * parameters.ratio * detuneMultiplier;
}

/** DX7 `detune` (-7..+7) → cents, via {@link CENTS_PER_DETUNE_STEP}. */
export function detuneToCents(detune: number): number {
  return detune * CENTS_PER_DETUNE_STEP;
}

/**
 * DX7 `outputLevel` (0..99) → a modulating operator's peak frequency
 * deviation in Hz, scaled proportionally to `modulatorFrequencyHz` (peak
 * deviation = modulation index × modulating frequency) so a given operator
 * level sounds equally bright at every pitch, not duller as pitch rises.
 * Uses the same squared-normalised curve as {@link outputLevelToAmplitude}
 * — one curve convention in this file.
 */
export function outputLevelToModulationDepthHz(outputLevel: number, modulatorFrequencyHz: number): number {
  const modulationIndex = MAX_MODULATION_INDEX * outputLevelToAmplitude(outputLevel);
  return modulationIndex * modulatorFrequencyHz;
}

const FEEDBACK_LEVEL_RANGE = MAX_FEEDBACK_LEVEL - MIN_FEEDBACK_LEVEL;

/**
 * Instrument feedback depth (0..7, `patch.ts`) → the feedback operator's
 * peak self-modulation deviation in Hz, scaled proportionally to
 * `operatorFrequencyHz` and bounded by {@link MAX_FEEDBACK_INDEX} (T-05-02).
 * Same squared-normalised curve shape as
 * {@link outputLevelToModulationDepthHz}.
 */
export function feedbackLevelToDepthHz(feedbackLevel: number, operatorFrequencyHz: number): number {
  const normalized = (feedbackLevel - MIN_FEEDBACK_LEVEL) / FEEDBACK_LEVEL_RANGE;
  const feedbackIndex = MAX_FEEDBACK_INDEX * Math.pow(normalized, OUTPUT_LEVEL_CURVE_EXPONENT);
  return feedbackIndex * operatorFrequencyHz;
}
