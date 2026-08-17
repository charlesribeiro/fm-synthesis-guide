---
phase: 9
slug: dx7-style-envelopes-and-parameter-mapping
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-14
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.8`, run through Angular 22's `@angular/build:unit-test` builder |
| **Config file** | none — no standalone `vitest.config.ts`; the builder derives its Vitest config from `angular.json`/`tsconfig.spec.json` |
| **Quick run command** | `npm test -- <changed-spec-file-pattern>` |
| **Full suite command** | `npm test` (runs once and exits outside a TTY; `pretest` runs `npm run build:worklet` first) |
| **Measured runtime at phase close** | 1189/1189 tests, ~1.8s |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <changed-spec-file-pattern>`
- **After every plan wave:** Run `npm test` (full suite — no separate quick/full split in this project)
- **Before `/gsd-verify-work`:** `npm run build`, `npm test`, `npm run lint` all green, plus the blocking human-listening checkpoint (plan 09-04, Task 2) approved
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Task ID/Plan/Wave columns filled in from the four executed plans' SUMMARY.md files
(09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md, 09-04's own tasks) and cross-checked
against each plan's own Task Commits section, not from this draft's original intentions.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 1 | 09-01 | 1 | ENGINE-03 | — | `OperatorParameters.envelope` carries a structured `Dx7Envelope` (four rates, four levels) replacing the flat `envelopeLevel` stand-in; `DEFAULT_OPERATOR_PARAMETERS` uses one identical `DEFAULT_ENVELOPE` shared by reference across all six operators | unit | `npm test -- operator-parameters` / `npm test -- patch` | ✓ Exists | ✅ passed |
| Task 1 | 09-01 | 1 | ENGINE-03 | — | `EnvelopeGenerator`: six independent per-operator envelope generators inside `GraphRouter`, each scaling its own operator's block strictly before it is read as a carrier contribution or modulation source | unit | `npm test -- envelope-generator` / `npm test -- graph-router` / `npm test -- algorithm-routing` | ✓ Exists | ✅ passed |
| Task 1 | 09-01 | 1 | ENGINE-03 | T-09-01 | `setGate` worklet message reaches the kernel end to end: `WorkletSynthEngine.noteOn`/`noteOff`/`allNotesOff`/`destroy` post gate messages instead of scheduling a Web Audio ramp; `Dx7WorkletProcessor` dispatches `setGate` to `GraphRouter.setGate` | unit | `npm test -- worklet-messages` / `npm test -- worklet-synth-engine` / `npm test -- worklet-processor-bundle` | ✓ Exists | ✅ passed |
| Task 1 | 09-01 | 1 | ENGINE-03 | — | Global click-prevention voice ramp and its dedicated gain node removed from `WorkletSynthEngine`; a never-gated router renders an all-zero block (silence at rest) | unit | `npm test -- worklet-synth-engine` / `npm test -- graph-router` | ✓ Exists | ✅ passed |
| Task 2 | 09-01 | 1 | ENGINE-03 | T-09-02 | Envelope state machine timing/continuity/boundary/long-hold invariants (exact segment-completion sample counts, per-sample-not-per-block advance, mid-segment gate-off/gate-on continuity, rate/level boundary finiteness, long-hold exactness) proven with break-then-restore regression probes | unit | `npm test -- envelope-generator` | ✓ Exists | ✅ passed |
| Task 1 | 09-02 | 2 | ENGINE-03 | T-09-01 | Hostile-payload matrix for `setGate` (open/velocity: wrong type, non-integer, non-finite, out-of-range, throwing getter) and the widened `envelope` member (container/tuple-length/per-index entry-value shapes), proven with a scratch probe that loosened the gate branch | unit | `npm test -- worklet-messages` | ✓ Exists | ✅ passed |
| Task 1 | 09-02 | 2 | ENGINE-03 | — | Gated-note bundle parity: the built worklet bundle, driven through a gate-on message, renders the same enveloped samples as the in-repo `GraphRouter` kernel (non-silence asserted before parity) | unit | `npm test -- worklet-processor-bundle` | ✓ Exists | ✅ passed |
| Task 2 | 09-02 | 2 | ENGINE-03 | — | Kernel note-lifecycle sweep proven finite and bounded across gate-on/attack/sustain/gate-off/release on one algorithm per teaching-taxonomy group, repeated at maximum feedback with every operator at maximum output level | unit | `npm test -- graph-router` | ✓ Exists | ✅ passed |
| Task 2 | 09-02 | 2 | ENGINE-03 | T-09-03 | Silence-at-rest guard: a never-gated router renders exactly zero; a completed release against a zero release target stays exactly zero across many further blocks | unit | `npm test -- graph-router` | ✓ Exists | ✅ passed |
| Task 2 | 09-02 | 2 | ENGINE-03 | — | Modulator-envelope reachability (this phase's highest-value mechanical guard): changing only a modulator-role operator's envelope changes the rendered block, with a mirrored carrier-only symmetry check; proven with a scratch probe that relocated the envelope multiply into the carrier-summing loop | unit | `npm test -- graph-router` | ✓ Exists | ✅ passed |
| Task 2 | 09-02 | 2 | ENGINE-03 | — | Held-note re-patch continuity: a routing-config change and, separately, an operator-parameter change applied while gated do not restart the envelope | unit | `npm test -- graph-router` | ✓ Exists | ✅ passed |
| Task 3 | 09-02 | 2 | ENGINE-03 | — | End-to-end velocity regression after the removed voice-gain node (Pitfall 2): exactly one gain node is built, no gain-parameter scheduling occurs across a note lifecycle, velocity still scales loudness via the router's output-stage multiplier | unit | `npm test -- worklet-synth-engine` | ✓ Exists | ✅ passed |
| Task 3 | 09-02 | 2 | ENGINE-03 | — | Explicit regression coverage for Phase 8's shipped ratio/fixed frequency-mode math (ratio mode across every coarse ratio position and both detune extremes; fixed mode across several note frequencies; a six-operator mixed-mode case) — the ROADMAP's Phase 9 frequency-mode success criterion | unit | `npm test -- value-conversion` | ✓ Exists | ✅ passed |
| Task 3 | 09-02 | 2 | ENGINE-03 | — | Rate-curve full-scale-duration regression re-derived from the exported `ENVELOPE_MIN`/`MAX_FULL_SCALE_SECONDS` endpoint constants via the geometric-interpolation formula, not a hardcoded literal | unit | `npm test -- value-conversion` | ✓ Exists | ✅ passed |
| Task 1 | 09-03 | 2 | ENGINE-03 | — | Algorithm 1 lesson's starting patch gives its derived carriers a sustained envelope (`DEFAULT_ENVELOPE`) and its derived modulators a decaying envelope, read from `deriveCarriers` over the canonical `ALGORITHMS` dataset rather than a hardcoded operator-id list (D-06) | unit | `npm test -- lessons` | ✓ Exists | ✅ passed |
| Task 1 | 09-03 | 2 | ENGINE-03 | — | Algorithm 32 lesson's starting patch keeps one uniform envelope (the shared `DEFAULT_ENVELOPE` reference) across all six operators, documented as a pedagogical fact | unit | `npm test -- lessons` | ✓ Exists | ✅ passed |
| Task 1 | 09-03 | 2 | ENGINE-03 | T-09-03 | Every shipped envelope (both lesson starting patches and `DEFAULT_ENVELOPE`) has a zero release-segment level and passes the throwing validation guard the user-edit boundary applies, iterated from the dataset | unit | `npm test -- lessons` | ✓ Exists | ✅ passed |
| Task 2 | 09-03 | 2 | ENGINE-03 | — | README.md and docs/ARCHITECTURE.md describe per-operator envelopes as shipped without upgrading the standing educational-approximation claim into an emulation claim; about.html's user-facing disclaimer unchanged | other | `grep -rEic 'bit-accurate emulation\|exact emulation\|accurately emulates\|faithful emulation' README.md docs/ARCHITECTURE.md` → 0; `git diff --stat HEAD -- src/app/features/about/about.html` → empty | ✓ Exists | ✅ passed |
| Task 1 | 09-04 | 3 | ENGINE-03 | T-09-06 | Dev harness's routed play path posts a `setGate` message in the same order (frequency, then gate) `WorkletSynthEngine.noteOn` posts; `voiceGain` held at unity on that path so the kernel's own envelopes are the only amplitude shaping; four named envelope presets built as module-scope data; harness stays framework-free and outside any production build | build/isolation | `npm run harness && npm run typecheck:worklet && npm test && npm run lint && npm run build && npm run verify:harness-isolation` — `dev-dist/worklet-harness.js` yields 0 matches for `@angular`; `grep -c 'setGateMessage' harness-main.ts` ≥ 2 | ✓ Exists | ✅ passed |
| Task 2 | 09-04 | 3 | ENGINE-03 | T-09-03 / T-09-07 | Engine silent at rest with audio enabled and no note held; note-on/off and mid-segment release/retrigger click-free; a modulator's envelope audibly shaping timbre distinctly from a carrier's envelope; bounded output at max feedback/max level; Lesson 6's Algorithm 1 try-this flow still completes and matches its description; the persistent educational-approximation label unchanged, in a real browser | manual, blocking | Blocking human-verify checkpoint: `npm run start:harness`, `http://localhost:4200/dev/worklet-harness.html`, then `npm start`/`/playground`/`/learn/algorithm-1` — resume payload must name the Check 2 and Check 5 algorithm ids plus explicit verdict words for Check 1 and Check 5 | N/A — inherently manual, by design | ✅ approved |
| Task 3 | 09-04 | 3 | ENGINE-03 | — | Checkpoint findings (if any) applied and the phase validation record completed and traceable to real task ids | doc | This file — completed with zero source changes (checkpoint approved with zero findings) | ✓ Exists (this file) | ✅ passed |

*Threat refs: T-09-01 (`setGate` message / widened `envelope` member — hostile main-thread → render-thread payload), T-09-02 (unbounded/non-finite envelope rate curve), T-09-03 (silence at rest, judged by ear — this phase removed the dedicated voice-gain node that used to hold it), T-09-06 (dev harness bundle → production build output), T-09-07 (checkpoint approval without auditable content) — see `09-04-PLAN.md` § threat_model.*

Pre-close full-suite confirmation for this table (09-04 Task 1, re-confirmed for Task 3 with zero further source changes): `npm test` — 1189/1189 passed, `npm run build` exits 0, `npm run lint` exits 0, `npm run typecheck:worklet` exits 0, `npm run verify:harness-isolation` — all three stages passed.

*Status: ⬜ pending · ✅ passed · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/app/domain/dx7/dsp/envelope-generator.ts` — new EG state-machine implementation (09-01 Task 1)
- [x] `src/app/domain/dx7/dsp/envelope-generator.spec.ts` — segment-advance timing, retrigger/release-mid-segment continuity, non-linear rate-direction proofs (09-01 Task 1, invariants extended Task 2)
- [x] `setGate` worklet message kind in `worklet-messages.ts` + corresponding hostile-payload test cases in `worklet-messages.spec.ts` (09-01 Task 1 wiring, 09-02 Task 1 hostile-payload matrix)
- [x] Framework install: none — Vitest was already fully wired

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Checkpoint Outcome |
|----------|-------------|------------|-------------------|---------------------|
| Engine is silent at rest with audio enabled and no note held (the property that lost its dedicated gain node this phase) | ENGINE-03, T-09-03 | jsdom has no Web Audio API — a real `AudioContext` with nothing scheduled is the only way to confirm no residual tone/hum/pad | Enable audio on the dev harness, wait 10+ seconds with no note played, across all four envelope presets | **Clean.** 10+ seconds idle across all four presets — complete silence, no audible hum/pad/tone. |
| Note-on and note-off are click-free on the default envelope, including mid-attack release and mid-release retrigger (D-04) | ENGINE-03, D-04 | Click-safety is a perceptual judgment no automated amplitude/finiteness assertion can substitute for | Play/stop the default preset on an additive-stacks algorithm several times at different speeds; release mid-swell and retrigger mid-release on the slow-swell preset | **No issues reported.** Check 2 sampled Algorithm 3 on the default preset — clean onset, steady hold, clean decay, no click. Checks 6 (mid-segment release/retrigger) and 3/4 (swell/percussive shape) reported no issues. |
| A modulator's envelope audibly shapes timbre over the life of a held note, distinctly from a carrier's envelope shaping loudness — the point of the phase (D-01) | ENGINE-03, D-01 | Timbral evolution over time is inherently a listening judgment; no automated sample comparison substitutes for "does this sound like it's mellowing" | Hold a long note on an algorithm with real modulation depth using the carrier-sustains/modulator-decays preset; compare directly against the default preset on the same algorithm | **Audible.** Check 5 sampled Algorithm 8 (two modulators feeding carrier 3, plus a separate pair feeding carrier 1): the modulator-decay preset opened bright and mellowed while the default preset stayed constant, as expected. |
| Output stays bounded and never painfully loud at maximum feedback with every operator at maximum level; a held-note algorithm/feedback/preset change re-patches without restarting the envelopes and without a stuck voice | ENGINE-03 | Loudness-safety and re-patch continuity are perceptual/interactive judgments a unit test's finite-and-bounded proof does not fully stand in for at the ears | Raise feedback to maximum with the max-operator-level control engaged on the default preset; change algorithm, feedback, and envelope preset mid-note; stop and confirm complete silence | **No issues reported.** Checks 7 (held-note re-patch) and 8 (bounded worst case) passed with no findings. |
| The app itself (`/playground`) sounds correct, click-free, and safe over the live `WorkletSynthEngine`; Lesson 6's Algorithm 1 try-this flow still completes and matches its description (D-03); the persistent educational-approximation label reads unchanged | ENGINE-03, D-03 | Exercises the actual shipped app and lesson UI, not just the dev harness — the live cutover and the lesson's completion-detection path are both real UI/audio integration surfaces | `npm start`, play `/playground` via keyboard and computer keys; open `/learn/algorithm-1`, hold a note, perform the try-this action; check the honesty-copy disclaimer | **No issues reported.** Checks 9 (the app itself), 10 (Lesson 6 regression), and 11 (honesty copy) all passed. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every `type="auto"`/`type="tracer"` task across 09-01/09-02/09-03/09-04 carries a passing `<automated>` verify; 09-04's Task 2 is the phase's only non-automated task and is itself a `checkpoint:human-verify`, not a gap.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — the full task sequence across the phase is auto/tracer, auto, auto, auto, auto, auto, auto, auto, auto, checkpoint, auto; the single checkpoint is bracketed by automated tasks on both sides.
- [x] Wave 0 covers all MISSING references — see the Wave 0 Requirements checklist above; both items shipped in 09-01 Task 1, with invariant coverage extended in 09-01 Task 2 and the hostile-payload matrix extended in 09-02 Task 1.
- [x] No watch-mode flags — every Automated Command in the table above passes with no watch-mode flag; `npm test` exits once outside a TTY per the documented Phase 1 finding.
- [x] Feedback latency < 60s — `npm test`'s full-suite run measured ~1.8s for 1189 tests at phase close.
- [x] `nyquist_compliant: true` set in frontmatter — set above; all sampling-continuity and Wave 0 obligations are met and the blocking checkpoint closed with an auditable approval payload.

**Approval:** validated. The blocking listening checkpoint (09-04 Task 2) was approved with zero findings and a complete auditable resume payload — Check 2 (default envelope, click-free lifecycle) sampled Algorithm 3, Check 5 (per-operator timbral evolution) sampled Algorithm 8 with the carrier-sustains/modulator-decays preset against the default preset, Check 1 (silence at rest) verdict `clean`, Check 5 verdict `audible`. Checks 3, 4, 6, 7, 8, 9, 10, and 11 all reported no issues. Task 3 made no source change under `src/` or `worklets/` — the checkpoint approved with zero findings, so per the 06-04 precedent this file's completion is the only change.

**Checkpoint record:** 09-04 Task 2 reported all 11 checks passing. Resume payload: `approved check2=3 check5=8 silence=clean evolution=audible`. No constant tuning was requested or applied.
