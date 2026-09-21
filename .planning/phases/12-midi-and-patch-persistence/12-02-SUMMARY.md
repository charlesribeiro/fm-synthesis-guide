---
phase: 12-midi-and-patch-persistence
plan: 02
subsystem: midi
tags: [angular, vitest, web-midi, play-surface, midi-session]
status: complete

requires:
  - phase: 05-first-playable-approximation
    provides: AUDIO-01 gesture gate, SYNTH_ENGINE noteOn/noteOff/allNotesOff, MIN_VELOCITY 1
  - phase: 06-guided-lessons
    provides: PlaySurface pressKey/releaseKey, noteHoldCount, notePlayed, Enable-audio focus
  - phase: 08-algorithm-routing-and-feedback
    provides: WorkletSynthEngine last-note-wins, validateVelocity RangeError on 0

provides:
  - REQUEST_MIDI_ACCESS InjectionToken with hand-rolled MidiAccessLike (factory never calls requestMIDIAccess)
  - FakeMidiInput / FakeMidiAccess / createFakeRequestMidiAccess
  - parseMidiNoteMessage fail-closed domain parser (omni, vel-0 as off, ignore CC/SysEx)
  - MidiSession root facade (off/unsupported/permission-denied/no-devices/disconnected/ready)
  - PlaySurface Enable MIDI / Disable MIDI, initializeAudio split, MIDI as third noteHoldCount owner

affects: [12-03-playground-restore, 12-04-settings-midi-picker]

actuals:
  tokens: 10415
  tasks: 2
  commits: 6

tech-stack:
  added: []
  patterns:
    - "REQUEST_MIDI_ACCESS factory feature-detects; only MidiSession.enable invokes the returned function with { sysex: false }"
    - "initializeAudio() resumes the engine without focusing a key; enableAudio() still focuses the first .key"
    - "MIDI notes go through pressKey(note, velocity)/releaseKey so notePlayed fires; velocity 0 never reaches engine.noteOn"

key-files:
  created:
    - src/app/core/browser/midi-access.token.ts
    - src/app/core/midi/testing/fake-midi-access.ts
    - src/app/domain/dx7/midi/parse-midi-note-message.ts
    - src/app/domain/dx7/midi/parse-midi-note-message.spec.ts
    - src/app/core/midi/midi-session.ts
    - src/app/core/midi/midi-session.spec.ts
  modified:
    - src/app/features/play-surface/play-surface.ts
    - src/app/features/play-surface/play-surface.html
    - src/app/features/play-surface/play-surface.spec.ts

key-decisions:
  - "PlaySurface uses effect()+untracked to release MIDI-owned notes when MidiSession.status leaves ready — imperative MIDIAccess sync (D-09), not derived UI state."
  - "MIDI toggle is not wrapped in .gate so Playground's Enable-audio assertion that .gate disappears still holds."
  - "This plan auto-selects the first MIDIAccess.inputs iterator port; MidiSession does not inject SavedDocumentStore (D-20 is 12-04)."

patterns-established:
  - "Fake MIDIAccess Map insertion order is D-03 auto-select; disconnect keeps the port in the map with connected: false (D-04)."
  - "Find Enable MIDI / Disable MIDI by accessible name; button.button--primary remains Enable audio."

requirements-completed: [MIDI-01]

coverage:
  - id: D1
    description: "parseMidiNoteMessage note-on 0x90 vel 100, vel-0 as off, 0x80 off, omni 0x9F, and null for CC/short/note 128/null/hostile getter"
    requirement: MIDI-01
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/midi/parse-midi-note-message.spec.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "MidiSession construction does not call requestMIDIAccess; null token is unsupported; first values() port selected with { sysex: false }"
    requirement: MIDI-01
    verification:
      - kind: unit
        ref: "src/app/core/midi/midi-session.spec.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Enable MIDI does not move focus; Enable audio still focuses the first .key; same click starts audio if suspended"
    requirement: MIDI-01
    verification:
      - kind: unit
        ref: "src/app/features/play-surface/play-surface.spec.ts#does not move focus after Enable MIDI succeeds"
        status: pass
    human_judgment: false
  - id: D4
    description: "MIDI note-on velocity 80 calls noteOn(60, 80) and emits notePlayed 60; velocity 0 never calls noteOn with 0"
    requirement: MIDI-01
    verification:
      - kind: unit
        ref: "src/app/features/play-surface/play-surface.spec.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Named states, D-04 no silent switch, selected disconnect allNotesOff, disable keeps access, CC ignored"
    requirement: MIDI-01
    verification:
      - kind: unit
        ref: "src/app/core/midi/midi-session.spec.ts#MidiSession named states, disconnect, and disable"
        status: pass
    human_judgment: false
  - id: D6
    description: "MIDI+pointer share C4 hold count; note 48 sounds with no extra key; disconnect clears MIDI highlight"
    requirement: MIDI-01
    verification:
      - kind: unit
        ref: "src/app/features/play-surface/play-surface.spec.ts"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-09-09
---

# Phase 12 Plan 02: MIDI tracer through PlaySurface Summary

**Web MIDI progressive enhancement: feature-detect token, Enable MIDI on PlaySurface without stealing focus, fail-closed note parser, and a named-state MidiSession that owns notes through pressKey/releaseKey**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-09T13:36:34Z
- **Completed:** 2026-09-09T13:43:01Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- `REQUEST_MIDI_ACCESS` feature-detects and never calls `requestMIDIAccess` at factory or construction time; jsdom is honestly `'unsupported'`.
- Enable MIDI starts audio on the same click without moving focus; Enable audio still focuses the first `.key`.
- MIDI note-on 1–127 goes through `pressKey` so `notePlayed` fires; velocity 0 and status `0x80` release; CC/SysEx are ignored; notes 0–127 sound while C4–B4 still highlight.
- Disconnect of the selected port stays on that id (`'disconnected'` + `allNotesOff`); a non-selected disconnect does not switch; disable keeps the access object for a second enable.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** `4b23920` (test) — failing parser/session/PlaySurface MIDI specs
2. **Task 1 GREEN:** `394f983` (feat) — token, fake, parser, MidiSession, PlaySurface MIDI ownership
3. **Task 2 RED:** `723f471` (test) — named states, disconnect, disable, MIDI+pointer, note 48, disconnect highlight
4. **Task 2 GREEN:** `7511155` (feat) — clear MIDI-held notes when session status leaves `'ready'`
5. **Rule 1 fix:** `cffe101` (fix) — MIDI toggle is not wrapped in `.gate`

**Plan metadata:** (this commit)

_Note: TDD tasks used RED then GREEN commits per task._

## Files Created/Modified

- `src/app/core/browser/midi-access.token.ts` — `MidiAccessLike` / `REQUEST_MIDI_ACCESS` factory
- `src/app/core/midi/testing/fake-midi-access.ts` — `FakeMidiInput.emit`, Map-backed ports, recorded request
- `src/app/domain/dx7/midi/parse-midi-note-message.ts` — never-throw omni note parser
- `src/app/domain/dx7/midi/parse-midi-note-message.spec.ts` — on/off/vel0/omni/hostile matrix
- `src/app/core/midi/midi-session.ts` — status machine, one-port `onmidimessage`, `allNotesOff` on disable/disconnect
- `src/app/core/midi/midi-session.spec.ts` — D-08 construction, enable, D-04 disconnect, disable reuse
- `src/app/features/play-surface/play-surface.ts` — `initializeAudio` split, MIDI ownership, status-leave-ready cleanup
- `src/app/features/play-surface/play-surface.html` — MIDI status live region + Enable/Disable MIDI control
- `src/app/features/play-surface/play-surface.spec.ts` — focus, velocity, shared hold, note 48, disconnect highlight

## Decisions Made

- `effect()` + `untracked()` on PlaySurface watches `MidiSession.status` leaving `'ready'` and releases MIDI-owned notes so C4 cannot stay `aria-pressed` after a selected-device disconnect (session already called `allNotesOff`).
- MIDI toggle is a sibling of the audio gate, not a second `.gate`, because Playground asserts `.gate` is gone after Enable audio.
- Last-device id persistence is not injected this plan (D-20 stays 12-04).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MIDI `.gate` wrapper broke Playground Enable-audio spec**
- **Found during:** Task 2 close-out (`npm test`)
- **Issue:** Playground expects `querySelector('.gate')` to be null after Enable audio. Wrapping Enable MIDI in `.gate` left a gate in the DOM.
- **Fix:** Render the MIDI toggle as a `class="button"` sibling, not inside `.gate`.
- **Files modified:** `src/app/features/play-surface/play-surface.html`
- **Verification:** `playground.spec.ts` and full suite 2068/2068 pass
- **Committed in:** `cffe101`

**2. [Rule 2 - Missing Critical] Disconnect left MIDI-held keys highlighted**
- **Found during:** Task 2 RED
- **Issue:** Session `allNotesOff` silenced the engine but PlaySurface `midiHeldNotes` / `aria-pressed` stayed true.
- **Fix:** `effect()` releases MIDI-owned notes when status leaves `'ready'`.
- **Files modified:** `src/app/features/play-surface/play-surface.ts`
- **Verification:** disconnect highlight spec passes; MIDI+pointer hold still passes
- **Committed in:** `7511155`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing-critical)
**Impact on plan:** Both required for D-09 / existing Playground specs. No Settings/persistence scope creep.

## TDD Gate Compliance

- Task 1: RED `4b23920` then GREEN `394f983` — specs failed on missing modules before implementation.
- Task 2: RED `723f471` then GREEN `7511155`. Most session-state specs already passed from Task 1 GREEN (tracer over-implemented the D-04 matrix). The disconnect-highlight spec failed until the PlaySurface effect landed — that was the Task 2 RED tooth.

## Authentication Gates

None.

## Issues Encountered

None beyond the documented `.gate` collision and disconnect highlight.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 12-03 (Playground slot restore) and 12-04 (Settings picker, last-device id). `MidiSession.selectPort` exists for Settings. Provide `REQUEST_MIDI_ACCESS` (or `null`) in any TestBed that constructs PlaySurface. `MIDI-01` Settings/D-20 clauses remain 12-04.

## Self-Check: PASSED

---
*Phase: 12-midi-and-patch-persistence*
*Completed: 2026-09-09*
