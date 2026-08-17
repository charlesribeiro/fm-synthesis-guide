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
 * `envelope` (Phase 9, ENGINE-03) is the structured four-rate/four-level
 * DX7-style envelope shape — it replaced the flat single-level sustain
 * stand-in this field used to be, per this file's own prior documentation
 * that the widening would be "a type change on this one field, not a rename
 * or a new field."
 *
 * Deliberately excludes an operator-role field: role (carrier vs. modulator)
 * is always derived on demand from an `AlgorithmDefinition`'s edges by
 * `derive-role.ts` (Phase 2 D-05/D-07), never stored per-operator here.
 */
export type OperatorFrequencyMode = 'ratio' | 'fixed';

/**
 * A DX7-style four-rate/four-level envelope (Phase 9, D-01/D-04/D-06 from
 * `09-CONTEXT.md`; ENGINE-03). Both tuples are fixed-length, index 0 through
 * 3 mapping to R1/L1 through R4/L4 on the DX7-authentic 0-99 integer scale
 * (D-10). Index 3 (`RELEASE_SEGMENT_INDEX`) is reserved exclusively for the
 * release segment, entered only on note-off; indices 0 through 2 are the
 * held progression a note walks through while gated on, per D-04's "a rate
 * is speed toward the current segment's target from wherever the level
 * currently sits" semantics — never a fixed-duration ADSR plateau.
 */
export interface Dx7Envelope {
  readonly rates: readonly [number, number, number, number];
  readonly levels: readonly [number, number, number, number];
}

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
  readonly envelope: Dx7Envelope;
}

/** D-10 DX7 integer scale bounds — named so no consumer hardcodes them. */
export const MIN_OUTPUT_LEVEL = 0;
export const MAX_OUTPUT_LEVEL = 99;
export const MIN_DETUNE = -7;
export const MAX_DETUNE = 7;
export const MIN_ENVELOPE_LEVEL = 0;
export const MAX_ENVELOPE_LEVEL = 99;
/** Phase 9's rate-scale bounds — the same 0-99 integer scale as the level
 * bounds above, but a distinct semantic axis (speed, not target), so it is
 * named separately rather than reusing `MIN_ENVELOPE_LEVEL`/`MAX_ENVELOPE_LEVEL`. */
export const MIN_ENVELOPE_RATE = 0;
export const MAX_ENVELOPE_RATE = 99;
/** The fixed number of rate/level pairs a {@link Dx7Envelope} always carries. */
export const ENVELOPE_SEGMENT_COUNT = 4;
/** The segment index reserved exclusively for release — entered only by
 * `EnvelopeGenerator.gateOff` (`envelope-generator.ts`, D-04). */
export const RELEASE_SEGMENT_INDEX = 3;

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
 * D-06's one shared envelope shape every operator in the default patch uses
 * (Phase 9, `09-CONTEXT.md`). Frozen at every level — the object itself and
 * both tuples — so the single reference shared across all six operators on
 * every algorithm can never be mutated in place (T-03-01's convention,
 * carried into this new field).
 *
 * Rates `[74, 74, 74, 55]` / levels `[99, 99, 99, 0]`: with the rate curve
 * added in `value-conversion.ts`, rate 74 gives a full-scale segment of
 * roughly fifteen milliseconds and rate 55 roughly seventy-three
 * milliseconds — the same two ramp lengths a human already approved at the
 * 05-04 and 07-03 listening checkpoints (`WORKLET_ATTACK_SECONDS` = 0.015s,
 * `WORKLET_RELEASE_SECONDS` = 0.075s). The first three levels are maximum so
 * the default patch sustains at an amplitude factor of exactly one, which
 * preserves Phase 8's already-approved loudness unchanged; the fourth level
 * is zero so a released note reaches true silence — with the global
 * click-prevention voice ramp removed (D-02), this is now the only thing
 * keeping the engine quiet at rest.
 */
export const DEFAULT_ENVELOPE: Dx7Envelope = Object.freeze({
  rates: Object.freeze([74, 74, 74, 55] as const),
  levels: Object.freeze([99, 99, 99, 0] as const),
});

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
  envelope: DEFAULT_ENVELOPE,
});

/**
 * Non-throwing structural guard for a {@link Dx7Envelope}: a non-null,
 * non-array object whose `rates` and `levels` are each an array of exactly
 * {@link ENVELOPE_SEGMENT_COUNT} integer entries, rates within
 * {@link MIN_ENVELOPE_RATE}..{@link MAX_ENVELOPE_RATE} and levels within
 * {@link MIN_ENVELOPE_LEVEL}..{@link MAX_ENVELOPE_LEVEL}. Mirrors
 * `worklet-messages.ts`'s narrow-and-reject-malformed convention so the
 * worklet-side and main-thread validators cannot drift — the worklet-side
 * guard imports this function directly rather than re-declaring the shape.
 */
export function isDx7EnvelopeLike(value: unknown): value is Dx7Envelope {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const rates = (value as { rates?: unknown }).rates;
  const levels = (value as { levels?: unknown }).levels;
  return (
    isBoundedIntegerTuple(rates, MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE) &&
    isBoundedIntegerTuple(levels, MIN_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL)
  );
}

function isBoundedIntegerTuple(value: unknown, min: number, max: number): boolean {
  if (!Array.isArray(value) || value.length !== ENVELOPE_SEGMENT_COUNT) {
    return false;
  }
  return value.every((entry) => typeof entry === 'number' && Number.isInteger(entry) && entry >= min && entry <= max);
}

/**
 * Throwing sibling of {@link isDx7EnvelopeLike}, matching
 * `validateOperatorParameters`'s `RangeError` convention. Names the specific
 * offending member and index rather than interpolating the whole received
 * object — a hostile object's own `toString`/property getters must never be
 * able to affect this message.
 */
export function validateDx7Envelope(envelope: unknown): void {
  if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope)) {
    throw new RangeError('envelope must be an object with rates and levels tuples');
  }
  validateBoundedIntegerTuple((envelope as { rates?: unknown }).rates, 'rates', MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE);
  validateBoundedIntegerTuple(
    (envelope as { levels?: unknown }).levels,
    'levels',
    MIN_ENVELOPE_LEVEL,
    MAX_ENVELOPE_LEVEL,
  );
}

function validateBoundedIntegerTuple(value: unknown, memberName: string, min: number, max: number): void {
  if (!Array.isArray(value) || value.length !== ENVELOPE_SEGMENT_COUNT) {
    throw new RangeError(
      `envelope.${memberName} must be an array of exactly ${ENVELOPE_SEGMENT_COUNT} entries, received ${
        Array.isArray(value) ? `an array of length ${value.length}` : typeof value
      }`,
    );
  }
  for (let index = 0; index < value.length; index++) {
    const entry = value[index];
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < min || entry > max) {
      // A number is a primitive with no overridable stringification, so
      // String(entry) is safe there; every other shape is described by its
      // typeof alone (never coerced) — a hostile object's own toString or
      // Symbol.toPrimitive must never run just to build this message,
      // mirroring this function's own array-shape branch above and
      // validateDx7Envelope's documented "never affect this message" rule.
      const received = typeof entry === 'number' ? String(entry) : entry === null ? 'null' : typeof entry;
      throw new RangeError(
        `envelope.${memberName}[${index}] must be an integer in ${min}..${max}, received ${received}`,
      );
    }
  }
}

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

  if ('envelope' in changes) {
    // `in` presence check (not `!== undefined`), for the same reason every
    // other branch in this function uses it: an explicitly supplied
    // `{ envelope: undefined }` must still be rejected rather than silently
    // treated as "not supplied."
    validateDx7Envelope(changes.envelope);
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
