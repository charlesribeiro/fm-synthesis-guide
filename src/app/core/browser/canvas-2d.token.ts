import { InjectionToken } from '@angular/core';

/**
 * Minimal 2D drawing surface — deliberately just the members this app draws
 * with, following the same "just what the app needs" rule as
 * `GainNodeLike`/`AnalyserNodeLike` in `core/audio/audio-context.token.ts`.
 */
export interface CanvasRenderingContext2DLike {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  fillText(text: string, x: number, y: number): void;
}

/**
 * The sole acquisition point for a real 2D drawing context in the app. A
 * `null` return is an expected, non-fatal outcome the caller must handle
 * (e.g. `jsdom` implements no Canvas 2D rendering context without the
 * optional native `canvas` package, which this project does not install —
 * this is also why the context is acquired through an injected factory
 * rather than a direct `getContext('2d')` call: it is the same DI-seam
 * posture `MATCH_MEDIA`/`AUDIO_CONTEXT_CTOR` already establish for every
 * other browser global in this codebase, and it is what makes the draw path
 * assertable at all under test).
 */
export type Canvas2dContextFactory = (canvas: HTMLCanvasElement) => CanvasRenderingContext2DLike | null;

function resolveCanvas2dContextFactory(): Canvas2dContextFactory {
  return (canvas) => canvas.getContext('2d') as CanvasRenderingContext2DLike | null;
}

export const CANVAS_2D_CONTEXT_FACTORY = new InjectionToken<Canvas2dContextFactory>(
  'CANVAS_2D_CONTEXT_FACTORY',
  {
    providedIn: 'root',
    factory: resolveCanvas2dContextFactory,
  },
);
