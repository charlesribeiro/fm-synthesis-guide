import { InjectionToken, inject } from '@angular/core';
import type { SynthEngine } from './synth-engine';
import { WebAudioSynthEngine } from './web-audio-synth-engine';

/**
 * The one seam every consumer injects instead of the concrete
 * `WebAudioSynthEngine` class — this is what lets Phase 7's AudioWorklet
 * six-operator engine swap in later without touching UI code
 * (`docs/ARCHITECTURE.md` §"Audio roadmap"). Lives in its own file, not in
 * `synth-engine.ts`, so the interface module never imports back to its
 * implementation.
 */
export const SYNTH_ENGINE = new InjectionToken<SynthEngine>('SYNTH_ENGINE', {
  providedIn: 'root',
  factory: () => inject(WebAudioSynthEngine),
});
