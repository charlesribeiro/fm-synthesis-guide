---
phase: 05-first-playable-approximation
plan: 03
subsystem: ui
tags: [angular-signals, host-listeners, web-audio, accessibility, keyboard-input, vitest]

# Dependency graph
requires:
  - phase: 05-01
    provides: gesture-gated WebAudioSynthEngine, SYNTH_ENGINE token, Playground Enable-audio gate + single playable C4 key + persistent approximation label
provides:
  - PLAYABLE_KEYS frozen 12-entry lookup table (note/name/computer-key-code/hint/isSharp) + noteForKeyCode()
  - Playground full 12-key play surface (on-screen pointer input + computer-keyboard input) reading the one table
  - Every note-ending path wired: pointerup/pointerleave/pointercancel, keyup, window blur, component destroy
  - Non-color-only inert (pre-ready) and pressed (sounding) key states per 05-UI-SPEC.md
affects: [05-04-listening-checkpoint]

# Actuals (#2632)
actuals:
  tokens: 6978
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Frozen-array constant + membership-guard/lookup function for a restricted value set (keyboard-note-map.ts mirrors COARSE_RATIOS/isCoarseRatio and SNAPSHOT_SLOTS/isSnapshotSlot)"
    - "Angular host metadata global-target event bindings ((document:keydown), (document:keyup), (window:blur)) instead of manual addEventListener, for automatic teardown"
    - "Ordered early-return guard chain on a shared input handler (ready → repeat → modifier → editable-target → unmapped), each guard independently named-tested"

key-files:
  created:
    - src/app/features/playground/keyboard-note-map.ts
    - src/app/features/playground/keyboard-note-map.spec.ts
  modified:
    - src/app/features/playground/playground.ts
    - src/app/features/playground/playground.html
    - src/app/features/playground/playground.scss
    - src/app/features/playground/playground.spec.ts

key-decisions:
  - "releaseKey(note) always calls engine.noteOff(note) unconditionally, and only clears the local heldNote signal when it still equals that note — mirrors the engine's own stale-release rule (D-04) so a superseded key release can never clear the state of the note now sounding."
  - "Guard order in the document keydown handler is fixed: not-ready, then event.repeat, then any modifier (ctrl/meta/alt), then editable target, then unmapped code — matches the plan's literal ordering so each guard's failure mode is independently testable and unambiguous."
  - "Space/Enter activation on a focused key button is handled locally on the button (not routed through the document-level handler), since Space/Enter are not codes in PLAYABLE_KEYS and would otherwise be silently ignored by the document handler's unmapped-code guard."
  - "Sharp keys get --color-bg (the page's darkest existing surface token) rather than a new token — keeps 05-UI-SPEC.md's 'no new design tokens this phase' constraint while giving sharps a visually darker treatment than naturals' --color-surface-raised."

patterns-established:
  - "keyboard-note-map.ts: one frozen source-of-truth table read by both the on-screen key list and the computer-key handler — no ad hoc Map assembled inline in a component, no way for the two input surfaces to disagree about which key is which note."

requirements-completed: [AUDIO-01, AUDIO-02, AUDIO-03]

coverage:
  - id: D1
    description: "All 12 keys of the fixed C4-B4 octave render unconditionally on mount, in both gate states, driven only by engine status (never conditional rendering of the keys themselves)"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#renders exactly 12 key buttons before and after audio is enabled, in ascending note order"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#marks every key out of the tab order and aria-disabled before ready, and neither once ready"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both pointer and computer-keyboard input paths reach the same engine, with a fixed nominal velocity and the correct note resolved from PLAYABLE_KEYS"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#plays and releases a specific key with pointerdown/pointerup, calling the engine with that note"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#plays and releases a note from the computer keyboard via document keydown/keyup"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#starts and ends a note with Space on a focused key button"
        status: pass
    human_judgment: false
  - id: D3
    description: "Holding a computer key sustains one note (OS auto-repeat suppressed via event.repeat); modifier-held, editable-target, and unmapped-code keydowns are all silently ignored"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#does not retrigger on an OS auto-repeat keydown (event.repeat)"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#does not play when a modifier key is held"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#does not play when the event target is an editable element"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#does not play on an unmapped code"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every way a note can end (pointerup, pointerleave, pointercancel, keyup, window blur, component destroy) reaches the engine and cannot strand a voice"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#ends the note on pointerleave, exactly as pointerup does"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#ends the note on pointercancel, exactly as pointerup does"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#calls allNotesOff on window blur while a note is held"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#calls allNotesOff when the component is destroyed"
        status: pass
    human_judgment: false
  - id: D5
    description: "The sounding key is marked aria-pressed plus a non-color physical inset/offset treatment; the inert pre-ready keyboard is marked aria-disabled/tabindex=-1/cursor:not-allowed plus reduced opacity — three independent non-color signals in each case"
    requirement: "AUDIO-02"
    verification:
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#marks exactly one key aria-pressed=\"true\" while a note sounds, all others \"false\""
        status: pass
      - kind: other
        ref: "grep -c 'cursor: not-allowed' src/app/features/playground/playground.scss"
        status: pass
    human_judgment: false
  - id: D6
    description: "playground.scss meets the UI contract's touch-target, overflow-scroll, reduced-motion, spacing-token, and no-new-hex-color requirements"
    requirement: "AUDIO-02"
    verification:
      - kind: other
        ref: "npm run build (no anyComponentStyle budget warning) + grep contract checks (overflow-x, 44px floor, not-allowed, prefers-reduced-motion, space-tokens, zero hex colors)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The approximation badge remains unconditional and correctly worded across the expanded surface, and never becomes conditional on status"
    requirement: "AUDIO-03"
    verification:
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#shows the approximation label before and after enabling audio"
        status: pass
    human_judgment: false

duration: ~12min
completed: 2026-08-07
status: complete
---

# Phase 5 Plan 3: Full 12-key play surface — on-screen and computer keyboard Summary

**PLAYABLE_KEYS frozen lookup table drives both a 12-key on-screen keyboard and a document-level computer-keyboard handler, with every note-ending path (pointerup/leave/cancel, keyup, window blur, destroy) wired through the same stale-release-safe pressKey/releaseKey pair.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-07T02:30Z (approx., first file write)
- **Completed:** 2026-08-07T02:42Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 extended)

## Accomplishments

- `keyboard-note-map.ts`: frozen `PLAYABLE_KEYS` table (12 entries, C4-B4) plus `noteForKeyCode()`, mirroring `COARSE_RATIOS`/`isCoarseRatio`'s frozen-array + guard convention; range asserted against `value-conversion.ts`'s `MIN_MIDI_NOTE`/`MAX_MIDI_NOTE` at module load rather than a parallel bound
- `Playground` expanded from the tracer's single key to the full 12-key surface: pointer input (pointerdown/up/leave/cancel), computer-keyboard input via `(document:keydown)`/`(document:keyup)`/`(window:blur)` host bindings, and Space/Enter activation on a focused key button
- `pressKey`/`releaseKey` mirror the engine's D-04 stale-release rule: `releaseKey` always calls `engine.noteOff(note)` but only clears local `heldNote` state when it still matches, so a superseded release can never clear the note now sounding
- Document keydown guard chain in the plan's exact order (not-ready → `event.repeat` → modifier held → editable target → unmapped code), each guard independently named-tested
- `aria-pressed`/`aria-disabled`/`tabindex` driven purely from `isReady()`/`heldNote` — never conditional rendering of the 12 keys themselves
- Stylesheet: nowrap horizontal-scroll keyboard row, 44px touch floor preserved under the tighter `--space-1` gap, darker `.key--sharp` surface (`--color-bg`, no new token), explicit `prefers-reduced-motion` block, zero hardcoded hex colors

## Task Commits

Each task was committed atomically:

1. **Task 1: PLAYABLE_KEYS — the one table both input surfaces read** - `b6181a4` (test)
2. **Task 2: The full play surface — 12 keys, computer keyboard, and every note-ending path** - `f5aff34` (feat)
3. **Task 3: Playground stylesheet — touch targets, inert and pressed states, reduced motion** - `d203c85` (style)

**Plan metadata:** commit at end of this plan's completion step

## Files Created/Modified

- `src/app/features/playground/keyboard-note-map.ts` - frozen `PLAYABLE_KEYS`/`noteForKeyCode`/`LOWEST_PLAYABLE_NOTE`/`HIGHEST_PLAYABLE_NOTE`
- `src/app/features/playground/keyboard-note-map.spec.ts` - 7 tests: length/order, natural/sharp counts, uniqueness, MIDI-range, boundary lookups, unmapped-code nulls, freeze invariants
- `src/app/features/playground/playground.ts` - `pressKey`/`releaseKey`, document keydown/keyup + window blur host handlers, Space/Enter button handlers, `isReady` computed
- `src/app/features/playground/playground.html` - `@for` over `PLAYABLE_KEYS` inside a `role="group"` container, per-key pointer/keyboard bindings and ARIA
- `src/app/features/playground/playground.scss` - keyboard row, key surfaces (natural/sharp/pressed/inert), badge, reduced-motion block
- `src/app/features/playground/playground.spec.ts` - extended from 6 to 21 tests, one per behavior-block line, driving real DOM/document events and spying on the injected `SYNTH_ENGINE`

## Decisions Made

- `releaseKey(note)` always calls `engine.noteOff(note)` unconditionally, and only clears the local `heldNote` signal when it still equals that note — mirrors the engine's own D-04 stale-release rule so a superseded key release can never clear the state of the note now sounding.
- Guard order in the document keydown handler is fixed exactly as the plan specifies: not-ready, then `event.repeat`, then any modifier (ctrl/meta/alt), then editable target, then unmapped code — each guard is independently named-tested so a regression in one guard fails a specific, attributable test.
- Space/Enter activation is handled locally on each key button rather than routed through the document-level handler, since Space/Enter are not `KeyboardEvent.code`s present in `PLAYABLE_KEYS` and the document handler's unmapped-code guard would otherwise silently swallow them.
- Sharp keys use `--color-bg` (the page's darkest existing surface token, already used for the page background) rather than a new token, satisfying `05-UI-SPEC.md`'s "no new design tokens this phase" while giving sharps a visually darker treatment than naturals' `--color-surface-raised`.

## Deviations from Plan

None — plan executed exactly as written. `keyboard-note-map.ts`'s module-load range assertion (`if (LOWEST_PLAYABLE_NOTE < MIN_MIDI_NOTE || HIGHEST_PLAYABLE_NOTE > MAX_MIDI_NOTE) throw ...`) is an explicit application of the plan's own instruction to express the playable range "as a subset of the engine's range rather than a parallel definition" — not a scope addition.

## Issues Encountered

None.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The full 12-key play surface, both input paths, and every note-ending path are proven end-to-end with 21 component tests plus the 7 `keyboard-note-map` tests (28 new tests total; full suite 588 tests green).
- `npm run build`/`npm run lint`/`npm test` all exit 0 with no `anyComponentStyle` budget warning for `playground.scss`.
- Plan `05-04`'s listening checkpoint can now audition the fixed `MASTER_GAIN` clamp across the full playable octave and across algorithms, since every key (not just C4) is wired through the same engine path.
- `05-02`'s modulation-routing work (parallel wave, disjoint files) is unaffected — this plan touched only `keyboard-note-map.*` and `playground.*`, never `patch-plan.ts`/`value-conversion.ts`/`web-audio-synth-engine.ts`.

---
*Phase: 05-first-playable-approximation*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: src/app/features/playground/keyboard-note-map.ts
- FOUND: src/app/features/playground/keyboard-note-map.spec.ts
- FOUND: .planning/phases/05-first-playable-approximation/05-03-SUMMARY.md
- FOUND: b6181a4 (test: PLAYABLE_KEYS)
- FOUND: f5aff34 (feat: full play surface)
- FOUND: d203c85 (style: playground stylesheet)
- FOUND: 27b8c2b (docs: SUMMARY.md)
