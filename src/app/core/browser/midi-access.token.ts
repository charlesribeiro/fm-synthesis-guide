import { InjectionToken } from '@angular/core';

/** Minimal MIDI port surface this app reads — TypeScript's DOM lib has no Web MIDI types here. */
export interface MidiPortLike {
  readonly id: string;
  readonly name: string;
  state: string;
}

export interface MidiMessageEventLike {
  readonly data: Uint8Array | null;
}

export interface MidiInputLike extends MidiPortLike {
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
}

export interface MidiInputMapLike {
  values(): IterableIterator<MidiInputLike>;
  get(id: string): MidiInputLike | undefined;
}

export interface MidiConnectionEventLike {
  readonly port: MidiInputLike;
}

export interface MidiAccessLike {
  readonly inputs: MidiInputMapLike;
  onstatechange: ((event?: MidiConnectionEventLike) => void) | null;
}

export interface MidiRequestOptionsLike {
  readonly sysex?: boolean;
}

export type RequestMidiAccessLike = (options?: MidiRequestOptionsLike) => Promise<MidiAccessLike>;

/**
 * Feature-detects `navigator.requestMIDIAccess` without ever invoking it.
 * `null` is the honest `'unsupported'` MidiSession status (D-05, D-08).
 * The narrowing cast is confined to this factory — tests provide the token,
 * never `navigator.requestMIDIAccess`.
 */
function resolveRequestMidiAccess(): RequestMidiAccessLike | null {
  if (typeof navigator === 'undefined') {
    return null;
  }
  const navigatorWithMidi = navigator as Navigator & {
    requestMIDIAccess?: RequestMidiAccessLike;
  };
  if (typeof navigatorWithMidi.requestMIDIAccess !== 'function') {
    return null;
  }
  return (options) => navigatorWithMidi.requestMIDIAccess!(options);
}

export const REQUEST_MIDI_ACCESS = new InjectionToken<RequestMidiAccessLike | null>(
  'REQUEST_MIDI_ACCESS',
  {
    providedIn: 'root',
    factory: resolveRequestMidiAccess,
  },
);
