import type { Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AUDIO_CONTEXT_CTOR } from '../../../core/audio/audio-context.token';
import { AUDIO_WORKLET_NODE_CTOR } from '../../../core/audio/audio-worklet-node.token';
import {
  ANALYSER_FFT_SIZE,
  ANALYSER_FREQUENCY_BIN_COUNT,
  type SynthEngine,
} from '../../../core/audio/synth-engine';
import { SYNTH_ENGINE } from '../../../core/audio/synth-engine.token';
import { FakeAnalyserNode } from '../../../core/audio/testing/fake-audio-context';
import { FakeAudioWorkletContext, FakeAudioWorkletNode } from '../../../core/audio/testing/fake-audio-worklet-node';
import { ANIMATION_FRAME_SCHEDULER } from '../../../core/browser/animation-frame.token';
import { CANVAS_2D_CONTEXT_FACTORY } from '../../../core/browser/canvas-2d.token';
import { MATCH_MEDIA } from '../../../core/browser/motion-preference';
import { FakeAnimationFrameScheduler } from '../../../core/browser/testing/fake-animation-frame-scheduler';
import { FakeCanvas2dContext } from '../../../core/browser/testing/fake-canvas-2d-context';
import { AXIS_LINE_COLOR, WAVEFORM_STROKE_COLOR } from './visualizer-frame';
import { REDUCED_MOTION_FRAME_INTERVAL_MS, Visualizer } from './visualizer';

/** Minimal fake `MediaQueryList` (mirrors `motion-preference.spec.ts`'s
 * `FakeMediaQueryList`) — enough surface for `MotionPreference`, held at a
 * fixed `matches` value with no live toggling, which is all these tests
 * need. */
function fakeMatchMedia(matches: boolean): typeof window.matchMedia {
  return () =>
    ({
      matches,
      media: '',
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/** Provides `CANVAS_2D_CONTEXT_FACTORY` returning `null`, for the "no 2D
 * drawing context available" path (10-01-PLAN.md Task 2). Both canvases
 * must come back unavailable for the all-or-nothing posture to matter, so
 * a single always-null factory covers both acquisition calls. */
async function setupNullContextFactory(): Promise<{
  fixture: ComponentFixture<Visualizer>;
  scheduler: FakeAnimationFrameScheduler;
}> {
  FakeAudioWorkletContext.instances.length = 0;
  FakeAudioWorkletNode.instances.length = 0;
  const scheduler = new FakeAnimationFrameScheduler();

  await TestBed.configureTestingModule({
    imports: [Visualizer],
    providers: [
      { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioWorkletContext },
      { provide: AUDIO_WORKLET_NODE_CTOR, useValue: FakeAudioWorkletNode },
      { provide: ANIMATION_FRAME_SCHEDULER, useValue: scheduler },
      { provide: CANVAS_2D_CONTEXT_FACTORY, useValue: () => null },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Visualizer);
  await fixture.whenStable();

  return { fixture, scheduler };
}

/** Engine that fails `hasAnalysisTap` — no `readTimeDomainInto`,
 * `readFrequencyInto`, or `getAnalysisSampleRate`. Mirrors the reference
 * fallback path where the visualizer must draw rest once and never start
 * a frame loop. */
function engineWithoutAnalysisTap(): SynthEngine {
  return {
    status: () => 'unavailable',
    initialize: async () => undefined,
    setAlgorithm: () => undefined,
    updateOperatorLevel: () => undefined,
    setFeedback: () => undefined,
    noteOn: () => undefined,
    noteOff: () => undefined,
    allNotesOff: () => undefined,
    destroy: () => undefined,
  };
}

async function setupWithoutAnalysisTap(): Promise<{
  fixture: ComponentFixture<Visualizer>;
  scheduler: FakeAnimationFrameScheduler;
  ctx: FakeCanvas2dContext;
  spectrumCtx: FakeCanvas2dContext;
}> {
  const scheduler = new FakeAnimationFrameScheduler();
  const ctx = new FakeCanvas2dContext();
  const spectrumCtx = new FakeCanvas2dContext();
  const contexts = [ctx, spectrumCtx];
  let contextCallIndex = 0;

  await TestBed.configureTestingModule({
    imports: [Visualizer],
    providers: [
      { provide: SYNTH_ENGINE, useValue: engineWithoutAnalysisTap() },
      { provide: ANIMATION_FRAME_SCHEDULER, useValue: scheduler },
      { provide: CANVAS_2D_CONTEXT_FACTORY, useValue: () => contexts[contextCallIndex++] ?? null },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Visualizer);
  await fixture.whenStable();

  return { fixture, scheduler, ctx, spectrumCtx };
}

/** Mirrors `worklet-synth-engine.spec.ts`'s own fake worklet setup exactly —
 * this is the same `SYNTH_ENGINE` the live app resolves, so the loop is
 * proven against the real capability guard/read path, not a hand-rolled
 * engine double that could silently drift from it.
 *
 * The component acquires a 2D context once per canvas, oscilloscope first
 * then spectrum, so the factory dispatches by call order — `ctx` in the
 * returned object stays exclusively the oscilloscope's context (preserving
 * every existing single-lane assertion unchanged) and `spectrumCtx` is the
 * second, distinct canvas's context. */
async function setup(options?: { prefersReducedMotion?: boolean }): Promise<{
  fixture: ComponentFixture<Visualizer>;
  scheduler: FakeAnimationFrameScheduler;
  ctx: FakeCanvas2dContext;
  spectrumCtx: FakeCanvas2dContext;
}> {
  FakeAudioWorkletContext.instances.length = 0;
  FakeAudioWorkletNode.instances.length = 0;
  const scheduler = new FakeAnimationFrameScheduler();
  const ctx = new FakeCanvas2dContext();
  const spectrumCtx = new FakeCanvas2dContext();
  const contexts = [ctx, spectrumCtx];
  let contextCallIndex = 0;

  const providers: Provider[] = [
    { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioWorkletContext },
    { provide: AUDIO_WORKLET_NODE_CTOR, useValue: FakeAudioWorkletNode },
    { provide: ANIMATION_FRAME_SCHEDULER, useValue: scheduler },
    { provide: CANVAS_2D_CONTEXT_FACTORY, useValue: () => contexts[contextCallIndex++] ?? null },
  ];
  if (options?.prefersReducedMotion !== undefined) {
    providers.push({ provide: MATCH_MEDIA, useValue: fakeMatchMedia(options.prefersReducedMotion) });
  }

  await TestBed.configureTestingModule({
    imports: [Visualizer],
    providers,
  }).compileComponents();

  const fixture = TestBed.createComponent(Visualizer);
  await fixture.whenStable();

  return { fixture, scheduler, ctx, spectrumCtx };
}

/** The one analyser the fake worklet context's `buildAndStart` created —
 * only meaningful after `SYNTH_ENGINE.initialize()` has resolved. */
function analyserFor(): FakeAnalyserNode {
  const context = FakeAudioWorkletContext.instances[0];
  const analyser = context?.createdAnalysers[0];
  if (analyser === undefined) {
    throw new Error('analyser not created — did the engine initialize()?');
  }
  return analyser;
}

function holdNote(): void {
  TestBed.inject(SYNTH_ENGINE).noteOn(60, 100);
}

describe('Visualizer', () => {
  it('requests exactly one animation frame on creation, before any tick', async () => {
    const { scheduler } = await setup();

    expect(scheduler.pendingCount).toBe(1);
  });

  it('ticking the scheduler once produces exactly one repaint and renews exactly one outstanding request', async () => {
    const { scheduler, ctx } = await setup();
    const fillRectBefore = ctx.callCount('fillRect');

    scheduler.tick(16);

    // Both drawFlatBaseline and drawOscilloscope call fillRect exactly once
    // per invocation — one repaint == one fillRect call.
    expect(ctx.callCount('fillRect')).toBe(fillRectBefore + 1);
    expect(scheduler.pendingCount).toBe(1);
  });

  it('with no analysis tap, draws the rest baseline once after the first render and does not schedule a frame loop', async () => {
    const { scheduler, ctx, spectrumCtx } = await setupWithoutAnalysisTap();

    expect(ctx.callCount('fillRect')).toBe(1);
    expect(spectrumCtx.callCount('fillRect')).toBe(1);
    expect(scheduler.pendingCount).toBe(0);

    scheduler.tick(16);
    scheduler.tick(32);

    expect(ctx.callCount('fillRect')).toBe(1);
    expect(spectrumCtx.callCount('fillRect')).toBe(1);
    expect(scheduler.pendingCount).toBe(0);
  });

  it('with no live tap data, draws the flat baseline once on the first tick and stops repainting on later ticks, while still renewing the frame request each tick', async () => {
    // No SYNTH_ENGINE.initialize() call here — the fake worklet context's
    // analyser field stays null, so readTimeDomainInto always returns false,
    // exactly like "the tap reports no live data".
    const { scheduler, ctx } = await setup();
    const fillRectBefore = ctx.callCount('fillRect');

    scheduler.tick(16);
    expect(ctx.callCount('fillRect')).toBe(fillRectBefore + 1);
    expect(ctx.strokeStyle).toBe(AXIS_LINE_COLOR);
    expect(scheduler.pendingCount).toBe(1);

    scheduler.tick(32);
    scheduler.tick(48);
    scheduler.tick(64);

    expect(ctx.callCount('fillRect')).toBe(fillRectBefore + 1);
    expect(scheduler.pendingCount).toBe(1);
  });

  it('after initialize() with no held note, draws the flat baseline (no live tap data) rather than a waveform', async () => {
    const { scheduler, ctx } = await setup();
    const engine = TestBed.inject(SYNTH_ENGINE);
    await engine.initialize();

    scheduler.tick(16);

    expect(ctx.strokeStyle).toBe(AXIS_LINE_COLOR);
  });

  it('a live tap draws a waveform trace on tick, distinguishable from the flat baseline by the stroke colour it leaves behind', async () => {
    const { scheduler, ctx } = await setup();
    const engine = TestBed.inject(SYNTH_ENGINE);
    await engine.initialize();
    holdNote();
    analyserFor().cannedTimeDomainData = new Uint8Array(ANALYSER_FFT_SIZE).fill(200);

    scheduler.tick(16);

    expect(ctx.strokeStyle).toBe(WAVEFORM_STROKE_COLOR);
  });

  it('destroying the fixture cancels the outstanding animation-frame handle and no further repaint occurs on a later tick', async () => {
    const { fixture, scheduler, ctx } = await setup();
    expect(scheduler.pendingCount).toBe(1);
    expect(scheduler.cancelledHandles.length).toBe(0);

    fixture.destroy();

    expect(scheduler.cancelledHandles.length).toBe(1);
    expect(scheduler.pendingCount).toBe(0);

    const fillRectBefore = ctx.callCount('fillRect');
    scheduler.tick(16);
    expect(ctx.callCount('fillRect')).toBe(fillRectBefore);
  });

  it('renders one description paragraph whose text reflects the ready/non-ready engine status', async () => {
    const { fixture } = await setup();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.visualizer__description')?.textContent).toContain(
      'flat because no audio is running',
    );

    const engine = TestBed.inject(SYNTH_ENGINE);
    await engine.initialize();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('.visualizer__description')?.textContent).toContain(
      'live waveform of the sounding note',
    );
  });

  it('renders exactly two canvases, each with an image role, a distinguishing label, and an aria-describedby pointing at its own description (10-02-PLAN.md Task 3)', async () => {
    const { fixture } = await setup();
    const compiled = fixture.nativeElement as HTMLElement;

    const canvases = Array.from(compiled.querySelectorAll('canvas'));
    expect(canvases.length).toBe(2);

    for (const canvas of canvases) {
      expect(canvas.getAttribute('role')).toBe('img');
      const describedById = canvas.getAttribute('aria-describedby');
      expect(describedById).toBeTruthy();
      expect(compiled.querySelector(`#${describedById}`)).not.toBeNull();
    }

    expect(canvases[0].getAttribute('aria-label')?.toLowerCase()).toContain('oscilloscope');
    expect(canvases[1].getAttribute('aria-label')?.toLowerCase()).toContain('spectrum');
  });

  describe('loop lifecycle and the no-change-detection assertion (10-01-PLAN.md Task 2)', () => {
    it('driving 500 scheduler ticks against a live tap produces exactly 500 repaints, leaves the fixture markup byte-identical, and settles with no pending work — proving the loop schedules no Angular work in this environment (it does not simulate real browser frame timing; see the plan 10-04 human-verify checkpoint for that)', async () => {
      const { fixture, scheduler, ctx } = await setup();
      const engine = TestBed.inject(SYNTH_ENGINE);
      await engine.initialize();
      holdNote();
      analyserFor().cannedTimeDomainData = new Uint8Array(ANALYSER_FFT_SIZE).fill(180);
      // Let the 'ready' status signal reach the DOM (the description
      // paragraph reads it) BEFORE snapshotting markup, exactly as the
      // "renders one description paragraph..." case above does — the 500
      // ticks below must change nothing further, not paper over a status
      // transition the ticks themselves never caused.
      fixture.detectChanges();
      await fixture.whenStable();

      const compiled = fixture.nativeElement as HTMLElement;
      const markupBefore = compiled.innerHTML;
      const fillRectBefore = ctx.callCount('fillRect');

      const TICK_COUNT = 500;
      for (let i = 0; i < TICK_COUNT; i++) {
        scheduler.tick(i);
      }

      expect(ctx.callCount('fillRect') - fillRectBefore).toBe(TICK_COUNT);
      expect(compiled.innerHTML).toBe(markupBefore);
      // "Settles with no pending work" — awaiting whenStable() resolves
      // promptly rather than hanging on outstanding change-detection work
      // the 500 ticks might otherwise have queued; a genuinely stuck
      // pending-work state would leave this await unresolved and the test
      // itself would time out.
      await fixture.whenStable();
      expect(compiled.innerHTML).toBe(markupBefore);
    });

    it('with no live tap, many ticks produce exactly one flat-baseline repaint; a tick after live data becomes available immediately produces a waveform repaint', async () => {
      const { scheduler, ctx } = await setup();
      const fillRectBefore = ctx.callCount('fillRect');

      const REST_TICK_COUNT = 50;
      for (let i = 0; i < REST_TICK_COUNT; i++) {
        scheduler.tick(i);
      }
      expect(ctx.callCount('fillRect')).toBe(fillRectBefore + 1);
      expect(ctx.strokeStyle).toBe(AXIS_LINE_COLOR);

      const engine = TestBed.inject(SYNTH_ENGINE);
      await engine.initialize();
      holdNote();
      analyserFor().cannedTimeDomainData = new Uint8Array(ANALYSER_FFT_SIZE).fill(200);

      scheduler.tick(999);

      expect(ctx.callCount('fillRect')).toBe(fillRectBefore + 2);
      expect(ctx.strokeStyle).toBe(WAVEFORM_STROKE_COLOR);
    });

    it('the tap receives the identical preallocated buffer object on the first tick and the hundredth — the loop allocates no buffer per tick', async () => {
      const { scheduler } = await setup();
      const engine = TestBed.inject(SYNTH_ENGINE);
      await engine.initialize();
      holdNote();
      const analyser = analyserFor();
      analyser.cannedTimeDomainData = new Uint8Array(ANALYSER_FFT_SIZE).fill(150);

      let firstBuffer: Uint8Array | null = null;
      let hundredthBuffer: Uint8Array | null = null;
      const originalGetByteTimeDomainData = analyser.getByteTimeDomainData.bind(analyser);
      let callIndex = 0;
      analyser.getByteTimeDomainData = (target: Uint8Array): void => {
        callIndex += 1;
        if (callIndex === 1) {
          firstBuffer = target;
        }
        if (callIndex === 100) {
          hundredthBuffer = target;
        }
        originalGetByteTimeDomainData(target);
      };

      for (let i = 0; i < 100; i++) {
        scheduler.tick(i);
      }

      expect(firstBuffer).not.toBeNull();
      expect(hundredthBuffer).not.toBeNull();
      expect(hundredthBuffer).toBe(firstBuffer);
    });

    it('never calls the engine lifecycle methods (initialize, noteOn, noteOff, allNotesOff, destroy) across creation, a hundred ticks and destruction', async () => {
      const { fixture, scheduler } = await setup();
      const engine = TestBed.inject(SYNTH_ENGINE);
      const initializeSpy = vi.spyOn(engine, 'initialize');
      const noteOnSpy = vi.spyOn(engine, 'noteOn');
      const noteOffSpy = vi.spyOn(engine, 'noteOff');
      const allNotesOffSpy = vi.spyOn(engine, 'allNotesOff');
      const destroySpy = vi.spyOn(engine, 'destroy');

      for (let i = 0; i < 100; i++) {
        scheduler.tick(i);
      }
      fixture.destroy();

      expect(initializeSpy).not.toHaveBeenCalled();
      expect(noteOnSpy).not.toHaveBeenCalled();
      expect(noteOffSpy).not.toHaveBeenCalled();
      expect(allNotesOffSpy).not.toHaveBeenCalled();
      expect(destroySpy).not.toHaveBeenCalled();
    });
  });

  describe('no 2D drawing context available (10-01-PLAN.md Task 2)', () => {
    it('a context factory returning null results in zero outstanding frame requests and an unchanged description paragraph', async () => {
      const { fixture, scheduler } = await setupNullContextFactory();
      const compiled = fixture.nativeElement as HTMLElement;

      expect(scheduler.pendingCount).toBe(0);
      expect(compiled.querySelector('.visualizer__description')?.textContent).toContain(
        'flat because no audio is running',
      );
    });
  });

  describe('spectrum lane (10-02-PLAN.md Task 3)', () => {
    it('ticking with live data repaints both lanes on the same tick', async () => {
      const { scheduler, ctx, spectrumCtx } = await setup();
      const engine = TestBed.inject(SYNTH_ENGINE);
      await engine.initialize();
      holdNote();
      analyserFor().cannedTimeDomainData = new Uint8Array(ANALYSER_FFT_SIZE).fill(180);

      const oscFillRectBefore = ctx.callCount('fillRect');
      const spectrumFillRectBefore = spectrumCtx.callCount('fillRect');

      scheduler.tick(16);

      expect(ctx.callCount('fillRect')).toBeGreaterThan(oscFillRectBefore);
      expect(spectrumCtx.callCount('fillRect')).toBeGreaterThan(spectrumFillRectBefore);
    });

    it('with a zero sample rate the spectrum lane draws its empty labelled state (three tick labels, no bar rectangles beyond the background)', async () => {
      const { scheduler, spectrumCtx } = await setup();
      // No engine.initialize() — getAnalysisSampleRate() stays 0, so
      // buildBarBinRanges keeps returning null.

      scheduler.tick(16);

      // drawEmptySpectrum: exactly one fillRect (background) plus three
      // fillText labels, no bar rectangles.
      expect(spectrumCtx.callCount('fillText')).toBeGreaterThanOrEqual(3);
    });

    it('the band-range builder is consulted while the sample rate is zero, and is not consulted again once a non-null list has been cached', async () => {
      // buildBarBinRanges itself is a plain, unmocked pure function
      // (spying on a relative-import ESM export isn't supported under this
      // project's Angular/Vitest unit-test harness); instead this spies on
      // `getAnalysisSampleRate` — the tap method the frame callback reads
      // exactly once per frame while the cached ranges are still null, and
      // never again once a non-null list is cached — the same
      // engine-instance-spy technique already used for `initialize`/
      // `noteOn`/etc. elsewhere in this file.
      const { scheduler } = await setup();
      const engine = TestBed.inject(SYNTH_ENGINE);
      const sampleRateSpy = vi.spyOn(engine as unknown as { getAnalysisSampleRate(): number }, 'getAnalysisSampleRate');

      // No initialize() yet: sample rate is 0, so the ranges stay null and
      // the tap is consulted again on every tick.
      scheduler.tick(1);
      scheduler.tick(2);
      scheduler.tick(3);
      expect(sampleRateSpy).toHaveBeenCalledTimes(3);
      expect(sampleRateSpy.mock.results.every((result) => result.value === 0)).toBe(true);

      await engine.initialize();
      holdNote();
      analyserFor().cannedTimeDomainData = new Uint8Array(ANALYSER_FFT_SIZE).fill(200);

      // The next tick succeeds (a real, positive sample rate is now
      // reported) — this is call number 4, and the last one that should
      // ever happen.
      scheduler.tick(4);
      expect(sampleRateSpy).toHaveBeenCalledTimes(4);
      expect(sampleRateSpy.mock.results.at(-1)?.value).toBeGreaterThan(0);

      // Reused, unchanged, across at least 10 further ticks — the tap's
      // sample rate is never consulted again once the ranges are cached.
      for (let i = 0; i < 10; i++) {
        scheduler.tick(5 + i);
      }
      expect(sampleRateSpy).toHaveBeenCalledTimes(4);
    });

    it('the object handed to readFrequencyInto is a different object from the one handed to readTimeDomainInto, with lengths 1024 and 2048 respectively', async () => {
      const { scheduler } = await setup();
      const engine = TestBed.inject(SYNTH_ENGINE);
      await engine.initialize();
      holdNote();
      const analyser = analyserFor();
      analyser.cannedTimeDomainData = new Uint8Array(ANALYSER_FFT_SIZE).fill(150);

      let timeDomainBuffer: Uint8Array | null = null;
      let frequencyBuffer: Uint8Array | null = null;
      const originalGetByteTimeDomainData = analyser.getByteTimeDomainData.bind(analyser);
      const originalGetByteFrequencyData = analyser.getByteFrequencyData.bind(analyser);
      analyser.getByteTimeDomainData = (target: Uint8Array): void => {
        timeDomainBuffer ??= target;
        originalGetByteTimeDomainData(target);
      };
      analyser.getByteFrequencyData = (target: Uint8Array): void => {
        frequencyBuffer ??= target;
        originalGetByteFrequencyData(target);
      };

      scheduler.tick(16);

      expect(timeDomainBuffer).not.toBeNull();
      expect(frequencyBuffer).not.toBeNull();
      expect(frequencyBuffer).not.toBe(timeDomainBuffer);
      expect(timeDomainBuffer!.length).toBe(ANALYSER_FFT_SIZE);
      expect(frequencyBuffer!.length).toBe(ANALYSER_FREQUENCY_BIN_COUNT);
    });

    it('with reduced motion preferred, ticks at timestamps 0, 10, 20 and 30 produce exactly one repaint, and a tick at timestamp 100 produces a second', async () => {
      const { scheduler, ctx } = await setup({ prefersReducedMotion: true });
      const engine = TestBed.inject(SYNTH_ENGINE);
      await engine.initialize();
      holdNote();
      analyserFor().cannedTimeDomainData = new Uint8Array(ANALYSER_FFT_SIZE).fill(200);
      const fillRectBefore = ctx.callCount('fillRect');

      scheduler.tick(0);
      scheduler.tick(10);
      scheduler.tick(20);
      scheduler.tick(30);
      expect(ctx.callCount('fillRect')).toBe(fillRectBefore + 1);

      scheduler.tick(REDUCED_MOTION_FRAME_INTERVAL_MS);
      expect(ctx.callCount('fillRect')).toBe(fillRectBefore + 2);
    });

    it('with reduced motion not preferred, ticks at timestamps 0, 10, 20 and 30 produce four repaints', async () => {
      const { scheduler, ctx } = await setup({ prefersReducedMotion: false });
      const engine = TestBed.inject(SYNTH_ENGINE);
      await engine.initialize();
      holdNote();
      analyserFor().cannedTimeDomainData = new Uint8Array(ANALYSER_FFT_SIZE).fill(200);
      const fillRectBefore = ctx.callCount('fillRect');

      scheduler.tick(0);
      scheduler.tick(10);
      scheduler.tick(20);
      scheduler.tick(30);

      expect(ctx.callCount('fillRect')).toBe(fillRectBefore + 4);
    });

    it('a reduced-motion-throttled tick still re-requests a frame', async () => {
      const { scheduler } = await setup({ prefersReducedMotion: true });

      scheduler.tick(0);
      expect(scheduler.pendingCount).toBe(1);
      scheduler.tick(10);
      expect(scheduler.pendingCount).toBe(1);
    });

    it('both description paragraphs render, and each changes between the non-ready and ready audio statuses', async () => {
      const { fixture } = await setup();
      const compiled = fixture.nativeElement as HTMLElement;

      const oscilloscopeDescription = compiled.querySelector('#oscilloscope-description');
      const spectrumDescription = compiled.querySelector('#spectrum-description');
      expect(oscilloscopeDescription).not.toBeNull();
      expect(spectrumDescription).not.toBeNull();
      expect(spectrumDescription?.textContent).toContain('flat because no audio is running');

      const engine = TestBed.inject(SYNTH_ENGINE);
      await engine.initialize();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(spectrumDescription?.textContent).toContain('loudness');
      expect(spectrumDescription?.textContent).not.toContain('flat because no audio is running');
    });
  });
});
