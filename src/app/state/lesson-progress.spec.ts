import { TestBed } from '@angular/core/testing';
import { LESSON_IDS } from '../domain/dx7/lessons/lesson-definition';
import { STORAGE } from '../core/persistence/storage.token';
import { FakeStorage } from '../core/persistence/testing/fake-storage';
import { LessonProgress } from './lesson-progress';
import { SavedDocumentStore } from './saved-document-store';

describe('LessonProgress', () => {
  function setup(fake: FakeStorage = new FakeStorage()): {
    service: LessonProgress;
    store: SavedDocumentStore;
    fake: FakeStorage;
  } {
    TestBed.configureTestingModule({
      providers: [{ provide: STORAGE, useValue: fake }],
    });
    const store = TestBed.inject(SavedDocumentStore);
    store.hydrateLive();
    return { service: TestBed.inject(LessonProgress), store, fake };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

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

  it('replaceCompleted throws a RangeError for a value outside LESSON_IDS', () => {
    const { service } = setup();

    expect(() => service.replaceCompleted(new Set(['not-a-lesson' as never]))).toThrow(RangeError);
    expect(() => service.replaceCompleted(new Set(['not-a-lesson' as never]))).toThrow(/algorithm-32/);
  });

  it('replaceCompleted to an empty set clears completion (import/clear path)', () => {
    const { service } = setup();
    service.markComplete('algorithm-32');

    service.replaceCompleted(new Set());

    expect(service.completed().size).toBe(0);
    expect(service.isComplete('algorithm-32')).toBe(false);
  });

  it('isComplete remains true after a simulated reload that shares one FakeStorage', () => {
    const fake = new FakeStorage();
    const first = setup(fake);
    first.service.markComplete('algorithm-32');
    expect(first.service.isComplete('algorithm-32')).toBe(true);

    TestBed.resetTestingModule();

    const second = setup(fake);

    expect(second.service.isComplete('algorithm-32')).toBe(true);
  });
});
