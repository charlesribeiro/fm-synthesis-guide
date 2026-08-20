# Roadmap: DX7 Algorithm Lab

## Overview

The app grows from a bare Angular 22 shell to a fully playable, accessible six-operator FM
learning instrument in three milestones: (1) foundation, algorithm domain data, instrument state,
visualization, an approximate playable engine, and the first two guided lessons; (2) the accurate
AudioWorklet six-operator engine with full routing, feedback, envelopes, and visualizers; (3) the
complete 32-algorithm curriculum, MIDI/persistence, and accessibility/performance/release
hardening. Adapted from `docs/ROADMAP_SEED.md`.

## Phases

- [x] **Phase 1: Angular 22 foundation** - Scaffold, shell, lazy routes, design tokens, quality gates
- [x] **Phase 2: Algorithm domain** - Canonical validated 32-algorithm dataset, graph derivation (completed 2026-08-04; dataset review superseded 2026-08-05 — see 02-DATASET-REVIEW.md)
- [x] **Phase 3: Signal instrument state** - Patch/operator signal facade, A/B snapshots, reset (completed 2026-08-05)
- [x] **Phase 4: Algorithm browser and SVG** - 32-item browser, data-driven accessible diagram (completed 2026-08-06)
- [x] **Phase 5: First playable approximation** - Injected audio boundary, monophonic MVP engine (all 4 plans executed, UAT passed, security review clean) (completed 2026-08-07)
- [x] **Phase 6: Guided lessons for Algorithm 32 and Algorithm 1** - First end-to-end vertical slice
- [x] **Phase 7: AudioWorklet DSP foundation** - Pure six-operator DSP kernel, worklet loading (all 4 plans executed, including 07-04 gap closure; completed 2026-08-12)
- [x] **Phase 8: Algorithm routing and feedback** - All topologies in DSP, bounded/stable output (all 4 plans executed, blocking listening checkpoint approved with zero findings; completed 2026-08-13)
- [x] **Phase 9: DX7-style envelopes and parameter mapping** - Envelope model, ratio/fixed modes (completed 2026-08-16)
- [x] **Phase 10: Visualizers and comparison tools** - Oscilloscope, spectrum, A/B, randomization (completed 2026-08-19)
- [ ] **Phase 11: Curriculum across all 32 algorithms** - Lesson/experiment/preset per algorithm
- [ ] **Phase 12: MIDI and patch persistence** - Web MIDI, versioned storage, import/export
- [ ] **Phase 13: Accessibility and performance hardening** - Keyboard/screen-reader/mobile audit
- [ ] **Phase 14: Browser tests and release** - Playwright smoke suite, CI, deployment, docs

## Phase Details

### Phase 1: Angular 22 foundation

**Goal**: A runnable, strict, zoneless Angular 22 shell with lazy feature routes, design tokens,
an a11y baseline, and passing quality gates — no synthesis engine yet beyond a typed placeholder.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06
**Success Criteria** (what must be TRUE):

  1. `npm run build`, `npm test`, and `npm run lint` all pass
  2. User can navigate to Learn, Algorithms, Playground, and About via lazy-loaded routes
  3. The shell layout is responsive and uses SCSS design tokens, not hardcoded values
  4. Keyboard navigation and visible focus work across the shell; reduced motion is respected
  5. README documents setup, verification commands, architecture summary, and the disclaimer

**Plans**: 1 plan (single vertical scaffold pass)

Plans:

- [x] 01-01: Angular 22 scaffold, shell, lazy routes, design tokens, a11y baseline, README

### Phase 2: Algorithm domain

**Goal**: One canonical, validated 32-algorithm dataset independent of Angular.
**Depends on**: Phase 1
**Requirements**: DOMAIN-01, DOMAIN-02, DOMAIN-03, DOMAIN-04
**Success Criteria** (what must be TRUE):

  1. All 32 algorithms pass schema/invariant validation tests
  2. Carrier/modulator derivation matches graph structure for fixture algorithms
  3. Domain code has zero Angular imports

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Tracer: Algorithms 1 and 32 end-to-end through type, dataset, validation, derivation
- [x] 02-02-PLAN.md — DOMAIN-04 domain-purity lint gate, proven by negative control

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-03-PLAN.md — Complete DOMAIN-02 rejection surface and DOMAIN-03 derivation surface

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-04-PLAN.md — All 32 rows entered with provenance, plus the cross-check invariant suite

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-05-PLAN.md — Historical-fidelity review dossier and human sign-off (D-09)

### Phase 3: Signal instrument state

**Goal**: Signal-based facade over patch/operator state with immutable updates.
**Depends on**: Phase 2
**Requirements**: STATE-01, STATE-02, STATE-03
**Success Criteria** (what must be TRUE):

  1. Selecting an algorithm updates all computed selectors synchronously
  2. Immutable operator updates never mutate prior snapshots
  3. A/B snapshot and reset restore exact, deterministic state

**Plans**: 2/2 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Tracer: operator/patch model, immutable command path, and the core read-only selector surface (STATE-01, STATE-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Two named A/B snapshot slots and reset-to-default, with isolation regression tests (STATE-03)

### Phase 4: Algorithm browser and SVG

**Goal**: Users can browse all 32 algorithms and see an accessible, data-driven routing diagram.
**Depends on**: Phase 3
**Requirements**: VIS-01, VIS-02, VIS-03
**Success Criteria** (what must be TRUE):

  1. Algorithm selector renders all 32 options and an algorithm detail route
  2. SVG graph renders expected operator/edge counts from fixture data
  3. Carrier/modulator semantics and the feedback loop are exposed accessibly, not color-only

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Tracer: /algorithms/1 end-to-end through layout data, view model, accessible
      SVG component and the validated detail route (VIS-01, VIS-02, VIS-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — All 32 hand-authored layout records plus the grid, signal-flow and clearance
      invariants (VIS-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — Grouped 32-item browse view derived from teachingTags, with an in-app
      round-trip test into the detail route (VIS-01)

- [x] 04-04-PLAN.md — Previous/next stepping with correct ends, plus the full rejected-address
      matrix and the not-found state (VIS-01)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-05-PLAN.md — Rendered accessibility/encoding sweep across all 32, then the blocking human
      legibility, keyboard and screen-reader verification (VIS-01, VIS-02, VIS-03)

### Phase 5: First playable approximation

**Goal**: A monophonic, injected-boundary audio engine the user can actually play.
**Depends on**: Phase 4
**Requirements**: AUDIO-01, AUDIO-02, AUDIO-03
**Success Criteria** (what must be TRUE):

  1. Audio never starts before a user gesture; suspended/unavailable states render correctly
  2. User can play/release a note with no stuck voices after note-off or algorithm switch
  3. UI clearly labels the engine as an educational approximation

**Plans**: 4/4 plans executed — phase gate closed (05-UAT.md Test 1 passed; 05-VERIFICATION.md
`passed`, 9/9 must-haves; security review clean)

Plans:

**Wave 1**

- [x] 05-01-PLAN.md — Tracer: gesture-gated AudioContext behind a DI seam, persistent
      six-oscillator graph, and one playable key end-to-end in Playground, plus the engine
      lifecycle and monophonic note-lifecycle invariants (AUDIO-01, AUDIO-02, AUDIO-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — Generic 32-algorithm patcher from canonical edge data, feedback through a
      DelayNode, full DX7-scale conversions, and D-02 live re-patch of a held note (AUDIO-02)

- [x] 05-03-PLAN.md — Full one-octave play surface: 12 on-screen keys, computer-keyboard mapping,
      every note-ending path, and the UI-contract styling and accessibility (AUDIO-01, AUDIO-02,
      AUDIO-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-04-PLAN.md — Blocking listening checkpoint for loudness safety, click-free ramps and the
      narrow-viewport backstop, then applied tuning and the phase gate (AUDIO-01, AUDIO-02,
      AUDIO-03)

### Phase 6: Guided lessons for Algorithm 32 and Algorithm 1

**Goal**: First end-to-end guided learning vertical slice.
**Depends on**: Phase 5
**Requirements**: LESSON-01, LESSON-02
**Success Criteria** (what must be TRUE):

  1. A learner can complete the Algorithm 32 additive-synthesis lesson
  2. A learner can complete the Algorithm 1 modulation-stack lesson
  3. Each lesson has an objective, explanation, try-this action, and completion check

**Plans**: 4/4 plans executed

Plans:

**Wave 1**

- [x] 06-01-PLAN.md — Tracer: `/learn/algorithm-32` end-to-end through the lesson domain model,
      the extracted shared play surface, the `LessonProgress` facade and the validated
      `/learn/:lessonId` route (LESSON-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02-PLAN.md — The Algorithm 1 lesson as one data row, plus the `LESSONS` dataset
      invariants and the rejected-address matrix (LESSON-02)

- [x] 06-03-PLAN.md — `/learn` rebuilt as a data-driven lesson index with per-card completion
      state and the index-to-detail round trip (LESSON-01, LESSON-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-04-PLAN.md — Blocking human verification for extraction parity by ear, completion-check
      timing, keyboard-only completion and colour independence, then applied tuning and the phase
      validation record (LESSON-01, LESSON-02)

### Phase 7: AudioWorklet DSP foundation

**Goal**: Pure, offline-testable six-operator phase-modulation DSP kernel running in a worklet.
**Depends on**: Phase 6
**Requirements**: ENGINE-01
**Success Criteria** (what must be TRUE):

  1. Worklet loads and runs a single operator and an additive multi-operator case correctly
  2. DSP kernel is tested with deterministic sample blocks outside the browser

**Plans**: 4/4 plans executed

Plans:

**Wave 1**

- [x] 07-01-PLAN.md — Tracer: the pure phase-modulation kernel, the `AudioWorkletProcessor`
      adapter, the esbuild bundle step and a validated worklet message contract, proven end to
      end in Node against the analytical `sin(2*pi*f*t)` reference and the built bundle itself
      (ENGINE-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-02-PLAN.md — The DI-wrapped `AudioWorkletNode` boundary with hand-rolled fakes, and
      `WorkletSynthEngine` implementing the existing `SynthEngine` interface while `SYNTH_ENGINE`
      stays pointed at the Phase 5 engine (ENGINE-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-03-PLAN.md — The opt-in, non-shipping dev listening harness and the blocking human
      verification that the worklet loads and both proof cases sound correct in a real browser
      (ENGINE-01)

**Wave 4** *(gap closure — from 07-VERIFICATION.md, 15/16 must-haves verified)*

- [x] 07-04-PLAN.md — Close the one failing must-have: move the dev harness build output out of the
      production asset root, give it a named dev-only serve configuration so it keeps its URL, and
      add an automated gate that runs the realistic harness-then-build sequence the verifier
      reproduced as a production leak (ENGINE-01)

### Phase 8: Algorithm routing and feedback

**Goal**: All 32 graph topologies run in the DSP engine with stable feedback.
**Depends on**: Phase 7
**Requirements**: ENGINE-02
**Success Criteria** (what must be TRUE):

  1. Every algorithm's topology routes correctly in the DSP engine
  2. Output stays bounded and finite under feedback at maximum
  3. Switching algorithms never leaves a stuck note

**Plans**: 4/4 plans executed

Plans:

**Wave 1**

- [x] 08-01-PLAN.md — Tracer: Algorithm 1 routed end to end through the feedback-capable kernel,
      the new `GraphRouter`, three worklet messages, the routed processor and the
      `InstrumentState`-reactive engine, plus the D-01 `SYNTH_ENGINE` cutover; then the two kernel
      invariants the correctness proof rests on (Algorithm 15's combined feedback-and-modulation
      operator, and feedback-history hygiene across a routing change) (ENGINE-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02-PLAN.md — The independently-authored recursive reference evaluator and the 32-row
      cross-check (D-10) plus the bounded-and-finite sweep at maximum feedback for every row
      (D-11) (ENGINE-02)

- [x] 08-03-PLAN.md — Hostile-payload matrix for the three new message kinds, built-bundle parity
      against the kernel, and the held-note live re-patch plus real pitch/level propagation over
      the fake node boundary (D-13, D-15, D-16) (ENGINE-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08-04-PLAN.md — Dev-harness algorithm-select and feedback-depth controls, then the blocking
      human listening checkpoint across all four taxonomy groups plus maximum feedback and the
      Lesson 6 regression (D-02, D-03, D-12), and the phase validation record (ENGINE-02)

### Phase 9: DX7-style envelopes and parameter mapping

**Goal**: Four-rate/four-level envelopes and ratio/fixed frequency modes drive the DSP engine.
**Depends on**: Phase 8
**Requirements**: ENGINE-03
**Success Criteria** (what must be TRUE):

  1. Envelope segment transitions match the modeled rate/level state machine
  2. Ratio and fixed-frequency operator modes both produce correct frequencies
  3. Note release and parameter smoothing never produce audible clicks or NaN output

**Plans**: 4/4 plans executed

Plans:

**Wave 1**

- [x] 09-01-PLAN.md — Tracer: `Dx7Envelope` widening, the pure per-operator `EnvelopeGenerator`,
      the rate curve, the new `setGate` worklet message, routed per-sample envelope application,
      and the removal of the global voice ramp — one note enveloped end to end (ENGINE-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02-PLAN.md — Hostile-payload matrix for the gate and envelope shapes, the full
      note-lifecycle bounded/finite sweep, modulator-envelope reachability, silence at rest,
      velocity survival, and the ratio/fixed-frequency regression (ENGINE-03)

- [x] 09-03-PLAN.md — Carrier-sustains / modulator-decays envelopes in the Algorithm 1 lesson,
      shipped-envelope invariants, and the documentation truth-up (ENGINE-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-04-PLAN.md — Dev-harness gate wiring and envelope presets, the blocking listening
      checkpoint for click safety, silence at rest and audible timbral evolution, then the phase
      validation record (ENGINE-03)

### Phase 10: Visualizers and comparison tools

**Goal**: Oscilloscope, spectrum, and A/B/randomization tools in Playground mode.
**Depends on**: Phase 9
**Requirements**: VIZ-01, VIZ-02
**Success Criteria** (what must be TRUE):

  1. Oscilloscope and labelled spectrum respond to the live sound without driving Angular change
     detection per animation frame

  2. A/B snapshot compare and constrained randomization work in Playground

**Plans**: 4/4 plans executed

Plans:

**Wave 1**

- [x] 10-01-PLAN.md — Tracer: `AnalyserNodeLike` boundary widening, the analyser inserted between
      the worklet engine's master gain and the destination, the `AnalysisTap` read methods, the
      injected animation-frame and Canvas-2D seams, and a Canvas 2D oscilloscope embedded in
      Playground — one waveform end to end (VIZ-01)

- [x] 10-03-PLAN.md — The pure bounded random-walk module over an instrument patch and the
      validated, atomic `InstrumentState.randomize()` command (VIZ-02)

**Wave 2** *(blocked on 10-01)*

- [x] 10-02-PLAN.md — The pure logarithmic band map, bar rendering with drawn frequency tick
      labels, the second canvas wired into the visualizer, accessible descriptions for both
      lanes, and the reduced-motion repaint rate (VIZ-01)

**Wave 3** *(blocked on 10-02 and 10-03)*

- [x] 10-04-PLAN.md — The six-control tools panel over the Phase 3 A/B facade plus Randomize,
      the Playground integration, and the blocking real-browser listening and viewing
      checkpoint for the whole phase (VIZ-02)

### Phase 11: Curriculum across all 32 algorithms

**Goal**: Every algorithm has a lesson, experiment, and original preset; progress is tracked.
**Depends on**: Phase 10
**Requirements**: CURR-01
**Success Criteria** (what must be TRUE):

  1. All 32 algorithms have a concise lesson grouped by recurring structure, not rote memorization
  2. Lesson completion/progress is tracked per algorithm

**Plans**: TBD

### Phase 12: MIDI and patch persistence

**Goal**: Progressive Web MIDI input and versioned, importable/exportable persistence.
**Depends on**: Phase 11
**Requirements**: PERSIST-01, MIDI-01
**Success Criteria** (what must be TRUE):

  1. MIDI note on/off/velocity works when a device is present; app is fully usable without MIDI
  2. Settings/progress/patches persist across reload with a versioned schema
  3. Malformed persisted or imported data is recovered from without crashing

**Plans**: TBD

### Phase 13: Accessibility and performance hardening

**Goal**: Keyboard-only, screen-reader, reduced-motion, and mobile/tablet parity, plus profiling.
**Depends on**: Phase 12
**Requirements**: HARDEN-01
**Success Criteria** (what must be TRUE):

  1. A full lesson can be completed keyboard-only with correct screen-reader announcements
  2. Reduced motion is honored throughout; mobile/tablet layout remains usable
  3. Profiling shows no leaked animation frames, audio nodes, or timers

**Plans**: TBD

### Phase 14: Browser tests and release

**Goal**: Playwright smoke coverage, CI, deployment, and documentation for release.
**Depends on**: Phase 13
**Requirements**: RELEASE-01
**Success Criteria** (what must be TRUE):

  1. Playwright covers audio enable, note lifecycle, and algorithm switching without errors
  2. CI runs build/test/lint/Playwright on every change
  3. App is deployed to static hosting with architecture/methodology docs published

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Angular 22 foundation | 1/1 | Complete | 2026-08-04 |
| 2. Algorithm domain | 5/5 | Complete    | 2026-08-04 (dataset review updated 2026-08-05) |
| 3. Signal instrument state | 2/2 | Complete    | 2026-08-05 |
| 4. Algorithm browser and SVG | 5/5 | Complete    | 2026-08-06 |
| 5. First playable approximation | 4/4 | Complete    | 2026-08-07 |
| 6. Guided lessons (Alg 32 & 1) | 4/4 | Complete    | 2026-08-10 |
| 7. AudioWorklet DSP foundation | 4/4 | Complete    | 2026-08-12 |
| 8. Algorithm routing and feedback | 4/4 | Complete    | 2026-08-13 |
| 9. Envelopes and parameter mapping | 4/4 | Complete    | 2026-08-16 |
| 10. Visualizers and comparison tools | 4/4 | Complete    | 2026-08-19 |
| 11. Curriculum (all 32 algorithms) | 0/TBD | Not started | - |
| 12. MIDI and patch persistence | 0/TBD | Not started | - |
| 13. Accessibility and performance | 0/TBD | Not started | - |
| 14. Browser tests and release | 0/TBD | Not started | - |
