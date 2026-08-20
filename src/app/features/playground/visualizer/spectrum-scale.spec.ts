import {
  AXIS_TICK_HZ,
  MAX_DISPLAY_HZ,
  MIN_DISPLAY_HZ,
  SPECTRUM_BAR_COUNT,
  barEdgesHz,
  binIndexForHz,
  buildBarBinRanges,
  formatTickLabel,
  hzToFraction,
} from './spectrum-scale';

const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;
const BIN_COUNT = 1024;

describe('spectrum-scale (pure logarithmic frequency-scale module)', () => {
  describe('barEdgesHz', () => {
    it('returns barCount + 1 strictly increasing edges from MIN_DISPLAY_HZ to MAX_DISPLAY_HZ, with a constant ratio between adjacent edges', () => {
      const edges = barEdgesHz(SPECTRUM_BAR_COUNT);

      expect(edges.length).toBe(SPECTRUM_BAR_COUNT + 1);
      expect(edges[0]).toBe(MIN_DISPLAY_HZ);
      expect(edges.at(-1)).toBe(MAX_DISPLAY_HZ);

      for (let i = 1; i < edges.length; i++) {
        expect(edges[i]!).toBeGreaterThan(edges[i - 1]!);
      }

      const firstRatio = edges[1]! / edges[0]!;
      for (let i = 1; i < edges.length; i++) {
        const ratio = edges[i]! / edges[i - 1]!;
        expect(ratio).toBeCloseTo(firstRatio, 6);
      }
    });

    it('throws a RangeError naming the received value for a non-positive-integer bar count', () => {
      expect(() => barEdgesHz(0)).toThrow(RangeError);
      expect(() => barEdgesHz(-1)).toThrow(RangeError);
      expect(() => barEdgesHz(3.5)).toThrow(RangeError);
      expect(() => barEdgesHz(3.5)).toThrow(/3\.5/);
    });
  });

  describe('hzToFraction', () => {
    it('maps the floor to 0, the ceiling to 1, and the geometric midpoint to 0.5, strictly increasing across the range', () => {
      expect(hzToFraction(MIN_DISPLAY_HZ)).toBe(0);
      expect(hzToFraction(MAX_DISPLAY_HZ)).toBe(1);

      const geometricMidpoint = Math.sqrt(MIN_DISPLAY_HZ * MAX_DISPLAY_HZ);
      expect(hzToFraction(geometricMidpoint)).toBeCloseTo(0.5, 10);

      let previous = hzToFraction(MIN_DISPLAY_HZ);
      for (const hz of [50, 100, 500, 1000, 5000, 10000, MAX_DISPLAY_HZ]) {
        const fraction = hzToFraction(hz);
        expect(fraction).toBeGreaterThan(previous);
        previous = fraction;
      }
    });

    it('clamps rather than returning a non-finite value, for zero, negative, non-finite and above-ceiling inputs', () => {
      for (const hz of [0, -5, -1000, MAX_DISPLAY_HZ + 1000, 48000, NaN, Infinity, -Infinity]) {
        const fraction = hzToFraction(hz);
        expect(Number.isFinite(fraction)).toBe(true);
        expect(fraction).toBeGreaterThanOrEqual(0);
        expect(fraction).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('binIndexForHz', () => {
    it('always returns an integer within 0..binCount - 1, at, below and above both ends of the display range', () => {
      const hzValues = [0, -100, MIN_DISPLAY_HZ, MIN_DISPLAY_HZ - 10, MAX_DISPLAY_HZ, MAX_DISPLAY_HZ + 5000, 1000];

      for (const hz of hzValues) {
        const index = binIndexForHz(hz, SAMPLE_RATE, FFT_SIZE, BIN_COUNT);
        expect(Number.isInteger(index)).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThanOrEqual(BIN_COUNT - 1);
      }
    });

    it('returns 0 for a sample rate of zero, rather than a non-finite index', () => {
      expect(binIndexForHz(1000, 0, FFT_SIZE, BIN_COUNT)).toBe(0);
      expect(binIndexForHz(1000, -1, FFT_SIZE, BIN_COUNT)).toBe(0);
      expect(binIndexForHz(1000, NaN, FFT_SIZE, BIN_COUNT)).toBe(0);
    });

    it('caps frequencies above Nyquist to sampleRate / 2 before computing the index', () => {
      const sampleRate = 32000;
      const nyquistHz = sampleRate / 2;
      expect(binIndexForHz(MAX_DISPLAY_HZ, sampleRate, FFT_SIZE, BIN_COUNT)).toBe(
        binIndexForHz(nyquistHz, sampleRate, FFT_SIZE, BIN_COUNT),
      );
    });
  });

  describe('buildBarBinRanges', () => {
    it('returns null for a sample rate that is zero, negative or non-finite', () => {
      expect(buildBarBinRanges(0, FFT_SIZE, BIN_COUNT, SPECTRUM_BAR_COUNT)).toBeNull();
      expect(buildBarBinRanges(-1, FFT_SIZE, BIN_COUNT, SPECTRUM_BAR_COUNT)).toBeNull();
      expect(buildBarBinRanges(NaN, FFT_SIZE, BIN_COUNT, SPECTRUM_BAR_COUNT)).toBeNull();
    });

    it('returns exactly SPECTRUM_BAR_COUNT ranges for a valid 44100 sample rate, satisfying every band invariant as a property over the whole list', () => {
      const ranges = buildBarBinRanges(SAMPLE_RATE, FFT_SIZE, BIN_COUNT, SPECTRUM_BAR_COUNT);
      expect(ranges).not.toBeNull();
      const list = ranges!;

      expect(list.length).toBe(SPECTRUM_BAR_COUNT);

      // Invariants asserted over the whole list, not a hardcoded index
      // table — these hold for any bar-count/display-range choice, so a
      // future change to either does not require rewriting this proof.
      for (const range of list) {
        // No range starts at the DC bin.
        expect(range.startBin).not.toBe(0);
        expect(range.startBin).toBeGreaterThanOrEqual(1);
        // Every band covers at least one bin.
        expect(range.startBin).toBeLessThanOrEqual(range.endBin);
        // Every bin index lies within the valid bin range.
        expect(range.startBin).toBeLessThanOrEqual(BIN_COUNT - 1);
        expect(range.endBin).toBeLessThanOrEqual(BIN_COUNT - 1);
      }

      // Non-decreasing across the list.
      for (let i = 1; i < list.length; i++) {
        expect(list[i]!.startBin).toBeGreaterThanOrEqual(list[i - 1]!.startBin);
      }
    });

    it('holds the same invariants for a different bar count, proving the properties are not tied to SPECTRUM_BAR_COUNT specifically', () => {
      const list = buildBarBinRanges(SAMPLE_RATE, FFT_SIZE, BIN_COUNT, 16)!;
      expect(list.length).toBe(16);
      for (const range of list) {
        expect(range.startBin).toBeGreaterThanOrEqual(1);
        expect(range.startBin).toBeLessThanOrEqual(range.endBin);
        expect(range.endBin).toBeLessThanOrEqual(BIN_COUNT - 1);
      }
    });

    it('leaves bands above Nyquist empty instead of mapping them onto the final FFT bin', () => {
      const sampleRate = 32000;
      const nyquistHz = sampleRate / 2;
      const edges = barEdgesHz(SPECTRUM_BAR_COUNT);
      const list = buildBarBinRanges(sampleRate, FFT_SIZE, BIN_COUNT, SPECTRUM_BAR_COUNT)!;
      expect(list.length).toBe(SPECTRUM_BAR_COUNT);

      let sawEmpty = false;
      for (let i = 0; i < SPECTRUM_BAR_COUNT; i++) {
        const range = list[i]!;
        if (edges[i]! >= nyquistHz) {
          sawEmpty = true;
          expect(range.startBin).toBeGreaterThan(range.endBin);
        } else {
          expect(range.startBin).toBeLessThanOrEqual(range.endBin);
          expect(range.endBin).toBeLessThanOrEqual(BIN_COUNT - 1);
        }
      }
      expect(sawEmpty).toBe(true);
    });
  });

  describe('formatTickLabel', () => {
    it('formats 100 as "100 Hz", 1000 as "1 kHz" and 10000 as "10 kHz"', () => {
      expect(formatTickLabel(100)).toBe('100 Hz');
      expect(formatTickLabel(1000)).toBe('1 kHz');
      expect(formatTickLabel(10000)).toBe('10 kHz');
    });
  });

  describe('AXIS_TICK_HZ', () => {
    it('is a frozen array of exactly [100, 1000, 10000]', () => {
      expect(AXIS_TICK_HZ).toEqual([100, 1000, 10000]);
      expect(Object.isFrozen(AXIS_TICK_HZ)).toBe(true);
    });
  });
});
