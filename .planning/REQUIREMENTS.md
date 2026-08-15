# Requirements: DX7 Algorithm Lab

**Defined:** 2026-08-04
**Core Value:** A learner can see a six-operator algorithm's routing diagram, hear the sound it
produces, change a parameter, and immediately understand why the sound changed.

## v1 Requirements

Requirements for the first usable milestone (roadmap Phases 1–6, `docs/ROADMAP_SEED.md`
Milestone 1). Each maps to a roadmap phase.

### Foundation

- [x] **FOUND-01**: App builds and runs as an Angular 22 standalone, zoneless application with
      strict TypeScript/template checking

- [x] **FOUND-02**: Vitest suite runs headlessly and passes
- [x] **FOUND-03**: User can navigate lazy-loaded Learn, Algorithms, Playground, and About routes
- [x] **FOUND-04**: Layout uses SCSS design tokens (CSS custom properties) and is responsive
- [x] **FOUND-05**: Baseline accessibility — semantic HTML, labelled controls, visible focus,
      reduced-motion support — is present in the shell

- [x] **FOUND-06**: README documents setup, verification commands, architecture summary, and the
      unofficial/educational disclaimer

### Algorithm Domain

- [x] **DOMAIN-01**: All 32 DX7 algorithms are represented as one canonical, immutable, validated
      dataset (no duplicated routing knowledge)

- [x] **DOMAIN-02**: Dataset validation rejects invalid edges, impossible IDs, duplicate algorithm
      IDs, malformed feedback declarations, and algorithms whose `deriveCarriers()` result is empty
      (zero derived carriers — a zero-output routing graph). Role derivation is total over all six
      operators by construction, so Algorithm 32's edge-free shape remains valid; the invariant
      rejects only graphs where every operator modulates another and nothing reaches output

- [x] **DOMAIN-03**: Carrier/modulator roles are derivable from graph structure, not hardcoded per
      algorithm

- [x] **DOMAIN-04**: Domain/graph/frequency logic has no Angular dependency and is independently
      unit-tested

### Instrument State

- [x] **STATE-01**: A signal-based facade exposes read-only selectors over selected algorithm,
      operator parameters, and feedback level

- [x] **STATE-02**: Operator parameter updates are immutable and do not mutate prior snapshots
- [x] **STATE-03**: A/B snapshot and reset restore a known deterministic state

### Algorithm Visualization

- [x] **VIS-01**: User can browse all 32 algorithms and open an algorithm detail view
- [x] **VIS-02**: The routing diagram is SVG, data-driven from the same dataset used by the synth
      engine, and accessible (title/description, not color-only carrier/modulator distinction)

- [x] **VIS-03**: The feedback loop is visually explicit in the diagram

### Playable Audio (MVP approximation)

- [x] **AUDIO-01**: Audio never starts before an explicit user gesture; a suspended/unavailable
      state is shown

- [x] **AUDIO-02**: User can play and release a note from an on-screen/computer keyboard with a
      monophonic educational engine, with no stuck voices after note-off or algorithm switch

- [x] **AUDIO-03**: The MVP engine is clearly labeled as a teaching approximation, not a
      bit-accurate DX7 emulation

### Guided Learning

- [x] **LESSON-01**: A guided lesson teaches Algorithm 32 as pure additive synthesis
- [x] **LESSON-02**: A guided lesson teaches Algorithm 1 as a modulation stack plus tower, ending
      in the first end-to-end vertical slice (browse → hear → adjust → understand)

## v2 Requirements

Deferred to future milestones (`docs/ROADMAP_SEED.md` Milestones 2–3). Tracked but not in the
current roadmap.

### Accurate Synthesis Engine

- [x] **ENGINE-01**: Six-operator AudioWorklet phase-modulation DSP kernel, testable offline
- [x] **ENGINE-02**: All 32 graph topologies routed in the DSP engine, with feedback state
- **ENGINE-03**: DX7-style four-rate/four-level envelopes and ratio/fixed frequency modes

### Visualizers and Comparison

- **VIZ-01**: Oscilloscope and labelled spectrum display, off the Angular change-detection path
- **VIZ-02**: A/B comparison and constrained randomization in Playground mode

### Full Curriculum and Platform

- **CURR-01**: Every algorithm has a concise lesson, experiment, and original preset
- **PERSIST-01**: Versioned local persistence with JSON import/export and malformed-data recovery
- **MIDI-01**: Progressive Web MIDI note on/off, velocity, device connect/disconnect
- **HARDEN-01**: Keyboard-only and screen-reader audit, reduced motion, mobile/tablet refinement
- **RELEASE-01**: Playwright smoke suite, CI, static hosting deployment, documentation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bit-accurate DX7/YM21290 emulation | Educational approximation is the explicit project stance (CLAUDE.md) |
| Copyrighted ROMs, commercial patch banks, manual scans, copied Dexed/Yamaha artwork | Licensing constraint |
| Polyphony in the first playable engine | Must prove monophonic note lifecycle/cleanup first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 1 | Complete |
| DOMAIN-01 | Phase 2 | Complete |
| DOMAIN-02 | Phase 2 | Complete |
| DOMAIN-03 | Phase 2 | Complete |
| DOMAIN-04 | Phase 2 | Complete |
| STATE-01 | Phase 3 | Complete |
| STATE-02 | Phase 3 | Complete |
| STATE-03 | Phase 3 | Complete |
| VIS-01 | Phase 4 | Complete |
| VIS-02 | Phase 4 | Complete |
| VIS-03 | Phase 4 | Complete |
| AUDIO-01 | Phase 5 | Complete |
| AUDIO-02 | Phase 5 | Complete |
| AUDIO-03 | Phase 5 | Complete |
| LESSON-01 | Phase 6 | Complete |
| LESSON-02 | Phase 6 | Complete |
| ENGINE-01 | Phase 7 | Complete |
| ENGINE-02 | Phase 8 | Complete |

**Coverage:**

- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓
- v2 requirements mapped so far: 2 (ENGINE-01 → Phase 7, ENGINE-02 → Phase 8)

---
*Requirements defined: 2026-08-04*
*Last updated: 2026-08-14 — Phase 7 plans 07-01..07-04 all executed; 07-04 closed the
production-asset harness leak 07-VERIFICATION.md found (relocated the harness build output
outside public/, added a fail-closed postbuild assertion and an on-demand realistic-sequence
regression gate). ENGINE-01 is now Complete and Phase 7 is fully closed. Phase 8 /
ENGINE-02 is fully closed (all four plans executed; live cutover to WorkletSynthEngine;
15/15 must-haves verified).*
