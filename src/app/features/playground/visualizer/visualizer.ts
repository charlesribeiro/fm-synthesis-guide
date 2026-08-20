import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import {
  ANALYSER_FFT_SIZE,
  ANALYSER_FREQUENCY_BIN_COUNT,
  hasAnalysisTap,
  type AnalysisTap,
  type SynthEngine,
} from '../../../core/audio/synth-engine';
import { SYNTH_ENGINE } from '../../../core/audio/synth-engine.token';
import { ANIMATION_FRAME_SCHEDULER } from '../../../core/browser/animation-frame.token';
import { CANVAS_2D_CONTEXT_FACTORY } from '../../../core/browser/canvas-2d.token';
import { MotionPreference } from '../../../core/browser/motion-preference';
import { SPECTRUM_BAR_COUNT, buildBarBinRanges, type BarBinRange } from './spectrum-scale';
import {
  OSCILLOSCOPE_CSS_HEIGHT,
  OSCILLOSCOPE_CSS_WIDTH,
  SPECTRUM_CSS_HEIGHT,
  SPECTRUM_CSS_WIDTH,
  drawEmptySpectrum,
  drawFlatBaseline,
  drawOscilloscope,
  drawSpectrum,
  type CanvasGeometry,
} from './visualizer-frame';

/** Defensive `devicePixelRatio` read (Pitfall 4): absent, non-finite, or
 * non-positive values would otherwise produce `NaN`/degenerate canvas
 * dimensions and a permanently blank display. */
function resolveDevicePixelRatio(): number {
  const ratio = typeof window === 'undefined' ? undefined : window.devicePixelRatio;
  return typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

/** Reduced-motion repaint interval, in milliseconds — roughly ten repaints
 * a second. The display is throttled rather than frozen when reduced
 * motion is requested: the picture is the pedagogical content, so removing
 * it entirely would remove the feature for the users the rule exists to
 * protect, while this repaint rate removes the rapid flicker the rule is
 * actually about (CLAUDE.md: respect reduced motion). */
export const REDUCED_MOTION_FRAME_INTERVAL_MS = 100;

/**
 * Embedded oscilloscope-and-spectrum region (10-01-PLAN.md Task 1,
 * 10-02-PLAN.md Task 3, D-01/D-03/D-04). Read-only with respect to the
 * engine: it never calls `initialize`, `noteOn`, `noteOff`, `allNotesOff`,
 * `destroy`, or constructs an audio context of its own — the gesture gate
 * and single-context guarantee every prior audio phase established stay
 * intact (T-10-06).
 *
 * The per-frame draw loop touches no Angular signal or template-bound
 * field — `visualizer-frame.ts` imports nothing from Angular, and the
 * animation-frame callback below reads only the analysis tap, the
 * motion-preference signal (read imperatively, which creates no reactive
 * dependency because the callback is not a reactive context) and plain
 * instance fields, never `this.status`/`this.description`/
 * `this.spectrumDescription`.
 */
@Component({
  selector: 'app-visualizer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './visualizer.html',
  styleUrl: './visualizer.scss',
})
export class Visualizer {
  private readonly engine = inject(SYNTH_ENGINE);
  private readonly scheduler = inject(ANIMATION_FRAME_SCHEDULER);
  private readonly contextFactory = inject(CANVAS_2D_CONTEXT_FACTORY);
  private readonly motionPreference = inject(MotionPreference);
  private readonly destroyRef = inject(DestroyRef);

  /** The engine's own lifecycle status — never re-derived, always read through. */
  protected readonly status = this.engine.status;

  /** Changes only when `status` changes — never updated from the frame
   * callback. */
  protected readonly description = computed(() =>
    this.status() === 'ready'
      ? 'The trace shows the live waveform of the sounding note.'
      : 'The display is flat because no audio is running.',
  );

  /** Changes only when `status` changes — never updated from the frame
   * callback. */
  protected readonly spectrumDescription = computed(() =>
    this.status() === 'ready'
      ? 'The bars show the loudness of the sounding note across a logarithmic frequency range from 20 Hz to 20 kHz, labelled at 100 Hz, 1 kHz and 10 kHz.'
      : 'The bars are flat because no audio is running.',
  );

  /** Resolved once via the capability guard: the narrowed engine when it
   * offers a tap, `null` otherwise (the reference fallback engine is not
   * given a tap — `hasAnalysisTap.ts` doc). */
  private readonly tap: (SynthEngine & AnalysisTap) | null = hasAnalysisTap(this.engine) ? this.engine : null;

  private readonly oscilloscopeCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('oscilloscope');
  private readonly spectrumCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('spectrum');

  /** Sized from `ANALYSER_FFT_SIZE`, allocated once as an instance field —
   * never inside the frame loop. */
  private readonly timeDomainBuffer = new Uint8Array(ANALYSER_FFT_SIZE);
  /** A separate, `ANALYSER_FREQUENCY_BIN_COUNT`-length buffer (Pitfall 5) —
   * never the same object as `timeDomainBuffer`, never passed to the other
   * read method. Field names keep the two sizes unambiguous at every use
   * site. */
  private readonly frequencyBuffer = new Uint8Array(ANALYSER_FREQUENCY_BIN_COUNT);

  private oscilloscopeGeometry: CanvasGeometry = { width: OSCILLOSCOPE_CSS_WIDTH, height: OSCILLOSCOPE_CSS_HEIGHT };
  private spectrumGeometry: CanvasGeometry = { width: SPECTRUM_CSS_WIDTH, height: SPECTRUM_CSS_HEIGHT };

  /** Set once the rest baseline has been painted, so a present tap with no
   * live note never spins repainting an unchanged flat line. A missing tap
   * never starts the loop. */
  private hasDrawnRestState = false;

  /** Exactly one outstanding request at a time — overwritten every frame,
   * which is what makes "exactly one request outstanding" checkable. */
  private frameHandle: number | null = null;

  /** `null` until the engine reports a positive sample rate; built once and
   * reused unchanged on every subsequent frame — `buildBarBinRanges` is not
   * called again once this holds a non-null list. */
  private barBinRanges: readonly BarBinRange[] | null = null;

  /** Timestamp of the last repaint under the reduced-motion throttle,
   * initialised so the first tick always repaints. */
  private lastRepaintTimestamp = -Infinity;

  constructor() {
    afterNextRender(() => {
      const oscilloscopeElement = this.oscilloscopeCanvas().nativeElement;
      const spectrumElement = this.spectrumCanvas().nativeElement;
      const oscilloscopeCtx = this.contextFactory(oscilloscopeElement);
      const spectrumCtx = this.contextFactory(spectrumElement);
      if (oscilloscopeCtx === null || spectrumCtx === null) {
        // A runtime with no 2D drawing available renders the empty canvases
        // and the text descriptions and stays functional — no loop starts.
        // All-or-nothing: never run a half-live display.
        return;
      }

      const ratio = resolveDevicePixelRatio();

      // Canvas backing-store sizing (Pitfall 4): a detached or
      // unlaid-out element reports a zero clientWidth, so fall back to the
      // nominal width constant rather than sizing to zero.
      const oscilloscopeCssWidth = oscilloscopeElement.clientWidth || OSCILLOSCOPE_CSS_WIDTH;
      oscilloscopeElement.width = oscilloscopeCssWidth * ratio;
      oscilloscopeElement.height = OSCILLOSCOPE_CSS_HEIGHT * ratio;
      oscilloscopeCtx.scale(ratio, ratio);
      this.oscilloscopeGeometry = { width: oscilloscopeCssWidth, height: OSCILLOSCOPE_CSS_HEIGHT };

      const spectrumCssWidth = spectrumElement.clientWidth || SPECTRUM_CSS_WIDTH;
      spectrumElement.width = spectrumCssWidth * ratio;
      spectrumElement.height = SPECTRUM_CSS_HEIGHT * ratio;
      spectrumCtx.scale(ratio, ratio);
      this.spectrumGeometry = { width: spectrumCssWidth, height: SPECTRUM_CSS_HEIGHT };

      drawFlatBaseline(oscilloscopeCtx, this.oscilloscopeGeometry);
      drawEmptySpectrum(spectrumCtx, this.spectrumGeometry);

      if (this.tap === null) {
        // Capability is resolved once: a missing tap cannot appear later.
        // Rest is already on the canvas; do not schedule a loop that would
        // only poll a tap that does not exist.
        this.hasDrawnRestState = true;
        return;
      }

      const onFrame = (timestampMs: number): void => {
        // Reduced-motion gate: read imperatively — a signal read outside a
        // reactive context creates no dependency and schedules no change
        // detection. Skips reading and drawing entirely on a throttled
        // tick, but still re-requests a frame every tick.
        if (
          this.motionPreference.prefersReducedMotion() &&
          timestampMs - this.lastRepaintTimestamp < REDUCED_MOTION_FRAME_INTERVAL_MS
        ) {
          if (this.tap !== null) {
            this.frameHandle = this.scheduler.request(onFrame);
          }
          return;
        }
        this.lastRepaintTimestamp = timestampMs;

        const readOk = this.tap !== null && this.tap.readTimeDomainInto(this.timeDomainBuffer);
        if (this.tap !== null) {
          this.tap.readFrequencyInto(this.frequencyBuffer);
        }

        if (this.barBinRanges === null && this.tap !== null) {
          const sampleRate = this.tap.getAnalysisSampleRate();
          this.barBinRanges = buildBarBinRanges(
            sampleRate,
            ANALYSER_FFT_SIZE,
            ANALYSER_FREQUENCY_BIN_COUNT,
            SPECTRUM_BAR_COUNT,
          );
        }

        if (!readOk) {
          if (!this.hasDrawnRestState) {
            drawFlatBaseline(oscilloscopeCtx, this.oscilloscopeGeometry);
            drawEmptySpectrum(spectrumCtx, this.spectrumGeometry);
            this.hasDrawnRestState = true;
          }
        } else {
          this.hasDrawnRestState = false;
          drawOscilloscope(oscilloscopeCtx, this.timeDomainBuffer, this.oscilloscopeGeometry);
          if (this.barBinRanges !== null) {
            drawSpectrum(spectrumCtx, this.frequencyBuffer, this.barBinRanges, this.spectrumGeometry);
          } else {
            drawEmptySpectrum(spectrumCtx, this.spectrumGeometry);
          }
        }

        // Keep polling while a tap exists even if this frame had no live
        // note — a later noteOn must be seen. Never reschedule without a tap.
        if (this.tap !== null) {
          this.frameHandle = this.scheduler.request(onFrame);
        }
      };
      this.frameHandle = this.scheduler.request(onFrame);
    });

    this.destroyRef.onDestroy(() => {
      if (this.frameHandle !== null) {
        this.scheduler.cancel(this.frameHandle);
        this.frameHandle = null;
      }
    });
  }
}
