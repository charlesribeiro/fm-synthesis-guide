---
phase: 10-visualizers-and-comparison-tools
plan: 02
subsystem: audio
tags: [angular-signals, web-audio, canvas-2d, spectrum-analyzer, logarithmic-scale, accessibility, reduced-motion]

# Dependency graph
requires:
  - phase: 10-visualizers-and-comparison-tools
    provides: "10-01's analyser tap (readFrequencyInto/ANALYSER_FREQUENCY_BIN_COUNT), injected animation-frame/Canvas-2D seams, and the visualizer-frame.ts pure-draw-module pattern"
provides:
  - "spectrum-scale.ts — a zero-import pure module mapping hertz to display position and to inclusive frequency-bin ranges (hzToFraction, barEdgesHz, binIndexForHz, buildBarBinRanges), closing the log-of-zero and DC-bin hazards"
  - "drawSpectrum/drawFrequencyAxis/drawEmptySpectrum in visualizer-frame.ts — a bar renderer taking each band's peak byte (not mean) and a labelled logarithmic frequency axis, both Angular-free"
  - "Visualizer's second lane: a frequency buffer distinct from the time-domain buffer, cached bar-bin ranges built once from the engine's reported sample rate, a reduced-motion repaint throttle, and per-lane accessible descriptions"
affects: [10-03-comparison-tools, 10-04-integration-and-human-verify]

# Actuals (#2632)
actuals:
  tokens: 14433
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure display-math module beside the component it serves (spectrum-scale.ts), not in the domain layer — display geometry is explicitly not DX7 domain knowledge, so it sits outside the domain purity gate's jurisdiction while still being fully unit-tested with zero mocks"
    - "Invariant-based test proofs over a whole returned list (monotonicity, in-range-ness, DC exclusion, non-emptiness) rather than hardcoded index tables, so a future change to bar count or display range does not require rewriting the proof"
    - "Engine-instance method spying (vi.spyOn on the injected SYNTH_ENGINE, e.g. getAnalysisSampleRate) as the sanctioned technique for proving call-frequency behavior, since this project's Angular/Vitest harness explicitly disallows vi.mock/vi.spyOn on relative-import ESM modules ('The vi.mock and related methods are not supported for relative imports with the Angular unit-test system')"
    - "Reduced-motion throttle reads MotionPreference.prefersReducedMotion() imperatively inside the non-reactive animation-frame callback, gated against the scheduler-supplied timestamp rather than a wall-clock read, keeping the throttle deterministic under test"

key-files:
  created:
    - src/app/features/playground/visualizer/spectrum-scale.ts
    - src/app/features/playground/visualizer/spectrum-scale.spec.ts
  modified:
    - src/app/features/playground/visualizer/visualizer-frame.ts
    - src/app/features/playground/visualizer/visualizer-frame.spec.ts
    - src/app/features/playground/visualizer/visualizer.ts
    - src/app/features/playground/visualizer/visualizer.html
    - src/app/features/playground/visualizer/visualizer.scss
    - src/app/features/playground/visualizer/visualizer.spec.ts
    - src/app/features/playground/playground.ts
    - src/app/features/playground/playground.spec.ts

key-decisions:
  - "buildBarBinRanges applies its two corrections (raise start bin below 1 to 1; if end bin then falls below the corrected start bin, set it equal to the start bin) in that exact order, matching the plan's specified sequence and guaranteeing every band covers at least one bin without ever including the DC bin"
  - "The frame callback always performs the frequency read after the time-domain read once a tap exists, regardless of whether the time-domain read itself succeeded — readTimeDomainInto and readFrequencyInto share the same analyser-existence gate on the engine side, so both return the same true/false outcome in lockstep; this keeps the two reads structurally parallel rather than conditionally sequenced"
  - "Reduced-motion and caching test coverage could not use vi.mock/vi.spyOn on spectrum-scale.ts's buildBarBinRanges directly — this project's Angular Vitest harness throws 'The vi.mock and related methods are not supported for relative imports with the Angular unit-test system' for any relative-import module mock. Substituted vi.spyOn on the injected SYNTH_ENGINE instance's getAnalysisSampleRate method instead, which is called exactly once per frame while the cached ranges are null and never again once cached — an equivalent, sanctioned observable proof using the same engine-instance-spy technique already established elsewhere in this file (e.g. spying on engine.initialize)"

patterns-established:
  - "A second canvas lane's acquisition/sizing code exactly mirrors the first lane's (same devicePixelRatio defensiveness, same clientWidth-or-nominal-width fallback), duplicated rather than abstracted, keeping each lane's failure mode legible on its own"

requirements-completed: []  # VIZ-01 stays open until 10-02 D4 (readable bar heights vs MASTER_GAIN) is verified

coverage:
  - id: D1
    description: "spectrum-scale.ts maps hertz to a 0..1 display fraction and to inclusive frequency-bin ranges, closing the log-of-zero hazard (input clamped before any logarithm) and the DC-bin hazard (every band's start bin raised to at least 1), proven by invariant tests over the whole returned range list rather than a hardcoded index table"
    requirement: VIZ-01
    verification:
      - kind: unit
        ref: "src/app/features/playground/visualizer/spectrum-scale.spec.ts (10-02-PLAN.md Task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "drawSpectrum renders one discrete bar per band taking the band's maximum byte (not mean), anchored above a bottom axis band; drawFrequencyAxis places 100 Hz/1 kHz/10 kHz tick labels through the same hzToFraction mapping the bars use so a label can never disagree with the bar beneath it; drawEmptySpectrum is the labelled rest state shown before ranges exist"
    requirement: VIZ-01
    verification:
      - kind: unit
        ref: "src/app/features/playground/visualizer/visualizer-frame.spec.ts#drawSpectrum/drawFrequencyAxis/drawEmptySpectrum (10-02-PLAN.md Task 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Visualizer's second lane: a distinct ANALYSER_FREQUENCY_BIN_COUNT-length frequency buffer (never the time-domain buffer), bar-bin ranges built once from the engine's reported sample rate and reused unchanged thereafter, a reduced-motion repaint throttle (REDUCED_MOTION_FRAME_INTERVAL_MS), per-lane aria-describedby-linked text descriptions, and Playground's coming-soon list no longer claiming the oscilloscope/spectrum display as future work"
    requirement: VIZ-01
    verification:
      - kind: unit
        ref: "src/app/features/playground/visualizer/visualizer.spec.ts#spectrum lane (10-02-PLAN.md Task 3)"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#no longer lists the oscilloscope (10-02-PLAN.md Task 3, D-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The platform analyser's default decibel range renders readable bar heights against this project's master gain of one sixth, without adding decibel-range members to the boundary surface"
    verification: []
    human_judgment: true
    rationale: "This is 10-RESEARCH.md's Assumption A3, carried as a backstop truth and explicitly deferred to plan 10-04's checkpoint per this plan's own must_haves — it can only be confirmed by looking at the real bars in a real browser, not by a unit test against the fake analyser double."

duration: ~15min
completed: 2026-08-18
status: complete
---

# Phase 10 Plan 02: Labelled Spectrum Analyzer Summary

**A pure logarithmic-scale module driving a discrete-bar Canvas 2D spectrum renderer with a drawn frequency axis, wired into Playground's Visualizer as a second lane alongside the oscilloscope — reading a distinct frequency buffer off the same analyser tap, caching its bar-bin ranges once from the engine's reported sample rate, throttling its repaint rate under reduced motion, and carrying its own accessible text description.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3/3 complete
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments

- Built `spectrum-scale.ts`, a zero-import pure module (`grep -cE "^import " ... ` → `0`) owning the frequency-to-display mapping: `hzToFraction` clamps its input into `20..20000` Hz before any logarithm (closing the log-of-zero hazard, T-10-07), `barEdgesHz` lays out 32 geometrically-spaced bands, `binIndexForHz` maps a frequency to a linear FFT bin, and `buildBarBinRanges` combines them into cached per-bar bin ranges — returning `null` (never a `NaN`-filled list) when the sample rate isn't yet positive, and never letting a band's start bin land on the DC bin.
- Proved every one of those functions with invariant-based tests over the whole returned list (monotonicity, in-range-ness, DC exclusion, non-emptiness) rather than a hardcoded index table, so a future change to `SPECTRUM_BAR_COUNT` or the display range doesn't require rewriting the proof.
- Extended `visualizer-frame.ts` with `drawSpectrum` (one filled rectangle per band, height from that band's maximum byte — not the mean — so `[0, 0, 255, 0]` and `[255]` render identically), `drawFrequencyAxis` (three tick labels placed by the same `hzToFraction` mapping the bars use, so a label and the bar beneath it can never disagree — D-06), and `drawEmptySpectrum` (the labelled rest state shown before bar-bin ranges exist). All three remain Angular-free (`grep -cE "^import .*@angular/core"` → `0`) and allocate nothing per call.
- Wired the second lane into `Visualizer`: a separate `ANALYSER_FREQUENCY_BIN_COUNT`-length frequency buffer read every tick alongside the existing time-domain read (Pitfall 5 — never the same object, never swapped); cached bar-bin ranges built once the tap reports a positive sample rate and never rebuilt afterward; a `REDUCED_MOTION_FRAME_INTERVAL_MS` (100ms) repaint throttle that reads `MotionPreference.prefersReducedMotion()` imperatively inside the non-reactive frame callback, gated against the scheduler-supplied timestamp so the display stays live but stops flickering at full rate; and a second `computed` description for the spectrum lane, changing only with engine status.
- Both canvases now carry `role="img"` and an `aria-describedby` pointing at their own paragraph, closing the "canvas pixels are invisible to assistive technology" prohibition; a caption states plainly that the panel is a live view of the app's own approximated engine, not a hardware DX7 analysis (T-10-11).
- Removed the "Oscilloscope and spectrum display" entry from Playground's coming-soon list (D-04) now that both lanes are live embedded regions, leaving the A/B/randomization entry in place for plan 10-04.

## Task Commits

Each task was committed atomically:

1. **Task 1: The logarithmic band map — a pure spectrum-scale module and its bounds proofs** — `4f89baa` (feat)
2. **Task 2: Bar rendering and the labelled frequency axis** — `516939a` (feat)
3. **Task 3: Wire the second lane into the visualizer — frequency buffer, cached band ranges, accessible descriptions, reduced-motion repaint rate, and the coming-soon trim** — `c8a7088` (feat)

## Files Created/Modified

- `src/app/features/playground/visualizer/spectrum-scale.ts` — `MIN_DISPLAY_HZ`/`MAX_DISPLAY_HZ`/`SPECTRUM_BAR_COUNT`/`AXIS_TICK_HZ`, `formatTickLabel`, `hzToFraction`, `barEdgesHz`, `binIndexForHz`, `BarBinRange`, `buildBarBinRanges`
- `src/app/features/playground/visualizer/spectrum-scale.spec.ts` — invariant-based proofs for every export
- `src/app/features/playground/visualizer/visualizer-frame.ts` — extended: `SPECTRUM_CSS_WIDTH`/`SPECTRUM_CSS_HEIGHT`/`SPECTRUM_AXIS_BAND_HEIGHT`, `BAR_FILL_COLOR`/`AXIS_LABEL_COLOR`/`AXIS_LABEL_FONT`, `drawSpectrum`, `drawFrequencyAxis`, `drawEmptySpectrum`
- `src/app/features/playground/visualizer/visualizer-frame.spec.ts` — draw-shape, axis-position, max-not-mean and allocation-discipline cases for the new exports
- `src/app/features/playground/visualizer/visualizer.ts` — extended: spectrum canvas view child, frequency buffer, cached `barBinRanges`, reduced-motion gate (`REDUCED_MOTION_FRAME_INTERVAL_MS`), `spectrumDescription`
- `src/app/features/playground/visualizer/visualizer.html` — second canvas + description paragraph, honest-approximation caption
- `src/app/features/playground/visualizer/visualizer.scss` — spectrum canvas sizing, caption styling
- `src/app/features/playground/visualizer/visualizer.spec.ts` — setup() now dispatches two distinct fake contexts by acquisition order; new spectrum-lane, buffer-identity, band-range-caching, reduced-motion and description cases
- `src/app/features/playground/playground.ts` — coming-soon array: oscilloscope entry removed
- `src/app/features/playground/playground.spec.ts` — pins the coming-soon trim

## Decisions Made

- **Correction order in `buildBarBinRanges`:** DC-bin exclusion (raise `startBin` below 1 to 1) is applied before the end-bin-below-start-bin guard, exactly as the plan specifies — this means the guard compares against the *corrected* start bin, not the raw one, which matters for the lowest band whose raw start bin can be 0.
- **Frequency read always follows the time-domain read once a tap exists**, independent of the time-domain read's own success flag — both reads share the same underlying analyser-existence gate on the engine, so this keeps the two calls structurally parallel (see `key-decisions` in frontmatter for the full rationale).
- **Test-harness constraint discovered and worked around:** this project's Angular/Vitest unit-test builder explicitly rejects `vi.mock`/`vi.spyOn` targeting any relative-import ESM module ("The vi.mock and related methods are not supported for relative imports with the Angular unit-test system. Please use Angular TestBed for mocking dependencies."). The plan's reduced-motion and band-range-caching test cases were written first assuming `vi.spyOn` on `buildBarBinRanges` would work; when the harness rejected it, coverage was rewritten to spy on the injected `SYNTH_ENGINE` instance's `getAnalysisSampleRate` method instead — a legitimate DI-seam spy target already used elsewhere in this file for `initialize`/`noteOn`/etc. — which is called by the exact same code path and gives an equivalent observable proof that the tap is consulted every tick while ranges are null and never again once cached.

## Deviations from Plan

**1. [Rule 3 — Blocking] `vi.mock`/`vi.spyOn` unsupported for relative-import modules under this project's test harness**
- **Found during:** Task 3, writing the "band-range builder is consulted while the sample rate is zero... not consulted again once cached" spec case
- **Issue:** The natural implementation of this proof — `vi.spyOn` on the `buildBarBinRanges` export from `spectrum-scale.ts` — first failed with `TypeError: Cannot redefine property: buildBarBinRanges` (a readonly ESM export), and the `vi.mock('./spectrum-scale', ...)` fallback then failed at the Angular/Vitest builder level with an explicit error rejecting `vi.mock` for relative imports.
- **Fix:** Rewrote the test to spy on `TestBed.inject(SYNTH_ENGINE).getAnalysisSampleRate` instead — the tap method the frame callback actually calls once per frame while `barBinRanges` is `null`, and never again once cached. No production code changed; this is a spec-authoring fix only.
- **Files modified:** `src/app/features/playground/visualizer/visualizer.spec.ts`
- **Verification:** The rewritten case passes and, combined with the "reduced motion" tests, exercises the exact call pattern the plan's acceptance criteria describe. Full suite (1283 tests) + lint + build all green.
- **Committed in:** `c8a7088` (Task 3 commit)

**2. [Rule 1 — Bug found while authoring tests] Two reduced-motion test cases initially asserted against no live tap data**
- **Found during:** Task 3, first draft of the reduced-motion throttle specs
- **Issue:** The first draft of the "with reduced motion preferred/not preferred" cases didn't call `engine.initialize()`, so `readOk` stayed `false` on every tick and the pre-existing `hasDrawnRestState` guard capped the visible repaint count at 1 regardless of the reduced-motion setting — producing a false failure that looked like a throttle bug but was actually a test setup gap (no live data to distinguish "throttled" from "rest-state-already-drawn").
- **Fix:** Both cases now call `engine.initialize()` and set canned time-domain data before ticking, so each unthrottled tick genuinely produces a new `drawOscilloscope` repaint and the throttle's effect is observable.
- **Files modified:** `src/app/features/playground/visualizer/visualizer.spec.ts`
- **Verification:** Both cases pass with the corrected setup; full suite green.
- **Committed in:** `c8a7088` (Task 3 commit)

---

**Total deviations:** 2 (1 blocking test-harness workaround, 1 test-authoring bug fixed before commit) — both spec-only, zero production-code impact beyond the plan's own design.
**Impact on plan:** No scope creep. The plan's specified production behavior (frequency buffer, cached ranges, reduced-motion throttle, accessible descriptions, coming-soon trim) was implemented exactly as written; only the *test technique* for two acceptance-criteria cases had to change to work within this project's test harness.

## Issues Encountered

None beyond the two deviations documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both the oscilloscope and spectrum lanes are now live, tested, embedded regions in Playground — plan 10-03 (comparison tools) and plan 10-04 (integration and human-verify) can build against a stable, fully-automated-tested `Visualizer` component.
- `10-RESEARCH.md` Assumption A3 (default analyser decibel range renders readable bar heights against `MASTER_GAIN = 1/6`) remains an undischarged, explicitly-flagged human-verify item — carried forward to plan 10-04's checkpoint exactly as this plan's own must-haves specify. If the bars read as saturated or near-invisible in a real browser, the fix is two more members on `AnalyserNodeLike` and two assignments at construction (a constant-shaped change per the plan's own flagged-assumption note), not a structural one.
- The real-browser reduced-motion-throttle observation (does the spectrum lane visibly settle to ~10fps under a real OS reduced-motion preference, without looking frozen) is a genuine, undischarged human-verify item — deferred to plan 10-04's checkpoint alongside the existing D3 (10-01's off-change-detection observation) and A3 items.

---
*Phase: 10-visualizers-and-comparison-tools*
*Completed: 2026-08-18*

## Self-Check: PASSED

All created/modified files verified present on disk; all three task commit hashes (`4f89baa`, `516939a`, `c8a7088`) verified present in git log.
