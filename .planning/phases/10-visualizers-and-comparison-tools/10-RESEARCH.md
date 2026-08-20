# Phase 10: Visualizers and comparison tools - Research

**Researched:** 2026-08-17
**Domain:** Web Audio `AnalyserNode` visualization (Canvas 2D), zoneless Angular 22
`requestAnimationFrame` lifecycle, and pure-domain bounded-random-walk patch mutation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Visualizer Rendering & Audio Tap**
- D-01: Canvas 2D for both the oscilloscope and spectrum, not SVG or WebGL — imperative
  per-frame redraw is the right fit for continuously-updating waveform/spectrum data; SVG's DOM
  churn at 60fps would fight the "no CD per animation frame" success criterion, and WebGL is
  unjustified overkill for a 2-lane display.
- D-02: Tap the master output only, via one new `AnalyserNode` inserted between the worklet's
  `masterGain` and `destination` — not a per-operator tap. Requires adding `createAnalyser` (and
  a minimal `AnalyserNodeLike`/`getByteTimeDomainData`/`getByteFrequencyData` surface) to
  `AudioContextLike` in `audio-context.token.ts`, alongside its existing `createGain`/
  `createDelay`, plus the corresponding fake in `testing/fake-audio-context.ts`. —
  **Reversibility:** costly — the boundary interface (`AudioContextLike`) is shared by
  `WorkletSynthEngine`, `WebAudioSynthEngine`, and every audio spec's fake; widening it now is
  cheap, but narrowing or replacing the tap point later touches all of those call sites.
- D-03: Draw loop runs via `requestAnimationFrame`, started/stopped from the visualizer
  component's lifecycle (or the narrow `effect()` exception CLAUDE.md carves out for imperative
  external-system sync) — never a `setInterval` poll, and analyser reads must never be routed
  through a signal/computed that would re-trigger CD.
- D-04: The visualizer panel is a new, always-visible region in `playground.html` below
  `PlaySurface`, replacing the existing `comingSoon` list item "Oscilloscope and spectrum
  display". No show/hide toggle — it renders flat/silent when audio is suspended or no note is
  sounding, consistent with the app's existing suspended/ready status handling.

**Spectrum Display**
- D-05: Logarithmic frequency axis — matches perceived pitch/timbre and keeps FM sidebands
  near the fundamental legible, rather than crowding all musically relevant content into a
  linear scale's low-frequency sliver.
- D-06: "Labelled" (VIZ-01) means both a few frequency-axis tick labels (e.g. 100 Hz / 1 kHz /
  10 kHz) on the canvas AND an accessible text description alongside it — canvas content is
  otherwise invisible to assistive tech, mirroring CLAUDE.md's "include accessible text
  descriptions" rule already applied to the SVG algorithm diagrams.
- D-07: Bar/column ("graphic EQ") rendering, not a continuous line — keeps the spectrum
  visually distinct from the oscilloscope's line-based waveform and reads unambiguously as
  per-band amplitude.
- D-08: `fftSize` of 2048 (the `AnalyserNode` default range) — enough resolution to
  distinguish FM sidebands at typical note frequencies without over-smoothing, cheap enough for
  a 60fps redraw.

**A/B Compare UX**
- D-09: Five explicit controls — Capture A, Capture B, Recall A, Recall B, Reset — each
  mapping 1:1 onto `InstrumentState`'s existing methods. No new state logic; this is UI wiring
  only. A single A/B toggle switch was explicitly considered and rejected because `recallSnapshot`
  just sets the patch — there's no "currently on A or B" concept in the facade to toggle between;
  a future toggle would need new derived state, not just a UI change.
- D-10: Recall/Capture buttons communicate slot state via text + disabled state (e.g. "Recall A
  (empty)" disabled until `hasSnapshot('a')`), not color or icon shape alone — matches CLAUDE.md's
  "do not communicate carrier/modulator state by color alone" spirit and reuses `hasSnapshot()`
  directly.
- D-11: Recall applies immediately to the live patch with no click-safety gating — Phase 9's
  per-operator envelope continuity (D-04 in `09-CONTEXT.md`) already guarantees the sound jumps
  continuously from wherever it sits, so swapping the patch under a live worklet graph mid-note is
  already click-safe. No new audio-side work needed for this.

**Randomization**
- D-12: Randomize touches every operator's full `OperatorParameters` (ratio/fixed mode +
  frequency, output level, detune, envelope rates/levels ×4) plus instrument-level feedback depth
  — the whole sound-shaping surface Phase 9 finished building. Algorithm/routing selection is
  explicitly excluded; randomizing topology would undercut the pedagogical point of studying one
  algorithm's routing at a time.
- D-13: Ranges stay musically sensible via a bounded random walk from the *current* patch's
  values (e.g. a delta bounded to roughly ±20% of each field's valid range) rather than uniform
  sampling across each field's full raw bounds — keeps results audibly related to what's currently
  playing and avoids common uniform-random failure modes (e.g. every envelope level landing near
  0, silence-prone results).
- D-14: Randomize writes directly into the live patch via a new `InstrumentState` command,
  the same posture as `setAlgorithm`/`updateOperator`. No implicit auto-capture before
  randomizing and no separate undo stack — the just-built A/B capture flow (D-09) is the
  intentional "undo": capture to a slot first if you want the prior sound back.
- D-15: One "Randomize" button lives in the same tools panel as the A/B controls — a single
  explicit action, no automatic/implicit randomization triggered by other events.

### Claude's Discretion
- Exact bounded-random-walk delta magnitude/formula per field (D-13) — the ±20% figure above is
  illustrative, not a locked number; tune during planning/implementation against what actually
  sounds musically reasonable.
- Exact visual layout/grouping of the A/B and Randomize button row within the new tools panel.
- Canvas pixel dimensions, colors (respecting the project's existing token/reduced-motion rules),
  and exact tick-label formatting on the spectrum axis.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. A single A/B toggle-switch UI (D-09) and an
auto-capture-before-randomize safety net (D-14) were both raised and explicitly rejected during
discussion, not deferred as future ideas — they're recorded as decisions, not backlog items.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIZ-01 | Oscilloscope and labelled spectrum display, off the Angular change-detection path | See "AnalyserNode API Shape", "Canvas 2D Drawing Pattern", and "RAF Lifecycle in Zoneless Angular 22" — the minimal `AnalyserNodeLike` surface, the log-frequency bucketing/draw-loop shape, and the `viewChild` + `afterNextRender` + `DestroyRef` start/stop pattern that keeps the loop entirely off the signal graph. |
| VIZ-02 | A/B comparison and constrained randomization in Playground mode | See "Existing Code to Reuse" for the exact `InstrumentState` A/B facade signatures (UI wiring only, D-09) and "Randomization Domain Design" for the bounded-random-walk field-by-field plan, built on the exact `OperatorParameters`/`validateOperatorParameters`/`validateFeedbackLevel` ranges read this session. |

</phase_requirements>

## Summary

Phase 10 is almost entirely a **wiring and rendering** phase, not a new-architecture phase: two of
its three deliverables (A/B compare, randomization's state write) sit directly on top of
`InstrumentState`'s already-complete, already-tested command pattern, and the third (oscilloscope
+ spectrum) is one new native Web Audio node plus a Canvas 2D `requestAnimationFrame` loop — no
third-party libraries are needed or recommended anywhere in this phase.

The one genuinely new piece of architecture is extending this project's hand-rolled
`AudioContextLike`/`GainNodeLike`-style minimal-surface convention (`audio-context.token.ts`,
`testing/fake-audio-context.ts`) with an `AnalyserNodeLike` surface, and inserting the real
`AnalyserNode` at the exact point `WorkletSynthEngine.buildAndStart()` currently does
`masterGain.connect(context.destination)` (line 288 of `worklet-synth-engine.ts`, read this
session) — this connects the node whose gain the entire live engine already treats as "the final
mix." Because `masterGain` currently connects directly to `context.destination`, and the existing
spec suite's `findMasterGain()` test helper locates it by that exact connection
(`gain.connections.has(context.destination)`, `worklet-synth-engine.spec.ts:78`, read this
session), inserting an analyser **between** them will silently break that helper across the whole
spec file unless the plan explicitly updates it — this is the single highest-value finding of this
research and is called out again under Common Pitfalls.

For randomization, the domain layer already defines an exact, machine-checkable valid range for
every numeric field except one: `fixedFrequencyHz` has no declared upper bound anywhere in
`operator-parameters.ts` (only `> 0` and finite are validated). D-13's "±20% of each field's valid
range" formula cannot be applied to that one field without the plan first choosing a practical
range to walk within — flagged as an Open Question with a recommended default.

**Primary recommendation:** Extend the existing `AudioContextLike`/fake convention with a minimal
`AnalyserNodeLike` (three read-write properties, two read methods), insert it between
`masterGain` and `destination` in `WorkletSynthEngine`, expose two plain (non-signal) read
methods on the service for a Canvas-2D `requestAnimationFrame` component to poll, and implement
`InstrumentState.randomize()` as a thin wrapper around a new pure `src/app/domain/` random-walk
function that funnels every output field back through `validateOperatorParameters`/
`validateFeedbackLevel` before it is ever written to the patch.

## Architectural Responsibility Map

This project layers by *purity boundary*, not network tier (`domain/` → framework-independent,
`core/` → injectable browser boundaries, `state/` → signal facade, `features/` → components) —
that layering is used here in place of the generic browser/SSR/API/CDN/DB tiers, which do not
describe a client-only SPA.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `AnalyserNode` audio tap + minimal `AnalyserNodeLike` surface | `core/audio` (`audio-context.token.ts`, `worklet-synth-engine.ts`) | — | Mirrors the existing `GainNodeLike`/`DelayNodeLike` boundary convention exactly; the audio graph is `core/audio`'s exclusive concern (D-02). |
| Oscilloscope/spectrum rendering (Canvas 2D, RAF loop, tick labels, a11y description) | `features/playground` (new component) | `core/audio` (data source only) | Presentational, imperative, per-frame work belongs in a component per D-01/D-03; the component never owns audio-graph construction. |
| A/B capture/recall/reset button wiring | `features/playground` | `state` (`InstrumentState`, already built) | D-09: UI wiring only — zero new state logic needed. |
| Randomization bounded-random-walk math | `domain/dx7` (new pure function) | `state` (`InstrumentState.randomize()` command) | DOMAIN-04: bounds/random-walk math has no Angular dependency and must be independently unit-tested; `InstrumentState` owns the validate-then-write command surface, matching `updateOperator`/`setFeedback`'s existing pattern. |
| Randomize button trigger | `features/playground` | `state` | UI wiring calling the new `InstrumentState.randomize()` command, same shape as every existing control. |

## Standard Stack

### Core

No new runtime dependencies. Every capability in this phase is built on native browser APIs the
project already depends on (Web Audio `AudioContext`/`AnalyserNode`, `HTMLCanvasElement`'s 2D
context, `requestAnimationFrame`) plus Angular 22 APIs already used elsewhere in this codebase.

| API | Source | Purpose | Why Standard |
|-----|--------|---------|---------------|
| `AnalyserNode` | Web Audio API (native) [CITED: developer.mozilla.org/en-US/docs/Web/API/AnalyserNode] | Time-domain + frequency-domain sampling of the live master output | The only standard, zero-dependency way to get FFT/waveform data from a Web Audio graph; every browser audio visualizer (including MDN's own reference implementation) uses it |
| `CanvasRenderingContext2D` | HTML Canvas API (native) [CITED: developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D] | Per-frame imperative draw of the waveform line and spectrum bars | D-01 already locks Canvas 2D over SVG/WebGL |
| `requestAnimationFrame` / `cancelAnimationFrame` | Web APIs (native) | Drives the draw loop at display refresh rate, outside Angular's CD | D-03 already locks this over `setInterval` |
| `viewChild` (signal-based) + `afterNextRender` | `@angular/core` ^22.1.0 [VERIFIED: package.json, read this session] | Acquire the canvas `ElementRef`/2D context exactly once, after the view is in the DOM | Angular 22's signal-based successor to `@ViewChild` + `AfterViewInit`; already the idiomatic pattern for one-time non-Angular-library DOM initialization [CITED: angular.dev/api/core/afterNextRender] |
| `DestroyRef.onDestroy` | `@angular/core` ^22.1.0 | Guarantees `cancelAnimationFrame` runs on component/service teardown | Already this codebase's established cleanup convention (`MotionPreference`, `WorkletSynthEngine.destroy()`), not a new pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none)* | — | — | — |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas 2D | SVG (`<rect>`/`<path>` per bar/sample) | Rejected by D-01 — 1024+ DOM nodes redrawn per frame at 60fps would fight the "no CD per animation frame" success criterion even with `@defer`/manual DOM writes; Canvas 2D's single draw-call-per-frame model is the standard fit for continuously-updating dense numeric data. |
| Canvas 2D | WebGL / `OffscreenCanvas` + Worker | Rejected by D-01 as unjustified overkill for a two-lane, low-resolution (2048-sample) display; would add real complexity (shader setup, or worker message-passing) for no measurable benefit at this data volume. |
| `AnalyserNode` on master output | Per-operator `AnalyserNode`s (six taps) | Rejected by D-02 — phase scope is "hear the whole instrument," not per-operator debugging; six taps would also mean six read-buffers to poll every frame for no phase requirement asking for it. |
| Bounded random walk from current patch (D-13) | Uniform random sampling across each field's full range | Rejected by D-13 — uniform sampling across (e.g.) `outputLevel`'s 0-99 range independently per operator has a well-known failure mode: every operator's level landing near 0 simultaneously produces silence, which is a poor "randomize" experience for a teaching tool whose whole point is an audible, explicable change. |

**Installation:**
```bash
# No new packages — this phase adds zero npm dependencies.
```

**Version verification:** Not applicable — no new packages installed. `@angular/core` is already
pinned at `^22.1.0` in `package.json` (read this session); no version change needed for any API
used in this phase (`AnalyserNode`, Canvas 2D, `viewChild`, `afterNextRender` are all already
available in that installed version).

## Package Legitimacy Audit

**Not applicable.** This phase installs no new external packages — the oscilloscope/spectrum are
built on native `AnalyserNode`/Canvas 2D browser APIs, and A/B compare + randomization are built
entirely on this project's own already-tested `InstrumentState` facade and domain layer. The
Package Legitimacy Gate protocol is skipped per its own trigger condition ("whenever this phase
installs external packages"), mirroring `09-RESEARCH.md`'s identical disposition for its
no-new-packages phase.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
 User gesture (Enable Audio / play a note)
          │
          ▼
 WorkletSynthEngine.buildAndStart()
          │  creates masterGain, connects:
          │    node → masterGain → [NEW] analyser → context.destination
          ▼
 ┌────────────────────────────────────────────────────────────┐
 │  Live Web Audio graph (running continuously once 'ready')   │
 │  AudioWorkletNode → masterGain → AnalyserNode → destination │
 └────────────────────────────────────────────────────────────┘
          │  analyser accumulates time-domain + FFT frequency-domain
          │  data every render quantum, independent of anything below
          ▼
 WorkletSynthEngine (new plain methods, NOT signals)
   readTimeDomainInto(buffer: Uint8Array): void
   readFrequencyInto(buffer: Uint8Array): void
          │  polled imperatively, once per requestAnimationFrame tick
          ▼
 Visualizer component (features/playground, new)
   viewChild<ElementRef<HTMLCanvasElement>> × 2 (oscilloscope, spectrum)
   afterNextRender(() => start RAF loop)
   RAF tick:
     1. engine.readTimeDomainInto(timeBuf)  → draw waveform line
     2. engine.readFrequencyInto(freqBuf)   → bucket onto log-x bars, draw
     3. requestAnimationFrame(tick)
   DestroyRef.onDestroy(() => cancelAnimationFrame(handle))
          │
          ▼
 <canvas> pixels update every frame — zero Angular signal writes,
 zero change detection triggered by this loop

 ───────────────────────────────────────────────────────────────

 Separately: A/B + Randomize tools panel (features/playground)
   [Capture A] [Capture B] [Recall A] [Recall B] [Reset] [Randomize]
          │  each a direct method call, no new state logic (D-09/D-14)
          ▼
 InstrumentState (existing facade + one new command)
   captureSnapshot / recallSnapshot / hasSnapshot / reset   (existing)
   randomize()                                              (new)
          │  randomize() delegates bounds/delta math to a new
          │  domain/dx7 pure function, then writes through the
          │  existing validate-first-then-immutable-write pattern
          ▼
 patch signal changes → WorkletSynthEngine's constructor effect()
 (existing, unchanged) re-applies the new patch to the live worklet
```

### Recommended Project Structure

```text
src/app/
├── core/audio/
│   ├── audio-context.token.ts          # extend: AnalyserNodeLike, createAnalyser()
│   ├── worklet-synth-engine.ts         # extend: analyser field, insertion point, read methods
│   └── testing/
│       └── fake-audio-context.ts       # extend: FakeAnalyserNode
├── domain/dx7/
│   └── randomization/                  # new folder, mirrors dsp/ and models/ siblings
│       ├── random-walk-patch.ts        # pure function: (patch, rng) => InstrumentPatch
│       └── random-walk-patch.spec.ts
├── state/
│   └── instrument-state.ts             # extend: randomize() command
└── features/
    └── playground/
        ├── visualizer/                 # new component: oscilloscope + spectrum canvases
        │   ├── visualizer.ts
        │   ├── visualizer.html
        │   ├── visualizer.scss
        │   └── visualizer.spec.ts
        ├── tools-panel/                # new component: A/B + Randomize buttons
        │   ├── tools-panel.ts
        │   ├── tools-panel.html
        │   ├── tools-panel.scss
        │   └── tools-panel.spec.ts
        ├── playground.ts               # extend: embed visualizer + tools-panel, trim comingSoon
        └── playground.html
```

### Pattern 1: Minimal `*Like` surface extension (D-02)

**What:** Add exactly the `AnalyserNode` members this app needs — never the full DOM
`AnalyserNode` interface — to `AudioContextLike`, following the existing `GainNodeLike`/
`DelayNodeLike` precedent read this session.

**When to use:** Any time a new native Web Audio node type needs to cross the `AudioContextLike`
boundary.

**Example (recommended shape, following the exact conventions of the existing file):**
```typescript
// Source: pattern derived from src/app/core/audio/audio-context.token.ts (read this session,
// see GainNodeLike/DelayNodeLike at lines 36-42) — the shape below extends that same file.

export interface AnalyserNodeLike extends AudioNodeLike {
  fftSize: number;
  readonly frequencyBinCount: number; // always fftSize / 2 [CITED: MDN AnalyserNode.frequencyBinCount]
  getByteTimeDomainData(target: Uint8Array): void;
  getByteFrequencyData(target: Uint8Array): void;
}

export interface AudioContextLike {
  // ...existing members unchanged...
  createAnalyser(): AnalyserNodeLike;
}
```
The corresponding `FakeAudioContext.createAnalyser()` should push into a `createdAnalysers: FakeAnalyserNode[]` array, following the exact `createGain`/`createdGains` precedent at `fake-audio-context.ts:183-187` (read this session). `FakeAnalyserNode` should extend the same private `FakeAudioNode` base class the existing fakes use (`fake-audio-context.ts:95-110`, read this session) and can return deterministic canned byte arrays (e.g. all-128 for time-domain "silence", a settable synthetic spectrum) so a visualizer spec never depends on `Math.random` or real FFT math.

### Pattern 2: `AnalyserNode` insertion point (D-02)

**What:** Insert the new analyser between `masterGain` and `context.destination` inside
`WorkletSynthEngine.buildAndStart()`.

**Example — exact current code this phase modifies** (`worklet-synth-engine.ts:275-291`, read
this session):
```typescript
// CURRENT (verbatim, read this session):
      const masterGain = context.createGain();
      const now = context.currentTime;
      masterGain.gain.setValueAtTime(0, now);

      node.connect(masterGain);
      masterGain.connect(context.destination);

      built.masterGain = masterGain;
      return built;
```
```typescript
// RECOMMENDED CHANGE (pattern, not yet in the codebase):
      const masterGain = context.createGain();
      const analyser = context.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE; // 2048, D-08
      const now = context.currentTime;
      masterGain.gain.setValueAtTime(0, now);

      node.connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(context.destination);

      built.masterGain = masterGain;
      built.analyser = analyser; // add to BuiltWorkletGraph interface (line 41-45)
      return built;
```
This also requires: (1) adding `analyser: AnalyserNodeLike | null` to the `BuiltWorkletGraph`
interface (`worklet-synth-engine.ts:41-45`, read this session), (2) disconnecting it in
`discardLocalGraph` (`worklet-synth-engine.ts:299-306`) and `teardownGraph`
(`worklet-synth-engine.ts:479-491`) alongside `masterGain?.disconnect()`, and (3) exposing two
plain methods (not signals) such as `readTimeDomainInto(buffer: Uint8Array): void` /
`readFrequencyInto(buffer: Uint8Array): void` that no-op when `this.analyser === null` (mirrors
every existing `if (this.node === null) return;` guard already in this file).

### Pattern 3: Log-frequency bucketing for a bar spectrum (D-05/D-07)

**What:** `AnalyserNode.getByteFrequencyData()` returns `frequencyBinCount` (= `fftSize / 2`
[CITED: MDN AnalyserNode]) linearly-spaced bins, where bin `i`'s center frequency is
`i * sampleRate / fftSize` [CITED: developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/frequencyBinCount].
At `fftSize = 2048` and a typical `sampleRate = 44100` (read as `context.sampleRate`, never
hardcoded — `worklet-synth-engine.ts` already reads `context.sampleRate` nowhere directly but
`FakeAudioContext.sampleRate = 44100` at `fake-audio-context.ts:149`, read this session, confirms
the fake's value), each bin is ~21.5 Hz wide. A fixed number of visual bars (e.g. 32) with
log-spaced edge frequencies must each aggregate (max or average) the linear bins that fall within
their band — a single linear bin index does not correspond 1:1 to a log-axis bar.

**Recommended approach:**
```typescript
// Pattern (not from an external source — standard "graphic EQ" bucketing technique,
// derived from the frequencyBinCount/sampleRate relationship [CITED: MDN AnalyserNode]).
// MIN_DISPLAY_HZ must be > 0 — a log scale is undefined at 0 Hz.
const MIN_DISPLAY_HZ = 20;   // low end of typical hearing / DX7 audible range
const MAX_DISPLAY_HZ = 20000;

function barEdgesHz(barCount: number): number[] {
  const ratio = Math.pow(MAX_DISPLAY_HZ / MIN_DISPLAY_HZ, 1 / barCount);
  return Array.from({ length: barCount + 1 }, (_, i) => MIN_DISPLAY_HZ * ratio ** i);
}

function binIndexForHz(hz: number, sampleRate: number, fftSize: number, binCount: number): number {
  const index = Math.round((hz * fftSize) / sampleRate);
  return Math.min(Math.max(index, 0), binCount - 1);
}

// Per frame: for each bar, take the max byte value across
// [binIndexForHz(edges[i]), binIndexForHz(edges[i+1])) — max (not average) reads more like a
// classic graphic-EQ meter and avoids a wide high-frequency bar (many bins) looking artificially
// quiet next to a narrow low-frequency bar (one or two bins) under averaging.
```
Tick labels (D-06: "100 Hz / 1 kHz / 10 kHz") place their x-position using the same log formula
inverted: `x = width * Math.log(hz / MIN_DISPLAY_HZ) / Math.log(MAX_DISPLAY_HZ / MIN_DISPLAY_HZ)`.

### Pattern 4: RAF start/stop lifecycle in a zoneless OnPush component

**What:** Acquire the canvas element(s) once via signal-based `viewChild`, start the loop from
`afterNextRender` (runs once, after the view is first in the DOM — the documented replacement for
`AfterViewInit`-style DOM initialization [CITED: angular.dev/api/core/afterNextRender]), and
guarantee teardown via `DestroyRef.onDestroy`, matching this codebase's existing cleanup
convention (`MotionPreference`, `worklet-synth-engine.ts:153`, both read this session) rather than
implementing `OnDestroy` as a class method.

**Why not the CLAUDE.md `effect()` exception:** CLAUDE.md's narrow `effect()` carve-out is for
"imperative synchronization with an external system" driven by a *signal change* (e.g.
`LessonDetail`'s `startingPatch` re-sync on route reuse). A RAF draw loop is not reacting to any
Angular signal — it is a self-perpetuating native callback chain outside the signal graph entirely
(D-03's explicit point). Starting it from `afterNextRender` (a render hook, not a reactive
primitive) more accurately expresses "run once after the view exists," and keeps the loop from
ever being re-entered by an unrelated signal write the way an `effect()` body theoretically could
be.

**Example:**
```typescript
// Pattern, following this codebase's existing conventions (viewChild + afterNextRender is not
// yet used anywhere in this repo — confirmed no matches for viewChild/ElementRef/
// afterNextRender/afterRenderEffect under src/app this session — so this is the first instance;
// DestroyRef.onDestroy cleanup mirrors MotionPreference/WorkletSynthEngine exactly).
import { afterNextRender, viewChild, DestroyRef, ElementRef, inject } from '@angular/core';

export class Visualizer {
  private readonly destroyRef = inject(DestroyRef);
  private readonly oscilloscopeCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('oscilloscope');
  private readonly spectrumCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('spectrum');
  private rafHandle: number | null = null;

  constructor() {
    afterNextRender(() => {
      const scopeCtx = this.oscilloscopeCanvas().nativeElement.getContext('2d');
      const spectrumCtx = this.spectrumCanvas().nativeElement.getContext('2d');
      const timeBuf = new Uint8Array(/* fixed size, allocated once */);
      const freqBuf = new Uint8Array(/* fixed size, allocated once */);

      const tick = (): void => {
        // engine.readTimeDomainInto(timeBuf); draw with scopeCtx
        // engine.readFrequencyInto(freqBuf); bucket + draw with spectrumCtx
        this.rafHandle = requestAnimationFrame(tick);
      };
      this.rafHandle = requestAnimationFrame(tick);
    });

    this.destroyRef.onDestroy(() => {
      if (this.rafHandle !== null) {
        cancelAnimationFrame(this.rafHandle);
      }
    });
  }
}
```

### Pattern 5: Bounded random walk over `OperatorParameters` (D-12/D-13)

**What:** A pure `domain/dx7` function that takes the current `InstrumentPatch`, walks every
numeric field by a bounded random delta, clamps to that field's valid range, and returns a new
patch — never mutating the input (matches every existing domain function's immutability
convention).

**Concrete field-by-field plan**, built on the exact bounds read this session:

| Field | Type/range (source, read this session) | Recommended walk |
|-------|------------------------------------------|-------------------|
| `outputLevel` | integer 0-99 (`MIN_OUTPUT_LEVEL`/`MAX_OUTPUT_LEVEL`, `operator-parameters.ts:60-61`, quoted: `"export const MIN_OUTPUT_LEVEL = 0;"` / `"export const MAX_OUTPUT_LEVEL = 99;"`) | `±20` (≈20% of the 99-wide range), clamp to 0-99, round to integer |
| `detune` | integer -7..7 (`MIN_DETUNE`/`MAX_DETUNE`, `operator-parameters.ts:62-63`, quoted: `"export const MIN_DETUNE = -7;"` / `"export const MAX_DETUNE = 7;"`) | `±3` (≈20% of the 14-wide range), clamp to -7..7 |
| `envelope.rates[0..3]` | integer 0-99 each (`MIN_ENVELOPE_RATE`/`MAX_ENVELOPE_RATE`, `operator-parameters.ts:69-70`, quoted: `"export const MIN_ENVELOPE_RATE = 0;"` / `"export const MAX_ENVELOPE_RATE = 99;"`) | `±20` each, independently, clamp to 0-99 |
| `envelope.levels[0..3]` | integer 0-99 each (`MIN_ENVELOPE_LEVEL`/`MAX_ENVELOPE_LEVEL`, `operator-parameters.ts:64-65`, quoted: `"export const MIN_ENVELOPE_LEVEL = 0;"` / `"export const MAX_ENVELOPE_LEVEL = 99;"`) | `±20` each, independently, clamp to 0-99 |
| `feedback` (instrument-level) | integer 0-7 (`MIN_FEEDBACK_LEVEL`/`MAX_FEEDBACK_LEVEL`, `patch.ts:30-31`, quoted: `"export const MIN_FEEDBACK_LEVEL = 0;"` / `"export const MAX_FEEDBACK_LEVEL = 7;"`) | `±1` or `±2` (≈20% of the 7-wide range), clamp to 0-7 |
| `ratio` | one of 32 discrete positions, `COARSE_RATIOS` (`operator-parameters.ts:83-86`, quoted: `"export const COARSE_RATIOS: readonly number[] = Object.freeze([0.5, ...Array.from({ length: 31 }, (_, index) => index + 1),]);"`) — **not a continuous range** | Walk the *array index* by `±6` positions (≈20% of 32 entries), clamp index to 0..31, snap to `COARSE_RATIOS[index]` — never interpolate a value not present in this discrete list, since `validateOperatorParameters`'s `ratio` branch (`operator-parameters.ts:258-265`, quoted: `"if (ratio === undefined \|\| !isCoarseRatio(ratio)) { throw new RangeError(...) }"`) rejects any value not in `COARSE_RATIOS` |
| `fixedFrequencyHz` | validated only as `> 0` and finite (`operator-parameters.ts:267-271`, quoted: `"if (fixedFrequencyHz === undefined \|\| !Number.isFinite(fixedFrequencyHz) \|\| fixedFrequencyHz <= 0) { throw ... }"`) — **no declared upper bound anywhere in this file** | See Open Questions — a practical working range must be chosen before a "±20% of valid range" delta is computable; this is a genuine gap, not an oversight in this research |
| `mode` (`'ratio'` \| `'fixed'`) | two-value enum, not numeric (`OperatorFrequencyMode`, `operator-parameters.ts:27`) | **Recommend excluding from the random walk** — see Open Questions; a "bounded random walk" has no natural meaning for a two-value discrete toggle, and D-12 explicitly excludes the structurally analogous case (algorithm/routing topology) for the same reason |
| `enabled` (boolean) | `true`/`false` | **Recommend excluding** — same reasoning as `mode`; toggling an operator on/off is a topology-adjacent, non-continuous change, not addressed by D-12's field list |

**Every field must still be funneled through `validateOperatorParameters`/
`validateFeedbackLevel` before being written** — the random-walk function computing an in-range
delta is a design intent, not a substitute for the same validate-first-then-immutable-write
discipline `updateOperator`/`setFeedback` already enforce (`instrument-state.ts:173-198`, read
this session). This also gives `InstrumentState.randomize()` a free regression guard: if a future
edit to the domain range constants and the random-walk bounds ever drift apart, the validator
(not a silent out-of-range write) is what catches it.

**Example (recommended pure-function shape):**
```typescript
// Pattern for src/app/domain/dx7/randomization/random-walk-patch.ts — DOMAIN-04 pure, zero
// Angular imports, rng injected as a parameter (not a hidden Math.random() call) so a spec can
// pass a deterministic fake sequence rather than mocking a global.
export function randomWalkInteger(current: number, min: number, max: number, deltaFraction: number, rng: () => number): number {
  const range = max - min;
  const delta = Math.round((rng() * 2 - 1) * deltaFraction * range);
  return Math.min(max, Math.max(min, current + delta));
}
```

### Anti-Patterns to Avoid
- **Wrapping analyser reads in a `signal`/`computed`:** Immediately reintroduces per-frame change
  detection, defeating VIZ-01's explicit success criterion and D-03. Analyser data must be read
  into a plain, pre-allocated `Uint8Array` inside the RAF callback and drawn directly — it never
  touches the signal graph.
- **Storing the `AnalyserNode` (or any `AudioNode`) itself on a component:** CLAUDE.md: "Never
  store AudioNodes in Angular signal state." The safer shape is for `WorkletSynthEngine` to keep
  owning the analyser as a private plain field (exactly like it already does for `masterGain`) and
  expose only data-copying methods (`readTimeDomainInto`/`readFrequencyInto`) — the component
  never receives a node reference at all, signal or otherwise.
- **Allocating a new `Uint8Array` every animation frame:** `getByteTimeDomainData`/
  `getByteFrequencyData` are designed to write into a caller-supplied, reused buffer [CITED: MDN
  AnalyserNode] — allocate `timeBuf`/`freqBuf` once (sized `fftSize` and `frequencyBinCount`
  respectively) outside the RAF loop, not per tick. Mirrors this codebase's own stated DSP
  principle ("DSP code must not allocate excessively inside the audio render loop") applied to the
  render loop's sibling concern.
- **Uniform-random sampling instead of a bounded walk:** Explicitly rejected by D-13 — see
  Alternatives Considered.
- **Randomizing `algorithmId`/routing:** Explicitly excluded by D-12 — `randomize()` must never
  call `setAlgorithm` or otherwise touch `patch.algorithmId`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FFT / frequency analysis | A custom FFT implementation over raw PCM samples | `AnalyserNode.getByteFrequencyData()` | The browser's Web Audio implementation already computes this on the audio thread, sample-accurate and at zero extra CPU cost to the main thread — reimplementing FFT math for a teaching-tool spectrum display would be significant, error-prone effort for a strictly worse result. |
| Waveform sampling | Manually tapping raw audio buffers via `ScriptProcessorNode`/`AudioWorkletNode` message-passing | `AnalyserNode.getByteTimeDomainData()` | `ScriptProcessorNode` is deprecated [CITED: developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode — "Deprecated"], and piping raw samples through worklet `postMessage` for a visualization is exactly the "don't hand-roll" case `AnalyserNode` exists to solve — it is a purpose-built, zero-latency-cost read tap. |
| Log-scale axis math | A charting library (D3, Chart.js, etc.) just for two canvases | The ~10-line log-interpolation formulas in Pattern 3 above | D-01 already rejects anything heavier than Canvas 2D for this; a full charting library's DOM/update-cycle model would also reintroduce the exact CD-per-frame problem D-01/D-03 are designed to avoid, on top of being unnecessary for two fixed-shape displays. |
| Randomization RNG source | A seeded-PRNG npm package | `Math.random` behind an injected `rng: () => number` parameter (default `Math.random`) | No project precedent for pseudo-random generation exists yet (confirmed: zero `Math.random` usages under `src/app` this session) and none is needed — a parameter-injected RNG gives full test determinism without adding a dependency; a seeded PRNG library would only be justified by a reproducible-seed feature request, which is out of this phase's scope. |

**Key insight:** Every "hand-roll risk" in this phase is a native-API substitute, not a
new-algorithm risk — the browser already solves FFT and waveform sampling exactly as well as this
phase needs, and the log-axis math is genuinely small enough to own directly rather than pull in a
dependency whose update-cycle model would fight D-01/D-03 anyway.

## Common Pitfalls

### Pitfall 1: `findMasterGain()` test helper breaks silently once the analyser is inserted
**What goes wrong:** `worklet-synth-engine.spec.ts`'s `findMasterGain()` helper
(`worklet-synth-engine.spec.ts:76-82`, read this session) locates the master gain node by
`context.createdGains.find((gain) => gain.connections.has(context.destination))`. Once
`masterGain.connect(analyser); analyser.connect(context.destination);` replaces the direct
connection (Pattern 2), `masterGain` no longer has `context.destination` in its `connections` set
— the helper will throw `'masterGain was not created — buildAndStart did not run as expected'` on
every spec that calls it (multiple call sites: lines 252, 266, 357, 369, read this session), even
though `masterGain` was, in fact, created correctly.
**Why it happens:** The helper's identification strategy was written when `masterGain` was the
graph's terminal node; the phase's own architectural change (D-02) invalidates that assumption.
**How to avoid:** Update `findMasterGain()` to instead find the gain connected to the new
analyser (`gain.connections.has(analyser)`), or expose the analyser/masterGain pair more directly
for tests. This must be a task in the plan, not a side effect discovered mid-implementation — the
existing spec file has ~5+ call sites depending on the old identification strategy.
**Warning signs:** Any pre-existing `worklet-synth-engine.spec.ts` test failing immediately after
the analyser insertion, with no change made to gain-scheduling logic itself.

### Pitfall 2: `fixedFrequencyHz` has no declared upper bound to compute "±20% of valid range" from
**What goes wrong:** D-13's formula assumes every field has a closed `[min, max]` range.
`validateOperatorParameters`'s `fixedFrequencyHz` branch only enforces `> 0` and finite
(`operator-parameters.ts:267-271`, read this session) — there is no `MAX_FIXED_FREQUENCY_HZ`
constant anywhere in the file to reuse. Applying "±20%" to an unbounded range is undefined.
**Why it happens:** `fixedFrequencyHz` was deliberately left un-upper-bounded at the validation
layer (per the file's own doc comment: "only checked for being a positive finite number, not
quantized to the DX7's discrete fixed-frequency positions — that quantization belongs to Phase
5's engine boundary"). This phase is the first consumer that needs a *practical* range for a
different reason (bounding a random walk, not validating input).
**How to avoid:** The plan must pick and document a practical working range for the random walk
specifically (e.g. `20–8000 Hz`, or the human-audible `20–20000 Hz`) as a phase-local constant —
this does not need to become a new domain-wide validation bound, only a randomization-local
ceiling. See Open Questions/Assumptions Log.
**Warning signs:** A `randomize()` invariant test that walks `fixedFrequencyHz` unboundedly and
occasionally produces an inaudible (near-0 Hz or absurdly high) frequency.

### Pitfall 3: Log(0) is undefined — a spectrum axis cannot start at 0 Hz
**What goes wrong:** Bin 0 of `getByteFrequencyData()` represents 0 Hz (DC offset); mapping it
onto a logarithmic x-axis via `Math.log(hz)` produces `-Infinity` at `hz = 0`.
**Why it happens:** A naive "log-scale every bin" implementation iterates bins starting at index
0 without special-casing DC.
**How to avoid:** Choose a nonzero floor frequency for the display (Pattern 3 recommends 20 Hz,
the conventional low end of human hearing) and either skip bin 0 entirely or clamp its display
position to the left edge.
**Warning signs:** A canvas rendering error or a bar rendered off-canvas / at `NaN` x-coordinate.

### Pitfall 4: Canvas backing-store resolution vs. CSS size (blurry render on high-DPI displays)
**What goes wrong:** Setting only a canvas's CSS `width`/`height` (or omitting the `width`/
`height` HTML attributes) leaves the backing pixel store at the browser default (300×150),
stretched to fill the CSS box — producing a blurry, low-resolution draw regardless of how precise
the drawing math is.
**Why it happens:** `<canvas>`'s HTML attributes (`width`/`height`, the actual pixel buffer size)
and its CSS size (the on-screen display size) are two independent settings that must be kept in
sync manually, including by `devicePixelRatio` for crisp rendering on high-DPI screens.
**How to avoid:** In the `afterNextRender` initialization, set
`canvas.width = cssWidth * devicePixelRatio` / `canvas.height = cssHeight * devicePixelRatio`,
then `ctx.scale(devicePixelRatio, devicePixelRatio)` once, and size the CSS box independently via
SCSS (matching this project's existing token-based sizing convention).
**Warning signs:** Visibly blurry or pixelated canvas content in manual QA, especially on a
Retina/high-DPI display.

### Pitfall 5: `getByteFrequencyData`/`getByteTimeDomainData` buffer-size mismatch
**What goes wrong:** `getByteTimeDomainData` copies time-domain samples and uses `fftSize` (2048)
as the source length; `getByteFrequencyData` copies frequency bins and uses `frequencyBinCount`
(`fftSize / 2` = 1024) [CITED: MDN AnalyserNode]. Native browsers do not throw on a length
mismatch: a shorter destination is truncated (excess source samples dropped) and a longer
destination keeps its leftover elements unchanged. A hand-rolled fake that copies without
checking length can therefore silently render a truncated waveform or a spectrum that still
holds stale bytes in the tail.
**Why it happens:** Both getters take the same buffer type (`Uint8Array`); the size-vs-purpose
convention is not enforced by the type system, and the platform copies rather than rejecting.
**How to avoid:** Name and size the two buffers unambiguously at allocation time
(`new Uint8Array(analyser.fftSize)` for time-domain, `new Uint8Array(analyser.frequencyBinCount)`
for frequency-domain) and never share one buffer between the two reads. Test doubles may
still reject any other length with a `RangeError` so a mismatch fails a named test instead of
quietly truncating.
**Warning signs:** Garbled or truncated spectrum/waveform rendering; a fake-context spec that
never actually exercises this because the fake doesn't validate buffer length.

## Code Examples

### `AnalyserNode` construction and default properties
```typescript
// Source: developer.mozilla.org/en-US/docs/Web/API/AnalyserNode (MDN, read via WebSearch this
// session) — default fftSize is 2048 (matches D-08 exactly, so this phase can rely on the
// AnalyserNode's own default rather than needing to set fftSize at all, though setting it
// explicitly documents the dependency on D-08's value rather than an implicit default).
const analyser = audioContext.createAnalyser();
// analyser.fftSize defaults to 2048; frequencyBinCount is always fftSize / 2 (read-only).
const timeDomainBuffer = new Uint8Array(analyser.fftSize);
const frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);

analyser.getByteTimeDomainData(timeDomainBuffer); // values 0-255, 128 = zero-crossing/silence
analyser.getByteFrequencyData(frequencyBuffer);   // values 0-255, per-bin dB-scaled amplitude
```

### Oscilloscope draw (time-domain line)
```typescript
// Pattern — standard Web Audio visualizer shape [CITED: developer.mozilla.org/en-US/docs/Web/
// API/Web_Audio_API/Visualizations_with_Web_Audio_API], adapted to this project's Canvas-2D-only
// (D-01) and pre-allocated-buffer (Pitfall 5) constraints.
function drawOscilloscope(ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  const sliceWidth = width / data.length;
  let x = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i]! / 128.0; // 0-255 byte -> ~0-2 range, 1.0 = silence/zero-crossing
    const y = (v * height) / 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.stroke();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|----------------|--------|
| `ScriptProcessorNode` for raw sample access | `AnalyserNode` for visualization, `AudioWorkletNode` for real-time DSP | `ScriptProcessorNode` deprecated since ~2014, formally marked deprecated in the spec [CITED: developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode] | Not directly relevant to this phase's implementation (this project already uses `AudioWorkletNode` for the DSP kernel, Phase 7) but confirms `AnalyserNode` — not a manual sample tap — is the correct, current tool for this phase's visualization need. |
| `@ViewChild` + `AfterViewInit` for one-time DOM access | Signal-based `viewChild()` + `afterNextRender()` | Angular 16 (`afterNextRender`) / Angular 17.3+ (`viewChild()` signal API) [CITED: angular.dev/api/core/afterNextRender] | This project already targets Angular ^22.1.0 and uses signal-based patterns throughout (per CLAUDE.md's own stated preference); no other component in this codebase yet uses `viewChild`/`afterNextRender` (confirmed via grep this session) — this phase is the first to need one-time native-DOM (canvas) access. |

**Deprecated/outdated:**
- `ScriptProcessorNode`: superseded by `AudioWorkletNode` (already the live engine, Phase 7) for
  DSP and by `AnalyserNode` for visualization; not used and should not be introduced by this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `randomize()` should exclude `mode` (`'ratio'`/`'fixed'`) and `enabled` (boolean) from the random walk, touching only the continuous/discrete-numeric fields D-12 lists (ratio, frequency, output level, detune, envelope rates/levels, feedback) | Architecture Patterns → Pattern 5, Open Questions | If wrong, `randomize()` should also flip `mode`/`enabled` randomly, which changes the field set and needs its own (non-"bounded-walk") random rule — a mismatch here would make randomize's output not match the user's mental model set at discussion time. Low-cost to resolve: confirm with user before implementation. |
| A2 | A practical working range for `fixedFrequencyHz`'s random walk (recommended: 20–8000 Hz) must be chosen locally for this phase, since `operator-parameters.ts` declares no upper bound | Architecture Patterns → Pattern 5, Common Pitfalls → Pitfall 2 | If the chosen range is too narrow, fixed-mode randomization feels repetitive; too wide, and it can jump to inaudible/impractical frequencies. Low risk either way since it only affects fixed-mode operators being randomized, but worth a one-line confirmation before implementation. |
| A3 | `getByteFrequencyData`'s per-byte value should be read as "0-255, higher = louder at that frequency" for bar-height mapping, and no `minDecibels`/`maxDecibels`/`smoothingTimeConstant` customization is needed beyond `AnalyserNode`'s defaults | Code Examples, Pattern 3 | If the default dB range (-100 to -30 dBFS [CITED: MDN AnalyserNode]) makes the bars look too quiet/too saturated against this project's `MASTER_GAIN = 1/6` mix level (`worklet-synth-engine.ts`/Phase 5 `05-CONTEXT.md`, not independently re-verified this session), the plan may need to tune `minDecibels`/`maxDecibels` — flagged as a tuning risk, not a functional one. |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should `randomize()` ever touch `mode` or `enabled`?**
   - What we know: D-12 lists "ratio/fixed mode + frequency, output level, detune, envelope
     rates/levels ×4" plus feedback as in scope; D-13's "bounded random walk" formula only has a
     natural meaning for continuous/discrete-numeric fields.
   - What's unclear: whether "ratio/fixed mode" in D-12's phrasing means "toggle the mode field
     itself" or "whichever of ratio/fixedFrequencyHz is currently active, randomize that one."
   - Recommendation: Treat it as the latter (A1) — exclude `mode`/`enabled` toggling from the
     random walk, since D-12 explicitly excludes the structurally similar case (algorithm/routing
     topology) for the same "don't undercut the pedagogical point" reason. Confirm with user if
     ambiguous at plan time.

2. **What practical range should bound `fixedFrequencyHz`'s random walk?**
   - What we know: `validateOperatorParameters` enforces only `> 0` and finite — no upper bound
     exists anywhere in the domain layer to reuse.
   - What's unclear: what range is "musically sensible" for a fixed-frequency operator in this
     specific instrument (D-13's stated goal).
   - Recommendation: A local (phase-scoped, not domain-wide) constant such as 20–8000 Hz (A2),
     tunable during implementation once it's actually audible against real patches.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| `AnalyserNode` (Web Audio API) | VIZ-01 oscilloscope/spectrum | ✓ (feature-detected, not assumed) | Native browser API, no version — already gated by this project's existing `AUDIO_CONTEXT_CTOR` `'unavailable'` status path (`audio-context.token.ts`, read this session) | Visualizer renders flat/empty when `AudioEngineStatus` is `'unavailable'`/`'suspended'`, per D-04 — no new fallback code needed beyond reading the existing `status` signal |
| Canvas 2D (`HTMLCanvasElement.getContext('2d')`) | VIZ-01 rendering | ✓ | Native browser API, universally supported in every browser this project already targets | None needed — Canvas 2D has no meaningful non-support case in any browser Web Audio itself requires |
| `requestAnimationFrame` | VIZ-01 draw loop | ✓ | Native browser API | None needed |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `AnalyserNode`/Web Audio itself — already has a
project-wide fallback (`AudioEngineStatus: 'unavailable'`) predating this phase; this phase adds
no new unhandled failure mode.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.8 [VERIFIED: `package.json`, read this session] via `@angular/build:unit-test` |
| Config file | Angular's `angular.json` `test` target (no standalone `vitest.config.ts` in this project — confirmed absent outside `node_modules` this session) |
| Quick run command | `npm test` (runs once and exits outside a TTY, per README/STATE.md Phase-1 precedent) |
| Full suite command | `npm test` (same — no separate quick/full split exists in this project; `npm run build:worklet` runs automatically first via the `pretest` lifecycle hook) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| VIZ-01 | `AnalyserNode` inserted between `masterGain` and `destination`; `masterGain.connect(analyser)` and `analyser.connect(context.destination)` both recorded | unit | `npm test -- worklet-synth-engine` (extend existing file; also fix `findMasterGain`, Pitfall 1) | ✅ `src/app/core/audio/worklet-synth-engine.spec.ts` exists, extend |
| VIZ-01 | `WorkletSynthEngine.readTimeDomainInto`/`readFrequencyInto` no-op safely when `analyser === null` (not yet initialized/destroyed) | unit | Same file, new `it()` blocks | ✅ extend |
| VIZ-01 | `AnalyserNodeLike` fake (`FakeAnalyserNode`) returns deterministic canned data for a spec to assert against, without touching a real FFT | unit | `npm test -- fake-audio-context` (new coverage in existing testing helper, or a small dedicated spec) | ❌ Wave 0 — `FakeAnalyserNode` does not exist yet |
| VIZ-01 | Log-frequency bucketing math (`binIndexForHz`, bar edges) produces monotonically increasing bin ranges and never indexes outside `[0, frequencyBinCount)` | unit | `npm test -- <new spectrum-bucketing spec>` | ❌ Wave 0 — new pure function, no file yet |
| VIZ-01 | RAF loop never causes an Angular signal write / change-detection trigger (structural proof, not a live-timing test) | unit or component | Assert `readTimeDomainInto`/`readFrequencyInto` are called from a plain method, not wrapped in `signal`/`computed`, and/or that the visualizer component has no `ChangeDetectorRef.markForCheck()`/signal writes in its RAF callback — a code-shape assertion, since jsdom cannot meaningfully time real RAF/CD behavior. Manual-only (code review) plus a component spec asserting the draw functions are called with expected data | ❌ Wave 0 |
| VIZ-02 (A/B) | Capture/Recall/Reset buttons call the exact existing `InstrumentState` methods with the exact slot argument; disabled state matches `hasSnapshot()` | component | `npm test -- <new tools-panel spec>` | ❌ Wave 0 — new component |
| VIZ-02 (randomize) | Every output field of `randomWalkInteger`/the patch-level `randomize` function stays within its domain-declared bounds across many RNG samples (property-style: iterate a fixed large sample count, e.g. 1000, with varied injected `rng()` values including edge cases 0 and ~1) | unit | `npm test -- random-walk-patch` (new spec) | ❌ Wave 0 — new pure function, no file yet |
| VIZ-02 (randomize) | `ratio` walk always snaps to a value present in `COARSE_RATIOS` (never an interpolated non-member value) | unit | Same new spec | ❌ Wave 0 |
| VIZ-02 (randomize) | `InstrumentState.randomize()` never touches `algorithmId` (D-12) | unit | `npm test -- instrument-state` (extend existing file) | ✅ `src/app/state/instrument-state.ts` has an existing spec file (per Phase 3 precedent — verify exact filename at plan time), extend |
| VIZ-02 (randomize) | `InstrumentState.randomize()` writes a patch that independently passes `validateOperatorParameters`/`validateFeedbackLevel` for every field (never throws) | unit | Same file, extend | ✅ extend |

### Sampling Rate
- **Per task commit:** `npm test -- <changed-spec-file-pattern>`
- **Per wave merge:** `npm test` (full suite — no separate quick/full split in this project)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus a **recommended blocking
  human-verify checkpoint** (mirroring the 05-04/06-04/07-03/08-04 precedent already established
  in this project) — this phase changes what the live engine's visualization looks like and how
  A/B/randomize feel to use, neither of which a Vitest/jsdom test can confirm: (1) the oscilloscope
  visibly tracks a played note's waveform, (2) the spectrum's log-axis bars visibly shift with
  pitch and show FM sidebands, (3) recalling a snapshot mid-note is audibly click-free (D-11's
  claim, resting on Phase 9's already-approved envelope work — worth a quick spot-check, not a
  full re-verification), (4) several Randomize presses in a row produce audibly-related-but-varied
  sounds rather than silence or harsh/broken output.

### Wave 0 Gaps
- [ ] `src/app/core/audio/testing/fake-audio-context.ts` — `FakeAnalyserNode` + `createdAnalysers` registry (extend existing file)
- [ ] `src/app/domain/dx7/randomization/random-walk-patch.ts` + `.spec.ts` — new pure function and its bounds-invariant tests
- [ ] `src/app/features/playground/visualizer/visualizer.spec.ts` — new component spec
- [ ] `src/app/features/playground/tools-panel/tools-panel.spec.ts` — new component spec
- [ ] Framework install: none — Vitest via `@angular/build:unit-test` already fully configured, no new install needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|-----------------|---------|---------------------|
| V2 Authentication | No | No auth surface in this client-only educational app (matches `09-RESEARCH.md`'s identical disposition) |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes (narrow) | `InstrumentState.randomize()` must funnel every computed field through the existing `validateOperatorParameters`/`validateFeedbackLevel` choke points before writing — same pattern as `updateOperator`/`setFeedback` — even though the "input" here is internally computed, not externally supplied, so a future bug in the random-walk math cannot silently write an out-of-range value into the live patch |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| A random-walk bug (off-by-one clamp, wrong bound constant) writes an out-of-range `OperatorParameters`/feedback value directly into `InstrumentState`'s patch signal, bypassing validation | Tampering (of internal state consistency, not an external attacker) | Route every randomize()-computed field through `validateOperatorParameters`/`validateFeedbackLevel` before the `_patch.set(...)` write, exactly as `updateOperator`/`setFeedback` already do — this is a correctness/robustness control, not an attacker-facing boundary, but it is this phase's one new state-mutation path and deserves the same discipline as every existing one |
| A malformed/never-initialized `AnalyserNode` read (`analyser === null`) throws inside a `requestAnimationFrame` callback, silently killing the draw loop with no visible error | Denial of Service (of the visualization feature only — no security impact beyond a broken UI element) | Guard every analyser-read method with the same `if (this.analyser === null) return;` pattern already used for every other engine method's `node === null`/`context === null` guards |

## Sources

### Primary (HIGH confidence)
- `src/app/core/audio/audio-context.token.ts` (read this session) — exact current `AudioContextLike`/`GainNodeLike`/`DelayNodeLike` shape
- `src/app/core/audio/testing/fake-audio-context.ts` (read this session) — exact current fake conventions
- `src/app/core/audio/worklet-synth-engine.ts` (read this session) — exact `masterGain`/graph construction, insertion point, teardown paths
- `src/app/state/instrument-state.ts` (read this session) — exact `captureSnapshot`/`recallSnapshot`/`hasSnapshot`/`reset`/`updateOperator`/`setFeedback` signatures
- `src/app/domain/dx7/models/operator-parameters.ts` (read this session) — exact field bounds and validators
- `src/app/domain/dx7/models/patch.ts` (read this session) — exact feedback bounds and `DEFAULT_PATCH`
- `src/app/core/audio/audio-worklet-node.token.ts` (read this session) — the `*Like` minimal-surface convention's second precedent
- `package.json` (read this session) — `@angular/core` ^22.1.0, `vitest` ^4.0.8
- `.planning/phases/09-.../09-RESEARCH.md` (read this session) — Validation Architecture / Package Legitimacy Audit / Security Domain section format precedent

### Secondary (MEDIUM confidence)
- developer.mozilla.org/en-US/docs/Web/API/AnalyserNode — fftSize/frequencyBinCount relationship, getByteTimeDomainData/getByteFrequencyData semantics, default fftSize (2048), default minDecibels/maxDecibels
- developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API — standard oscilloscope/spectrum draw-loop shape
- developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode — deprecation status
- angular.dev/api/core/afterNextRender — one-time DOM-initialization hook semantics

### Tertiary (LOW confidence)
- None — every claim above traces to either a file read this session or a WebSearch-surfaced official documentation page.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every API used is either already relied on by this codebase (Angular 22, Vitest) or a native, stable, long-standing Web API with no meaningful version drift risk (`AnalyserNode`, Canvas 2D, RAF).
- Architecture: HIGH for the audio-tap insertion point and existing-code integration (all read directly from source this session); MEDIUM for the log-frequency bucketing and RAF-lifecycle patterns (standard, well-documented techniques, but not verified against a single canonical official recipe — they are composed from general Web Audio/Angular documentation, not copy-pasted from one authoritative source).
- Pitfalls: HIGH for Pitfall 1 (`findMasterGain` breakage) and Pitfall 2 (`fixedFrequencyHz` bound gap) — both derived directly from reading the exact current source this session, not inferred. MEDIUM for Pitfalls 3-5 (standard, well-known Web Audio/Canvas gotchas, cited to MDN but not specific to this codebase).

**Research date:** 2026-08-17
**Valid until:** 2026-09-16 (30 days — this phase's dependencies are all stable, long-lived platform APIs and this project's own already-committed code; no fast-moving library version risk)
