import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { AUDIO_CONTEXT_CTOR } from '../../core/audio/audio-context.token';
import { FakeAudioContext } from '../../core/audio/testing/fake-audio-context';
import { LESSONS } from '../../domain/dx7/lessons/lessons';
import { LessonProgress } from '../../state/lesson-progress';
import { Learn } from './learn';

describe('Learn', () => {
  let fixture: ComponentFixture<Learn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Learn],
      providers: [provideRouter(routes)],
    }).compileComponents();

    fixture = TestBed.createComponent(Learn);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders one card per LESSONS row, in dataset order, with Algorithm 32 first', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.lesson-card');
    expect(cards.length).toBe(LESSONS.length);

    const algorithmLabels = Array.from(compiled.querySelectorAll('.lesson-card__algorithm')).map(
      (el) => el.textContent?.trim(),
    );
    expect(algorithmLabels[0]).toBe('Algorithm 32');
    expect(algorithmLabels).toEqual(LESSONS.map((lesson) => `Algorithm ${lesson.algorithmId}`));
  });

  it("links each card to its own lesson's /learn/:lessonId address", () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.lesson-card'));

    LESSONS.forEach((lesson, index) => {
      expect(cards[index]?.getAttribute('href')).toMatch(new RegExp(`/learn/${lesson.id}$`));
    });
  });

  it('removes the Phase 1 placeholder claim that the lesson player is unbuilt', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.status')).toBeNull();
    expect(compiled.textContent).not.toMatch(/isn't built yet/i);
  });

  it('shows every card as not started, in words, before any lesson is completed', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = Array.from(compiled.querySelectorAll('.lesson-card'));
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.textContent).toMatch(/not started/i);
    }
  });

  it("marking one lesson complete changes only that lesson's card wording, live, with no reload", async () => {
    const lessonProgress = TestBed.inject(LessonProgress);
    const target = LESSONS[0];
    lessonProgress.markComplete(target.id);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const cards = Array.from(compiled.querySelectorAll('.lesson-card'));

    LESSONS.forEach((lesson, index) => {
      const card = cards[index];
      if (lesson.id === target.id) {
        expect(card?.textContent).toMatch(/completed/i);
        expect(card?.textContent).not.toMatch(/not started/i);
      } else {
        expect(card?.textContent).toMatch(/not started/i);
      }
    });
  });
});

describe('Learn browse-to-lesson round trip (in-app navigation into a lesson, and the facade-to-index completion link)', () => {
  beforeEach(() => {
    FakeAudioContext.instances.length = 0;
    TestBed.configureTestingModule({
      // The destination lesson page embeds PlaySurface, which injects the
      // synth engine — the fake must be provided even though this round
      // trip plays no note (mirrors lesson-detail.spec.ts's setup).
      providers: [provideRouter(routes), { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioContext }],
    });
  });

  it("activates the first /learn card's rendered link and lands on that lesson's own page — no direct router call standing in for the click", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn', Learn);

    const browseRoot = harness.routeNativeElement as HTMLElement;
    const cards = Array.from(browseRoot.querySelectorAll<HTMLAnchorElement>('.lesson-card'));
    const firstLesson = LESSONS[0];
    const firstCard = cards[0];
    expect(firstCard).toBeDefined();

    // Read the anchor's own rendered href (never construct the target URL
    // by hand) — proves the link the learner would actually click resolves
    // to the right place, mirroring algorithms.spec.ts's browse-to-detail
    // round trip.
    const href = firstCard!.getAttribute('href');
    expect(href).not.toBeNull();

    await harness.navigateByUrl(href!);

    const detailRoot = harness.routeNativeElement as HTMLElement;
    expect(detailRoot.querySelector('h1')?.textContent).toContain(firstLesson.title);
  });

  it('shows a lesson marked complete through LessonProgress as complete on a freshly navigated /learn, leaving the other lesson not started', async () => {
    const lessonProgress = TestBed.inject(LessonProgress);
    const [target, other] = LESSONS;
    lessonProgress.markComplete(target.id);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn', Learn);

    const root = harness.routeNativeElement as HTMLElement;
    const cards = Array.from(root.querySelectorAll('.lesson-card'));
    const targetCard = cards.find((card) => card.textContent?.includes(target.title));
    const otherCard = cards.find((card) => card.textContent?.includes(other.title));

    expect(targetCard?.textContent).toMatch(/completed/i);
    expect(otherCard?.textContent).toMatch(/not started/i);
  });
});
