# Phase 12 — API Coverage

**Capability:** Web MIDI + origin `localStorage`
**Default:** INTEGRATE
**Detector:** Web MIDI is an external browser API. `localStorage` is not an
external network API; it is still listed here because the persistence document
crosses a trust boundary.

| capability | decision | reason |
|---------|----------|--------|
| `navigator.requestMIDIAccess` | INTEGRATE | MIDI-01; only from Enable MIDI (D-08) |
| `MIDIAccess.inputs` | INTEGRATE | D-03 auto-select first `values()`; D-04 live port list |
| `MIDIAccess.outputs` | OPT-OUT | Input-only this phase; no MIDI out |
| `MIDIOptions.sysex` | OPT-OUT | Request `{ sysex: false }` (D-11, fingerprinting) |
| Note on (`9n`) | INTEGRATE | MIDI-01 / D-14 |
| Note off (`8n`) | INTEGRATE | MIDI-01 / D-14 |
| Velocity 1–127 | INTEGRATE | D-14; velocity 0 note-on rewritten to note-off |
| Note-off velocity | OPT-OUT | D-14 ignore |
| Control change | OPT-OUT | D-11 |
| Pitch bend | OPT-OUT | D-11 |
| Program change | OPT-OUT | D-11 |
| MIDI clock / real-time | OPT-OUT | D-11 |
| SysEx (`F0`… / `>= 0xF0`) | OPT-OUT | D-11, D-28 |
| Connect / disconnect (`onstatechange`) | INTEGRATE | D-04 |
| Channel filter | OPT-OUT | D-07 omni |
| `localStorage` get/set/remove | INTEGRATE | PERSIST-01; one key only |
| File download (`Blob` + `<a download>`) | INTEGRATE | D-25 export |
| File picker (`<input type="file">`) | INTEGRATE | D-25 import |

No npm packages. No `webmidi` wrapper. No IndexedDB.
