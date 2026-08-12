import { InjectionToken } from '@angular/core';
import type { AudioContextLike, AudioNodeLike } from './audio-context.token';

/**
 * Minimal `AudioWorkletNode`/`AudioWorklet` surface the worklet engine and
 * its hand-rolled fakes both satisfy (Phase 7, ENGINE-01, D-02) — mirrors
 * `audio-context.token.ts`'s `*Like` convention exactly, so no spec in this
 * app ever needs a real `AudioWorkletNode` (`jsdom` implements no Web Audio
 * API at all, `05-RESEARCH.md` Pitfall 6). Declared here rather than
 * widening `AudioContextLike`/`AudioNodeLike` in `audio-context.token.ts`,
 * so Phase 5's live engine and its fake stay completely untouched (D-01).
 */

/** Typed structurally rather than as the DOM `MessageEvent` so the fake
 * needs no DOM construction. */
export interface AudioWorkletPortLike {
  postMessage(data: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export interface AudioWorkletNodeLike extends AudioNodeLike {
  readonly port: AudioWorkletPortLike;
}

export interface AudioWorkletLike {
  addModule(moduleUrl: string): Promise<void>;
}

export interface AudioWorkletContextLike extends AudioContextLike {
  readonly audioWorklet: AudioWorkletLike;
}

/** Only the fields this phase actually uses — deliberately not the full
 * `AudioWorkletNodeOptions` DOM shape. */
export interface AudioWorkletNodeOptionsLike {
  readonly numberOfInputs?: number;
  readonly outputChannelCount?: readonly number[];
  readonly processorOptions?: unknown;
}

/** A *constructor*, never an instance — nothing here is ever constructed at
 * module/DI-factory time (mirrors `AudioContextConstructorLike`). */
export type AudioWorkletNodeConstructorLike = new (
  context: AudioWorkletContextLike,
  processorName: string,
  options?: AudioWorkletNodeOptionsLike,
) => AudioWorkletNodeLike;

/**
 * Narrows an `AudioContextLike` to an `AudioWorkletContextLike` with a
 * runtime check only — no type assertion that skips the check. Confines the
 * narrowing to a callable `addModule` on an `audioWorklet` property.
 */
export function supportsAudioWorklet(context: AudioContextLike): context is AudioWorkletContextLike {
  const candidate = context as { audioWorklet?: { addModule?: unknown } };
  return typeof candidate.audioWorklet?.addModule === 'function';
}

/**
 * Feature-detects the browser's `AudioWorkletNode` constructor without ever
 * constructing one. The narrowing cast here is confined to this one
 * factory — no other file in the app may reference a Web Audio global
 * directly (mirrors `resolveAudioContextConstructor`).
 */
function resolveAudioWorkletNodeConstructor(): AudioWorkletNodeConstructorLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const globalWindow = window as unknown as {
    AudioWorkletNode?: AudioWorkletNodeConstructorLike;
  };
  return globalWindow.AudioWorkletNode ?? null;
}

/**
 * DI seam for the browser `AudioWorkletNode` constructor (mirrors
 * `AUDIO_CONTEXT_CTOR`). `null` is the honest `'unavailable'`
 * `AudioEngineStatus` signal, exactly as `AUDIO_CONTEXT_CTOR` treats a
 * missing `AudioContext`.
 */
export const AUDIO_WORKLET_NODE_CTOR = new InjectionToken<AudioWorkletNodeConstructorLike | null>(
  'AUDIO_WORKLET_NODE_CTOR',
  {
    providedIn: 'root',
    factory: resolveAudioWorkletNodeConstructor,
  },
);

/** The same-origin path Angular's existing `public/` asset rule serves the
 * 07-01 bundle from (`scripts/build-worklet.mjs` writes here). */
export const DEFAULT_WORKLET_MODULE_URL = '/worklets/dx7-worklet-processor.js';

/**
 * DI seam for the worklet module URL. Build-time fixed and must never
 * become runtime- or user-configurable (threat `T-07-06`) — a configurable
 * worklet URL would be arbitrary code execution in the render thread.
 */
export const AUDIO_WORKLET_MODULE_URL = new InjectionToken<string>('AUDIO_WORKLET_MODULE_URL', {
  providedIn: 'root',
  factory: () => DEFAULT_WORKLET_MODULE_URL,
});
