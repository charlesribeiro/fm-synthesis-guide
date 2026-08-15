import { InjectionToken, inject } from '@angular/core';
import type { SynthEngine } from './synth-engine';
import { WorkletSynthEngine } from './worklet-synth-engine';

/**
 * The one seam every consumer injects instead of a concrete engine class —
 * this is what let Phase 8's routed AudioWorklet six-operator engine swap
 * in without touching UI code (`docs/ARCHITECTURE.md` §"Audio roadmap").
 * Lives in its own file, not in `synth-engine.ts`, so the interface module
 * never imports back to its implementation.
 *
 * D-01 (Phase 8, ENGINE-02): resolves `WorkletSynthEngine`. Phase 5's
 * `WebAudioSynthEngine` is retained as an unused reference fallback (D-04)
 * — neither deleted nor auto-selected — but this token no longer resolves
 * it.
 */
export const SYNTH_ENGINE = new InjectionToken<SynthEngine>('SYNTH_ENGINE', {
  providedIn: 'root',
  factory: () => inject(WorkletSynthEngine),
});
