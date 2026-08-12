---
phase: 07-audioworklet-dsp-foundation
plan: 02
subsystem: audio
tags: [web-audio, audioworklet, angular-di, synth-engine, vitest]

# Dependency graph
requires:
  - phase: 07-audioworklet-dsp-foundation
    plan: 01
    provides: "DX7_OPERATOR_PROCESSOR_NAME, setFrequencyMessage, setModeMessage, WorkletRenderMode (worklet-messages.ts) — the shared main-thread/render-thread message contract this plan's engine posts against"
provides:
  - "AUDIO_WORKLET_NODE_CTOR / AUDIO_WORKLET_MODULE_URL — the DI-wrapped AudioWorkletNode boundary, mirroring audio-context.token.ts exactly"
  - "FakeAudioWorkletContext / FakeAudioWorkletNode / FakeAudioWorklet / ThrowingAudioWorkletNode — hand-rolled test doubles for the worklet boundary, no test library"
  - "WorkletSynthEngine — a fully tested SynthEngine implementation over an AudioWorkletNode, proving D-02's interface-shape claim, deliberately not wired into SYNTH_ENGINE"
affects: [07-03-dev-harness-and-listening-checkpoint, 08-graph-routing-and-feedback, 09-envelopes]

# Actuals (#2632)
actuals:
  tokens: 8864
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "DI-wrapped browser-boundary pair (audio-worklet-node.token.ts + testing/fake-audio-worklet-node.ts), a direct structural sibling of audio-context.token.ts/fake-audio-context.ts — every new browser global gets a *Like interface + InjectionToken (never constructed at module/DI-factory time) plus a hand-rolled fake with recording arrays, no test library"
    - "Second SynthEngine implementation proven against fakes only, deliberately not wired to the SYNTH_ENGINE token (D-01) — an interface-shape proof that keeps the shipped MVP engine's behavior frozen while the accuracy-target engine is built out over subsequent phases"
    - "Validated no-op interface members (setAlgorithm/setFeedback/updateOperatorLevel): argument validation runs, no message is posted, and a doc comment names the exact future phase that makes each one real — an explicit, testable contract instead of an unimplemented throw"

key-files:
  created:
    - src/app/core/audio/audio-worklet-node.token.ts
    - src/app/core/audio/testing/fake-audio-worklet-node.ts
    - src/app/core/audio/worklet-synth-engine.ts
    - src/app/core/audio/worklet-synth-engine.spec.ts
  modified: []

key-decisions:
  - "FakeAudioWorkletNode implements connect/disconnect locally rather than exporting fake-audio-context.ts's currently-private FakeAudioNode base class — a six-line duplication is cheaper than modifying a Phase 5 file that Phase 5's own test suite depends on."
  - "WORKLET_ATTACK_SECONDS/WORKLET_RELEASE_TIME_CONSTANT/WORKLET_RELEASE_SECONDS and the validateNote/validateVelocity guard shapes are duplicated from web-audio-synth-engine.ts (same values, same four-line shape) rather than imported — importing them would make this module depend on Phase 5's live engine class, which D-01's isolation forbids. Flagged as consolidation work for the eventual live-cutover phase."
  - "setFeedback and updateOperatorLevel reuse the existing exported validators (validateFeedbackLevel from patch.ts, validateOperatorParameters({ outputLevel }) from operator-parameters.ts) rather than re-deriving bound checks locally — these are pure, already-tested domain functions with no Angular dependency, so reusing them is DRY without violating D-01 isolation (unlike the Phase-5-engine-specific constants/guards above, these live in domain/, not in the sibling engine class)."
  - "ENGINE-01 remains open in REQUIREMENTS.md (not marked complete) — this plan discharges the main-thread half of the interface-shape proof (D-02) plus the SynthEngine contract, but the requirement spans all three 07-0x plans per 07-01-SUMMARY.md's precedent; 07-03's real-browser listening checkpoint is still required before ENGINE-01 closes."

patterns-established:
  - "TDD RED-then-GREEN gate honored for this task: worklet-synth-engine.spec.ts committed first (confirmed to fail — TS2459/TS18046 compile errors — with the implementation file absent), worklet-synth-engine.ts committed second, both green."

requirements-completed: []  # ENGINE-01 spans 07-01/07-02/07-03; stays open until 07-03's listening checkpoint (see key-decisions)

coverage:
  - id: T1
    description: "AUDIO_WORKLET_NODE_CTOR/AUDIO_WORKLET_MODULE_URL follow audio-context.token.ts's exact InjectionToken+providedIn:'root'+factory shape; no Phase 5 file modified"
    requirement: "ENGINE-01"
    verification:
      - kind: unit
        ref: "npm run build && npm run lint (both green); git diff --exit-code against Phase 5 token/fake/engine files"
        status: pass
    human_judgment: false
  - id: T2
    description: "WorkletSynthEngine implements every SynthEngine member with matching signatures; status is a read-only Signal; a repeated initialize() builds nothing extra; a rejected addModule()/throwing node constructor yields 'error' with the context closed; noteOn posts the shared frequency message and moves gain only through scheduled automation; the three not-yet-meaningful members validate and post nothing; destroy() leaves no connected node/port handler/open context; SYNTH_ENGINE still resolves to WebAudioSynthEngine"
    requirement: "ENGINE-01"
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-synth-engine.spec.ts (22 tests)"
        status: pass
      - kind: other
        ref: "npm test (866/866), npm run build, npm run lint"
        status: pass
    human_judgment: false

duration: ~10min
completed: 2026-08-11
status: complete
---

# Phase 7 Plan 2: AudioWorklet DSP Foundation Summary

**A DI-wrapped `AudioWorkletNode` boundary with hand-rolled fakes, and a fully tested `WorkletSynthEngine` implementing the existing `SynthEngine` interface over it — the main-thread half of D-02's interface-shape proof, deliberately not wired into the running app.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-11T20:38Z (approx, from first task commit)
- **Completed:** 2026-08-11T20:43Z
- **Tasks:** 2
- **Files created:** 4 (0 modified)

## Accomplishments

- `audio-worklet-node.token.ts` — `AudioWorkletPortLike`, `AudioWorkletNodeLike`,
  `AudioWorkletLike`, `AudioWorkletContextLike`, `AudioWorkletNodeOptionsLike`,
  `AudioWorkletNodeConstructorLike`, the `supportsAudioWorklet` narrowing guard, and the
  `AUDIO_WORKLET_NODE_CTOR` / `AUDIO_WORKLET_MODULE_URL` DI tokens — a direct structural
  sibling of `audio-context.token.ts`, with the module URL documented as build-time fixed
  (threat `T-07-06`).
- `testing/fake-audio-worklet-node.ts` — `FakeAudioWorkletPort`, `FakeAudioWorkletNode`,
  `FakeAudioWorklet`, `FakeAudioWorkletContext`, `ThrowingAudioWorkletNode`: hand-rolled
  doubles recording every `addModule` call, posted message, and connection, no test library,
  extending `FakeAudioContext` so the existing gain/param/teardown recording machinery is
  reused rather than reimplemented.
- `WorkletSynthEngine` (`worklet-synth-engine.ts`) — a `SynthEngine` implementation over an
  `AudioWorkletNode`: gesture-gated idempotent `initialize()` with the same generation-counter
  stale-resume guard as `WebAudioSynthEngine`; `noteOn`/`noteOff`/`allNotesOff` posting the
  shared frequency message and moving gain only through scheduled automation; three
  not-yet-meaningful interface members (`setAlgorithm`, `setFeedback`, `updateOperatorLevel`)
  that validate and post nothing, each doc-commented with the phase that makes it real;
  `setRenderMode` as an additive concrete-class method; `destroy()` clearing the port handler
  and disconnecting every created node.
- `worklet-synth-engine.spec.ts` — 22 tests covering lifecycle reachability (suspended /
  unavailable / ready / error), idempotency, the load-failure and node-construction-failure
  paths, the note on/off/all-off message-and-gain contract, `setRenderMode`, the three
  validated no-ops, the `MASTER_GAIN` safety-clamp scheduling, full teardown, and the D-01
  `SYNTH_ENGINE` isolation assertion.

## Task Commits

Each task was committed atomically:

1. **Task 1: DI-wrapped AudioWorkletNode boundary + hand-rolled fakes** - `4542b97` (feat)
2. **Task 2: WorkletSynthEngine (TDD)** - `89486af` (test, RED) then `70cce8f` (feat, GREEN)

## Files Created/Modified

- `src/app/core/audio/audio-worklet-node.token.ts` - `AudioWorkletPortLike`, `AudioWorkletNodeLike`, `AudioWorkletLike`, `AudioWorkletContextLike`, `AudioWorkletNodeOptionsLike`, `AudioWorkletNodeConstructorLike`, `supportsAudioWorklet`, `AUDIO_WORKLET_NODE_CTOR`, `AUDIO_WORKLET_MODULE_URL`, `DEFAULT_WORKLET_MODULE_URL`
- `src/app/core/audio/testing/fake-audio-worklet-node.ts` - `FakeAudioWorkletPort`, `FakeAudioWorkletNode`, `FakeAudioWorklet`, `FakeAudioWorkletContext`, `ThrowingAudioWorkletNode`
- `src/app/core/audio/worklet-synth-engine.ts` - `WorkletSynthEngine`, `WORKLET_ATTACK_SECONDS`, `WORKLET_RELEASE_TIME_CONSTANT`, `WORKLET_RELEASE_SECONDS`
- `src/app/core/audio/worklet-synth-engine.spec.ts` - 21-test lifecycle/message-contract/validation/teardown/D-01-isolation suite

## Decisions Made

- `FakeAudioWorkletNode`'s `connect`/`disconnect` are implemented locally rather than reusing
  `fake-audio-context.ts`'s private base class — see frontmatter `key-decisions`.
- `WORKLET_ATTACK_SECONDS`/`WORKLET_RELEASE_TIME_CONSTANT`/`WORKLET_RELEASE_SECONDS` and the
  `validateNote`/`validateVelocity` guards are duplicated in shape from
  `web-audio-synth-engine.ts` rather than imported (D-01 isolation) — see frontmatter
  `key-decisions`.
- `setFeedback`/`updateOperatorLevel` reuse `validateFeedbackLevel`/`validateOperatorParameters`
  from the domain layer instead of re-deriving bound checks — see frontmatter `key-decisions`.
- `ENGINE-01` intentionally stays off `requirements-completed` — spans all three 07-0x plans,
  per the precedent set in `07-01-SUMMARY.md`.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>`/`<behavior>`
specifications; all acceptance criteria and the plan's own `<verification>` commands passed
without needing a Rule 1/2/3 fix.

## TDD Gate Compliance

Task 2 (`tdd="true"`) followed the full RED → GREEN sequence: `worklet-synth-engine.spec.ts`
was written and committed first (`89486af`), confirmed to fail to compile
(`TS2459`/`TS18046` — the spec imports `WorkletSynthEngine` from a file that did not yet
exist) before any implementation code was written, then `worklet-synth-engine.ts` was
implemented and committed second (`70cce8f`) until all 21 tests passed. No REFACTOR commit was
needed — the implementation matched the plan's `<action>` shape on the first pass with no
follow-up cleanup.

## Issues Encountered

None. One self-corrected typo during implementation (`contextCtor()` missing `new` before the
constructor call) was caught by the TypeScript compiler during the RED→GREEN pass itself, not
left in any committed code.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `WorkletSynthEngine` and its DI boundary are ready for plan 07-03's dev harness and
  real-browser listening checkpoint (D-06/D-07) — though per the plan's own flagged
  assumption, this class itself is not exercised by that harness (the harness is a standalone
  bundle that cannot import an Angular `@Injectable`); what 07-03 verifies in a real browser is
  the shared message contract and the built worklet bundle this class already posts against.
- `SYNTH_ENGINE` still resolves to `WebAudioSynthEngine` (D-01, asserted by a test) — nothing in
  Playground or `/learn` calls anything built in this plan. No regression risk to the shipped
  MVP engine.
- `ENGINE-01` remains open in `REQUIREMENTS.md` until 07-03's listening checkpoint closes the
  "worklet loads and runs" real-browser half of ROADMAP success criterion 1.
- The Angular DI wiring and the `addModule`-then-construct-node ordering are proven only
  against hand-rolled fakes this phase (flagged assumption, deliberately accepted per
  `07-02-PLAN.md`) — re-verification in a real browser is deferred to whichever future phase
  performs the live `SYNTH_ENGINE` cutover, not to 07-03.

## Self-Check: PASSED

All 4 created files verified present on disk; all three task commit hashes (`4542b97`,
`89486af`, `70cce8f`) verified present in git history.

---
*Phase: 07-audioworklet-dsp-foundation*
*Completed: 2026-08-11*
