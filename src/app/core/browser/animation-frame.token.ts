import { InjectionToken } from '@angular/core';

/**
 * DI seam for `requestAnimationFrame`/`cancelAnimationFrame` (mirrors
 * `motion-preference.ts`'s `MATCH_MEDIA` precedent exactly: a minimal
 * interface, a root-provided injection token, a factory that feature-detects
 * the global without touching it at module scope, and a graceful no-op
 * fallback rather than a thrown error when the global is missing).
 *
 * Passing the timestamp through to the callback is deliberate: a later plan
 * throttles the repaint rate from it, and taking it from the frame callback
 * rather than a clock read keeps the loop's timing testable.
 */
export interface AnimationFrameScheduler {
  request(callback: (timestampMs: number) => void): number;
  cancel(handle: number): void;
}

/** A `0` handle from `request` (the no-op fallback's return value) and a
 * no-op `cancel` are the honest degraded behavior for an environment with no
 * `requestAnimationFrame` — never a thrown error. */
function resolveAnimationFrameScheduler(): AnimationFrameScheduler {
  if (
    typeof window === 'undefined' ||
    typeof window.requestAnimationFrame !== 'function' ||
    typeof window.cancelAnimationFrame !== 'function'
  ) {
    return {
      request: () => 0,
      cancel: () => undefined,
    };
  }
  return {
    request: (callback) => window.requestAnimationFrame(callback),
    cancel: (handle) => window.cancelAnimationFrame(handle),
  };
}

export const ANIMATION_FRAME_SCHEDULER = new InjectionToken<AnimationFrameScheduler>(
  'ANIMATION_FRAME_SCHEDULER',
  {
    providedIn: 'root',
    factory: resolveAnimationFrameScheduler,
  },
);
