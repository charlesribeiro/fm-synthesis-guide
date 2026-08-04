import type { AlgorithmId } from '../../domain/dx7/models/algorithm';
import type { OperatorId } from '../../domain/dx7/models/operator';

/**
 * Lifecycle states the audio boundary can report. The UI must stay
 * navigable and useful in every state — the app never blocks on audio
 * (Audio rule: "resume/start audio only after explicit user gesture").
 */
export type AudioEngineStatus =
  | 'unavailable' // Web Audio API not supported in this browser
  | 'suspended' // supported, but not yet started by a user gesture
  | 'ready' // running and able to produce sound
  | 'error'; // failed to initialize or crashed

/**
 * Placeholder seam for the audio engine, deliberately unimplemented in
 * Phase 1 (`docs/ACCEPTANCE_CRITERIA.md`: "no synthesis engine yet beyond a
 * typed placeholder interface"). It exists now so:
 *
 *  - later phases build against a stable contract instead of inventing one
 *    under time pressure;
 *  - the MVP OscillatorNode/GainNode graph (Phase 5) and the eventual
 *    AudioWorklet six-operator engine (Phase 7+) can share this interface,
 *    so swapping one for the other never touches UI/state code
 *    (`docs/ARCHITECTURE.md`).
 *
 * Implementations must never construct an `AudioContext` at module
 * evaluation time, must never store `AudioNode`s in Angular signal state,
 * and must expose `status` as a `Signal` (not a getter) so the shell can
 * render suspended/unavailable/error states reactively.
 */
export interface SynthEngine {
  readonly status: () => AudioEngineStatus;

  initialize(): Promise<void>;
  setAlgorithm(algorithmId: AlgorithmId): void;
  updateOperatorLevel(operatorId: OperatorId, level: number): void;
  setFeedback(level: number): void;
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  allNotesOff(): void;
  destroy(): void;
}
