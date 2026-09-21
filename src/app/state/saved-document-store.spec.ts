import { TestBed } from '@angular/core/testing';

import { STORAGE } from '../core/persistence/storage.token';
import { FakeStorage } from '../core/persistence/testing/fake-storage';
import {
  PERSISTENCE_STORAGE_KEY,
  defaultSavedDocument,
} from '../domain/dx7/persistence/saved-document';
import { LessonProgress } from './lesson-progress';
import { SavedDocumentStore } from './saved-document-store';

describe('FakeStorage', () => {
  it('round-trips getItem, setItem, and removeItem in memory', () => {
    const fake = new FakeStorage();

    expect(fake.getItem('k')).toBeNull();
    fake.setItem('k', 'v');
    expect(fake.getItem('k')).toBe('v');
    fake.removeItem('k');
    expect(fake.getItem('k')).toBeNull();
  });

  it('throwOnSetItem makes setItem throw', () => {
    const fake = new FakeStorage();
    fake.throwOnSetItem = true;

    expect(() => fake.setItem('k', 'v')).toThrow();
    expect(fake.getItem('k')).toBeNull();
  });
});

describe('STORAGE factory', () => {
  let mockStorage: { getItem: ReturnType<typeof vi.fn>, setItem: ReturnType<typeof vi.fn>, removeItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', mockStorage as unknown as Storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('returns a no-op Like when the probe setItem throws and never returns null', () => {
    mockStorage.setItem.mockImplementation(() => {
      throw new Error('quota');
    });

    TestBed.configureTestingModule({});
    const storage = TestBed.inject(STORAGE);

    expect(storage).not.toBeNull();
    expect(storage.getItem('anything')).toBeNull();
    expect(() => storage.setItem('k', 'v')).toThrow();
    expect(() => storage.removeItem('k')).not.toThrow();
  });

  it('probes storage with a unique key so a pre-existing origin value is not overwritten', () => {
    TestBed.configureTestingModule({});
    TestBed.inject(STORAGE);

    const probeCall = mockStorage.setItem.mock.calls.find(([key]: string[]) => String(key).startsWith('__dx7_storage_probe__'));
    expect(probeCall).toBeDefined();
    const probeKey = probeCall![0];
    expect(probeKey).not.toBe('__dx7_storage_probe__');
    expect(mockStorage.removeItem).toHaveBeenCalledWith(probeKey);
  });
});

describe('SavedDocumentStore', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function setup(
    fake: FakeStorage = new FakeStorage(),
  ): { fake: FakeStorage; store: SavedDocumentStore; progress: LessonProgress } {
    TestBed.configureTestingModule({
      providers: [{ provide: STORAGE, useValue: fake }],
    });
    const store = TestBed.inject(SavedDocumentStore);
    store.hydrateLive();
    return { fake, store, progress: TestBed.inject(LessonProgress) };
  }

  it('hydrates defaultSavedDocument with a null recoveryMessage when the storage key is missing', () => {
    const { store } = setup();

    expect(store.document()).toEqual(defaultSavedDocument());
    expect(store.recoveryMessage()).toBeNull();
  });

  it('replaces present unparseable storage with defaults, sets a recovery explanation, and does not throw', () => {
    const fake = new FakeStorage();
    fake.setItem(PERSISTENCE_STORAGE_KEY, '{not-json');

    let store: SavedDocumentStore | undefined;
    expect(() => {
      store = setup(fake).store;
    }).not.toThrow();

    expect(store!.recoveryMessage()).toEqual(expect.any(String));
    expect(store!.recoveryMessage()?.length).toBeGreaterThan(0);
    expect(store!.document()).toEqual(defaultSavedDocument());
    expect(JSON.parse(fake.getItem(PERSISTENCE_STORAGE_KEY)!)).toEqual(defaultSavedDocument());
  });

  it('removes the corrupt blob on parse failure even when setItem throws', () => {
    const fake = new FakeStorage();
    fake.setItem(PERSISTENCE_STORAGE_KEY, '{not-json');
    fake.throwOnSetItem = true;

    let store: SavedDocumentStore | undefined;
    expect(() => {
      store = setup(fake).store;
    }).not.toThrow();

    expect(fake.getItem(PERSISTENCE_STORAGE_KEY)).not.toBe('{not-json');
    expect(fake.getItem(PERSISTENCE_STORAGE_KEY)).toBeNull();
    expect(store!.document()).toEqual(defaultSavedDocument());
    expect(store!.recoveryMessage()?.length).toBeGreaterThan(0);
    expect(store!.writeError()?.length).toBeGreaterThan(0);
  });

  it('keeps in-memory completion and document after a quota failure and sets a non-empty writeError', () => {
    const fake = new FakeStorage();
    fake.throwOnSetItem = true;
    const { store, progress } = setup(fake);

    expect(() => progress.markComplete('algorithm-32')).not.toThrow();
    expect(progress.isComplete('algorithm-32')).toBe(true);
    expect(store.document().completedLessonIds).toEqual(['algorithm-32']);
    expect(store.writeError()?.length).toBeGreaterThan(0);
    expect(fake.getItem(PERSISTENCE_STORAGE_KEY)).toBeNull();
  });

  it('sets writeError when setItem does not throw but the value is not readable back', () => {
    const fake = {
      getItem: (): string | null => null,
      setItem: (): void => undefined,
      removeItem: (): void => undefined,
    };
    TestBed.configureTestingModule({
      providers: [{ provide: STORAGE, useValue: fake }],
    });
    const store = TestBed.inject(SavedDocumentStore);
    store.hydrateLive();
    const progress = TestBed.inject(LessonProgress);

    expect(() => progress.markComplete('algorithm-32')).not.toThrow();
    expect(progress.isComplete('algorithm-32')).toBe(true);
    expect(store.writeError()?.length).toBeGreaterThan(0);
  });

  it('replaceDocument leaves live state unchanged when persistence fails', () => {
    const { fake, store, progress } = setup();
    progress.markComplete('algorithm-32');
    fake.throwOnSetItem = true;
    const imported = {
      ...defaultSavedDocument(),
      completedLessonIds: ['algorithm-1'] as const,
    };

    expect(store.replaceDocument(imported)).toBe(false);
    expect(store.document().completedLessonIds).toEqual(['algorithm-32']);
    expect(progress.isComplete('algorithm-32')).toBe(true);
    expect(progress.isComplete('algorithm-1')).toBe(false);
    expect(store.writeError()?.length).toBeGreaterThan(0);
  });

  it('clearDocument resets memory and sets writeError when removeItem fails', () => {
    const { fake, store, progress } = setup();
    progress.markComplete('algorithm-32');
    fake.throwOnRemoveItem = true;

    store.clearDocument();

    expect(store.document()).toEqual(defaultSavedDocument());
    expect(progress.completed().size).toBe(0);
    expect(store.writeError()?.length).toBeGreaterThan(0);
    expect(fake.getItem(PERSISTENCE_STORAGE_KEY)).not.toBeNull();
  });

  it('clearDocument removes only PERSISTENCE_STORAGE_KEY', () => {
    const fake = new FakeStorage();
    fake.setItem('other-origin-key', 'keep-me');
    const { store, progress } = setup(fake);
    progress.markComplete('algorithm-32');

    store.clearDocument();

    expect(fake.getItem(PERSISTENCE_STORAGE_KEY)).toBeNull();
    expect(fake.getItem('other-origin-key')).toBe('keep-me');
    expect(store.document()).toEqual(defaultSavedDocument());
    expect(progress.completed().size).toBe(0);
  });
});
