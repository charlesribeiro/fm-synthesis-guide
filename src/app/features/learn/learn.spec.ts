import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { AUDIO_CONTEXT_CTOR } from '../../core/audio/audio-context.token';
import { FakeAudioContext } from '../../core/audio/testing/fake-audio-context';
import {
  CURRICULUM_GROUP_LABELS,
  CURRICULUM_GROUP_ORDER,
  groupLessonsByTeachingTag,
} from '../../domain/dx7/lessons/lesson-grouping';
import { LESSONS } from '../../domain/dx7/lessons/lessons';
import { ALGORITHMS } from '../../domain/dx7/models/algorithms';
import { LessonProgress } from '../../state/lesson-progress';
import { Learn } from './learn';

// The grouping function is the same one the component calls, so every count
// asserted below is derived from it (and from LESSONS/CURRICULUM_GROUP_ORDER)
// rather than written as a literal — proving the rendered DOM matches the
// same structural source the component reads, not a copy of it. At the
// shipped thirty-two-row dataset this evaluates to sections of 7, 6, 12 and
// 7 lessons (Parallel, Additive Stacks, Tree and Branch, Rooting).
const EXPECTED_GROUPS = groupLessonsByTeachingTag(LESSONS, ALGORITHMS);

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

  it('renders exactly four group sections, in curriculum order, each with a label heading and a non-empty description', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const sections = compiled.querySelectorAll('section.lesson-group');
    expect(sections.length).toBe(CURRICULUM_GROUP_ORDER.length);

    CURRICULUM_GROUP_ORDER.forEach((tag, index) => {
      const section = sections[index] as HTMLElement;
      const heading = section.querySelector('h2');
      expect(heading?.textContent?.trim()).toBe(CURRICULUM_GROUP_LABELS[tag]);
      const description = section.querySelector('.lesson-group__description');
      expect(description?.textContent?.trim().length).toBeGreaterThan(0);
    });
  });

  it('renders each section with its own card count and thirty-two cards in total, derived from the grouping function', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const sections = Array.from(compiled.querySelectorAll('section.lesson-group'));
    expect(sections.length).toBe(EXPECTED_GROUPS.length);

    sections.forEach((section, index) => {
      const cards = section.querySelectorAll('.lesson-card');
      expect(cards.length).toBe(EXPECTED_GROUPS[index]!.lessons.length);
    });

    const totalCards = compiled.querySelectorAll('.lesson-card');
    expect(totalCards.length).toBe(LESSONS.length);
  });

  it('renders cards in the same flat document-order sequence as LESSONS, proving grouping reordered nothing', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const algorithmLabels = Array.from(compiled.querySelectorAll('.lesson-card__algorithm')).map(
      (el) => el.textContent?.trim(),
    );
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

  it('shows a zero-of-total readout for the overall summary and every section before any completion', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const overall = compiled.querySelector('.progress-summary');
    expect(overall?.textContent).toMatch(new RegExp(`0 of ${LESSONS.length} `));

    const sections = Array.from(compiled.querySelectorAll('section.lesson-group'));
    sections.forEach((section, index) => {
      const readout = section.querySelector('.lesson-group__progress');
      expect(readout?.textContent).toMatch(new RegExp(`0 of ${EXPECTED_GROUPS[index]!.lessons.length} `));
    });
  });

  it("marking one lesson complete changes only that lesson's card wording, live, with no reload", async () => {
    const lessonProgress = TestBed.inject(LessonProgress);
    const target = LESSONS[0]!;
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

  it("marking one lesson complete updates its own section's count and the overall count live, leaving every other section's count unchanged", async () => {
    const lessonProgress = TestBed.inject(LessonProgress);
    const target = LESSONS[0]!;
    const targetGroupIndex = EXPECTED_GROUPS.findIndex((group) =>
      group.lessons.some((lesson) => lesson.id === target.id),
    );
    expect(targetGroupIndex).toBeGreaterThanOrEqual(0);

    lessonProgress.markComplete(target.id);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const overall = compiled.querySelector('.progress-summary');
    expect(overall?.textContent).toMatch(new RegExp(`1 of ${LESSONS.length} `));

    const sections = Array.from(compiled.querySelectorAll('section.lesson-group'));
    sections.forEach((section, index) => {
      const readout = section.querySelector('.lesson-group__progress');
      const expectedTotal = EXPECTED_GROUPS[index]!.lessons.length;
      const expectedCompleted = index === targetGroupIndex ? 1 : 0;
      expect(readout?.textContent).toMatch(new RegExp(`${expectedCompleted} of ${expectedTotal} `));
    });
  });

  it('never changes the order or section membership of any card when a lesson is marked complete (D-16)', async () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const before = Array.from(compiled.querySelectorAll('.lesson-card__algorithm')).map((el) =>
      el.textContent?.trim(),
    );

    const lessonProgress = TestBed.inject(LessonProgress);
    const target = LESSONS[Math.floor(LESSONS.length / 2)]!;
    lessonProgress.markComplete(target.id);
    await fixture.whenStable();

    const after = Array.from(compiled.querySelectorAll('.lesson-card__algorithm')).map((el) =>
      el.textContent?.trim(),
    );
    expect(after).toEqual(before);
    expect(after).toEqual(LESSONS.map((lesson) => `Algorithm ${lesson.algorithmId}`));
  });

  it('renders the heading hierarchy in correct document order: one h1, four h2s, thirty-two h3s', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('h1').length).toBe(1);
    expect(compiled.querySelectorAll('h2').length).toBe(CURRICULUM_GROUP_ORDER.length);
    expect(compiled.querySelectorAll('h3').length).toBe(LESSONS.length);
  });

  it("asserts the four section heading texts equal CURRICULUM_GROUP_LABELS read in CURRICULUM_GROUP_ORDER order, and the overall total equals LESSONS.length", () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const headings = Array.from(compiled.querySelectorAll('section.lesson-group h2')).map((el) =>
      el.textContent?.trim(),
    );
    expect(headings).toEqual(CURRICULUM_GROUP_ORDER.map((tag) => CURRICULUM_GROUP_LABELS[tag]));

    const overall = compiled.querySelector('.progress-summary');
    expect(overall?.textContent).toContain(`${LESSONS.length}`);
  });
});

describe('Learn browse-to-lesson round trip (in-app navigation into a lesson, and the facade-to-index completion link)', () => {
  beforeEach(() => {
    FakeAudioContext.instances.length = 0;
    TestBed.configureTestingModule({
      // Destination LessonDetail embeds PlaySurface, which injects the synth
      // engine. Only FakeAudioContext is provided so construction succeeds;
      // the heading assertion below does not exercise audio playback.
      providers: [provideRouter(routes), { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioContext }],
    });
  });

  it("activates the first /learn card's rendered link and lands on that lesson's own page — no direct router call standing in for the click", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn', Learn);

    const browseRoot = harness.routeNativeElement as HTMLElement;
    const cards = Array.from(browseRoot.querySelectorAll<HTMLAnchorElement>('.lesson-card'));
    const firstLesson = LESSONS[0]!;
    const firstCard = cards[0];
    expect(firstCard).toBeDefined();

    firstCard!.click();
    await harness.fixture.whenStable();

    const detailRoot = harness.routeNativeElement as HTMLElement;
    expect(detailRoot.querySelector('h1')?.textContent).toContain(firstLesson.title);
  });

  it('shows a lesson marked complete through LessonProgress as complete on a freshly navigated /learn, leaving the other lesson not started', async () => {
    const lessonProgress = TestBed.inject(LessonProgress);
    const [target, other] = LESSONS;
    lessonProgress.markComplete(target!.id);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn', Learn);

    const root = harness.routeNativeElement as HTMLElement;
    const cards = Array.from(root.querySelectorAll('.lesson-card'));
    const targetCard = cards.find((card) => card.textContent?.includes(target!.title));
    const otherCard = cards.find((card) => card.textContent?.includes(other!.title));

    expect(targetCard?.textContent).toMatch(/completed/i);
    expect(otherCard?.textContent).toMatch(/not started/i);
  });
});
