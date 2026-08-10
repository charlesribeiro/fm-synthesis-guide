import { InjectionToken } from '@angular/core';

/**
 * Minimal Web Audio surface the engine and its hand-rolled fakes both
 * satisfy — no spec in this app ever needs a real `AudioContext`
 * (`05-RESEARCH.md` Pitfall 6: `jsdom` implements no Web Audio API at all).
 */
export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): unknown;
  linearRampToValueAtTime(value: number, endTime: number): unknown;
  setTargetAtTime(target: number, startTime: number, timeConstant: number): unknown;
  cancelScheduledValues(cancelTime: number): unknown;
  /** Atomically cancels every scheduled event after `cancelTime` and holds
   * the value the curve would have had at that instant — the modern
   * replacement for the `cancelScheduledValues()` + re-read-`.value`-as-
   * anchor idiom, whose cross-browser behavior at cancel time is not
   * consistently the interpolated mid-ramp value (MDN). Used everywhere
   * this engine cancels a still-running ramp to start a new one. */
  cancelAndHoldAtTime(cancelTime: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike | AudioParamLike): unknown;
  disconnect(destination?: AudioNodeLike | AudioParamLike): unknown;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: string;
  readonly frequency: AudioParamLike;
  readonly detune: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface DelayNodeLike extends AudioNodeLike {
  readonly delayTime: AudioParamLike;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: AudioNodeLike;
  resume(): Promise<unknown>;
  close(): Promise<unknown>;
  createOscillator(): OscillatorNodeLike;
  createGain(): GainNodeLike;
  createDelay(maxDelayTime?: number): DelayNodeLike;
}

/** A *constructor*, never an instance — nothing here is ever constructed at
 * module/DI-factory time (`05-RESEARCH.md` Pitfall 3, CLAUDE.md's "never
 * construct an AudioContext at module evaluation time"). */
export type AudioContextConstructorLike = new () => AudioContextLike;

/**
 * Feature-detects the browser's `AudioContext` (and the legacy
 * `webkitAudioContext` name) without ever constructing one. The narrowing
 * cast here is confined to this one factory — no other file in the app may
 * reference a Web Audio global directly.
 */
function resolveAudioContextConstructor(): AudioContextConstructorLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const globalWindow = window as unknown as {
    AudioContext?: AudioContextConstructorLike;
    webkitAudioContext?: AudioContextConstructorLike;
  };
  return globalWindow.AudioContext ?? globalWindow.webkitAudioContext ?? null;
}

/**
 * DI seam for the browser `AudioContext` constructor (mirrors
 * `src/app/core/browser/motion-preference.ts`'s `MATCH_MEDIA` token).
 * `null` is the `'unavailable'` `AudioEngineStatus` signal — a safe,
 * honest default rather than a thrown error, matching
 * `unsupportedMediaQueryList`'s posture for an unsupported environment.
 */
export const AUDIO_CONTEXT_CTOR = new InjectionToken<AudioContextConstructorLike | null>(
  'AUDIO_CONTEXT_CTOR',
  {
    providedIn: 'root',
    factory: resolveAudioContextConstructor,
  },
);
