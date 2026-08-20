---
phase: 10-visualizers-and-comparison-tools
plan: 04
subsystem: ui
tags: [angular-signals, standalone-component, a11y, web-audio, canvas]

# Dependency graph
requires:
  - phase: 03-signal-instrument-state
    provides: InstrumentState A/B facade (captureSnapshot/recallSnapshot/hasSnapshot/reset)
  - phase: 10-02
    provides: Visualizer component (oscilloscope + labelled spectrum) embedded above the tools panel
  - phase: 10-03
    provides: InstrumentState.randomize() — validated, atomic bounded-random-walk command
provides:
  - "ToolsPanel — six explicit A/B/reset/randomize controls with zero new snapshot/patch state, wired directly onto existing facade commands (`captureSnapshot`/`recallSnapshot` take exactly one slot argument; `reset`/`randomize` take zero)"
  - "Playground assembled end-to-end: play surface, live visualizer, comparison tools, in that document order"
  - "Human-confirmed resolution of 10-RESEARCH.md Assumption A3 (analyser decibel window readability against MASTER_GAIN)"
affects: []

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 6236
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-new-state UI wiring component: computed() wrappers over existing facade predicates drive both disabled state and worded labels from a single source, so the two can never disagree (D-10)"
    - "Single writable signal limited to a last-action status message; no mirroring of the snapshots signal or cached patches"

key-files:
  created:
    - src/app/features/playground/tools-panel/tools-panel.ts
    - src/app/features/playground/tools-panel/tools-panel.html
    - src/app/features/playground/tools-panel/tools-panel.scss
    - src/app/features/playground/tools-panel/tools-panel.spec.ts
  modified:
    - src/app/features/playground/playground.ts
    - src/app/features/playground/playground.html
    - src/app/features/playground/playground.spec.ts

key-decisions:
  - "No A/B toggle switch: recall buttons are two independent actions rather than inventing a 'currently active slot' concept the facade doesn't have (D-09)."
  - "Slot availability is stated in words in the recall button's own label and in a separate slot-state sentence, never by the disabled attribute or colour alone (D-10)."
  - "randomize() is called from exactly one click handler; a named test proves zero calls across component creation, all five other button activations, and destruction (T-10-16)."
  - "Reset dispatches only to InstrumentState.reset() and never touches the snapshot slots (T-10-17)."

patterns-established:
  - "Pattern: a component that adds zero new state logic beyond a last-action status message, dispatching every interaction 1:1 onto a pre-existing, pre-tested state-facade method."

requirements-completed: [VIZ-02]

coverage:
  - id: D1
    description: "ToolsPanel renders exactly six controls (Capture A, Capture B, Recall A, Recall B, Reset, Randomize); captureSnapshot and recallSnapshot are called with exactly one slot argument, while reset and randomize are zero-argument commands; recall buttons are disabled with worded 'empty' labels until captured; Reset preserves both slots; randomize() fires only on explicit activation."
    requirement: VIZ-02
    verification:
      - kind: unit
        ref: "src/app/features/playground/tools-panel/tools-panel.spec.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Playground embeds the tools panel below the visualizer in document order (play surface, visualizer, tools panel) across every audio status, and the coming-soon list no longer claims A/B compare or randomization are future work."
    requirement: VIZ-02
    verification:
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real-browser confirmation that the oscilloscope and spectrum track the live sound and read correctly (including 10-RESEARCH.md Assumption A3's bar-height readability against MASTER_GAIN), that A/B capture/recall/reset behave as designed including a click-free mid-note swap, that Randomize nudges without rerolling the algorithm across repeated presses, that the whole panel is keyboard-operable, and that the reduced-motion path and the honesty of the on-page copy both hold."
    human_judgment: true
    rationale: "None of these ten checks are observable in a headless test environment — they require a real audio device, a real Canvas render, and a human ear/eye judging perceptual quality (waveform tracking, bar readability, click-free audio, musical relatedness of randomize output, visible focus, motion rate). This is exactly the class of claim this plan's blocking checkpoint exists to confirm."

duration: ~5min (tasks 1-2 authoring) + checkpoint wait
completed: 2026-08-19
status: complete
---

# Phase 10 Plan 04: Comparison and Randomization Tools Panel Summary

**Six-control ToolsPanel (Capture A/B, Recall A/B, Reset, Randomize) wired directly onto the existing InstrumentState A/B facade and the plan 10-03 randomize command, embedded below the visualizer in Playground, with zero new snapshot/patch state and a completed blocking listening/viewing checkpoint confirming the whole phase.**

## Performance

- **Duration:** Tasks 1-2 executed in under 5 minutes (commits at 2026-08-18T23:36:31-03:00 and 23:38:22-03:00); Task 3's blocking human-verify checkpoint then ran to completion with a full "approved" pass.
- **Started:** 2026-08-18T23:36:31-03:00 (first task commit)
- **Completed:** 2026-08-19T03:57:30Z (checkpoint approval and this summary)
- **Tasks:** 3 (2 auto tasks + 1 blocking checkpoint)
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- New standalone `app-tools-panel` component (`ToolsPanel`) exposing exactly six real button elements, each dispatching a single call into `InstrumentState`: `captureSnapshot('a'|'b')`, `recallSnapshot('a'|'b')`, `reset()`, `randomize()`.
- Two `computed()` wrappers over `hasSnapshot('a')`/`hasSnapshot('b')` drive both a recall button's `disabled` binding and its worded label from the same source, so the two can never disagree (D-10); a separate plain-text sentence per slot states its captured-or-empty condition independent of the disabled attribute.
- A single writable status-message signal reports the most recent action in words through a live region, with a distinct message per action and per slot — no other component-local state exists.
- A named regression test proves `randomize` is called zero times across component creation, activation of the five other buttons, and destruction, and exactly once when Randomize is pressed (T-10-16).
- A capture-then-patch-change-then-reset-then-recall test proves Reset never disturbs a captured slot (T-10-17).
- Playground now renders, in document order, the play surface, the visualizer, then the tools panel — "play, then see, then compare" — across every audio status the existing suite produces, including when the audio context constructor is unavailable.
- Playground's coming-soon list now holds exactly two entries (algorithm selector, operator strips); the A/B snapshot compare and constrained randomization entry was removed, since both are now real, live regions (D-04).
- **Task 3 — the blocking real-browser listening/viewing checkpoint — was presented in full and the developer responded "approved,"** per the checkpoint's own resume-signal contract, confirming all ten checks as a whole:
  1. Oscilloscope tracks the live sound and its cycle spacing visibly changes with pitch.
  2. Spectrum bars shift right by a consistent visual distance an octave up (log axis) and show separate sideband columns on an audible modulator.
  3. **Bar heights are readable at normal playing level — this resolves `10-RESEARCH.md` Assumption A3: the analyser's default decibel window renders usable bar heights against this project's `MASTER_GAIN = 1/6` mix level with no tuning needed.**
  4. Axis tick labels read 100 Hz / 1 kHz / 10 kHz, legible and correctly positioned.
  5. A/B capture and recall are exact: Capture A, change the sound, Capture B, then A→B→A each restore the corresponding sound exactly, with both recall buttons disabled-and-worded-empty before their first capture.
  6. Mid-note recall (Recall A then Recall B while a note sounds) is click-free — spot-checking Phase 9's already-approved envelope continuity (D-11).
  7. Randomize is a nudge, not a reroll: repeated presses produce audibly related-but-varied results, none silent/distorted/painfully loud, and the selected algorithm never changes.
  8. Reset restores the default patch and leaves both recall buttons enabled with unchanged slot wording; Recall A still works afterward.
  9. The full page is keyboard-operable: all six tools buttons reachable in order, visible focus indicators, Enter/Space activation, disabled recall buttons do not trap focus, and the play surface's own note keys are unaffected.
  10. Reduced motion still shows live data at a visibly slower update rate rather than freezing or animating at full speed, and no on-page copy claims bit-accurate or hardware-accurate DX7 analysis.

## Task Commits

Each task was committed atomically:

1. **Task 1: The tools panel — six controls, zero new snapshot/patch state** - `d5a9ab7` (feat)
2. **Task 2: Embed the panel in Playground and retire the last coming-soon claim** - `c5f86c4` (feat)
3. **Task 3: Blocking real-browser listening and viewing checkpoint for the whole phase** - no code commit (approved with zero findings, per the checkpoint's own instructions to make no further source change on a clean pass)

**Plan metadata:** this summary's commit (docs: complete plan)

## Files Created/Modified
- `src/app/features/playground/tools-panel/tools-panel.ts` - standalone `ToolsPanel` component: two computed slot-state wrappers, six handler methods, one status-message signal, zero other state
- `src/app/features/playground/tools-panel/tools-panel.html` - six real button elements, two worded slot-state sentences, a status live region, and Randomize's explanatory D-12/D-14 copy
- `src/app/features/playground/tools-panel/tools-panel.scss` - embedded-region styling following `play-surface.scss`'s posture: visible focus indicator, non-colour disabled treatment, no animation
- `src/app/features/playground/tools-panel/tools-panel.spec.ts` - covers every behavior-block case: disabled/enabled/worded-label transitions, exact call-count and argument assertions, the capture-reset-recall slot-preservation case, and the zero-implicit-randomize regression test
- `src/app/features/playground/playground.ts` - `ToolsPanel` added to `imports`; coming-soon array trimmed to the two genuinely-future entries
- `src/app/features/playground/playground.html` - `app-tools-panel` element placed directly below the visualizer element
- `src/app/features/playground/playground.spec.ts` - new cases for three-region document order across every audio status and exact coming-soon list membership

## Decisions Made
- No A/B toggle switch was built: `recallSnapshot` sets the patch directly and the facade has no "currently active slot" concept, so the panel exposes Recall A and Recall B as independent actions rather than inventing derived state to toggle between them (D-09).
- Slot availability is carried in words twice — in the recall button's own accessible label and in a separate plain-text slot-state sentence — so a screen-reader user or a sighted user relying on text (not colour or the disabled attribute alone) can always tell a slot's state (D-10).
- `randomize()` remains callable from exactly one place in the whole application: the Randomize button's click handler. No auto-capture before it and no other trigger path exists (D-14, D-15).
- Reset is a third, fully independent action: it dispatches only to `InstrumentState.reset()`, which by construction never touches the snapshots signal.

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 matched their acceptance criteria on first pass (already committed prior to this continuation session); Task 3's checkpoint was presented verbatim and the developer approved all ten checks with no findings, so per the plan's own checkpoint instructions no further source change was made.

## Issues Encountered

None. This execution session was a continuation after Task 3's blocking checkpoint: Tasks 1-2 were already committed (`d5a9ab7`, `c5f86c4`) from the prior session, and this session's only responsibility was to record the checkpoint's "approved" outcome and re-confirm the automated gates before closing out the plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 10 (Visualizers and comparison tools) is now fully wired: the analyser tap, the oscilloscope and labelled spectrum, and the A/B comparison + randomization tools panel are all live in Playground and have been confirmed in a real browser.
- `10-RESEARCH.md` Assumption A3 is resolved PASS — no analyser decibel-window tuning was required.
- `npm test` (1296/1296), `npm run lint`, and `npm run build` are all green at the close of this plan.
- No blockers carried forward from this plan.

---
*Phase: 10-visualizers-and-comparison-tools*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: src/app/features/playground/tools-panel/tools-panel.ts
- FOUND: src/app/features/playground/tools-panel/tools-panel.html
- FOUND: src/app/features/playground/tools-panel/tools-panel.scss
- FOUND: src/app/features/playground/tools-panel/tools-panel.spec.ts
- FOUND: src/app/features/playground/playground.ts
- FOUND: src/app/features/playground/playground.html
- FOUND: src/app/features/playground/playground.spec.ts
- FOUND commit: d5a9ab7 (Task 1)
- FOUND commit: c5f86c4 (Task 2)
- npm test: 1296/1296 passed
- npm run lint: all files pass
- npm run build: succeeded
