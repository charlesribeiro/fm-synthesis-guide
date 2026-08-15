# DX7 Algorithm Lab

An unofficial, educational Angular 22 web app for learning six-operator FM/phase-modulation
synthesis through the Yamaha DX7's 32 operator-routing algorithms — one algorithm at a time, with
interactive routing diagrams, guided lessons, and live sound. No affiliation with Yamaha or the
Dexed project. See [full disclaimer](src/app/features/about/about.html).

**Status:** Phase 8 of 14 complete — Angular scaffold, canonical 32-algorithm domain, instrument
state, algorithm browser/SVG, first playable approximation, guided lessons (Alg 32 & 1),
AudioWorklet DSP foundation, and full algorithm routing/feedback with live cutover to
[`WorkletSynthEngine`](src/app/core/audio/worklet-synth-engine.ts). See
[`.planning/ROADMAP.md`](.planning/ROADMAP.md) for what's next.

## Setup

```bash
npm install
npm start          # dev server at http://localhost:4200
```

## Verification commands

Run all three before considering any change complete:

```bash
npm run build      # strict production build
npm test           # Vitest, headless — non-watch by default outside a TTY
npm run lint       # ESLint + Angular template/accessibility rules
```

> **Note on `npm test`:** Angular 22's `ng test` unit-test builder (Vitest-backed) has its own CLI
> surface and does not proxy arbitrary Vitest flags — `npm test -- --run` isn't recognized
> (`Unknown argument: run`). Plain `npm test` already runs once and exits outside a TTY (CI-safe);
> use `npm test -- --watch` for local watch mode. See `.planning/PROJECT.md` → Key Decisions.

## Worklet build and dev harness

The six-operator phase-modulation kernel that Phase 7's accuracy-target engine runs on is bundled
by [`scripts/build-worklet.mjs`](scripts/build-worklet.mjs) into a self-contained, import-free
`public/worklets/dx7-worklet-processor.js`, served by Angular's existing `public/` asset glob at
`/worklets/dx7-worklet-processor.js`. `prebuild`, `prestart`, and `pretest` all run
`npm run build:worklet` automatically at the start of `ng build`/`ng serve`/`ng test`, so the
bundle regenerates whenever those commands begin. If you edit worklet sources while a long-lived
watch/serve session is already running, rerun `npm run build:worklet` (or restart the command) so
the in-memory/`public/` bundle picks up the change.

A separate, opt-in **dev harness** — a standalone page with no Angular import of any kind — lets a
human hear the real built worklet run in a real browser, which no Vitest/jsdom test can reach:
jsdom implements no Web Audio API and no `AudioWorkletGlobalScope` at all. As of Phase 8, the
harness exercises the routed 32-algorithm path, not only the Phase 7 single-operator and additive
proof cases: an algorithm `<select>` (labelled with each option's id, name, and teaching-taxonomy
group), a feedback-depth slider (0–7), a "maximum operator level" checkbox for the worst-case
loudness case, and a "Play routed" button post the exact same `setAlgorithm`/
`setOperatorParameters`/`setFeedback` messages `WorkletSynthEngine` posts against the live app.
Changing the algorithm or the feedback depth while a routed note is sounding re-patches it live,
without stopping the note. To run it:

```bash
npm run start:harness    # rebuilds the harness, then serves it
# open http://localhost:4200/dev/worklet-harness.html
```

`npm run start:harness` rebuilds the harness bundle first (`prestart:harness`) and then serves it
via a dedicated `harness` build/serve configuration. **A plain `npm start` does not serve the
harness** — opening `/dev/worklet-harness.html` there 404s by design (use `start:harness`
instead). Production-build isolation is a separate guarantee: the harness writes to `dev-dist/`
outside the production asset root, as described below. To rebuild the harness bundle on its own,
without serving it, run `npm run harness`, which writes `dev-dist/worklet-harness.{js,html}`.

If you edit the kernel (`src/app/domain/dx7/dsp/**`) or the worklet adapter
(`worklets/dx7-worklet-processor.ts`) and the harness does not sound different, **rebuild
(`npm run harness`) and reload the page** before assuming the change did nothing. A plain browser
reload is enough to pick up the freshly rebuilt artifact — confirmed during the Phase 7 listening
checkpoint, where `ng serve`'s live-reload served the rebuilt bundle without a dev-server restart.
No dev-server restart is required.

The harness is a development tool only, and the guarantee that it never reaches a production build
rests on where its output is written, not on remembering not to build it a certain way. `npm run
harness` writes to `dev-dist/`, a directory entirely outside `public/` — the only directory the
production asset configuration reads — so no default `ng build` path can ever copy it into `dist/`,
regardless of what was built before it or in what order. The harness keeps its original
`/dev/worklet-harness.html` URL only through the dedicated `harness` build/serve configuration in
`angular.json`, which maps `dev-dist` to that URL and which nothing else references. A flagless
`npm run build:worklet` (used by `prebuild`/`prestart`/`pretest`) additionally removes any stale
`public/dev/` left by a pre-07-04 harness run, migration repair for machines that predate this
layout. Every `npm run build` self-asserts its own output tree via a `postbuild` hook
(`scripts/assert-no-harness-in-dist.mjs`) — a leak becomes a failed build, not a silent shipped
file. Run `npm run verify:harness-isolation` to reproduce the exact harness-then-build sequence
that once leaked and confirm it stays clean; it runs three non-watch builds and is not part of any
lifecycle hook, so run it on demand rather than on every commit.

## Architecture summary

- **Angular 22, standalone, zoneless** — no `NgModule`s, no `zone.js`; change detection is
  signal-driven (`provideZonelessChangeDetection()` in [`app.config.ts`](src/app/app.config.ts)).
- **Lazy-loaded feature routes** — `/`, `/learn`, `/algorithms`, `/playground`, `/about`, each its
  own chunk (see [`app.routes.ts`](src/app/app.routes.ts)).
- **Layered source tree**, per `GSD_NEW_PROJECT_PROMPT.md`:
  ```
  src/app/
    core/          # DI seams to browser APIs (audio, browser) — no direct window/AudioContext access
    domain/dx7/    # framework-independent FM synthesis domain model (Angular-free)
    state/         # signal-based application-state facades (instrument state now; lesson/progress,
                   # audio lifecycle, and settings facades follow in later phases)
    features/      # route-level standalone components (learn, algorithms, playground, about, home)
  ```
- **Design tokens** — CSS custom properties in [`src/styles/_tokens.scss`](src/styles/_tokens.scss)
  (color, type, spacing, motion); components read tokens, never hardcode values.
- **Audio boundary** — [`SynthEngine`](src/app/core/audio/synth-engine.ts) is the DI seam;
  production resolves to [`WorkletSynthEngine`](src/app/core/audio/worklet-synth-engine.ts) (Phase 8
  routed six-operator AudioWorklet engine). Implementations must never construct an
  `AudioContext` at module-eval time or store `AudioNode`s in Angular signal state.
- **Instrument state facade** —
  [`InstrumentState`](src/app/state/instrument-state.ts) is the single source of truth for the
  selected algorithm, the six operators' parameters, and the feedback level. Writable signals stay
  private behind read-only selectors and explicit commands; updates are immutable; operator role
  and the carrier set are derived on demand from the algorithm dataset rather than stored. A/B
  snapshots and reset are in-memory only, with versioned persistence deferred to a later phase.
- **Accessibility baseline** — skip link, landmark regions, visible focus rings, reduced-motion
  respected both in CSS (`prefers-reduced-motion` media query) and via a signal
  ([`MotionPreference`](src/app/core/browser/motion-preference.ts)) components can read to skip
  JS-driven animation.

Full architecture notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Product brief:
[`GSD_NEW_PROJECT_PROMPT.md`](GSD_NEW_PROJECT_PROMPT.md). Living project state:
[`.planning/`](.planning/) (`PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`).

## Project governance

This repository uses [GSD Core](https://github.com/open-gsd/gsd-core) (installed under `.claude/`)
as its planning harness — `.planning/` is the durable source of truth for scope and progress. In a
native Claude Code terminal, drive subsequent phases with the standard loop:

```text
/gsd-plan-phase 2
/gsd-execute-phase 2
/gsd-verify-work 2
/gsd-ship 2
```

## Disclaimer

This project is unofficial and educational, with no affiliation with Yamaha Corporation or the
Dexed project. "Yamaha" and "DX7" are used descriptively. No copyrighted ROMs, commercial patch
banks, sampled performances, proprietary manuals, or copied interface artwork are bundled with
this application. The audio engine is an educational approximation, not a claim of bit-accurate
DX7 hardware emulation — see the in-app [About page](src/app/features/about/about.html) for the
full statement.
