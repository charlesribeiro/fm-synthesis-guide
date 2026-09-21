import {
  MAX_MIDI_NOTE,
  MAX_VELOCITY,
  MIN_MIDI_NOTE,
  MIN_VELOCITY,
} from '../audio/value-conversion';

export type ParsedMidiNote =
  | { readonly kind: 'on'; readonly note: number; readonly velocity: number }
  | { readonly kind: 'off'; readonly note: number };

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const SYSTEM_MESSAGE = 0xf0;

/**
 * Fail-closed MIDI channel-voice parser (D-07, D-11, D-14). Channel nibble
 * is ignored (omni). Velocity-0 note-on is note-off. Non-note messages,
 * short buffers, out-of-range notes, and hostile getters return `null`.
 */
export function parseMidiNoteMessage(data: Uint8Array | null): ParsedMidiNote | null {
  try {
    if (data === null || data.length < 3) {
      return null;
    }
    const status = data[0]!;
    const high = status & 0xf0;
    if (high >= SYSTEM_MESSAGE) {
      return null;
    }
    const note = data[1]!;
    const velocity = data[2]!;
    if (!Number.isInteger(note) || note < MIN_MIDI_NOTE || note > MAX_MIDI_NOTE) {
      return null;
    }
    if (high === NOTE_ON) {
      if (velocity === 0) {
        return { kind: 'off', note };
      }
      if (!Number.isInteger(velocity) || velocity < MIN_VELOCITY || velocity > MAX_VELOCITY) {
        return null;
      }
      return { kind: 'on', note, velocity };
    }
    if (high === NOTE_OFF) {
      return { kind: 'off', note };
    }
    return null;
  } catch {
    return null;
  }
}
