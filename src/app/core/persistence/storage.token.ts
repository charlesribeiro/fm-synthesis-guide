import { InjectionToken } from '@angular/core';

/**
 * Minimal Web Storage seam. The factory is the only file allowed to name
 * `window.localStorage`. Always returns a Like — never `null` — matching
 * `ANIMATION_FRAME_SCHEDULER`'s no-op fallback (not `AUDIO_CONTEXT_CTOR`).
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const NOOP_STORAGE: StorageLike = {
  getItem: () => null,
  setItem: () => {
    throw new Error('Storage is unavailable.');
  },
  removeItem: () => undefined,
};

function resolveStorage(): StorageLike {
  try {
    if (typeof window === 'undefined') {
      return NOOP_STORAGE;
    }
    const storage = window.localStorage;
    const probe = `__dx7_storage_probe__${Date.now()}_${Math.random().toString(36).slice(2)}`;
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return NOOP_STORAGE;
  }
}

export const STORAGE = new InjectionToken<StorageLike>('STORAGE', {
  providedIn: 'root',
  factory: resolveStorage,
});
