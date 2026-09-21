import type { StorageLike } from '../storage.token';

/**
 * Map-backed `StorageLike` for Vitest. Specs share one instance across two
 * TestBed injectors to simulate reload. `throwOnSetItem` stands in for quota
 * / private-mode failures without touching origin `localStorage`.
 */
export class FakeStorage implements StorageLike {
  throwOnSetItem = false;
  throwOnRemoveItem = false;

  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSetItem) {
      throw new Error('QuotaExceededError');
    }
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    if (this.throwOnRemoveItem) {
      throw new Error('Storage is unavailable.');
    }
    this.data.delete(key);
  }
}
