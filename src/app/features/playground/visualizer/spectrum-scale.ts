/**
 * Pure logarithmic frequency-scale module (10-02-PLAN.md, Task 1). This
 * module owns exactly one thing: the mapping between a frequency in hertz,
 * a horizontal position on the display, and the linear frequency-data bin
 * indices that fall inside a display band. This is display math, not DX7
 * domain knowledge — that is why it lives beside the visualizer component
 * rather than in the domain layer, whose purity gate governs instrument
 * modelling, not canvas geometry. It imports no symbol from Angular and no
 * symbol from the audio layer; every input it needs is a plain numeric
 * parameter.
 */

/** The floor of the displayed frequency range, in hertz. Non-zero because a
 * logarithmic position is undefined at 0 Hz, and because bin 0 of the
 * frequency data is the DC component, which carries no musical information
 * (Pitfall 3) — nothing at or below this floor is ever mapped onto the
 * axis. */
export const MIN_DISPLAY_HZ = 20;

/** The ceiling of the displayed frequency range, in hertz — the top of the
 * audible range. */
export const MAX_DISPLAY_HZ = 20000;

/** Number of discrete bars the spectrum lane renders (D-07). */
export const SPECTRUM_BAR_COUNT = 32;

/** The frozen tick list the frequency axis draws labels for (D-06),
 * following the domain layer's frozen-array convention for fixed data
 * lists (e.g. `TEACHING_TAGS` in `algorithm-definition.ts`). */
export const AXIS_TICK_HZ: readonly number[] = Object.freeze([100, 1000, 10000]);

/** `100` becomes `"100 Hz"`; `1000` becomes `"1 kHz"`. Trims a trailing
 * zero fraction so a whole number of kilohertz reads as a bare `"1 kHz"`
 * rather than `"1.0 kHz"`. */
export function formatTickLabel(hz: number): string {
  if (hz < 1000) {
    return `${hz} Hz`;
  }
  const kHz = hz / 1000;
  const label = Number.isInteger(kHz) ? String(kHz) : kHz.toFixed(1);
  return `${label} kHz`;
}

/**
 * The position of `hz` within `MIN_DISPLAY_HZ..MAX_DISPLAY_HZ`, expressed as
 * a fraction from `0` to `1` — the ratio of the logarithm of the frequency
 * over the floor to the logarithm of the ceiling over the floor.
 *
 * This is the single place the log-of-zero hazard is closed: the input is
 * clamped into the display range before any logarithm is taken, so `0`, a
 * negative frequency, a non-finite value, and a frequency above the ceiling
 * all produce a finite result within `0..1` rather than `NaN` or an
 * infinity. Both the bar layout (`barEdgesHz`) and the tick-label placement
 * (`drawFrequencyAxis` in `visualizer-frame.ts`) go through this function,
 * which is what keeps a label and the bar beneath it from ever disagreeing.
 */
export function hzToFraction(hz: number): number {
  const clamped = Number.isFinite(hz) ? Math.min(Math.max(hz, MIN_DISPLAY_HZ), MAX_DISPLAY_HZ) : MIN_DISPLAY_HZ;
  return Math.log(clamped / MIN_DISPLAY_HZ) / Math.log(MAX_DISPLAY_HZ / MIN_DISPLAY_HZ);
}

/**
 * Returns `barCount + 1` geometrically spaced edges from `MIN_DISPLAY_HZ`
 * to `MAX_DISPLAY_HZ`: the common ratio is the range ratio raised to the
 * reciprocal of the bar count, and edge `i` is the floor times that ratio
 * raised to the `i`. Every adjacent pair therefore shares the same ratio —
 * each bar covers the same musical interval rather than the same number of
 * hertz (D-05). The last edge is forced to the ceiling exactly so
 * accumulated floating-point drift cannot leave the final band short.
 */
export function barEdgesHz(barCount: number): readonly number[] {
  if (!Number.isInteger(barCount) || barCount <= 0) {
    throw new RangeError(`barCount must be a positive integer, received ${barCount}`);
  }
  const ratio = Math.pow(MAX_DISPLAY_HZ / MIN_DISPLAY_HZ, 1 / barCount);
  const edges: number[] = [];
  for (let i = 0; i <= barCount; i++) {
    edges.push(i === barCount ? MAX_DISPLAY_HZ : MIN_DISPLAY_HZ * Math.pow(ratio, i));
  }
  return Object.freeze(edges);
}

/**
 * The nearest integer bin whose centre frequency is `hz` — the frequency
 * times the FFT size divided by the sample rate, rounded — clamped into
 * `0..binCount - 1`. Frequencies above Nyquist (`sampleRate / 2`) are
 * capped before the index is computed, so they cannot round to a bin past
 * the last representable frequency. Returns `0` for a sample rate that is
 * not a positive finite number, rather than producing a non-finite index.
 */
export function binIndexForHz(hz: number, sampleRate: number, fftSize: number, binCount: number): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    return 0;
  }
  const cappedHz = Math.min(hz, sampleRate / 2);
  const rawIndex = Math.round((cappedHz * fftSize) / sampleRate);
  return Math.min(Math.max(rawIndex, 0), binCount - 1);
}

/** Inclusive frequency-data bin span `[startBin, endBin]` a bar's band
 * covers. */
export interface BarBinRange {
  readonly startBin: number;
  readonly endBin: number;
}

/**
 * Builds the `barCount` inclusive bin ranges each bar should read its
 * maximum byte from, for a given `sampleRate`. Returns `null` when the
 * sample rate is not a positive finite number — the caller's explicit "not
 * yet" signal for polling before the audio graph exists, rather than a
 * range list full of `NaN`.
 *
 * Display edges still span `MIN_DISPLAY_HZ..MAX_DISPLAY_HZ` so bar slots
 * stay aligned with `hzToFraction` tick labels. Bin mapping is capped at
 * `min(MAX_DISPLAY_HZ, sampleRate / 2)` (Nyquist): a band that lies
 * entirely above that ceiling is stored inverted (`startBin > endBin`) so
 * the draw loop's inclusive walk runs zero times, instead of every
 * above-Nyquist bar reusing the final FFT bin.
 *
 * Two corrections are applied, in this order, after mapping each adjacent
 * edge pair to bins (skipped for an empty above-Nyquist band):
 *
 *  1. Any start bin below `1` is raised to `1`, so the DC bin (index 0,
 *     which carries no musical information) is never included in any band.
 *  2. When a band's end bin has fallen below its (possibly just-corrected)
 *     start bin — which happens for the lowest bands, whose whole width is
 *     narrower than one linear FFT bin at a fixed FFT size — the end bin is
 *     set equal to the start bin, so the band still covers exactly one bin
 *     instead of an empty or inverted span. This is inherent to a fixed FFT
 *     size on a logarithmic axis, not a bug.
 */
export function buildBarBinRanges(
  sampleRate: number,
  fftSize: number,
  binCount: number,
  barCount: number,
): readonly BarBinRange[] | null {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    return null;
  }

  const displayMaxHz = Math.min(MAX_DISPLAY_HZ, sampleRate / 2);
  const edges = barEdgesHz(barCount);
  const ranges: BarBinRange[] = [];
  for (let i = 0; i < barCount; i++) {
    const startHz = edges[i]!;
    const endHz = edges[i + 1]!;

    if (startHz >= displayMaxHz) {
      // Entire band is above Nyquist / the display ceiling — leave it empty
      // rather than mapping it onto the last FFT bin.
      ranges.push(Object.freeze({ startBin: 1, endBin: 0 }));
      continue;
    }

    const endHzForBins = Math.min(endHz, displayMaxHz);
    let startBin = binIndexForHz(startHz, sampleRate, fftSize, binCount);
    const rawEndBin = binIndexForHz(endHzForBins, sampleRate, fftSize, binCount);

    // Correction 1: never include the DC bin in any band.
    if (startBin < 1) {
      startBin = 1;
    }
    // Correction 2: guarantee every in-range band covers at least one bin,
    // even when the band's whole width rounds inside a single FFT bin.
    const endBin = rawEndBin < startBin ? startBin : rawEndBin;

    ranges.push(Object.freeze({ startBin, endBin }));
  }
  return Object.freeze(ranges);
}
