---
status: complete
phase: 12-midi-and-patch-persistence
source: [12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 12-04-SUMMARY.md]
started: 2026-09-17T19:13:44Z
updated: 2026-09-18T19:27:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start the app from scratch with `npm start`. The shell boots without errors. Opening the homepage loads live content, and the primary nav shows Learn, Algorithms, Playground, Settings, and About.
result: pass

### 2. Confirm Phase 12 MIDI and persistence in the running app
expected: |
  With the app running, the shipped Phase 12 behavior is usable: Settings is in the primary nav;
  Enable MIDI (Playground or Settings) does not steal keyboard focus and the app still plays from
  on-screen keys if MIDI is denied or absent; completing a lesson still looks complete after a
  reload; Randomize/Reset on Playground survive leaving and returning, while A/B capture does not
  become the saved Playground sound; a lesson starting patch does not overwrite that saved sound;
  Settings export/import/clear match the confirm-and-replace rules (failed import keeps current
  data; clear does not smash a live lesson). Automated coverage below already passed in Vitest.
result: pass

### 3. parseSavedDocument never throws on the hostile matrix; extra keys on valid v1 are ignored
expected: parseSavedDocument never throws on the hostile matrix (non-object, array root, missing/v2 schema, seventh operator, Dexed-shaped, throwing getter, __proto__-only); extra keys on valid v1 are ignored
result: pass
source: automated
coverage_id: 12-01-D1

### 4. JSON round-trip of defaultSavedDocument yields schemaVersion 1
expected: JSON round-trip of defaultSavedDocument yields schemaVersion 1 and numeric operator keys after rebuild
result: pass
source: automated
coverage_id: 12-01-D2

### 5. Missing or unparseable storage recovers; quota setItem keeps in-memory document
expected: Missing storage hydrates defaults; unparseable storage resets to defaults with a recoveryMessage; quota setItem keeps in-memory document and sets writeError
result: pass
source: automated
coverage_id: 12-01-D3

### 6. LessonProgress survives a simulated reload
expected: LessonProgress.markComplete then a second TestBed sharing FakeStorage plus hydrateLive still reports the lesson complete (D-18)
result: pass
source: automated
coverage_id: 12-01-D4

### 7. PlaygroundPatchSlot.write is isolated from markComplete
expected: PlaygroundPatchSlot.write updates only playgroundPatch; markComplete does not change the written patch (D-21, D-22)
result: pass
source: automated
coverage_id: 12-01-D5

### 8. InstrumentState.replacePatch is atomic and storage-free
expected: InstrumentState.replacePatch atomically restores algorithm, operators, and feedback and does not touch snapshots or STORAGE
result: pass
source: automated
coverage_id: 12-01-D6

### 9. parseMidiNoteMessage maps note-on/off and ignores CC/SysEx
expected: parseMidiNoteMessage note-on 0x90 vel 100, vel-0 as off, 0x80 off, omni 0x9F, and null for CC/short/note 128/null/hostile getter
result: pass
source: automated
coverage_id: 12-02-D1

### 10. MidiSession does not request MIDI on construction
expected: MidiSession construction does not call requestMIDIAccess; null token is unsupported; first values() port selected with { sysex: false }
result: pass
source: automated
coverage_id: 12-02-D2

### 11. Enable MIDI does not move focus
expected: Enable MIDI does not move focus; Enable audio still focuses the first .key; same click starts audio if suspended
result: pass
source: automated
coverage_id: 12-02-D3

### 12. MIDI velocity 80 sounds; velocity 0 never calls noteOn(0)
expected: MIDI note-on velocity 80 calls noteOn(60, 80) and emits notePlayed 60; velocity 0 never calls noteOn with 0
result: pass
source: automated
coverage_id: 12-02-D4

### 13. Named MIDI states, no silent switch, disconnect allNotesOff
expected: Named states, D-04 no silent switch, selected disconnect allNotesOff, disable keeps access, CC ignored
result: pass
source: automated
coverage_id: 12-02-D5

### 14. MIDI plus pointer share C4; out-of-octave notes sound without extra keys
expected: MIDI+pointer share C4 hold count; note 48 sounds with no extra key; disconnect clears MIDI highlight
result: pass
source: automated
coverage_id: 12-02-D6

### 15. Entering Playground restores the saved slot
expected: Entering Playground applies PlaygroundPatchSlot.read() through InstrumentState.replacePatch, so a previously selected live algorithm does not remain (D-21)
result: pass
source: automated
coverage_id: 12-03-D1

### 16. ToolsPanel Reset and Randomize write the Playground slot
expected: ToolsPanel Reset writes DEFAULT_PATCH to the slot; Randomize writes the live operators object by reference (D-22)
result: pass
source: automated
coverage_id: 12-03-D2

### 17. Capture A does not write the Playground slot
expected: Capture A does not change PlaygroundPatchSlot.read() (D-19, A/B stay session-only)
result: pass
source: automated
coverage_id: 12-03-D3

### 18. Playground restores in the constructor only
expected: playground.ts contains no effect( call — constructor restore only (A5)
result: pass
source: automated
coverage_id: 12-03-D4

### 19. Lesson startingPatch does not write the Playground slot
expected: Opening /learn/algorithm-32 still applies startingPatch and PlaygroundPatchSlot.write is never called; read() remains DEFAULT_PATCH
result: pass
source: automated
coverage_id: 12-03-D5

### 20. Primary nav includes Settings with the Settings title
expected: Primary nav is Learn, Algorithms, Playground, Settings, About; lazy /settings title is Settings — DX7 Algorithm Lab (D-02)
result: pass
source: automated
coverage_id: 12-04-D1

### 21. Enable MIDI prefers the saved device id
expected: Settings Enable MIDI with a saved port-B id selects B despite A being first in values() (D-20)
result: pass
source: automated
coverage_id: 12-04-D2

### 22. Last device id does not auto-enable MIDI on boot
expected: Injecting MidiSession with a pre-filled lastMidiDeviceId does not call requestMIDIAccess (D-08)
result: pass
source: automated
coverage_id: 12-04-D3

### 23. Disconnected selected port stays listed
expected: Disconnected selected port remains in the Settings select with disconnected in the label (D-04)
result: pass
source: automated
coverage_id: 12-04-D4

### 24. Failed import leaves storage unchanged
expected: Failed import (oversize, Dexed-shaped, confirm cancelled) leaves storage unchanged (D-26, D-28)
result: pass
source: automated
coverage_id: 12-04-D5

### 25. Successful extra-key v1 import hydrates and can apply the Playground patch
expected: Successful extra-key v1 import hydrates LessonProgress and applies the playground patch when url is /playground (D-25)
result: pass
source: automated
coverage_id: 12-04-D6

### 26. Confirmed clear restores defaults without smashing a live lesson
expected: Confirmed clear restores defaults, disables MIDI, and does not smash a live lesson patch (D-23)
result: pass
source: automated
coverage_id: 12-04-D7

### 27. Settings does not assign imported bytes as HTML
expected: Settings templates do not assign imported bytes as HTML markup
result: pass
source: automated
coverage_id: 12-04-D8

## Summary

total: 27
passed: 27
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
