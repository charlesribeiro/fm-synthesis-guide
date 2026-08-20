# Phase 8: Algorithm routing and feedback - Research

**Researched:** 2026-08-13
**Domain:** Graph-to-kernel routing translation for a pure phase-modulation DSP kernel; AudioWorklet
live parameter/routing message design; numeric bounded-output proofs for a 32-row algorithm dataset
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Live-engine cutover scope**
- **D-01:** `SYNTH_ENGINE` is cut over to `WorkletSynthEngine` this phase — Playground and the
  `/learn` lessons hear the routed, feedback-capable worklet engine, not the Phase 5 approximation.
  — **Reversibility:** costly — every lesson/Playground interaction becomes a live regression
  surface for the new engine from this phase forward; reverting later means re-auditing whichever
  UI/lesson behavior came to depend on the worklet engine's specific timing/behavior.
- **D-02:** A blocking human-listening checkpoint (mirrors 05-04/06-04/07-03 precedent) is required
  before the phase can close, even though it duplicates prior phases' pattern — the cutover changes
  what real users/lessons actually hear, and the automated correctness suite alone was judged
  insufficient confidence for that.
- **D-03:** Lesson 6's Algorithm 1 lesson (a modulation stack + tower, with feedback) gets an
  explicit regression check — a test or checkpoint step specifically re-verifying its try-this
  completion flow (target operator/param move + note trigger, per `06-CONTEXT.md` D-02/D-06)
  against `WorkletSynthEngine` — not just coverage from the general 32-algorithm correctness suite.
- **D-04:** `WebAudioSynthEngine` is kept in the codebase as an unused fallback — not deleted, not
  auto-selected when AudioWorklet is unsupported (that would need `AudioEngineStatus` branching
  logic this phase does not build). It stays reachable as a reference/manual-swap option only.
- **D-05:** The persistent "educational approximation" label (Phase 5 D-08, AUDIO-03) keeps its
  existing wording — CLAUDE.md's "do not claim exact DX7 emulation" stance does not change just
  because routing/feedback are now real; no copy change this phase.

**Kernel feedback architecture**
- **D-06:** The kernel's feedback self-loop uses a true one-sample delay (the operator's own
  previous rendered sample fed back as phase-modulation input) — not the 128-sample
  render-quantum delay `WebAudioSynthEngine` uses to work around Web Audio's zero-delay-cycle
  restriction. The pure kernel has no such restriction, so the more accurate model is free to use.
  — **Reversibility:** costly — `additive-fixture.spec.ts`/`operator.spec.ts`'s existing
  render-loop shape and any Phase 8 correctness tests get built against this delay model; changing
  it later means re-deriving every feedback-bearing algorithm's expected reference output.
- **D-07:** Maximum feedback is allowed to sound authentically harsh/edgy (matching real DX7
  feedback character) — the only ceiling is a hard safety clamp, never a musical soft-limiter that
  tames the tone. Teaches learners what feedback actually does rather than sanding off the effect.
- **D-08:** The safety clamp is a hard per-sample clamp to `[-1, 1]` — not a soft-clip/saturating
  curve. Simplest, cheapest, deterministic; the resulting harmonic distortion at the clip point is
  in keeping with D-07's "authentic edge" choice rather than fighting it.
- **D-09:** Feedback depth reuses the existing 0–7 DX7 feedback scale
  (`value-conversion.ts`'s `feedbackLevelToDepthHz`, `patch.ts`'s `validateFeedbackLevel`) — same
  parameter drives both engines, no new UI, no new patch field.

**Correctness-proof breadth**
- **D-10:** All 32 algorithms are deep-verified individually, each checked against an independent,
  hand-written reference evaluator (a second, deliberately separate phase-modulation implementation
  built directly from each algorithm's edges/carriers/feedback) — not a lighter structural-only
  assertion, and not a "verify one per group, generic-proof the rest" shortcut. Catches
  graph-to-render translation bugs a shared-code test couldn't, mirroring Phase 7 D-05's
  analytical-match rigor extended across all 32 rows.
- **D-11:** Bounded-and-finite output at maximum feedback is proven for every algorithm, not just
  the ones with a declared feedback self-loop — matches ROADMAP's literal "bounded and finite under
  feedback at maximum" wording across the full set.
- **D-12:** The blocking human-listening checkpoint samples one algorithm per taxonomy group
  (Additive Stacks 1–6, Tree/Branch 7–18, Rooting 19–25, Parallel 26–32 — the grouping already
  established by `teachingTags`/Phase 4's browse view) plus feedback at maximum depth — four
  algorithms plus the feedback case, not just the two lesson algorithms Phase 7 used as its minimal
  precedent.

**Held-note algorithm switch and operator pitch/level wiring**
- **D-13:** Switching the selected algorithm while a note is held re-patches that held voice live
  and audibly on the worklet engine too — matching `WebAudioSynthEngine`'s existing D-02 behavior
  (`05-CONTEXT.md`) exactly, not a simpler cut-and-restart. Preserves the UX Playground/lessons
  already have today; the core value ("change a parameter, immediately understand why the sound
  changed") applies to algorithm choice, not only operator params.
- **D-14:** The algorithm switch reaches the running worklet processor via a new worklet message
  (extending `worklet-messages.ts`'s existing `setFrequency`/`setMode` pattern) carrying only
  `connections` and `carriers`, translated from the canonical dataset on the main thread — the
  processor rebuilds its internal routing table on receipt. `GraphRouter` derives
  `feedbackOperatorId` from `connections[].isFeedback`; `feedbackOperatorId` is not a `setAlgorithm`
  payload field.
- **D-15:** The worklet engine reuses `operatorFrequencyHz` (ratio/detune/fixed-mode conversion,
  already pure domain code, already proven in Phase 5) for each operator's pitch — not naive/flat
  per-operator frequencies. Makes this phase's own listening checkpoint musically meaningful and
  narrows ENGINE-03 (Phase 9) to real envelope shaping only, since frequency-mode math is already
  solved and doesn't require any envelope work to wire in.
- **D-16:** The worklet engine likewise reuses `outputLevelToAmplitude`/
  `outputLevelToModulationDepthHz` for per-operator level — `updateOperatorLevel` becomes a real,
  audible implementation this phase rather than staying the validated no-op it is today (per
  `worklet-synth-engine.ts`'s current "Phase 9 (ENGINE-03)" comment, which this decision
  supersedes for level/pitch specifically — ADSR-style envelope segments remain Phase 9's job).
  — **Reversibility:** costly — once `updateOperatorLevel` is a real implementation and lessons/
  Playground depend on it working, no-opping it again would be a user-visible regression.

### Claude's Discretion
- Exact TypeScript shape of the new routing-config worklet message (D-14) — field names/nesting
  for connections and carriers only (`feedbackOperatorId` is derived by `GraphRouter` from
  `connections[].isFeedback`, not carried on the payload), and whether it's one message or several
  — informed by `worklet-messages.ts`'s existing `parseWorkletMessage` choke-point pattern (never
  throws, rejects malformed shapes by returning `null`) and `patch-plan.ts`'s `OperatorConnection`
  shape.
- Exact module/file layout for the kernel's graph-routing logic (e.g. a new
  `src/app/domain/dx7/dsp/graph-router.ts` or similar) and for the independent reference evaluator
  used by D-10's correctness proof — informed by the domain-purity ESLint gate (DOMAIN-04) and the
  existing `dsp/operator.ts`/`dsp/additive-fixture.ts` module boundary.
- Exact numeric tolerance for D-10's per-algorithm analytical-match assertions, mirroring Phase 7
  D-05's precedent of Claude's Discretion informed by research.
- Exact deterministic evaluation order for a routed algorithm's operators inside a single render
  block — the codebase's existing "higher-modulates-lower" invariant
  (`validate-algorithm.ts`, `derive-role.ts`) already guarantees every non-feedback edge goes from
  a higher operator id to a lower one, which constrains (and likely fixes) this to a simple
  descending-id evaluation order; confirm and document this as the derivation rather than building
  a general topological sort.
- Exact one-sample feedback delay implementation detail (D-06) — e.g. whether the previous-sample
  value is stored per-operator inside the kernel class itself or in a small wrapper — informed by
  CLAUDE.md's "DSP code must not allocate excessively inside the audio render loop."
- Whether the new routing-config worklet message is sent proactively on every `setAlgorithm()` call
  (even before a note is held) or lazily deferred until the next `noteOn` — informed by D-13's
  live-re-patch requirement and `WebAudioSynthEngine.applyRouting`'s existing "apply immediately,
  independent of note state" precedent.
- Exact wording/structure of the independent reference evaluator used in D-10 (recursive vs.
  iterative, exact function signature) — as long as it is genuinely a second, separately-authored
  implementation and not a thin wrapper around the kernel's own routing code.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (DX7-style four-rate/four-level envelope segment
shaping remains explicitly Phase 9/ENGINE-03's job — D-15/D-16 pull only the already-solved
pitch/level conversion math forward into this phase, not envelope work itself. Oscilloscope/
spectrum visualizers [Phase 10] and per-algorithm curriculum beyond the Lesson 6 regression check
[Phase 11] were named during discussion as explicitly out of scope and are recorded in the Phase
Boundary above, not as new deferred ideas.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGINE-02 | All 32 graph topologies routed in the DSP engine, with feedback state | `## Architecture Patterns` (graph-router design, feedback-capable operator extension, worklet message expansion, `InstrumentState`-effect wiring), `## Code Examples` (concrete render-loop/formula derivations verified against this session's source reads), `## Common Pitfalls` (unit-conversion bug, interface-method gap, stale-feedback-state-on-switch, carrier-sum overflow), `## Validation Architecture` (D-10/D-11 test map) all target this one requirement directly. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Angular 22 only, standalone components, zoneless, strict TypeScript/templates — `WorkletSynthEngine`
  changes must stay signal-based (`effect()` only for imperative sync with the worklet port, never to
  derive state).
- Domain/graph/frequency/envelope/patch/DSP logic must have zero Angular imports (machine-enforced,
  DOMAIN-04 ESLint gate scoped to `src/app/domain/**/*.ts`) — the new graph-router and reference
  evaluator both belong under `src/app/domain/dx7/dsp/`.
- Operator IDs use the restricted `OperatorId` type; one canonical algorithm dataset; no duplicated
  routing knowledge — the worklet must consume translated routing data from the main thread, never
  re-derive carrier/feedback roles from a locally re-implemented rule.
- Never create `AudioContext` at module evaluation time; resume/start audio only after an explicit
  user gesture — unaffected by this phase (already satisfied by `WorkletSynthEngine.initialize()`).
- Never store `AudioNode`s in Angular signal state; smooth gain changes to avoid clicks.
- Every voice/oscillator/worklet/analyser/timer/animation-frame needs an explicit cleanup path —
  unaffected by this phase's scope (no new node types), but any new `previousSample`/routing-table
  state added to the kernel must be reset on `destroy()`/algorithm switch to avoid stale leakage
  (see Common Pitfalls).
- DSP code must not allocate excessively inside the audio render loop — the graph router's per-block
  scratch buffers (one per operator, one for the feedback previous-sample scalar) must be
  pre-allocated once, never inside `render()`/`process()`.
- Do not claim exact DX7 emulation — this phase's kernel is an original phase-modulation
  implementation "written toward DX7-style behaviour," never a transcription (already the wording in
  `operator.ts`'s file header; extend, don't contradict, in the graph router's own header comment).
- Vitest is mandatory; new domain behavior requires tests; a bug fix needs a regression test; mock
  browser boundaries, not pure domain logic; audio tests must be deterministic, no physical device.
- No copyrighted patch ROMs/commercial banks/manual scans/copied diagrams — the independent
  reference evaluator (D-10) must be an original re-derivation from `algorithm.edges`, never a
  transcription of a Yamaha/Dexed source.
- Run `npm run build`, `npm test`, `npm run lint` before declaring work complete (per this repo's
  Phase 1 finding, `npm test` already runs once and exits outside a TTY — `npm test -- --run` is not
  a real flag).

## Summary

This phase's hard problem is not "can a phase accumulator be modulated" (Phase 7 already proved
that) — it is **translating a declarative edge/carrier/feedback graph into a correctly-ordered,
correctly-scaled, correctly-clamped per-sample render loop**, and then **wiring that translation to
run twice** (once inside the pure kernel for Vitest-provable correctness, once inside the live
worklet for what a human actually hears), while also making the worklet engine — for the first time
this project — the thing Playground and `/learn` actually play through (D-01).

Four load-bearing facts, each confirmed by reading this session's actual source files rather than
assumed from the decisions' prose, drive nearly every recommendation below:

1. **The DX7-scale-to-Hz conversion functions were built for Web Audio's `AudioParam`-based
   frequency modulation, not for this kernel's phase-modulation input.** `outputLevelToModulationDepthHz`
   and `feedbackLevelToDepthHz` both return `index * frequencyHz` (a peak *frequency* deviation, the
   unit `oscillator.frequency` needs). `operator.ts`'s `render(output, modulationInput)` instead adds
   `modulationInput[i]` **directly to the phase argument in radians** — a dimensionless index, not a
   Hz value. Feeding a raw `outputLevelToModulationDepthHz(...)` Hz value straight into `modulationInput`
   would silently multiply the effective modulation index by the modulator's own frequency (e.g. an
   880 Hz modulator at max level would compute an "index" of `8 * 880 = 7040`, not `8`) — no crash, no
   NaN, just musically wrong, alias-like output. The router must divide the Hz result back by the same
   frequency it was multiplied by (`outputLevelToModulationDepthHz(level, freq) / freq`), which
   algebraically collapses to the underlying dimensionless index — see Common Pitfall 1 and Code
   Example 2.
2. **At least one algorithm's feedback operator also receives modulation from other operators in the
   same render step.** A byte-for-byte scan of `algorithms.ts` this session found Algorithm 15's
   feedback operator (operator 2) has *two* incoming edges (`{from:5,to:2}`, `{from:4,to:2}`) in
   addition to its own self-loop (`{from:2,to:2}`) — so the feedback-capable render path must be able
   to add an externally-supplied (pre-summed) modulation buffer *and* a live one-sample-delayed
   self-term in the same call, not just one or the other. See Common Pitfall 2 and Code Example 1.
3. **`SynthEngine`'s interface has no method for ratio/detune/mode/fixed-frequency changes at all** —
   only `setAlgorithm`, `updateOperatorLevel`, `setFeedback` (`synth-engine.ts`, read this session).
   D-15's pitch reuse cannot be wired through the interface alone. `WebAudioSynthEngine` never uses
   the interface methods for the bulk of parameter propagation either — it reads the **entire**
   `InstrumentState.operators()` signal (all 6 operators' full `OperatorParameters`) inside a
   constructor `effect()` and pushes the whole snapshot into the graph. `WorkletSynthEngine` currently
   has **zero** `InstrumentState` dependency (confirmed by reading its imports/constructor this
   session) — this phase must add the same `effect()` wiring, or D-15/D-16 cannot reach the worklet at
   all for anything but level. See Architecture Pattern 4 and Common Pitfall 3.
4. **No UI code calls `SYNTH_ENGINE.setAlgorithm`/`updateOperatorLevel`/`setFeedback` directly** — a
   grep across `src/app/features` this session found only `InstrumentState.setAlgorithm`/`setFeedback`
   calls (`lesson-detail.ts`); the interface methods exist for shape-completeness and tests, but the
   real UI-to-audio path is exclusively the reactive `effect()`. This confirms fact 3 is not an edge
   case — it is the only path that matters for this phase's D-01 cutover to preserve existing UX.

**Primary recommendation:** Add a new pure module (Claude's Discretion on the exact name —
`src/app/domain/dx7/dsp/graph-router.ts` fits the existing `dsp/` convention) holding six persistent
`PhaseModulatedOperator` instances plus one new feedback-capable render path, driven by a routing
config translated from `AlgorithmDefinition` via the *already-tested* `planConnections`/
`deriveCarriers`/`getFeedbackOperator` functions (never re-derived). Extend `worklet-messages.ts` with
two new messages — a routing-config message (D-14) and an operator-parameters message (needed for
D-15/D-16, not separately named in CONTEXT.md but structurally required per fact 3 above) — both
following `parseWorkletMessage`'s narrow-and-reject-`null` convention. Give `WorkletSynthEngine` the
same constructor `effect()` shape `WebAudioSynthEngine` already has, translating the full
`InstrumentState` snapshot into these compact messages. Write a genuinely independent, recursive
reference evaluator (re-deriving carrier/feedback/modulation-input logic from `algorithm.edges`
itself, not calling the router's own logic) for D-10, and cross-check all 32 rows plus a dedicated
"bounded and finite at max feedback" sweep for D-11.

## Architectural Responsibility Map

This app is a fully static SPA with no server tier. Every capability below lives in the browser,
split across the same two non-shared-memory realms Phase 7 established (main thread vs.
`AudioWorkletGlobalScope`), plus the Vitest/Node build-time tier for the pure-kernel proof.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Graph-to-kernel routing translation (`AlgorithmDefinition` → connections/carriers/feedback op) | Browser/Client — Main thread (Angular, reads `InstrumentState`) | Build/CI (Vitest exercises the same translation via `planConnections`/`deriveCarriers`, already proven) | Translation must happen on the main thread per D-14 — the worklet only ever consumes an already-translated shape, never re-derives it |
| Six-operator routed + feedback-capable render loop | Browser/Client — Audio render thread (`AudioWorkletGlobalScope`) | Build/CI (Node via Vitest — the same module runs identically in both, D-05's precedent) | Must be pure enough to run in both realms with zero browser globals, exactly like Phase 7's kernel |
| Hard `[-1,1]` per-sample safety clamp (D-08) | Browser/Client — Audio render thread (inside the graph router, applied to the final summed carrier output) | Build/CI (asserted by D-11's bounded-and-finite tests) | Must live inside the pure kernel/router, not only in the main-thread `MASTER_GAIN` gain node — Vitest's D-11 proof never touches Web Audio at all, so nothing downstream of the kernel can be relied on to bound it |
| `SynthEngine`-shaped live worklet wrapper (`WorkletSynthEngine`) | Browser/Client — Main thread (Angular DI) | — | Owns the `AudioWorkletNode`, the new `InstrumentState`-reactive `effect()`, and message translation |
| Independent reference evaluator (D-10) | Build/CI — Node via Vitest | — | Runs only in the test suite; never imported by the kernel, the router, or the worklet adapter |
| Dev-only listening harness re-use (D-06/D-07/D-12 blocking checkpoint) | Browser/Client — Main thread (dev tooling) | — | Extends Phase 7's existing harness (`worklets/harness/`) with algorithm-select + feedback controls |
| `SYNTH_ENGINE` DI cutover (D-01) | Browser/Client — Main thread (Angular DI) | — | One-line factory change in `synth-engine.token.ts`; UI/Playground/lessons never import a concrete engine class directly |

## Standard Stack

### Core
No new runtime or build-time dependencies are needed this phase — every capability is built on
infrastructure already installed and proven working by Phases 2, 3, 5, and 7.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@angular/core` et al. | `^22.1.0` [VERIFIED: package.json read this session] | `effect()`/signal facade wiring for `WorkletSynthEngine` | Already the project's framework; no version change needed |
| Vitest | `^4.0.8` [VERIFIED: package.json read this session] | Runs the graph-router unit tests, the D-10 per-algorithm cross-check, and the D-11 bounded-output sweep | Already the mandatory test runner; the new tests are plain Vitest globals, matching `operator.spec.ts`'s existing convention |
| `esbuild` | `^0.28.2` [VERIFIED: package.json read this session] | Re-bundles `worklets/dx7-worklet-processor.ts` after this phase's edits (existing `scripts/build-worklet.mjs` prebuild step, unchanged) | Already wired in Phase 7; the worklet adapter file grows (new message handling, new render call) but the build pipeline itself needs no change |
| TypeScript | `~6.0.2` [VERIFIED: package.json read this session] | Typechecks both the app (`tsconfig.app.json`) and the worklet (`tsconfig.worklet.json`) | Unchanged from Phase 7 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none)* | — | — | The graph router, the feedback-capable operator extension, the reference evaluator, and the new worklet messages are all plain TypeScript/`Math.sin` — no math or graph-traversal library is warranted for a fixed 6-node graph with a known "higher-modulates-lower" ordering |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A hand-derived "descending operator id" render order (Claude's Discretion item, confirmed safe by the dataset's own invariant) | A general topological-sort library/algorithm over the edge list | Unneeded complexity — `validate-algorithm.ts`'s already-enforced rule (every non-self-loop edge has `from > to`) makes the graph's only valid topological order a simple `6,5,4,3,2,1` descent; a general toposort adds a dependency and an allocation-heavy algorithm for a problem this dataset has already structurally solved (see Architecture Pattern 1) |
| A hard `[-1,1]` clamp (D-08, locked) | A soft-clip/`tanh`-style saturator | Explicitly rejected by D-07/D-08 — softening the clip would tame exactly the "authentically harsh" character the phase wants to teach |
| Reusing `outputLevelToModulationDepthHz`/`feedbackLevelToDepthHz` and dividing by frequency to recover the index (recommended, satisfies D-15/D-16's literal wording) | Writing new, separate "index-only" conversion functions in `value-conversion.ts` that skip the Hz round-trip | The division approach is mathematically identical (the frequency term cancels exactly — verified by expanding both functions' bodies this session) and satisfies D-15/D-16's literal instruction to reuse the *named* functions; a new function would duplicate the DX7-scale curve logic CLAUDE.md's domain rules discourage duplicating |

**Installation:** None — no new packages this phase.

## Package Legitimacy Audit

No new external packages are introduced by this phase. Every module used (Vitest, esbuild, Angular,
`@types/audioworklet`) was already installed and legitimacy-audited in Phase 7's `07-RESEARCH.md`
(all verdicts `OK`, one `esbuild` false-positive `SUS` already resolved and approved). This section
is included per the write-contract's completeness requirement but has nothing new to audit.

**Packages removed due to [SLOP] verdict:** none — no new packages.
**Packages flagged as suspicious [SUS]:** none — no new packages.

## Architecture Patterns

### System Architecture Diagram

```text
Main thread (Angular)                          Audio render thread (AudioWorkletGlobalScope)
──────────────────────                         ──────────────────────────────────────────────
InstrumentState (signals: algorithm, operators, feedback)
        │
        │ constructor effect() in WorkletSynthEngine
        │ (NEW this phase — mirrors WebAudioSynthEngine's
        │  existing applyRouting()-driving effect exactly)
        ▼
  lastAppliedAlgorithm / lastAppliedOperators / lastAppliedFeedback
        │ post only the message kind for each changed signal
        ▼
  translate AlgorithmDefinition → routing config      │
    connections = planConnections(algorithm)          │
    carriers    = deriveCarriers(algorithm)            │
  translate OperatorParameterSet → per-operator params │
    (ratio/detune/mode/fixedFrequencyHz/outputLevel/    │
     enabled — ALL SIX, since the interface has no      │
     narrower setter for ratio/detune/mode)              │
        │                                                │
        ▼                                                │
  node.port.postMessage(setAlgorithmMessage(...))  ──────┼──▶ parseWorkletMessage(data)
  node.port.postMessage(setOperatorParametersMessage(...)) ──▶  (never throws, rejects malformed
  node.port.postMessage(setFeedbackMessage(level))  ──────┤    shapes by returning null — extends
        │  (each postMessage only when that signal changed) │    the existing setFrequency/setMode
        ▼                                                │    choke point, D-14)
  noteOn(note, velocity)                                 │
    postMessage(setNoteFrequencyMessage(fundamentalHz)) ─┘        │
                                                                    ▼
                                                    processor rebuilds its routing table:
                                                      operatorParams[1..6] cached
                                                      connections[] cached
                                                      carriers[] cached
                                                      feedbackOperatorId cached (or null)
                                                                    │
                                                                    ▼ every 128-sample render quantum
                                                    process(inputs, outputs):
                                                      for each operatorId, recompute
                                                        frequencyHz = operatorFrequencyHz(
                                                          operatorParams[operatorId], noteFrequencyHz)
                                                        operator[operatorId].setFrequencyHz(frequencyHz)
                                                      for operatorId in DESCENDING order (6..1):
                                                        build modulation scratch buffer from
                                                          already-rendered higher operators'
                                                          outputs × their index (Pitfall 1's fix)
                                                        if operatorId === feedbackOperatorId:
                                                          renderWithFeedback(...) — one-sample delay
                                                        else:
                                                          render(scratch, modulationBuffer)
                                                      sum carrier scratch buffers × outputLevelToAmplitude
                                                      clamp per-sample to [-1, 1]  (D-08)
                                                      write into outputs[0][0]
                                                                    │
                                                                    ▼
                                                          AudioWorkletNode → destination → speakers
                                                          (D-02/D-12: blocking human-listening checkpoint)

── separately, never touching the render thread ──

Vitest (Node process, zero browser)
        │
        ▼ imports src/app/domain/dx7/dsp/graph-router.ts directly
        ▼ imports src/app/domain/dx7/dsp/reference-evaluator.ts directly (independently authored)
For each of the 32 ALGORITHMS rows:
  render N samples via graph-router
  render N samples via reference-evaluator (own recursion, own re-derived carrier/feedback logic)
  assert toBeCloseTo per sample within tolerance (D-10)
  assert every sample is finite and within [-1,1] at feedback=7 (D-11), for ALL 32, not just
    the ones whose reviewStatus/edges declare a "visually interesting" feedback loop — this
    dataset's own algorithms.ts happens to give every single row a feedback self-loop (confirmed
    this session: 32 `id:` declarations, 32 "feedback self-loop, D-01" comments), so D-11's
    "not just declared feedback" framing is a defensive design principle to keep, even though in
    this specific dataset all 32 rows already qualify
```

### Recommended Project Structure

```text
src/app/domain/dx7/dsp/
├── operator.ts                    # EXTEND: add a feedback-capable render path (Pattern 2) —
│                                   # keep the existing render(output, modulationInput?) signature
│                                   # untouched for the non-feedback case (Pitfall-free for callers
│                                   # already depending on it, e.g. additive-fixture.ts)
├── operator.spec.ts                # EXTEND: new tests for the feedback render path
├── graph-router.ts                 # NEW: six persistent PhaseModulatedOperator instances, a routing
│                                   # config setter, and a render(output) that walks descending
│                                   # operator ids, sums multi-source modulation into pre-allocated
│                                   # scratch buffers, sums carriers, clamps (D-08)
├── graph-router.spec.ts            # NEW: per-algorithm render tests, D-11's bounded/finite sweep
├── reference-evaluator.ts          # NEW: independently-authored, recursive per-sample evaluator —
│                                   # re-derives carrier/feedback/modulation logic from
│                                   # algorithm.edges itself, never calls graph-router's own code
├── reference-evaluator.spec.ts     # NEW: self-tests for the evaluator's own small fixtures
├── algorithm-routing.spec.ts       # NEW: the D-10 cross-check — all 32 ALGORITHMS rows,
│                                   # graph-router output vs. reference-evaluator output
└── worklet-messages.ts             # EXTEND: setAlgorithmMessage (D-14), setOperatorParametersMessage
                                    # (needed for D-15/D-16, see Summary fact 3),
                                    # setFeedbackMessage, setNoteFrequencyMessage (replaces/extends
                                    # the existing single-frequency setFrequency semantics)

worklets/
└── dx7-worklet-processor.ts        # EXTEND: hold cached operatorParams/connections/carriers/
                                    # feedbackOperatorId; construct one GraphRouter instead of the
                                    # single PhaseModulatedOperator + AdditiveOperatorBank pair;
                                    # process() calls router.render(channel) every quantum

src/app/core/audio/
├── worklet-synth-engine.ts         # EXTEND: add InstrumentState injection + constructor effect()
│                                   # mirroring WebAudioSynthEngine's applyRouting() shape; setAlgorithm/
│                                   # updateOperatorLevel/setFeedback become thin forward-then-reapply
│                                   # wrappers (matching WebAudioSynthEngine's own three-liners)
├── worklet-synth-engine.spec.ts    # EXTEND: assert the new messages are posted with correct payloads
└── synth-engine.token.ts           # EDIT: factory: () => inject(WorkletSynthEngine) — the D-01 cutover

worklets/harness/harness-main.ts    # EXTEND (D-06/D-07/D-12 precedent continuation): algorithm-select
                                    # control + feedback-depth control, so the blocking listening
                                    # checkpoint can sample one algorithm per taxonomy group plus max
                                    # feedback without a full Angular UI being wired up yet
```

### Pattern 1: Descending-id render order is the graph's only valid topological order — don't build a toposort
**What:** `validate-algorithm.ts` (read this session, lines 162-174) rejects any non-self-loop edge
where `edge.from <= edge.to`:
> `if (edge.from !== edge.to && edge.from <= edge.to) { throw new InvalidAlgorithmError(...violates the higher-modulates-lower rule) }`

Every edge in every one of the 32 `ALGORITHMS` rows therefore has `from > to` (modulator id strictly
greater than target id), except the one self-loop per algorithm (`from === to`). Rendering operators
in strict descending id order (6, 5, 4, 3, 2, 1) guarantees that by the time operator `T` is rendered,
every possible modulator of `T` (every operator `M` with an edge `M → T`, which by the invariant must
have `M > T`) has already been fully rendered for the block — its output samples are sitting in a
scratch buffer ready to be summed as `T`'s modulation input.
**When to use:** The graph router's per-block render loop — this is the entire "deterministic
evaluation order for DSP" `docs/ARCHITECTURE.md`'s "Algorithm graph model" section calls for.
**Example:**
```typescript
// src/app/domain/dx7/dsp/graph-router.ts (excerpt) — descending order is a plain array constant,
// not a computed sort, since it is fixed for every algorithm (Pattern derived from
// validate-algorithm.ts's proven invariant, not assumed).
import { OPERATOR_IDS, type OperatorId } from '../models/operator';

const DESCENDING_OPERATOR_IDS: readonly OperatorId[] = [...OPERATOR_IDS].reverse(); // [6,5,4,3,2,1]
```

### Pattern 2: Feedback-capable render path — combine externally-summed modulation with a live self-term
**What:** Algorithm 15 (confirmed this session by scripted scan of `algorithms.ts`) proves a feedback
operator can *also* have incoming edges from other operators in the same render call:
> `{ from: 6, to: 5 }, { from: 5, to: 2 }, { from: 4, to: 2 }, { from: 2, to: 1 }, { from: 2, to: 2 } // feedback self-loop, D-01`
> — operator 2 is fed by both operator 5 and operator 4, *and* has its own feedback self-loop, *and*
> itself feeds operator 1.

The existing `render(output, modulationInput?)` signature cannot express this alone: it takes one
*pre-built* `Float32Array` for modulation, but a feedback term at sample `i` depends on the operator's
**own** output at sample `i-1` — a value that does not exist yet when the modulation buffer would need
to be pre-built. The fix is a second render method (or an added optional parameter) that does the
per-sample interleaving itself, using a `previousSample` field the class already has everything needed
to hold (it already tracks `phase` as private instance state — this is the same category of state).
**When to use:** Exactly once per render block, for whichever single operator (`getFeedbackOperator(algorithm)`)
carries the self-loop — every other operator uses the existing `render()` unchanged.
**Example:**
```typescript
// src/app/domain/dx7/dsp/operator.ts — additive extension to PhaseModulatedOperator (existing
// render()/phase/sampleRate/frequencyHz fields are untouched; this is new state and one new method).
export class PhaseModulatedOperator {
  // ...existing fields (phase, sampleRate, frequencyHz)...

  /** The operator's own last-rendered sample, carried across render() calls — the "true one-sample
   * delay" D-06 calls for. Lives on this class, not a wrapper, so it can read `this.phase` directly
   * without duplicating the phase-accumulator math elsewhere (avoids a second, parallel
   * implementation of the same sin/phase logic CLAUDE.md's domain rules would flag as duplication). */
  private previousSample = 0;

  /** Resets both phase AND the feedback history — an algorithm switch that reassigns which operator
   * carries feedback must not leak a stale previousSample from a different topology into the new
   * one (see Common Pitfall 4). */
  resetPhase(): void {
    this.phase = 0;
    this.previousSample = 0;
  }

  /**
   * D-06/D-07/D-08: renders with a live one-sample-delayed self-feedback term, additively combined
   * with an optional externally-supplied modulation buffer (Algorithm 15's proof case) — never
   * allocates (CLAUDE.md), `feedbackIndex` is the already-dimensionless index (see Code Example 2),
   * not a raw Hz value.
   */
  renderWithFeedback(output: Float32Array, feedbackIndex: number, externalModulation?: Float32Array): void {
    const increment = this.frequencyHz / this.sampleRate;
    for (let i = 0; i < output.length; i++) {
      const external = externalModulation ? externalModulation[i] : 0;
      const safeExternal = Number.isFinite(external) ? external : 0;
      const modulation = safeExternal + feedbackIndex * this.previousSample;
      const sample = Math.sin(TWO_PI * this.phase + modulation);
      output[i] = sample;
      this.previousSample = sample; // becomes sample i-1's contribution to sample i+1
      this.phase = (this.phase + increment) % 1;
    }
  }
}
```

### Pattern 3: Multi-source modulation must be pre-summed into a scratch buffer before the target renders
**What:** Algorithm 15 also proves an operator can receive from more than one modulator
(`5→2` and `4→2`). Since `render()`/`renderWithFeedback()` each take a single combined modulation
buffer, the router must accumulate every incoming edge's scaled contribution into one pre-allocated
scratch `Float32Array` per target operator before calling that operator's render — mirroring
`AdditiveOperatorBank.render()`'s existing `output.fill(0)` + per-source accumulation shape (verified
this session), just keyed per-operator instead of into one final sum.
**When to use:** For every operator that has one or more incoming edges (every non-carrier-only leaf).
**Example:**
```typescript
// src/app/domain/dx7/dsp/graph-router.ts (excerpt) — six pre-allocated scratch buffers (one per
// operator's rendered block) plus one pre-allocated modulation-accumulator buffer, all built once
// in the constructor, never inside render().
class GraphRouter {
  private readonly operatorOutputs: Record<OperatorId, Float32Array>; // rendered block per operator
  private readonly modulationScratch: Float32Array; // reused for every target operator in sequence

  render(output: Float32Array): void {
    for (const operatorId of DESCENDING_OPERATOR_IDS) {
      this.modulationScratch.fill(0);
      for (const connection of this.connections) {
        if (connection.to !== operatorId || connection.isFeedback) continue;
        const sourceOutput = this.operatorOutputs[connection.from];
        const index = this.modulationIndexFor(connection.from); // Code Example 2
        for (let i = 0; i < this.modulationScratch.length; i++) {
          this.modulationScratch[i] += sourceOutput[i] * index;
        }
      }

      const targetOutput = this.operatorOutputs[operatorId];
      if (operatorId === this.feedbackOperatorId) {
        this.operators[operatorId].renderWithFeedback(targetOutput, this.feedbackIndex, this.modulationScratch);
      } else {
        this.operators[operatorId].render(targetOutput, this.modulationScratch);
      }
    }

    output.fill(0);
    for (const carrierId of this.carriers) {
      const amplitude = this.carrierAmplitudeFor(carrierId); // outputLevelToAmplitude × enabledMultiplier
      const carrierOutput = this.operatorOutputs[carrierId];
      for (let i = 0; i < output.length; i++) {
        output[i] += carrierOutput[i] * amplitude;
      }
    }
    for (let i = 0; i < output.length; i++) {
      output[i] = Math.min(1, Math.max(-1, output[i])); // D-08: hard clamp, applied here so it
    }                                                    // covers EVERY algorithm's carrier-sum
  }                                                       // overflow, not only feedback overflow
}
```

### Pattern 4: `WorkletSynthEngine` needs the same `InstrumentState`-reactive `effect()` `WebAudioSynthEngine` already has
**What:** `synth-engine.ts`'s `SynthEngine` interface (read this session) has no method for
ratio/detune/mode/fixed-frequency at all — only `setAlgorithm`, `updateOperatorLevel`, `setFeedback`.
`WebAudioSynthEngine` never relies on those narrow methods for the bulk of parameter propagation
either: its constructor `effect()` reads the *entire* `operators()` signal and pushes the whole
snapshot into the graph on every change (verified by reading `web-audio-synth-engine.ts` this
session). A grep across `src/app/features` this session found zero call sites for
`SYNTH_ENGINE.setAlgorithm`/`updateOperatorLevel`/`setFeedback` — every UI write goes through
`InstrumentState.setAlgorithm`/`setFeedback`/`updateOperator` directly (`lesson-detail.ts`), relying
entirely on the engine's own reactive subscription to notice and apply it. `WorkletSynthEngine` today
has zero `InstrumentState` dependency.
**When to use:** This phase, unconditionally — without this, D-15/D-16's pitch/level reuse (and D-13's
live re-patch) has no trigger mechanism on the worklet engine at all.
**Example:**
```typescript
// src/app/core/audio/worklet-synth-engine.ts (excerpt) — mirrors WebAudioSynthEngine's constructor
// effect() shape (same three signals, same "node === null → skip" guard). Each signal is
// tracked independently: only the message kind for a changed value is posted, and that
// signal's last-applied field is updated after the post. There is no all-or-nothing
// hasAppliedRoutingState / rememberAppliedRoutingState gate.
constructor() {
  this.destroyRef.onDestroy(() => this.destroy());
  effect(() => {
    this.applyInstrumentStateToWorklet();
  });
}

private applyInstrumentStateToWorklet(): void {
  const algorithm = this.instrumentState.algorithm();
  const operators = this.instrumentState.operators();
  const feedback = this.instrumentState.feedback();
  if (this.node === null) return;

  if (algorithm !== this.lastAppliedAlgorithm) {
    this.node.port.postMessage(
      setAlgorithmMessage(planConnections(algorithm), deriveCarriers(algorithm)),
    );
    this.lastAppliedAlgorithm = algorithm;
  }
  if (operators !== this.lastAppliedOperators) {
    this.node.port.postMessage(setOperatorParametersMessage(operators));
    this.lastAppliedOperators = operators;
  }
  if (feedback !== this.lastAppliedFeedback) {
    this.node.port.postMessage(setFeedbackMessage(feedback));
    this.lastAppliedFeedback = feedback;
  }
}
```

### Pattern 5: Independent reference evaluator — recursive, per-sample, structurally different from the router
**What:** D-10 requires a *second*, separately-authored phase-modulation implementation, not a thin
wrapper around the router's own code. A recursive-per-sample evaluator (rather than the router's
iterative descending-id/per-block approach) is a genuinely different code shape, reducing the chance
both implementations share the same subtle bug — and it is test-only code, so it does not need to
avoid recomputation/memoization the way the audio-thread kernel must (CLAUDE.md's "no allocation in
the render loop" rule targets the *audio render loop*, not a Vitest-only evaluator).
**When to use:** `algorithm-routing.spec.ts`'s cross-check of all 32 rows, and D-11's bounded/finite
sweep.
**Example:**
```typescript
// src/app/domain/dx7/dsp/reference-evaluator.ts — deliberately re-derives carrier/feedback/edge
// logic from algorithm.edges directly (not by calling derive-role.ts's already-proven functions
// for the SAME reason Phase 2's derive-role.spec.ts already covers those in isolation — this
// module's job is to catch a bug in graph-router.ts's OWN translation, not to re-prove Phase 2).
export function evaluateAlgorithmReference(
  algorithm: AlgorithmDefinition,
  sampleRate: number,
  blockSize: number,
  operatorFrequenciesHz: Readonly<Record<OperatorId, number>>,
  modulationIndices: Readonly<Record<OperatorId, number>>, // one per operator, dimensionless
  feedbackIndex: number,
): Float32Array {
  const feedbackHistory: Record<OperatorId, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const isCarrier = (id: OperatorId) =>
    !algorithm.edges.some((e) => e.from === id && e.to !== id);
  const modulatorsOf = (id: OperatorId) =>
    algorithm.edges.filter((e) => e.to === id && e.from !== id).map((e) => e.from);
  const hasSelfLoop = (id: OperatorId) => algorithm.edges.some((e) => e.from === id && e.to === id);

  function sampleAt(id: OperatorId, sampleIndex: number): number {
    const phase = ((operatorFrequenciesHz[id] * sampleIndex) / sampleRate) % 1;
    let modulation = 0;
    for (const modulatorId of modulatorsOf(id)) {
      modulation += sampleAt(modulatorId, sampleIndex) * modulationIndices[modulatorId];
    }
    if (hasSelfLoop(id)) {
      modulation += feedbackIndex * feedbackHistory[id];
    }
    const value = Math.sin(2 * Math.PI * phase + modulation);
    if (hasSelfLoop(id)) feedbackHistory[id] = value;
    return value;
  }

  const output = new Float32Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    let sum = 0;
    for (const id of OPERATOR_IDS) {
      if (isCarrier(id)) sum += sampleAt(id, i) * outputLevelAmplitudes[id];
    }
    output[i] = Math.min(1, Math.max(-1, sum));
  }
  return output;
}
```
Note: this recursive form recomputes shared sub-modulator phases multiple times when an operator
feeds more than one target — acceptable for a test-only evaluator; a memoized/per-sample cache would
make it look structurally closer to the router's own iterative approach, which is *not* the point of
having two independent implementations.

### Anti-Patterns to Avoid
- **Feeding `outputLevelToModulationDepthHz(...)`'s raw Hz return value directly into
  `modulationInput`:** dimension mismatch — see Summary fact 1 and Common Pitfall 1. Always divide by
  the same frequency it was multiplied by first.
- **Re-deriving carrier/feedback/role logic inside the worklet processor instead of consuming the
  main-thread-translated message:** duplicates routing knowledge CLAUDE.md's domain rules forbid, and
  contradicts D-14's explicit "translated from the canonical dataset on the main thread" framing.
- **Building the independent reference evaluator by calling `graph-router.ts`'s own functions "just to
  save time":** defeats the entire purpose of D-10 — a shared bug in the shared code would pass both
  checks.
- **Clamping only the feedback path, not the final carrier-summed output:** fails D-11 for any
  multi-carrier algorithm with zero feedback contribution to the overflow (e.g. six unity-level
  carriers summing toward 6.0 with no feedback in play at all) — the clamp must sit at the router's
  final output stage (Pattern 3's example), matching D-08's literal "hard clamp" ceiling framing.
- **Letting a stale `previousSample`/routing-table survive an algorithm switch:** see Common
  Pitfall 4.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deciding which operator is a carrier, which has feedback, which edges exist | A second locally-derived rule inside the graph router or the worklet processor | `planConnections`/`deriveCarriers`/`getFeedbackOperator` (`derive-role.ts`/`patch-plan.ts`, already tested since Phase 2/5) | The single source of truth this phase's routing translation must read through, never re-derive (CLAUDE.md, D-14's canonical-refs) |
| Determining the render evaluation order for a routed algorithm | A general topological-sort algorithm/library | A fixed descending-id constant (`[6,5,4,3,2,1]`), justified by `validate-algorithm.ts`'s already-enforced "higher-modulates-lower" invariant | The invariant makes a general toposort strictly unnecessary — it is proven at data-validation time, not something the router needs to re-derive at runtime (Pattern 1) |
| Converting a DX7 output-level/feedback-level integer scale to a usable amplitude/index | New ad hoc curve math inside the router | `outputLevelToAmplitude`/`outputLevelToModulationDepthHz`/`feedbackLevelToDepthHz`/`operatorFrequencyHz` (`value-conversion.ts`, already pure and tested) | D-15/D-16/D-09 explicitly require reuse; a second copy of the squared-normalized curve would drift from the one used elsewhere |
| Validating an inbound worklet message shape | Manual `typeof`/property-presence checks scattered across the processor | Extend `parseWorkletMessage`'s existing single-choke-point pattern (never throws, rejects malformed shapes with `null`) | Matches the already-proven T-07-01 security posture; a second ad hoc validator anywhere else in the processor reopens the same gap Phase 7 closed |
| Proving output stays bounded and finite | A generic assertion library or a fuzzing framework | Deterministic per-sample `Number.isFinite`/range checks over the full 32×(feedback=7) sweep, following the exact pattern `operator.spec.ts`'s existing NaN/Infinity test already established | `docs/ACCEPTANCE_CRITERIA.md`'s "DSP tests render deterministic sample blocks and reject non-finite output" floor is already satisfied by this repo's existing test idiom — no new tooling needed |

**Key insight:** Every "don't hand-roll" item above is a case where Phase 2, 5, or 7 already built and
tested the exact primitive Phase 8 needs — the temptation in this phase specifically is to
re-implement carrier/feedback derivation *inside* the worklet realm (since it is a separate bundle,
it feels isolated), which is precisely the duplicated-routing-knowledge anti-pattern CLAUDE.md warns
against by name.

## Common Pitfalls

### Pitfall 1: Feeding a Hz-scaled "modulation depth" directly into a radians-scaled `modulationInput`
**What goes wrong:** `outputLevelToModulationDepthHz(outputLevel, modulatorFrequencyHz)` returns
`index * modulatorFrequencyHz` — a peak frequency deviation in Hz, the correct unit for
`WebAudioSynthEngine`'s `oscillator.frequency` `AudioParam`. `PhaseModulatedOperator.render()`
instead adds `modulationInput[i]` directly to the phase argument (radians). Using the Hz value
unmodified as `modulationInput` silently multiplies the effective modulation index by the modulator's
own frequency — at 880 Hz and max output level, the "index" fed into `Math.sin` becomes `8 * 880 =
7040` instead of `8`. `Math.sin` never throws or produces `NaN` for a large argument, so this bug
produces no crash and no failed finite/bounded check — only wrong, alias-like, effectively
uncontrollable-sounding output that would fail D-10's analytical-match test (if a correct reference
is compared) but could slip past a bounded-and-finite-only check (D-11).
**Why it happens:** D-15/D-16 instruct reuse of the *named* functions, and their names ("...DepthHz")
correctly describe what they compute for the engine they were originally built for (Phase 5's
oscillator-frequency-modulation approach) — but the unit does not match this kernel's phase-modulation
input without one more division step.
**How to avoid:** Always compute `index = outputLevelToModulationDepthHz(level, freq) / freq` (or,
equivalently and more directly, `MAX_MODULATION_INDEX * outputLevelToAmplitude(level)`, which is
algebraically the same value since the function's own body is `modulationIndex * frequencyHz`) before
using it as a scale factor multiplying a modulator's raw `[-1,1]` output sample. Same pattern for
`feedbackLevelToDepthHz(...) / operatorFrequencyHz`.
**Warning signs:** A D-10 analytical-match test fails specifically for modulators at higher pitches
while passing for modulators near a nominal ~1 Hz reference (because the bug's error scales with
frequency); a listening checkpoint reports "harsh noise on every algorithm regardless of feedback
depth," not just the feedback case.

### Pitfall 2: Assuming a feedback operator never also receives modulation from another operator
**What goes wrong:** A design that treats "the feedback operator" and "operators with incoming edges"
as mutually exclusive cases (e.g. `if (hasFeedback) render self-only; else render with incoming
modulation`) breaks on Algorithm 15, where operator 2 has *both* — confirmed this session by a
scripted scan of `algorithms.ts` finding exactly one such row (`{from:5,to:2}`, `{from:4,to:2}`,
`{from:2,to:2}`).
**Why it happens:** Most feedback operators in this dataset (grep-confirmed: 31 of 32 rows) sit at the
"top" of a modulation stack (often operator 6, with no possible higher-numbered modulator), making the
combined case rare enough to miss during design if only a few example algorithms are hand-traced.
**How to avoid:** Design the feedback-capable render path (Pattern 2) to always accept an optional
externally-supplied modulation buffer *in addition to* its own feedback term, from the start — never
special-case "feedback operators have no incoming edges."
**Warning signs:** D-10's cross-check specifically fails on Algorithm 15 while passing on every other
row; a code review finds an `if/else` branching on "is this the feedback operator" that skips reading
incoming connections for that branch.

### Pitfall 3: Wiring D-15/D-16 through the `SynthEngine` interface's narrow methods instead of the `InstrumentState` effect
**What goes wrong:** Implementing `updateOperatorLevel(operatorId, level)` as a real, working
implementation (satisfying D-16 in isolation) is not sufficient — `synth-engine.ts`'s interface has no
method at all for `ratio`/`detune`/`mode`/`fixedFrequencyHz` (D-15's pitch reuse), and no UI code calls
the interface's `setAlgorithm`/`updateOperatorLevel`/`setFeedback` methods directly anyway (confirmed
by grep this session — only `InstrumentState`'s own methods are called from feature components). A
plan that only touches the three interface methods leaves pitch changes, and any parameter change made
through the operator-editor UI, silently unreachable on the worklet engine.
**Why it happens:** The interface *looks* like the natural place to wire D-15/D-16 because its method
names match the decisions' wording ("`updateOperatorLevel` becomes a real implementation") — but
`WebAudioSynthEngine`'s own precedent (its constructor `effect()`) already establishes that the
interface methods are secondary conveniences, not the primary state-propagation path.
**How to avoid:** Add the same `InstrumentState`-reactive `effect()` `WebAudioSynthEngine` has to
`WorkletSynthEngine` (Pattern 4) — this is the mechanism that actually reaches ratio/detune/mode, not
just level.
**Warning signs:** A D-03 Lesson 6 regression check (which relies on the try-this flow moving an
operator's *level* per `06-CONTEXT.md` D-02/D-06) might still pass even with this gap (level has an
interface method), masking the missing pitch/mode wiring — verify the checkpoint also exercises an
algorithm switch and a ratio/mode change, not only level.

### Pitfall 4: Stale feedback/routing state leaking across an algorithm switch
**What goes wrong:** If `previousSample` (Pattern 2) or the router's cached `connections`/`carriers`/
`feedbackOperatorId` are not reset/reassigned atomically when a new `setAlgorithm` message arrives
mid-note, the newly-selected algorithm's feedback operator (which may be a *different* operator id
than the previous algorithm's) could read a leftover `previousSample` value from whichever operator
instance previously held that role — a one-sample "pop" or, worse, a persistent offset that never
self-corrects since the feedback term keeps referencing its own (now-wrong-context) history.
**Why it happens:** `PhaseModulatedOperator` instances are persistent (never recreated per algorithm
switch, matching `WebAudioSynthEngine`'s "oscillators built once" precedent) — so their `previousSample`
field naturally survives a routing change unless explicitly cleared.
**How to avoid:** On receiving a `setAlgorithm` message, explicitly reset every operator's
`previousSample` to 0 (calling `resetPhase()` on all six, or a narrower feedback-only reset) as part of
rebuilding the routing table — mirroring `WebAudioSynthEngine.applyRouting`'s "disconnect first, then
rebuild" discipline, just for kernel-internal state instead of Web Audio nodes.
**Warning signs:** An audible click/pop specifically on algorithm switch (distinct from D-13's expected
re-patch transition), reproducible only when switching *between* two algorithms whose feedback
operator ids differ (e.g. Algorithm 1 → Algorithm 2, feedback moves from operator 6 to operator 2 per
the dataset's own row-2 comment: "feedback relocated to the tower's modulator (operator 2)").

### Pitfall 5: Treating the D-14 routing message and the D-15/D-16 parameter message as one combined payload
**What goes wrong:** Algorithm switches (rare, user-driven) and operator parameter edits (potentially
frequent, e.g. a slider drag) have very different natural update cadences. Combining routing config
and all six operators' full parameters into a single oversized message sent on every change of either
means every slider-drag tick re-sends the entire routing graph, and vice versa — unnecessary payload
churn against `docs/ARCHITECTURE.md`'s "avoid per-frame object churn" guidance (even though this is
main-thread-to-worklet messaging, not the render loop itself, keeping payloads minimal and
purpose-scoped is still the documented intent).
**Why it happens:** It can look simpler to send "the whole state" every time rather than reasoning
about which signal changed.
**How to avoid:** Keep the messages separate (Pattern 4's example already does this) — `setAlgorithm`
only on algorithm change, `setOperatorParameters` only on operator-set change, `setFeedback` only on
feedback change — using independent `lastAppliedAlgorithm` / `lastAppliedOperators` /
`lastAppliedFeedback` checks (Pattern 4), just gating three `postMessage` calls instead of one.
**Warning signs:** A spec asserting posted messages finds a `setAlgorithm` message re-sent every time
an unrelated operator level changes.

## Code Examples

### The Hz-to-index unit conversion, derived and verified this session
```typescript
// value-conversion.ts (already exists, read verbatim this session):
//   outputLevelToModulationDepthHz(outputLevel, modulatorFrequencyHz):
//     modulationIndex = MAX_MODULATION_INDEX * outputLevelToAmplitude(outputLevel)
//     return modulationIndex * modulatorFrequencyHz
//
// Therefore, for the phase-modulation kernel's `modulationInput` (radians, not Hz):
const index =
  outputLevelToModulationDepthHz(sourceParameters.outputLevel, sourceFrequencyHz) / sourceFrequencyHz;
// index === MAX_MODULATION_INDEX * outputLevelToAmplitude(sourceParameters.outputLevel) — the
// frequency term cancels exactly; both expressions are equivalent, but computing it via the
// division satisfies D-15/D-16's literal "reuses outputLevelToModulationDepthHz" instruction.
```

### New worklet messages (extends `worklet-messages.ts`'s existing `parseWorkletMessage` choke point)
```typescript
// src/app/domain/dx7/dsp/worklet-messages.ts — additions, following the exact narrow-and-reject-null
// convention the existing setFrequency/setMode cases already use.
export interface SetAlgorithmMessage {
  readonly kind: 'setAlgorithm';
  readonly connections: readonly { from: OperatorId; to: OperatorId; isFeedback: boolean }[];
  readonly carriers: readonly OperatorId[];
}

export interface OperatorParametersPayload {
  readonly mode: 'ratio' | 'fixed';
  readonly ratio: number;
  readonly fixedFrequencyHz: number;
  readonly detune: number;
  readonly outputLevel: number;
  readonly envelopeLevel: number;
  readonly enabled: boolean;
}

export interface SetOperatorParametersMessage {
  readonly kind: 'setOperatorParameters';
  readonly operators: Readonly<Record<OperatorId, OperatorParametersPayload>>;
}

export interface SetFeedbackMessage {
  readonly kind: 'setFeedback';
  readonly level: number; // 0-7, validated by validateFeedbackLevel on the main thread before send
}
```
`parseWorkletMessage` gains one `if (kind === '...')` branch per new message, each validating every
field with the same runtime-check-only discipline the existing `setFrequency`/`setMode` branches use
(no type assertion that skips a check; malformed shapes return `null`, never throw). Structural
routing validation for `setAlgorithm` must reject (return `null`): out-of-order non-feedback edges
that violate higher-modulates-lower, inconsistent self-loops (`isFeedback` vs `from === to`), and
duplicate carriers or carriers paired with a null/illegal feedback-operator inconsistency.

### D-10/D-11 test shape (mirrors `operator.spec.ts`'s existing analytical-reference convention)
```typescript
// src/app/domain/dx7/dsp/algorithm-routing.spec.ts
import { ALGORITHMS } from '../models/algorithms';

describe.each(ALGORITHMS)('Algorithm $id ($name)', (algorithm) => {
  it('matches the independent reference evaluator within tolerance', () => {
    const routerOutput = renderViaGraphRouter(algorithm, /* fixture params */);
    const referenceOutput = evaluateAlgorithmReference(algorithm, /* same fixture params */);
    for (let i = 0; i < routerOutput.length; i++) {
      expect(routerOutput[i]).toBeCloseTo(referenceOutput[i], 6); // Phase 7 D-05 precedent tolerance
    }
  });

  it('stays finite and within [-1,1] at maximum feedback depth (7), even without a declared feedback role', () => {
    const output = renderViaGraphRouter(algorithm, { feedbackLevel: 7, allOperatorsAtMaxOutputLevel: true });
    for (const sample of output) {
      expect(Number.isFinite(sample)).toBe(true);
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `WebAudioSynthEngine`'s 128-sample `DelayNode` feedback workaround (Web Audio's zero-delay-cycle restriction) | This kernel's true one-sample delay (D-06) | This phase | The pure kernel has no Web-Audio-graph restriction to work around — a genuinely tighter, more accurate feedback model than Phase 5's engine, at the cost of no longer being directly comparable sample-for-sample to `WebAudioSynthEngine`'s output (expected and accepted, per D-06's "costly to reverse" framing) |
| Real DX7 hardware's feedback "anti-hunting" averaging of the previous two samples (a light low-pass on the self-feedback path) `[CITED: righto.com/2021/12/yamaha-dx7-chip-reverse-engineering.html — reverse-engineering analysis, cross-corroborated by community DSP-forum discussion this session]` | A straight, un-averaged one-sample delay (D-06, as decided) | This phase | The real hardware's averaging exists specifically to tame wild self-oscillation; omitting it (as D-06/D-07 deliberately choose) means this kernel's feedback will self-oscillate *more* aggressively than real DX7 hardware at high depth — consistent with, and likely part of the reason for, D-07's explicit "authentically harsh... not tamed" framing, and exactly why D-08's hard clamp is load-bearing (there is no averaging/low-pass doing any of that safety work here) |

**Deprecated/outdated:** None — this phase extends rather than replaces Phase 7's kernel primitive and
Phase 5's conversion functions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 6-decimal-place tolerance (`toBeCloseTo(x, 6)`), matching Phase 7's D-05 precedent, remains appropriate for D-10's deeper modulation chains (up to Algorithm 7's 5-operator stack) despite additional floating-point operations per sample | Code Examples; Validation Architecture | Low-medium — if actual floating-point drift across a 5-deep chain exceeds this tolerance, the planner should loosen to 5 decimal places rather than treat it as a correctness bug; both values are well above IEEE-754 double precision's noise floor for these magnitudes |
| A2 | The hard `[-1,1]` clamp (D-08) should be applied at the graph router's final carrier-summed output stage, not per-operator or only on the feedback path | Architecture Patterns (Pattern 3), Anti-Patterns | Medium — this is a reasoned architectural recommendation (needed for D-11's bounded-proof to hold for non-feedback multi-carrier algorithms) rather than something D-08's text states explicitly; if the planner places the clamp elsewhere, re-verify D-11 still holds for a worst-case multi-carrier, zero-feedback algorithm |
| A3 | A new `setOperatorParameters` worklet message (carrying all six operators' full `OperatorParameters`) is structurally required in addition to D-14's routing message, since `SynthEngine`'s interface has no ratio/detune/mode setter | Summary fact 3; Architecture Patterns (Pattern 4) | Low — directly derived from reading `synth-engine.ts`'s interface and `web-audio-synth-engine.ts`'s existing effect() this session, not speculative; if the planner finds an alternative path (e.g. widening the interface instead), the underlying need (getting ratio/detune/mode to the worklet) still must be solved somehow |
| A4 | The `previousSample` feedback-history field belongs directly on `PhaseModulatedOperator` (Pattern 2) rather than a separate wrapper class, per the D-06 discretion item | Architecture Patterns (Pattern 2) | Low — this is explicitly Claude's Discretion in CONTEXT.md; the alternative (a wrapper) would need access to the class's private `phase` field to interleave correctly, which either requires making `phase` non-private or duplicating the phase-accumulator math — both worse than extending the class directly |
| A5 | The real DX7's "anti-hunting" two-sample-averaging detail (State of the Art table) is accurately characterized from a WebSearch-sourced reverse-engineering blog post, not independently reproduced against real DX7 hardware or its ROM disassembly this session | State of the Art | Low — this is contextual/explanatory framing supporting the already-locked D-06/D-07 decisions, not something this phase's implementation depends on being exactly right; even if the DX7's real behavior differs in detail, D-06 already deliberately chooses NOT to replicate it |

**If this table is empty:** N/A — see rows above.

## Open Questions (RESOLVED)

1. **(RESOLVED)** Does D-12's "plus feedback at maximum depth" sample a fifth, distinct algorithm, or re-test one
   of the four taxonomy-group samples at feedback level 7?
   - What we know: a scripted scan of `algorithms.ts` this session found **every one of the 32
     algorithms already declares a feedback self-loop** (32 `id:` rows, 32 matching "feedback
     self-loop, D-01" comments) — there is no "feedback-free" algorithm in this dataset to pick as a
     fifth distinct sample in the first place.
   - What's unclear: whether D-12's phrasing ("four algorithms plus the feedback case") intends a
     literal fifth checkpoint entry, or is written assuming (incorrectly, per this session's scan) that
     some algorithms lack feedback and a dedicated feedback-focused sample is needed as a result.
   - Recommendation: interpret D-12 as "the four taxonomy-group samples, with at least one of them
     additionally checked at feedback level 7" (e.g. re-play the same algorithm a second time with
     feedback maxed) rather than inventing a fifth algorithm selection — this satisfies the literal
     ROADMAP wording ("bounded and finite under feedback at maximum") without contradicting the
     verified dataset fact. Flag this interpretation explicitly in the plan's checkpoint instructions
     so the human verifier knows why there are 4 (not 5) distinct algorithms sampled.
   - **Resolution:** Adopted as recommended — `08-04-PLAN.md`'s `<flagged_assumptions>` block records
     this exact interpretation (4 taxonomy-group samples, one re-tested at feedback level 7) for the
     blocking listening checkpoint (D-02/D-12).

2. **(RESOLVED)** Should `setOperatorParameters` be sent as one message with all six operators, or six independent
   per-operator messages?
   - What we know: `InstrumentState.operators()` already returns the full `OperatorParameterSet` (all
     six) as one signal read; `WebAudioSynthEngine`'s effect() already treats it as one atomic unit.
   - What's unclear: whether per-operator granularity would let the worklet apply an update with less
     work when only one operator actually changed (skip re-sending five unchanged operators' data).
   - Recommendation: send the whole `OperatorParameterSet` as one message (matches the
     `InstrumentState` signal's own atomicity, and six operators' worth of plain numbers is a tiny
     payload — not a "per-frame churn" concern since this only fires on parameter edits, not per
     render quantum) unless the plan surfaces a concrete performance reason to fragment it.
   - **Resolution:** Adopted as recommended — `08-01-PLAN.md` Task 1 step 5 sends
     `setOperatorParameters` as a single message carrying all six operators, matching
     `InstrumentState`'s own atomicity.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, `esbuild` prebuild script | ✓ | v22.22.3 (per Phase 7's verification, unchanged this session) | — |
| npm | Package management | ✓ | 11.8.0 (`package.json` `packageManager` field) | — |
| `esbuild` | Re-bundling the extended worklet adapter | ✓ | `^0.28.2` installed [VERIFIED: package.json read this session] | — |
| Real browser with `AudioWorklet` support | D-02/D-12 blocking human-listening checkpoint | ✗ — not available/verifiable in this headless research session | — | None needed as a fallback — inherently a human-in-a-real-browser step, same as Phase 7's D-06/D-07 precedent; schedule as a blocking manual task |
| `jsdom` | Vitest's default DOM environment for other specs | ✓ | `^28.0.0` | N/A for the graph-router/reference-evaluator tests — pure Node, no DOM needed |

**Missing dependencies with no fallback:**
- A real browser for the D-02/D-12 checkpoint — expected and by design, matching Phase 7's precedent.

**Missing dependencies with fallback:**
- None — everything else needed this phase is already installed.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.8`, run through Angular 22's `@angular/build:unit-test` builder |
| Config file | none — no `vitest.config.ts`; the builder derives config from `angular.json`/`tsconfig.spec.json` (unchanged from Phase 7) |
| Quick run command | `npm test` (runs once and exits outside a TTY — documented Phase 1 finding; `npm test -- --run` is not a real flag this builder proxies) |
| Full suite command | `npm test` (same command — no separate quick/full split established in this project) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGINE-02 | Feedback-capable render path combines external modulation + one-sample self-delay correctly (Algorithm 15's proof case) | unit | `npm test` (covers `operator.spec.ts`'s new feedback-render tests) | ❌ Wave 0 — extends existing file |
| ENGINE-02 | Descending-id render order correctly resolves every algorithm's modulation dependencies | unit | `npm test` (covers `graph-router.spec.ts`) | ❌ Wave 0 — new file |
| ENGINE-02 | All 32 algorithms match an independent reference evaluator within tolerance (D-10) | unit | `npm test` (covers `algorithm-routing.spec.ts`) | ❌ Wave 0 — new file |
| ENGINE-02 | All 32 algorithms stay finite and within `[-1,1]` at feedback=7 (D-11) | unit | `npm test` (covers `algorithm-routing.spec.ts`, second `it` per row) | ❌ Wave 0 — same new file |
| ENGINE-02 | New worklet messages (`setAlgorithm`/`setOperatorParameters`/`setFeedback`) are validated and rejected-if-malformed per `parseWorkletMessage`'s choke point | unit | `npm test` (covers `worklet-messages.spec.ts` extension) | ❌ Wave 0 — extends existing file |
| ENGINE-02 | `WorkletSynthEngine` posts correct message payloads on `InstrumentState` changes, and stays a no-op when nothing changed | unit | `npm test` (covers `worklet-synth-engine.spec.ts` extension, fake `AudioWorkletNode`) | ❌ Wave 0 — extends existing file |
| ENGINE-02 | `SYNTH_ENGINE` resolves to `WorkletSynthEngine` (D-01 cutover) | unit | `npm test` (covers `synth-engine.token.spec.ts` if one exists, or an assertion inline in an existing spec) | ❌ Wave 0 — new/extended assertion |
| ENGINE-02 | Switching algorithms while a note is held re-patches audibly with no stuck note (D-13) | unit + manual | `npm test` (fake-boundary assertion the routing message was posted mid-note) + D-02/D-12 blocking checkpoint for the audible confirmation | ❌ Wave 0 — new test + manual step |
| ENGINE-02 | Lesson 6's Algorithm 1 try-this completion flow still works against `WorkletSynthEngine` (D-03) | manual, blocking | D-02/D-12 checkpoint explicitly includes this as a named step | N/A — inherently manual, by design |
| ENGINE-02 | Worklet loads/routes/sounds correctly for one algorithm per taxonomy group plus max feedback, in a real browser (D-12) | manual, blocking | Human uses the extended dev harness and listens; no automated command exists (jsdom has no `AudioWorkletGlobalScope`) | N/A — inherently manual, by design |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` green, `npm run build`, `npm run lint`, plus the D-02/D-12 blocking
  human-listening checkpoint approved, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/app/domain/dx7/dsp/operator.ts` + `.spec.ts` extension — feedback-capable render path
- [ ] `src/app/domain/dx7/dsp/graph-router.ts` + `.spec.ts` — new module, covers descending-id order
- [ ] `src/app/domain/dx7/dsp/reference-evaluator.ts` + `.spec.ts` — new module, D-10's independent proof
- [ ] `src/app/domain/dx7/dsp/algorithm-routing.spec.ts` — new file, the 32-row cross-check + D-11 sweep
- [ ] `src/app/domain/dx7/dsp/worklet-messages.ts` + `.spec.ts` extension — three new message kinds
- [ ] `src/app/core/audio/worklet-synth-engine.ts` + `.spec.ts` extension — `InstrumentState` effect wiring
- [ ] `src/app/core/audio/synth-engine.token.ts` — D-01's one-line factory cutover
- [ ] `worklets/dx7-worklet-processor.ts` — extend to hold the routing table + call `GraphRouter`
- [ ] `worklets/harness/harness-main.ts` — extend with algorithm-select + feedback controls for D-12
- [ ] Framework install: none — all tooling already present

## Security Domain

Unchanged from Phase 7's assessment: no backend, no authentication, no persistence, no
network-sourced user input at any layer this phase touches. The relevant surface remains the
`postMessage` boundary between the main thread and the audio-rendering thread — now carrying three
additional message kinds (routing config, operator parameters, feedback level), all authored by this
project's own code on both ends, not attacker-controlled, but still worth the same defensive
validation discipline Phase 7 established.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts or sessions anywhere in this app |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes (defensive, not attacker-facing) | Extend `parseWorkletMessage`'s existing narrow-and-reject-`null` pattern to the three new message kinds; validate every `OperatorId` key with `isOperatorId`, every numeric field with `Number.isFinite` + range checks (mirroring `isValidFrequencyHz`'s existing convention), before any value reaches the kernel's phase accumulator or feedback history |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malformed `setAlgorithm`/`setOperatorParameters`/`setFeedback` payload (e.g. an `operators` record missing an operator id, an out-of-range `feedbackLevel`, a non-finite `ratio`) reaches the kernel and produces `NaN`/`Infinity` propagating through the modulation chain, or a thrown exception that stops `process()` from ever being called again for that node | Denial of Service (audio-rendering thread) | Validate every field of every new message inside `parseWorkletMessage` before any kernel mutation, exactly as the existing `setFrequency`/`setMode` cases do; treat an invalid message as a no-op (the current routing/parameters stay in effect) rather than a partial apply or a throw |
| A routing-config message whose `connections`/`carriers` arrays reference an algorithm inconsistent with the kernel's expectations (e.g. a `to` operator id that never gets rendered because it isn't reachable in the descending-id sweep, or a `carriers` list with zero entries) silently produces silence or an incomplete graph | Tampering (self-inflicted, not attacker-originated — a translation bug on the main thread) | The main-thread translation is built exclusively from `planConnections`/`deriveCarriers`, which are called against an `AlgorithmDefinition` that has already passed `validateAlgorithm` (DOMAIN-02, guarantees at least one carrier and no impossible edges) — the worklet's own `parseWorkletMessage` validation is a second layer, not the only one |

## Sources

### Primary (HIGH confidence — verified this session by reading the file directly)
- `src/app/domain/dx7/dsp/operator.ts`, `.spec.ts` — `PhaseModulatedOperator`'s current shape, the
  phase-wrap/finite-modulation-input tests already in place
- `src/app/domain/dx7/dsp/additive-fixture.ts`, `.spec.ts` — the pre-allocated-scratch-buffer,
  ascending-accumulation pattern this phase's multi-source modulation summing mirrors
- `src/app/domain/dx7/dsp/worklet-messages.ts` — `parseWorkletMessage`'s exact narrow-and-reject-`null`
  convention the new messages must extend
- `src/app/domain/dx7/audio/patch-plan.ts` — `planConnections`/`OperatorConnection`
- `src/app/domain/dx7/models/derive-role.ts`, `validate-algorithm.ts` — `getFeedbackOperator`,
  `deriveCarriers`, `getOperatorRole`, `hasFeedbackLoop`, and the exact "higher-modulates-lower"
  invariant text (`edge.from !== edge.to && edge.from <= edge.to` throws)
- `src/app/domain/dx7/audio/value-conversion.ts` — `operatorFrequencyHz`,
  `outputLevelToAmplitude`/`outputLevelToModulationDepthHz`, `feedbackLevelToDepthHz` — read verbatim
  and algebraically expanded this session to derive the Hz-to-index conversion (Code Example 1,
  Common Pitfall 1)
- `src/app/domain/dx7/models/algorithms.ts` — read + scripted-scanned this session; confirmed
  Algorithm 15's dual-incoming-plus-feedback edge shape, and that all 32 rows declare a feedback
  self-loop
- `worklets/dx7-worklet-processor.ts`, `worklets/harness/harness-main.ts` — the existing adapter/
  harness shape this phase extends
- `src/app/core/audio/worklet-synth-engine.ts`, `web-audio-synth-engine.ts`, `synth-engine.ts`,
  `synth-engine.token.ts` — read this session; confirmed the interface's narrow method set, the
  `WebAudioSynthEngine` effect()-driven propagation pattern, and `WorkletSynthEngine`'s current
  zero-`InstrumentState`-dependency state
- `src/app/state/instrument-state.ts` — confirmed `algorithm`/`operators`/`feedback`/`carriers`/
  `feedbackOperator` signal shape and `setAlgorithm`/`updateOperator`/`setFeedback` method names
- `src/app/features/play-surface/play-surface.ts`, `features/learn/lesson-detail/lesson-detail.ts` —
  grepped/read this session to confirm no UI code calls `SYNTH_ENGINE`'s narrow interface methods
  directly
- `.planning/phases/07-audioworklet-dsp-foundation/07-RESEARCH.md` — D-05 tolerance precedent
  (`toBeCloseTo(x, 6)`), the DI/fake-boundary pattern this phase's new tests extend
- `package.json` — confirmed no new dependency is needed (`@angular/core ^22.1.0`, `vitest ^4.0.8`,
  `esbuild ^0.28.2`, `@types/audioworklet ^0.0.100`, `typescript ~6.0.2`)
- `docs/ARCHITECTURE.md` §"Algorithm graph model", §"Audio roadmap", §"Error handling";
  `docs/ACCEPTANCE_CRITERIA.md` §"Test evidence"; `CLAUDE.md` "Audio rules"/"Domain rules"

### Secondary (MEDIUM confidence — WebSearch, cross-corroborated across independent sources this session)
- WebSearch: FM/PM feedback-operator implementation with a one-sample delay — corroborated across a
  KVR Audio DSP forum thread, an arXiv paper on higher-order FM synthesis, and patent-filing summaries;
  confirms a single-sample feedback delay is a standard, legitimate implementation choice
- WebSearch: Yamaha DX7 chip reverse-engineering (righto.com) — the "anti-hunting"
  previous-two-samples-averaging detail used in State of the Art's comparison table; not independently
  reproduced against real hardware or ROM disassembly this session, flagged accordingly (Assumption A5)

### Tertiary (LOW confidence)
- None used as a basis for any recommendation in this document — every non-codebase claim above was
  either cross-corroborated (MEDIUM) or explicitly logged as an assumption.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every version confirmed directly from `package.json`
  this session
- Architecture: HIGH within the verified-codebase scope (the Hz/radians unit-conversion finding, the
  Algorithm 15 dual-incoming-plus-feedback fact, the interface-method-gap fact, and the
  no-UI-calls-the-interface fact are all directly derived from reading/scanning this session's actual
  source files, not inferred from CONTEXT.md's prose alone); MEDIUM on the exact file-layout/message-
  shape recommendations, which are genuinely Claude's Discretion per CONTEXT.md
- Pitfalls: HIGH — all five pitfalls are grounded in specific, quoted/verified source facts from this
  session, not generic DSP folklore

**Research date:** 2026-08-13
**Valid until:** 2026-09-12 (30 days — the underlying codebase facts this research depends on
[`value-conversion.ts`'s formulas, `algorithms.ts`'s edge data, the `SynthEngine` interface shape]
are all stable, already-shipped Phase 2/5 artifacts unlikely to change before this phase executes;
re-verify only if any of those files are touched by an intervening phase)
