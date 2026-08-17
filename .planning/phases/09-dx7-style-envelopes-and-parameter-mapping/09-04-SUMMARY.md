---
phase: 09-dx7-style-envelopes-and-parameter-mapping
plan: 04
subsystem: audio
tags: [dsp, audioworklet, envelope, fm-synthesis, dev-harness, listening-checkpoint]

# Dependency graph
requires:
  - phase: 09-dx7-style-envelopes-and-parameter-mapping
    provides: "Plan 09-01's Dx7Envelope model, EnvelopeGenerator kernel, and setGate wiring end to end; 09-02's mechanical guards; 09-03's Algorithm 1 lesson envelope differentiation"
provides:
  - "Dev harness routed play path gated by the same setGate message WorkletSynthEngine.noteOn posts (frequency first, then gate), with the harness's own voice-gain ramp held at unity so the kernel's per-operator envelopes are the only amplitude shaping a listener hears"
  - "Four named envelope presets on the routed path (default, slow swell, percussive decay, carrier-sustains/modulator-decays), built as module-scope data spreading the default patch's operator parameters"
  - "Human-approved blocking listening checkpoint covering silence at rest, click-free note lifecycle, per-operator timbral evolution (D-01), bounded worst case, the live app, and the Lesson 6 regression (D-03)"
  - "Completed 09-VALIDATION.md with real task ids traced from all four executed plans, status: validated, nyquist_compliant: true"
affects: []

# Actuals (#2632)
actuals:
  tokens: 10689
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Envelope presets as module-scope data (EnvelopePreset[] with an envelopeForOperator(operatorId, algorithm) function), spreading DEFAULT_PATCH.operators and overriding only the envelope field so a listener compares exactly one variable at a time"
    - "Routed-path amplitude ownership split by mode: voiceGain held at unity and driven entirely by the kernel's own envelopes on the routed path; voiceGain's own click-prevention ramp retained unchanged for the single/additive proof paths, which have no envelopes of their own"

key-files:
  created: []
  modified:
    - worklets/harness/harness-main.ts
    - worklets/harness/index.html
    - README.md
    - .planning/phases/09-dx7-style-envelopes-and-parameter-mapping/09-VALIDATION.md

key-decisions:
  - "Slow-swell preset: rates [20, 74, 74, 55], levels [99, 99, 99, 0] — only the attack rate differs from DEFAULT_ENVELOPE (74→20), giving roughly a 1.25s full-scale attack (derived from envelopeRateToLevelUnitsPerSample's geometric curve) that reads as an unmistakable swell rather than a click, while keeping sustain/release identical to the shipped default."
  - "Percussive preset: rates [99, 85, 85, 55], levels [99, 35, 35, 0] — a near-instant attack (rate 99) falling sharply to a low sustain plateau (level 35) that holds for as long as the note is held, then releasing at the same rate the shipped default uses."
  - "Carrier-sustains/modulator-decays preset derives its carrier set from the currently selected algorithm via deriveCarriers (never hardcoded); its modulator envelope (rates [80,16,16,55], levels [99,70,40,0]) mirrors lessons.ts's ALGORITHM_1_MODULATOR_ENVELOPE shape."
  - "Changing the algorithm select while a routed note is sounding now re-posts operator parameters, not only the routing message — needed so the carrier-sustains preset's carrier/modulator split stays correct after an algorithm switch mid-note, beyond what the plan's action text literally required for that specific handler (it explicitly required this only for the preset-change handler)."
  - "stop() now branches on whether the last play was routed: the routed path posts a closed gate message and leaves voiceGain untouched (still at unity, since the kernel's own release segment owns amplitude); the single/additive paths keep the original voiceGain ramp-down unchanged."
  - "09-VALIDATION.md's per-task verification map was rebuilt from all four executed plans' own Task Commits sections and SUMMARY coverage blocks (09-01 through 09-04), not guessed from the original draft's placeholder rows."

patterns-established: []

requirements-completed: [ENGINE-03]

coverage:
  - id: D1
    description: "Dev harness routed play path posts frequency then an open setGate message (same order as WorkletSynthEngine.noteOn); stop() posts a closed gate on the routed path; voiceGain held at unity on the routed path so the kernel's own envelopes are the only amplitude shaping there"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "npm test — full suite (1189/1189), harness change verified via npm run harness/typecheck:worklet/build/verify:harness-isolation (all green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Four named envelope presets (default, slow swell, percussive decay, carrier-sustains/modulator-decays) on a labelled select, built as module-scope data spreading the default patch's operators and overriding only the envelope; preset changes re-post operator parameters live without stopping the note"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "npm run typecheck:worklet, npm run lint (both green); grep -c 'deriveCarriers' worklets/harness/harness-main.ts >= 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Blocking listening checkpoint: silence at rest, click-free note lifecycle (including mid-segment release/retrigger), audible per-operator timbral evolution (D-01), bounded worst case, the live app, and the Lesson 6 regression (D-03), approved with a complete auditable payload"
    requirement: "ENGINE-03"
    human_judgment: true
    rationale: "jsdom implements no Web Audio API and no AudioWorkletGlobalScope at all — click safety, perceived attack/release shape, and audible timbral evolution over a held note are perceptual properties no Vitest/jsdom test can reach."
  - id: D4
    description: "09-VALIDATION.md completed: every placeholder task id replaced with real plan/task ids traced from the four executed plans, manual-only verification rows filled with this checkpoint's outcome, status: validated / nyquist_compliant: true / wave_0_complete: true set"
    requirement: "ENGINE-03"
    verification:
      - kind: other
        ref: "grep -c '9-0x-xx|9-01-xx|TBD' .planning/phases/09-dx7-style-envelopes-and-parameter-mapping/09-VALIDATION.md -> 0"
        status: pass
    human_judgment: false

duration: ~25min active work + overnight checkpoint pause (human listening pass performed 2026-08-16)
completed: 2026-08-16
status: complete
---

# Phase 9 Plan 04: Dev harness envelope gating, presets, and the blocking listening checkpoint Summary

**The dev harness now drives the routed path through the same `setGate` message the live app posts and offers four named envelope presets a listener can A/B against exactly one variable at a time; a human confirmed silence at rest, click-free note lifecycle, audible per-operator timbral evolution, and bounded worst-case output in a real browser, closing out Phase 9's `09-VALIDATION.md` as `status: validated`.**

## Performance

- **Duration:** ~25 min of active implementation and documentation work, plus an overnight pause for the blocking human-listening checkpoint (approved 2026-08-16)
- **Tasks:** 3/3 (Task 1 auto, Task 2 blocking checkpoint, Task 3 auto)
- **Files modified:** 4 (2 production/dev-tooling, 1 doc, 1 planning artifact)

## Accomplishments

- **Closed the silent-routed-playback gap 09-01 flagged.** `worklets/harness/harness-main.ts`'s `playRouted()` now posts a frequency message then an open `setGate` message — the exact order `WorkletSynthEngine.noteOn` posts — so the routed path actually sounds an enveloped note. `stop()` posts a closed gate message on that path.
- **Removed the harness's own double-enveloping of the routed path.** `voiceGain` (the harness's dedicated click-prevention gain node) is now held at unity on the routed path instead of ramped; the kernel's six per-operator `EnvelopeGenerator` instances are the only amplitude shaping a listener hears there. The single-operator and additive proof paths keep `voiceGain`'s original ramp behavior unchanged — neither runs through the router or has envelopes.
- **Four named envelope presets**, built as module-scope data (`ENVELOPE_PRESETS`), each spreading `DEFAULT_PATCH.operators` and overriding only `envelope` so no other parameter drifts between presets:
  - **Default (shipped):** `DEFAULT_ENVELOPE` on every operator (rates `[74,74,74,55]`, levels `[99,99,99,0]`).
  - **Slow swell:** rates `[20,74,74,55]`, levels `[99,99,99,0]` — only the attack rate differs from the default, giving a ~1.25s full-scale attack.
  - **Percussive decay:** rates `[99,85,85,55]`, levels `[99,35,35,0]` — a near-instant attack falling sharply to a low sustain plateau.
  - **Carrier sustains / modulator decays:** carriers (derived via `deriveCarriers` for the currently selected algorithm) get `DEFAULT_ENVELOPE`; modulators get rates `[80,16,16,55]`, levels `[99,70,40,0]` (mirroring `lessons.ts`'s `ALGORITHM_1_MODULATOR_ENVELOPE` shape).
  - Every preset's release-segment level is zero, matching the shipped-data invariant plan 09-03 proved.
- **Live re-patch on preset change.** Changing the envelope preset while a routed note is sounding re-posts `setOperatorParameters` immediately, without stopping the note — the same live-repatch pattern the existing algorithm/feedback controls already established.
- **Blocking listening checkpoint approved with zero findings**, across all 11 checks, with a complete auditable resume payload (see Deviations/Decisions below for the exact payload). No source change was required.
- **`09-VALIDATION.md` completed**: every placeholder task id (`9-0x-xx`, `TBD`) replaced with real plan/task ids traced from all four executed plans' own Task Commits sections; new rows added for the hostile-payload matrix, note-lifecycle sweep, silence-at-rest guard, modulator-envelope reachability guard, velocity regression, and shipped-envelope invariants the original draft map did not anticipate; `status: validated`, `nyquist_compliant: true`, `wave_0_complete: true` all set.

## Task Commits

1. **Task 1: Make the harness drive the real note lifecycle and expose envelope presets a listener can distinguish** - `ab33b7d` (feat) — `worklets/harness/harness-main.ts`, `worklets/harness/index.html`, `README.md`.
2. **Task 2: Blocking listening checkpoint** - approved by the coordinator with a complete auditable payload; no commit (checkpoint, not a code change).
3. **Task 3: Apply checkpoint findings and complete the phase validation record** - `c21bfde` (docs) — `.planning/phases/09-dx7-style-envelopes-and-parameter-mapping/09-VALIDATION.md`; no source change (checkpoint approved with zero findings, per the 06-04 no-op-on-approval precedent).

## Files Created/Modified

- `worklets/harness/harness-main.ts` - Gate messages on the routed play/stop paths; `voiceGain` held at unity on the routed path; four envelope presets and a labelled preset select; algorithm-change and preset-change handlers re-post operator parameters live.
- `worklets/harness/index.html` - New labelled `envelope-preset-select` control in the existing routed-controls region; all other controls unchanged.
- `README.md` - Dev-harness section documents the gate-driven routed path and the preset control.
- `.planning/phases/09-dx7-style-envelopes-and-parameter-mapping/09-VALIDATION.md` - Completed per-task verification map, manual-only verification outcomes, and sign-off frontmatter.

## Decisions Made

See `key-decisions` in frontmatter for the exact preset values shipped and their audible intent, the `onAlgorithmChanged` enhancement beyond the plan's literal instruction (re-posting operator parameters so the carrier-sustains preset's carrier/modulator split stays correct after a mid-note algorithm switch), and the `stop()` routed/non-routed branch.

**Checkpoint approval payload (Task 2, auditable per the plan's resume-signal requirement):** `approved check2=3 check5=8 silence=clean evolution=audible`.
- **Check 2** (default envelope, click-free lifecycle): Algorithm 3, `Default (shipped)` preset — no issues.
- **Check 5** (per-operator timbral evolution, D-01, the point of the phase): Algorithm 8 (two modulators feeding carrier 3, plus a separate pair feeding carrier 1), `Carrier sustains / modulator decays` preset vs. `Default (shipped)` on the same algorithm — verdict **audible**: the modulator-decay preset opened bright and mellowed while the default stayed constant, as expected.
- **Check 1** (silence at rest): 10+ seconds idle across all four presets — verdict **clean**, complete silence.
- **Checks 3, 4, 6, 7, 8** (slow swell, percussive plateau, mid-segment release/retrigger, held-note re-patch, bounded worst case) and **checks 9–11** (the live app at `/playground`, the Algorithm 1 lesson regression, and the honesty-copy disclaimer): no issues reported.

**No tuning constant was changed.** The checkpoint's narrow re-tunable surface (rate-curve endpoints, `DEFAULT_ENVELOPE`'s rates/levels, the Algorithm 1 lesson's modulator envelope) was left untouched, per the plan's explicit instruction that a zero-findings approval must not be followed by speculative edits.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing critical functionality, or blocking issues surfaced during Task 1's implementation or verification.

### Process notes (not Rule 1-4 deviations)

**1. `onAlgorithmChanged` re-posts operator parameters, beyond the plan's literal instruction.** The plan's action text explicitly required only the preset-change handler to re-post `setOperatorParameters` live. Since the carrier-sustains/modulator-decays preset derives its carrier set from the *currently selected algorithm* via `deriveCarriers`, an algorithm change mid-note would otherwise leave a stale carrier/modulator split in effect until the note was replayed — a plausible source of a confusing, misattributed checkpoint finding. Extended `onAlgorithmChanged` to also re-post operator parameters (Rule 2 posture: keeping the checkpoint's own evidence trustworthy), at zero cost to any stated acceptance criterion.

**2. `09-04-PLAN.md`'s `<precondition>` for Task 1** (`npm run harness` succeeds and `npm run verify:harness-isolation` exits 0 before any change) was verified read-only before editing: both commands were run clean against the pre-change tree, confirming the Phase 7 harness build pipeline and its 07-04 production-isolation gate were intact before Task 1 began.

---

**Total deviations:** 0 Rule 1-4 auto-fixes. 2 process notes (documented above).
**Impact on plan:** No scope creep beyond the one additive correctness improvement (process note 1), which strengthens rather than changes the checkpoint's own evidentiary basis. All acceptance criteria and must-haves satisfied as written.

## Issues Encountered

None. The TypeScript compiler initially could not infer parameter types for the carrier-sustains preset's `envelopeForOperator` arrow function inside `Object.freeze([...])` (generic-call contextual typing does not flow through in this TS configuration) — resolved by explicitly annotating that one arrow function's parameters (`(operatorId: OperatorId, algorithm: AlgorithmDefinition)`); not a production behavior change, just a type-inference limitation worked around inline.

## User Setup Required

None beyond the checkpoint itself, which the coordinator confirmed was performed by a human in a real browser against this worktree's harness build (envelope-preset select and gate-driven note lifecycle confirmed present before testing).

## Next Phase Readiness

- Phase 9 (`dx7-style-envelopes-and-parameter-mapping`) is functionally complete: `ENGINE-03` is implemented, hardened (09-02), demonstrated in the Algorithm 1 lesson (09-03), and human-approved end to end (09-04). `09-VALIDATION.md` carries `status: validated`, `nyquist_compliant: true`, `wave_0_complete: true`.
- No blockers. `npm test` (1189/1189), `npm run build`, `npm run lint`, `npm run typecheck:worklet`, and `npm run verify:harness-isolation` are all green as of this plan's close.
- STATE.md, ROADMAP.md, and REQUIREMENTS.md are intentionally left untouched by this plan (worktree isolation) — the orchestrator owns those writes after merge, including marking `ENGINE-03` complete in `REQUIREMENTS.md`.

---
*Phase: 09-dx7-style-envelopes-and-parameter-mapping*
*Completed: 2026-08-16*

## Self-Check: PASSED

- `worklets/harness/harness-main.ts` — FOUND
- `worklets/harness/index.html` — FOUND
- `README.md` — FOUND
- `.planning/phases/09-dx7-style-envelopes-and-parameter-mapping/09-VALIDATION.md` — FOUND
- Commit `ab33b7d` — FOUND
- Commit `c21bfde` — FOUND
