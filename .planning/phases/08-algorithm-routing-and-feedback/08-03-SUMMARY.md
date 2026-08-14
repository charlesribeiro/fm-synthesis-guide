---
phase: 08-algorithm-routing-and-feedback
plan: 03
subsystem: dsp
tags: [angular, worklet, fm-synthesis, phase-modulation, audioworklet, vitest]

# Dependency graph
requires:
  - phase: 08-algorithm-routing-and-feedback
    provides: "Plan 08-01's GraphRouter, buildRoutingConfig, the three new worklet message kinds, and WorkletSynthEngine as the live SYNTH_ENGINE (D-01 cutover); Plan 08-02's 32-row cross-check proving the kernel's routing math"
provides:
  - "A hostile-payload matrix proving every malformed shape of setAlgorithm/setOperatorParameters/setFeedback is a silent, non-throwing, state-preserving rejection at parseWorkletMessage's single choke point (T-08-01)"
  - "isOperatorParameterSetLike now requires exactly the six operator ids — closes a real gap where a seventh, out-of-range key alongside all six valid entries previously passed validation"
  - "Element-for-element parity between the real esbuild-built worklet bundle's routed path and a directly-constructed GraphRouter, plus a routing-replacement proof that cached connections/carriers/feedback-operator/feedback-history are all replaced as one unit (T-08-04)"
  - "WorkletSynthEngine.applyInstrumentStateToWorklet is now diff-based: an algorithm switch, an operator-parameter edit, and a feedback edit each post only their own message kind, never all three (Pitfall 5)"
  - "Live held-note re-patch (D-13): switching algorithms while a note is held re-patches the voice in place with no second note-frequency message and no silencing gain schedule"
  - "Per-operator ratio/detune/mode now provably reach the worklet through the reactive InstrumentState path (D-15/D-16) — the first engine on which these are real, audible parameters rather than validated no-ops"
affects: [09-envelope-shaping]

# Actuals (#2632)
actuals:
  tokens: 11011
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-field diff against a remembered lastAppliedX value (not an all-or-nothing snapshot-identity gate) as the pattern for deciding which of several message kinds a reactive engine posts on a given state change"
    - "Message-kind filter helper (messagesOfKindSince) over the fake port's recorded payloads, replacing brittle whole-array toEqual assertions once a method may post a variable subset of message kinds"

key-files:
  created: []
  modified:
    - src/app/domain/dx7/dsp/worklet-messages.ts
    - src/app/domain/dx7/dsp/worklet-messages.spec.ts
    - src/app/core/audio/worklet-processor-bundle.spec.ts
    - src/app/core/audio/worklet-synth-engine.ts
    - src/app/core/audio/worklet-synth-engine.spec.ts

key-decisions:
  - "isOperatorParameterSetLike now checks Object.keys(value).length === OPERATOR_IDS.length in addition to the existing per-id .every(...) check — the one real validation gap Task 1's matrix exposed (a seventh, out-of-range operator id alongside all six valid entries previously passed silently, since the guard only checked the six keys it expected, never the keys actually present)."
  - "Task 2 required no production change to worklets/dx7-worklet-processor.ts or graph-router.ts — the routed-path parity case, the routing-replacement case, the malformed-message case, and the unexpected-quantum case all passed against the code as plan 08-01 already wrote it. Recorded per the 02-03/03-01/08-01-Task-2 precedent for a fix-attempt that finds nothing to fix."
  - "Task 3's applyInstrumentStateToWorklet is now the single place that decides which message(s) to post, called identically from the constructor effect() and from setAlgorithm/setFeedback/updateOperatorLevel — the old hasAppliedRoutingState/rememberAppliedRoutingState all-or-nothing pair is gone, replaced by three independent reference/value comparisons against lastAppliedAlgorithm/lastAppliedOperators/lastAppliedFeedback."
  - "Algorithm 8 chosen as Task 2's parity/switch fixture: its feedback operator is 4 (not the highest id, 6), it has a two-level 6->5->3 chain plus a direct 4->3 modulator into the same target (not a flat single-level shape), and it has two carriers (3 and 1) — a bug that only relocates feedback correctly when it lands on operator 6, or only walks a single modulation level, would be caught. Algorithm 22 (feedback operator 6) is the switch target, chosen because its feedback operator differs from Algorithm 8's."

patterns-established:
  - "Hostile-payload matrix per message kind: a per-kind rejected-payload table (named per exact defect), a per-kind accepted-payload group asserting deep equality at every documented bound, and a per-kind nested hostile-getter case — established here for the three Phase 8 message kinds, reusable shape for any future worklet message kind."

requirements-completed: [ENGINE-02]

coverage:
  - id: D1
    description: "parseWorkletMessage rejects every malformed shape of setAlgorithm/setOperatorParameters/setFeedback (missing/wrong-type/non-finite/non-integer/out-of-bounds/illegal-ratio fields, including a payload with a seventh out-of-range operator id) as a silent null, never throwing, including through a nested throwing getter"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/worklet-messages.spec.ts#parseWorkletMessage — hostile-payload matrix for setAlgorithm (T-08-01)"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/dsp/worklet-messages.spec.ts#parseWorkletMessage — hostile-payload matrix for setOperatorParameters (T-08-01)"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/dsp/worklet-messages.spec.ts#parseWorkletMessage — hostile-payload matrix for setFeedback (T-08-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every documented bound of the new message kinds (feedback min/max, output-level min/max, detune min/max, envelope-level min/max, both coarse-ratio extremes, a fixed-mode entry) is accepted and deep-equal to its constructor function's output, not rejected"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/dsp/worklet-messages.spec.ts#parseWorkletMessage — hostile-payload matrix for setOperatorParameters (T-08-01) > accepts the minimum/maximum output level/detune/envelope level, the lowest/highest coarse ratio position, a fixed-mode entry"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/dsp/worklet-messages.spec.ts#parseWorkletMessage — hostile-payload matrix for setFeedback (T-08-01) > accepts MIN_FEEDBACK_LEVEL/MAX_FEEDBACK_LEVEL"
        status: pass
    human_judgment: false
  - id: D3
    description: "The real esbuild-built worklet bundle renders the routed path element-for-element identical to a directly-constructed GraphRouter, over two rendered blocks, using Algorithm 8 (feedback operator 4, multi-level chain, two carriers) as the discriminating fixture"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-processor-bundle.spec.ts#worklet-processor-bundle > renders the routed path element-for-element identical to a directly-constructed GraphRouter, across two rendered blocks (T-08-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A routing-config message switching to a second algorithm with a different feedback operator id replaces the processor's cached connections/carriers/feedback-operator/feedback-history as one atomic unit — the very next rendered block equals a freshly-constructed router's first block for that algorithm"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-processor-bundle.spec.ts#worklet-processor-bundle > replaces the processor's cached routing state atomically when a second algorithm with a different feedback operator id is applied (T-08-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Routed mode leaves output unchanged and throws nothing for a malformed routing-config message, and fills silence rather than allocating or throwing for an unexpected render-quantum size"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-processor-bundle.spec.ts#worklet-processor-bundle > leaves the routed output unchanged and throws nothing for a malformed routing-config message"
        status: pass
      - kind: unit
        ref: "src/app/core/audio/worklet-processor-bundle.spec.ts#worklet-processor-bundle > fills silence and throws nothing for an unexpected render-quantum size in routed mode"
        status: pass
    human_judgment: false
  - id: D6
    description: "Switching algorithms while a note is held re-patches the live voice: a routing-config message is posted, heldNote stays set (a subsequent noteOff for it still releases), and no second note-frequency message or silencing gain schedule occurs (D-13)"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-synth-engine.spec.ts#D-13: switching algorithms while a note is held re-patches live"
        status: pass
    human_judgment: false
  - id: D7
    description: "An algorithm switch, an operator-parameter edit, and a feedback edit each post exactly their own message kind and zero of the other two kinds; a direct InstrumentState write (no engine method) also reaches the port; ratio/detune/mode changes (no SynthEngine interface method) reach the port in an operator-parameters message; an unchanged snapshot posts nothing"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-synth-engine.spec.ts#InstrumentState-backed setters (real as of Phase 8/ENGINE-02; message separation, Pitfall 5)"
        status: pass
    human_judgment: false
  - id: D8
    description: "destroy() clears the worklet port handler and leaves no held note — a subsequent noteOff for the previously held note throws nothing and posts nothing"
    requirement: ENGINE-02
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-synth-engine.spec.ts#destroy() leaves no held note: noteOff for the previously held note throws nothing and posts nothing"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-08-13
status: complete
---

# Phase 08 Plan 03: Hostile-Payload Matrix, Bundle Parity, and Live Held-Note Re-Patch Summary

**Closed the three gaps plan 08-01 left open: a hostile-payload matrix proving the widened `parseWorkletMessage` choke point rejects every malformed shape of the three new message kinds (and fixed the one real gap it exposed), element-for-element parity between the real built worklet bundle and the kernel Vitest proves, and a diff-based `WorkletSynthEngine` that re-patches a held note live on an algorithm switch while making per-operator pitch and level real, separately-posted parameters.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-13T12:59:06-03:00 (Task 1 commit)
- **Completed:** 2026-08-13T13:22:07-03:00 (Task 3 commit)
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments

- 41 new named rejected-payload rows plus 3 nested hostile-getter cases across `setAlgorithm`/`setOperatorParameters`/`setFeedback`, plus an accepted-payload group at every documented bound (feedback/output-level/detune/envelope-level extremes, both coarse-ratio extremes, a fixed-mode entry) — every case deep-equal to its constructor function's output.
- Closed a real validation gap the matrix exposed: `isOperatorParameterSetLike` accepted a seventh, out-of-range operator id alongside all six valid entries because it only checked the six keys it expected were present, never that no others existed. Now requires an exact six-key object.
- Proved the actual esbuild-built worklet bundle renders the routed path identically (exact element-for-element equality, over two blocks) to a directly-constructed `GraphRouter`, using Algorithm 8 (feedback operator 4, a two-level `6->5->3` chain plus a direct `4->3` modulator, two carriers) as a fixture chosen to discriminate wiring bugs that only work for a flat/single-level shape or a feedback operator that happens to be 6.
- Proved a routing-config switch to Algorithm 22 (feedback operator 6, differing from Algorithm 8's 4) replaces the processor's cached connections/carriers/feedback-operator/feedback-history as one atomic unit — no production change was needed, both files already satisfied every case from plan 08-01's implementation.
- Redesigned `WorkletSynthEngine.applyInstrumentStateToWorklet` to diff `algorithm()`/`operators()`/`feedback()` independently against remembered `lastAppliedX` values and post only the message(s) for what actually changed — an algorithm switch no longer re-sends an unchanged operator-parameters/feedback snapshot, and a level/pitch/feedback edit no longer sends a routing-config message.
- The constructor `effect()` now delegates to this same diff-based method, so a direct `InstrumentState` write — the path every feature component actually uses — reaches the worklet identically to the engine's own setter methods.
- A live algorithm switch now re-patches a held note in place (D-13): only a routing-config message posts, `heldNote` is untouched, and no second note-frequency message or silencing gain schedule occurs.
- Per-operator `ratio`, `detune`, and `mode` — none of which has a `SynthEngine` interface method — now provably reach the worklet through the reactive `InstrumentState` path in an operator-parameters message, closing the last gap between "validated no-op" and "real, audible parameter" for this engine (D-15/D-16).

## Task Commits

Each task was committed atomically:

1. **Task 1: Hostile-payload matrix for the three new message kinds** - `5283395` (test)
2. **Task 2: Prove the real built bundle renders the routed path identically to the kernel, and that a routing change replaces the processor's cached table atomically** - `4660b74` (test)
3. **Task 3: Held-note live re-patch, real pitch and level propagation, and message separation over the fake node boundary** - `6d1610a` (feat)

**Plan metadata:** (this commit, following SUMMARY/STATE/ROADMAP updates)

## Files Created/Modified

- `src/app/domain/dx7/dsp/worklet-messages.ts` - `isOperatorParameterSetLike` now requires an exact six-key object (closes the seventh-id gap)
- `src/app/domain/dx7/dsp/worklet-messages.spec.ts` - hostile-payload matrix for the three new message kinds: rejected-payload tables, accepted-payload groups at every bound, nested hostile-getter cases
- `src/app/core/audio/worklet-processor-bundle.spec.ts` - routed-path parity against a directly-constructed `GraphRouter`, routing-replacement atomicity, routed-mode malformed-message and unexpected-quantum cases
- `src/app/core/audio/worklet-synth-engine.ts` - `applyInstrumentStateToWorklet` rewritten to diff each of algorithm/operators/feedback independently and post only what changed; constructor `effect()` simplified to delegate to it
- `src/app/core/audio/worklet-synth-engine.spec.ts` - message-kind filter helper (`messagesOfKindSince`); rewritten setter tests asserting message separation; new held-note re-patch, direct-`InstrumentState`-write, ratio/detune/mode propagation, unchanged-snapshot, and destroy()-clears-held-note cases

## Decisions Made

- `isOperatorParameterSetLike` now checks `Object.keys(value).length === OPERATOR_IDS.length` in addition to the existing per-id `.every(...)` check — the one real gap Task 1's matrix exposed. Confirmed safe: every existing caller of `setOperatorParametersMessage` (only `worklet-synth-engine.ts` and this phase's own specs) always constructs a full six-key `OperatorParameterSet` with no extra keys.
- Task 2 required no production change — the routed-path parity, routing-replacement, malformed-message, and unexpected-quantum cases all passed against `worklets/dx7-worklet-processor.ts` and `graph-router.ts` exactly as plan 08-01 wrote them. Recorded per the 02-03/03-01/08-01-Task-2 precedent for a fix-attempt that finds nothing to fix.
- Task 3's diff-based `applyInstrumentStateToWorklet` is now the single place that decides which message(s) to post, called identically from the constructor `effect()` and from `setAlgorithm`/`setFeedback`/`updateOperatorLevel` — the old `hasAppliedRoutingState`/`rememberAppliedRoutingState` all-or-nothing pair is gone, replaced by three independent reference/value comparisons.
- Algorithm 8 chosen as Task 2's parity/switch fixture (feedback operator 4, not 6; multi-level chain; two carriers) specifically because it discriminates a bug that only relocates feedback correctly when it lands on operator 6, or only walks a single modulation level. Algorithm 22 (feedback operator 6) is the switch target.

## Deviations from Plan

None - plan executed exactly as written. Task 2 found the production code already correct (an explicitly anticipated outcome per the plan's own "the two production files may well already satisfy every case" framing, mirroring plan 08-01's Task 2). Task 1 and Task 3 each closed exactly one real gap the plan's own hostile-payload matrix / message-separation requirements were designed to expose.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four verification commands (`npm test`, `npm run build`, `npm run lint`, `npm run typecheck:worklet`) are green: 1039/1039 tests passing (up from 1030 at the start of this plan).
- `src/app/core/audio/web-audio-synth-engine.ts` remains untouched across the whole phase (D-04), verified via `git diff --stat` against this phase's base commit.
- The routed path is now proven at all three levels the plan's `<verification>` section required: the pure kernel (plans 08-01/08-02), the real built bundle (this plan's Task 2), and the Angular engine over a fake node boundary (this plan's Task 3).
- Phase 8 (algorithm-routing-and-feedback) is functionally complete: ENGINE-02 is fully covered by 08-01 (Algorithm 1 end-to-end + kernel invariants), 08-02 (32-row cross-check + bounded-output sweep), and this plan (hostile-payload hardening + bundle parity + live parameter/algorithm reality). Plan 08-04, if any, or phase closeout is the next step.

---
*Phase: 08-algorithm-routing-and-feedback*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: src/app/domain/dx7/dsp/worklet-messages.ts
- FOUND: src/app/domain/dx7/dsp/worklet-messages.spec.ts
- FOUND: src/app/core/audio/worklet-processor-bundle.spec.ts
- FOUND: src/app/core/audio/worklet-synth-engine.ts
- FOUND: src/app/core/audio/worklet-synth-engine.spec.ts
- FOUND: commit 5283395 (Task 1)
- FOUND: commit 4660b74 (Task 2)
- FOUND: commit 6d1610a (Task 3)
