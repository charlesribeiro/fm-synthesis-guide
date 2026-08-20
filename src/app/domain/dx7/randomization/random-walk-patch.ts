/**
 * Pure, framework-independent bounded random walk over an {@link
 * InstrumentPatch} (Phase 10, VIZ-02). The repository's domain-purity ESLint
 * gate (DOMAIN-04) forbids this folder from importing anything from Angular
 * or from `state/` — its only imports are the bounds constants, the frozen
 * ratio list, and the parameter/patch/operator types from the sibling
 * `models/` files.
 *
 * The randomness source is always a parameter (see {@link RandomSource}),
 * never a hidden global read: no other file in this codebase reaches for
 * `Math.random` directly, and taking the source as a parameter is what lets
 * a spec drive every function here with a fully deterministic sequence.
 *
 * D-13's bounded-walk rule: every numeric field here moves by a delta
 * bounded relative to its *current* value, never by an independent uniform
 * draw across the field's full range — the latter has a well-known failure
 * mode (several fields landing near zero together produces silence), which
 * is exactly what a bounded walk from the sound already playing avoids.
 * Exception: {@link randomWalkFixedFrequencyHz} clamp-then-walks values
 * outside the practical randomization range (see that function's docs);
 * every other walker always starts from the true current value.
 *
 * D-12/D-16: `algorithmId`, every operator's `mode`, and every operator's
 * `enabled` flag are never walked by anything in this module. A structural
 * change (routing, on/off) is not a "nudge" — see {@link randomWalkPatch} and
 * {@link randomWalkOperatorParameters} for exactly how each is excluded.
 */
import {
  COARSE_RATIOS,
  MAX_DETUNE,
  MAX_ENVELOPE_LEVEL,
  MAX_ENVELOPE_RATE,
  MAX_OUTPUT_LEVEL,
  MIN_DETUNE,
  MIN_ENVELOPE_LEVEL,
  MIN_ENVELOPE_RATE,
  MIN_OUTPUT_LEVEL,
  type OperatorParameters,
} from '../models/operator-parameters';
import { MAX_FEEDBACK_LEVEL, MIN_FEEDBACK_LEVEL, type InstrumentPatch } from '../models/patch';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import type { OperatorParameterSet } from '../models/patch';

/**
 * The fraction of a bounded field's full range one press may move (D-13).
 * A tuning constant, not a locked value — CONTEXT.md left the exact figure
 * to Claude's Discretion, and this is named so the 10-04 checkpoint can
 * retune it from listening without touching any structure here.
 */
export const RANDOM_WALK_DELTA_FRACTION = 0.2;

/**
 * A randomization-local practical range for the fixed-frequency walk, not a
 * domain-wide validation bound: `validateOperatorParameters` accepts any
 * positive finite fixed frequency, and this module must not change that — it
 * only declines to walk outside a range where the result stays musically
 * usable.
 */
export const MIN_RANDOM_FIXED_FREQUENCY_HZ = 20;
export const MAX_RANDOM_FIXED_FREQUENCY_HZ = 8000;

/**
 * A randomness source is a parameter, not a hidden global read — this both
 * lets a spec drive it deterministically and matches the fact that no other
 * file in this codebase reaches for a global random source. Expected to
 * return a value in the closed unit interval `[0, 1]` (the same contract
 * `Math.random()` satisfies, minus the theoretical exclusive upper bound).
 */
export type RandomSource = () => number;

function readUnitSourceOrMidpoint(rng: RandomSource): number {
  const value = rng();
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.5;
}

/**
 * Walks `current` by a delta bounded to `deltaFraction` of the `min..max`
 * range, clamped into that range. Reads one value from `rng`; when it is not
 * a finite number in the closed unit interval, substitutes the midpoint so
 * the delta becomes zero — a broken source produces no movement rather than
 * a `NaN` written into the patch.
 *
 * Rounding after scaling (not scaling a rounded value) is what makes the two
 * extreme source values reach exactly the full delta in both directions:
 * `randomWalkInteger(50, 0, 99, 0.2, () => 0)` returns `30` and
 * `randomWalkInteger(50, 0, 99, 0.2, () => 1)` returns `70`.
 */
export function randomWalkInteger(
  current: number,
  min: number,
  max: number,
  deltaFraction: number,
  rng: RandomSource,
): number {
  const source = readUnitSourceOrMidpoint(rng);
  const range = max - min;
  const delta = Math.round((source * 2 - 1) * deltaFraction * range);
  const next = current + delta;
  return Math.min(max, Math.max(min, next));
}

function nearestCoarseRatioIndex(value: number): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < COARSE_RATIOS.length; index++) {
    const distance = Math.abs(COARSE_RATIOS[index]! - value);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

/**
 * Walks `current`'s *position* within the frozen {@link COARSE_RATIOS} list
 * and returns the member at the resulting position — never an interpolated
 * value, since `validateOperatorParameters`'s `ratio` branch rejects
 * anything absent from that list. When `current` is absent from the list
 * (arrived from outside this module), starts from the position of the
 * numerically nearest member instead of failing. Reuses {@link
 * randomWalkInteger}'s scaled-and-rounded rule applied to the list's last
 * index, so a single press moves at most `deltaFraction * (length - 1)`
 * (six) positions in either direction and clamps at both ends of the list.
 */
export function randomWalkRatio(current: number, rng: RandomSource): number {
  const currentIndex = COARSE_RATIOS.indexOf(current);
  const startIndex = currentIndex === -1 ? nearestCoarseRatioIndex(current) : currentIndex;
  const lastIndex = COARSE_RATIOS.length - 1;
  const nextIndex = randomWalkInteger(startIndex, 0, lastIndex, RANDOM_WALK_DELTA_FRACTION, rng);
  return COARSE_RATIOS[nextIndex]!;
}

/**
 * Walks `current` multiplicatively rather than additively, unlike every
 * other field in this module: frequency is perceived logarithmically, so a
 * fixed proportion of the current value is the musically meaningful step,
 * and there is in any case no declared domain upper bound on this field from
 * which a linear fraction could be taken. Clamps `current` into {@link
 * MIN_RANDOM_FIXED_FREQUENCY_HZ}..{@link MAX_RANDOM_FIXED_FREQUENCY_HZ}
 * first (substituting the floor when it is not a positive finite number),
 * multiplies by a factor of one plus the symmetric scaled source value times
 * {@link RANDOM_WALK_DELTA_FRACTION}, clamps the product back into the
 * range, and rounds to two decimal places.
 *
 * This clamp-then-walk order is an intentional exception to the module's
 * "always walks from current" D-13 rule: `fixedFrequencyHz` has no domain
 * upper bound, so an out-of-practical-range current value (e.g. 20000 Hz)
 * is brought into 20..8000 Hz *before* the proportional step. The walk is
 * then bounded relative to that clamped starting point, not the raw current
 * value. Other walkers in this module do not clamp-then-walk.
 */
export function randomWalkFixedFrequencyHz(current: number, rng: RandomSource): number {
  const clampedCurrent =
    Number.isFinite(current) && current > 0
      ? Math.min(MAX_RANDOM_FIXED_FREQUENCY_HZ, Math.max(MIN_RANDOM_FIXED_FREQUENCY_HZ, current))
      : MIN_RANDOM_FIXED_FREQUENCY_HZ;
  const source = readUnitSourceOrMidpoint(rng);
  const factor = 1 + (source * 2 - 1) * RANDOM_WALK_DELTA_FRACTION;
  const product = clampedCurrent * factor;
  const clamped = Math.min(MAX_RANDOM_FIXED_FREQUENCY_HZ, Math.max(MIN_RANDOM_FIXED_FREQUENCY_HZ, product));
  return Math.round(clamped * 100) / 100;
}

/**
 * Walks one operator's parameters. `enabled` and `mode` are copied straight
 * through — never walked, per D-16, because a two-value flag has no
 * bounded-walk meaning and because flipping either is a structural change
 * rather than a nudge (the same reason D-12 gives for excluding routing).
 * `ratio` is walked only while `mode` is `'ratio'`; `fixedFrequencyHz` is
 * walked only while `mode` is `'fixed'` — the inactive one of the pair is
 * copied through unwalked. The four envelope rates and four envelope levels
 * are each walked independently (eight separate `rng` reads, not one delta
 * applied eight times), because a single shared delta would move the whole
 * envelope rigidly and lose the per-segment variety that makes randomizing
 * useful.
 */
export function randomWalkOperatorParameters(current: OperatorParameters, rng: RandomSource): OperatorParameters {
  const ratio = current.mode === 'ratio' ? randomWalkRatio(current.ratio, rng) : current.ratio;
  const fixedFrequencyHz =
    current.mode === 'fixed' ? randomWalkFixedFrequencyHz(current.fixedFrequencyHz, rng) : current.fixedFrequencyHz;
  const outputLevel = randomWalkInteger(
    current.outputLevel,
    MIN_OUTPUT_LEVEL,
    MAX_OUTPUT_LEVEL,
    RANDOM_WALK_DELTA_FRACTION,
    rng,
  );
  const detune = randomWalkInteger(current.detune, MIN_DETUNE, MAX_DETUNE, RANDOM_WALK_DELTA_FRACTION, rng);

  const rates: [number, number, number, number] = [
    randomWalkInteger(current.envelope.rates[0], MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE, RANDOM_WALK_DELTA_FRACTION, rng),
    randomWalkInteger(current.envelope.rates[1], MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE, RANDOM_WALK_DELTA_FRACTION, rng),
    randomWalkInteger(current.envelope.rates[2], MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE, RANDOM_WALK_DELTA_FRACTION, rng),
    randomWalkInteger(current.envelope.rates[3], MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE, RANDOM_WALK_DELTA_FRACTION, rng),
  ];
  const levels: [number, number, number, number] = [
    randomWalkInteger(current.envelope.levels[0], MIN_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, RANDOM_WALK_DELTA_FRACTION, rng),
    randomWalkInteger(current.envelope.levels[1], MIN_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, RANDOM_WALK_DELTA_FRACTION, rng),
    randomWalkInteger(current.envelope.levels[2], MIN_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, RANDOM_WALK_DELTA_FRACTION, rng),
    randomWalkInteger(current.envelope.levels[3], MIN_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, RANDOM_WALK_DELTA_FRACTION, rng),
  ];

  return {
    enabled: current.enabled,
    mode: current.mode,
    ratio,
    fixedFrequencyHz,
    detune,
    outputLevel,
    envelope: { rates, levels },
  };
}

/**
 * Walks every numeric field of `patch` by a bounded delta from its current
 * value. `algorithmId` reaches the returned patch only through being copied
 * straight from `patch.algorithmId` — this function contains no expression
 * that could assign it, which is what makes D-12's exclusion of routing
 * structural here rather than a rule a future edit could quietly drop.
 *
 * Never writes into `patch` or any object reachable from it: the returned
 * operators record, every operator's parameters object, and every
 * operator's envelope object are all newly built. The A/B snapshot slots
 * hold direct references to previously-current patch objects rather than
 * clones, so this immutability is what keeps a captured A or B slot exact.
 */
export function randomWalkPatch(patch: InstrumentPatch, rng: RandomSource): InstrumentPatch {
  const operatorEntries = OPERATOR_IDS.map(
    (operatorId: OperatorId) => [operatorId, randomWalkOperatorParameters(patch.operators[operatorId], rng)] as const,
  );
  const operators = Object.fromEntries(operatorEntries) as OperatorParameterSet;
  const feedback = randomWalkInteger(patch.feedback, MIN_FEEDBACK_LEVEL, MAX_FEEDBACK_LEVEL, RANDOM_WALK_DELTA_FRACTION, rng);

  return {
    algorithmId: patch.algorithmId,
    operators,
    feedback,
  };
}
