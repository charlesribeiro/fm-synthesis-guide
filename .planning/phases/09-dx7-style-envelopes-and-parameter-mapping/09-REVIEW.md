---
phase: 09-dx7-style-envelopes-and-parameter-mapping
reviewed: 2026-08-16T20:20:35Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - README.md
  - docs/ARCHITECTURE.md
  - src/app/core/audio/worklet-processor-bundle.spec.ts
  - src/app/core/audio/worklet-synth-engine.spec.ts
  - src/app/core/audio/worklet-synth-engine.ts
  - src/app/domain/dx7/audio/value-conversion.spec.ts
  - src/app/domain/dx7/audio/value-conversion.ts
  - src/app/domain/dx7/dsp/algorithm-routing.spec.ts
  - src/app/domain/dx7/dsp/envelope-generator.spec.ts
  - src/app/domain/dx7/dsp/envelope-generator.ts
  - src/app/domain/dx7/dsp/graph-router.spec.ts
  - src/app/domain/dx7/dsp/graph-router.ts
  - src/app/domain/dx7/dsp/worklet-messages.spec.ts
  - src/app/domain/dx7/dsp/worklet-messages.ts
  - src/app/domain/dx7/lessons/lesson-definition.spec.ts
  - src/app/domain/dx7/lessons/lesson-definition.ts
  - src/app/domain/dx7/lessons/lessons.spec.ts
  - src/app/domain/dx7/lessons/lessons.ts
  - src/app/domain/dx7/lessons/try-this.spec.ts
  - src/app/domain/dx7/lessons/try-this.ts
  - src/app/domain/dx7/models/operator-parameters.spec.ts
  - src/app/domain/dx7/models/operator-parameters.ts
  - src/app/domain/dx7/models/patch.spec.ts
  - src/app/features/playground/playground.spec.ts
  - src/app/state/instrument-state.spec.ts
  - worklets/dx7-worklet-processor.ts
  - worklets/harness/harness-main.ts
  - worklets/harness/index.html
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-08-16T20:20:35Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Phase 9 replaces `WorkletSynthEngine`'s single global click-prevention voice ramp with six
independent per-operator DX7-style four-rate/four-level envelope generators (`EnvelopeGenerator`)
driven by a new `setGate` worklet message, and demonstrates the capability in the Algorithm 1
lesson's carrier-sustains/modulator-decays starting patch.

This review traced the envelope state machine (`envelope-generator.ts`), its integration into
`GraphRouter.render()`/`setGate`/`recomputeDerivedValues`, the widened `Dx7Envelope` parameter
model and its validation guards (`operator-parameters.ts`), the widened worklet message contract
and its hostile-payload guard (`worklet-messages.ts`), and the removal of the voice-gain node from
`WorkletSynthEngine` — the five files the phase's own SUMMARY documents as the recovered/completed
core of plan 09-01 — line by line against the locked decisions in `09-CONTEXT.md` (D-01 through
D-06) and the plan's own must-haves.

**Verification performed independently of the phase's own claims:** `npm run lint` (clean),
`npm run typecheck:worklet` (clean), and the full `npm test` suite (1189/1189 passing) were all
re-run against the current tree during this review, not merely trusted from the SUMMARY files.

**Findings:** No correctness, security, or data-loss defects were found in the envelope state
machine, the `GraphRouter` integration, the worklet message validation, or the `WorkletSynthEngine`
voice-gain removal — this is a genuinely well-executed core:

- The per-sample segment-advance/target-clamp loop in `EnvelopeGenerator.render()` is correct,
  including the bounded (≤2 iterations) zero-distance-segment fast path, the NaN-safe target
  comparison (a corrupted/NaN segment target silently freezes the level rather than propagating
  `NaN`, since `NaN` comparisons are always `false`), and the strictly-after-render envelope
  multiply placement in `GraphRouter.render()` that keeps the feedback delay line reading the raw,
  un-enveloped sample.
- `velocityAmplitude` starting at `0` and `setGate`'s open/close asymmetry (open converts and
  stores velocity; close leaves it alone so the release tail keeps the note's loudness) are both
  correctly implemented and match the documented design.
- The widened `Dx7Envelope` validation (`isDx7EnvelopeLike`/`validateDx7Envelope` in
  `operator-parameters.ts`, mirrored by `isValidOperatorParametersEntry` in `worklet-messages.ts`)
  correctly bounds-checks every rate/level index and cannot silently accept a malformed shape.
- `WorkletSynthEngine`'s voice-gain node and ramp constants are fully removed with no dangling
  references (`grep` for `envelopeLevel`/`voiceGain` across `src/`/`worklets/` returns zero), and
  the `masterGain` zero-at-construction regression guard correctly closes the pre-routed-mode
  continuous-tone window.

One real (but low-severity, dev-tooling-only) regression was found in the dev listening harness's
new gate-driven routed path, plus two minor code-quality observations. See below.

## Warnings

### WR-01: Dev harness `playRouted()` can reintroduce an audible gain step when switching directly from single/additive playback

**File:** `worklets/harness/harness-main.ts:470-476` (compare `worklets/harness/harness-main.ts:402-407`)
**Issue:**
Before this phase, `playRouted()` shaped `voiceGain` with the same smoothed pattern as `play()`:
`cancelAndHoldAtTime` followed by `linearRampToValueAtTime(targetLevel, now + ATTACK_SECONDS)`
(confirmed via `git show 0322dee...:worklets/harness/harness-main.ts`). This phase correctly
changes the routed path to stop double-enveloping the kernel's own per-operator envelopes — but in
doing so it replaced the ramp with an instantaneous step:

```ts
this.voiceGain.gain.cancelAndHoldAtTime(now);
this.voiceGain.gain.setValueAtTime(1, now);   // was: linearRampToValueAtTime(targetLevel, now + ATTACK_SECONDS)
```

`voiceGain` is a single node shared by all three play paths (single, additive, routed). The
single/additive paths still drive an always-running, ungated oscillator through it (they have no
envelope of their own). If a listener clicks "Play single operator" or "Play additive six-carrier"
and then clicks "Play routed" **without** clicking "Stop" first, `voiceGain` is currently holding a
non-silent value (e.g. `velocityToAmplitude(FIXED_VELOCITY) ≈ 0.62`) while the single/additive
oscillator is still audibly rendering. `setModeMessage('routed')` is posted via
`port.postMessage` (asynchronous, cross-realm) in the same call, so there is a real window in
which the audio thread is still rendering the previous (single/additive) mode's continuous tone
while `voiceGain` has already stepped from ~0.62 to 1 (a ~61% instantaneous amplitude jump) —
audible as a click/step, which is exactly the property CLAUDE.md's "smooth gain changes to avoid
clicks" rule and this phase's own stated checkpoint purpose ("click safety on every note-on...
depends entirely on the shapes you are about to listen to") exist to prevent. This is scoped to
the dev-only harness (never shipped; `WorkletSynthEngine` has no equivalent multi-mode gain node),
and the checkpoint's own approved test sequence (Check 2 onward always follows a "Stop" between
plays) did not exercise this specific switch-without-stop sequence, so it went unnoticed.

**Fix:** Ramp `voiceGain` to unity on the routed path instead of stepping it, or have `playRouted()`
call the same silencing step `stop()` performs on the previously-active path before taking over,
e.g.:

```ts
this.voiceGain.gain.cancelAndHoldAtTime(now);
this.voiceGain.gain.linearRampToValueAtTime(1, now + ATTACK_SECONDS);
```

This keeps the "kernel owns the envelope shape" property (the target is still unity, held
constant) while removing the discontinuity risk on a direct mode switch.

## Info

### IN-01: `GraphRouter.recomputeDerivedValues()` refills every envelope's step table on every routing/feedback/frequency change, not only on operator-parameter changes

**File:** `src/app/domain/dx7/dsp/graph-router.ts:242-272`
**Issue:** `recomputeDerivedValues()` is the shared recompute path for `setRouting`,
`setOperatorParameters`, `setFeedbackLevel`, and `setNoteFrequencyHz`. It unconditionally calls
`this.envelopesById[id]!.setEnvelope(parameters.envelope)` for all six operators on every one of
those four calls — including `setNoteFrequencyHz`, which `WorkletSynthEngine.noteOn` triggers via
`setFrequencyMessage` on **every** note-on. `setEnvelope` is harmless to call redundantly (it
preserves `currentLevel`/`segmentIndex` by contract and only re-derives `stepsPerSegment` from
unchanged inputs), so this is not a correctness defect — but it is unnecessary work on the
render-thread's message-handling path for state (feedback depth, note frequency) that has no
relationship to envelope shape, and a future reader extending this method has no textual cue that
the envelope refill is intentionally over-broad rather than an oversight.
**Fix:** Either add a one-line comment noting the redundant-but-harmless refill is deliberate (to
keep the single shared recompute path simple), or gate the `setEnvelope` call behind a check that
only `setOperatorParameters`/`setRouting` actually need to run it.

### IN-02: `envelope-generator.ts`'s sustain-segment loop bound has no named constant

**File:** `src/app/domain/dx7/dsp/envelope-generator.ts:154`
**Issue:** The auto-advance loop's bound is written as `RELEASE_SEGMENT_INDEX - 1` (i.e., the
index of the de-facto sustain plateau, segment 2). The value is correct and thoroughly explained
in the surrounding comment block, but the derived index itself isn't named, so a future reader
changing `ENVELOPE_SEGMENT_COUNT`/`RELEASE_SEGMENT_INDEX` has to re-derive by hand that "the
sustain plateau is the release index minus one" rather than reading it off a constant.
**Fix:** Optionally hoist `const SUSTAIN_SEGMENT_INDEX = RELEASE_SEGMENT_INDEX - 1;` (module- or
class-scope) and use it in the `while` condition, purely for readability — behavior is unchanged.

---

_Reviewed: 2026-08-16T20:20:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
