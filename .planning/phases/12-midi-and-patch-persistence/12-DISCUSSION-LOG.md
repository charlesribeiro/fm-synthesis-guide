# Phase 12: MIDI and patch persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-08
**Phase:** 12-midi-and-patch-persistence
**Areas discussed:** MIDI permission and device picker, MIDI notes vs the monophonic engine,
What survives reload, Import/export and bad-data recovery

---

## MIDI permission and device picker

| Option | Description | Selected |
|--------|-------------|----------|
| Playground only | Enable MIDI next to Enable audio | |
| New /settings only | MIDI lives with persistence controls | |
| Both | Enable on play surface; Settings holds picker/status | ✓ |

**User's choice:** Both

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-select first plus picker | First available after permission; Settings picker to change | ✓ |
| Must pick | Do not listen until the user picks | |
| Auto-select only | No picker this phase | |

**User's choice:** Auto-select first plus picker

| Option | Description | Selected |
|--------|-------------|----------|
| Remember and wait | Disconnect shows disconnected; reattach if it returns; no silent switch | ✓ |
| Fallback next | Immediately auto-select the next available input | |
| Stop until Settings | Stop listening until the user picks again | |

**User's choice:** Remember and wait

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct named states | unsupported / denied / no devices / disconnected / ready | ✓ |
| Hide when missing API | Hide all MIDI UI without Web MIDI | |
| One generic message | Single “MIDI unavailable” copy | |

**User's choice:** Distinct named states

| Option | Description | Selected |
|--------|-------------|----------|
| Same click also enables audio | Enable MIDI starts audio if needed | ✓ |
| MIDI only | Notes silent until a separate Enable audio click | |
| You decide | | |

**User's choice:** Same click also enables audio

| Option | Description | Selected |
|--------|-------------|----------|
| Omni | All MIDI channels | ✓ |
| Channel 1 only | | |
| Channel picker | 1–16 plus omni on Settings | |

**User's choice:** Omni

| Option | Description | Selected |
|--------|-------------|----------|
| Primary nav | Add Settings to primary nav | ✓ |
| Footer only | Keep nav; link Settings from footer/Playground | |
| You decide | | |

**User's choice:** Primary nav

| Option | Description | Selected |
|--------|-------------|----------|
| Play surface everywhere | Enable MIDI on shared PlaySurface; notes in lessons too | ✓ |
| Playground button, global notes | Enable only on Playground; notes also in lessons | |
| Playground only | Enable and notes Playground-only | |

**User's choice:** Play surface everywhere

| Option | Description | Selected |
|--------|-------------|----------|
| Always click after reload | Never requestMIDIAccess on boot | ✓ |
| Auto-reconnect if previously enabled | | |
| You decide | | |

**User's choice:** Always click after reload

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit Disable MIDI | Play surface and Settings | ✓ |
| One-way for the session | | |
| Settings-only disable | | |

**User's choice:** Explicit Disable MIDI

| Option | Description | Selected |
|--------|-------------|----------|
| allNotesOff on stop | Disable or disconnect silences held MIDI notes | ✓ |
| Leave sounding | Only device note-off ends them | |
| You decide | | |

**User's choice:** allNotesOff on stop

| Option | Description | Selected |
|--------|-------------|----------|
| Short status plus device name | On play surface when ready | ✓ |
| Enable/Disable only on play surface | Device name Settings-only | |
| You decide | | |

**User's choice:** Short status plus device name

| Option | Description | Selected |
|--------|-------------|----------|
| Keep selected, mark disconnected | Until it returns or user picks another | ✓ |
| Clear picker on disconnect | | |
| You decide | | |

**User's choice:** Keep selected, mark disconnected

| Option | Description | Selected |
|--------|-------------|----------|
| Live device list | Updates as ports appear/disappear | ✓ |
| Snapshot on Settings load | | |
| You decide | | |

**User's choice:** Live device list

| Option | Description | Selected |
|--------|-------------|----------|
| One toggle | Enable MIDI / Disable MIDI | ✓ |
| Two separate controls | | |
| You decide | | |

**User's choice:** One toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Settings can also enable | Permission without visiting Playground | ✓ |
| Play surface only requests permission | | |
| You decide | | |

**User's choice:** Settings can also enable

| Option | Description | Selected |
|--------|-------------|----------|
| Iterator order | First in MIDIAccess.inputs, no name heuristics | ✓ |
| Prefer keyboard-like names | | |
| You decide | | |

**User's choice:** Iterator order

| Option | Description | Selected |
|--------|-------------|----------|
| No footer MIDI indicator | Status stays on play surface and Settings | ✓ |
| Footer status line | Like reduced-motion indicator | |
| You decide | | |

**User's choice:** No footer MIDI indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Do not move focus | After Enable MIDI | ✓ |
| Move focus to first on-screen key | Mirrors Enable audio | |
| You decide | | |

**User's choice:** Do not move focus

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore non-note messages silently | CC, pitch bend, PC, clock, SysEx | ✓ |
| Ignore but mention on Settings | | |
| You decide | | |

**User's choice:** Ignore non-note messages silently

---

## MIDI notes vs the monophonic engine

| Option | Description | Selected |
|--------|-------------|----------|
| Full MIDI range 0–127 | | ✓ |
| Clamp to C4–B4 | | |
| C3–B5 only | | |

**User's choice:** Full MIDI range 0–127

| Option | Description | Selected |
|--------|-------------|----------|
| Engine last-note-wins | No hold stack | ✓ |
| Last-note-wins with hold stack | Release resumes previous held MIDI note | |
| First-note-wins | Ignore new note-ons while sounding | |

**User's choice:** Engine last-note-wins

| Option | Description | Selected |
|--------|-------------|----------|
| Pass velocity 1–127 | Note-off velocity ignored | ✓ |
| Always velocity 100 | | |
| You decide | | |

**User's choice:** Pass velocity 1–127

| Option | Description | Selected |
|--------|-------------|----------|
| Highlight in-range keys | C4–B4 only | ✓ |
| No MIDI highlighting | | |
| Highlight pitch class in any octave | | |

**User's choice:** Highlight in-range keys

| Option | Description | Selected |
|--------|-------------|----------|
| Velocity 0 is note-off | MIDI spec | ✓ |
| Ignore velocity-0 note-ons | | |
| You decide | | |

**User's choice:** Velocity 0 is note-off

| Option | Description | Selected |
|--------|-------------|----------|
| MIDI counts for lesson play-check | Through shared press/release | ✓ |
| Lessons ignore MIDI for completion | | |
| You decide | | |

**User's choice:** MIDI counts for lesson play-check

| Option | Description | Selected |
|--------|-------------|----------|
| Third owner / shared hold count | MIDI + on-screen key same note | ✓ |
| MIDI note-off always ends engine note | | |
| You decide | | |

**User's choice:** Third owner / shared hold count

| Option | Description | Selected |
|--------|-------------|----------|
| Sound only outside C4–B4 | No extra pitch readout | ✓ |
| Status includes pitch name | | |
| You decide | | |

**User's choice:** Sound only outside C4–B4

---

## What survives reload

| Option | Description | Selected |
|--------|-------------|----------|
| Persist lesson completion | | ✓ |
| Keep LessonProgress session-only | | |

**User's choice:** Persist lesson completion

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-save last Playground patch | No named library | ✓ |
| Named library only | | |
| Both auto-save and named library | | |

**User's choice:** Auto-save last Playground patch

| Option | Description | Selected |
|--------|-------------|----------|
| A/B session-only | | ✓ |
| Persist A and B slots | | |
| You decide | | |

**User's choice:** A/B session-only

| Option | Description | Selected |
|--------|-------------|----------|
| Remember last MIDI device id | Applied after Enable MIDI | ✓ |
| Do not remember the device | | |
| You decide | | |

**User's choice:** Remember last MIDI device id

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated Playground slot | Lessons must not overwrite it | ✓ |
| Auto-save whatever InstrumentState is | Including in a lesson | |
| You decide | | |

**User's choice:** Dedicated Playground slot

| Option | Description | Selected |
|--------|-------------|----------|
| Restore on entering Playground | Even within a session | ✓ |
| Restore on full reload only | | |
| You decide | | |

**User's choice:** Restore on entering Playground

| Option | Description | Selected |
|--------|-------------|----------|
| One Clear saved data control | Progress + Playground slot + MIDI device id | ✓ |
| No in-app clear | | |
| Separate clear controls | | |

**User's choice:** One Clear saved data control

| Option | Description | Selected |
|--------|-------------|----------|
| Write on every Playground-originated change | | ✓ |
| Write only when leaving /playground | | |
| You decide | | |

**User's choice:** Write on every Playground-originated change

---

## Import/export and bad-data recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Whole versioned document | schema + patch + progress + last MIDI device | ✓ |
| Playground patch only | | |
| Two exports | Share patch and Backup everything | |

**User's choice:** Whole versioned document

| Option | Description | Selected |
|--------|-------------|----------|
| Replace all after confirmation | | ✓ |
| Union lesson progress, replace patch | | |
| Apply patch only | | |

**User's choice:** Replace all after confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| File download and file picker | | ✓ |
| Copy/paste textarea | | |
| Files and textarea | | |

**User's choice:** File download and file picker

| Option | Description | Selected |
|--------|-------------|----------|
| Stored → defaults + explain; import → refuse | Import failure never destructive | ✓ |
| Any malformed JSON resets everything | | |
| Keep valid fields, drop invalid ones | | |

**User's choice:** Stored → defaults + explain; import → refuse

| Option | Description | Selected |
|--------|-------------|----------|
| Known schema v1 only | Unknown/missing version is malformed | ✓ |
| Accept if patch validates without version | | |
| You decide | | |

**User's choice:** Known schema v1 only

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore extra keys on valid v1 | | ✓ |
| Reject extra keys | | |
| You decide | | |

**User's choice:** Ignore extra keys on valid v1

| Option | Description | Selected |
|--------|-------------|----------|
| Original JSON only | Dexed/SysEx/ROM refused | ✓ |
| You decide | | |

**User's choice:** Original JSON only

| Option | Description | Selected |
|--------|-------------|----------|
| Apply immediately after successful import | | ✓ |
| Reload required | | |
| You decide | | |

**User's choice:** Apply immediately after successful import

---

## Claude's Discretion

Storage adapter (`localStorage` vs IndexedDB), exact JSON field names and filename, MIDI
adapter DI surface, Settings layout, status copy, how Playground-originated writes are
detected, confirmation-dialog copy.

## Deferred Ideas

None new. Named patch library, A/B persistence, MIDI CC/SysEx, polyphony/hold-stack, and
auto-reconnect on boot were considered and rejected or already belong to other phases.
