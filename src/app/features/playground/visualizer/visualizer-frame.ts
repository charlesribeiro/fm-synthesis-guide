import type { CanvasRenderingContext2DLike } from '../../../core/browser/canvas-2d.token';
import { AXIS_TICK_HZ, formatTickLabel, hzToFraction, type BarBinRange } from './spectrum-scale';

/**
 * Pure Canvas 2D draw module (10-01-PLAN.md, Task 1, group 8). This module
 * imports no symbol from Angular and no symbol from the audio layer — that
 * is a structural guarantee, not a convention: a module that cannot see a
 * reactive primitive cannot write one, which is what makes this phase's
 * off-the-change-detection-path requirement (VIZ-01) a property of the
 * architecture instead of a discipline the next editor has to remember.
 */

/** Canvas dimensions in CSS pixels. */
export interface CanvasGeometry {
  readonly width: number;
  readonly height: number;
}

export const OSCILLOSCOPE_CSS_WIDTH = 640;
export const OSCILLOSCOPE_CSS_HEIGHT = 160;

export const SPECTRUM_CSS_WIDTH = 640;
export const SPECTRUM_CSS_HEIGHT = 200;
/** The strip along the bottom of the spectrum canvas reserved for the
 * frequency axis's drawn tick labels. The plot height available to bars is
 * `geometry.height - SPECTRUM_AXIS_BAND_HEIGHT` — stated here so a future
 * change to either constant cannot leave bars drawing over their own
 * labels. */
export const SPECTRUM_AXIS_BAND_HEIGHT = 18;

// A 2D drawing context cannot read CSS custom properties, so mirroring the
// design tokens' hex values here is unavoidable — each constant below names
// the token in `src/styles/_tokens.scss` whose value it mirrors.
/** Mirrors `--color-accent`. */
export const WAVEFORM_STROKE_COLOR = '#5eb1ff';
/** Mirrors `--color-border`. */
export const AXIS_LINE_COLOR = '#2b303b';
/** Mirrors `--color-surface`. */
export const CANVAS_BACKGROUND_COLOR = '#14171c';
/** Mirrors `--color-accent`. */
export const BAR_FILL_COLOR = '#5eb1ff';
/** Mirrors `--color-text-muted`. */
export const AXIS_LABEL_COLOR = '#a7aeba';
export const AXIS_LABEL_FONT = '11px sans-serif';

/** Horizontal gap, in CSS pixels, left between adjacent bars so the
 * spectrum reads as discrete columns rather than a solid block (D-07). */
const BAR_GAP = 2;

/** The byte value `AnalyserNode.getByteTimeDomainData` reports at the zero
 * crossing — the vertical midpoint of the drawn trace. */
const CENTER_BYTE = 128;
/** Half the byte range either side of `CENTER_BYTE` — the amplitude scale a
 * byte's deviation from center is measured against. */
const BYTE_AMPLITUDE_SCALE = 128;

/** Maps a time-domain byte to a y-coordinate: `CENTER_BYTE` lands exactly on
 * the vertical midpoint; the byte range 0-255 spans the full canvas height,
 * inverted so larger byte values sit higher (smaller y). */
function yForByte(byte: number, height: number): number {
  return height / 2 - ((byte - CENTER_BYTE) / BYTE_AMPLITUDE_SCALE) * (height / 2);
}

/** Maps a data index to an x-coordinate spanning the full canvas width. */
function xForIndex(index: number, dataLength: number, width: number): number {
  return dataLength > 1 ? (index / (dataLength - 1)) * width : 0;
}

function drawMidpointAxisLine(ctx: CanvasRenderingContext2DLike, geometry: CanvasGeometry): void {
  const midY = geometry.height / 2;
  ctx.strokeStyle = AXIS_LINE_COLOR;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(geometry.width, midY);
  ctx.stroke();
}

/** Draws the silent/rest state: background fill plus the flat midpoint axis
 * line, and no per-sample path points. */
export function drawFlatBaseline(ctx: CanvasRenderingContext2DLike, geometry: CanvasGeometry): void {
  ctx.fillStyle = CANVAS_BACKGROUND_COLOR;
  ctx.fillRect(0, 0, geometry.width, geometry.height);
  drawMidpointAxisLine(ctx, geometry);
}

/** Draws a real time-domain trace: background fill, the flat midpoint axis
 * line, then one continuous stroked path walking every entry of `data`.
 * Allocates nothing. */
export function drawOscilloscope(
  ctx: CanvasRenderingContext2DLike,
  data: Uint8Array,
  geometry: CanvasGeometry,
): void {
  ctx.fillStyle = CANVAS_BACKGROUND_COLOR;
  ctx.fillRect(0, 0, geometry.width, geometry.height);
  drawMidpointAxisLine(ctx, geometry);

  ctx.strokeStyle = WAVEFORM_STROKE_COLOR;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = xForIndex(i, data.length, geometry.width);
    const y = yForByte(data[i]!, geometry.height);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

/** The plot height available to bars — the geometry height minus the
 * bottom axis band reserved for tick labels (see `SPECTRUM_AXIS_BAND_HEIGHT`
 * doc). */
function spectrumPlotHeight(geometry: CanvasGeometry): number {
  return geometry.height - SPECTRUM_AXIS_BAND_HEIGHT;
}

/** Draws the three frequency-axis tick labels (`AXIS_TICK_HZ`), positioned
 * by the same logarithmic mapping (`hzToFraction`) the bars use — a label
 * and the bar beneath it are placed by one mapping and cannot disagree
 * (D-06). Save/restore around the alignment and font changes so this
 * function cannot leave state behind for the next draw. */
export function drawFrequencyAxis(ctx: CanvasRenderingContext2DLike, geometry: CanvasGeometry): void {
  ctx.save();
  ctx.fillStyle = AXIS_LABEL_COLOR;
  ctx.font = AXIS_LABEL_FONT;
  ctx.textAlign = 'center';

  const labelBaselineY = geometry.height - SPECTRUM_AXIS_BAND_HEIGHT / 2;
  for (const hz of AXIS_TICK_HZ) {
    const x = geometry.width * hzToFraction(hz);
    ctx.fillText(formatTickLabel(hz), x, labelBaselineY);
  }

  ctx.restore();
}

/** Draws the spectrum's rest state: background fill plus the axis band with
 * its labels, and no bar rectangles. This is what makes the axis labels
 * visible before a note is ever played, and is the draw the component calls
 * whenever the tap reports no live data or the bar-bin ranges are not yet
 * built. */
export function drawEmptySpectrum(ctx: CanvasRenderingContext2DLike, geometry: CanvasGeometry): void {
  ctx.fillStyle = CANVAS_BACKGROUND_COLOR;
  ctx.fillRect(0, 0, geometry.width, geometry.height);
  drawFrequencyAxis(ctx, geometry);
}

/**
 * Draws the spectrum as discrete bars: background fill, then exactly one
 * filled rectangle per entry in `ranges`, then the frequency axis. Each
 * bar's height is the maximum byte across its band's inclusive bin span in
 * `data` — not the mean — over 255, times the available plot height, so a
 * wide high-frequency band covering many bins does not read as artificially
 * quiet next to a narrow low-frequency band covering one. A bin index at or
 * beyond `data`'s length contributes zero to the maximum rather than
 * producing a non-finite result. Allocates nothing: the maximum is
 * accumulated in a local, never a per-band array.
 */
export function drawSpectrum(
  ctx: CanvasRenderingContext2DLike,
  data: Uint8Array,
  ranges: readonly BarBinRange[],
  geometry: CanvasGeometry,
): void {
  ctx.fillStyle = CANVAS_BACKGROUND_COLOR;
  ctx.fillRect(0, 0, geometry.width, geometry.height);

  const plotHeight = spectrumPlotHeight(geometry);
  const slotWidth = ranges.length > 0 ? geometry.width / ranges.length : 0;

  ctx.fillStyle = BAR_FILL_COLOR;
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]!;
    let maxByte = 0;
    for (let bin = range.startBin; bin <= range.endBin; bin++) {
      const byte = bin < data.length ? data[bin]! : 0;
      if (byte > maxByte) {
        maxByte = byte;
      }
    }

    const barHeight = (maxByte / 255) * plotHeight;
    const slotX = i * slotWidth;
    const barWidth = Math.max(0, slotWidth - BAR_GAP);
    const x = slotX + BAR_GAP / 2;
    const y = plotHeight - barHeight;
    ctx.fillRect(x, y, barWidth, barHeight);
  }

  drawFrequencyAxis(ctx, geometry);
}
