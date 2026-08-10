import { MAX_MIDI_NOTE, MIN_MIDI_NOTE } from '../../domain/dx7/audio/value-conversion';
import {
  HIGHEST_PLAYABLE_NOTE,
  LOWEST_PLAYABLE_NOTE,
  PLAYABLE_KEYS,
  noteForKeyCode,
  type PlayableKey,
} from './keyboard-note-map';

describe('keyboard-note-map', () => {
  it('has exactly 12 entries, strictly ascending by note from the lowest to the highest playable note', () => {
    expect(PLAYABLE_KEYS.length).toBe(12);
    expect(PLAYABLE_KEYS[0].note).toBe(LOWEST_PLAYABLE_NOTE);
    expect(PLAYABLE_KEYS.at(-1)?.note).toBe(HIGHEST_PLAYABLE_NOTE);

    for (let i = 1; i < PLAYABLE_KEYS.length; i++) {
      expect(PLAYABLE_KEYS[i].note).toBeGreaterThan(PLAYABLE_KEYS[i - 1].note);
    }
  });

  it('has exactly 7 natural entries and 5 sharp entries', () => {
    const naturals = PLAYABLE_KEYS.filter((key) => !key.isSharp);
    const sharps = PLAYABLE_KEYS.filter((key) => key.isSharp);
    expect(naturals.length).toBe(7);
    expect(sharps.length).toBe(5);
  });

  it('never shares a note, a name, or a physical key code across entries', () => {
    const notes = new Set(PLAYABLE_KEYS.map((key) => key.note));
    const names = new Set(PLAYABLE_KEYS.map((key) => key.name));
    const codes = new Set(PLAYABLE_KEYS.map((key) => key.code));

    expect(notes.size).toBe(PLAYABLE_KEYS.length);
    expect(names.size).toBe(PLAYABLE_KEYS.length);
    expect(codes.size).toBe(PLAYABLE_KEYS.length);
  });

  it('keeps every note within the engine MIDI range', () => {
    for (const key of PLAYABLE_KEYS) {
      expect(key.note).toBeGreaterThanOrEqual(MIN_MIDI_NOTE);
      expect(key.note).toBeLessThanOrEqual(MAX_MIDI_NOTE);
    }
  });

  it('resolves the first and last computer-keyboard codes to the boundary notes', () => {
    expect(noteForKeyCode('KeyA')).toBe(60);
    expect(noteForKeyCode('KeyJ')).toBe(71);
  });

  it('returns null for unmapped codes', () => {
    expect(noteForKeyCode('Space')).toBeNull();
    expect(noteForKeyCode('Enter')).toBeNull();
    expect(noteForKeyCode('KeyZ')).toBeNull();
    expect(noteForKeyCode('')).toBeNull();
  });

  it('freezes the table and each of its entries against mutation', () => {
    expect(Object.isFrozen(PLAYABLE_KEYS)).toBe(true);
    expect(PLAYABLE_KEYS.every((key) => Object.isFrozen(key))).toBe(true);

    expect(() => {
      (PLAYABLE_KEYS as PlayableKey[])[0] = { ...PLAYABLE_KEYS[0], note: 999 };
    }).toThrow();
    expect(() => {
      (PLAYABLE_KEYS[0] as { note: number }).note = 999;
    }).toThrow();

    expect(PLAYABLE_KEYS[0].note).toBe(60);
  });
});
