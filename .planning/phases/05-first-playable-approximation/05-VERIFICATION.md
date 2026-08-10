---
phase: 05-first-playable-approximation
verified: 2026-08-07T14:19:39Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification: []
---

# Phase 5: First Playable Approximation — Verification Report

**Phase Goal:** A monophonic, injected-boundary audio engine the user can actually play.
**Verified:** 2026-08-07T14:19:39Z
**Status:** passed
**Re-verification:** No — initial verification; MASTER_GAIN re-audition closed via 05-UAT.md Test 1

**Context for this run:** Phase 5 shipped across four plans (05-01..05-04) and then went through four rounds of code review + fix (commits `99b4732`, `bc8a28e`, `fd1b018`, `7eb499c`, `9db216f`, `b41bd76`) that specifically targeted the "no stuck voices" success criterion — a stale FM modulation-depth bug (CR-01), an `AudioContext` leak on failed `initialize()` (CR-02), a mathematically-provable master-gain safety-clamp gap (WR-01), and several note-release-path gaps (modifier/focus mid-hold, right-click, overlapping keyboard keys — WR-06/WR-07/WR-08). This verification was run against the current post-fix state of the code (HEAD `b1c2d88`), not against the original plan-time SUMMARY.md claims, per instruction.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Audio never starts before a user gesture; suspended/unavailable states render correctly (Roadmap SC1 / AUDIO-01) | ✓ VERIFIED | `AUDIO_CONTEXT_CTOR`'s factory only *feature-detects* and returns a constructor reference, never an instance (`audio-context.token.ts:60-69`); `new ctor()` occurs only inside `WebAudioSynthEngine.initialize()` (`web-audio-synth-engine.ts:159-184`), called only from `Playground.enableAudio()` (`playground.ts:95-110`), itself only reachable from a template `(click)` handler. `_status` seeds `'unavailable'` when the injected ctor is `null`, `'suspended'` otherwise (`web-audio-synth-engine.ts:119`). All four `AudioEngineStatus` members are covered by named tests in `web-audio-synth-engine.spec.ts` ("AudioEngineStatus reachability" describe block, lines 167-203) plus a component-level assertion that no fake context is constructed before the Enable-audio click. `playground.html` renders distinct, honest copy per state (unavailable / error / suspended+button / ready) — lines 6-35. |
| 2 | User can play/release a note with no stuck voices after note-off (Roadmap SC2a / AUDIO-02) — state-transition / cancellation invariant | ✓ VERIFIED | Persistent-oscillator lifecycle (6 oscillators built and started once in `buildGraph()`, never recreated — `web-audio-synth-engine.ts:228-260`) makes per-note node leakage structurally impossible. `noteOff`/`allNotesOff`/`destroy` all terminate the voice-gain schedule at an exact `setValueAtTime(0, ...)` anchor (`releaseVoice()`, lines 539-547; `destroy()`, lines 549-570). Every input-surface note-ending path (pointerup/pointerleave/pointercancel, keyup, window blur, component destroy) is wired in `playground.ts` and independently named-tested in `playground.spec.ts`. Post-review regression tests specifically close previously-real stuck/mis-released-voice gaps: `WR-06` (editable-target keyup guard, `playground.spec.ts:293`), `WR-07` (right-click release doesn't silence a keyboard-held note, `playground.spec.ts:216`), `WR-08` (releasing a superseded overlapping key doesn't disturb the newer note, `playground.spec.ts:365`), `CR-02` (context isn't leaked on a failed `initialize()`, `web-audio-synth-engine.spec.ts:228`). A further gap of the same shape was found and fixed in a later pass of this same verification session: the on-screen key button's own Space/Enter activation path had no equivalent held-note guard, so a Tab-driven focus change while Space was still physically held could deliver the eventual keyup to a *different* key button and strand the note actually sounding — fixed with a `buttonHeldNote` field mirroring `pointerHeldNote`/`keyboardHeldCode` (`playground.ts:59-77`), regression-tested at `playground.spec.ts:501`. Full suite green (722/722) including all of these named tests — run once, this verification pass. Also confirmed by the 05-04 human listening "stuck-voice hunt" (alt-tab, route navigation, pointer-drag-off) — approved. |
| 3 | User can play/release a note with no stuck voices after algorithm switch (Roadmap SC2b / AUDIO-02, D-01/D-02) | ✓ VERIFIED | `applyRouting()` derives topology solely from `planConnections(algorithm)` (pure, all-32-algorithm-swept in `patch-plan.spec.ts`) and `deriveCarriers(algorithm)` — never a per-algorithm branch. Re-patch disconnects only the re-patchable `levelGain`/`feedbackDelay` outputs before reconnecting (`web-audio-synth-engine.ts:290-291`), leaving the persistent oscillator links untouched — this is what makes an algorithm switch mid-note structurally free of stale connections or node churn. `web-audio-synth-engine.spec.ts`'s "routing (D-01 all 32 algorithms, D-02 live re-patch)" describe block (lines 464-650) asserts: all 32 algorithm ids apply without throwing with topology matching the derived expectation exactly; a switch matrix across representative pairs leaves no stale link; a held-note switch creates zero nodes, adds no voice-gain automation entry, and starts/stops no oscillator. `CR-01`'s fix (stale modulation/feedback depth frozen at the wrong pitch) is regression-tested at `web-audio-synth-engine.spec.ts:585`. Also confirmed by the 05-04 human listening checkpoint item 4 (held-note algorithm switch) — approved. |
| 4 | UI clearly labels the engine as an educational approximation (Roadmap SC3 / AUDIO-03) | ✓ VERIFIED | `playground.html:67` renders `<p class="approximation-badge">Educational approximation — not a bit-accurate DX7 emulation</p>` unconditionally, outside every `@if` block, so it is present in all five render states. `grep -c` on the exact string returns 1. Component spec asserts the label is present both before and after enabling. 05-04's human checkpoint item 8 explicitly re-read every other string on the page for unqualified accuracy/authenticity claims and found none — approved. |
| 5 | No signal path can exceed the fixed master-gain safety clamp — no combination of velocity, operator level, carrier count, or feedback depth can drive output above the clamp (prohibition, T-05-02) | ✓ VERIFIED | `MASTER_GAIN` was found during code review to *not* actually satisfy this at its original value (0.18 × 6 carriers = 1.08 > 1) and was fixed (WR-01, commit `fd1b018`) to `1/6` (`value-conversion.ts:43`), with a regression test computing the exact worst-case product and asserting `<= 1` (`value-conversion.spec.ts:175-181`, passing). `MAX_FEEDBACK_INDEX < MAX_MODULATION_INDEX` is also asserted. |
| 6 | Every note-ending/no-stuck-voice regression the review process found is actually fixed in the current tree, not just claimed in a SUMMARY | ✓ VERIFIED | Independently re-read (not merely trusted from 05-REVIEW-FIX.md's narrative) the current `playground.ts`/`web-audio-synth-engine.ts` source for each of CR-01, CR-02, WR-01, WR-02 (ramped routing-gain instead of direct `.value=`), WR-03 (dead field removed), WR-04 (`setTargetAtTime` time-constant recorded), WR-05 (single routing-application path via the constructor effect only), WR-06, WR-07, WR-08 — all present in the code exactly as the fix commits and round-4 review describe. `npm run build`, `npm test -- --watch=false` (722/722), and `npm run lint` all independently re-run in this verification pass and pass clean. |
| 7 | The `SynthEngine` interface established in Phase 1 is untouched, preserving the Phase 7 AudioWorklet swap-in seam | ✓ VERIFIED | `git log --follow -- src/app/core/audio/synth-engine.ts` shows only the original Phase 1 commit (`dddf850`); no Phase 5 commit touches this file. |
| 8 | Perceptual tuning constants (`ATTACK_SECONDS`, `RELEASE_TIME_CONSTANT`, `RETRIGGER_CUT_SECONDS`) match what the 05-04 listening checkpoint heard and approved | ✓ VERIFIED | All three remain `0.015` (`web-audio-synth-engine.ts:35,38,48`), identical to the values 05-04-SUMMARY.md records as heard and approved — none were touched by the later code-review fix rounds. |
| 9 | `MASTER_GAIN`'s shipped value was heard in a real browser and its final value recorded with the verdict that produced it (05-04-PLAN.md's own must-have) | ✓ VERIFIED | Post-WR-01 shipped value `1/6` re-auditioned in a real browser via 05-UAT.md Test 1 (2026-08-07): single note and Algorithm 32's six-carrier worst case both confirmed comfortably audible. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/core/audio/audio-context.token.ts` | `AUDIO_CONTEXT_CTOR` DI token, structural Web Audio interfaces | ✓ VERIFIED | Present, exports match plan, wired into engine constructor |
| `src/app/core/audio/synth-engine.token.ts` | `SYNTH_ENGINE` token indirection | ✓ VERIFIED | Factory resolves to `WebAudioSynthEngine`; injected by `Playground`, not the concrete class |
| `src/app/core/audio/web-audio-synth-engine.ts` | Persistent-graph engine implementing `SynthEngine` | ✓ VERIFIED | Full lifecycle, routing, note-on/off/retrigger, teardown all present and substantive |
| `src/app/core/audio/testing/fake-audio-context.ts` | Hand-rolled Web Audio fakes | ✓ VERIFIED | Used throughout both spec files; supports connection/automation introspection |
| `src/app/domain/dx7/audio/value-conversion.ts` | Pure DX7-scale↔Web-Audio conversions, zero Angular imports | ✓ VERIFIED | `npm run lint` passes (DOMAIN-04 purity gate); all conversions present |
| `src/app/domain/dx7/audio/patch-plan.ts` | `planConnections`, pure edge-traversal routing plan | ✓ VERIFIED | 32-algorithm sweep in `patch-plan.spec.ts`, zero Angular/Web Audio imports |
| `src/app/features/playground/keyboard-note-map.ts` | Frozen 12-key lookup table + `noteForKeyCode` | ✓ VERIFIED | 12 entries, both input surfaces read this one table |
| `src/app/features/playground/playground.ts` / `.html` / `.scss` | Enable-audio gate, 12-key play surface, approximation badge | ✓ VERIFIED | All gate states, both input paths, non-color-only states, approximation badge all present and wired |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `AUDIO_CONTEXT_CTOR` | `WebAudioSynthEngine.initialize()` | Constructor call inside a gesture-triggered method | ✓ WIRED | Only call site of `new ctor()` in the codebase |
| `SYNTH_ENGINE` token | `Playground` | `inject(SYNTH_ENGINE)` | ✓ WIRED | `playground.ts:33`; never injects the concrete class |
| `AlgorithmDefinition.edges` | `planConnections()` → engine routing | `applyRouting()` walks `planConnections`/`deriveCarriers` exclusively | ✓ WIRED | No per-algorithm branch found anywhere in `web-audio-synth-engine.ts` |
| `InstrumentState` signals | engine `effect()` → live re-patch | Constructor effect reads all three signals then calls `applyRouting` | ✓ WIRED | `web-audio-synth-engine.ts:142-161`; `setAlgorithm`/`updateOperatorLevel`/`setFeedback` forward into `InstrumentState` only (WR-05: single routing path) |
| Document keydown/keyup/window-blur | engine `noteOn`/`noteOff`/`allNotesOff` | Angular `host` metadata bindings | ✓ WIRED | `playground.ts` host block; automatic teardown via Angular, no manual `addEventListener` |
| `midiNoteToFrequency`/`outputLevelToAmplitude` (domain) | oscillator/gain scheduling (engine) | Direct function calls in `noteOn`/`scheduleAttack`/`scheduleRetrigger` | ✓ WIRED | Single crossing point, no duplicate conversion logic found |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| AUDIO-01 | Audio never starts before an explicit user gesture; suspended/unavailable state is shown | ✓ SATISFIED | Truths 1, 8 above |
| AUDIO-02 | User can play/release a note from a monophonic educational engine with no stuck voices after note-off or algorithm switch | ✓ SATISFIED | Truths 2, 3, 5, 6 above |
| AUDIO-03 | The MVP engine is clearly labeled as a teaching approximation, not bit-accurate | ✓ SATISFIED | Truth 4 above |

No orphaned requirements — REQUIREMENTS.md maps exactly AUDIO-01/02/03 to Phase 5, and all three appear in every plan's `requirements` frontmatter.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/app/features/playground/playground.ts:129-151` | WR-10 (carried forward from round-4 review, still open, non-blocking): `pointerHeldNote` tracks the *note*, not the *pointer session* — a same-key interleaved second mouse button can release a note the primary button is still physically holding | ℹ️ Info | Does **not** produce a stuck voice (the opposite: a premature release), so it does not violate Roadmap SC2/AUDIO-02 as literally stated. A narrow, real corner case (same on-screen key + a second concurrent mouse button or touch/pen contact). Documented in `05-REVIEW.md` WR-10 with a concrete `pointerId`-based fix already sketched. Recommend a follow-up item rather than blocking this phase. |
| `src/app/core/audio/web-audio-synth-engine.ts:430-458`, `src/app/features/playground/playground.ts:153-175` | WR-09 (carried forward, still open, non-blocking): monophonic last-note-priority design — holding key A then also key W (without releasing A) retriggers to W; releasing W silences the voice entirely rather than resuming A | ℹ️ Info | This is a real, undocumented-in-code UX consequence of the single-voice design, not a defect — a monophonic engine has no note-stack to fall back to. Does not violate "no stuck voices." Recommend documenting the limitation next to the tracker fields, or implementing a held-key stack in a later phase, per the round-4 review's own suggestion. |
| — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any Phase 5 file (`src/app/core/audio/`, `src/app/features/playground/`, `src/app/domain/dx7/audio/`) | — | Clean |
| — | No `console.log`/`console.warn`/`console.error` found in Phase 5 production files | — | Clean |
| — | No hardcoded hex colors in `playground.scss` (grep after comment-stripping returns 0) | — | Clean |

### Behavioral Spot-Checks / Full Suite

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full workspace build | `npm run build` | Exit 0, bundles produced | ✓ PASS |
| Full workspace lint | `npm run lint` | "All files pass linting." | ✓ PASS |
| Full workspace test suite (run once) | `npm test -- --watch=false` | 27 test files, **722/722 tests passed** (up from 717 — 5 new regression tests added by the post-verification fixes below) | ✓ PASS |
| Named regression tests for every round-4-reviewed fix (CR-01, CR-02, WR-01, WR-04, WR-06, WR-07, WR-08) exist and are included in the above run | `grep -n "CR-01\|CR-02\|WR-0[1-9]"` across the three affected spec files | All present, matching the fix commits' descriptions | ✓ PASS |
| Phase 1 `SynthEngine` contract untouched | `git log --follow -- src/app/core/audio/synth-engine.ts` | Only the original Phase 1 commit | ✓ PASS |

### Human Verification

No pending human verification. The shipped `MASTER_GAIN` (`1/6`) re-audition tracked here was completed as 05-UAT.md Test 1 (`result: pass`, 2026-08-07).

---

### Addendum: Post-Verification Fixes (Same Session)

Three additional issues were found and fixed after the evidence above was gathered, during a
follow-up code-review pass. All are covered by new named regression tests; the counts and source
anchors above already reflect the resulting code.

| Fix | Root Cause | Regression Test |
|-----|-----------|-----------------|
| Stuck voice via the on-screen button's own Space/Enter activation | `onKeyButtonKeydown`/`onKeyButtonKeyup` had no held-note tracking (unlike the pointer and document-keyboard paths) — Tab-ing focus to a different key button while Space was still physically held delivered the eventual keyup to the *wrong* button, releasing nothing and stranding the actually-sounding note. Fixed with a `buttonHeldNote` field mirroring `pointerHeldNote`/`keyboardHeldCode` (`playground.ts:59-77`, `onKeyButtonKeydown`/`onKeyButtonKeyup` at `playground.ts:181-213`, cleared on window blur). | `playground.spec.ts:501` |
| `initialize()`/`destroy()` race | `context.resume()` is a genuine async boundary — a `destroy()` (or a second `initialize()`) completing while an earlier `initialize()` was still awaiting it let that earlier call's stale continuation overwrite the correct post-destroy `status` with `'ready'`/`'error'`, or (in the concurrent-reinitialize case) risked clobbering a legitimate newer context. Fixed with an `initializationGeneration` counter, bumped by both `initialize()` and `destroy()`; a stale continuation now recognizes the mismatch and returns without touching state (`web-audio-synth-engine.ts:132-140`, `initialize()` at `169-206`, `destroy()`'s bump at `550`). | `web-audio-synth-engine.spec.ts` (two new cases, "destroy() called while initialize() is still awaiting…") |
| `cancelScheduledValues()` + manual `.value` re-read as a ramp-cancellation anchor | This idiom's behavior at the cancellation instant is not consistently the interpolated mid-ramp value across browser Web Audio implementations — the documented reason `cancelAndHoldAtTime()` exists. Replaced at all four sites that cancel a still-running ramp to start a new one: `scheduleGainValue` (routing/modulation-depth), `scheduleAttack`, `scheduleRetrigger`, `releaseVoice`. (The two sites that intentionally jump to a fixed, known-safe value rather than preserving whatever is mid-ramp — the carrier-amplitude anchor in `applyRouting` and `destroy()`'s hard silence — are unaffected; jumping to a known value is the correct behavior there, not the pattern being replaced.) | `web-audio-synth-engine.spec.ts` (two new cases asserting `cancelAndHoldAtTime`, not `cancelScheduledValues`) |

One additional finding from that pass was investigated and found **not** to be a live defect:
reverting `setAlgorithm`/`updateOperatorLevel`/`setFeedback` to synchronously call `applyRouting()`
in addition to the constructor `effect()` would reintroduce the double-application WR-05 was
specifically written to remove (see the code comment at `web-audio-synth-engine.ts:411-417`
documenting the effect as the *sole* routing path). Angular's `effect()` flushes on the same
microtask tick as the triggering signal write, well inside any perceptible "immediate" threshold
for D-02, and `05-02-PLAN.md`'s own acceptance criteria already require the re-patch to be tested
through `InstrumentState.setAlgorithm()` + `TestBed.tick()` — confirming the effect-driven design,
not a synchronous call, was the intended shape. No change made.

---

## Gaps Summary

No blocking gaps. All three Roadmap Success Criteria (gesture gate, no stuck voices after note-off/algorithm switch, approximation labeling) are verified against the current post-review-fix codebase with strong automated evidence (722/722 tests, including named regression tests for every code-review finding) plus the already-recorded 05-04 human listening checkpoint and the post-WR-01 `MASTER_GAIN=1/6` re-audition (05-UAT.md Test 1, passed). Two non-blocking, already-documented review warnings (WR-09, WR-10) remain open but do not touch the "stuck voice" failure mode the roadmap criterion is about.

---

*Verified: 2026-08-07T14:19:39Z*
*Verifier: Claude (gsd-verifier)*
