# DX7 Algorithm Lab

## What This Is

An unofficial, educational Angular 22 web app that teaches Yamaha DX7-style six-operator
FM/phase-modulation synthesis through the 32 operator-routing algorithms, one at a time —
combining interactive routing diagrams, guided lessons, and live sound. No affiliation with
Yamaha or the Dexed project; original UI, original demonstration sounds, no copied assets.

## Core Value

A learner can see a six-operator algorithm's routing diagram, hear the sound it produces, change
a parameter, and immediately understand why the sound changed.

## Requirements

### Validated

- [x] Angular 22 scaffold: standalone, zoneless, strict, Vitest, lazy-loaded feature shell —
      Validated in Phase 1: Angular 22 foundation (2026-08-04). FOUND-01 through FOUND-06 all
      complete per REQUIREMENTS.md; `npm run build`, `npm test`, `npm run lint` all green.
- [x] Canonical, validated 32-algorithm domain dataset independent of Angular — Validated in
      Phase 2: algorithm-domain (2026-08-04), with 2026-08-05 topology corrections (Alg 26/27) and
      Alg 19 marked unresolved. DOMAIN-04 is machine-enforced by a proven ESLint gate. D-09 initial
      approved-as-is sign-off is superseded — see
      `.planning/phases/02-algorithm-domain/02-DATASET-REVIEW.md` Section 5.
- [x] Signal-based instrument state facade with immutable updates and read-only selectors —
      Validated in Phase 3: signal-instrument-state (2026-08-05). STATE-01 through STATE-03 all
      complete: `InstrumentState` exposes read-only computed selectors over algorithm/operators/
      feedback, immutable per-operator updates, and A/B full-patch snapshot slots with reset.
      11/11 must-haves verified in `03-VERIFICATION.md`; 456/456 tests passing.
- [x] Data-driven, accessible SVG algorithm diagrams — Validated in Phase 4:
      algorithm-browser-and-svg (2026-08-06). VIS-01 through VIS-03 all complete: a grouped
      32-item browse view derived from `teachingTags` (no hardcoded id ranges), a validated
      `/algorithms/:id` detail route with previous/next stepping and a full rejected-address
      matrix, and an accessible SVG routing diagram (shape-encoded carrier/modulator roles,
      distinct dashed feedback curve, per-instance-scoped element ids) driven entirely by the
      canonical dataset plus 32 hand-authored layout records. 10/10 must-haves verified in
      `04-VERIFICATION.md`; 537/537 tests passing. Human verification (layout legibility across
      all 32 diagrams, non-color/grayscale encoding, keyboard-only journey, VoiceOver spot check)
      approved with no follow-up requested — see `04-05-SUMMARY.md`.
- [x] Monophonic educational audio engine behind an injected browser-audio boundary — Validated
      in Phase 5: first-playable-approximation (2026-08-07). AUDIO-01 through AUDIO-03 all
      complete: audio only starts after an explicit user gesture, a generic edge-traversal patcher
      (`planConnections`) drives all 32 algorithms' routing including a bounded feedback self-loop,
      a 12-key on-screen/computer keyboard plays and releases notes through a stale-release-safe
      path, and the engine is clearly labeled a teaching approximation. 8/9 verification items
      passed automatically; the one human-judgment item (shipped `MASTER_GAIN` = 1/6 still
      comfortably audible after the WR-01 safety-clamp fix) confirmed in real-browser listening —
      see `05-VERIFICATION.md` and `05-UAT.md`. Security review: 8 threats registered, all closed
      (`05-SECURITY.md`).
- [x] AudioWorklet six-operator phase-modulation DSP kernel (accuracy-target engine) — Validated
      in Phase 7: audioworklet-dsp-foundation (2026-08-12). ENGINE-01 complete: a pure,
      allocation-free `PhaseModulatedOperator` kernel proven against the analytical
      `sin(2*pi*f*t)` reference, an `AudioWorkletProcessor` adapter and `WorkletSynthEngine`
      (conforms to the existing `SynthEngine` interface) built and tested entirely outside the
      browser, plus a dev-only listening harness approved in a real-browser checkpoint and
      structurally isolated from every production build path (wave 4 gap closure — the harness
      output was relocated outside the production asset root and a regression gate now proves it
      stays that way). 16/16 must-haves verified in `07-VERIFICATION.md`; 870/870 tests passing.
      `SYNTH_ENGINE` still resolves to Phase 5's `WebAudioSynthEngine` (D-01) — this is the
      foundation Phase 8 cuts the live voice over to.
- [x] All 32 canonical algorithm topologies routed through the worklet kernel with correct
      feedback, and the live engine cut over to it — Validated in Phase 8:
      algorithm-routing-and-feedback (2026-08-13). ENGINE-02 complete: `GraphRouter` renders every
      algorithm's fixed descending topology with a true one-sample feedback delay, cross-checked
      sample-for-sample against an independently-authored recursive reference evaluator
      (`reference-evaluator.ts`) across all 32 rows plus a finite/bounded-output sweep at maximum
      feedback (D-10, D-11); the worklet message boundary is hardened against a hostile-payload
      matrix; `SYNTH_ENGINE` now resolves to `WorkletSynthEngine` everywhere (Playground, lessons)
      with live held-note re-patching on algorithm/feedback changes (D-01, D-13). Automated
      must-haves verified in `08-VERIFICATION.md` (1039+/1050 tests); D-12 listening validation is
      complete (ROADMAP: blocking listening checkpoint approved with zero findings, 2026-08-13).
      Code review flagged 1 critical (non-production-reachable gain-staging gap
      in an unused `additive`/`single` render-mode path) and 2 warnings (routing-config validator
      doesn't enforce the ordering/self-loop invariants `GraphRouter` assumes; a stale README
      status line) — see `08-REVIEW.md`. Disposition: resolved — mode-aware `MASTER_GAIN` in
      `WorkletSynthEngine.setRenderMode`/`buildAndStart`, structural routing validation in
      `parseWorkletMessage`, README status refreshed; owner Phase 8 review reconciliation.
- [x] Six independent per-operator DX7-style four-rate/four-level envelopes drive the DSP
      engine, replacing the global click-prevention voice ramp — Validated in Phase 9:
      dx7-style-envelopes-and-parameter-mapping (2026-08-16). ENGINE-03 complete: a pure,
      per-sample `EnvelopeGenerator` state machine (6 independent instances in `GraphRouter`)
      driven by a new `setGate` worklet message; note-on/note-off jump the envelope from
      wherever its level currently sits (D-04), never a fixed restart; velocity survives the
      voice-gain-node removal via a final output-stage multiplier. A stranded, uncommitted
      patch from an interrupted prior session (plan 09-01, Task 1) was recovered, audited
      against the plan's must-haves/prohibitions, and completed rather than discarded or
      trusted blindly. Ratio/fixed frequency-mode math (built in Phase 8) got explicit
      regression coverage alongside the new envelope hostile-payload matrix, note-lifecycle
      bounds, and modulator-envelope-reachability proof (09-02). The Algorithm 1 lesson now
      demonstrates carrier-sustains/modulator-decays timbral evolution (09-03). A blocking
      real-browser listening checkpoint (09-04) — release click-freeness, attack character,
      modulator audibility, silence at rest, bounded worst-case feedback — was approved with
      a complete auditable payload (`approved check2=3 check5=8 silence=clean
      evolution=audible`), zero findings. 3/3 must-haves verified in `09-VERIFICATION.md`;
      1189/1189 tests passing. Code review flagged 0 critical, 1 warning (a dev-harness-only
      click risk in `harness-main.ts`, never shipped, isolated from production by
      `verify:harness-isolation`) — see `09-REVIEW.md`.
- [x] Off-change-detection oscilloscope/spectrum visualizers plus A/B compare and constrained
      randomization in Playground — Validated in Phase 10: visualizers-and-comparison-tools
      (2026-08-19). VIZ-01/VIZ-02 complete: an `AnalyserNodeLike` tap inserted between the
      worklet engine's master gain and destination drives a Canvas 2D oscilloscope and a
      logarithmic bar spectrum (drawn frequency tick labels, accessible descriptions,
      reduced-motion throttle) on an injected animation-frame loop that writes zero Angular
      signals; a pure bounded random-walk module and a validated, atomic
      `InstrumentState.randomize()` command back a six-control tools panel (Capture A/B,
      Recall A/B, Reset, Randomize) wired directly onto the Phase 3 snapshot facade. 10/10
      must-haves verified in `10-VERIFICATION.md`; 1296/1296 tests passing. Wave 1's first
      executor attempt was interrupted mid-task by a session-quota error (not a defect) and
      recovered by cherry-picking its already-committed work into a fresh worktree; one
      production bug was caught and fixed along the way (`WorkletSynthEngine.buildAndStart`
      could leak audio nodes on a mid-construction throw). A blocking real-browser listening
      and viewing checkpoint (10-04) covering all ten of the phase's perceptual claims was
      approved with zero findings. Code review flagged 0 critical, 2 warnings (a test-fake
      over-strictness in `fake-audio-context.ts`; `randomWalkFixedFrequencyHz` clamps before
      walking for an out-of-range input, not reachable via the shipped UI) — see
      `10-REVIEW.md`. Two tracked debt items: VIZ-01/VIZ-02 are listed in REQUIREMENTS.md's
      body but not yet added to its Traceability table; `10-03-SUMMARY.md` has one
      path-formatting inconsistency in a `key-files` reference (file itself exists and is
      correct on disk).

### Active

- [ ] Full 32-algorithm curriculum (remaining lesson content)
- [ ] Web MIDI progressive enhancement, versioned persistence, import/export
- [ ] Accessibility and performance hardening, Playwright smoke tests, deployment

### Out of Scope

- Bit-accurate DX7/YM21290 emulation — explicitly an educational approximation, not a claim of
  exact hardware fidelity — why: honesty about audio-accuracy compromises is a project mandate
- Copyrighted ROMs, commercial patch banks, manual scans, sampled songs, copied Dexed/Yamaha
  artwork — why: licensing constraint (see CLAUDE.md)
- Polyphony before a deterministic monophonic voice/note-cleanup path exists — why: audio rule,
  avoid compounding complexity on an unproven engine

## Context

- Source architectural guidance: `CLAUDE.md` (binding project instructions),
  `GSD_NEW_PROJECT_PROMPT.md` (product/technical brief), `docs/ARCHITECTURE.md`,
  `docs/ROADMAP_SEED.md`, `docs/ACCEPTANCE_CRITERIA.md` (seed docs, not frozen designs), and the
  "Architecting a Next-Generation Angular 22 Application for DX7 FM Synthesis Education via
  Open-GSD" report.
- GSD Core v1.9.1 is installed locally (`.claude/`), but this coding session ran without live
  `/gsd-*` slash-command execution — those commands are Claude Code native slash commands, not
  invocable as generic tool-calls from this session. This file and its siblings were hand-authored
  from GSD's own templates to preserve the durable-memory contract. Future sessions in a native
  Claude Code terminal can drive `/gsd-plan-phase`, `/gsd-execute-phase`, etc. against this state
  normally.
- FM synthesis math, operator/algorithm structure, and the four algorithm-group taxonomy (Additive
  Stacks 1–6, Tree/Branch 7–18, Rooting 19–25, Parallel 26–32) are documented in the architecture
  report above and were the research input for Phase 2's dataset. As of Phase 2 completion, the
  32-row dataset has been machine-validated, cross-checked against an independently-sourced
  carrier/feedback table, and given a human historical-fidelity review (approved as-is, D-09) —
  see `.planning/phases/02-algorithm-domain/02-DATASET-REVIEW.md`. That 2026-08-04 approval was
  later superseded on 2026-08-05 by Algorithm 26/27 routing corrections, Algorithm 19 being marked
  `unresolved`, and a nested-immutability fix; the review document's Section 5 sign-off is the
  current authority, not the original "no corrections, no unresolved rows" outcome. 14 of the 32
  rows required edge reconciliation (carriers authoritative, edges repaired to match) and remain
  flagged in that document as lower-confidence than the other 18; that nuance should carry into
  any future phase or lesson content that asserts specifics about those rows' exact intermediate
  routing.

## Constraints

- **Tech stack**: Angular 22, standalone components only, zoneless, strict TypeScript/templates,
  Vitest — why: CLAUDE.md mandate
- **Audio**: Browser audio behind DI'd interfaces; never create `AudioContext` at module eval
  time; resume only after a user gesture; no `AudioNode` in Angular signal state — why: audio
  rules in CLAUDE.md, avoids autoplay violations and reactivity leaks
- **Domain purity**: Algorithm/graph/frequency/envelope/patch/DSP logic must stay
  framework-independent of Angular — why: testability and long-term portability
- **Licensing**: No copyrighted patch ROMs, commercial banks, manual scans, or copied diagrams —
  why: legal
- **Testing**: Vitest is mandatory; a bug fix needs a regression test — why: CLAUDE.md mandate

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Skip live GSD `/gsd-*` slash-command execution for this session; hand-author `.planning/` from GSD templates instead | GSD Core's slash commands are Claude Code native commands installed mid-session; not dispatchable as a generic tool call in this runtime | ✓ Good — unblocks Phase 1 without losing the durable-memory contract |
| Implement Phase 1 (Angular scaffold) only in this pass, per `docs/ROADMAP_SEED.md` and the prompt's "Phase 1 acceptance criteria" | User approved a bounded, reviewable first PR | ⚠️ Revisit once reviewed — later phases follow the same roadmap |
| Use Web Audio `OscillatorNode`/`GainNode` graph as an explicitly-labeled MVP approximation, defer the AudioWorklet six-operator engine | Matches CLAUDE.md's "native OscillatorNode modulation is an MVP approximation" rule | — Pending (Phase 1 has no synthesis engine yet; placeholder interface only) |
| Phase 2: carrier sets are authoritative over stated edge lists wherever RESEARCH.md's own table disagreed with itself (14/32 rows); repair the edges, never the carriers, by the minimal edit satisfying the derivation rule | Carrier sets and feedback operators are the HIGH-confidence, triangulated facts per RESEARCH.md's own metadata; exact intermediate edges are MEDIUM-confidence reconstructions | ✓ Good — ledger now 7 `repaired`, 6 `ambiguous`, 1 `unresolved` (Alg 19); Alg 26/27 corrected 2026-08-05; see 02-04-SUMMARY.md |
| Phase 2: a code-review blocker (shallow `Object.freeze` — nested edge objects stayed mutable despite the file's own "frozen, cannot be mutated" comment) was found and fixed after all 5 plans executed, before marking the phase complete | CLAUDE.md requires immutable readonly models and running the full gate before declaring work done; a code-review pass surfaced a real gap the plan-level tests didn't catch | ✓ Good — CR-01 + 3 warnings fixed, 364/364 tests passing, freeze now reaches nested edge objects |
| Phase 4: a direct commit (`c2c51e4`) landed on the phase branch mid-execution, in parallel with the orchestrator's own worktree-isolated Wave 3 agent. It shipped a legitimate accessibility fix (removed `role="img"` from the SVG diagram so the interactive `role="button"` operator nodes stay in the AT tree; added instance-scoped SVG element ids) but also rolled REQUIREMENTS.md/ROADMAP.md/STATE.md back to a stale "only 04-01 done" snapshot, desyncing tracking docs after the automatic wave-merge folded it in | Two GSD-driving sessions edited the same branch concurrently without coordination; the wave-merge step performed a clean textual 3-way merge that was nevertheless semantically wrong for the tracking prose | ✓ Good — code fix kept (verified via full green gates), tracking docs manually reconciled in `b312b7d` before phase verification ran; **process gap to watch**: nothing currently detects an out-of-band commit landing on an in-flight phase branch before a wave-merge silently absorbs it |
| Phase 5: a post-checkpoint code-review fix (WR-01, commit `fd1b018`) lowered `MASTER_GAIN` from the 05-04-listening-approved 0.18 to 1/6 (≈0.63 dB quieter) to close a mathematically-provable safety-clamp gap (0.18 × 6 carriers could exceed full scale) | The change can only make the engine quieter/safer, never louder/riskier, but the exact shipped value was never itself heard in a real browser, and 05-04-PLAN.md's own must-have requires that it be | ✓ Good — re-confirmed via 05-UAT.md Test 1 (real-browser listening, single note + Algorithm 32 six-carrier worst case), both comfortably audible; verification status canonicalized to `passed` |

---
*Last updated: 2026-08-19 after Phase 10 (visualizers-and-comparison-tools) completion*
