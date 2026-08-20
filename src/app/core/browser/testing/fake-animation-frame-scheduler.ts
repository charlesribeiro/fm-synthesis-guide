import type { AnimationFrameScheduler } from '../animation-frame.token';

/**
 * Hand-rolled `AnimationFrameScheduler` fake (mirrors
 * `motion-preference.spec.ts`'s `FakeMediaQueryList` pattern — no test
 * library). `tick` drains a snapshot of the currently-pending callbacks
 * rather than the live collection, which is what keeps a self-perpetuating
 * loop (a callback that re-requests during the tick) from recursing forever
 * inside one `tick` call — a callback that re-requests during the tick is
 * not re-invoked within that same tick.
 */
export class FakeAnimationFrameScheduler implements AnimationFrameScheduler {
  private nextHandle = 1;
  private readonly pending = new Map<number, (timestampMs: number) => void>();

  readonly cancelledHandles: number[] = [];

  request(callback: (timestampMs: number) => void): number {
    const handle = this.nextHandle++;
    this.pending.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.cancelledHandles.push(handle);
    this.pending.delete(handle);
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  tick(timestampMs: number): void {
    const snapshot = [...this.pending.entries()];
    for (const [handle, callback] of snapshot) {
      this.pending.delete(handle);
      callback(timestampMs);
    }
  }
}
