import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';

import { routes } from '../../../app.routes';
import { AUDIO_CONTEXT_CTOR } from '../../../core/audio/audio-context.token';
import { AUDIO_WORKLET_NODE_CTOR } from '../../../core/audio/audio-worklet-node.token';
import { FakeAudioContext } from '../../../core/audio/testing/fake-audio-context';
import { FakeAudioWorkletContext, FakeAudioWorkletNode } from '../../../core/audio/testing/fake-audio-worklet-node';
import { getLesson } from '../../../domain/dx7/lessons/lessons';
import { tryThisParamValues } from '../../../domain/dx7/lessons/try-this';
import { ALGORITHMS } from '../../../domain/dx7/models/algorithms';
import { deriveCarriers } from '../../../domain/dx7/models/derive-role';
import { InstrumentState } from '../../../state/instrument-state';
import { LessonProgress } from '../../../state/lesson-progress';
import { LessonDetail } from './lesson-detail';

function keyByNote(root: HTMLElement, note: number): HTMLButtonElement {
  const key = root.querySelector(`[data-note="${note}"]`);
  if (key === null) {
    throw new Error(`no key rendered for note ${note}`);
  }
  return key as HTMLButtonElement;
}

async function enableAudio(root: HTMLElement, harness: RouterTestingHarness): Promise<void> {
  const enableButton = root.querySelector('button.button--primary') as HTMLButtonElement;
  enableButton.click();
  await harness.fixture.whenStable();
}

describe('LessonDetail route', () => {
  beforeEach(() => {
    FakeAudioContext.instances.length = 0;
    FakeAudioWorkletNode.instances.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioWorkletContext },
        { provide: AUDIO_WORKLET_NODE_CTOR, useValue: FakeAudioWorkletNode },
      ],
    });
  });

  it('renders the objective, explanation, embedded diagram, try-this control, and embedded play surface for a cold deep link to /learn/algorithm-32', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-32', LessonDetail);

    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent).toContain('Pure additive synthesis');
    expect(root.textContent).toContain('Hear six independent operators');
    expect(root.querySelector('svg')).not.toBeNull();
    expect(root.querySelector('input[type="range"]')).not.toBeNull();
    expect(root.querySelectorAll('.key').length).toBe(12);
  });

  it('applies the lesson starting patch to InstrumentState on a cold deep link', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-32', LessonDetail);

    const instrumentState = TestBed.inject(InstrumentState);
    const lesson = getLesson('algorithm-32');

    expect(instrumentState.algorithmId()).toBe(32);
    expect(instrumentState.operators()[3]).toEqual(lesson.startingPatch.operators[3]);
  });

  it('routes every startingPatch field through setAlgorithm, updateOperator, and setFeedback', async () => {
    const instrumentState = TestBed.inject(InstrumentState);
    const setAlgorithmSpy = vi.spyOn(instrumentState, 'setAlgorithm');
    const updateOperatorSpy = vi.spyOn(instrumentState, 'updateOperator');
    const setFeedbackSpy = vi.spyOn(instrumentState, 'setFeedback');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-32', LessonDetail);

    const lesson = getLesson('algorithm-32');
    expect(setAlgorithmSpy).toHaveBeenCalledWith(lesson.algorithmId);
    expect(updateOperatorSpy).toHaveBeenCalledTimes(6);
    for (const operatorId of [1, 2, 3, 4, 5, 6] as const) {
      expect(updateOperatorSpy).toHaveBeenCalledWith(operatorId, lesson.startingPatch.operators[operatorId]);
    }
    expect(setFeedbackSpy).toHaveBeenCalledWith(lesson.startingPatch.feedback);

    expect(() => instrumentState.setFeedback(-1)).toThrow(RangeError);
    expect(() => instrumentState.setAlgorithm(0)).toThrow(RangeError);
  });

  it('reapplies the new lesson starting patch when navigating between lesson ids on the same component', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-32', LessonDetail);

    const instrumentState = TestBed.inject(InstrumentState);
    expect(instrumentState.algorithmId()).toBe(32);

    await harness.navigateByUrl('/learn/algorithm-1', LessonDetail);
    const algorithm1 = getLesson('algorithm-1');

    expect(instrumentState.algorithmId()).toBe(algorithm1.algorithmId);
    for (const operatorId of [1, 2, 3, 4, 5, 6] as const) {
      expect(instrumentState.operators()[operatorId]).toEqual(algorithm1.startingPatch.operators[operatorId]);
    }
    expect(instrumentState.feedback()).toBe(algorithm1.startingPatch.feedback);
  });

  it('stays incomplete after only playing a note, with the try-this parameter untouched', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-32', LessonDetail);
    const root = harness.routeNativeElement as HTMLElement;

    await enableAudio(root, harness);
    const key = keyByNote(root, 60);
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await harness.fixture.whenStable();

    const lessonProgress = TestBed.inject(LessonProgress);
    expect(lessonProgress.isComplete('algorithm-32')).toBe(false);
  });

  it('stays incomplete after only moving the try-this parameter, with no note played', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-32', LessonDetail);
    const root = harness.routeNativeElement as HTMLElement;

    const range = root.querySelector('input[type="range"]') as HTMLInputElement;
    range.value = '10';
    range.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();

    const lessonProgress = TestBed.inject(LessonProgress);
    expect(lessonProgress.isComplete('algorithm-32')).toBe(false);
  });

  it('completes only once the try-this parameter has moved in the stated direction AND a note is subsequently played', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-32', LessonDetail);
    const root = harness.routeNativeElement as HTMLElement;
    const instrumentState = TestBed.inject(InstrumentState);
    const lessonProgress = TestBed.inject(LessonProgress);

    await enableAudio(root, harness);

    // Move operator 3's output level down (starting index 50) — below the
    // starting value, per the lesson's 'decrease' direction.
    const range = root.querySelector('input[type="range"]') as HTMLInputElement;
    range.value = '10';
    range.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();

    expect(instrumentState.operators()[3].outputLevel).toBe(10);
    expect(lessonProgress.isComplete('algorithm-32')).toBe(false);

    const key = keyByNote(root, 60);
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await harness.fixture.whenStable();

    expect(lessonProgress.isComplete('algorithm-32')).toBe(true);
  });

  it('renders a not-found message with no svg and throws nothing for an unknown lesson slug', async () => {
    const harness = await RouterTestingHarness.create();

    // Awaiting without a try/catch means any thrown error fails this test
    // directly — the "no thrown error" assertion is the successful await.
    await harness.navigateByUrl('/learn/not-a-lesson', LessonDetail);

    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('svg')).toBeNull();
    expect(root.textContent).toMatch(/not found/i);
    expect(root.textContent).toContain('not-a-lesson');
  });
});

/**
 * Algorithm 1 end-to-end coverage (LESSON-02), mirroring the Algorithm 32
 * block above. Every assertion reads the Algorithm 1 row's actual
 * `startingPatch`/`tryThis` values from `lessons.ts` via `getLesson`, rather
 * than restating numbers here — a lesson whose data changes should keep
 * passing where the behaviour is still correct, and fail only where it is
 * not.
 */
describe('LessonDetail route — Algorithm 1 lesson (LESSON-02)', () => {
  beforeEach(() => {
    FakeAudioContext.instances.length = 0;
    FakeAudioWorkletNode.instances.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioWorkletContext },
        { provide: AUDIO_WORKLET_NODE_CTOR, useValue: FakeAudioWorkletNode },
      ],
    });
  });

  const algorithm1Lesson = getLesson('algorithm-1');
  const algorithm1TryThisValues = tryThisParamValues(algorithm1Lesson.tryThis.targetParam);
  const startingValue =
    algorithm1Lesson.startingPatch.operators[algorithm1Lesson.tryThis.targetOperator][
      algorithm1Lesson.tryThis.targetParam
    ];
  const startingIndex = algorithm1TryThisValues.indexOf(startingValue);
  const increasedIndex = startingIndex + 1;
  const decreasedIndex = startingIndex - 1;

  it('keeps the direction-enforcement ladder indices inside tryThisParamValues', () => {
    expect(startingIndex).toBeGreaterThanOrEqual(0);
    expect(increasedIndex).toBeLessThan(algorithm1TryThisValues.length);
    expect(decreasedIndex).toBeGreaterThanOrEqual(0);
  });

  it('renders the objective, explanation, embedded diagram, try-this control, and embedded play surface for a cold deep link to /learn/algorithm-1', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-1', LessonDetail);

    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent).toContain(algorithm1Lesson.title);
    for (const paragraph of algorithm1Lesson.explanation) {
      expect(root.textContent).toContain(paragraph);
    }
    expect(root.querySelector('svg')).not.toBeNull();
    expect(root.querySelector('input[type="range"]')).not.toBeNull();
    expect(root.querySelectorAll('.key').length).toBe(12);
  });

  it('applies the lesson starting patch to InstrumentState on a cold deep link', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-1', LessonDetail);

    const instrumentState = TestBed.inject(InstrumentState);

    expect(instrumentState.algorithmId()).toBe(algorithm1Lesson.algorithmId);
    for (const operatorId of Object.keys(algorithm1Lesson.startingPatch.operators).map(Number)) {
      expect(instrumentState.operators()[operatorId as 1 | 2 | 3 | 4 | 5 | 6]).toEqual(
        algorithm1Lesson.startingPatch.operators[operatorId as 1 | 2 | 3 | 4 | 5 | 6],
      );
    }
    expect(instrumentState.feedback()).toBe(algorithm1Lesson.startingPatch.feedback);
  });

  it("renders the derived carrier list for algorithm 1, matching deriveCarriers — the page shows derived roles, not copy", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-1', LessonDetail);

    const rootEl = harness.routeNativeElement as HTMLElement;
    const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === algorithm1Lesson.algorithmId)!;
    const instrumentState = TestBed.inject(InstrumentState);

    expect(instrumentState.carriers()).toEqual(deriveCarriers(algorithm1));
    expect(rootEl.textContent).toContain(deriveCarriers(algorithm1).join(', '));
  });

  it('stays incomplete after only playing a note, with the try-this parameter untouched', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-1', LessonDetail);
    const root = harness.routeNativeElement as HTMLElement;

    await enableAudio(root, harness);
    const key = keyByNote(root, 60);
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await harness.fixture.whenStable();

    const lessonProgress = TestBed.inject(LessonProgress);
    expect(lessonProgress.isComplete('algorithm-1')).toBe(false);
  });

  it('raising the try-this control above its starting index drives the target ratio up, and leaves the lesson incomplete until a note is played', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-1', LessonDetail);
    const rootEl = harness.routeNativeElement as HTMLElement;
    const instrumentState = TestBed.inject(InstrumentState);
    const lessonProgress = TestBed.inject(LessonProgress);

    const range = rootEl.querySelector('input[type="range"]') as HTMLInputElement;
    range.value = String(increasedIndex);
    range.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();

    expect(instrumentState.operators()[algorithm1Lesson.tryThis.targetOperator][algorithm1Lesson.tryThis.targetParam]).toBe(
      algorithm1TryThisValues[increasedIndex],
    );
    expect(lessonProgress.isComplete('algorithm-1')).toBe(false);
  });

  it('completes the lesson once the ratio has been raised AND a note is subsequently played, leaving algorithm-32 untouched', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-1', LessonDetail);
    const rootEl = harness.routeNativeElement as HTMLElement;
    const lessonProgress = TestBed.inject(LessonProgress);

    await enableAudio(rootEl, harness);

    const range = rootEl.querySelector('input[type="range"]') as HTMLInputElement;
    range.value = String(increasedIndex);
    range.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();

    expect(lessonProgress.isComplete('algorithm-1')).toBe(false);

    const key = keyByNote(rootEl, 60);
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await harness.fixture.whenStable();

    expect(lessonProgress.isComplete('algorithm-1')).toBe(true);
    expect(lessonProgress.isComplete('algorithm-32')).toBe(false);
  });

  it('lowering the try-this control below its starting index and then playing a note does NOT complete the lesson (direction enforced, not just "moved")', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn/algorithm-1', LessonDetail);
    const rootEl = harness.routeNativeElement as HTMLElement;
    const lessonProgress = TestBed.inject(LessonProgress);

    await enableAudio(rootEl, harness);

    const range = rootEl.querySelector('input[type="range"]') as HTMLInputElement;
    range.value = String(decreasedIndex);
    range.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();

    const key = keyByNote(rootEl, 60);
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await harness.fixture.whenStable();

    expect(lessonProgress.isComplete('algorithm-1')).toBe(false);
  });
});

/**
 * Rejected lesson-address matrix (T-06-01), modelled on
 * `algorithm-detail.spec.ts`'s not-found matrix precedent. Each address is
 * driven through its own navigation and asserted to render the not-found
 * branch, no `svg`, and — for the text-only posture — that the raw segment
 * appears in text content only, never in an element attribute or an anchor
 * `href`. Awaiting each navigation without a try/catch is itself the
 * no-throw assertion.
 */
describe('LessonDetail not-found matrix (T-06-01)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioWorkletContext },
        { provide: AUDIO_WORKLET_NODE_CTOR, useValue: FakeAudioWorkletNode },
      ],
    });
  });

  // 'algorithm-2' is an unknown slug (no such lesson exists); 'algorithm-32x'
  // is a near-miss of a real slug (trailing junk); 'Algorithm-32' is a
  // differently-cased near-miss of a real slug; '32' is a bare numeric
  // segment; '!!!' is a segment of punctuation.
  const rejectedSegments = ['algorithm-2', 'algorithm-32x', 'Algorithm-32', '32', '!!!'];

  it('renders the not-found branch, no svg, and throws nothing for every rejected address', async () => {
    const harness = await RouterTestingHarness.create();
    const failures: string[] = [];

    for (const segment of rejectedSegments) {
      // Awaiting without a try/catch means any thrown error fails this loop
      // iteration directly — part of the "no thrown error" assertion.
      await harness.navigateByUrl(`/learn/${segment}`, LessonDetail);
      const rootEl = harness.routeNativeElement as HTMLElement;

      const notFoundOk = /not found/i.test(rootEl.textContent ?? '');
      const noSvg = rootEl.querySelector('svg') === null;

      if (!notFoundOk || !noSvg) {
        failures.push(`segment "${segment}": notFoundOk=${notFoundOk} noSvg=${noSvg}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('echoes the raw rejected segment in text content only — never in an element attribute or an anchor href', async () => {
    const harness = await RouterTestingHarness.create();
    const failures: string[] = [];

    for (const segment of rejectedSegments) {
      await harness.navigateByUrl(`/learn/${segment}`, LessonDetail);
      const rootEl = harness.routeNativeElement as HTMLElement;

      const textOk = (rootEl.textContent ?? '').includes(segment);

      let attributeLeak = false;
      for (const element of Array.from(rootEl.querySelectorAll<HTMLElement>('*'))) {
        for (const attribute of Array.from(element.attributes)) {
          if (attribute.value.includes(segment)) {
            attributeLeak = true;
          }
        }
      }

      let hrefLeak = false;
      for (const anchor of Array.from(rootEl.querySelectorAll<HTMLAnchorElement>('a'))) {
        if ((anchor.getAttribute('href') ?? '').includes(segment)) {
          hrefLeak = true;
        }
      }

      if (!textOk || attributeLeak || hrefLeak) {
        failures.push(`segment "${segment}": textOk=${textOk} attributeLeak=${attributeLeak} hrefLeak=${hrefLeak}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
