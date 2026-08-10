# Phase 5: First playable approximation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-06
**Phase:** 5-First playable approximation
**Areas discussed:** Algorithm coverage, Gain & retrigger behavior, Input surface, Approximation labeling

---

## Algorithm coverage

| Option | Description | Selected |
|--------|-------------|----------|
| All 32 algorithms (Recommended) | Matches the already-built browser/diagram scope; a generic edge-traversal patching approach should cost about the same to build for 32 as for 2, and makes "no stuck voices after algorithm switch" true for any switch. | ✓ |
| Focused subset (Algorithm 32 + Algorithm 1) | Matches Phase 6's upcoming lesson pair; smaller surface but risks a per-algorithm special case the domain rules otherwise avoid. | |
| You decide | Let the planner pick based on what's technically cheapest. | |

**User's choice:** All 32 algorithms
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Live reroute (Recommended) | Switching mid-note immediately re-patches the held voice to the new algorithm's routing — matches real DX7 behavior and the app's core value. | ✓ |
| Deferred until next note-on | Switching mid-note is recorded but the audible routing only updates on the next noteOn — simpler, but diagram and sound could visibly disagree. | |

**User's choice:** Live reroute
**Notes:** None.

---

## Gain & retrigger behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed safety-clamped gain (Recommended) | One conservative internal ceiling plus short gain ramps; matches ROADMAP.md's Phase 5 success criteria, which say nothing about a volume UI. | ✓ |
| User-facing volume slider | Adds a real control now; pulls in slider UI/a11y work ROADMAP.md didn't scope for this phase. | |

**User's choice:** Fixed safety-clamped gain
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Cut old, start new immediately (Recommended) | The held note is released with a short gain ramp and the new note starts fresh — simplest deterministic single-voice model, easiest to prove no stuck voices. | ✓ |
| Legato retrigger on the same voice | The new note's pitch takes over the existing voice without a new envelope attack — more expressive, but adds envelope-state complexity this MVP doesn't have. | |
| Ignore new note until release | The new key press is dropped while a note is held — simplest, but would feel unresponsive. | |

**User's choice:** Cut old, start new immediately
**Notes:** None.

---

## Input surface

| Option | Description | Selected |
|--------|-------------|----------|
| Both (Recommended) | On-screen clickable/tappable keys plus computer-keyboard mapping — matches ROADMAP_SEED's "On-screen/computer keyboard" phrasing and ACCEPTANCE_CRITERIA's keyboard-access requirement. | ✓ |
| On-screen only this phase | Clickable/tappable keys only; computer-keyboard mapping deferred. Smaller scope but doesn't match the seed doc's phrasing for this phase. | |

**User's choice:** Both
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Inside Playground, replacing part of its placeholder (Recommended) | Fulfills Playground's existing "On-screen and computer keyboard, monophonic to start" bullet — one integration point instead of a second play surface to reconcile later. | ✓ |
| A separate minimal play view for this phase | A new, smaller route/component dedicated to enable-audio + play/release, leaving Playground untouched until later. Cleaner isolation but means moving/merging this UI into Playground later. | |

**User's choice:** Inside Playground, replacing part of its placeholder
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| One octave, fixed (Recommended) | 12 keys (e.g. C4–B4), no octave-shift control. Enough range to hear ratio/timbre changes without building octave-shift UI/state this phase. | ✓ |
| Multiple octaves with a shift control | Adds an octave-up/down control (extra UI + shortcut + a11y labeling) for wider range immediately. | |

**User's choice:** One octave, fixed
**Notes:** None.

---

## Approximation labeling

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent badge/label near the play control (Recommended) | A short, always-visible label sitting right next to the keyboard/enable-audio control — seen every time the learner plays. | ✓ |
| One-time inline copy above the play surface | A sentence of explanatory copy near the top, read once — lighter-weight but easy to scroll past. | |
| Dedicated info panel/tooltip | A collapsible panel/tooltip with fuller explanation — more detail, but requires an extra interaction to see at all. | |

**User's choice:** Persistent badge/label near the play control
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit "Enable audio" button gating the keyboard (Recommended) | The play surface shows a clear, labelled action first; the keyboard is inert (visibly so) until the gesture resolves the AudioContext to 'ready'. Matches the seed prompt's "friendly Enable audio state." | ✓ |
| Keyboard always visible, first keypress triggers audio start | No separate enable step — the first note-on attempt is the gesture. Fewer clicks, but harder to show a distinct 'unavailable' state cleanly. | |

**User's choice:** Explicit "Enable audio" button gating the keyboard
**Notes:** None.

---

## Claude's Discretion

- Exact voice-allocation/patching code shape for the generic 32-algorithm oscillator graph, including how feedback self-loops and multi-hop modulation chains are approximated with Web Audio's node graph.
- Exact DI-adapter shape for `AudioContext`/oscillator construction (mirroring `MotionPreference`/`MATCH_MEDIA`).
- Exact computer-keyboard-to-note key mapping, key-repeat suppression, and focus-management interaction.
- Exact numeric value of the fixed safety-clamped master gain and the millisecond length of click-prevention gain ramps.
- Exact conversion formulas from `OperatorParameters`' DX7-integer scales to Web Audio gain/frequency values.
- Exact wording/placement/CSS for the approximation badge and the "Enable audio" state.
- Whether Vitest-level audio boundary tests fake the whole `AudioContext`/node graph or a narrower seam.

## Deferred Ideas

- A user-facing master volume slider — belongs to Playground's later full "Master controls" assembly, not this phase's fixed safety-clamped gain.
- An octave-shift control for the on-screen/computer keyboard — this phase ships one fixed octave only.
- Legato retrigger (new note takes over the held voice's envelope without a fresh attack) — this phase always cuts and restarts; legato could be revisited once Phase 9 designs the real envelope.
