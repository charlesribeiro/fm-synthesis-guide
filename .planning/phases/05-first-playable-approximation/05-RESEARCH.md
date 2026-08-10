# Phase 5: First playable approximation - Research

**Researched:** 2026-08-06
**Domain:** Web Audio API monophonic FM-approximation synthesis engine, Angular 22 zoneless DI boundary, keyboard/on-screen play surface
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The MVP engine supports all 32 algorithms this phase, not a focused subset. Since
  `InstrumentState` and the SVG diagram already handle all 32 uniformly off the canonical
  dataset (CLAUDE.md: no per-algorithm special-casing), a generic edge-traversal patching
  approach built once should cost about the same as building for 2 — and it's what makes "no
  stuck voices after algorithm switch" true for any switch, not just a blessed pair.
- **D-02:** Switching the selected algorithm while a note is actively held re-patches that held
  voice live — audibly, immediately — rather than waiting for the next note-on. Matches real DX7
  behavior and the app's core value ("change a parameter, immediately understand why the sound
  changed").
- **D-03:** Master gain is a fixed, internally safety-clamped level this phase — no user-facing
  volume slider. Still must use short gain ramps on note start/stop per CLAUDE.md's "smooth gain
  changes to avoid clicks."
- **D-04:** Monophonic retrigger: if a new note-on arrives before the previous note releases, the
  held note is cut (with a short gain ramp, not a hard stop) and the new note starts immediately.
  No legato retrigger, no ignoring the new note.
- **D-05:** Both on-screen clickable/tappable keys and computer-keyboard key mapping are in scope
  this phase.
- **D-06:** The play surface is built inside Playground, replacing the "On-screen and computer
  keyboard, monophonic to start" bullet of its current placeholder — not a separate route/view.
- **D-07:** The playable range is one fixed octave (e.g. C4–B4), 12 keys, no octave-shift control
  this phase.
- **D-08:** A persistent, always-visible label (e.g. "Educational approximation — not a DX7
  emulator") sits next to the play control at all times.
- **D-09:** AUDIO-01's suspended/unavailable state renders as an explicit, labelled "Enable
  audio" action gating the keyboard — the on-screen/computer keyboard stays visibly inert until
  that gesture resolves `AudioEngineStatus` to `'ready'`.

### Claude's Discretion

- Exact voice-allocation/patching code shape for the generic 32-algorithm oscillator graph
  (per-operator `OscillatorNode`/`GainNode` construction, how feedback self-loops and multi-hop
  modulation chains are approximated with Web Audio's available node graph).
- Exact DI-adapter shape for `AudioContext`/oscillator construction (an `InjectionToken` +
  factory + `DestroyRef` cleanup, mirroring `MotionPreference`/`MATCH_MEDIA`).
- Exact computer-keyboard-to-note mapping (which physical keys map to which of the 12 notes),
  key-repeat suppression, and focus-management interaction with the rest of the Playground page.
- Exact numeric value of the fixed safety-clamped master gain, and the exact millisecond length
  of the click-prevention gain ramps.
- Exact conversion formulas from `OperatorParameters`' DX7-integer scales (`outputLevel` 0-99,
  `ratio` coarse multiples, `detune` -7..+7, `fixedFrequencyHz`, `mode: 'ratio' | 'fixed'`) to Web
  Audio gain/frequency values, at the `SynthEngine` boundary per Phase 3's D-10.
- Exact wording/placement CSS for the D-08 approximation badge and the D-09 "Enable audio" state.
- Whether Vitest-level audio boundary tests fake the whole `AudioContext`/node graph or fake at a
  narrower seam.

### Deferred Ideas (OUT OF SCOPE)

- A user-facing master volume slider — belongs to Playground's later full "Master controls"
  assembly, not this phase's fixed safety-clamped gain (D-03).
- An octave-shift control for the on-screen/computer keyboard — this phase ships one fixed octave
  only (D-07); widening range is additive future work.
- Legato retrigger (new note takes over the held voice's envelope without a fresh attack) — this
  phase always cuts and restarts (D-04); legato is a more expressive behavior that could be
  revisited once Phase 9 designs the real envelope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIO-01 | Audio never starts before an explicit user gesture; a suspended/unavailable state is shown | `AudioContext` gesture-gating pattern (Architecture Patterns §1, Code Example 1), `AudioEngineStatus` mapping table, Common Pitfall 3 |
| AUDIO-02 | User can play and release a note from an on-screen/computer keyboard with a monophonic educational engine, with no stuck voices after note-off or algorithm switch | Persistent-oscillator architecture (Architecture Patterns §2-4), click-safe gain ramp pattern (Code Example 3), keyboard input pattern (Code Example 5), Common Pitfalls 1/2/5/6 |
| AUDIO-03 | The MVP engine is clearly labeled as a teaching approximation, not a bit-accurate DX7 emulation | State of the Art (FM vs PM), Common Pitfall 7, D-08 wording guidance |

</phase_requirements>

## Summary

This phase implements the first real body behind `SynthEngine` (`src/app/core/audio/synth-engine.ts`,
read this session — an already-scaffolded, unimplemented interface). The engine must approximate
DX7-style six-operator **phase** modulation using only native `OscillatorNode`/`GainNode` graphs
(no `AudioWorklet` until Phase 7), stay gesture-gated per Web Audio's autoplay policy, and expose
its lifecycle as an Angular signal without ever storing an `AudioNode` inside that signal
(CLAUDE.md). The standard, well-precedented Web Audio technique for this approximation connects a
modulator `OscillatorNode` through a `GainNode` (which scales modulation depth) into the target
`OscillatorNode.frequency` `AudioParam` — this produces **frequency** modulation, not the DX7's
**phase** modulation. The two are mathematically related but not identical (phase modulation keeps
frequency untouched and perturbs the sine-table index; frequency modulation perturbs the frequency
directly), so the resulting timbre is a genuine approximation, not a scaled-down bit-accurate
model. `GSD_NEW_PROJECT_PROMPT.md` (line 172, read this session) states this explicitly: "The
architecture must not imply that simply patching an OscillatorNode into another oscillator's
frequency parameter is identical to the DX7's digital phase-modulation implementation" — this is
project-level guidance, not merely a suggestion, and directly supports AUDIO-03's labeling
requirement.

A second, verified Web Audio constraint shapes the feedback-self-loop approximation: the Web Audio
API's graph is acyclic **unless a `DelayNode` participates in the cycle** — a direct
`oscillator.connect(oscillator.frequency)` self-loop throws `NotSupportedError`. Every algorithm
in the canonical dataset that has feedback expresses it as a self-loop edge (`from === to`, per
`derive-role.ts`'s `getFeedbackOperator`, read this session), so the engine's feedback path for any
such operator must route through a minimal `DelayNode` to legally close the cycle — itself a
further, honest deviation from the DX7 chip's actual feedback implementation (which averages the
previous two output samples with power-of-2 scaling, not a delayed audio-rate connection).

The recommended architecture keeps all six `OscillatorNode`s **persistent** for the engine's
lifetime (created once in `initialize()`, started once, stopped only in `destroy()`), and treats
note-on/off, retrigger, and even D-02's live algorithm re-patch as pure **rewiring and
retuning** of that persistent graph rather than node creation/destruction per note. This
eliminates the entire "stuck oscillator" failure category by construction (nothing is
started/stopped per note, so nothing can fail to stop), and makes D-02's "re-patch a held note
live" requirement a simple `disconnect()`/`connect()` operation with no audible glitch beyond the
new topology itself.

**Primary recommendation:** Build one persistent six-`OscillatorNode` + per-operator
modulation-index-`GainNode` + one-`DelayNode`-per-potential-feedback-operator graph in
`initialize()`, mirror `MotionPreference`'s `InjectionToken` + factory + `DestroyRef` DI shape for
the `AudioContext`, drive only a single per-voice output `GainNode` with scheduled
(`setValueAtTime`/`linearRampToValueAtTime`/`setTargetAtTime`) automation for note-on/off/retrigger
clicks, and keep the DX7-integer-to-Web-Audio-value conversion functions as pure,
Angular-independent functions in the domain layer so they inherit DOMAIN-04's existing
independent-unit-test guarantee.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `AudioContext` lifecycle, gesture gating, `AudioEngineStatus` | Browser adapter (`src/app/core/audio/`) | — | Mirrors `MotionPreference`'s existing browser-adapter pattern for a browser global; must be DI-injectable and never touch a real global at module scope |
| Oscillator/gain node graph construction and per-algorithm patching | Browser adapter (`src/app/core/audio/`) | Pure DX7 domain (`src/app/domain/dx7/`) for the *plan* | The graph itself is `AudioNode`-typed and must live behind the adapter boundary; the pure "which operator connects to which" decision (derived from `AlgorithmDefinition.edges`) can be computed by a framework-independent function and unit-tested without any Web Audio dependency |
| DX7-integer-scale → Web Audio value conversion (`outputLevel`→gain, `ratio`/`detune`/`mode`→Hz) | Pure DX7 domain (`src/app/domain/dx7/`) | — | Pure math, no `AudioNode`/browser API touch, no Angular import — qualifies for DOMAIN-04's independent-unit-test guarantee and the domain-purity ESLint gate (verified: `eslint.config.*`, read this session) |
| Algorithm/operator/feedback state | Application state (`InstrumentState`, existing) | — | Already built (Phase 3); the engine only reads it, never forks a parallel copy (canonical_refs) |
| Play surface: on-screen keys, computer-keyboard mapping, "Enable audio" gate, approximation label | UI feature (`src/app/features/playground/`) | — | D-06: extends the existing Playground placeholder in place, no new route |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`, `DelayNode`) | Browser-native, no npm package | The synthesis engine itself | The only API surface project rules (CLAUDE.md, `GSD_NEW_PROJECT_PROMPT.md`) and CONTEXT.md's D-01 through D-09 sanction for this phase; no synthesis library is compatible with "never claim exact DX7 emulation" plus "AudioWorklet is the accuracy target," since any pre-built synth library would itself become an opaque dependency to explain away |
| `@angular/core` signals/`effect`/`DestroyRef`/`InjectionToken` | `^22.1.0` [VERIFIED: package.json, read this session] | DI boundary + reactive status signal | Already the project's established pattern (`MotionPreference`) |

### Supporting

None. This phase introduces no new runtime dependency — it is 100% native browser API plus the
existing Angular/domain layers.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `OscillatorNode`/`GainNode` graph | Tone.js (`tone` on npm) | Faster to prototype FM patches, but adds an opaque third-party synthesis layer directly contradicting CLAUDE.md's "browser audio is behind dependency-injected interfaces" (their own abstraction, not this project's) and `GSD_NEW_PROJECT_PROMPT.md`'s explicit "must be clearly described as a teaching approximation" — a library's internal FM implementation is harder to describe accurately to a learner than code this project owns. **Not recommended.** |
| Native `OscillatorNode`/`GainNode` graph | `standardized-audio-context` (npm cross-browser Web Audio polyfill/wrapper) | Solves Safari/old-browser Web Audio quirks and gives a more testable interface, but adds a dependency for a problem the project hasn't hit yet (no browser-compat bug reported); the DI-adapter pattern already planned (mirroring `MotionPreference`) solves testability without it. **Not recommended this phase; revisit only if a real cross-browser bug surfaces.** |
| Hand-rolled Vitest fakes for `AudioContext`/nodes | `web-audio-test-api` (npm) | A purpose-built Web Audio mock library exists, but it is unmaintained (last significant activity years old) and the project already has a proven hand-rolled-fake pattern for exactly this kind of browser-global DI seam (`motion-preference.spec.ts`'s `FakeMediaQueryList`, read this session) — reusing that established pattern needs no new dependency and no Package Legitimacy Audit risk. **Not recommended; hand-roll fakes instead.** |

**Installation:**
```bash
# No new packages this phase.
```

**Version verification:** No new packages are introduced this phase (Web Audio is a browser-native
API, not an npm dependency). `@angular/core` is already pinned at `^22.1.0` in `package.json`
[VERIFIED: package.json, read this session].

## Package Legitimacy Audit

**No external packages are introduced by this phase.** The synthesis engine is built entirely on
the native Web Audio API and the project's existing Angular/domain dependencies (all already
present in `package.json`, verified this session). The Package Legitimacy Gate is therefore not
applicable — there is nothing to check against the npm registry.

**Packages removed due to [SLOP] verdict:** none (no packages evaluated — none proposed)
**Packages flagged as suspicious [SUS]:** none

*If a future planning pass decides to add a package (e.g. `standardized-audio-context`, reconsidered
above), run the Package Legitimacy Gate at that time — this audit does not pre-clear anything not
listed in this document.*

## Architecture Patterns

### System Architecture Diagram

```text
User gesture (click "Enable audio" / on-screen key / computer key)
        │
        ▼
┌─────────────────────────┐
│ Playground (UI feature) │  D-08 approximation label always visible
│ - "Enable audio" gate   │  D-09 keyboard visibly inert until status === 'ready'
│ - on-screen keys        │
│ - keydown/keyup handler │──── event.repeat guard (no retrigger on held key)
└──────────┬───────────────┘
           │ noteOn(note, velocity) / noteOff(note) / setAlgorithm / updateOperatorLevel / setFeedback
           ▼
┌───────────────────────────────────────────┐
│ WebAudioSynthEngine (implements SynthEngine)│  src/app/core/audio/
│                                              │
│  status: Signal<AudioEngineStatus>          │◄── never stores AudioNodes in this signal
│  initialize() → gesture-gated AudioContext  │
│    creation/resume (AUDIO-01)               │
│                                              │
│  ┌────────────────────────────────────────┐│
│  │ Persistent 6-operator node graph        ││  built once in initialize()
│  │ (created once, retuned/rewired per call,││  never recreated per note
│  │  stopped only in destroy())             ││
│  │                                          ││
│  │  Op6 ──gain(idx)──► Op5.frequency        ││  edge-traversal patch (D-01, all 32 algos)
│  │  Op5 ──gain(idx)──► Op4.frequency        ││
│  │  Op6 ──gain(idx)──►[DelayNode]──►Op6.freq││  feedback self-loop needs a DelayNode
│  │  carriers ──► per-voice output GainNode  ││  (Web Audio disallows a zero-delay cycle)
│  └────────────────────────────────────────┘│
│                                              │
│  per-voice output GainNode: click-safe      │
│  ramps drive note-on/off + D-04 retrigger   │
└──────────────────┬───────────────────────────┘
                    │ reads (read-only signals)
                    ▼
┌───────────────────────────────┐
│ InstrumentState (existing)    │  algorithm, operators, feedback, carriers, feedbackOperator
└───────────────────────────────┘
```

Reads from `InstrumentState` drive the engine via an `effect()` inside the engine's constructor
(imperative sync with an external system — the audio graph — which is exactly the case CLAUDE.md's
"use `effect` only for imperative synchronization with an external system" sanctions). The engine
never derives or forks its own copy of algorithm/operator/feedback state.

### Recommended Project Structure

```text
src/app/core/audio/
├── synth-engine.ts                  # existing SynthEngine interface, unchanged
├── synth-engine.token.ts            # SYNTH_ENGINE InjectionToken → WebAudioSynthEngine
├── audio-context.token.ts           # InjectionToken<() => AudioContextLike> + factory, mirrors MATCH_MEDIA
├── web-audio-synth-engine.ts        # @Injectable implementing SynthEngine
├── web-audio-synth-engine.spec.ts   # fakes AudioContext via the DI token
└── testing/
    └── fake-audio-context.ts        # hand-rolled fakes (FakeMediaQueryList-style), shared across specs

src/app/domain/dx7/audio/
├── patch-plan.ts                    # pure: AlgorithmDefinition.edges → ordered connect/disconnect instructions
├── patch-plan.spec.ts
├── value-conversion.ts              # pure: OperatorParameters (DX7 scales) → { frequencyHz, gain }
└── value-conversion.spec.ts

src/app/features/playground/
├── playground.ts                    # extended: injects SynthEngine, owns keyboard/on-screen key state
├── playground.html                  # extended: "Enable audio" gate, 12 keys, approximation label
├── playground.scss
├── playground.spec.ts               # extended: existing "no audio engine wired up" assertion must change
└── keyboard-note-map.ts             # pure: physical key → note number, computer-keyboard convention
```

### Pattern 1: Gesture-gated `AudioContext` behind an `InjectionToken` (mirrors `MotionPreference`)

**What:** A factory `InjectionToken` that returns a *constructor function* for the browser
`AudioContext`, not an instance — so no `AudioContext` exists until `initialize()` explicitly
constructs one inside a user-gesture call stack. Tests override the token with a fake constructor.

**When to use:** Always, for this engine's `AudioContext`/oscillator construction (Claude's
Discretion item in CONTEXT.md, informed by the existing `MATCH_MEDIA`/`MotionPreference` pattern,
read this session).

**Example:**
```typescript
// Source: pattern verified against src/app/core/browser/motion-preference.ts (read this session)
import { InjectionToken } from '@angular/core';

export type AudioContextConstructorLike = new () => AudioContextLike;

export const AUDIO_CONTEXT_CTOR = new InjectionToken<AudioContextConstructorLike | null>(
  'AUDIO_CONTEXT_CTOR',
  {
    providedIn: 'root',
    factory: () => {
      if (typeof window === 'undefined') return null;
      // Safari historically required webkitAudioContext; feature-detect, never assume.
      const ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      return ctor ?? null; // null → AudioEngineStatus 'unavailable', never a thrown error
    },
  },
);
```

`null` from the factory is the signal for `AudioEngineStatus: 'unavailable'` — matching
`MotionPreference`'s "report a safe default rather than crash" posture for an unsupported
environment (`unsupportedMediaQueryList`, read this session) and satisfying AUDIO-01's
"unavailable" state as a first-class outcome, not a caught exception.

### Pattern 2: Split patch **planning** (pure) from patch **application** (imperative)

**What:** A pure function reads `AlgorithmDefinition.edges` (already read this session,
`ModulationEdge { from: OperatorId; to: OperatorId }`) and produces an ordered list of
"operator A modulates operator B" / "operator A is a carrier" / "operator A has feedback"
instructions — no `AudioNode` involved. The engine applies that plan imperatively (disconnect old
wiring, connect new wiring) against its persistent node graph.

**When to use:** Every `setAlgorithm()` call and D-02's live re-patch of a held note.

**Example:**
```typescript
// Source: derived from src/app/domain/dx7/models/derive-role.ts (read this session) + algorithm.edges
export interface OperatorConnection {
  readonly from: OperatorId;
  readonly to: OperatorId;
  readonly isFeedback: boolean; // from === to
}

export function planConnections(algorithm: AlgorithmDefinition): readonly OperatorConnection[] {
  return algorithm.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    isFeedback: edge.from === edge.to,
  }));
}
```

This function is 100% unit-testable without touching Web Audio at all, inherits DOMAIN-04's
independent-test guarantee, and is exactly what the ESLint domain-purity gate (verified,
`eslint.config.*` §`no-restricted-imports`, read this session) is designed to keep Angular- and
browser-API-free.

### Pattern 3: Frequency-modulation approximation (oscillator → gain → target frequency)

**What:** The standard, widely-documented Web Audio FM technique: connect a modulator
`OscillatorNode`'s output through a `GainNode` (the modulation-index scaler) into the target
`OscillatorNode.frequency` `AudioParam`. This is genuinely **frequency** modulation, an
approximation of the DX7's **phase** modulation (State of the Art section below).

**When to use:** Every non-feedback edge in `AlgorithmDefinition.edges`.

**Example:**
```typescript
// Source: technique verified via greweb.me/2013/08/FM-audio-api (read this session) — canonical
// "pipe an Oscillator (the Modulator) into the frequency of another Oscillator (the Carrier)"
const modulator = audioContext.createOscillator();
const modulationIndexGain = audioContext.createGain(); // scales modulator depth
modulator.connect(modulationIndexGain);
modulationIndexGain.connect(carrier.frequency); // AudioParam, not a node input

// modulationIndexGain.gain drives *how much* the modulator perturbs the carrier's
// instantaneous frequency, in Hz — this is the modulation-index equivalent, derived
// from the modulator operator's outputLevel (0-99 DX7 scale) at the engine's value-
// conversion boundary (exact formula: Claude's Discretion, see Assumptions Log A1).
```

### Pattern 4: Feedback self-loop via a minimal `DelayNode`

**What:** Web Audio forbids a zero-delay cycle in the node graph — connecting an oscillator's
output back into its own `frequency` `AudioParam` throws `NotSupportedError` unless a `DelayNode`
participates in the loop [CITED: WebAudio/web-audio-api-v2 GitHub issue #50 discussion on cycle
behavior with `DelayNode`, read this session].

**When to use:** Every algorithm's feedback-carrying operator (`getFeedbackOperator()` returns
non-`null`) — verified against the dataset that **every** algorithm with feedback expresses it as
a `from === to` self-loop edge (e.g. Algorithm 1's `{ from: 6, to: 6 }` [VERIFIED:
`src/app/domain/dx7/models/algorithms.ts:82`, quoted: `{ from: 6, to: 6 }, // feedback self-loop, D-01`],
Algorithm 32's sole edge [VERIFIED: `src/app/domain/dx7/models/algorithms.ts:434`, quoted:
`{ from: 6, to: 6 }, // feedback self-loop, D-01 — the only edge this algorithm declares`]).

**Example:**
```typescript
// Source: pattern derived from documented Web Audio cycle-requires-DelayNode constraint
const feedbackGain = audioContext.createGain(); // scales the self-modulation depth
const feedbackDelay = audioContext.createDelay(1); // minimal delay to legally close the cycle
operator.connect(feedbackGain);
feedbackGain.connect(feedbackDelay);
feedbackDelay.connect(operator.frequency);
feedbackDelay.delayTime.value = 128 / audioContext.sampleRate; // one render quantum minimum
```

This is an honest further approximation, not a hidden inaccuracy: the real DX7 chip averages the
previous **two** output samples with power-of-2 scaling for feedback [CITED:
righto.com Yamaha DX7 chip reverse-engineering, part 4, read this session], not a delayed
audio-rate signal path. Document this specific deviation alongside D-08's approximation label —
it is a second, concrete reason the label is honest, not boilerplate.

### Pattern 5: Click-safe note-on/off and D-04 cut-and-restart retrigger

**What:** Never set `gain.value` directly for a note transition; always schedule with
`setValueAtTime` (anchor) + `linearRampToValueAtTime` (attack) for note-on, and
`setTargetAtTime` (exponential decay toward 0) for note-off/retrigger-cut [CITED:
alemangui.github.io/ramp-to-value, read this session — exponential decay is perceived as linear by
the human ear, making `setTargetAtTime` the standard choice for click-free release].

**Example:**
```typescript
// Source: pattern verified via alemangui.github.io/ramp-to-value (read this session)
const RAMP_SECONDS = 0.015; // 15ms — Claude's Discretion default, see Assumptions Log A2

function noteOn(voiceGain: GainNode, ctx: AudioContextLike, targetLevel: number): void {
  const now = ctx.currentTime;
  voiceGain.gain.cancelScheduledValues(now);
  voiceGain.gain.setValueAtTime(voiceGain.gain.value, now); // anchor from wherever it currently is
  voiceGain.gain.linearRampToValueAtTime(targetLevel, now + RAMP_SECONDS);
}

function noteOffOrRetriggerCut(voiceGain: GainNode, ctx: AudioContextLike): void {
  const now = ctx.currentTime;
  voiceGain.gain.cancelScheduledValues(now);
  voiceGain.gain.setValueAtTime(voiceGain.gain.value, now);
  voiceGain.gain.setTargetAtTime(0, now, RAMP_SECONDS);
}
```

D-04's cut-and-restart retrigger is `noteOffOrRetriggerCut()` followed immediately by retuning the
oscillator frequencies to the new note and calling `noteOn()` again after the cut ramp completes
(or a short fixed delay) — never a hard `gain.value = 0` assignment, and never a new `OscillatorNode`.

### Anti-Patterns to Avoid

- **Recreating `OscillatorNode`s per note-on:** the common "one-shot oscillator per note" pattern
  from simple Web Audio tutorials (create → start → schedule stop → discard) does not fit a
  persistent six-operator routing graph that must also support D-02's live re-patch while a note
  is held. Recreating six oscillators every note-on multiplies the surface area for a forgotten
  `stop()`/`disconnect()` — exactly the "stuck voice" bug AUDIO-02 forbids. Keep oscillators
  persistent; only the per-voice envelope `GainNode` starts/stops audibly.
- **Setting `AudioParam.value` directly for anything time-sensitive:** produces audible clicks
  (direct property assignment jumps instantaneously) and, per MDN, is overridden by any
  concurrently scheduled automation — always use the scheduling methods for note transitions.
- **Storing `AudioNode`s (or the `AudioContext`) inside an Angular `signal`:** explicitly forbidden
  by CLAUDE.md ("never store AudioNodes in Angular signal state"); keep them as private class
  fields on the engine service, and expose only `status: Signal<AudioEngineStatus>` (a plain
  string enum) to the rest of the app.
- **Using `effect()` to *derive* audio graph shape from component state:** CLAUDE.md restricts
  `effect()` to imperative sync with an external system. The one legitimate `effect()` in this
  phase is inside the engine itself, reacting to `InstrumentState`'s read-only signals to call its
  own `setAlgorithm`/`updateOperatorLevel`/`setFeedback` methods — never a `computed()` trying to
  derive a "current graph" value, since the graph is inherently imperative/external state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-browser `AudioContext` naming (`webkitAudioContext`) | A custom polyfill/shim layer | Feature-detect both names in the DI factory (Pattern 1); fall back to `'unavailable'` status if neither exists | The two-line feature-detect is simpler and more testable than a shim, and the DI token already isolates the browser-global lookup to one place |
| Click-free gain scheduling math | A custom easing/ramp function | `AudioParam.setValueAtTime`/`linearRampToValueAtTime`/`setTargetAtTime` (native, spec'd, sample-accurate) | These are exactly the primitives the Web Audio spec provides for this problem; a hand-rolled `requestAnimationFrame`-driven gain ramp would run on the wrong clock (UI thread, not audio thread) and reintroduce the very glitches it's meant to prevent |
| Detecting whether a computer key event is an OS auto-repeat | Manual timestamp/debounce tracking on `keydown` | `KeyboardEvent.repeat` (native boolean, `true` on OS auto-repeat) [CITED: MDN `KeyboardEvent.repeat`, read this session] | The browser already tells you; a timestamp-based debounce is strictly worse (guesses a threshold, can misfire on fast legitimate re-presses) |

**Key insight:** Every "custom solution" temptation in this phase (audio context shims, gain
ramp math, key-repeat detection) already has a native, spec-level answer. The actual engineering
work in this phase is entirely in *composing* those native primitives into the specific graph
shape 32 DX7-style algorithms need — not in re-implementing anything the platform already solved.

## Common Pitfalls

### Pitfall 1: Web Audio graphs are acyclic without a `DelayNode` — a naive feedback self-loop throws

**What goes wrong:** `operatorSix.connect(operatorSix.frequency)` (a direct self-loop, matching the
dataset's `{ from: 6, to: 6 }` feedback edges) throws `NotSupportedError` at connect-time in every
Web Audio implementation.
**Why it happens:** The Web Audio spec only permits a graph cycle when at least one `DelayNode`
participates in it [CITED: WebAudio/web-audio-api-v2 issue #50, read this session].
**How to avoid:** Route every feedback self-loop through a minimal `DelayNode` (Pattern 4). Because
**every** algorithm's feedback is a self-loop edge in this dataset (verified against
`algorithms.ts`, no algorithm has multi-operator return-edge feedback per the dataset's own head
comment, read this session), this is a single, reusable code path — not 32 special cases.
**Warning signs:** A thrown `NotSupportedError` the first time `setAlgorithm()` is called for any
algorithm with feedback (i.e. most of the 32); a naive first implementation that treats feedback
as "just another edge" in the generic patcher (Pattern 2) will hit this immediately and should
treat `isFeedback` as a distinct connect strategy, not a variant of the normal case.

### Pitfall 2: Recreating the oscillator graph per note-on multiplies stuck-voice risk

**What goes wrong:** A per-note "create 6 oscillators, patch them, schedule a stop" pattern (common
in single-oscillator Web Audio tutorials) means every note-on/off pair has 6+ opportunities to leak
a node that never got `stop()`/`disconnect()`-ed, especially under D-04's rapid retrigger (a second
note-on arriving before the first note's async cleanup completes).
**Why it happens:** Ports the "one-shot oscillator" tutorial pattern onto a persistent six-operator
routing graph without adjusting the lifecycle model.
**How to avoid:** Build the six oscillators once in `initialize()`, `start()` them once, and never
`stop()` them until `destroy()`. Note-on/off and retrigger only touch the per-voice output
`GainNode`'s automation (Pattern 5) and the oscillators' `frequency`/`detune` values — nothing is
created or destroyed per note, so nothing can be forgotten.
**Warning signs:** A growing number of live `OscillatorNode`s visible in a debugger/profiler after
repeated note-on/off cycles; audio that keeps sounding after `noteOff()` because an old graph
generation was never disconnected.

### Pitfall 3: `AudioContext` constructed eagerly (module scope, constructor, or service instantiation) instead of inside a gesture

**What goes wrong:** Angular's DI can instantiate a `providedIn: 'root'` service (and therefore run
its constructor) well before any user interaction — if that constructor directly calls
`new AudioContext()`, the context starts `'suspended'` silently or (on stricter browsers) the
construction itself can be blocked/warned against, and CLAUDE.md's "never construct an
`AudioContext` at module evaluation time" / "resume/start audio only after explicit user gesture"
rules are violated in spirit even if not in literal syntax.
**Why it happens:** DI service construction feels "lazy enough" but Angular constructs a
`providedIn: 'root'` singleton on first injection, which can happen during app bootstrap/route
activation, not necessarily inside a click handler.
**How to avoid:** The DI token (Pattern 1) exposes a *constructor function*, not an instance;
`initialize()` — called only from the "Enable audio" click handler / first on-screen key press —
is where `new ctor()` actually runs. The engine's own constructor must not touch the token's
factory result beyond storing the constructor reference.
**Warning signs:** `AudioEngineStatus` reads `'suspended'` on page load without any user action
having occurred yet, or a browser console warning about an `AudioContext` created outside a user
gesture appearing before any click.

### Pitfall 4: Direct `gain.value = x` assignment for note transitions

**What goes wrong:** An audible click/pop on every note-on and note-off.
**Why it happens:** Direct property assignment changes the value instantaneously (a step
function), and a step in amplitude is exactly what the human ear perceives as a click; per MDN,
direct assignment is also overridden if any `AudioParam` automation is concurrently scheduled,
producing inconsistent behavior under rapid retrigger.
**How to avoid:** Always use `setValueAtTime` + `linearRampToValueAtTime`/`setTargetAtTime`
(Pattern 5); always `cancelScheduledValues()` before scheduling a new ramp so a rapid D-04 retrigger
doesn't fight a still-pending previous ramp.
**Warning signs:** Audible clicks during manual testing on every keypress; two ramps racing (gain
briefly jumping) under fast repeated notes.

### Pitfall 5: Missing `event.repeat` guard on computer-keyboard `keydown`

**What goes wrong:** Holding a computer key down retriggers `noteOn()` repeatedly at the OS's key
auto-repeat rate, producing a stutter/retrigger effect instead of one sustained note.
**Why it happens:** Browsers fire repeated `keydown` events (not `keypress`) while a key is held,
each looking identical to a fresh press unless `event.repeat` is checked.
**How to avoid:** Guard the `keydown` handler with `if (event.repeat) return;` before calling
`noteOn()` [CITED: MDN `KeyboardEvent.repeat`, read this session].
**Warning signs:** A single held computer key producing audible retrigger stutter instead of one
sustained tone; this is easy to miss in manual testing if the tester only taps keys briefly.

### Pitfall 6: `jsdom` (the project's test environment) has no Web Audio implementation at all

**What goes wrong:** Any Vitest spec that imports code which calls `new AudioContext()` at
module/import time, or that runs against a real (non-DI-injected) `window.AudioContext`, throws
`ReferenceError: AudioContext is not defined` — verified this session by instantiating the
project's actual installed `jsdom@28.1.0` [VERIFIED: `node -e` probe against
`node_modules/jsdom@28.1.0`, run this session] and confirming `'AudioContext' in window` is
`false` and `'OfflineAudioContext' in window` is `false`. The same probe also confirmed
`window.matchMedia` is `undefined` in this `jsdom` version — which is *why* `MotionPreference`'s
`MATCH_MEDIA` DI token exists and falls back to `unsupportedMediaQueryList` (read this session);
the audio engine needs the exact same defensive posture for the exact same reason.
**Why it happens:** `jsdom` implements the DOM but not the Web Audio API surface.
**How to avoid:** Never let test code exercise a real `AudioContext`. Inject a fake constructor via
the `AUDIO_CONTEXT_CTOR` token (Pattern 1) in every spec, exactly as `motion-preference.spec.ts`
provides a `FakeMediaQueryList` via `MATCH_MEDIA` (read this session).
**Warning signs:** `ReferenceError: AudioContext is not defined` in CI/Vitest output; a spec that
"works locally" only because a developer's browser-based dev tool happened to polyfill something
`jsdom` doesn't have.

### Pitfall 7: Implying bit-accuracy through silence, not just through explicit false claims

**What goes wrong:** AUDIO-03 is satisfied by *presence* of a label, but a label alone doesn't
prevent every other UI surface (algorithm names, operator strip copy, tooltips) from *implying*
precision the engine doesn't have. `GSD_NEW_PROJECT_PROMPT.md` (read this session) is specific:
the architecture itself "must not imply" this — not just the label copy.
**Why it happens:** It's easy to satisfy the literal success criterion ("a label exists") while
still describing an operator's `outputLevel` slider or the algorithm diagram in emulation-precision
language elsewhere on the same page.
**How to avoid:** D-08's persistent label plus care in any nearby copy (e.g. "approximates," "educational
approximation," not "reproduces" or "emulates") written during this phase's plan; this is a
copywriting/review concern for the plan-checker, not a code-level check, but worth flagging so the
plan doesn't stop at "label exists" and call AUDIO-03 done.
**Warning signs:** Copy elsewhere on the Playground page (or in the operator strips, when built)
using words like "accurate," "authentic," or "emulates" without qualification.

## Code Examples

### DI-injected `AudioContext` constructor, tested with a fake

```typescript
// Source: pattern verified against src/app/core/browser/motion-preference.ts and
// motion-preference.spec.ts (both read this session)
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  destination = { maxChannelCount: 2 } as AudioDestinationNode;

  async resume(): Promise<void> {
    this.state = 'running';
  }

  createOscillator(): FakeOscillatorNode {
    return new FakeOscillatorNode();
  }

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  createDelay(_maxDelay?: number): FakeDelayNode {
    return new FakeDelayNode();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

// In a spec:
TestBed.configureTestingModule({
  providers: [{ provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioContext }],
});
```

### Feedback-aware generic patcher (applying `planConnections()` from Pattern 2)

```typescript
// Source: composes Pattern 2 (pure plan) + Pattern 3 (FM) + Pattern 4 (feedback DelayNode)
function applyConnections(
  plan: readonly OperatorConnection[],
  operators: Record<OperatorId, { osc: OscillatorNode; indexGain: GainNode; feedbackDelay?: DelayNode }>,
): void {
  // Reset each source operator's indexGain exactly once, before connecting any
  // destination — resetting per-connection instead would wipe out an earlier
  // destination every time the same source fans out to more than one target.
  const sources = new Set(plan.map((connection) => connection.from));
  for (const sourceId of sources) {
    const source = operators[sourceId];
    source.osc.disconnect(source.indexGain);
    source.indexGain.disconnect();
    source.osc.connect(source.indexGain);
  }

  // Now connect every planned destination, preserving all fan-out.
  for (const connection of plan) {
    const source = operators[connection.from];
    const target = operators[connection.to];

    if (connection.isFeedback) {
      // Pattern 4: must route through a DelayNode to legally close the cycle.
      const delay = source.feedbackDelay!;
      source.indexGain.connect(delay);
      delay.connect(target.osc.frequency);
    } else {
      source.indexGain.connect(target.osc.frequency);
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| "FM synthesis" colloquially used for any oscillator-modulates-oscillator technique | Recognizing the DX7 specifically implements **phase** modulation (constant frequency, perturbed sine-table index), distinct from Web Audio's native **frequency**-modulation-via-`AudioParam` technique | Long-documented distinction (not a recent change), but directly load-bearing for AUDIO-03's honesty requirement [CITED: moinsound.wordpress.com "Frequency Modulation or Phase Modulation?"; righto.com DX7 chip reverse-engineering, both read this session] | The engine's labeling and any explanatory copy should say "frequency-modulation approximation of the DX7's phase-modulation synthesis," not "FM synthesis" unqualified, to stay honest about the specific deviation |
| DX7 hardware feedback: average of previous two samples, power-of-2 depth scaling | This engine's feedback: audio-rate self-loop through a minimal `DelayNode` (the smallest legal Web Audio cycle) | N/A — a structural approximation forced by the Web Audio API's own cycle rules, not a historical "old vs. new" shift | A second, concrete, documentable reason the D-08 label is substantive rather than boilerplate |

**Deprecated/outdated:** Nothing in this domain has been deprecated; the Web Audio API surface
used here (`AudioContext`, `OscillatorNode`, `GainNode`, `DelayNode`, `AudioParam` scheduling
methods) has been stable since the API's specification and is not marked deprecated anywhere
consulted this session.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `outputLevel` (0-99 DX7 scale) → modulation-index/gain conversion should use a non-linear (roughly exponential/perceptual) curve rather than a direct linear scale, because linear gain mapping makes changes near the top of the range feel inaudible and changes near the bottom feel oversized to human hearing | Pattern 3, Code Example 1 comment | If implemented linearly instead, the operator-level slider (when built) will feel "dead" at high levels and "twitchy" at low levels — a UX defect, not a correctness bug; easy to revise later since it's isolated to one conversion function |
| A2 | 15ms is a reasonable default gain-ramp duration for note-on/off/retrigger-cut | Pattern 5, Code Example 3 | Too short (\<5ms) risks an audible click surviving; too long (\>50ms) makes the monophonic retrigger (D-04) feel sluggish/legato-like, blurring the distinction from the explicitly-deferred legato behavior. Should be confirmed by ear during manual verification, not treated as a hard-coded constant beyond dispute |
| A3 | A fixed master-gain safety clamp around 0.15-0.2 (linear) is a reasonable default, sized against the worst case of Algorithm 32 (all six operators are unmodulated carriers, i.e. up to 6 summed sine waves that could constructively peak near amplitude 6 if all six phases align) | D-03 discretion area | Set too high: audible clipping/distortion on carrier-heavy algorithms (32, 31, 30…) at max output levels — a poor first impression of a "safety-clamped" engine. Set too low: engine sounds inaudibly quiet even at full patch levels. This is a perceptual tuning value that a unit test cannot verify by itself — the plan should include a manual listening checkpoint (`checkpoint:human-verify`) alongside any automated gain-value assertion |
| A4 | The computer-keyboard note mapping should follow the common "piano-style QWERTY" convention: bottom letter row (A S D F G H J) = the 7 white keys, row above (W E _ T Y U) = the 5 black keys, matching Ableton Live's documented computer-keyboard-as-MIDI convention | Recommended Project Structure (`keyboard-note-map.ts`), Don't Hand-Roll | Low risk — this is a widely-recognized convention (also used by many browser virtual-piano sites), so an unconventional choice would mainly cost discoverability/muscle-memory for musically-experienced users, not correctness |
| A5 | Detune (-7..+7 DX7 scale) should map to a small frequency multiplier via cents (e.g. a few cents per step) rather than a linear Hz offset, to stay proportional across the octave range like real fine-tuning | Pattern 3 vicinity (not directly coded above — flagged as an open boundary decision) | If implemented as a flat Hz offset instead, detune would sound wildly different in the low vs. high end of the fixed C4–B4 range, contradicting how DX7 fine-tune actually behaves; low implementation risk to fix later since it's isolated to one conversion function |

## Open Questions (RESOLVED)

1. **Exact `outputLevel`→gain and modulator-index scaling formulas (RESOLVED — plans 05-01/05-02)**
   - What we know: DX7 hardware uses a non-linear (log-domain-summed) output-level table [CITED:
     righto.com DX7 chip reverse-engineering, read this session: "the logarithms of both values are
     added" for amplitude scaling, converted back through an exponential ROM]; reproducing that
     exact table is out of scope for an MVP approximation engine and would risk implying more
     precision than the engine has.
   - What's unclear: the specific curve shape/constants this project should use for its own
     approximation (CONTEXT.md leaves this to Claude's Discretion).
   - Recommendation: pick a simple, documented, testable curve (e.g. `gain = (outputLevel / 99) ** 2`
     or an exponential/dB-based curve) and write it as a pure, independently-unit-tested function
     (`value-conversion.ts`) so it can be revised later without touching the engine's wiring code.
     Do not attempt to reverse-engineer the DX7's exact ROM table this phase — that level of
     fidelity belongs to the AudioWorklet accuracy target (Phase 7+), not this approximation.
   - RESOLVED: implemented as the squared-normalized curve in `05-01`/`05-02`'s `value-conversion.ts`
     tasks, per the recommendation above.

2. **Whether the fixed master-gain clamp should account for algorithm carrier count at all (RESOLVED — plan 05-04)**
   - What we know: D-03 specifies "a fixed, internally safety-clamped level" (singular, fixed),
     which reads as *not* per-algorithm-normalized.
   - What's unclear: whether a truly fixed constant will feel meaningfully louder on Algorithm 32
     (6 carriers) than on a heavily-modulated algorithm with 1 carrier, and whether that's an
     acceptable MVP characteristic or worth flagging as a known limitation in the approximation
     label's surrounding copy.
   - Recommendation: implement as a single fixed constant per D-03's literal wording; if manual
     listening reveals an unacceptable loudness swing across algorithms, that becomes a follow-up
     decision for a later phase (per-algorithm carrier-count normalization), not a scope change
     for this one.
   - RESOLVED: implemented as a single fixed `MASTER_GAIN` constant per the recommendation; plan
     `05-04` Task 2's blocking checkpoint records any loudness-swing characteristic observed during
     manual listening as a known limitation rather than reopening scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Web Audio API (`AudioContext` et al.) | AUDIO-01/02 at runtime, in the user's real browser | N/A (browser-runtime capability, not a build-time/CI dependency) | — | `AudioEngineStatus: 'unavailable'` state (already part of the existing `SynthEngine` interface, read this session) |
| `jsdom` (test environment) | Running Vitest specs for this phase | ✓ [VERIFIED: `npm ls jsdom` → `jsdom@28.1.0`, read this session] | 28.1.0 | Does **not** implement `AudioContext`/`OfflineAudioContext` [VERIFIED: `node -e` probe against the installed package, run this session] — fallback is mandatory DI injection of a fake constructor (Pattern 1) for every spec touching the engine, never a real `AudioContext` in tests |
| Physical audio output device | Manual/human verification of the actual sound and gain-clamp tuning (Assumptions Log A3) | Not required for automated tests (CLAUDE.md: "audio tests must be deterministic and must not require a physical output device") | — | Automated specs assert on scheduled `AudioParam` calls/node-graph shape via fakes; actual audible-quality checks are a `checkpoint:human-verify` task in the plan, not an automated gate |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** `jsdom`'s lack of Web Audio (fallback: DI fakes, already
the established codebase pattern); a user's browser lacking Web Audio entirely (fallback: the
existing `'unavailable'` `AudioEngineStatus`).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.8` [VERIFIED: `package.json`, read this session], run via `@angular/build:unit-test` builder (not the raw Vitest CLI) |
| Config file | none — builder-managed; no dedicated `vitest.config.ts` exists in the repo [VERIFIED: `angular.json`'s `test` target has no `runner-config` option set, read this session] |
| Quick run command | `npx ng test --include="src/app/core/audio/**/*.spec.ts" --watch=false` (or the equivalent glob for `src/app/domain/dx7/audio/**` / `src/app/features/playground/**`) |
| Full suite command | `npm test` (already the project's documented convention — `ng test`'s Vitest builder runs once and exits outside a TTY per `STATE.md`'s Phase 1 decision log, read this session) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIO-01 | `status()` stays `'suspended'` until a simulated gesture resolves `initialize()`; reports `'unavailable'` when the DI token yields no constructor | unit | `npx ng test --include="src/app/core/audio/web-audio-synth-engine.spec.ts" --watch=false` | ❌ Wave 0 |
| AUDIO-02 | `noteOn`/`noteOff` schedule the expected `AudioParam` automation calls on the fake graph; `allNotesOff`/`setAlgorithm` never leave a fake oscillator un-stopped or un-disconnected after `destroy()`; D-04 retrigger cancels prior scheduled ramps | unit | `npx ng test --include="src/app/core/audio/web-audio-synth-engine.spec.ts" --watch=false` | ❌ Wave 0 |
| AUDIO-02 (patch planning) | `planConnections()` produces correct connection lists for representative algorithms (e.g. Algorithm 1, Algorithm 32) including feedback flagging | unit | `npx ng test --include="src/app/domain/dx7/audio/patch-plan.spec.ts" --watch=false` | ❌ Wave 0 |
| AUDIO-02 (keyboard input) | held computer key (`event.repeat === true`) does not retrigger `noteOn`; `keyup` calls `noteOff` | unit/component | `npx ng test --include="src/app/features/playground/**/*.spec.ts" --watch=false` | ❌ Wave 0 (extends existing `playground.spec.ts`) |
| AUDIO-03 | the approximation label text is present and visible without extra interaction, in every render state (suspended/ready) | component | `npx ng test --include="src/app/features/playground/playground.spec.ts" --watch=false` | ❌ Wave 0 (extends existing spec; the current assertion "No audio engine is wired up yet" must be replaced, not merely supplemented — this is a stale-fixture risk to flag in planning) |

### Sampling Rate

- **Per task commit:** the relevant `--include` glob above (quick run)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** full suite green, plus `npm run build` and `npm run lint`, before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/app/core/audio/testing/fake-audio-context.ts` — hand-rolled `FakeAudioContext`/
      `FakeOscillatorNode`/`FakeGainNode`/`FakeDelayNode` test doubles, mirroring
      `motion-preference.spec.ts`'s `FakeMediaQueryList` pattern (introspectable: track
      `connect`/`disconnect`/`start`/`stop` calls and scheduled `AudioParam` automation events)
- [ ] `src/app/core/audio/web-audio-synth-engine.spec.ts` — does not exist yet
- [ ] `src/app/domain/dx7/audio/patch-plan.spec.ts` and `value-conversion.spec.ts` — do not exist yet
- [ ] `playground.spec.ts`'s existing assertion on `"No audio engine is wired up yet"` will fail
      once the placeholder copy is replaced — must be updated in the same commit that changes the
      template, not left to accumulate as an unrelated failure

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No accounts/auth surface exists anywhere in this app |
| V3 Session Management | No | No server sessions; purely client-side, in-memory state |
| V4 Access Control | No | Single-user local instrument; no privilege boundaries |
| V5 Input Validation | Yes | Existing domain validators (`validateOperatorParameters`, `isOperatorId`, `isAlgorithmId`, `validateFeedbackLevel`, all read this session) already reject out-of-range values before they reach the engine; `noteOn(note, velocity)` should validate `note` against the fixed 12-key range (D-07) and `velocity` against a sane bound before it reaches any `AudioParam`, to avoid `NaN`/`Infinity` propagating into Web Audio scheduling (which throws or produces silent/undefined audio, not a security exploit, but a robustness gap worth the same validate-at-boundary discipline the rest of the domain already uses) |
| V6 Cryptography | No | No cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malformed/out-of-range numeric input reaching `AudioParam` scheduling (e.g. `NaN` frequency, negative gain) causing a thrown exception mid-note (denial of the play surface for the current session, not a security breach) | Denial of Service (local, non-adversarial) | Validate `note`/`velocity` at the `SynthEngine` boundary before any `AudioParam` call, consistent with the existing domain-validator posture (`operator-parameters.ts`'s `validateOperatorParameters`, read this session) |

This phase has no network, storage, or multi-user surface — the applicable threat model is limited
to input-robustness at the audio boundary, not a conventional web-app attack surface.

## Sources

### Primary (HIGH confidence)
- `src/app/core/audio/synth-engine.ts` (read this session) — the `SynthEngine` interface this phase implements
- `src/app/core/browser/motion-preference.ts` + `motion-preference.spec.ts` (read this session) — the DI-adapter and fake-testing pattern this phase mirrors
- `src/app/state/instrument-state.ts` (read this session) — the read-only facade the engine consumes
- `src/app/domain/dx7/models/{algorithm-definition,algorithm,operator,operator-parameters,derive-role,algorithms}.ts` (read this session) — the canonical dataset, types, and derivation functions the engine's patching/conversion logic must consume
- `eslint.config.*` (read this session) — the domain-purity ESLint boundary shaping where conversion/plan functions may live
- `package.json`, `angular.json` (read this session) — confirmed no new dependencies needed, confirmed the Vitest test-runner invocation shape
- `node -e` probe against the project's installed `jsdom@28.1.0` (run this session) — confirmed absence of `AudioContext`/`OfflineAudioContext`/`matchMedia` in the test environment
- `GSD_NEW_PROJECT_PROMPT.md` §"Audio strategy: educational first" (read this session) — explicit "must not imply" honesty requirement and Stage A/B engine split
- `docs/ARCHITECTURE.md` §"Proposed audio interfaces", §"Algorithm graph model", §"Audio roadmap" (read this session)
- `docs/ACCEPTANCE_CRITERIA.md` (read this session) — binding acceptance language for gesture-gating, stuck-voice prohibition, fake-based audio tests

### Secondary (MEDIUM confidence)
- greweb.me/2013/08/FM-audio-api — canonical oscillator→gain→frequency FM technique in Web Audio [fetched and read this session]
- alemangui.github.io/ramp-to-value — click-prevention gain-ramp technique and rationale [fetched and read this session]
- WebAudio/web-audio-api-v2 GitHub issue #50 (cycle behavior with `DelayNode`) [WebSearch, read this session, cross-checked against general Web Audio spec knowledge]
- righto.com "Yamaha DX7 chip reverse-engineering, part 4" — hardware feedback averaging/scaling, operator processing order, phase-vs-index modulation mechanism [fetched and read this session]
- sonicbloom.net "Ableton Live Tutorial: The Computer Keyboard as a MIDI Controller" — computer-keyboard-to-note mapping convention [fetched and read this session]
- MDN `Web_Audio_API/Best_practices`, `AudioContext/resume`, `KeyboardEvent/repeat`, `AudioParam` (surfaced via WebSearch, standard official documentation, not independently fetched in full this session)

### Tertiary (LOW confidence)
- moinsound.wordpress.com "Frequency Modulation or Phase Modulation?" — general-audience explainer corroborating the FM-vs-PM distinction, used only as a secondary confirmation alongside the righto.com hardware source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, entirely native browser API plus already-verified project conventions
- Architecture: MEDIUM — the persistent-oscillator/DI-token/DelayNode-feedback patterns are each individually well-precedented and verified, but their specific composition for a 32-algorithm generic patcher is this project's own design, not copied from an existing reference implementation
- Pitfalls: HIGH — the two most load-bearing technical claims (Web Audio cycle restriction, `jsdom`'s lack of Web Audio) are independently corroborated (search + this session's empirical `node -e` probe against the actual installed `jsdom` version)

**Research date:** 2026-08-06
**Valid until:** 2026-09-05 (30 days — the Web Audio API surface used here is stable; revisit sooner only if the project adds a cross-browser compatibility requirement not yet in scope)
