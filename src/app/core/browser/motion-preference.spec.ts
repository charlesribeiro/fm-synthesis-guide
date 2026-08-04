import { TestBed } from '@angular/core/testing';
import { MATCH_MEDIA, MotionPreference } from './motion-preference';

/** Minimal fake MediaQueryList — enough surface for MotionPreference. */
class FakeMediaQueryList {
  matches: boolean;
  private listener: ((event: MediaQueryListEvent) => void) | null = null;

  constructor(initialMatches: boolean) {
    this.matches = initialMatches;
  }

  addEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listener = listener;
  }

  removeEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    if (this.listener === listener) {
      this.listener = null;
    }
  }

  /** Test helper: simulate the OS preference changing. */
  emit(matches: boolean): void {
    this.matches = matches;
    this.listener?.({ matches } as MediaQueryListEvent);
  }
}

describe('MotionPreference', () => {
  function setup(initialMatches: boolean) {
    const mediaQueryList = new FakeMediaQueryList(initialMatches);
    TestBed.configureTestingModule({
      providers: [{ provide: MATCH_MEDIA, useValue: () => mediaQueryList }],
    });
    return { service: TestBed.inject(MotionPreference), mediaQueryList };
  }

  it('reflects the initial OS preference', () => {
    const { service } = setup(true);
    expect(service.prefersReducedMotion()).toBe(true);
  });

  it('defaults to false when the OS has no preference', () => {
    const { service } = setup(false);
    expect(service.prefersReducedMotion()).toBe(false);
  });

  it('updates synchronously when the preference changes', () => {
    const { service, mediaQueryList } = setup(false);

    mediaQueryList.emit(true);

    expect(service.prefersReducedMotion()).toBe(true);
  });

  it('removes its change listener when the service is destroyed', () => {
    const { mediaQueryList } = setup(false);
    const removeSpy = vi.spyOn(mediaQueryList, 'removeEventListener');

    TestBed.resetTestingModule();

    expect(removeSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
