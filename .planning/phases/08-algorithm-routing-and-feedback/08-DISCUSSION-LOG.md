# Phase 8: Algorithm routing and feedback - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 8-Algorithm routing and feedback
**Areas discussed:** Live cutover scope, Feedback character, Correctness-proof breadth, Held-note
algorithm switch

---

## Live cutover scope

| Question | Option | Description | Selected |
|---|--------|-------------|----------|
| Cut SYNTH_ENGINE over to WorkletSynthEngine? | Yes, cut over this phase | Real user-facing payoff; Lesson 6 becomes a live regression test | ✓ |
| | No, stay isolated (defer to Phase 9) | Matches Phase 7 D-01 precedent exactly | |
| | Cut over, but only after listening checkpoint | Sequenced variant of "Yes" | |
| Still need a blocking listening checkpoint? | Yes, blocking checkpoint required | Consistent with 05-04/06-04/07-03 precedent | ✓ |
| | No, automated proof is enough this time | Faster, relies on analytical rigor + Lesson 6 | |
| Lesson 6 explicit regression check? | Yes, explicit regression check | Re-verify try-this completion flow on the new engine | ✓ |
| | No, general test coverage is enough | Trust the broader suite | |
| Fate of WebAudioSynthEngine? | Keep as unused fallback | Zero risk, dead code from app's perspective | ✓ |
| | Keep and use as automatic fallback | More robust, adds a branch to the DI token | |
| | Remove it | Cleanest, loses the safety net | |
| Approximation-label wording? | Keep the same wording | Still not a bit-accurate emulation, no copy change needed | ✓ |
| | Update the wording | Reflect the more-accurate engine | |

**User's choice:** Cut over this phase, gated by a blocking listening checkpoint; explicit Lesson 6
regression check; keep WebAudioSynthEngine as an unused fallback; label wording unchanged.
**Notes:** None beyond the selections.

---

## Feedback character

| Question | Option | Description | Selected |
|---|--------|-------------|----------|
| Max feedback sound? | Authentic edge, hard-clamped only for safety | Genuinely harsh/noisy at max depth, matches real DX7 | ✓ |
| | Musically tamed at the top end | Soft-knee/saturating curve, gentler | |
| Feedback delay model? | One-sample delay (most accurate) | Standard DX7-style model, kernel has no cycle constraint | ✓ |
| | Match existing one-block (128-sample) delay | Consistency with the approximation engine | |
| Safety clamp mechanism? | Hard sample clamp to [-1, 1] | Simplest, cheapest, deterministic | ✓ |
| | Lightweight limiter/soft-clip curve | Avoids harsh clipping artifact | |
| Feedback depth mapping? | Reuse the existing 0–7 DX7 feedback scale | Same parameter drives both engines | ✓ |
| | Something else | Open text | |

**User's choice:** Authentic-edge feedback, one-sample delay, hard [-1, 1] clamp, reuse the
existing 0–7 feedback scale.
**Notes:** None beyond the selections.

---

## Correctness-proof breadth

| Question | Option | Description | Selected |
|---|--------|-------------|----------|
| Proof depth across 32 algorithms? | Deep-verify all 32 individually | Highest confidence, largest test-authoring effort | ✓ |
| | Deep-verify one per group, generic proof for the rest | Less duplicated effort | |
| Listening checkpoint scope? | One per algorithm group (4 total) + max feedback | Broader spread, catches systemic bugs | ✓ |
| | Just the two existing lesson algorithms (32 and 1) | Matches Phase 7's minimal precedent | |
| Reference for deep-verify? | An independent, hand-written reference evaluator | Catches translation bugs a shared-code test couldn't | ✓ |
| | Structural assertions per algorithm | Lighter, doesn't independently prove the waveform | |
| Bounded-output proof scope? | Every algorithm at max feedback level | Exhaustive, matches literal roadmap wording | ✓ |
| | Only algorithms with a feedback self-loop | Narrower, feedback is a no-op elsewhere | |

**User's choice:** Deep-verify all 32 against an independent reference evaluator; listening
checkpoint samples one algorithm per taxonomy group plus max feedback; bounded-output proof runs
for every algorithm at max feedback.
**Notes:** None beyond the selections.

---

## Held-note algorithm switch

| Question | Option | Description | Selected |
|---|--------|-------------|----------|
| Live re-patch on switch? | Yes, live audible re-patch (match Phase 5 D-02) | Same UX Playground/lessons already have | ✓ |
| | No, cut the note on algorithm switch | Simpler, but a UX regression | |
| Switch message mechanism? | A new worklet message carrying the routing config | Extends worklet-messages.ts's existing pattern | ✓ |
| | Something else | Open text | |
| Reuse operatorFrequencyHz for pitch? | Yes, reuse operatorFrequencyHz now | Musically correct sound, narrows Phase 9 to envelopes only | ✓ |
| | No, use simple/naive per-operator frequencies | Minimal diff, sounds musically "off" | |
| Reuse level conversions? | Yes, reuse the existing level conversions | Operator-level UI stays meaningful after cutover | ✓ |
| | No, flat/uniform levels until Phase 9 | updateOperatorLevel stays a no-op | |

**User's choice:** Live audible re-patch on switch via a new worklet routing message; reuse
`operatorFrequencyHz` for pitch and `outputLevelToAmplitude`/`outputLevelToModulationDepthHz` for
level, making both real on the worklet engine this phase.
**Notes:** This expands `updateOperatorLevel` from a validated no-op to a real implementation —
justified as reusing already-built, non-envelope domain code rather than new scope; ENGINE-03
(Phase 9) narrows to real ADSR-style envelope shaping only as a result.

---

## Claude's Discretion

- Exact TypeScript shape of the new routing-config worklet message (field names/nesting, one
  message vs. several).
- Exact module/file layout for the kernel's graph-routing logic and the independent reference
  evaluator.
- Exact numeric tolerance for the per-algorithm analytical-match assertions.
- Exact deterministic evaluation order for a routed algorithm's operators — expected to derive
  from the existing "higher-modulates-lower" invariant (descending operator-id order), to be
  confirmed and documented rather than building a general topological sort.
- Exact one-sample feedback delay implementation detail (where the previous-sample value is
  stored).
- Whether the routing-config worklet message is sent proactively on every `setAlgorithm()` call or
  lazily deferred until the next `noteOn`.
- Exact wording/structure of the independent reference evaluator (recursive vs. iterative), as
  long as it is genuinely separately authored from the kernel's own routing code.

## Deferred Ideas

None — discussion stayed within phase scope. DX7-style four-rate/four-level envelope segment
shaping remains explicitly Phase 9/ENGINE-03's job; oscilloscope/spectrum visualizers (Phase 10)
and per-algorithm curriculum beyond the Lesson 6 regression check (Phase 11) were named as
explicitly out of scope during discussion.
