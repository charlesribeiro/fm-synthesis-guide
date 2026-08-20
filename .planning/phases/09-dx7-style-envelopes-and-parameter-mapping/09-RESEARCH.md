# Phase 9: DX7-style envelopes and parameter mapping - Research

**Researched:** 2026-08-14
**Domain:** Per-operator envelope generator state machine (DX7-style 4-rate/4-level), non-linear rate curve mapping, worklet note-lifecycle messaging
**Confidence:** MEDIUM — architecture and codebase findings are VERIFIED/CITED from files read this session; the exact DX7 rate-curve numeric constants are informed-by-research approximations (ASSUMED), consistent with this project's established "documented approximation, not exact emulation" posture (CLAUDE.md).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Envelope generator architecture**
- **D-01:** The envelope generator is per-operator and kernel-integrated — each of the 6 operators
  gets its own independent EG inside the DSP kernel, scaling that operator's output before it feeds
  modulation/carrier summing, not a single voice-level envelope applied to the final routed output.
  — Reversibility: costly.
- **D-02:** The existing global click-prevention voice ramp (`WORKLET_ATTACK_SECONDS` linear ramp +
  `WORKLET_RELEASE_TIME_CONSTANT` exponential decay on `voiceGain`) is fully removed. The new
  per-operator EGs' own attack/release segments are the sole amplitude-shaping and click-safety
  mechanism going forward. — Reversibility: costly.
- **D-03:** Lesson 6's Algorithm 1 lesson gets an explicit regression check against the new
  envelope-driven engine — mirrors Phase 8's D-03 precedent.

**Rate/segment semantics**
- **D-04:** Envelope rates are DX7-authentic: a rate is speed-toward-the-current-segment's-target
  from wherever the envelope's level currently sits, never a fixed segment duration from a canonical
  starting point. A note released mid-attack (or retriggered mid-release) moves smoothly from its
  actual current level at the new segment's rate — no snap to a fixed starting value, no
  discontinuity introduced by any segment transition. This is also what makes the design click-safe
  by construction. — Reversibility: one-way.

**Parameter surface scope**
- **D-05:** No new Playground/operator-editor UI is built this phase. Envelope rate/level values are
  exercised through `InstrumentState`, lesson `try-this` data, and tests only.

**Default patch**
- **D-06:** `DEFAULT_OPERATOR_PARAMETERS`' new envelope field stays one identical shape across all 6
  operators on every algorithm — Phase 3's D-09 is honored, not revisited. Pedagogically-obvious
  differentiation (carriers sustained, modulators decaying faster) happens in Playground's
  initial/reset patch and each lesson's starting patch, not in the flat default.

### Claude's Discretion
- Exact TypeScript shape of the widened envelope field (field names/nesting for the 4 rate/4 level
  pairs).
- Exact rate (0-99) → time-per-unit-level curve mapping — informed by research, mirroring Phase 7
  D-05 and Phase 8 D-10's precedent.
- Whether envelope state lives inside `PhaseModulatedOperator` itself or a small companion/wrapper
  class — informed by CLAUDE.md's no-excessive-allocation rule and the existing `previousSample`
  instance-field pattern.
- Exact per-block vs. per-sample update granularity for envelope segment-position tracking.
- Exact numeric tolerance for envelope segment-transition and rate-curve tests.
- Exact new default rate/level values for Playground's initial patch and each lesson's starting
  patch to make D-06's carrier-sustains/modulator-decays differentiation audible.
- Whether the ratio/fixed-frequency regression coverage extends Phase 8's existing per-algorithm
  correctness suite or uses a new dedicated test file.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. A Playground/operator-editor UI for the new
rate/level values was raised and explicitly deferred per D-05 (not a new idea, already implicitly
scoped out). Role-aware default-patch envelope differentiation was raised and explicitly resolved
as out of scope per D-06.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGINE-03 | DX7-style four-rate/four-level envelopes and ratio/fixed frequency modes drive the DSP engine | See "Architecture Patterns" for the EG state-machine design, the note-lifecycle gate-message gap this phase must close, and the dual-table (carrier amplitude + modulation index) envelope scaling requirement. Ratio/fixed-frequency math is already live (Phase 8 D-15) — see "Don't Hand-Roll" and the Validation Architecture req-map for the regression-only test scope. |

</phase_requirements>

## Summary

This phase replaces a single external Web Audio `voiceGain` click-prevention ramp with six
independent, kernel-integrated DX7-style envelope generators (EGs) — one per operator — that scale
each operator's raw rendered block before it is summed to output or fed as a modulation source.
The core technical challenge is not the EG math itself (a small, well-understood 4-segment state
machine) but two architectural gaps this phase must close that are **not yet visible from
CONTEXT.md's text alone** and were only found by reading the current kernel and worklet-messaging
code:

1. **The worklet currently has no concept of note-on/note-off at all.** The only per-note message
   today is `setFrequency` (pitch). All note-lifecycle gating (attack/release timing) lives entirely
   outside the kernel, in `WorkletSynthEngine`'s Web Audio `voiceGain` node. D-02 removes that node.
   For a per-operator EG to know when to enter its attack segments or jump to its release segment,
   a new worklet message (a "gate"/note-on-off signal, optionally carrying velocity) must be added
   to `worklet-messages.ts` and consumed by `GraphRouter`. This is new production surface area this
   phase must design and build, not a refactor of something that already exists.

2. **`outputLevel` today independently drives two separate per-operator tables** —
   `carrierAmplitudeTable` (read only for carriers, at final output summing) and
   `modulationIndexTable` (read only when an operator feeds another as a modulator). For the
   per-operator envelope's "carriers and modulators can evolve independently" value proposition
   (D-01's own stated rationale) to be real, **the envelope must scale both tables**, not just the
   carrier-amplitude one — otherwise a modulator's envelope has zero audible effect, since
   modulators never touch `carrierAmplitudeTable`. CONTEXT.md's own phrasing ("the envelope becomes
   an additional multiplicative factor alongside [`outputLevelToAmplitude`]") is ambiguous on this
   point; the code reading resolves the ambiguity toward "both tables."

Given the project's explicit "documented approximation, not exact DX7 emulation" posture
(CLAUDE.md) and its established precedent of replacing the DX7's real log-domain ROM-table curves
with simple closed-form approximations (`outputLevelToAmplitude`'s squared-normalized curve,
Phase 5), this research recommends a **linear-ramp-at-a-non-linearly-rate-determined-speed** model
for segment progression rather than attempting to reproduce the DX7's genuinely asymptotic
exponential/quadratic hardware curves. This gives exact, deterministic, closed-form segment
durations (trivially unit-testable, mirroring `operator.spec.ts`'s exact analytical-match
precedent) while still being audibly non-linear overall, because the envelope's *level* value feeds
back through the *same* squared-normalized `outputLevelToAmplitude` curve every other level-typed
field in this codebase already uses — non-linearity is inherited "for free" rather than requiring a
second, harder-to-test non-linear time-domain model.

**Primary recommendation:** Build one small, framework-independent `EnvelopeGenerator` class (new
file in `src/app/domain/dx7/dsp/`) holding 4 rate/4 level DX7-integer-scale parameters plus mutable
per-instance state (current level, current segment index, held/released flag) with no allocation in
its `render`/`advance` method; instantiate six of them in `GraphRouter` (a parallel
`envelopesById` array, mirroring the existing `operatorsById` pattern); drive them from a new
`setGate` worklet message that also carries the note's velocity-derived amplitude (replacing what
`voiceGain` used to supply); and apply each operator's per-sample envelope amplitude in place to
that operator's rendered block, immediately after `PhaseModulatedOperator.render`/
`renderWithFeedback` returns and strictly outside the feedback delay line's own math (so the
one-sample feedback self-loop stays untouched by envelope shaping, matching Phase 8's D-07/D-08
"feedback is not tamed anywhere in this kernel" stance).

## Architectural Responsibility Map

This project's own 4-layer architecture (`docs/ARCHITECTURE.md`) is used in place of a generic
web-app tier table, since this is a client-only Angular SPA with no server/API/CDN tier of its own.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Envelope state machine (segment advance, rate curve) | Pure DX7 domain (`domain/dx7/dsp/`) | — | `docs/ARCHITECTURE.md` explicitly lists "Envelope state machine" under layer 1; must be Node-testable with zero Angular/browser globals (DOMAIN-04 ESLint gate) |
| Per-operator envelope amplitude application during block render | Pure DX7 domain (`GraphRouter.render`, `worklets/dx7-worklet-processor.ts`'s caller) | — | Same render loop that already applies `carrierAmplitudeTable`/`modulationIndexTable`; must never allocate (CLAUDE.md), so it lives in the same pure kernel, not a browser adapter |
| Note-on/off gate propagation into the kernel | Browser adapters (`WorkletSynthEngine.noteOn`/`noteOff`) → Pure DX7 domain (`GraphRouter`/worklet processor consuming the new gate message) | Application state (`InstrumentState`, unaffected — note events are not instrument-patch state) | `WorkletSynthEngine` is the DI boundary that turns a user gesture into a worklet message; the message itself is validated and consumed entirely in the pure domain / worklet processor |
| Widened `envelope: Dx7Envelope` field + validation | Pure DX7 domain (`models/operator-parameters.ts`) | Browser-boundary validation (`dsp/worklet-messages.ts`'s structural-clone guard mirrors the same shape) | One canonical dataset shape (CLAUDE.md); the worklet-message validator is a second enforcement point of the same shape, never a second source of truth |
| Ratio/fixed-frequency regression verification | Pure DX7 domain (`value-conversion.spec.ts`, `graph-router.spec.ts`) | — | Math already implemented (Phase 8 D-15); this phase only adds regression coverage, no new production code for this specific capability |
| Lesson 6 regression check (D-03) | UI features (`/learn` lesson flow) | Pure DX7 domain (`lessons.ts` data, unchanged) | Exercises the existing try-this completion flow through the real engine; no new lesson content |
| Playground/operator-editor UI for envelope values | Out of scope (D-05) | — | Playground stays a thin host with no operator-parameter editor this phase |

## Standard Stack

No new external packages are introduced by this phase — it is pure TypeScript domain/DSP code plus
an extension of the existing worklet message contract, both built entirely on infrastructure already
in place from Phases 7/8 (Vitest, the `AudioWorkletProcessor` adapter, esbuild worklet bundling).

### Core (already in the project — reused, not newly added)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~6.0.2 [VERIFIED: `package.json`, read this session] | Strict domain/DSP typing | Already the project's only language; no alternative considered |
| `@angular/build` | ^22.1.2 [VERIFIED: `npx ng version`, run this session] | Compiles/bundles TypeScript via the Angular CLI's esbuild-based builder | Already the project's build tooling; no alternative considered |
| Vitest | ^4.0.8 [VERIFIED: `package.json`, read this session] | Deterministic EG/state-machine unit tests | Already mandatory per CLAUDE.md "Testing rules" |
| Node.js | v22.22.3 [VERIFIED: `node --version`, run this session] | Runs Vitest / esbuild worklet bundling | Existing toolchain, unchanged |

### Supporting
None new. `esbuild` (already a devDependency, used by `scripts/build-worklet.mjs`) continues to
bundle the worklet processor as an import-free IIFE — the new EG class and gate-message handling
are added to the same bundle with zero build-config changes.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled linear-ramp-at-rate-determined-speed EG (recommended) | Reproduce the DX7's real asymptotic-exponential decay / quadratic attack curves exactly (per reverse-engineering research below) | Real curves never reach their target in finite time (asymptotic) — needs an arrival-epsilon heuristic that makes segment-transition timing non-deterministic and harder to unit-test exactly; contradicts this project's own established "reasoned approximation, not exact emulation" precedent (`outputLevelToAmplitude`'s squared curve already diverges from the DX7's real log-domain ROM table) |
| Custom `setGate` worklet message (recommended) | Reuse Web Audio `AudioParam` automation (`setValueAtTime`/`setTargetAtTime`) inside the kernel for envelope shaping | `AudioParam` automation only exists on nodes in the *main-thread* Web Audio graph, not inside a pure, allocation-free `AudioWorkletProcessor.process()` render loop operating on raw `Float32Array`s — not applicable to a kernel-level per-sample EG |

**Installation:** None — no `npm install` needed this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no new external packages (pure TypeScript domain/DSP code
and worklet-message-contract changes only, all built on already-installed toolchain). The Package
Legitimacy Gate protocol is skipped per its own trigger condition ("whenever this phase installs
external packages").

## Architecture Patterns

### System Architecture Diagram

```text
User gesture (keydown/keyup or on-screen key)
        │
        ▼
WorkletSynthEngine.noteOn(note, velocity) / .noteOff(note)   [browser adapter]
        │  posts setFrequency (existing) + NEW setGate message
        ▼
AudioWorkletGlobalScope: Dx7WorkletProcessor.handleMessage    [worklet adapter, worklets/dx7-worklet-processor.ts]
        │  parseWorkletMessage validates, then forwards to GraphRouter
        ▼
GraphRouter (persistent kernel instance, one per worklet)     [pure domain, dsp/graph-router.ts]
        │
        ├─ setGate(open, velocityAmplitude) ─────────► broadcasts open/close to all 6 EnvelopeGenerators
        │
        └─ render(output) — runs once per 128-sample process() call:
             for id in DESCENDING_OPERATOR_IDS:
               1. accumulate incoming modulation from already-rendered source blocks
                  (existing, unchanged — modulationAccumulator × modulationIndexTable)
               2. operator.render(block, modulation)  or  renderWithFeedback(...)   [unchanged]
               3. NEW: envelopesById[id].render(envelopeScratchBlock)  — per-sample level → amplitude
               4. NEW: block[i] *= envelopeScratchBlock[i]  for all i   — applied AFTER step 2,
                       so the feedback delay line's own previousSample stays raw/unscaled
             sum carrier blocks × carrierAmplitudeTable → output   [unchanged, now envelope-shaped]
             clamp to [-1, 1] × MASTER_GAIN                        [unchanged]
```

A reader can trace: a keypress → `noteOn` → a new `setGate` message → the worklet processor →
`GraphRouter.setGate` → six `EnvelopeGenerator` instances waking from idle → `render()`'s per-block
loop multiplying each operator's raw sine block by its own live envelope amplitude → carriers summed
to the speaker.

### Recommended Project Structure
```text
src/app/domain/dx7/dsp/
├── operator.ts               # unchanged — phase-accumulator kernel, no envelope knowledge
├── envelope-generator.ts     # NEW — pure per-operator EG: 4 rate/4 level state machine
├── envelope-generator.spec.ts# NEW — Wave 0 gap; segment-advance/retrigger/release timing proofs
├── graph-router.ts           # extended — envelopesById array, setGate(), render() applies envelope
├── worklet-messages.ts       # extended — SetGateMessage kind, envelope validation in
│                              #   isValidOperatorParametersEntry (replacing the flat envelopeLevel check)
└── ...                        # additive-fixture.ts, patch-plan.ts unchanged
```

### Pattern 1: DX7-authentic 4-segment state machine
**What:** Each operator's EG holds 4 (rate, level) pairs indexed 0-3 (`R1/L1` .. `R4/L4`). Segments
0-2 are the held progression (index advances the instant the current level *reaches* its segment's
target level); segment 2's target (`L3`) is the de-facto sustain plateau — once reached while the
note is still held, the EG simply has nothing further to advance to and holds there. Segment 3
(`R4`/`L4`) is reserved exclusively for release: on note-off, the EG jumps straight to segment 3
**from wherever its current level currently sits**, regardless of which segment (0, 1, or 2 —
including mid-transition) was active at that instant. [CITED: github.com/google/music-synthesizer-for-android
`wiki/Dx7Envelope.wiki`, fetched this session — "envelope operates on 4 segments 0-3 ... on reaching a
segment's target level the index advances to the next segment"]

**When to use:** This is the entire shape of `EnvelopeGenerator`'s internal state machine — one
`segmentIndex: 0|1|2|3`, one `currentLevel: number` (0-99 DX7 scale), one `held: boolean`.

**Example (recommended shape, not yet implemented — sketch for the planner):**
```typescript
// NEW FILE, not yet in the codebase — informed by research, not a transcription of any
// DX7/Dexed/MSFA source (mirrors operator.ts's own "original implementation" framing).
export interface Dx7Envelope {
  readonly rates: readonly [number, number, number, number]; // R1-R4, DX7 0-99 integer scale
  readonly levels: readonly [number, number, number, number]; // L1-L4, DX7 0-99 integer scale
}

export class EnvelopeGenerator {
  // Starts in the release segment (3), not segment 0 — with currentLevel
  // already at its silent floor, this is what makes a freshly constructed,
  // never-gated generator idle silently instead of immediately climbing
  // toward segment 0's (likely non-zero) target before gateOn() is ever
  // called. See the silence-at-rest must_have/prohibition this phase locks.
  private segmentIndex: 0 | 1 | 2 | 3 = 3;
  private currentLevel = 0; // DX7 0-99 scale, not amplitude
  private held = false;
  private envelope: Dx7Envelope;

  constructor(sampleRate: number, envelope: Dx7Envelope) { /* ... */ }

  setEnvelope(envelope: Dx7Envelope): void { this.envelope = envelope; } // no reset — D-04

  gateOn(): void {
    this.held = true;
    this.segmentIndex = 0; // target becomes L1 at R1, FROM the current level — no level reset (D-04)
  }

  gateOff(): void {
    this.held = false;
    this.segmentIndex = 3; // release segment, FROM the current level — no level reset (D-04)
  }

  /** Writes exactly output.length per-sample AMPLITUDE values (already curve-converted via the
   * same outputLevelToAmplitude used elsewhere) — never allocates. */
  render(output: Float32Array): void { /* per-sample: advance currentLevel toward target at the
    segment's rate-derived speed, clamp at target, advance segmentIndex when target is reached
    (except segment 2 while held — see Pattern 1), write outputLevelToAmplitude(currentLevel) */ }
}
```

### Pattern 2: Non-linear rate → speed mapping (the "Claude's Discretion" numeric curve)
**What:** DX7 rates are documented as genuinely non-linear/exponential in real hardware.
[CITED: tlbflush.org "The Yamaha DX7 Envelope Generator" parts 1-4, fetched this session — part 3
measured a pure-exponential decay at rate 50, 44.1kHz sample rate: decay constant `d = 0.00104`
per sample, time constant `T = 1/d = 961.1` samples ≈ 21.8ms; part 4 found rising segments follow a
quadratic-in-time shape near the transition, not linear; part 2's empirical DX7 recording found
level values are also non-linear: level 50 renders close to zero amplitude, level 80 renders at
less than half of level 99's amplitude.] [CITED: github.com/google/music-synthesizer-for-android
`wiki/Dx7Envelope.wiki` — decay speed formula `0.2819 * 2^(qrate/4) * (1 + 0.25*(qrate mod 4)) dB/s`
where `qrate = (rate*41)/64`; each 4-step increase in `qrate` doubles the decay speed; attack speed
is the decay-rate value scaled by a level-dependent factor.]

**Recommendation (informed approximation, ASSUMED constants — ties to Assumptions Log A1/A9):**
Do not reproduce the DX7's dB/s or log-domain formulas verbatim (they operate on an internal
log-domain level representation this codebase does not have, per D-06's own framing that the
envelope field stays on the plain 0-99 DX7 integer scale like every other field in
`operator-parameters.ts`). Instead, map `rate` (0-99) to a **level-units-per-sample speed** via an
exponential interpolation between a slow endpoint (rate 0) and a fast endpoint (rate 99), then apply
that speed as a *constant per-sample increment* for the duration of one segment (recomputed fresh
every time a segment's target changes, which is what makes retrigger/interrupt smooth per D-04):

```typescript
// Illustrative only — exact endpoint constants are Claude's Discretion, to be tuned at this
// phase's listening checkpoint (mirrors the MASTER_GAIN/curve-exponent tuning precedent set at
// the 05-04 checkpoint). Calibration anchor: research's rate-50 exponential time-constant
// (~21.8ms) implies a "practically complete" (5 time-constants, matching
// WORKLET_RELEASE_TIME_CONSTANT_COUNT's existing precedent) full-scale duration around ~109ms at
// rate 50 — pick MIN/MAX_FULL_SCALE_SECONDS so the interpolated value at rate 50 lands in that
// neighborhood.
function rateToLevelUnitsPerSample(rate: number, sampleRate: number): number {
  const normalizedRate = rate / MAX_ENVELOPE_RATE; // 0..1, rate 99 -> ~1
  const fullScaleSeconds =
    MAX_FULL_SCALE_SECONDS * Math.pow(MIN_FULL_SCALE_SECONDS / MAX_FULL_SCALE_SECONDS, normalizedRate);
  return MAX_ENVELOPE_LEVEL / (fullScaleSeconds * sampleRate);
}
```

This is deterministic and gives an exact expected sample count for any (rate, distance) pair —
`ceil(Math.abs(target - current) / levelUnitsPerSample)` — the discrete count of constant-size
steps. The ramp reaches the target after that ceiling number of samples when the final step
overshoots and is clamped. Unit tests should still assert that sample count with exact integer
equality (not `toBeCloseTo`). The resulting *amplitude* curve is still audibly
non-linear because `currentLevel` (0-99) is converted to amplitude through the existing
`outputLevelToAmplitude` squared curve on every sample, not a linear one.

### Pattern 3: Applying envelope to BOTH derived tables, never inside the feedback delay line
**What:** [VERIFIED: `src/app/domain/dx7/dsp/graph-router.ts:196-222`, read this session — quoted
below] `recomputeDerivedValues()` derives `carrierAmplitudeTable[id]` from
`outputLevelToAmplitude(parameters.outputLevel)` and, independently, `modulationIndexTable[id]`
from `outputLevelToModulationDepthHz(parameters.outputLevel, frequencyHz) / frequencyHz` — **both
read the same `outputLevel`, but only `carrierAmplitudeTable` is read when an operator is a
carrier** (`render()`'s final summing loop, `graph-router.ts:277-284`), while
`modulationIndexTable` is read whenever an operator is a modulation *source* for another operator
(`graph-router.ts:258-267`). Quoted:
```typescript
this.carrierAmplitudeTable[id] = outputLevelToAmplitude(parameters.outputLevel) * enabledMultiplier;
...
this.modulationIndexTable[id] = frequencyIsUsable
  ? (outputLevelToModulationDepthHz(parameters.outputLevel, frequencyHz) / frequencyHz) * enabledMultiplier
  : 0;
```
Because these two tables are populated once per parameter change (inside `recomputeDerivedValues`,
not per render block) while envelope level changes every sample, **envelope cannot be folded into
either table directly** — it must be applied as a *third, dynamic, per-sample* multiplier layered on
top of both, inside `render()` itself, to the already-rendered raw block, before that block is used
either as a carrier contribution or as a modulation source. Otherwise a modulator's own envelope
never reaches the ear (it only ever fed `modulationIndexTable`, which is static per-block and
untouched by a per-sample envelope multiply applied only to carriers) — directly undermining D-01's
stated purpose of letting "carriers and modulators... evolve independently."

**When to use:** In `render()`'s existing `DESCENDING_OPERATOR_IDS` loop, immediately after
`this.operatorsById[id].render(block, ...)` / `.renderWithFeedback(...)` returns, and **before**
that `block` is read by either the carrier-summing loop or the next operator's modulation
accumulation. Applying it here — outside `PhaseModulatedOperator.renderWithFeedback`'s own body —
also keeps the feedback delay line's `previousSample` (the true one-sample delay Phase 8's D-06/D-07
built) reading the **raw, unscaled** sample, matching Phase 8's explicit "feedback is not tamed
anywhere in this kernel" design stance; scaling the feedback operator's own output by its envelope
happens to its rendered *output* block (used downstream/summed to carrier output), not to the
internal self-modulation term.

### Anti-Patterns to Avoid
- **Recomputing envelope amplitude inside `recomputeDerivedValues()`:** That method only runs on
  discrete parameter/routing/feedback/frequency changes, not every sample — an envelope's level
  changes continuously while a note is held, so it must be advanced inside `render()`'s per-block
  loop, not treated as a cacheable derived value like `carrierAmplitudeTable`.
- **Applying envelope only to `carrierAmplitudeTable`:** Silently makes every modulator's envelope
  inaudible (see Pattern 3) — a bug that no existing test would catch, since no current test
  exercises a modulator-role operator's amplitude over time.
- **A pure asymptotic-exponential segment model with an arrival epsilon:** Technically more
  "accurate" to the raw research findings, but makes segment-transition-timing tests
  non-deterministic (they'd need a tolerance band on *when* a segment completes, not just on the
  resulting value) and complicates the retrigger/interrupt guarantee D-04 requires — prefer the
  linear-ramp-at-rate-determined-speed model (Pattern 2), which gives exact, deterministic timing.
- **Resetting `currentLevel` to 0 on note-on (gate-on):** Contradicts D-04's explicit "no snap to a
  fixed starting value" language for a note retriggered mid-release — `gateOn()` must change only
  `segmentIndex` (and target), never `currentLevel`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DX7 0-99 level → amplitude conversion | A second, envelope-specific level-to-amplitude curve | The existing `outputLevelToAmplitude` (`src/app/domain/dx7/audio/value-conversion.ts:74-77`, [VERIFIED: read this session]) | One canonical curve convention (CLAUDE.md "one canonical dataset"); also the mechanism by which the envelope's amplitude ends up audibly non-linear without a separate time-domain non-linearity model (see Pattern 2) |
| Ratio/fixed-frequency operator pitch math | Any new frequency-mode logic | `operatorFrequencyHz` (`value-conversion.ts:115-121`), already wired live in Phase 8 D-15 | Per CONTEXT.md's own framing, this phase's "ratio and fixed-frequency modes produce correct frequencies" success criterion is regression verification on already-shipped code, not new implementation |
| Malformed worklet-message rejection | A second validation choke point for the new gate/envelope message shapes | Extend `parseWorkletMessage`'s existing narrow-and-reject pattern (`worklet-messages.ts:233-273`, [VERIFIED: read this session]) | "This stays the single choke point for the three Phase 8 message kinds too — no second validator appears anywhere in the processor" (existing file docstring); the new message kinds must follow the same rule |

**Key insight:** Every numeric-conversion and validation seam this phase needs already has an
established, tested convention in this codebase (squared-normalized curves in `value-conversion.ts`,
narrow-and-reject-malformed in `worklet-messages.ts`, instance-field-no-allocation state in
`operator.ts`). The work is almost entirely *extending* these conventions to a new field/message
shape, not inventing new ones.

## Common Pitfalls

### Pitfall 1: No note-on/off message exists in the worklet contract today
**What goes wrong:** A plan that assumes "wire the new EG into note-on/off" is a small change
discovers, only once coding starts, that the worklet has never had any concept of a note event —
`WorkletMessage`'s union (`worklet-messages.ts:89-94`, [VERIFIED: read this session]) is exactly
`SetFrequencyMessage | SetModeMessage | SetAlgorithmMessage | SetOperatorParametersMessage |
SetFeedbackMessage` — no gate/trigger kind exists. `WorkletSynthEngine.noteOn`/`.noteOff`
(`worklet-synth-engine.ts:403-449`, [VERIFIED: read this session]) do all attack/release entirely
through the external `voiceGain` Web Audio `GainNode`, never touching the worklet's port beyond
`setFrequencyMessage`.
**Why it happens:** Phase 7/8 deliberately deferred "envelope-segment shaping... beyond the current
single `envelopeLevel` stand-in" to this phase (`worklet-synth-engine.ts:98-101`'s own doc comment)
— note-lifecycle *messaging* into the kernel was never built because nothing inside the kernel
needed to know about it until now.
**How to avoid:** Treat "design and add a `setGate`-style worklet message" as first-class new scope
in this phase's plan, not a refactor. It must be added to `WorkletMessage`'s union, validated in
`parseWorkletMessage`, constructed via a `setGateMessage()` helper (mirroring the five existing
`setXMessage()` functions), and consumed in `worklets/dx7-worklet-processor.ts`'s
`handleMessage`/`GraphRouter`.
**Warning signs:** A plan task that says "hook the EG up to noteOn/noteOff" without listing
`worklet-messages.ts` as a file to modify has missed this gap.

### Pitfall 2: Removing `voiceGain` silently drops velocity-to-amplitude scaling
**What goes wrong:** [VERIFIED: `worklet-synth-engine.ts:403-420`, read this session — quoted below]
`noteOn` currently does double duty: it both ramps `voiceGain` up over `WORKLET_ATTACK_SECONDS`
*and* scales that ramp's target by `velocityToAmplitude(velocity)`:
```typescript
const targetLevel = velocityToAmplitude(velocity);
...
this.voiceGain.gain.linearRampToValueAtTime(targetLevel, now + WORKLET_ATTACK_SECONDS);
```
D-02 says the click-prevention ramp is "fully removed," but says nothing explicit about where
velocity sensitivity goes. If the `voiceGain` node (and its velocity-scaled target) is deleted
without relocating velocity scaling somewhere else, every note plays back at a fixed, un-scaled
loudness — a silent regression no envelope-timing test would catch (it's a level bug, not a timing
bug).
**Why it happens:** D-02's wording focuses on click-prevention/amplitude-shaping mechanism, and it's
easy to read "the EG's own segments are the sole amplitude-shaping mechanism" as covering only the
attack/release *shape*, not the separate velocity *scale* factor that shape used to be multiplied
by.
**How to avoid:** Fold `velocityToAmplitude(velocity)` into the new `setGate` message's payload (or
compute it in `GraphRouter` from a velocity value carried by that message) and apply it as one more
multiplicative factor in `render()`'s final output stage — mirroring the existing `enabledMultiplier`
convention already used per-operator. Write an explicit regression test asserting that two notes at
different velocities produce different peak output amplitude through the full engine, so this
cannot silently regress.
**Warning signs:** `WorkletSynthEngine`'s `buildAndStart`/`teardownGraph` still constructing/
disconnecting a `voiceGain` `GainNode` fixed at a constant value, with no other place in the diff
reading `velocity`.

### Pitfall 3: Applying envelope only to `carrierAmplitudeTable`
See Pattern 3 above — this is the single highest-impact design mistake available in this phase,
since it produces working-sounding output (carriers clearly have envelopes) while silently making
every modulator's envelope a no-op, which is very hard to notice by ear alone (a modulator's
amplitude over time shapes brightness/timbre, not obviously "on/off" the way a carrier's does) and
would likely pass a casual listening checkpoint.

### Pitfall 4: A whole-block-behind (rather than per-sample) segment-advance check
**What goes wrong:** At the DX7's fastest rate, a full-scale segment transition can complete in only
a few samples — much less than one 128-sample `RENDER_QUANTUM_FRAMES` block
(`operator.ts:25`, [VERIFIED: read this session]). A design that only checks "has this segment's
target been reached" once per block (rather than once per sample) will hold a stale segment/target
for up to 127 extra samples (~2.9ms at 44.1kHz) past when it should have advanced — audible as
timing inaccuracy on fast rates and as a structural violation of "segment transitions match the
modeled state machine" (this phase's first success criterion).
**Why it happens:** The existing `modulationAccumulator`/derived-value tables are deliberately
per-block-cached for performance (`recomputeDerivedValues()` runs only on parameter change) — it's
easy to reach for the same per-block-cache pattern for envelope state without noticing that envelope
state, unlike those tables, must change *within* a block.
**How to avoid:** `EnvelopeGenerator.render()` must step `currentLevel` and check for
target-reached / segment-advance **once per sample**, inside the same 128-iteration loop that writes
its output buffer — not once at the top of the block. This falls out naturally if the loop body is
written as `for (let i = 0; i < output.length; i++) { advance one sample; check target; write
output[i] }`, mirroring `PhaseModulatedOperator.render`'s own per-sample loop shape exactly.
**Warning signs:** Any envelope code path that reads `this.envelope.rates[this.segmentIndex]` only
once per `render()` call rather than once per sample (that alone is fine for a *constant-speed*
segment, but the target-reached check and `segmentIndex` mutation must still happen per sample, not
once per block).

## Code Examples

### Existing per-sample, no-allocation instance-field pattern to mirror (`operator.ts`)
```typescript
// Source: src/app/domain/dx7/dsp/operator.ts:132-144 (renderWithFeedback), read this session.
// The EnvelopeGenerator's own render() loop should follow this exact shape: one persistent
// instance field advanced per sample, zero allocation, explicit per-sample guard against
// non-finite input.
renderWithFeedback(output: Float32Array, feedbackIndex: number, externalModulation?: Float32Array): void {
  const increment = this.frequencyHz / this.sampleRate;
  const safeFeedbackIndex = Number.isFinite(feedbackIndex) ? feedbackIndex : 0;
  for (let i = 0; i < output.length; i++) {
    const rawExternal = externalModulation ? externalModulation[i] : 0;
    const external = Number.isFinite(rawExternal) ? rawExternal : 0;
    const modulation = external + safeFeedbackIndex * this.previousSample;
    const sample = Math.sin(TWO_PI * this.phase + modulation);
    output[i] = sample;
    this.previousSample = sample;
    this.phase = (this.phase + increment) % 1;
  }
}
```

### Existing squared-normalized curve convention to reuse for envelope-level → amplitude
```typescript
// Source: src/app/domain/dx7/audio/value-conversion.ts:70-77, read this session. Reuse this
// function directly for the envelope's per-sample currentLevel -> amplitude conversion — do not
// write a second curve.
export function outputLevelToAmplitude(outputLevel: number): number {
  const normalized = (outputLevel - MIN_OUTPUT_LEVEL) / OUTPUT_LEVEL_RANGE;
  return Math.pow(normalized, OUTPUT_LEVEL_CURVE_EXPONENT);
}
```

### Existing narrow-and-reject-malformed message validation pattern to extend
```typescript
// Source: src/app/domain/dx7/dsp/worklet-messages.ts:233-273 (parseWorkletMessage), read this
// session. A new "setGate" kind slots in as one more `if (kind === '...')` branch, following the
// exact same never-throw / return-null-on-malformed shape.
export function parseWorkletMessage(data: unknown): WorkletMessage | null {
  try {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return null;
    }
    const kind = (data as { kind?: unknown }).kind;
    if (kind === 'setFrequency') { /* ... */ }
    // NEW: if (kind === 'setGate') { validate open: boolean, velocity: number; return setGateMessage(...) }
    return null;
  } catch {
    return null;
  }
}
```

## State of the Art

| Old Approach (this codebase, pre-Phase-9) | New Approach (this phase) | When Changed | Impact |
|--------------------------------------------|----------------------------|---------------|--------|
| Single external `voiceGain` Web Audio `GainNode` ramp shapes the *entire routed output's* amplitude on note-on/off | Six independent, kernel-integrated per-operator EGs shape each operator's own block before summing | This phase (D-01/D-02) | Carriers and modulators can now audibly diverge over a note's life (e.g. a bell-like modulator decaying faster than its sustained carrier) — the "timbral-evolution" behavior FM patches are known for, previously structurally impossible with a single voice-level ramp |
| `envelopeLevel: number` — a flat sustain-level stand-in, explicitly documented as provisional (`operator-parameters.ts:17-20`) | `envelope: Dx7Envelope` — structured 4-rate/4-level shape | This phase | Was always the intended direction — `GSD_NEW_PROJECT_PROMPT.md:134` already sketched `readonly envelope: Dx7Envelope;` before this codebase existed |
| No note-lifecycle message reaches the worklet kernel at all | A new gate/note-on-off message reaches `GraphRouter` | This phase | First time the pure DSP kernel has any concept of "a note is currently held" — a prerequisite this phase itself must build before EGs can trigger/release |

**Deprecated/outdated:** `WORKLET_ATTACK_SECONDS`, `WORKLET_RELEASE_TIME_CONSTANT`,
`WORKLET_RELEASE_SECONDS`, and the `voiceGain` field/node throughout `worklet-synth-engine.ts` are
all removed by D-02 — every reference to them (`buildAndStart`, `discardLocalGraph`, `noteOn`,
`releaseVoice`, `destroy`, `teardownGraph`) is in-scope surface area for this phase, not just the
three constant declarations.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact rate(0-99)→level-units-per-sample curve endpoint constants (`MIN_FULL_SCALE_SECONDS`/`MAX_FULL_SCALE_SECONDS`) | Architecture Patterns, Pattern 2 | Envelope segments feel too fast/slow relative to real-DX7 expectations; needs a listening-checkpoint tuning pass, same as `MASTER_GAIN`/curve-exponent tuning at the 05-04 precedent — low risk since it's audibly re-tunable post-hoc, not structural |
| A2 | Envelope field TS shape uses `rates`/`levels` as parallel 4-tuples (not e.g. 4 separate named fields, or an array of `{rate, level}` pairs) | Architecture Patterns, Pattern 1 | If the planner picks a different shape, downstream files (`worklet-messages.ts`, `try-this.ts`, `lesson-definition.ts`, all 7 spec files listed below) get written against whichever shape is chosen first — low risk, purely a naming/ergonomics choice, not a correctness one |
| A3 | `EnvelopeGenerator` is a standalone companion class in a parallel `envelopesById` array inside `GraphRouter`, not folded into `PhaseModulatedOperator` itself | Architecture Patterns, Recommended Project Structure | If the planner instead folds EG state into `PhaseModulatedOperator`, `operator.ts`'s "pure phase-accumulator kernel" single-responsibility framing (its own docstring) is diluted, and the EG can no longer be unit-tested in isolation from oscillator math — moderate risk to testability, not to correctness |
| A4 | Envelope state must update per-sample, not per-block | Common Pitfalls, Pitfall 4 | HIGH confidence — directly follows from `RENDER_QUANTUM_FRAMES = 128` (verified) and the DX7's documented fast-rate behavior (segments completing in single-digit samples); a per-block design would visibly fail the "segment transitions match the modeled state machine" success criterion at fast rates |
| A5 | Envelope must scale BOTH `carrierAmplitudeTable` and `modulationIndexTable`, not just carrier amplitude | Architecture Patterns, Pattern 3 | HIGH confidence, HIGH impact if wrong — directly determines whether D-01's stated purpose ("carriers and modulators can evolve independently") is actually achieved; not explicitly resolved by CONTEXT.md's own text, which is ambiguous on this exact point |
| A6 | Velocity-to-amplitude scaling relocates from the removed `voiceGain` node into the new `setGate` message, applied as a `GraphRouter`-level multiplier | Common Pitfalls, Pitfall 2 | Silent, hard-to-notice loudness regression (all notes play at fixed volume) if not explicitly relocated and tested |
| A7 | A new `setGate`-shaped worklet message (exact name/payload TBD) is required, since none exists today | Architecture Patterns, Pattern 1; Common Pitfalls, Pitfall 1 | The *gap itself* is VERIFIED (confirmed by reading the full `WorkletMessage` union and `noteOn`/`noteOff`); only the specific message name/shape proposed here is ASSUMED |
| A8 | Note-on (retrigger) does not reset `currentLevel` to 0 — it changes only `segmentIndex`/target, continuing from whatever level the previous note's envelope was at | Architecture Patterns, Pattern 1 | Directly follows from D-04's explicit "no snap to a fixed starting value" language, but D-04's own example prose focuses on release-mid-attack rather than retrigger-mid-release explicitly — low risk, strong textual support |
| A9 | Recommending a linear-ramp-at-non-linearly-mapped-speed model instead of reproducing the DX7's real asymptotic-exponential/quadratic curves | Standard Stack (Alternatives Considered), Architecture Patterns Pattern 2 | Audible envelope character will diverge somewhat from a "real" DX7's segment shape — acceptable per CLAUDE.md's explicit non-exact-emulation stance and this project's existing precedent of approximating DX7 curves, but should be confirmed at this phase's listening checkpoint |

**If this table is empty:** N/A — nine assumptions logged above, all flagged with explicit risk
levels; none are compliance/security-sensitive (all are DSP-fidelity/API-shape choices).

## Open Questions (RESOLVED)

1. **(RESOLVED)** **Should `envelope` be excluded from `TryThisParam`'s `keyof OperatorParameters` derivation?**
   - What we know: [VERIFIED: `src/app/domain/dx7/lessons/lesson-definition.ts:46-49`, read this
     session — quoted: `export type TryThisParam = Exclude<keyof OperatorParameters, 'enabled' |
     'mode' | 'fixedFrequencyHz'>;`] Once `envelopeLevel: number` is replaced by
     `envelope: Dx7Envelope` (an object, not a directly increase/decrease-able scalar), `envelope`
     becomes a new member of `keyof OperatorParameters` and therefore of `TryThisParam` unless
     explicitly excluded — but a whole-object field has no meaningful "increase"/"decrease"
     direction, exactly the same reason `enabled`/`mode`/`fixedFrequencyHz` are already excluded.
     [VERIFIED: `src/app/domain/dx7/lessons/lessons.ts`, grepped this session — neither of the two
     existing lessons' `try-this` steps targets `envelopeLevel` today (`targetParam: 'outputLevel'`
     and `targetParam: 'ratio'` are the only two used), so no lesson content breaks either way.]
   - What's unclear: Whether the planner wants `envelope` excluded outright this phase (simplest,
     matches D-05's no-new-UI scope) or wants individual rate/level sub-fields made addressable
     later.
   - Recommendation: Add `'envelope'` to the `Exclude<...>` list this phase. Nothing currently
     depends on `TryThisParam` including it, and D-05 already scopes out any new UI that would need
     it.
   - Resolution: Carried into `09-01-PLAN.md` Task 1 step 8 — `envelope` is added to the
     `Exclude<...>` list, matching the recommendation above.

2. **(RESOLVED)** **Exact numeric tolerance for envelope timing tests.**
   - What we know: If Pattern 2's linear-ramp-at-a-computed-speed model is adopted, segment
     durations become exact closed-form sample counts (`Math.abs(target - current) /
     levelUnitsPerSample`), making exact-integer sample-count assertions possible rather than a
     `toBeCloseTo` tolerance band. The existing precedent for *amplitude*-value assertions
     (`operator.spec.ts:18,29,41,129,158`; `graph-router.spec.ts:71`, both [VERIFIED: grepped this
     session]) is `toBeCloseTo(expected, 6)` — 6 decimal places, float32-precision-appropriate.
   - What's unclear: Whether the planner wants exact sample-count assertions for segment-advance
     *timing* in addition to the existing 6-decimal-place convention for resulting *amplitude*
     values — these are two different kinds of assertions this phase's new tests will need.
   - Recommendation: Use exact integer equality for "how many samples until this segment
     completes," and the existing `toBeCloseTo(x, 6)` convention for the amplitude values the EG
     writes into its output buffer.
   - Resolution: Carried into `09-01-PLAN.md` Task 2 and its acceptance criteria — exact-integer
     sample-count assertions for segment-advance timing, `toBeCloseTo(x, 6)` for amplitude values.

## Environment Availability

Skipped — this phase introduces no new external dependency. `AudioContext`/`AudioWorkletNode`/
`GainNode` availability was already probed and confirmed at Phase 7's 07-03 real-browser listening
checkpoint and Phase 8's 08-04 checkpoint (both closed with zero findings, per `.planning/STATE.md`).
No new browser API, service, or CLI tool is required by this phase's scope.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.8 [VERIFIED: `package.json`, read this session] via `@angular/build:unit-test` |
| Config file | Angular's `angular.json` `test` target (no standalone `vitest.config.ts` in this project — confirmed by its absence outside `node_modules` this session) |
| Quick run command | `npm test` (runs once and exits outside a TTY, per README/STATE.md Phase-1 precedent) |
| Full suite command | `npm test` (same — no separate "quick" vs. "full" split exists in this project; `npm run build:worklet` runs automatically first via the `pretest` lifecycle hook) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGINE-03 | Envelope segment advances on reaching target level; holds at L3 while held; jumps to release from current level on note-off | unit | `npx ng test --include="src/app/domain/dx7/dsp/envelope-generator.spec.ts" --watch=false` (new spec) | ❌ Wave 0 — `envelope-generator.ts`/`.spec.ts` do not exist yet |
| ENGINE-03 | Mid-segment retrigger/release produces no discontinuity (D-04) | unit | Same `--include` path — assert `currentLevel` is continuous across a `gateOn()`/`gateOff()` call mid-segment | ❌ Wave 0 |
| ENGINE-03 | Non-linear rate→speed curve produces the documented direction (rate 99 faster than rate 0) | unit | Same `--include` path | ❌ Wave 0 |
| ENGINE-03 | Ratio and fixed-frequency modes produce correct frequencies (regression only, Phase 8 D-15) | unit | `npx ng test --include="src/app/domain/dx7/audio/value-conversion.spec.ts" --watch=false` / `npx ng test --include="src/app/domain/dx7/dsp/graph-router.spec.ts" --watch=false` (existing files, extend) | ✅ `src/app/domain/dx7/audio/value-conversion.spec.ts`, `src/app/domain/dx7/dsp/graph-router.spec.ts` |
| ENGINE-03 | Note release and parameter smoothing never produce NaN/audible clicks | unit | Extend `worklet-messages.spec.ts`'s hostile-payload matrix via `npx ng test --include="src/app/domain/dx7/dsp/worklet-messages.spec.ts" --watch=false`; extend `graph-router.spec.ts`'s bounded-output proof (Phase 8 D-10 precedent) across a full attack→release lifecycle via the graph-router `--include` path above | ✅ both files exist, extend |
| ENGINE-03 | Lesson 6 (Algorithm 1) regression check (D-03) | manual-only (mirrors 07-03/08-04 precedent) or integration | Blocking human-verify checkpoint recommended (see below) | N/A — checkpoint, not an automated test |

### Sampling Rate
- **Per task commit:** `npm test -- <changed-spec-file-pattern>`
- **Per wave merge:** `npm test` (full suite — this project has no separate quick/full split)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus (recommended, mirroring 05-04/
  06-04/07-03/08-04 precedent) a blocking human-verify real-browser listening checkpoint, since this
  phase changes what the live engine audibly sounds like in a way no Vitest/jsdom test can confirm
  (jsdom has no Web Audio API, per Phase 5/7 research precedent).

### Wave 0 Gaps
- [ ] `src/app/domain/dx7/dsp/envelope-generator.ts` — new EG state-machine implementation
- [ ] `src/app/domain/dx7/dsp/envelope-generator.spec.ts` — segment-advance timing, retrigger/
      release-mid-segment continuity, non-linear rate-direction proofs
- [ ] A new worklet message kind (`setGate` or equivalent) in `worklet-messages.ts` +
      corresponding hostile-payload test cases in `worklet-messages.spec.ts`
- [ ] Framework install: none — Vitest is already fully wired

**Existing-file blast radius (not gaps, but every one of these currently references
`envelopeLevel` directly and will need updating once it's widened to `envelope: Dx7Envelope`):**
[VERIFIED: grepped this session]
- `src/app/domain/dx7/models/operator-parameters.ts` (the field itself, `DEFAULT_OPERATOR_PARAMETERS`, `validateOperatorParameters`)
- `src/app/domain/dx7/models/operator-parameters.spec.ts`
- `src/app/domain/dx7/dsp/worklet-messages.ts` (`isValidOperatorParametersEntry`)
- `src/app/domain/dx7/dsp/worklet-messages.spec.ts`
- `src/app/domain/dx7/lessons/try-this.ts` (`tryThisParamValues`'s exhaustive switch)
- `src/app/domain/dx7/lessons/try-this.spec.ts`
- `src/app/domain/dx7/lessons/lesson-definition.ts` (`TryThisParam`, `TRY_THIS_PARAM_LABELS`)
- `src/app/domain/dx7/lessons/lesson-definition.spec.ts`
- `src/app/domain/dx7/dsp/algorithm-routing.spec.ts` (fixture literals)
- `src/app/state/instrument-state.spec.ts` (fixture literals)
- `src/app/core/audio/worklet-processor-bundle.spec.ts` (fixture literals)
- `src/app/core/audio/worklet-synth-engine.ts` (`voiceGain`/`WORKLET_ATTACK_SECONDS`/etc. removal, D-02)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth surface in this client-only educational app |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | Extend `parseWorkletMessage`'s existing narrow-and-reject-malformed choke point (`worklet-messages.ts`) to the new gate/envelope message shapes — same pattern as every existing message kind |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malformed/hostile `postMessage` payload (e.g. `{kind:'setGate', open: 'yes'}`, NaN/Infinity rate or level values, wrong-length rate/level arrays) crossing the main-thread → `AudioWorkletGlobalScope` boundary | Tampering / Denial of Service (broken audio render thread) | Extend the existing `parseWorkletMessage` single-choke-point pattern (T-07-01/T-08-01 precedent) — reject with `null`, never throw, never let an invalid shape reach `GraphRouter` |
| Non-finite envelope level propagating into the rendered block or final output after `Math.sin()` (envelope scaling is applied to the operator's already-rendered sample, not into `Math.sin`'s argument) | Denial of Service (silence/glitch) | Mirror the existing `Number.isFinite(...) ? value : 0` treat-as-zero convention already used for `modulationInput`/`feedbackIndex` in `operator.ts` |

## Sources

### Primary (HIGH confidence)
- `src/app/domain/dx7/models/operator-parameters.ts` — read in full this session
- `src/app/domain/dx7/dsp/operator.ts` — read in full this session
- `src/app/domain/dx7/dsp/graph-router.ts` — read in full this session
- `src/app/core/audio/worklet-synth-engine.ts` — read in full this session
- `src/app/domain/dx7/dsp/worklet-messages.ts` — read in full this session
- `src/app/domain/dx7/audio/value-conversion.ts` — read in full this session
- `src/app/domain/dx7/models/patch.ts` — read in full this session
- `worklets/dx7-worklet-processor.ts` — read in full this session
- `src/app/domain/dx7/lessons/lesson-definition.ts` — read in full this session
- `src/app/domain/dx7/lessons/try-this.ts` — read in full this session
- `docs/ARCHITECTURE.md` — read relevant sections this session
- `GSD_NEW_PROJECT_PROMPT.md` — read relevant sections this session
- `.planning/phases/08-algorithm-routing-and-feedback/08-CONTEXT.md` — read relevant sections this session
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — read in full this session

### Secondary (MEDIUM confidence)
- [github.com/google/music-synthesizer-for-android `wiki/Dx7Envelope.wiki`](https://github.com/google/music-synthesizer-for-android/blob/master/wiki/Dx7Envelope.wiki) — fetched this session; the reference implementation Dexed's DX7 emulation engine derives from, widely cited but not an official Yamaha source
- [tlbflush.org "The Yamaha DX7 Envelope Generator" parts 1-4](https://tlbflush.org/post/dx7eg1/) — fetched this session; independent empirical reverse-engineering via recorded DX7 hardware output, cross-checked against the MSFA wiki's formula-based account

### Tertiary (LOW confidence)
- [righto.com "The Yamaha DX7 synthesizer's clever exponential circuit, reverse-engineered"](http://www.righto.com/2021/11/reverse-engineering-yamaha-dx7_28.html) — fetched this session for chip-level log/exponential-domain context only; not used for any specific numeric constant in this document
- WebSearch-only summaries not independently fetched/confirmed (e.g. a "0.2819 * 2^(rate*0.16) dB/s" formula variant that appeared only in aggregated search-result text, not in a directly fetched page) were deliberately excluded from this document's recommendations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, entirely existing verified toolchain
- Architecture (gate-message gap, dual-table envelope scaling, EG placement): HIGH for the gaps
  themselves (verified by direct code reading), MEDIUM for the specific recommended shapes (informed
  design proposals, not locked decisions)
- Rate-curve numeric fidelity: LOW-MEDIUM — CITED research establishes the *direction* and rough
  *order of magnitude* of DX7 rate non-linearity; exact constants are explicitly ASSUMED and flagged
  for listening-checkpoint tuning, consistent with this project's established approximation posture
- Pitfalls: HIGH — all four are grounded in direct reads of the current implementation, not general
  DSP lore

**Research date:** 2026-08-14
**Valid until:** No external dependency drift risk (no new packages); architecture findings remain
valid as long as `graph-router.ts`/`worklet-messages.ts`/`worklet-synth-engine.ts` are unchanged —
recommend re-verifying the "blast radius" file list above if any of those three files are modified by
an intervening phase before Phase 9 executes.
