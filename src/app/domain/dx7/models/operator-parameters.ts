/**
 * A single DX7-style operator's editable parameters (D-06). This models the
 * full future shape — not a Phase-5-MVP-only subset — because Phase 4's SVG
 * view model, Phase 5's MVP engine, and Phase 9's envelope work all read this
 * same shape; widening it later means revisiting every call site that
 * destructures it (rated costly to reverse, `03-CONTEXT.md`).
 *
 * All numeric fields are stored on DX7-authentic integer scales (D-10), never
 * normalized floats or pre-converted Web Audio units:
 * - `outputLevel`: 0-99.
 * - `detune`: -7..+7.
 * - `ratio`: a coarse multiple from {@link COARSE_RATIOS} (0.5, then the
 *   integers 1 through 31).
 * Phase 5's `SynthEngine` boundary converts these to Web Audio gain/frequency
 * values; this shape itself never performs that conversion.
 *
 * `envelopeLevel` (D-07) is a single sustain-level stand-in for the full
 * 4-rate / 4-level DX7 envelope that Phase 9 (ENGINE-03) designs. Widening
 * envelope modeling later is a type change on this one field, not a rename or
 * a new field.
 *
 * Deliberately excludes an operator-role field: role (carrier vs. modulator)
 * is always derived on demand from an `AlgorithmDefinition`'s edges by
 * `derive-role.ts` (Phase 2 D-05/D-07), never stored per-operator here.
 */
export type OperatorFrequencyMode = 'ratio' | 'fixed';

export interface OperatorParameters {
  readonly enabled: boolean;
  readonly mode: OperatorFrequencyMode;
  readonly ratio: number;
  /**
   * Inert while `mode` is `'ratio'`. Exists so switching an operator to
   * fixed-frequency mode has a defined starting value rather than an
   * undefined one.
   */
  readonly fixedFrequencyHz: number;
  readonly detune: number;
  readonly outputLevel: number;
  readonly envelopeLevel: number;
}

/** D-10 DX7 integer scale bounds — named so no consumer hardcodes them. */
export const MIN_OUTPUT_LEVEL = 0;
export const MAX_OUTPUT_LEVEL = 99;
export const MIN_DETUNE = -7;
export const MAX_DETUNE = 7;
export const MIN_ENVELOPE_LEVEL = 0;
export const MAX_ENVELOPE_LEVEL = 99;

/**
 * The DX7's 32 coarse-frequency ratio positions: 0.5 followed by the
 * integers 1 through 31. Exported as data (following `TEACHING_TAGS`'s
 * frozen-array pattern in `algorithm-definition.ts`) rather than kept as an
 * inline check, because Phase 4's operator editor renders this list.
 */
export const COARSE_RATIOS: readonly number[] = Object.freeze([
  0.5,
  ...Array.from({ length: 31 }, (_, index) => index + 1),
]);

export function isCoarseRatio(value: number): boolean {
  return COARSE_RATIOS.includes(value);
}

/**
 * D-11: the uniform default patch's per-operator values — a moderate,
 * audible-by-default starting point (D-08), identical for every operator on
 * every algorithm (D-09). See `03-CONTEXT.md` D-11 for the full rationale
 * behind each literal.
 */
export const DEFAULT_OPERATOR_PARAMETERS: OperatorParameters = Object.freeze({
  enabled: true,
  mode: 'ratio',
  ratio: 1.0,
  fixedFrequencyHz: 440,
  detune: 0,
  outputLevel: 50,
  envelopeLevel: 99,
});

/**
 * Throwing structural guard (matches `validate-algorithm.ts`'s
 * `InvalidAlgorithmError` convention, using the built-in `RangeError` since
 * every violation here is a value-out-of-range case). Only fields *present*
 * on `changes` are validated — an absent field is not an assertion, which is
 * what makes this usable for partial `updateOperator` edits. Presence is
 * checked with `in` rather than `!== undefined` so an explicitly supplied
 * `{ outputLevel: undefined }` is rejected instead of silently treated as
 * "not supplied" — the latter would let `undefined` slip past validation and
 * then overwrite a valid value when the caller spreads `changes` onto the
 * previous parameters.
 *
 * `fixedFrequencyHz` is deliberately only checked for being a positive
 * finite number, not quantized to the DX7's discrete fixed-frequency
 * positions — that quantization belongs to Phase 5's engine boundary; this
 * validator only rejects values that are meaningless as a frequency.
 */
export function validateOperatorParameters(changes: Partial<OperatorParameters>): void {
  if ('outputLevel' in changes) {
    const outputLevel = changes.outputLevel;
    if (
      outputLevel === undefined ||
      !Number.isInteger(outputLevel) ||
      outputLevel < MIN_OUTPUT_LEVEL ||
      outputLevel > MAX_OUTPUT_LEVEL
    ) {
      throw new RangeError(
        `outputLevel must be an integer in ${MIN_OUTPUT_LEVEL}..${MAX_OUTPUT_LEVEL}, received ${outputLevel}`,
      );
    }
  }

  if ('envelopeLevel' in changes) {
    const envelopeLevel = changes.envelopeLevel;
    if (
      envelopeLevel === undefined ||
      !Number.isInteger(envelopeLevel) ||
      envelopeLevel < MIN_ENVELOPE_LEVEL ||
      envelopeLevel > MAX_ENVELOPE_LEVEL
    ) {
      throw new RangeError(
        `envelopeLevel must be an integer in ${MIN_ENVELOPE_LEVEL}..${MAX_ENVELOPE_LEVEL}, received ${envelopeLevel}`,
      );
    }
  }

  if ('detune' in changes) {
    const detune = changes.detune;
    if (
      detune === undefined ||
      !Number.isInteger(detune) ||
      detune < MIN_DETUNE ||
      detune > MAX_DETUNE
    ) {
      throw new RangeError(`detune must be an integer in ${MIN_DETUNE}..${MAX_DETUNE}, received ${detune}`);
    }
  }

  if ('ratio' in changes) {
    const ratio = changes.ratio;
    if (ratio === undefined || !isCoarseRatio(ratio)) {
      throw new RangeError(
        `ratio must be one of the ${COARSE_RATIOS.length} DX7 coarse-frequency positions, received ${ratio}`,
      );
    }
  }

  if ('fixedFrequencyHz' in changes) {
    const fixedFrequencyHz = changes.fixedFrequencyHz;
    if (fixedFrequencyHz === undefined || !Number.isFinite(fixedFrequencyHz) || fixedFrequencyHz <= 0) {
      throw new RangeError(`fixedFrequencyHz must be a finite number greater than 0, received ${fixedFrequencyHz}`);
    }
  }

  if ('mode' in changes) {
    const mode = changes.mode;
    if (mode !== 'ratio' && mode !== 'fixed') {
      throw new RangeError(`mode must be "ratio" or "fixed", received ${String(mode)}`);
    }
  }

  if ('enabled' in changes) {
    const enabled = changes.enabled;
    if (typeof enabled !== 'boolean') {
      throw new RangeError(`enabled must be a boolean, received ${String(enabled)}`);
    }
  }
}
