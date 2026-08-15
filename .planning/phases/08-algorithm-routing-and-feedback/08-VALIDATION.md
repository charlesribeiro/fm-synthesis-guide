---
phase: 8
slug: algorithm-routing-and-feedback
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-12
# Listening evidence note: the original D-02/D-12 checkpoint closed with a bare
# "approved" and no recorded Additive / Tree-Branch / Rooting / Parallel /
# max-feedback algorithm ids. Under the updated 08-04-PLAN resume-signal that
# payload is required; without it the checkpoint must be re-run before restoring
# status: validated (do not invent sample ids).
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.8`, run through Angular 22's `@angular/build:unit-test` builder |
| **Config file** | none — no standalone `vitest.config.ts`; the builder derives its Vitest config from `angular.json`/`tsconfig.spec.json` (unchanged from Phase 7) |
| **Quick run command** | `npm test` (runs once and exits outside a TTY — documented Phase 1 finding; `npm test -- --run` is not a real flag this builder proxies) |
| **Full suite command** | `npm test` (same command — this project has not established a separate quick/full split) |
| **Estimated runtime** | 1039/1039 tests, ~2s (measured at phase close, up from Phase 7's baseline) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test` + `npm run build` + `npm run lint`
- **Before `/gsd-verify-work`:** `npm run build`, `npm test`, `npm run lint` all green (CLAUDE.md's mandatory verification commands), plus the D-02/D-12 blocking human-listening checkpoint approved
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

Task ID/Plan/Wave columns filled in from the four executed plans' SUMMARY.md files
(08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md, 08-04-SUMMARY.md) and cross-checked
against `git log --follow` on each spec file, not from this draft's original intentions.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 1 | 08-01 | 1 | ENGINE-02 | — / — | N/A | unit | `npm test` — `operator.spec.ts#renderWithFeedback` base path: zero-index equivalence, one-sample-delay recurrence, non-finite guards | ✓ Exists | ✅ passed |
| Task 2 | 08-01 | 1 | ENGINE-02 | — / — | N/A | unit | `npm test` — `operator.spec.ts#renderWithFeedback` proves Algorithm 15's combined feedback-plus-external-modulation shape at operator granularity (D-06), plus `resetPhase()` clearing feedback history | ✓ Exists | ✅ passed |
| Task 1 | 08-01 | 1 | ENGINE-02 | — / — | N/A | unit | `npm test` — `graph-router.spec.ts` renders Algorithm 1 end to end identical to a hand-built reference; `ALGORITHMS` dataset higher-modulates-lower invariant; output-bound placement at the summed-carrier stage (T-08-03) | ✓ Exists | ✅ passed |
| Task 2 | 08-01 | 1 | ENGINE-02 | — / — | N/A | unit | `npm test` — `graph-router.spec.ts` routing-change hygiene (T-08-04): applying a second algorithm clears feedback history so a relocated feedback operator never reads a stale sample | ✓ Exists | ✅ passed |
| Task 1 | 08-01 | 1 | ENGINE-02 | — / — | N/A | unit | `npm test` — `worklet-synth-engine.spec.ts` `SYNTH_ENGINE` resolves `WorkletSynthEngine` (D-01 cutover) | ✓ Exists | ✅ passed |
| Task 2 | 08-02 | 2 | ENGINE-02 | — / — | N/A | unit | `npm test` — `algorithm-routing.spec.ts` all 32 `ALGORITHMS` rows match the independently-derived `evaluateAlgorithmReference` sample-for-sample within 6 decimal places (D-10) | ✓ Exists | ✅ passed |
| Task 2 | 08-02 | 2 | ENGINE-02 | — / — | N/A | unit | `npm test` — `algorithm-routing.spec.ts` all 32 rows stay finite and inside `[-1, 1]` at feedback level 7 with every operator at maximum output level, across multiple rendered blocks (D-11) | ✓ Exists | ✅ passed |
| Task 2 | 08-02 | 2 | ENGINE-02 | — / — | N/A | unit | `npm test` — `algorithm-routing.spec.ts` degenerate router-API backstops (T-08-06): empty carrier list renders silence; feedback-only connections leave every other operator unmodulated | ✓ Exists | ✅ passed |
| Task 1 | 08-03 | 2 | ENGINE-02 | T-08-01 / `parseWorkletMessage` validation choke point | Malformed `setAlgorithm`/`setOperatorParameters`/`setFeedback` payloads are rejected (`null`), current routing/parameters stay in effect, never a partial apply or throw | unit | `npm test` — `worklet-messages.spec.ts` hostile-payload matrix for all three message kinds: rejected-payload tables, accepted-payload group at every documented bound, nested hostile-getter cases | ✓ Exists | ✅ passed |
| Task 2 | 08-03 | 2 | ENGINE-02 | — / — | N/A | unit | `npm test` — `worklet-processor-bundle.spec.ts` the real esbuild-built worklet bundle renders the routed path element-for-element identical to a directly-constructed `GraphRouter` across two rendered blocks (T-08-04) | ✓ Exists | ✅ passed |
| Task 2 | 08-03 | 2 | ENGINE-02 | — / — | N/A | unit | `npm test` — `worklet-processor-bundle.spec.ts` a routing-config switch to a second algorithm with a different feedback operator id replaces the processor's cached connections/carriers/feedback-operator/feedback-history as one atomic unit (T-08-04); malformed routing-config and unexpected-quantum-size cases throw nothing | ✓ Exists | ✅ passed |
| Task 3 | 08-03 | 2 | ENGINE-02 | — / — | N/A | unit | `npm test` — `worklet-synth-engine.spec.ts` message separation (Pitfall 5): an algorithm switch, an operator-parameter edit, and a feedback edit each post only their own message kind; an unchanged snapshot posts nothing; a direct `InstrumentState` write reaches the port identically to the engine's own setter methods | ✓ Exists | ✅ passed |
| Task 3 | 08-03 | 2 | ENGINE-02 | — / — | N/A | unit | `npm test` — `worklet-synth-engine.spec.ts` D-13: switching algorithms while a note is held re-patches live — `heldNote` stays set, no second note-frequency message, no silencing gain schedule | ✓ Exists | ✅ passed |
| Task 3 | 08-03 | 2 | ENGINE-02 | — / — | N/A | unit | `npm test` — `worklet-synth-engine.spec.ts` ratio/detune/mode reach the worklet through the reactive `InstrumentState` path in an operator-parameters message (D-15/D-16); `destroy()` clears the held note so a subsequent `noteOff` throws/posts nothing | ✓ Exists | ✅ passed |
| Task 1 | 08-04 | 3 | ENGINE-02 | T-08-09 / dev harness reaching a production build | Extended harness (`ALGORITHMS`-driven select, feedback-depth slider, routed playback via the shared message contract) stays framework-free and unreachable from a production build | build/isolation | `npm run harness && npm run typecheck:worklet && npm run build && npm run verify:harness-isolation` — `dev-dist/worklet-harness.js` yields 0 matches for `@angular` | ✓ Exists | ✅ passed |
| Task 2 | 08-04 | 3 | ENGINE-02 | T-08-10 / hearing safety at max feedback | Worklet routes and sounds correct for one algorithm per taxonomy group (Additive Stacks, Tree/Branch, Rooting, Parallel) plus maximum feedback and maximum operator level, in a real browser | manual, blocking | D-02/D-12 checkpoint: `npm run start:harness`, `http://localhost:4200/dev/worklet-harness.html` — checks 1-6 (four taxonomy groups, max feedback, max operator level, held-note algorithm switching); resume payload must name the five sample algorithm ids | N/A — inherently manual, by design | ⏳ pending re-run (bare historical `approved` lacked sample ids) |
| Task 2 | 08-04 | 3 | ENGINE-02 | — / — | N/A | manual, blocking | D-02/D-12 checkpoint, checks 7-9: the app itself (`/playground`) over the live `WorkletSynthEngine`; Lesson 6's Algorithm 1 try-this completion flow (D-03); the persistent educational-approximation honesty label unchanged (D-05, AUDIO-03) | N/A — inherently manual, by design | ⏳ pending re-run (same auditable resume payload) |

*Threat refs: T-08-09 (dev harness bundle → production build output — `07-VERIFICATION.md` reproduced
this leak once already), T-08-10 (routed audio output → the listener's ears — the one boundary no
automated test crosses) — see `08-04-PLAN.md` § threat_model.*

Pre-close full-suite confirmation for this table (08-04 Task 3): `npm test` — 1039/1039 passed,
`npm run build` exits 0, `npm run lint` exits 0 (all three re-run 2026-08-13 as part of closing this
plan, with zero source changes since the checkpoint was approved with zero findings).

---

## Wave 0 Requirements

- [x] `src/app/domain/dx7/dsp/operator.ts` + `.spec.ts` extension — feedback-capable render path (`renderWithFeedback`, `previousSample`, `resetPhase` reset of feedback history)
- [x] `src/app/domain/dx7/dsp/graph-router.ts` + `.spec.ts` — new module: six persistent `PhaseModulatedOperator` instances, routing-config setter, descending-id render loop, D-08 hard clamp at final carrier-summed output
- [x] `src/app/domain/dx7/dsp/reference-evaluator.ts` + `.spec.ts` — new module, D-10's independently-authored recursive per-sample evaluator
- [x] `src/app/domain/dx7/dsp/algorithm-routing.spec.ts` — new file, the 32-row cross-check (D-10) + bounded/finite sweep at feedback=7 (D-11)
- [x] `src/app/domain/dx7/dsp/worklet-messages.ts` + `.spec.ts` extension — `setAlgorithm`, `setOperatorParameters`, `setFeedback` message kinds (D-14 + Summary fact 3)
- [x] `src/app/core/audio/worklet-synth-engine.ts` + `.spec.ts` extension — `InstrumentState`-reactive constructor `effect()`, mirroring `WebAudioSynthEngine`'s existing shape
- [x] `src/app/core/audio/synth-engine.token.ts` — D-01's one-line factory cutover to `WorkletSynthEngine`
- [x] `worklets/dx7-worklet-processor.ts` — extend to hold the cached routing table (operator params, connections, carriers, feedback operator id) and call the graph router every render quantum
- [x] `worklets/harness/harness-main.ts` — extend with algorithm-select + feedback-depth controls, so D-12's checkpoint can sample one algorithm per taxonomy group plus max feedback
- [x] Framework install: none — all tooling already present (unchanged from Phase 7)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Checkpoint Outcome |
|----------|-------------|------------|-------------------|---------------------|
| Worklet routes and sounds correct for one algorithm per taxonomy group (Additive Stacks 1–6, Tree/Branch 7–18, Rooting 19–25, Parallel 26–32) plus max feedback depth, in a real browser | ENGINE-02 (success criteria 1–3) | jsdom has no `AudioWorkletGlobalScope` — nothing short of a real `AudioContext` + `audioWorklet.addModule()` proves the routed graph actually loads, routes, and sounds correct; D-07's "authentically harsh at max feedback" character is inherently a listening judgment | Extend the dev harness (`worklets/harness/harness-main.ts`) with algorithm-select + feedback-depth controls, serve the app, sample the four taxonomy-group algorithms plus max feedback, confirm no stuck notes across switches (D-13), and confirm output stays audibly bounded (D-08) | **Pending re-run.** Historical response was a bare `approved` with no recorded Additive / Tree-Branch / Rooting / Parallel / max-feedback sample algorithm ids. Under the updated `08-04-PLAN.md` resume-signal that auditable payload is required; do not invent ids and do not retain `status: validated` on the incomplete approval. |
| Lesson 6's Algorithm 1 try-this completion flow (target operator/param move + note trigger) still completes correctly against `WorkletSynthEngine` | ENGINE-02, D-03 | The completion flow is a live UI interaction tied to real audio parameter changes reaching the newly-cut-over engine — the general 32-algorithm correctness suite does not exercise the lesson's specific try-this detection path | Open Lesson 6 (Algorithm 1) in `/learn`, perform the documented try-this move (per `06-CONTEXT.md` D-02/D-06) against the live worklet engine, confirm the completion state fires and the sound matches expectations | **Pending re-run** as part of the same auditable D-12 checkpoint payload (checks 7–9). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every `type="auto"` task across
      08-01/08-02/08-03/08-04 carries a passing `<automated>` verify; 08-04's Task 2 is the phase's
      only non-automated task and is itself a `checkpoint:human-verify`, not a gap.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — the full task sequence
      across the phase is auto, auto, auto, auto, auto, auto, auto, auto, checkpoint, auto; the single
      checkpoint is bracketed by automated tasks on both sides.
- [x] Wave 0 covers all MISSING references — see the Wave 0 Requirements checklist above, all ten
      items shipped across 08-01 (kernel, router, message kinds, engine cutover), 08-02 (reference
      evaluator, cross-check), 08-03 (message hardening, bundle parity, live re-patch), and 08-04 (dev
      harness controls).
- [x] No watch-mode flags — every Automated Command in the table above passes with no watch-mode flag;
      `npm test` exits once outside a TTY per the documented Phase 1 finding, and this file contains
      zero occurrences of the enabled form of any watch flag.
- [x] Feedback latency < 15s — `npm test`'s full-suite run measured well under a second's worth of
      test-file overhead at 1039/1039 tests; individual spec files run faster still.
- [ ] `nyquist_compliant: true` set in frontmatter — deferred: the historical checkpoint
      closed with a bare "approved" and no auditable sample algorithm ids. Under the
      updated `08-04-PLAN.md` resume-signal, re-run Task 2 and record Additive /
      Tree-Branch / Rooting / Parallel / max-feedback ids before restoring
      `status: validated` and `nyquist_compliant: true`.

**Approval:** not retained as validated under the tightened resume-signal. Automated
coverage and the prior human listening session remain recorded below for history, but
the approval lacked the five required sample algorithm ids, so Task 2 must be re-run
with an auditable payload before this file may again claim `status: validated`.

**Historical checkpoint record (insufficient under updated resume-signal):** 08-04 Task 2
reported all nine checks passing with zero findings and a bare `approved` response;
Task 3 made no source changes. Sample algorithm ids were not recorded.

**D-12 four-algorithm interpretation:** the checkpoint sampled one algorithm from each of the four
teaching taxonomy groups (Additive Stacks 1–6, Tree/Branch 7–18, Rooting 19–25, Parallel 26–32) and
re-played one of those four at maximum feedback depth (level 7), rather than a fifth, distinct
feedback-specific algorithm. This interpretation was flagged explicitly in `08-04-PLAN.md`'s
`<flagged_assumptions>` and stated again in the checkpoint's own `<how-to-verify>` text: every one of
the 32 rows in `algorithms.ts` already declares a feedback self-loop, so there is no feedback-free
algorithm in this dataset that could serve as a distinct fifth sample. The checkpoint's D-12 coverage
is therefore complete under this interpretation, and the human verifier had the reasoning available
at verification time, not supplied retroactively.

**Review reconciliation:** `08-REVIEW.md` recorded 1 critical + 2 warnings (+ 1 info). Post-review
disposition (docs/code reconciliation): CR-01 resolved via mode-aware `MASTER_GAIN` in
`WorkletSynthEngine.setRenderMode`/`buildAndStart`; WR structural routing validation (out-of-order
edges, inconsistent self-loops, duplicate carriers → `null`) enforced in `parseWorkletMessage`;
stale README status line corrected. Phase validation status is `draft` pending a D-12
checkpoint re-run that records the five sample algorithm ids required by the updated
`08-04-PLAN.md` resume-signal (historical bare `approved` is not retained as auditable).
