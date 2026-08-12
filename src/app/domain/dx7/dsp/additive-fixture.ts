/**
 * Synthetic six-operator additive fixture (Phase 7, D-04 from
 * `07-CONTEXT.md`; ENGINE-01). Zero Angular imports, enforced by the
 * domain-purity ESLint gate (DOMAIN-04).
 *
 * This module deliberately does NOT read `algorithms.ts` or
 * `derive-role.ts` — graph-to-kernel-config translation from the real
 * 32-algorithm dataset is explicitly Phase 8's job (D-04). Hardcoding
 * "algorithm 32 means additive" here would be exactly the duplicated
 * routing knowledge CLAUDE.md's domain rules forbid ("One canonical
 * algorithm dataset; no duplicated routing knowledge"). These frequencies
 * are hand-picked purely to give this phase's kernel a multi-operator
 * proof case.
 */
import { PhaseModulatedOperator } from './operator';

export const ADDITIVE_FIXTURE_BASE_FREQUENCY_HZ = 220;

export const ADDITIVE_FIXTURE_HARMONIC_MULTIPLIERS: readonly [number, number, number, number, number, number] = [
  1, 2, 3, 4, 5, 6,
];

export const ADDITIVE_FIXTURE_FREQUENCIES_HZ: readonly number[] = ADDITIVE_FIXTURE_HARMONIC_MULTIPLIERS.map(
  (multiplier) => ADDITIVE_FIXTURE_BASE_FREQUENCY_HZ * multiplier,
);

/** Mirrors `operator.ts`'s `validateSampleRate`/`validateFrequencyHz` convention — reject before
 * assignment or allocation rather than let a bad value silently reach `new Float32Array(blockSize)`
 * (which truncates a fractional length and coerces `NaN` to a zero-length array instead of throwing). */
function validateBlockSize(blockSize: number): void {
  if (!Number.isInteger(blockSize) || blockSize <= 0) {
    throw new RangeError(`blockSize must be a finite positive integer, received ${blockSize}`);
  }
}

/**
 * Sums six independent {@link PhaseModulatedOperator} instances with no
 * gain and no scaling applied — the unscaled six-carrier sum stays inside
 * the kernel; attenuation is the engine's job (plan 07-02 reuses Phase 5's
 * already-proven `MASTER_GAIN` safety clamp for that).
 */
export class AdditiveOperatorBank {
  private readonly blockSize: number;
  private readonly operators: readonly PhaseModulatedOperator[];
  /** Ratios used by {@link setBaseFrequencyHz} — fixture harmonics, or the
   * relative ratios implied by a custom frequency array. */
  private readonly frequencyMultipliers: readonly number[];
  /** Allocated once here — `render` never allocates (CLAUDE.md's audio rule). */
  private readonly scratch: Float32Array;

  constructor(
    sampleRate: number,
    blockSize: number,
    frequencies: readonly number[] = ADDITIVE_FIXTURE_FREQUENCIES_HZ,
  ) {
    if (frequencies.length !== ADDITIVE_FIXTURE_HARMONIC_MULTIPLIERS.length) {
      throw new RangeError(
        `frequencies.length must be ${ADDITIVE_FIXTURE_HARMONIC_MULTIPLIERS.length}, received ${frequencies.length}`,
      );
    }
    validateBlockSize(blockSize);

    this.blockSize = blockSize;
    this.frequencyMultipliers = deriveFrequencyMultipliers(frequencies);
    this.operators = frequencies.map((frequencyHz) => new PhaseModulatedOperator(sampleRate, frequencyHz));
    this.scratch = new Float32Array(blockSize);
  }

  /**
   * Retunes operator `n` to `baseHz * frequencyMultipliers[n]` — preserving
   * either the fixture's harmonic ratios or the custom ratios supplied at
   * construction — so a dev harness can play notes in additive mode.
   */
  setBaseFrequencyHz(baseHz: number): void {
    for (let n = 0; n < this.operators.length; n++) {
      this.operators[n].setFrequencyHz(baseHz * this.frequencyMultipliers[n]!);
    }
  }

  /**
   * Writes the ascending-index sum of every operator's rendered block into
   * `output` — `output.fill(0)` then, per operator in ascending index
   * order, render into the pre-allocated scratch buffer and accumulate
   * with `output[i] += scratch[i]`. That order is part of the contract,
   * not an implementation detail: `additive-fixture.spec.ts` proves exact
   * equality against the same ascending-order accumulation performed
   * independently.
   */
  render(output: Float32Array): void {
    if (output.length !== this.blockSize) {
      throw new RangeError(
        `output.length must equal the configured block size ${this.blockSize}, received ${output.length}`,
      );
    }

    output.fill(0);
    for (const operator of this.operators) {
      operator.render(this.scratch);
      for (let i = 0; i < output.length; i++) {
        output[i] += this.scratch[i]!;
      }
    }
  }
}

function deriveFrequencyMultipliers(frequencies: readonly number[]): readonly number[] {
  const matchesFixture = frequencies.every(
    (frequencyHz, index) => frequencyHz === ADDITIVE_FIXTURE_FREQUENCIES_HZ[index],
  );
  if (matchesFixture) {
    return ADDITIVE_FIXTURE_HARMONIC_MULTIPLIERS;
  }

  const base = frequencies[0];
  if (!(typeof base === 'number' && base > 0 && Number.isFinite(base))) {
    throw new RangeError(`custom frequencies[0] must be a finite positive base, received ${base}`);
  }

  return Object.freeze(frequencies.map((frequencyHz) => frequencyHz / base));
}
