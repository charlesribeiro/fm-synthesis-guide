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

(None yet — ship to validate)

### Active

- [ ] Angular 22 scaffold: standalone, zoneless, strict, Vitest, lazy-loaded feature shell
- [ ] Canonical, validated 32-algorithm domain dataset independent of Angular
- [ ] Signal-based instrument state facade with immutable updates and read-only selectors
- [ ] Data-driven, accessible SVG algorithm diagrams
- [ ] Monophonic educational audio engine behind an injected browser-audio boundary
- [ ] Guided lessons starting with Algorithm 32 (pure additive) and Algorithm 1 (stack + tower)
- [ ] AudioWorklet six-operator phase-modulation engine (accuracy target, not MVP-blocking)
- [ ] Full 32-algorithm curriculum, envelopes, feedback, visualizers, A/B snapshots
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
  report above and should be treated as research input for Phase 2's dataset, not yet
  independently re-verified against primary DX7 documentation.

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

---
*Last updated: 2026-08-04 after initial project setup (hand-authored, pre-Phase-1)*
