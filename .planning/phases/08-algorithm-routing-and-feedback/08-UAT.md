---
status: pending
phase: 08-algorithm-routing-and-feedback
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md, 08-04-SUMMARY.md]
started: 2026-08-14T20:25:51.866Z
updated: 2026-08-14T20:25:51.866Z
---

## Current Test

number: —
name: —
expected: |
  Phase UAT blocked on D-12 checkpoint re-run: auditable resume payload must name Additive,
  Tree/Branch, Rooting, Parallel, and maximum-feedback sample algorithm ids (08-04-PLAN resume-signal).
  Historical bare "approved" is not retained as validated.
awaiting: human D-12 checkpoint re-run with five sample algorithm ids

## Tests

### 1. GraphRouter renders Algorithm 1 correctly
expected: GraphRouter renders Algorithm 1 end to end (feedback on operator 6, carriers 1 and 3) matching a hand-built independent reference
result: pass
source: automated
coverage_id: 08-01-D1

### 2. Feedback recurrence and reset
expected: PhaseModulatedOperator.renderWithFeedback implements the true one-sample-delay feedback recurrence, with non-finite guards and feedback-history reset via resetPhase()
result: pass
source: automated
coverage_id: 08-01-D2

### 3. Algorithm 15 combined feedback+modulation case
expected: An operator that is simultaneously the feedback operator, a receiver of external modulation, and a modulator of another operator renders correctly
result: pass
source: automated
coverage_id: 08-01-D3

### 4. Feedback history hygiene across a routing change
expected: A routing change clears feedback history so a relocated feedback operator never reads a stale previous sample from a different topology
result: pass
source: automated
coverage_id: 08-01-D4

### 5. Higher-modulates-lower invariant holds across all 32 algorithms
expected: Every non-self-loop edge across all 32 ALGORITHMS rows satisfies the higher-modulates-lower invariant the fixed descending render order depends on
result: pass
source: automated
coverage_id: 08-01-D5

### 6. Output bound holds at the summed-carrier stage
expected: A six-carrier algorithm at maximum output level and feedback level 0 stays finite and within the [-1, 1] output bound, proving the bound sits at the summed-carrier stage rather than only on the feedback path
result: pass
source: automated
coverage_id: 08-01-D6

### 7. SYNTH_ENGINE resolves WorkletSynthEngine and the routed kernel is audible in the live app
expected: |
  Playing Algorithm 1 through the live app (Playground/lessons) produces sound from the real
  six-operator routed worklet kernel — a rounder FM timbre from the 4-deep modulator stack
  (6->5->4->3) plus the 2-operator tower (2->1) with feedback on operator 6, not a plain sine
  or a single-operator stand-in. No clicks on note-on/off, and volume is comfortable.
result: pending
notes: Live-app listening is part of the D-12 checkpoint; pending until the five-id auditable payload is recorded.

### 8. Independent reference evaluator implemented
expected: Independent recursive reference evaluator (evaluateAlgorithmReference) implemented, importing nothing from graph-router.ts, derive-role.ts, or patch-plan.ts, and passing its own analytical self-tests
result: pass
source: automated
coverage_id: 08-02-D1

### 9. All 32 algorithms cross-checked against the reference evaluator
expected: All 32 ALGORITHMS rows cross-checked sample-for-sample against evaluateAlgorithmReference within 6 decimal places (D-10)
result: pass
source: automated
coverage_id: 08-02-D2

### 10. All 32 algorithms stay bounded at maximum feedback
expected: All 32 ALGORITHMS rows stay finite and inside the hard output bound at feedback level 7 with every operator at maximum output level, across multiple rendered blocks (D-11)
result: pass
source: automated
coverage_id: 08-02-D3

### 11. Degenerate router-API backstops
expected: An empty carrier list renders an all-zero block; a connections list containing only the feedback self-loop leaves every other operator unmodulated (T-08-06)
result: pass
source: automated
coverage_id: 08-02-D4

### 12. Cross-check demonstrably catches a real routing bug
expected: |
  The cross-check demonstrably catches a real GraphRouter translation bug (not merely a
  dataset-integrity bug) — a deliberate corruption probe (reversing Algorithm 1's 4->3 edge to
  3->4) made exactly that row's cross-check case fail (1/66 tests) while the other 65 passed;
  the corruption was then restored and the full suite reran green (1039/1039 at phase close;
  972/972 was an earlier probe count before later suites landed). Documented as a
  one-time manual probe in 08-02-SUMMARY.md, not a persisted regression test.
result: pass
source: automated
coverage_id: 08-02-D5

### 13. Hostile-payload matrix rejects malformed message shapes
expected: |
  parseWorkletMessage rejects every malformed shape of setAlgorithm/setOperatorParameters/setFeedback
  (missing/wrong-type/non-finite/non-integer/out-of-bounds/illegal-ratio fields, including a seventh
  out-of-range operator id) as a silent null, never throwing. setAlgorithm carries connections and
  carriers only — not feedbackOperatorId. Structural coverage for 08-03-D1 also includes rejecting
  out-of-order non-feedback edges, inconsistent feedback self-loops, and duplicate carriers.
result: pass
source: automated
coverage_id: 08-03-D1

### 14. Every documented bound is accepted, not rejected
expected: Every documented bound of the new message kinds (feedback min/max, output-level min/max, detune min/max, envelope-level min/max, both coarse-ratio extremes, a fixed-mode entry) is accepted and deep-equal to its constructor function's output
result: pass
source: automated
coverage_id: 08-03-D2

### 15. Built bundle matches the kernel exactly
expected: The real esbuild-built worklet bundle renders the routed path element-for-element identical to a directly-constructed GraphRouter, over two rendered blocks (Algorithm 8 fixture)
result: pass
source: automated
coverage_id: 08-03-D3

### 16. Atomic routing replacement on algorithm switch
expected: A routing-config message switching to a second algorithm with a different feedback operator id replaces the processor's cached connections/carriers/feedback-operator/feedback-history as one atomic unit
result: pass
source: automated
coverage_id: 08-03-D4

### 17. Malformed messages and odd render quanta don't break routed mode
expected: Routed mode leaves output unchanged and throws nothing for a malformed routing-config message, and fills silence rather than allocating or throwing for an unexpected render-quantum size
result: pass
source: automated
coverage_id: 08-03-D5

### 18. Held-note re-patch on algorithm switch (D-13)
expected: Switching algorithms while a note is held re-patches the live voice — a routing-config message is posted, the held note stays set (a later noteOff still releases it), and no second note-frequency message or silencing gain schedule occurs
result: pass
source: automated
coverage_id: 08-03-D6

### 19. Parameter changes post exactly their own message kind
expected: An algorithm switch, an operator-parameter edit, and a feedback edit each post exactly their own message kind and zero of the other two; ratio/detune/mode changes reach the port; an unchanged snapshot posts nothing
result: pass
source: automated
coverage_id: 08-03-D7

### 20. destroy() leaves no held note
expected: destroy() clears the worklet port handler and leaves no held note — a subsequent noteOff for the previously held note throws nothing and posts nothing
result: pass
source: automated
coverage_id: 08-03-D8

### 21. Dev harness selects any algorithm and feedback depth
expected: The dev harness selects any of the 32 algorithms and any feedback depth 0-7, and plays the routed engine through the same three worklet messages the Angular engine posts
result: pass
source: automated
coverage_id: 08-04-D1

### 22. Validation record complete
expected: 08-VALIDATION.md records a real task id, plan and wave for every row of the requirement-to-test contract, with status: validated and nyquist_compliant: true
result: pending
notes: Frontmatter reverted to draft / nyquist_compliant: false until D-12 re-run records the five sample algorithm ids required by the updated 08-04-PLAN resume-signal.
source: automated
coverage_id: 08-04-D7

### 23. All four taxonomy groups plus maximum feedback sound correct (D-12)
expected: |
  One algorithm from each of the four teaching taxonomy groups (Additive Stacks, Tree/Branch,
  Rooting, Parallel) plus maximum feedback depth and maximum operator level route and sound
  correct in a real browser, with the five sample algorithm ids recorded in the auditable resume payload.
result: pending
notes: Historical bare "approved" lacked sample ids; re-run required under updated resume-signal.
### 24. Held-note algorithm switch re-patches audibly (D-13)
expected: Switching algorithms while a note is held re-patches the sound audibly without cutting the note and without leaving a stuck voice
result: pending
notes: Same D-12 checkpoint re-run required; historical approval lacked auditable sample ids.

### 25. Maximum feedback stays bounded and harsh-not-tamed (D-07, D-08)
expected: Output stays audibly bounded and never painfully loud at maximum feedback with every operator at maximum level, and maximum feedback is allowed to sound harsh rather than tamed
result: pending
notes: Same D-12 checkpoint re-run required; no separate auditable evidence currently verifies the maximum-feedback listening behavior.

### 26. Lesson 6 regression against the live engine (D-03)
expected: Lesson 6's Algorithm 1 try-this completion flow still fires its completion state and the sound matches expectations against the now-live WorkletSynthEngine
result: pending
notes: Live Lesson 6 listening is part of the D-12 checkpoint; pending until the five-id auditable payload is recorded.

### 27. Honesty copy unchanged (D-05, AUDIO-03)
expected: The persistent educational-approximation honesty label still reads exactly as it did before this phase — routing and feedback becoming real changed no honesty copy
result: pending
notes: Honesty-copy check is part of the D-12 checkpoint; pending until the five-id auditable payload is recorded.

## Summary

total: 27
passed: 20
issues: 0
pending: 7
skipped: 0
blocked: 0
must_haves: 14/15 (truth 15 open pending auditable D-12 re-run)

## Gaps
- D-12 blocking listening checkpoint must be re-run with an auditable resume payload naming Additive, Tree/Branch, Rooting, Parallel, and maximum-feedback sample algorithm ids before restoring `08-VALIDATION.md` to `status: validated`.
