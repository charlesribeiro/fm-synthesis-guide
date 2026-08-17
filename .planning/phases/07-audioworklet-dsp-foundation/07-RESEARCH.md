# Phase 7: AudioWorklet DSP foundation - Research

**Researched:** 2026-08-11
**Domain:** Web Audio `AudioWorkletProcessor` DSP kernels; Angular 22 esbuild-based build integration for non-bundled browser scripts; deterministic offline testing of audio-rate math
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Live-engine cutover scope**
- **D-01:** The new worklet engine stays fully isolated this phase — built and Vitest-tested, but
  `SYNTH_ENGINE` keeps resolving to `WebAudioSynthEngine`. Nothing in Playground or the `/learn`
  lessons calls the new engine. Matches the ROADMAP's Phase 7 success criteria exactly ("worklet
  loads and runs," "tested... outside the browser" — nothing about becoming the live sound), and
  avoids regressing Lesson 6 (Algorithm 1 is a modulation stack, which this phase's kernel can't
  route yet).
- **D-02:** The new engine implements the existing `SynthEngine` interface
  (`setAlgorithm`/`updateOperatorLevel`/`setFeedback`/`noteOn`/`noteOff`/`allNotesOff`/`destroy`)
  now, even though nothing consumes it yet. Unsupported calls (routing, feedback) may no-op or
  throw clearly. Proves the interface shape holds today so the eventual swap in a later phase is a
  drop-in provider change, not a rewrite — matching `synth-engine.token.ts`'s own comment that this
  DI seam exists for exactly that swap.

**Kernel/graph boundary**
- **D-03:** The operator primitive accepts an optional per-sample phase-modulation input (defaults
  to 0/unconnected) as a first-class part of the kernel — the core PM capability — even though only
  the additive (input-always-0) and single-operator cases are exercised this phase. — **Reversibility:**
  costly — Phase 8 (ENGINE-02, all 32 topologies + feedback) builds its graph traversal directly on
  top of this primitive; if the modulation-input port isn't there from the start, Phase 8 would have
  to rework the operator primitive itself once other code already depends on its shape, not just add
  a routing layer around it.
- **D-04:** The additive multi-operator proof uses a synthetic N-operator fixture (e.g. six
  independent carriers, hand-picked frequencies) — it does not read through the canonical dataset
  (`algorithms.ts`/`derive-role.ts`). Graph-to-kernel-config translation from the real 32-algorithm
  dataset is explicitly Phase 8's job; this keeps Phase 7's diff scoped to `core/audio` (or wherever
  the kernel lands) without pulling a thin slice of graph-reading logic in early.

**Correctness proof**
- **D-05:** "Runs... correctly" is proven by matching an analytical reference, not just the
  `docs/ACCEPTANCE_CRITERIA.md` floor ("reject non-finite output"). A single sine operator's
  rendered block is asserted against the closed-form `sin(2πft)` reference within a numeric
  tolerance; the additive case asserts the summed output equals the per-operator sum. Exact
  tolerance/sample-rate/block-size values are Claude's Discretion, informed by research.

**Audible checkpoint this phase**
- **D-06:** A minimal dev-only harness is in scope — a small, non-shipped page or standalone script
  that loads the worklet in a real browser and lets a human trigger the single-operator and additive
  cases by ear. Proves "the worklet loads and runs" in a real `AudioWorkletGlobalScope`, which no
  Vitest/jsdom-based test of the pure kernel module can do (jsdom has no Web Audio API at all, per
  `05-RESEARCH.md` Pitfall 6 — the same gap applies to `AudioWorkletGlobalScope`).
- **D-07:** Using the harness to actually listen is a blocking human-verification checkpoint in the
  plan — mirrors the precedent set in Phase 5 (05-04 listening checkpoint) and Phase 6 (06-04
  blocking verification). The phase cannot be marked complete without a human confirming the worklet
  sounds right, since Phase 8 and 9 build directly on top of this kernel being trustworthy.

### Claude's Discretion
- Exact numeric tolerance, sample rate, and block-size assumptions for D-05's analytical-match
  tests.
- Exact file/module layout for the pure DSP kernel (e.g. a new `src/app/domain/dx7/dsp/` or under
  `src/app/core/audio/`) and the thin `AudioWorkletProcessor` adapter around it — informed by
  CLAUDE.md's domain-purity rule (DSP logic independent of Angular) and research into how Angular
  22's esbuild-based `@angular/build:application` builder can emit a worklet as a loadable module
  (`audioWorklet.addModule()` needs a standalone script, not a bundled app chunk).
- Whether the phase-modulation math uses `Math.sin` directly or a sine lookup table this phase —
  `GSD_NEW_PROJECT_PROMPT.md` explicitly leaves this open ("sine lookup or `Math.sin` initially").
- Exact shape/location of D-06's dev harness (a dev-gated Angular route vs. a standalone HTML file
  outside the app bundle vs. an npm script) and how its DI/fake-boundary seam mirrors
  `audio-context.token.ts`'s `AudioContextLike`/`AudioParamLike` pattern so no spec ever touches a
  real Web Audio global.
- Exact operator-primitive API signature (constructor params, per-sample `render`/`process` method
  shape, how the D-03 modulation input is passed in) and whether it's a class, closure, or plain
  function — informed by CLAUDE.md's "DSP code must not allocate excessively inside the audio
  render loop" and "avoid per-frame object churn" (`docs/ARCHITECTURE.md`).
- How D-02's `SynthEngine` methods that aren't yet meaningful (`setAlgorithm` beyond the additive
  fixture, `setFeedback`, multi-operator `updateOperatorLevel` beyond the synthetic fixture) behave
  concretely — no-op, throw, or a documented partial implementation.
- Exposing worklet-loading-failure as an `AudioEngineStatus`-shaped state now (per
  `docs/ARCHITECTURE.md` §"Error handling" listing "Worklet loading failure") vs. deferring that
  wiring to whichever phase does the live cutover — informed by D-01's isolation decision.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (Full 32-algorithm graph routing and feedback state
[Phase 8, ENGINE-02] and DX7-style envelopes [Phase 9, ENGINE-03] were named during discussion as
explicitly out of scope for this phase, and are recorded as such in the Phase Boundary, not as
new deferred ideas. Wiring the new engine into the live `SYNTH_ENGINE` is likewise not deferred as a
new idea — it's the natural continuation once Phase 8/9 land.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGINE-01 | Six-operator AudioWorklet phase-modulation DSP kernel, testable offline | `## Standard Stack`, `## Architecture Patterns` (kernel/adapter/bundling split), and `## Code Examples` define the pure-kernel design and the analytical-reference Vitest pattern that prove "testable offline." `## Common Pitfalls` #1–#4 address the "AudioWorklet" build/loading/typing half of the requirement; `## Validation Architecture` maps both success criteria to concrete test commands/checkpoints. |
</phase_requirements>

## Summary

This phase's hard technical problem is not the DSP math — a phase accumulator driving `Math.sin` is
simple and already implicitly scoped by `GSD_NEW_PROJECT_PROMPT.md` — it is getting that code to run
correctly as a real `AudioWorkletProcessor` inside a browser whose main app is built by Angular 22's
esbuild-based `@angular/build:application` builder. `AudioContext.audioWorklet.addModule()` requires
a URL to a **standalone script**, evaluated inside a separate `AudioWorkletGlobalScope` realm that has
no DOM, no Angular, and (per this repo's own installed TypeScript lib.dom.d.ts, verified this session)
no ambient types for `AudioWorkletProcessor`/`registerProcessor`/`sampleRate`/`currentFrame` at all.
Angular's application builder has no first-class "emit this file as an unbundled worklet" output
target the way some other bundlers do. The workable, low-risk pattern — confirmed by community
precedent for exactly this AudioWorklet-in-a-bundler problem — is to keep the DSP kernel as a plain,
Angular-free TypeScript module (fully Vitest-testable, satisfying D-05's offline-analytical-match
requirement on its own), write a *thin* adapter file that imports that kernel and calls
`registerProcessor(...)`, and pre-bundle **only that adapter file** with `esbuild` (already vendored
in this repo via `@angular/build`, and installable directly) into a single self-contained script with
no runtime `import` statements, written to `public/` so Angular's existing asset pipeline serves it
untouched at a stable URL in both `ng serve` and `ng build`.

This repo already has every supporting pattern this phase needs: `SynthEngine`/`SYNTH_ENGINE`
(interface + swappable DI token, D-02's target), `AUDIO_CONTEXT_CTOR` + the
`AudioContextLike`/`AudioParamLike` fake-boundary interfaces (the DI/fake-boundary shape to mirror for
an `AudioWorkletNode`-like boundary), and `FakeAudioContext`/`FakeGainNode`/etc. (the hand-rolled
double pattern, no test library, that keeps every spec off real Web Audio globals). Nothing here
needs a new state-management or audio-graph pattern invented from scratch — it needs the same
patterns extended one boundary further, into a worklet.

**Primary recommendation:** Build the pure phase-modulation kernel under `src/app/domain/dx7/dsp/`
(zero Angular imports, Vitest-tested directly with a `sin(2πft)` analytical reference — this alone
satisfies success criterion 2). Write the `AudioWorkletProcessor` adapter in a directory *excluded*
from `tsconfig.app.json` (e.g. `worklets/`), typed against `@types/audioworklet`, and bundle it with
`esbuild --bundle --format=iife` into `public/worklets/dx7-worklet-processor.js` via a small prebuild
script — never let the adapter be reachable from `src/main.ts`'s import graph. Wrap the loaded
`AudioWorkletNode` behind a new `SynthEngine` implementation in `src/app/core/audio/`, exercised via a
dev-only harness for D-06/D-07's blocking human-listening checkpoint.

## Architectural Responsibility Map

This app has no server tier — it is a fully static SPA (`RELEASE-01`: "static hosting deployment").
All capabilities below live in the browser, split across two realms that do not share memory or
globals: the **main thread** (Angular, DOM, DI) and the **audio-rendering thread**
(`AudioWorkletGlobalScope`, real-time, no DOM). A third "tier" — the static-asset pipeline — matters
here because the worklet script must be reachable as a URL, not merely importable as a module.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Phase-modulation DSP kernel math (phase accumulator, PM input) | Browser/Client — Audio render thread | Build/CI (Node, via Vitest) | Must be pure enough to run identically inside `AudioWorkletGlobalScope` *and* inside plain Node under Vitest with zero browser globals (D-05's "outside the browser" clause) |
| `AudioWorkletProcessor` adapter (`registerProcessor`) | Browser/Client — Audio render thread | CDN/Static (bundled artifact) | Registers with the browser's real-time audio thread; ships as a standalone bundled script, never part of the Angular app chunk |
| Worklet module loading (`addModule`) | Browser/Client — Main thread | CDN/Static | Main-thread `AudioContext.audioWorklet.addModule()` fetches the pre-bundled static script from `public/worklets/` |
| `SynthEngine`-shaped wrapper (new engine class, D-02) | Browser/Client — Main thread (Angular DI) | — | Lives beside `WebAudioSynthEngine` in `src/app/core/audio/`; only this class talks to `AudioWorkletNode` |
| Dev-only listening harness (D-06/D-07) | Browser/Client — Main thread (dev tooling) | — | Non-shipped page/route or standalone script; exercised manually by a human, not in CI |
| Offline DSP correctness proof (D-05) | Build/CI — Node via Vitest | — | Runs with zero browser environment at all — the whole point of keeping the kernel pure |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API (`AudioWorkletProcessor`, `AudioWorkletNode`, `registerProcessor`) | Browser built-in (Baseline since ~April 2021) [CITED: developer.mozilla.org/en-US/docs/Web/API/AudioWorklet] | The only spec-sanctioned way to run custom real-time audio DSP off the main thread | This is the exact target CLAUDE.md and `GSD_NEW_PROJECT_PROMPT.md` name explicitly ("the accurate architecture target is a custom six-operator AudioWorklet phase-modulation engine") |
| `esbuild` | `0.28.1` installed (transitively via `@angular/build`), `0.28.2` latest on npm — `[VERIFIED: node_modules/esbuild/package.json read this session; npm view esbuild version this session]` | Bundles the worklet adapter + kernel into one self-contained, import-free script for `addModule()` | Angular 22's own `@angular/build:application` builder is esbuild-based internally — using the same tool for the one file it can't build keeps the toolchain uniform, and it's already resolvable in `node_modules` with zero new transitive risk |
| `@types/audioworklet` | `0.0.100` on npm, published ~3 months ago, maintained by Microsoft's `TypeScript-DOM-Lib-Generator` (the same generator that produces `lib.dom.d.ts`) — `[VERIFIED: npm view @types/audioworklet this session; package-legitimacy check verdict OK]` | Supplies ambient TS types for `AudioWorkletProcessor`, `registerProcessor`, `AudioWorkletGlobalScope`, `sampleRate`, `currentFrame` — none of which exist in the installed `lib.dom.d.ts` — `[VERIFIED: node_modules/typescript/lib/lib.dom.d.ts read this session — contains AudioWorkletNode (line 4643) and AudioParamMap (line 4544) but zero occurrences of "registerProcessor" and no AudioWorkletProcessor/AudioWorkletGlobalScope declarations]` | Official, generator-sourced fragment of the same DOM lib this project already depends on for every other Web API type — not a third-party guess at the shape |
| Vitest `^4.0.8` (already installed) | Already in `package.json` devDependencies | Runs the pure kernel's deterministic sample-block + analytical-reference tests | Already the project's mandatory test runner (CLAUDE.md); no new dependency needed for D-05 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none)* | — | — | The kernel needs no runtime math library — `Math.sin` is explicit project discretion for this phase (`GSD_NEW_PROJECT_PROMPT.md`: "sine lookup or `Math.sin` initially") |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A small prebuild `esbuild` script bundling only the worklet adapter | `@angular-builders/custom-esbuild` to hook a custom esbuild plugin directly into Angular's own build pipeline | Heavier setup, a new devDependency with its own compatibility surface against Angular's builder version, for a benefit (auto-rebuild-on-change wired into `ng serve`) this phase's minimal scope (one adapter file, changed rarely) doesn't need yet |
| `Math.sin` per-sample | A precomputed sine lookup table with linear interpolation | Only worth the added complexity/inexactness if profiling shows `Math.sin` is a real bottleneck at six operators × 128-sample blocks — no evidence of that yet, and a lookup table complicates D-05's exact-analytical-match test (interpolation error vs. `Math.sin`'s own error) |
| `processorOptions`/`port.postMessage` for this phase's minimal parameter surface | Per-operator `AudioParam`s (`parameterDescriptors`) for frequency/level, a-rate automated | Phase 7 has no live parameter automation to prove yet (single operator + a synthetic fixture, D-04) — full `AudioParam` design belongs with Phase 8/9's routing and envelope work, where audio-rate automation actually matters |

**Installation:**
```bash
npm install --save-dev esbuild @types/audioworklet
```
Note: `esbuild` is already present transitively (via `@angular/build`) at `0.28.1`; adding it explicitly pins the version this project's own build script depends on rather than relying on whatever version Angular's tooling happens to hoist.

**Version verification performed this session:**
```
$ node -e "console.log(require('esbuild/package.json').version)"
0.28.1
$ npm view esbuild version
0.28.2
$ npm view @types/audioworklet version
0.0.100
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `esbuild` | npm | ~8 yrs (evanw/esbuild); latest patch published 2026-08-08 | 255,499,108/wk | github.com/evanw/esbuild | SUS (seam reason: "too-new") | **Approved despite SUS verdict — false positive.** The "too-new" signal reflects the most recent *patch release* date, not package age or trust: 255M weekly downloads and an 8-year-old canonical repo (already the internal bundler for `@angular/build`, already present in this repo's own `node_modules` at `0.28.1`) are unambiguous legitimacy signals. Per protocol, flagging anyway: planner should add a lightweight `checkpoint:human-verify` only if this is the first time it's added as an *explicit* devDependency (it's already a resolved transitive dependency today). |
| `@types/audioworklet` | npm | Published ~3 months ago (generator-fragment package, not a "new" project) | 197,097/wk | github.com/microsoft/TypeScript-DOM-Lib-Generator | OK | Approved |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `esbuild` (false-positive "too-new" — see disposition above; planner should still gate the explicit-devDependency add behind a `checkpoint:human-verify` per protocol, even though the underlying package is already resolvable in this repo today).

## Architecture Patterns

### System Architecture Diagram

```
[Human user gesture, e.g. "Enable audio" click — D-01/CLAUDE.md gesture gate]
        │
        ▼
Main thread (Angular, src/app/core/audio/*-worklet-synth-engine.ts)
        │
        │ 1. new ctor()  (AUDIO_CONTEXT_CTOR, same DI seam as WebAudioSynthEngine)
        │ 2. await context.resume()
        ▼
        │ 3. await context.audioWorklet.addModule('/worklets/dx7-worklet-processor.js')
        │                                   │
        │                                   ▼  (static asset fetch — CDN/Static tier,
        │                                       served verbatim from public/ by Angular's
        │                                       existing asset glob, both `ng serve` and `ng build`)
        │                          Browser fetches the pre-bundled, import-free script
        │                          and evaluates it inside a NEW realm:
        │                          AudioWorkletGlobalScope (separate real-time thread,
        │                          no DOM, no Angular, no window)
        │                                   │
        │                                   ▼
        │                          registerProcessor('dx7-operator', Dx7WorkletProcessor)
        ▼
        │ 4. new AudioWorkletNode(context, 'dx7-operator', { processorOptions })
        │ 5. node.connect(context.destination)
        ▼
        │ 6. node.port.postMessage({ kind: 'noteOn', ... })  ── main → worklet, D-02's
        │                                                       SynthEngine.noteOn() forwards here
        │                                   │
        │                                   ▼
        │                          processor.port.onmessage → validated → mutates kernel state
        │                                   │
        │                                   ▼  (every 128-sample render quantum, forever,
        │                                       driven by the browser's audio clock —
        │                                       never by Angular's change detection)
        │                          processor.process(inputs, outputs, parameters)
        │                                   │
        │                                   ▼
        │                          Pure DSP kernel (src/app/domain/dx7/dsp/operator.ts)
        │                          phase accumulator += freq/sampleRate (mod 1)
        │                          Math.sin(2π · phase + optional PM input[i])   (D-03)
        │                          writes directly into the pre-allocated output channel
        │                                   │
        ▼                                   ▼
   [UI stays reactive,               AudioWorkletNode → context.destination → speakers
    audio graph never                        (D-06/D-07: human listens, blocking checkpoint)
    touches Angular signals]

── separately, and never touching the above at all ──

Vitest (Node process, zero browser)
        │
        ▼
imports src/app/domain/dx7/dsp/operator.ts directly (no addModule, no AudioContext)
        │
        ▼
renders a deterministic N-sample block at a fixed sampleRate
        │
        ▼
asserts against the closed-form sin(2πft) reference (single-operator, D-05)
asserts summed output === per-operator sum (additive fixture, D-04/D-05)
```

### Recommended Project Structure
```
src/app/domain/dx7/dsp/
├── operator.ts              # pure phase-accumulator/PM primitive — zero Angular imports,
│                             # DOMAIN-04-scoped, the only file D-05's analytical tests import
├── operator.spec.ts          # deterministic sample-block + sin(2πft) analytical reference (D-05)
├── additive-fixture.ts       # synthetic N-operator fixture (D-04) — hand-picked frequencies,
│                             # never reads algorithms.ts/derive-role.ts
└── additive-fixture.spec.ts  # asserts fixture output === per-operator sum

src/app/core/audio/
├── worklet-synth-engine.ts        # new SynthEngine impl (D-02) — owns the AudioWorkletNode,
│                                   # mirrors WebAudioSynthEngine's status-signal shape
├── worklet-synth-engine.spec.ts   # exercises it via a fake AudioWorkletNode-like boundary
├── audio-worklet-node.token.ts    # DI seam + AudioWorkletNodeLike/AudioWorkletLike fake-boundary
│                                   # interfaces — mirrors audio-context.token.ts's pattern exactly
└── testing/
    └── fake-audio-worklet-node.ts # hand-rolled double, mirrors testing/fake-audio-context.ts —
                                    # records addModule() calls and postMessage() payloads

worklets/                          # EXCLUDED from tsconfig.app.json's "include" — never reachable
│                                   # from src/main.ts's import graph, never typechecked by ng build
├── dx7-worklet-processor.ts       # thin adapter: imports operator.ts, calls registerProcessor(...)
└── tsconfig.worklet.json          # extends the base tsconfig, adds "types": ["audioworklet"]

scripts/
└── build-worklet.mjs              # esbuild prebuild: bundle worklets/dx7-worklet-processor.ts
                                    # → public/worklets/dx7-worklet-processor.js (iife, no imports)

public/worklets/
└── dx7-worklet-processor.js       # build OUTPUT (git-ignored or committed — planner's call);
                                    # served verbatim at /worklets/dx7-worklet-processor.js by
                                    # Angular's existing `{"glob": "**/*", "input": "public"}` asset
                                    # rule, in both `ng serve` and `ng build`

(dev-only harness location is Claude's Discretion per CONTEXT.md — a dev-gated route under
src/app or a standalone file outside the app bundle both satisfy D-06)
```

### Pattern 1: Pure phase-accumulator kernel with an optional PM input
**What:** A class (or closure) holding one phase accumulator, rendering a block of samples into a
caller-supplied buffer, with the D-03 modulation input as an optional per-sample `Float32Array`.
**When to use:** This is the one primitive every operator instance (single-operator case, additive
fixture, and — later — Phase 8's routed graph) is built from.
**Example:**
```typescript
// Pattern synthesized from Web Audio spec guidance (MDN "Using AudioWorklet") + this repo's own
// domain-purity precedent (src/app/domain/dx7/audio/value-conversion.ts has zero Angular imports).
// Not copied from any single source verbatim.
const TWO_PI = 2 * Math.PI;

export class PhaseModulatedOperator {
  private phase = 0; // 0..1, wraps every sample — never lets Math.sin's argument grow unbounded

  constructor(
    private readonly sampleRate: number,
    private frequencyHz: number,
  ) {}

  setFrequencyHz(frequencyHz: number): void {
    this.frequencyHz = frequencyHz;
  }

  /** Writes exactly `output.length` samples in place — never allocates
   * (CLAUDE.md: "DSP code must not allocate excessively inside the audio render loop").
   * `modulationInput` defaults to undefined (D-03: unconnected/0). A buffer
   * shorter than `output` and any non-finite sample are treated as 0 so they
   * cannot produce NaN. */
  render(output: Float32Array, modulationInput?: Float32Array): void {
    const increment = this.frequencyHz / this.sampleRate;
    for (let i = 0; i < output.length; i++) {
      const rawModulation =
        modulationInput !== undefined && i < modulationInput.length ? modulationInput[i]! : 0;
      const modulation = Number.isFinite(rawModulation) ? rawModulation : 0;
      output[i] = Math.sin(TWO_PI * this.phase + modulation);
      this.phase = (this.phase + increment) % 1; // wrap every sample — precision-stable forever
    }
  }
}
```

### Pattern 2: Thin `AudioWorkletProcessor` adapter — never imported by the app bundle
**What:** The only file in the project allowed to reference `AudioWorkletProcessor`/
`registerProcessor`/`sampleRate` (the global, not a parameter) — it imports the pure kernel and
does nothing else.
**When to use:** Exactly once per DSP kernel this project ever ships.
**Example:**
```typescript
// worklets/dx7-worklet-processor.ts — bundled standalone by scripts/build-worklet.mjs,
// never part of the Angular app chunk. Typed against @types/audioworklet
// (registerProcessor/AudioWorkletProcessor/sampleRate are NOT in this repo's lib.dom.d.ts —
// verified this session).
import { PhaseModulatedOperator } from '../src/app/domain/dx7/dsp/operator';

class Dx7WorkletProcessor extends AudioWorkletProcessor {
  private readonly operator: PhaseModulatedOperator;

  constructor(options: AudioWorkletNodeOptions) {
    super();
    const frequencyHz = (options.processorOptions as { frequencyHz?: number })?.frequencyHz ?? 440;
    this.operator = new PhaseModulatedOperator(sampleRate, frequencyHz); // `sampleRate`: worklet global
    this.port.onmessage = (event: MessageEvent) => this.handleMessage(event.data);
  }

  private handleMessage(data: unknown): void {
    // Validate before mutating kernel state — an invalid message must never reach
    // the kernel (Security Domain: malformed-message-crashes-render-thread mitigation).
    if (typeof data === 'object' && data !== null && 'frequencyHz' in data) {
      const value = (data as { frequencyHz: unknown }).frequencyHz;
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        this.operator.setFrequencyHz(value);
      }
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    this.operator.render(outputs[0][0]);
    return true; // Chrome compatibility: keep the node alive regardless of spec default
  }
}

registerProcessor('dx7-operator', Dx7WorkletProcessor);
```

### Pattern 3: DI-wrapped worklet boundary — mirrors `audio-context.token.ts`
**What:** A minimal `AudioWorkletNodeLike`/`AudioWorkletLike` interface pair and an
`AUDIO_CONTEXT_CTOR`-style token, so no spec ever touches a real `AudioWorkletNode`.
**When to use:** Any spec for the new `SynthEngine` implementation.
**Example:**
```typescript
// src/app/core/audio/audio-worklet-node.token.ts — mirrors audio-context.token.ts exactly.
export interface AudioWorkletPortLike {
  postMessage(data: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
}
export interface AudioWorkletNodeLike extends AudioNodeLike {
  readonly port: AudioWorkletPortLike;
}
export interface AudioWorkletLike {
  addModule(moduleUrl: string): Promise<void>;
}
```

### Anti-Patterns to Avoid
- **Importing the worklet adapter from any file under `src/app/`:** even an unused `import` makes it
  reachable from `src/main.ts`'s dependency graph and risks Angular's builder bundling it into the
  main chunk — at which point `addModule()` receives a URL to a script that was never designed to be
  fetched and evaluated standalone (it may pull in Angular runtime code that doesn't exist in
  `AudioWorkletGlobalScope`).
- **Writing `import ... from '...'` at the top of the *bundled* worklet script:** cross-browser
  support for ES-module imports inside `AudioWorkletGlobalScope` is inconsistent — Firefox has an open
  compatibility issue around it `[CITED: bugzilla.mozilla.org/show_bug.cgi?id=1572644]`. Bundle to a
  single self-contained script (`esbuild --bundle --format=iife`) instead.
- **Allocating a new `Float32Array`/object inside `process()`:** violates CLAUDE.md's explicit rule
  and the architecture doc's "avoid per-frame object churn." Pre-allocate everything the kernel needs
  in its constructor.
- **Reading a browser global (`sampleRate`) inside the pure kernel class itself:** breaks D-05's
  "outside the browser" testability — pass `sampleRate` in explicitly as a constructor parameter (the
  adapter reads the real worklet global and forwards it once).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Getting one TypeScript file to become a browser-loadable, import-free script | A custom Angular builder plugin, a second `ng build` target, or a hand-written string-concatenation "bundler" | `esbuild --bundle --format=iife` via a small npm prebuild script | Already vendored in this repo (via `@angular/build`), purpose-built for exactly this (bundle N modules into one self-contained script), zero new build-graph complexity |
| Typing `AudioWorkletProcessor`/`registerProcessor`/`sampleRate`/`currentFrame` | A hand-maintained `.d.ts` ambient-declarations shim | `@types/audioworklet` | Sourced from the same official generator (`microsoft/TypeScript-DOM-Lib-Generator`) that produces this project's own `lib.dom.d.ts` — a hand-rolled shim drifts from the spec and duplicates types (`AudioParamMap`) already declared elsewhere |
| Waiting for the worklet module to finish loading | A polling loop or a hand-rolled `setTimeout` retry | `await context.audioWorklet.addModule(url)` | The spec-defined `Promise` resolves only once the module has been fully fetched, parsed, and evaluated (i.e. `registerProcessor` has already run) — there is nothing to poll for |
| Band-limiting/anti-aliasing the sine oscillator | A custom band-limited-oscillator algorithm this phase | Nothing — defer entirely | This phase's proof cases (single sine operator, additive sum of sines) never exercise phase modulation at a high index near Nyquist, so no aliasing exists to band-limit yet; band-limiting only becomes a real concern once Phase 8/9 introduce routed modulation at higher indices — revisit then, not now |

**Key insight:** Every "don't hand-roll" item above exists because this project already has (or npm
already has) an exact-fit official tool — the temptation in this domain is to reach for a hand-rolled
workaround specifically *because* Web Audio + Angular's esbuild builder is an unusual combination with
thin direct documentation, not because the standard tools are missing.

## Common Pitfalls

### Pitfall 1: The worklet adapter ends up bundled into the main Angular chunk
**What goes wrong:** `audioWorklet.addModule()` is pointed at a URL served from the app's own output
(e.g. `main-XXXX.js`), which either 404s (it's not a standalone entry the builder emits) or, if forced
to resolve, evaluates a script full of Angular runtime code inside `AudioWorkletGlobalScope`, which has
no `window`/`document` and throws immediately.
**Why it happens:** Angular's `@angular/build:application` builder has no built-in "emit this file as
an unbundled worklet" output target (confirmed by search — no documented Angular-CLI mechanism for
this) — anything reachable from `src/main.ts`'s import graph gets bundled together by default.
**How to avoid:** Keep the adapter file physically outside `src/app/` and outside `tsconfig.app.json`'s
`include` glob; bundle it with a separate `esbuild` invocation into `public/worklets/`, never import it
from any Angular file.
**Warning signs:** `addModule()` rejects with a network/parse error, or the console shows
`window is not defined`/`document is not defined` errors originating from the worklet script.

### Pitfall 2: `jsdom` (and Vitest generally) cannot exercise the adapter or `AudioWorkletGlobalScope` at all
**What goes wrong:** A test tries to `import` the worklet adapter file or instantiate
`AudioWorkletProcessor` under Vitest and fails, because no Web Audio API — let alone
`AudioWorkletGlobalScope` — exists in `jsdom` (`05-RESEARCH.md` Pitfall 6, confirmed precedent in this
repo for the main-thread `AudioContext` case; the same gap applies one level deeper for the worklet
realm).
**Why it happens:** `AudioWorkletGlobalScope` is a real browser primitive with no polyfill or JSDOM
implementation.
**How to avoid:** Never try to unit-test the adapter file directly. Keep 100% of D-05's assertable
logic inside the pure kernel (`operator.ts`), which imports nothing browser-specific and is fully
Vitest-testable. The adapter is proven only by the D-06/D-07 human-listening checkpoint.
**Warning signs:** A spec file under `src/**` imports from `worklets/` — this should never compile
given the recommended directory split, and is itself a signal the split has leaked.

### Pitfall 3: TypeScript fails to compile the adapter under the app-wide `tsconfig`
**What goes wrong:** If the adapter file lives inside `src/app/` (or anywhere covered by
`tsconfig.app.json`'s `"include": ["src/**/*.ts"]`), `ng build`'s typecheck pass tries to compile it
against the app's `lib.dom.d.ts`, which — verified this session — declares `AudioWorkletNode` (line
4643) and `AudioParamMap` (line 4544) but has **zero** occurrences of `registerProcessor` and no
`AudioWorkletProcessor`/`AudioWorkletGlobalScope` declarations at all. Every reference to
`registerProcessor`, `sampleRate` (as a bare global), or `AudioWorkletProcessor` fails to typecheck.
**Why it happens:** `lib.dom.d.ts` only ships the *main-thread-visible* half of the AudioWorklet API
(what `AudioWorkletNode` exposes to the page); the worklet-side globals are a separate, not-yet-stable
DOM-lib fragment shipped only via `@types/audioworklet`.
**How to avoid:** Exclude the adapter's directory from `tsconfig.app.json`; give it its own
`tsconfig.worklet.json` (extends the base config, adds `"types": ["audioworklet"]`) so it typechecks
independently — and separately from the app's own `ng build` typecheck pass.
**Warning signs:** `ng build`/`ng lint` errors like `Cannot find name 'registerProcessor'` or
`Cannot find name 'sampleRate'` pointing at the adapter file.

### Pitfall 4: Phase accumulator precision drift on long-held notes
**What goes wrong:** If `phase` is incremented every sample without wrapping
(`phase += increment` forever, unbounded), floating-point error accumulates over a long sustained
note, and `Math.sin`'s argument eventually loses precision as it grows large.
**Why it happens:** IEEE-754 doubles lose relative precision as magnitude grows; `Math.sin` of a very
large argument is not guaranteed to preserve the same phase-wrapping accuracy as `Math.sin` of a small
one.
**How to avoid:** Wrap every sample: `phase = (phase + increment) % 1` (Pattern 1 above already does
this) — keeps `phase` bounded in `[0, 1)` for the lifetime of the process, which is what makes D-05's
long-run analytical-match tests exact rather than asymptotically approximate.
**Warning signs:** A test that renders a very long block (e.g. tens of thousands of samples) shows the
analytical-match error growing with sample index instead of staying flat.

### Pitfall 5: Allocating inside `process()`
**What goes wrong:** Creating a new `Float32Array`, object literal, or closure inside `process()` (or
inside the pure kernel's `render()`) runs on every single 128-sample render quantum — potentially
hundreds of times per second — and triggers GC pressure on the audio thread, which is exactly the kind
of jank that causes audible glitches.
**Why it happens:** It's easy to reach for `const scratch = new Float32Array(size)` inline for
convenience while writing the math.
**How to avoid:** Pre-allocate every working buffer in the constructor; `render()`/`process()` only
read/write into buffers that already exist. CLAUDE.md states this explicitly ("DSP code must not
allocate excessively inside the audio render loop").
**Warning signs:** Code review finds `new Float32Array(`, `new Array(`, or object-literal allocation
anywhere inside a method called per render quantum.

### Pitfall 6: The dev harness's `public/worklets/*.js` build output goes stale
**What goes wrong:** A developer edits `worklets/dx7-worklet-processor.ts`, refreshes the dev harness,
and hears the *old* behavior — because `ng serve` has no idea the prebuild script exists and never
re-runs it. `[ASSUMED]` — not independently verified against a running `ng serve` instance this
session; based on the fact that `angular.json`'s asset rule only copies whatever is already in
`public/` and Angular's dev-server has no dependency edge on `scripts/build-worklet.mjs`.
**Why it happens:** The esbuild prebuild step is intentionally outside Angular's own build graph (that
independence is what makes it possible at all — see Pitfall 1).
**How to avoid:** Document the manual `npm run build:worklet` step clearly (README + harness page
itself), and/or wire it as a `predev`/`prestart`/`prebuild` npm lifecycle script so it always runs
before `ng serve`/`ng build` pick up whatever is in `public/`.
**Warning signs:** A code change to the kernel or adapter has no audible effect in the harness until
the prebuild script is re-run manually.

## Code Examples

### Analytical-reference Vitest test (D-05)
```typescript
// src/app/domain/dx7/dsp/operator.spec.ts — plain Vitest globals, no TestBed, matching this
// repo's existing pure-domain spec convention (e.g. value-conversion.spec.ts).
import { PhaseModulatedOperator } from './operator';

describe('PhaseModulatedOperator', () => {
  it('renders a block matching the closed-form sin(2πft) reference within tolerance', () => {
    const sampleRate = 44100;
    const frequencyHz = 440;
    const blockSize = 128; // one render quantum — matches this repo's own precedent
                            // (web-audio-synth-engine.ts's FEEDBACK_DELAY_RENDER_QUANTUM_FRAMES)
    const operator = new PhaseModulatedOperator(sampleRate, frequencyHz);
    const output = new Float32Array(blockSize);

    operator.render(output);

    for (let i = 0; i < blockSize; i++) {
      const expected = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);
      expect(output[i]).toBeCloseTo(expected, 6);
    }
  });
});
```

### esbuild prebuild script (bundles the worklet, no runtime imports in the output)
```javascript
// scripts/build-worklet.mjs
import { build } from 'esbuild';

await build({
  entryPoints: ['worklets/dx7-worklet-processor.ts'],
  bundle: true,
  format: 'iife', // no runtime `import` statements in the output — avoids Firefox's incomplete
                   // ES-module-in-worklet support (see Anti-Patterns to Avoid)
  target: 'es2022',
  outfile: 'public/worklets/dx7-worklet-processor.js',
});
```

### Loading the worklet from the new `SynthEngine` implementation
```typescript
// src/app/core/audio/worklet-synth-engine.ts (excerpt) — mirrors WebAudioSynthEngine's
// gesture-gated initialize() shape.
async initialize(): Promise<void> {
  if (this.ctor === null || this.context !== null) return;
  const context = new this.ctor();
  this.context = context;
  await context.resume();
  await (context as unknown as { audioWorklet: AudioWorkletLike }).audioWorklet.addModule(
    '/worklets/dx7-worklet-processor.js',
  );
  // construct the AudioWorkletNode, connect to destination, set status 'ready' ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `ScriptProcessorNode` for custom DSP | `AudioWorkletProcessor` | `ScriptProcessorNode` deprecated since ~2014, removal has been threatened for years `[ASSUMED — general Web Audio history, not re-verified this session]` | `ScriptProcessorNode` runs on the main thread and is not an option for this project's zoneless/no-jank Angular UI requirement — never consider it |
| Webpack `worker-loader`/`?worker` import syntax (works for classic Web Workers in some bundlers) | No equivalent first-class syntax in Angular's esbuild `application` builder for AudioWorklets | N/A — Angular has never shipped this for AudioWorklet specifically | Confirms the pre-bundle-to-`public/` workaround is the pragmatic answer, not a stopgap for something Angular is about to add |

**Deprecated/outdated:**
- `ScriptProcessorNode`: main-thread audio processing, superseded by `AudioWorkletProcessor` for any
  new work — not relevant to this project at all since it was never used.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The recommended file layout (`worklets/` outside `src/app/`, separate `tsconfig.worklet.json`, `scripts/build-worklet.mjs`) is the right shape for this specific repo | Architecture Patterns → Recommended Project Structure | Low-medium — the underlying constraint (adapter must be an unbundled, unreachable-from-`src/main.ts` script) is well-supported by the TypeScript lib gap verified this session and the Angular-builder search findings; only the exact directory names/wiring are a recommendation, easily adjusted by the planner without touching the design's substance |
| A2 | Bundling to a single import-free IIFE avoids a real cross-browser worklet-import compatibility gap (Firefox) | Anti-Patterns to Avoid; Pitfall 1 | Low — even if the specific Firefox bug is stale/fixed by the time this ships, bundling to one self-contained script remains the safe default with no downside, so being wrong here costs nothing |
| A3 | `processorOptions`/`port.postMessage` (not per-operator `AudioParam`s) is the right parameter-passing shape for this phase's minimal scope | Standard Stack → Alternatives Considered; Pattern 2 | Low — explicitly scoped as Claude's Discretion in CONTEXT.md; if Phase 8/9 need `AudioParam`-based automation, only the adapter's message contract needs revisiting, not the pure kernel |
| A4 | Returning `true` unconditionally from `process()` is the right policy for this project's persistent-voice model | Pattern 2; Pitfall list | Negligible — returning `true` is always spec-legal; the only cost of being "wrong" here is a slightly longer-lived node than strictly necessary, not a correctness bug |
| A5 | `ng serve`'s dev-server will pick up a `public/worklets/*.js` file produced by a separate, out-of-band `esbuild` script without needing a restart | Pitfall 6 | Medium — not verified against a running dev server this session; if wrong, the planner should add an explicit "restart `ng serve` after `npm run build:worklet`" step to the D-06 harness instructions rather than assume live-reload picks it up |

## Open Questions (RESOLVED)

1. **Should `public/worklets/dx7-worklet-processor.js` be committed to git or `.gitignore`d as a build
   artifact?**
   - What we know: it's a deterministic build output of `scripts/build-worklet.mjs` from source
     already in `src/`/`worklets/` — no unique information lives only in the built file.
   - What's unclear: whether this project's convention favors committing build outputs that live under
     `public/` (the existing `public/favicon.ico` is hand-authored, not build output, so there's no
     direct precedent either way).
   - Recommendation: `.gitignore` it and run `build-worklet.mjs` as part of `prebuild`/`prestart` (and
     document it in the phase's plan/README) — consistent with not committing other generated
     artifacts, and it removes any risk of a stale committed bundle silently diverging from source.
   - **RESOLVED** (07-01-PLAN.md, Task 2): the recommendation was adopted as-is — the built bundle is
     `.gitignore`d and produced via a prebuild step.

2. **Does this project need to support Firefox/Safari for the AudioWorklet engine, or is a Chromium
   dev-gesture sufficient for D-06's blocking checkpoint?**
   - What we know: `AudioWorklet` itself is Baseline-supported broadly since ~2021; the specific
     ES-module-import-inside-worklet gap this research flags for Firefox does not affect the
     recommended bundled/import-free approach either way.
   - What's unclear: whether the human verifier for D-06/D-07 will test in more than one browser.
   - Recommendation: no action needed from research — the bundled approach sidesteps the one known gap
     regardless of which browser the checkpoint uses.
   - **RESOLVED**: no action taken — the bundled/import-free approach the plans use sidesteps the gap
     regardless of which browser the 07-03 listening checkpoint runs in.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling, `esbuild` prebuild script | ✓ | v22.22.3 (verified this session) | — |
| npm | Package management | ✓ | 11.8.0 (per `package.json` `packageManager` field) | — |
| `esbuild` | Bundling the worklet adapter | ✓ (transitively installed) | 0.28.1 installed / 0.28.2 latest | Add as explicit devDependency (see Standard Stack) |
| Real browser with `AudioWorklet` support | D-06/D-07 human-listening checkpoint | ✗ — not available/verifiable in this headless research session | — | None needed as a fallback — this checkpoint is inherently a human-in-a-real-browser step; the planner should schedule it as a blocking manual task, not attempt to automate it |
| `jsdom` | Vitest's default DOM environment for other specs | ✓ | `^28.0.0` | N/A for this phase's kernel tests — they need no DOM at all |

**Missing dependencies with no fallback:**
- A real browser for the D-06/D-07 checkpoint — this is expected and by design (per D-06/D-07 and
  `05-RESEARCH.md` Pitfall 6 precedent); not a gap to close, a step to schedule as blocking manual
  verification.

**Missing dependencies with fallback:**
- `esbuild` as an explicit devDependency — currently only transitively present; trivial `npm install
  --save-dev esbuild` closes this.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.8`, run through Angular 22's `@angular/build:unit-test` builder |
| Config file | none — no `vitest.config.ts` in this repo; the builder derives its Vitest config from `angular.json`/`tsconfig.spec.json` |
| Quick run command | `npm test` (already runs once and exits outside a TTY — documented Phase 1 decision in `.planning/STATE.md`: `npm test -- --run` is not a real flag this builder proxies) |
| Full suite command | `npm test` (same command — this project has not established a separate quick/full split; the whole suite is fast enough today) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGINE-01 | Single operator renders `sin(2πft)` within tolerance (D-05) | unit | `npm test` (covers `src/app/domain/dx7/dsp/operator.spec.ts`) | ❌ Wave 0 — new file |
| ENGINE-01 | Additive N-operator fixture output equals the per-operator sum (D-04/D-05) | unit | `npm test` (covers `additive-fixture.spec.ts`) | ❌ Wave 0 — new file |
| ENGINE-01 | New engine implements the full `SynthEngine` interface shape (D-02) | unit | `npm test` (covers `worklet-synth-engine.spec.ts`, fake `AudioWorkletNode`-like boundary) | ❌ Wave 0 — new file + new fake |
| ENGINE-01 | Worklet loads and runs correctly in a real `AudioWorkletGlobalScope` (success criterion 1) | manual, blocking (D-06/D-07) | Human uses the dev harness and listens; no automated command exists (jsdom has no `AudioWorkletGlobalScope`, Pitfall 2) | N/A — inherently manual, by design |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` green, plus the D-06/D-07 blocking human-listening checkpoint approved,
  before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/app/domain/dx7/dsp/operator.ts` + `operator.spec.ts` — new pure kernel, covers success criterion 2
- [ ] `src/app/domain/dx7/dsp/additive-fixture.ts` + `additive-fixture.spec.ts` — D-04's synthetic fixture
- [ ] `src/app/core/audio/worklet-synth-engine.ts` + `.spec.ts` — D-02's `SynthEngine` implementation
- [ ] `src/app/core/audio/audio-worklet-node.token.ts` + `testing/fake-audio-worklet-node.ts` — the DI/fake-boundary seam (Pattern 3)
- [ ] `worklets/dx7-worklet-processor.ts` + `worklets/tsconfig.worklet.json` + `scripts/build-worklet.mjs` — no Vitest coverage possible; proven only by the D-06/D-07 manual checkpoint
- [ ] Framework install: none for Vitest (already present); `npm install --save-dev esbuild @types/audioworklet` for the new build-time tooling

## Security Domain

This app has no backend, no authentication, no persistence, and no network-sourced user input at any
layer this phase touches — most ASVS categories are not applicable. The one relevant surface is the
`postMessage` boundary between the main thread and the audio-rendering thread, which — while not an
attacker-controlled boundary in this app (both ends are code this project ships) — still deserves
defensive validation, per `docs/ACCEPTANCE_CRITERIA.md`'s own explicit "reject non-finite output"
floor.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts or sessions anywhere in this app |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes (defensive, not attacker-facing) | Validate/clamp every `port.onmessage` payload before it touches kernel state (Pattern 2's `handleMessage` example); never let `NaN`/`Infinity`/non-numeric values reach `Math.sin` or a phase-accumulator field |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malformed or malicious-shaped `postMessage` payload (e.g. from a buggy future caller, or a browser extension injecting messages) mutates kernel state with a non-finite value, which then propagates through `Math.sin`/the phase accumulator and produces `NaN`/`Infinity` output — or, if `process()` itself throws, the browser stops calling it and audio silently dies for that node | Denial of Service (audio-rendering thread) | Validate every inbound message's shape and numeric ranges in `port.onmessage` *before* mutating any kernel field (Pattern 2); never let `handleMessage` throw; treat an invalid message as a no-op, matching `docs/ACCEPTANCE_CRITERIA.md`'s "reject non-finite output" test-evidence floor |
| A worklet script loaded from an unexpected origin (e.g. a misconfigured static-hosting deploy serving a stale or tampered `dx7-worklet-processor.js`) | Tampering | Not applicable at this phase's scope — this app has no user-supplied content or third-party origins; the worklet URL is a same-origin, build-time-fixed static asset path, not runtime-configurable |

## Sources

### Primary (HIGH confidence — verified this session by reading the file directly)
- `src/app/core/audio/synth-engine.ts`, `synth-engine.token.ts`, `audio-context.token.ts`,
  `web-audio-synth-engine.ts`, `testing/fake-audio-context.ts` — the DI/fake-boundary patterns this
  phase's worklet boundary must mirror
- `src/app/domain/dx7/models/operator.ts` — `OperatorId`/`OPERATOR_IDS` restricted-union type
- `src/app/domain/dx7/audio/value-conversion.ts`, `.spec.ts` — precedent for a pure, Angular-free,
  directly-Vitest-tested domain math module
- `node_modules/typescript/lib/lib.dom.d.ts` (TypeScript 6.0.3) — confirmed absence of
  `registerProcessor`/`AudioWorkletProcessor`/`AudioWorkletGlobalScope` declarations
- `node_modules/esbuild/package.json` — confirmed `esbuild` 0.28.1 already resolvable in this repo
- `eslint.config.js`, `tsconfig.json`, `tsconfig.app.json`, `angular.json`, `package.json` — build/lint
  configuration this phase's new files must fit into
- `docs/ARCHITECTURE.md` §"Audio roadmap", §"Error handling", §"Performance boundaries";
  `docs/ACCEPTANCE_CRITERIA.md` §"Test evidence"; `GSD_NEW_PROJECT_PROMPT.md` §"Stage B"

### Secondary (MEDIUM confidence — official documentation, fetched/verified this session)
- MDN, "Background audio processing using AudioWorklet" (developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet) — `AudioWorkletProcessor` structure, `registerProcessor`, `addModule`, `parameterDescriptors`, block-size/return-value guidance
- `npm view esbuild version`, `npm view @types/audioworklet version`, `npm view @types/audioworklet` (registry metadata) — version/publisher/repo verification this session

### Tertiary (LOW confidence — WebSearch snippets, not independently reproduced)
- WebSearch: Angular esbuild `application` builder + AudioWorklet bundling (no first-class Angular
  mechanism found; corroborates the pre-bundle-to-`public/` workaround by absence of a better option)
- WebSearch: AudioWorkletGlobalScope ES-module import support — cites a Mozilla Bugzilla issue
  (bugzilla.mozilla.org/show_bug.cgi?id=1572644) and community reports of Firefox-specific
  import-resolution failures inside worklets; not reproduced in an actual Firefox instance this session

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — the Web Audio API itself is HIGH-confidence/stable; the specific
  Angular-22-esbuild-builder + AudioWorklet bundling integration has no single authoritative source
  and is assembled from verified TypeScript-lib inspection + search-corroborated community workarounds
- Architecture: MEDIUM — heavily grounded in this repo's own verified existing patterns (HIGH within
  that scope), blended with the newer worklet-bundling territory (MEDIUM/LOW on its own)
- Pitfalls: MEDIUM-HIGH — Pitfalls 1-3 are grounded in a verified TypeScript lib.dom.d.ts gap plus this
  repo's own established `05-RESEARCH.md` Pitfall 6 precedent; Pitfalls 4-6 are standard DSP/build
  engineering practice with lower novelty risk

**Research date:** 2026-08-11
**Valid until:** 2026-09-10 (30 days — Web Audio spec itself is stable, but Angular's build tooling
moves fast enough that the esbuild-integration specifics here should be re-checked if this phase is
replanned significantly later)
