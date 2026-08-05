# Phase 3: Signal instrument state - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-05 (updated same day — default patch numbers session)
**Phase:** 3-Signal instrument state
**Areas discussed:** Algorithm-switch carryover, A/B & reset semantics, Operator parameter shape, Default patch feel, Default patch numeric values

---

## Algorithm-switch carryover

**Q1: When the user switches the selected algorithm mid-session, what happens to the six operators' parameter values?**

| Option | Description | Selected |
|--------|-------------|----------|
| Carry over unchanged | DX7-authentic; switching only rewires carrier/modulator roles, never touches per-operator settings | ✓ |
| Reset all operators to defaults on every switch | Clean starting patch per switch, but loses user's tweaks instantly | |
| Reset only operators whose role changed | Hybrid; closer to "sensible defaults" but adds real complexity | |

**User's choice:** Carry over unchanged (recommended)

**Q2: Does the numeric feedback level itself carry over across an algorithm switch?**

| Option | Description | Selected |
|--------|-------------|----------|
| Carry over unchanged | Consistent with operator-parameter carryover | ✓ |
| Reset feedback level to 0 on every switch | Avoids an unexpectedly loud amount landing on a different operator | |

**User's choice:** Carry over unchanged (recommended)

---

## A/B & reset semantics

**Q1: What are A and B, structurally?**

| Option | Description | Selected |
|--------|-------------|----------|
| Two named full-patch slots | Independent, explicitly-captured snapshots of the entire patch | ✓ |
| A is always "current", B is the one alternate slot | Simpler, but can't compare two saved variations independently | |
| Unbounded snapshot stack (undo-history style) | More flexible, but scope growth beyond ROADMAP's literal "A/B" wording | |

**User's choice:** Two named full-patch slots (recommended)

**Q2: Is "reset" a third, separate action, or relative to A/B?**

| Option | Description | Selected |
|--------|-------------|----------|
| Reset = restore fixed default patch | A third, independent action; A/B stay untouched by reset | ✓ |
| Reset = restore slot A | Treats A as the implicit baseline; no separate default-patch concept | |

**User's choice:** Reset = restore fixed default patch (recommended)

---

## Operator parameter shape

**Q1: What should Phase 3's OperatorParameters model right now, given envelopes are Phase 9's job?**

| Option | Description | Selected |
|--------|-------------|----------|
| Full future shape, envelope as opaque placeholder | Whole eventual shape now; avoids a breaking interface change later | ✓ |
| Minimal MVP subset only | Smaller surface now, but Phase 9 will need to widen the shape later | |

**User's choice:** Full future shape, envelope as opaque placeholder (recommended)

**Q2: What should the Phase 9 envelope placeholder look like concretely?**

| Option | Description | Selected |
|--------|-------------|----------|
| A single sustain-level number | Gives Phase 5's MVP engine one real knob without inventing the full ADSR-style shape | ✓ |
| An empty/opaque marker type | Signals "this exists structurally" but gives Phase 5 nothing usable yet | |

**User's choice:** A single sustain-level number (recommended)

---

## Default patch feel

**Q1: On first load / reset, silent/neutral baseline or a pleasant audible demo starting point?**

| Option | Description | Selected |
|--------|-------------|----------|
| Audible demo starting point | Playground makes sound immediately once Phase 5 lands; matches core value | ✓ |
| Silent/neutral baseline | All levels near zero, ratio 1.0; risks a bad first-run impression | |

**User's choice:** Audible demo starting point (recommended)

**Q2: One uniform default formula for all 32 algorithms, or a bespoke hand-tuned default per algorithm?**

| Option | Description | Selected |
|--------|-------------|----------|
| One uniform formula for all 32 algorithms | Simple, deterministic; keeps scope to state/logic only | ✓ |
| Bespoke default per algorithm | Better per-algorithm first listen, but duplicates CURR-01 (Phase 11) content work | |

**User's choice:** One uniform formula for all 32 algorithms (recommended)

---

## Default patch numeric values

**Q1: What numeric scale should OperatorParameters use internally (outputLevel, ratio, detune)?**

| Option | Description | Selected |
|--------|-------------|----------|
| DX7-authentic integers | outputLevel 0–99, ratio as coarse multiples, detune -7..+7 — matches feedback's existing 0–7 scale (Phase 2 D-02) | ✓ |
| Normalized floats (0–1) | Simpler math for Phase 5's Web Audio nodes, but breaks scale consistency with feedback | |

**User's choice:** DX7-authentic integers

**Q2: Default feedback level for the default patch — off, or on to demonstrate the effect?**

| Option | Description | Selected |
|--------|-------------|----------|
| 0 (off) | Cleanest first sound; learner discovers feedback by raising the knob themselves | ✓ |
| Small nonzero (e.g. 2 of 7) | Demonstrates feedback immediately without the learner touching anything | |

**User's choice:** 0 (off)

**Q3: Default ratio for all six operators — unison or spread?**

| Option | Description | Selected |
|--------|-------------|----------|
| 1.0 for all operators | Simplest, avoids unexpected dissonant intervals; matches D-09's single-scalar framing | ✓ |
| Slight spread (e.g. alternating 1.0/2.0) | More characterful default timbre, but no longer one literal scalar | |

**User's choice:** 1.0 for all operators

**Q4: Default envelopeLevel — loud/sustained or moderate?**

| Option | Description | Selected |
|--------|-------------|----------|
| Near-max (fully open) | Sustain stub stays out of the way; simplest mental model until Phase 9 | ✓ |
| Moderate (~70% of max) | More headroom against clipping, but a quieter default patch | |

**User's choice:** Near-max (fully open) — resolved as `envelopeLevel: 99` on the 0–99 scale

**Q5: What should the default outputLevel be (0–99), applied uniformly regardless of carrier/modulator role?**

| Option | Description | Selected |
|--------|-------------|----------|
| 50 (moderate) | Safe middle ground — moderate FM index on stacks, reasonably audible on additive algorithms | ✓ |
| 70 (bright/present) | Louder on sparse algorithms, but risks harshness on modulator stacks | |
| 35 (conservative) | Safest against harshness, but Algorithm 32 may sound thin | |

**User's choice:** 50 (moderate)

**Resulting decisions:** D-10 (numeric scale), D-11 (concrete default patch: outputLevel 50, ratio 1.0, detune 0, envelopeLevel 99, feedback 0) — see CONTEXT.md.

---

## Claude's Discretion

- Exact TypeScript/Angular shape of the facade (single service vs. multiple; exact method names for capture/recall/reset).
- Whether "selected operator" (for a future UI's focus/edit target) is tracked in this facade at all, or left to Phase 4's own local state.

## Deferred Ideas

- Bespoke, hand-tuned per-algorithm default/demo patches — belongs to CURR-01 (v2, Phase 11 curriculum), not this phase's uniform-default state facade.
