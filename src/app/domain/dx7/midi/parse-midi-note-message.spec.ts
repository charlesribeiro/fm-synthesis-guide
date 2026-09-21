import { parseMidiNoteMessage } from './parse-midi-note-message';

describe('parseMidiNoteMessage', () => {
  it('parses a channel-1 note-on with velocity 100', () => {
    expect(parseMidiNoteMessage(Uint8Array.of(0x90, 60, 100))).toEqual({
      kind: 'on',
      note: 60,
      velocity: 100,
    });
  });

  it('rewrites velocity-0 note-on as note-off with no velocity field', () => {
    expect(parseMidiNoteMessage(Uint8Array.of(0x90, 60, 0))).toEqual({ kind: 'off', note: 60 });
  });

  it('parses note-off and ignores off-velocity', () => {
    expect(parseMidiNoteMessage(Uint8Array.of(0x80, 60, 64))).toEqual({ kind: 'off', note: 60 });
  });

  it('treats channel 16 note-on as omni and accepts notes outside C4–B4', () => {
    expect(parseMidiNoteMessage(Uint8Array.of(0x9f, 72, 1))).toEqual({
      kind: 'on',
      note: 72,
      velocity: 1,
    });
  });

  it.each([
    { name: 'CC', data: Uint8Array.of(0xb0, 1, 1) },
    { name: '2-byte buffer', data: Uint8Array.of(0x90, 60) },
    { name: 'note 128', data: Uint8Array.of(0x90, 128, 100) },
    { name: 'null', data: null },
  ])('returns null and throws nothing for $name', ({ data }) => {
    expect(() => parseMidiNoteMessage(data)).not.toThrow();
    expect(parseMidiNoteMessage(data)).toBeNull();
  });

  it('returns null and throws nothing for a hostile getter', () => {
    const hostile = {
      get 0(): number {
        throw new Error('hostile getter');
      },
      1: 60,
      2: 100,
      length: 3,
    };

    expect(() => parseMidiNoteMessage(hostile as unknown as Uint8Array)).not.toThrow();
    expect(parseMidiNoteMessage(hostile as unknown as Uint8Array)).toBeNull();
  });
});
