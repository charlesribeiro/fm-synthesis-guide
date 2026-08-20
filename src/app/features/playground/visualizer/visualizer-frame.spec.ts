import { FakeCanvas2dContext } from '../../../core/browser/testing/fake-canvas-2d-context';
import { AXIS_TICK_HZ, hzToFraction, type BarBinRange } from './spectrum-scale';
import {
  AXIS_LINE_COLOR,
  CANVAS_BACKGROUND_COLOR,
  SPECTRUM_AXIS_BAND_HEIGHT,
  SPECTRUM_CSS_HEIGHT,
  SPECTRUM_CSS_WIDTH,
  WAVEFORM_STROKE_COLOR,
  type CanvasGeometry,
  drawEmptySpectrum,
  drawFlatBaseline,
  drawFrequencyAxis,
  drawOscilloscope,
  drawSpectrum,
} from './visualizer-frame';

const GEOMETRY: CanvasGeometry = { width: 640, height: 160 };
const MID_Y = GEOMETRY.height / 2;
const SPECTRUM_GEOMETRY: CanvasGeometry = { width: SPECTRUM_CSS_WIDTH, height: SPECTRUM_CSS_HEIGHT };

/** Builds a simple list of contiguous single-bin ranges, one per entry in
 * `bands` — enough surface for `drawSpectrum`'s draw-shape assertions
 * without needing a real `buildBarBinRanges` call. */
function rangesFor(bandCount: number, startBin = 1): readonly BarBinRange[] {
  return Array.from({ length: bandCount }, (_, i) => ({ startBin: startBin + i, endBin: startBin + i }));
}

describe('visualizer-frame (pure Canvas 2D draw module)', () => {
  // The structural guarantee that this module imports nothing from
  // Angular or the audio layer (so it cannot write a signal or reach the
  // engine) is enforced at the `<verify>` layer by
  // `grep -cE "^import .*@angular/core" visualizer-frame.ts` outputting 0
  // (10-01-PLAN.md acceptance criteria) — `@types/node` is not installed in
  // this project, so a spec-level source-text assertion isn't available.

  describe('drawFlatBaseline', () => {
    it('fills the background then strokes a single horizontal line at the vertical midpoint, with no per-sample path points', () => {
      const ctx = new FakeCanvas2dContext();

      drawFlatBaseline(ctx, GEOMETRY);

      expect(ctx.calls[0]).toEqual({ method: 'fillRect', args: [0, 0, GEOMETRY.width, GEOMETRY.height] });
      expect(ctx.fillStyle).toBe(CANVAS_BACKGROUND_COLOR);
      expect(ctx.callCount('beginPath')).toBe(1);
      expect(ctx.callCount('stroke')).toBe(1);
      expect(ctx.argsFor('moveTo')).toEqual([[0, MID_Y]]);
      expect(ctx.argsFor('lineTo')).toEqual([[GEOMETRY.width, MID_Y]]);
      expect(ctx.strokeStyle).toBe(AXIS_LINE_COLOR);
    });
  });

  describe('drawOscilloscope', () => {
    it('an all-128 buffer strokes a waveform trace whose every y-coordinate is the vertical midpoint', () => {
      const ctx = new FakeCanvas2dContext();
      const data = new Uint8Array(16).fill(128);

      drawOscilloscope(ctx, data, GEOMETRY);

      // Two beginPath/stroke pairs: the shared midpoint axis line (also
      // drawn by drawFlatBaseline), then the waveform trace itself.
      expect(ctx.callCount('beginPath')).toBe(2);
      expect(ctx.callCount('stroke')).toBe(2);
      expect(ctx.strokeStyle).toBe(WAVEFORM_STROKE_COLOR);

      // The trace-specific path points: one moveTo (first sample) plus
      // (data.length - 1) lineTo calls, minus the axis line's own one
      // moveTo/lineTo pair — exactly data.length points total.
      const traceMoveTo = ctx.argsFor('moveTo').slice(1);
      const traceLineTo = ctx.argsFor('lineTo').slice(1);
      expect(traceMoveTo.length + traceLineTo.length).toBe(data.length);
      for (const [, y] of [...traceMoveTo, ...traceLineTo]) {
        expect(y).toBe(MID_Y);
      }
    });

    it('a buffer spanning 0 to 255 produces y-coordinates spanning the full canvas height, with byte 255 higher on screen than byte 0', () => {
      const ctx = new FakeCanvas2dContext();
      const data = Uint8Array.from({ length: 256 }, (_, i) => i);

      drawOscilloscope(ctx, data, GEOMETRY);

      const traceMoveTo = ctx.argsFor('moveTo').slice(1);
      const traceLineTo = ctx.argsFor('lineTo').slice(1);
      const yValues = [...traceMoveTo, ...traceLineTo].map(([, y]) => y as number);

      for (const y of yValues) {
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(GEOMETRY.height);
      }
      const yForByte0 = yValues[0]!;
      const yForByte255 = yValues[255]!;
      // "Higher on screen" means a smaller y-coordinate (canvas y grows
      // downward).
      expect(yForByte255).toBeLessThan(yForByte0);
      expect(Math.max(...yValues) - Math.min(...yValues)).toBeGreaterThan(GEOMETRY.height * 0.9);
    });

    it('x-coordinates span the full canvas width in index order', () => {
      const ctx = new FakeCanvas2dContext();
      const data = new Uint8Array(8).fill(128);

      drawOscilloscope(ctx, data, GEOMETRY);

      const traceMoveTo = ctx.argsFor('moveTo').slice(1);
      const traceLineTo = ctx.argsFor('lineTo').slice(1);
      const xValues = [...traceMoveTo, ...traceLineTo].map(([x]) => x as number);

      expect(xValues[0]).toBe(0);
      expect(xValues.at(-1)).toBe(GEOMETRY.width);
      for (let i = 1; i < xValues.length; i++) {
        expect(xValues[i]).toBeGreaterThan(xValues[i - 1]!);
      }
    });

    it('a zero-length buffer produces the background fill and axis line and no path points, and does not throw (10-01-PLAN.md Task 2)', () => {
      const ctx = new FakeCanvas2dContext();
      const data = new Uint8Array(0);

      expect(() => drawOscilloscope(ctx, data, GEOMETRY)).not.toThrow();

      expect(ctx.callCount('fillRect')).toBe(1);
      // One beginPath/stroke pair for the shared midpoint axis line; the
      // trace's own beginPath/stroke still runs (it always does, even for
      // zero samples), but it emits zero moveTo/lineTo path points.
      expect(ctx.callCount('beginPath')).toBe(2);
      expect(ctx.callCount('stroke')).toBe(2);
      const traceMoveTo = ctx.argsFor('moveTo').slice(1);
      const traceLineTo = ctx.argsFor('lineTo').slice(1);
      expect(traceMoveTo.length + traceLineTo.length).toBe(0);
    });
  });

  describe('allocation discipline (10-01-PLAN.md Task 2 — "allocates nothing")', () => {
    /** Structural proxy for "allocates nothing": calling the same pure draw
     * function twice with identical arguments must record structurally
     * identical call sequences, and the total call count for a given
     * buffer length must be a fixed function of that length rather than
     * growing across repeated calls — a function that allocated or
     * accumulated per-call state would instead grow its recorded call
     * count call over call. */
    it('drawOscilloscope called twice with the same arguments records structurally identical call sequences, and the call count for a given buffer length never grows across repeated calls', () => {
      const data = new Uint8Array(12).fill(64);

      const firstCtx = new FakeCanvas2dContext();
      drawOscilloscope(firstCtx, data, GEOMETRY);
      const firstCallCount = firstCtx.calls.length;

      const secondCtx = new FakeCanvas2dContext();
      drawOscilloscope(secondCtx, data, GEOMETRY);

      expect(secondCtx.calls).toEqual(firstCtx.calls);
      expect(secondCtx.calls.length).toBe(firstCallCount);

      // Calling it a third time against the SAME context (rather than a
      // fresh one) proves the function's own call count per invocation is
      // fixed — the context's cumulative call log grows by exactly the
      // same fixed amount each time, never more.
      const beforeThird = secondCtx.calls.length;
      drawOscilloscope(secondCtx, data, GEOMETRY);
      expect(secondCtx.calls.length - beforeThird).toBe(firstCallCount);
    });

    it('drawFlatBaseline called twice with the same arguments records structurally identical call sequences, and the call count is a fixed function of geometry alone (no buffer, no growth across calls)', () => {
      const firstCtx = new FakeCanvas2dContext();
      drawFlatBaseline(firstCtx, GEOMETRY);
      const firstCallCount = firstCtx.calls.length;

      const secondCtx = new FakeCanvas2dContext();
      drawFlatBaseline(secondCtx, GEOMETRY);

      expect(secondCtx.calls).toEqual(firstCtx.calls);
      expect(secondCtx.calls.length).toBe(firstCallCount);

      const beforeThird = secondCtx.calls.length;
      drawFlatBaseline(secondCtx, GEOMETRY);
      expect(secondCtx.calls.length - beforeThird).toBe(firstCallCount);
    });
  });

  describe('drawFrequencyAxis (10-02-PLAN.md Task 2)', () => {
    it('emits exactly three fillText calls, in tick order, whose text and x-position match formatTickLabel/hzToFraction', () => {
      const ctx = new FakeCanvas2dContext();

      drawFrequencyAxis(ctx, SPECTRUM_GEOMETRY);

      expect(ctx.callCount('fillText')).toBe(3);
      const calls = ctx.argsFor('fillText');
      expect(calls.map((args) => args[0])).toEqual(['100 Hz', '1 kHz', '10 kHz']);

      // x-positions ordered the same way AXIS_TICK_HZ is ordered.
      const xValues = calls.map((args) => args[1] as number);
      for (let i = 1; i < xValues.length; i++) {
        expect(xValues[i]!).toBeGreaterThan(xValues[i - 1]!);
      }

      // The 1 kHz label sits at the position hzToFraction implies, to
      // within one pixel — labels and bars are placed by the same mapping.
      const oneKhzIndex = AXIS_TICK_HZ.indexOf(1000);
      const oneKhzX = xValues[oneKhzIndex]!;
      expect(Math.abs(oneKhzX - SPECTRUM_CSS_WIDTH * hzToFraction(1000))).toBeLessThanOrEqual(1);
    });

    it('saves and restores context state around the alignment/font changes, leaving nothing behind for the next draw', () => {
      const ctx = new FakeCanvas2dContext();

      drawFrequencyAxis(ctx, SPECTRUM_GEOMETRY);

      expect(ctx.callCount('save')).toBe(1);
      expect(ctx.callCount('restore')).toBe(1);
    });
  });

  describe('drawSpectrum (10-02-PLAN.md Task 2)', () => {
    it('fills the background once, then emits exactly one filled rectangle per range, then draws the axis', () => {
      const ctx = new FakeCanvas2dContext();
      const ranges = rangesFor(32);
      const data = new Uint8Array(1024).fill(128);

      drawSpectrum(ctx, data, ranges, SPECTRUM_GEOMETRY);

      // fillRect: 1 background + 32 bars.
      expect(ctx.callCount('fillRect')).toBe(1 + ranges.length);
      expect(ctx.calls[0]).toEqual({
        method: 'fillRect',
        args: [0, 0, SPECTRUM_GEOMETRY.width, SPECTRUM_GEOMETRY.height],
      });
      expect(ctx.callCount('fillText')).toBe(3);
    });

    it('every bar rectangle has a finite, non-negative width and lies fully within the geometry width, with non-decreasing x-positions', () => {
      const ctx = new FakeCanvas2dContext();
      const ranges = rangesFor(32);
      const data = new Uint8Array(1024).fill(200);

      drawSpectrum(ctx, data, ranges, SPECTRUM_GEOMETRY);

      const barRects = ctx.argsFor('fillRect').slice(1); // drop the background fill
      let previousX = -Infinity;
      for (const [x, , w] of barRects) {
        const xValue = x as number;
        const widthValue = w as number;
        expect(Number.isFinite(xValue)).toBe(true);
        expect(Number.isFinite(widthValue)).toBe(true);
        expect(widthValue).toBeGreaterThanOrEqual(0);
        expect(xValue).toBeGreaterThanOrEqual(0);
        expect(xValue + widthValue).toBeLessThanOrEqual(SPECTRUM_GEOMETRY.width + 0.001);
        expect(xValue).toBeGreaterThanOrEqual(previousX);
        previousX = xValue;
      }
    });

    it('a band whose bins are all zero draws zero-height bar, and a band containing byte 255 reaches the full plot height', () => {
      const ctx = new FakeCanvas2dContext();
      const ranges: readonly BarBinRange[] = [
        { startBin: 1, endBin: 1 },
        { startBin: 2, endBin: 2 },
      ];
      const data = new Uint8Array(8);
      data[1] = 0;
      data[2] = 255;

      drawSpectrum(ctx, data, ranges, SPECTRUM_GEOMETRY);

      const barRects = ctx.argsFor('fillRect').slice(1);
      const plotHeight = SPECTRUM_GEOMETRY.height - SPECTRUM_AXIS_BAND_HEIGHT;
      const [, , , zeroHeight] = barRects[0]!;
      const [, , , fullHeight] = barRects[1]!;
      expect(zeroHeight).toBe(0);
      expect(fullHeight as number).toBeCloseTo(plotHeight, 5);
    });

    it('takes the maximum, not the mean, of a band: [0, 0, 255, 0] and [255] produce the same bar height', () => {
      const ctx = new FakeCanvas2dContext();
      const wideRange: readonly BarBinRange[] = [{ startBin: 1, endBin: 4 }];
      const wideData = new Uint8Array(8);
      wideData.set([0, 0, 255, 0], 1);
      drawSpectrum(ctx, wideData, wideRange, SPECTRUM_GEOMETRY);
      const [, , , wideHeight] = ctx.argsFor('fillRect').slice(1)[0]!;

      const narrowCtx = new FakeCanvas2dContext();
      const narrowRange: readonly BarBinRange[] = [{ startBin: 1, endBin: 1 }];
      const narrowData = new Uint8Array(8);
      narrowData.set([255], 1);
      drawSpectrum(narrowCtx, narrowData, narrowRange, SPECTRUM_GEOMETRY);
      const [, , , narrowHeight] = narrowCtx.argsFor('fillRect').slice(1)[0]!;

      expect(wideHeight).toBe(narrowHeight);
    });

    it('guards a bin index beyond the data length, contributing zero rather than throwing or producing a non-finite height', () => {
      const ctx = new FakeCanvas2dContext();
      const ranges: readonly BarBinRange[] = [{ startBin: 500, endBin: 500 }];
      const data = new Uint8Array(4);

      expect(() => drawSpectrum(ctx, data, ranges, SPECTRUM_GEOMETRY)).not.toThrow();
      const [, , , height] = ctx.argsFor('fillRect').slice(1)[0]!;
      expect(height).toBe(0);
    });
  });

  describe('drawEmptySpectrum (10-02-PLAN.md Task 2)', () => {
    it('fills the background and draws the axis with its labels, emitting zero bar rectangles', () => {
      const ctx = new FakeCanvas2dContext();

      drawEmptySpectrum(ctx, SPECTRUM_GEOMETRY);

      expect(ctx.callCount('fillRect')).toBe(1);
      expect(ctx.callCount('fillText')).toBe(3);
    });
  });

  describe('spectrum allocation discipline (10-02-PLAN.md Task 2 — "allocates nothing")', () => {
    it('drawSpectrum called twice with the same arguments records structurally identical call sequences, and the call count never grows across repeated calls', () => {
      const ranges = rangesFor(32);
      const data = new Uint8Array(1024).fill(90);

      const firstCtx = new FakeCanvas2dContext();
      drawSpectrum(firstCtx, data, ranges, SPECTRUM_GEOMETRY);
      const firstCallCount = firstCtx.calls.length;

      const secondCtx = new FakeCanvas2dContext();
      drawSpectrum(secondCtx, data, ranges, SPECTRUM_GEOMETRY);

      expect(secondCtx.calls).toEqual(firstCtx.calls);
      expect(secondCtx.calls.length).toBe(firstCallCount);

      const beforeThird = secondCtx.calls.length;
      drawSpectrum(secondCtx, data, ranges, SPECTRUM_GEOMETRY);
      expect(secondCtx.calls.length - beforeThird).toBe(firstCallCount);
    });
  });
});
