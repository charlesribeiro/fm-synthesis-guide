import { DestroyRef, Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';

/**
 * A `MediaQueryList` stand-in for environments where `matchMedia` isn't
 * available at all (older browsers, some test runners). Reports "no
 * preference" and never fires — motion preference becomes unavailable
 * rather than crashing the app, the same graceful-degradation posture the
 * architecture uses for MIDI support.
 */
function unsupportedMediaQueryList(): MediaQueryList {
  return {
    matches: false,
    media: '',
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  } as MediaQueryList;
}

/**
 * DI seam for `window.matchMedia`. Domain/service code must never touch
 * `window` directly (Angular rule: avoid manual subscriptions and direct
 * browser-global access); tests provide a fake implementation through this
 * token instead of mocking globals.
 */
export const MATCH_MEDIA = new InjectionToken<typeof window.matchMedia>('MATCH_MEDIA', {
  providedIn: 'root',
  factory: () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia.bind(window)
      : unsupportedMediaQueryList,
});

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Exposes the user's OS-level reduced-motion preference as a signal.
 *
 * This is the app's first signal-based example of the architecture's
 * intended pattern: a private `WritableSignal` updated only from a single
 * imperative source (a `MediaQueryList` change listener — an external
 * system, per the `effect`/DI rules), with a read-only `Signal` exposed to
 * consumers. Components read `prefersReducedMotion()` to skip JS-driven
 * animation loops; CSS handles the transition/animation-duration override
 * independently via the `prefers-reduced-motion` media query in
 * `_tokens.scss`.
 */
@Injectable({ providedIn: 'root' })
export class MotionPreference {
  private readonly matchMedia = inject(MATCH_MEDIA);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _prefersReducedMotion = signal(this.matchMedia(REDUCED_MOTION_QUERY).matches);

  /** Read-only: true when the user has requested reduced motion. */
  readonly prefersReducedMotion: Signal<boolean> = this._prefersReducedMotion.asReadonly();

  constructor() {
    const mediaQueryList = this.matchMedia(REDUCED_MOTION_QUERY);
    const listener = (event: MediaQueryListEvent): void => {
      this._prefersReducedMotion.set(event.matches);
    };

    mediaQueryList.addEventListener('change', listener);
    this.destroyRef.onDestroy(() => {
      mediaQueryList.removeEventListener('change', listener);
    });
  }
}
