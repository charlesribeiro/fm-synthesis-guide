# Phase 9: DX7-style envelopes and parameter mapping - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-14
**Phase:** 9-DX7-style envelopes and parameter mapping
**Areas discussed:** Envelope generator placement, Retrigger / rate semantics, Envelope UI scope, Default envelope character

---

## Envelope generator placement

| Option | Description | Selected |
|--------|-------------|----------|
| Per-operator, kernel-integrated | Each of the 6 operators gets its own independent EG inside the DSP kernel, scaling that operator's output before it feeds modulation/carrier summing. DX7-authentic; lets modulators/carriers evolve differently over time. | ✓ |
| Single voice-level envelope | One EG per note, applied to the final routed output. Simpler, but every operator swells/decays identically. | |
| Hybrid | Per-operator EGs for level shaping, plus the existing voice-level click-prevention ramp layered on top. | |

**User's choice:** Per-operator, kernel-integrated (Recommended)

---

## Click safety (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Fully replace it | Per-operator EGs become the sole amplitude-shaping mechanism; their own attack/release segments provide click-safety directly. | ✓ |
| Keep as a defense-in-depth safety net | Per-operator EGs drive the real shape, but the outer voiceGain ramp stays as a cheap fallback guard. | |

**User's choice:** Fully replace it (Recommended)

---

## Lesson 6 regression check (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add a Lesson 6 regression check | Mirrors Phase 8 D-03 precedent — re-verify Lesson 6's try-this flow against the new EG-driven engine. | ✓ |
| No, general engine test coverage is enough | The 32-algorithm correctness suite plus new envelope tests already cover this. | |

**User's choice:** Yes, add a Lesson 6 regression check (Recommended)

---

## Retrigger / rate semantics

| Option | Description | Selected |
|--------|-------------|----------|
| DX7-authentic: move from current level | A rate is speed-toward-target-from-current-level, not a fixed segment duration. No pop/discontinuity on retrigger. | ✓ |
| Simplified: restart from fixed starting point | Each segment transition resets to a canonical starting level before ramping. Easier to reason about, but can click on fast retriggers. | |

**User's choice:** DX7-authentic: move from current level (Recommended)

---

## Envelope UI scope

| Option | Description | Selected |
|--------|-------------|----------|
| DSP/data-model only, no new UI | Matches ROADMAP's DSP-only success criteria and Playground's "Coming in later phases" placeholder. Values exercised via InstrumentState/lesson data/tests. | ✓ |
| Add minimal envelope UI this phase | Build operator-strip controls for the 4 rate/4 level values now. Expands scope beyond ROADMAP's stated success criteria. | |

**User's choice:** DSP/data-model only, no new UI (Recommended)

---

## Default envelope character

| Option | Description | Selected |
|--------|-------------|----------|
| Differentiated, pedagogically obvious | Carriers sustain, modulators decay faster by default, so timbral evolution is audible immediately. | ✓ |
| Near-flat, minimal perceptible change | Fast attack, held flat sustain, quick release on every operator — mimics today's ramp feel. | |

**User's choice:** Differentiated, pedagogically obvious (Recommended)
**Notes:** This raised a direct tension with Phase 3's D-09 (uniform, role-agnostic default patch) — see follow-up below.

---

## Default shape (sub-question — D-09 conflict resolution)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep one uniform default, differentiate via lesson patches | `DEFAULT_OPERATOR_PARAMETERS` stays one identical envelope shape (Phase 3 D-09 honored). Differentiation happens in Playground's initial/reset patch and each lesson's starting patch instead. | ✓ |
| Make the uniform default role-aware | Revisit D-09: derive default envelope from operator role (carrier/modulator) for the currently selected algorithm. | |

**User's choice:** Keep one uniform default, differentiate via lesson patches (Recommended)
**Notes:** Resolved without reopening Phase 3's D-09 — carrier/modulator role is derived per-algorithm and isn't available to the flat default-patch object.

---

## Claude's Discretion

- Exact TypeScript shape of the widened envelope field (rate/level pair naming/nesting).
- Exact rate (0-99) → time curve mapping.
- Whether envelope state lives inside `PhaseModulatedOperator` or a companion class.
- Per-block vs. per-sample envelope update granularity.
- Numeric tolerance for envelope segment-transition and rate-curve tests.
- Exact new default rate/level values for Playground's initial patch and each lesson's starting patch.
- Whether ratio/fixed-frequency regression coverage extends Phase 8's existing suite or is a new dedicated test file.

## Deferred Ideas

None — discussion stayed within phase scope. A Playground/operator-editor UI for the new envelope
values and role-aware default-patch differentiation were both raised and explicitly resolved as
out of scope this phase (see Envelope UI scope and Default shape above), not deferred as new ideas.
