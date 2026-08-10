import { MAX_MIDI_NOTE, MIN_MIDI_NOTE } from '../../domain/dx7/audio/value-conversion';

/**
 * D-07: one fixed octave, C4 through B4 — no octave-shift control this
 * phase. Widening the range later is adding rows to {@link PLAYABLE_KEYS},
 * not restructuring this file or its consumers.
 */
export const LOWEST_PLAYABLE_NOTE = 60;
export const HIGHEST_PLAYABLE_NOTE = 71;

/**
 * One playable key: the note it sounds, its display name, the physical
 * computer-keyboard code that plays it (`KeyboardEvent.code`, not `.key`,
 * so the mapping follows physical key position and survives a non-US
 * layout), the single printed character shown on that physical key, and
 * whether it renders as a sharp (black) key.
 */
export interface PlayableKey {
  readonly note: number;
  readonly name: string;
  readonly code: string;
  readonly hint: string;
  readonly isSharp: boolean;
}

/**
 * The one table both the on-screen key row and the computer-keyboard
 * handler read — piano-style QWERTY convention (`05-RESEARCH.md`
 * Assumptions Log A4): naturals on the home row, sharps on the row above,
 * so the physical layout matches a keyboard's black/white geometry. Mirrors
 * `COARSE_RATIOS`/`isCoarseRatio` (`operator-parameters.ts`) and
 * `SNAPSHOT_SLOTS`/`isSnapshotSlot` (`instrument-state.ts`): a frozen
 * lookup table plus a small guard/lookup function, never a `Map` assembled
 * ad hoc inline in a component.
 */
export const PLAYABLE_KEYS: readonly PlayableKey[] = Object.freeze([
  Object.freeze({ note: 60, name: 'C4', code: 'KeyA', hint: 'A', isSharp: false }),
  Object.freeze({ note: 61, name: 'C#4', code: 'KeyW', hint: 'W', isSharp: true }),
  Object.freeze({ note: 62, name: 'D4', code: 'KeyS', hint: 'S', isSharp: false }),
  Object.freeze({ note: 63, name: 'D#4', code: 'KeyE', hint: 'E', isSharp: true }),
  Object.freeze({ note: 64, name: 'E4', code: 'KeyD', hint: 'D', isSharp: false }),
  Object.freeze({ note: 65, name: 'F4', code: 'KeyF', hint: 'F', isSharp: false }),
  Object.freeze({ note: 66, name: 'F#4', code: 'KeyT', hint: 'T', isSharp: true }),
  Object.freeze({ note: 67, name: 'G4', code: 'KeyG', hint: 'G', isSharp: false }),
  Object.freeze({ note: 68, name: 'G#4', code: 'KeyY', hint: 'Y', isSharp: true }),
  Object.freeze({ note: 69, name: 'A4', code: 'KeyH', hint: 'H', isSharp: false }),
  Object.freeze({ note: 70, name: 'A#4', code: 'KeyU', hint: 'U', isSharp: true }),
  Object.freeze({ note: 71, name: 'B4', code: 'KeyJ', hint: 'J', isSharp: false }),
]);

/**
 * The playable octave is a subset of the engine's full MIDI range, not a
 * parallel definition (`05-RESEARCH.md`) — asserted once at module load
 * against `value-conversion.ts`'s {@link MIN_MIDI_NOTE}/{@link MAX_MIDI_NOTE}
 * rather than hardcoding a second pair of bounds here.
 */
if (LOWEST_PLAYABLE_NOTE < MIN_MIDI_NOTE || HIGHEST_PLAYABLE_NOTE > MAX_MIDI_NOTE) {
  throw new RangeError(
    `Playable octave ${LOWEST_PLAYABLE_NOTE}..${HIGHEST_PLAYABLE_NOTE} must fall within the engine's MIDI range ${MIN_MIDI_NOTE}..${MAX_MIDI_NOTE}`,
  );
}

const NOTE_BY_CODE: ReadonlyMap<string, number> = new Map(
  PLAYABLE_KEYS.map((key) => [key.code, key.note]),
);

/**
 * Resolves a `KeyboardEvent.code` to its playable note, or `null` when the
 * code is unmapped — an unmapped key is an ordinary, expected event, never
 * an error.
 */
export function noteForKeyCode(code: string): number | null {
  return NOTE_BY_CODE.get(code) ?? null;
}
