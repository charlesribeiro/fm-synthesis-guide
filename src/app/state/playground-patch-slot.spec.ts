import { TestBed } from '@angular/core/testing';

import { STORAGE } from '../core/persistence/storage.token';
import { FakeStorage } from '../core/persistence/testing/fake-storage';
import { DEFAULT_PATCH, type InstrumentPatch } from '../domain/dx7/models/patch';
import { LessonProgress } from './lesson-progress';
import { PlaygroundPatchSlot } from './playground-patch-slot';
import { SavedDocumentStore } from './saved-document-store';

const CUSTOM_PATCH: InstrumentPatch = {
  algorithmId: 32,
  operators: DEFAULT_PATCH.operators,
  feedback: 3,
};

describe('PlaygroundPatchSlot', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function setup(fake: FakeStorage = new FakeStorage()): {
    slot: PlaygroundPatchSlot;
    store: SavedDocumentStore;
    progress: LessonProgress;
  } {
    TestBed.configureTestingModule({
      providers: [{ provide: STORAGE, useValue: fake }],
    });
    const store = TestBed.inject(SavedDocumentStore);
    store.hydrateLive();
    return {
      slot: TestBed.inject(PlaygroundPatchSlot),
      store,
      progress: TestBed.inject(LessonProgress),
    };
  }

  it('reads DEFAULT_PATCH when the store holds defaults', () => {
    const { slot } = setup();

    expect(slot.read()).toEqual(DEFAULT_PATCH);
  });

  it('write updates only playgroundPatch and leaves completedLessonIds unchanged', () => {
    const { slot, store, progress } = setup();
    progress.markComplete('algorithm-1');
    const completedBefore = store.document().completedLessonIds;

    slot.write(CUSTOM_PATCH);

    expect(slot.read()).toEqual(CUSTOM_PATCH);
    expect(store.document().playgroundPatch).toEqual(CUSTOM_PATCH);
    expect(store.document().completedLessonIds).toEqual(completedBefore);
  });

  it('markComplete after a prior write leaves read() equal to the written patch', () => {
    const { slot, progress } = setup();
    slot.write(CUSTOM_PATCH);

    progress.markComplete('algorithm-32');

    expect(slot.read()).toEqual(CUSTOM_PATCH);
    expect(progress.isComplete('algorithm-32')).toBe(true);
  });

  it('throws RangeError for invalid feedback and does not change read()', () => {
    const { slot } = setup();
    const before = slot.read();

    expect(() => slot.write({ ...DEFAULT_PATCH, feedback: 99 })).toThrow(RangeError);
    expect(slot.read()).toEqual(before);
    expect(slot.read()).toEqual(DEFAULT_PATCH);
  });
});
