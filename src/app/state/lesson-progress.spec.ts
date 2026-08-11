import { TestBed } from '@angular/core/testing';
import { LESSON_IDS } from '../domain/dx7/lessons/lesson-definition';
import { LessonProgress } from './lesson-progress';

describe('LessonProgress', () => {
  function setup(): { service: LessonProgress } {
    TestBed.configureTestingModule({});
    return { service: TestBed.inject(LessonProgress) };
  }

  it('starts empty on a fresh injector', () => {
    const { service } = setup();

    expect(service.completed().size).toBe(0);
  });

  it('reports isComplete false for every member of LESSON_IDS on a fresh injector', () => {
    const { service } = setup();

    for (const id of LESSON_IDS) {
      expect(service.isComplete(id)).toBe(false);
    }
  });

  it('markComplete makes isComplete true for that id only, leaving every other lesson false', () => {
    const { service } = setup();

    service.markComplete('algorithm-32');

    for (const id of LESSON_IDS) {
      expect(service.isComplete(id)).toBe(id === 'algorithm-32');
    }
  });

  it('markComplete replaces the completed set with a new object rather than mutating the previous one', () => {
    const { service } = setup();
    const before = service.completed();

    service.markComplete('algorithm-32');

    expect(service.completed()).not.toBe(before);
    expect(before.has('algorithm-32')).toBe(false);
  });

  it('markComplete called twice for the same id is idempotent and keeps the same set reference on the second call', () => {
    const { service } = setup();

    service.markComplete('algorithm-32');
    const afterFirst = service.completed();
    service.markComplete('algorithm-32');
    const afterSecond = service.completed();

    expect(afterSecond).toBe(afterFirst);
  });

  it('markComplete throws a RangeError naming the legal ids for a value outside LESSON_IDS', () => {
    const { service } = setup();

    expect(() => service.markComplete('not-a-lesson' as never)).toThrow(RangeError);
    expect(() => service.markComplete('not-a-lesson' as never)).toThrow(/algorithm-32/);
  });

  it('isComplete throws a RangeError naming the legal ids for a value outside LESSON_IDS', () => {
    const { service } = setup();

    expect(() => service.isComplete('not-a-lesson' as never)).toThrow(RangeError);
    expect(() => service.isComplete('not-a-lesson' as never)).toThrow(/algorithm-32/);
  });
});
