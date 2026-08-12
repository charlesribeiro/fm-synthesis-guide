# Phase 7: AudioWorklet DSP foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 7-AudioWorklet DSP foundation
**Areas discussed:** Live-engine cutover scope, Kernel/graph boundary, Correctness proof, Audible checkpoint this phase

---

## Live-engine cutover scope

| Option | Description | Selected |
|--------|-------------|----------|
| Stay isolated (Recommended) | `SYNTH_ENGINE` keeps pointing at `WebAudioSynthEngine`; the worklet ships as a standalone, tested module this phase; the swap waits for a later phase once routing (Phase 8) and envelopes (Phase 9) exist. | ✓ |
| Conditional cutover | Wire a new `SynthEngine` implementation as `SYNTH_ENGINE`, but only route to it for pure-additive algorithms; fall back to the existing engine otherwise. | |
| Full cutover now | Replace `SYNTH_ENGINE` outright this phase. | |

**User's choice:** Stay isolated (Recommended)
**Notes:** Grounded in `synth-engine.token.ts`'s own comment that the DI seam exists for "Phase 7's AudioWorklet six-operator engine" to swap in — but the ROADMAP's Phase 7 success criteria don't mention becoming the live sound, and a full cutover now would break Lesson 6 (Algorithm 1, a modulation stack that this phase's kernel can't route yet).

| Option | Description | Selected |
|--------|-------------|----------|
| Implement SynthEngine now (Recommended) | The worklet engine conforms to the existing `SynthEngine` interface today, even though unwired; unsupported calls no-op or throw clearly. | ✓ |
| Bespoke API for now | A smaller, purpose-built API just for load/play-additive/stop. | |

**User's choice:** Implement SynthEngine now (Recommended)
**Notes:** Proves the interface shape holds today so the eventual cutover is a drop-in provider change rather than a rewrite.

---

## Kernel/graph boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Modulation input built now (Recommended) | Each operator accepts an optional per-sample phase-modulation input (defaults to 0/unconnected); Phase 8 only adds graph traversal/feedback on top. | ✓ |
| Additive-only kernel | Operators are independent phase accumulators with no modulation-input concept this phase. | |

**User's choice:** Modulation input built now (Recommended)
**Notes:** Rated `costly` reversibility — retrofitting the modulation-input port after Phase 8 already depends on the primitive's shape would mean reworking the primitive itself, not just the routing layer around it.

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic fixture (Recommended) | The additive proof uses a hand-built N-operator config, not tied to the canonical dataset. | ✓ |
| Wire real Algorithm 32 | The additive proof case is literally Algorithm 32, read through `deriveCarriers()`/`getOperatorRole()`. | |

**User's choice:** Synthetic fixture (Recommended)
**Notes:** Graph-to-kernel-config translation from the real dataset is explicitly Phase 8's job; keeps this phase's diff scoped to the audio/DSP layer.

---

## Correctness proof

| Option | Description | Selected |
|--------|-------------|----------|
| Analytical match (Recommended) | A single sine operator's rendered block is asserted against the closed-form `sin(2πft)` reference within tolerance; the additive case asserts summed output equals the per-operator sum. | ✓ |
| Non-finite/sanity floor only | Tests assert finite output, expected block length, and coarse signal presence only. | |

**User's choice:** Analytical match (Recommended)
**Notes:** `docs/ACCEPTANCE_CRITERIA.md`'s stated floor ("reject non-finite output") is treated as a minimum, not the whole bar — this is what actually proves the DSP math is right rather than just non-crashing. Exact tolerance/sample-rate/block-size values left to Claude's Discretion.

---

## Audible checkpoint this phase

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal dev harness (Recommended) | A small, non-shipped page or script loads the worklet in a real browser and lets a human trigger the additive/single-operator cases by ear. | ✓ |
| Automated tests only | No human-listening step this phase; first audible check deferred to whichever phase wires the engine into the live app. | |

**User's choice:** Minimal dev harness (Recommended)
**Notes:** Cheap insurance that "the worklet loads and runs" is true in a real `AudioWorkletGlobalScope`, not just inferred from unit tests of the pure kernel module (jsdom has no Web Audio API at all — `05-RESEARCH.md` Pitfall 6 — so the pure-kernel Vitest suite can't prove worklet *loading* itself).

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking checkpoint (Recommended) | A plan task pauses for the user to actually listen before the phase is marked complete. | ✓ |
| Dev convenience only | The harness exists for poking around, but nothing in the plan blocks on using it. | |

**User's choice:** Blocking checkpoint (Recommended)
**Notes:** Mirrors the precedent set in Phase 5 (05-04 listening checkpoint) and Phase 6 (06-04 blocking verification) — catches anything analytical tests can't (audible artifacts, clicks, wrong timbre) before this kernel is trusted as the foundation for Phase 8/9.

---

## Claude's Discretion

- Exact numeric tolerance, sample rate, and block-size assumptions for the analytical-match tests.
- Exact file/module layout for the pure DSP kernel and the thin `AudioWorkletProcessor` adapter around it, and how Angular 22's esbuild-based builder emits the worklet as a loadable module.
- `Math.sin` vs. a sine lookup table for the phase-modulation math (left open by `GSD_NEW_PROJECT_PROMPT.md`).
- Exact shape/location of the dev harness and how its DI/fake-boundary seam mirrors `audio-context.token.ts`'s pattern.
- Exact operator-primitive API signature (class vs. closure vs. plain function; how the modulation input is passed in).
- Concrete behavior of `SynthEngine` methods not yet meaningful this phase (`setAlgorithm` beyond the fixture, `setFeedback`, etc.) — no-op, throw, or documented partial implementation.
- Whether to expose worklet-loading-failure as an `AudioEngineStatus`-shaped state now or defer that wiring to the live-cutover phase.

## Deferred Ideas

None — discussion stayed within phase scope. Full 32-algorithm graph routing/feedback (Phase 8, ENGINE-02) and DX7-style envelopes (Phase 9, ENGINE-03) were named as explicitly out of scope and are recorded in CONTEXT.md's Phase Boundary, not as new deferred ideas.
