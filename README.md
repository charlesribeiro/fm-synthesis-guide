# DX7 Algorithm Lab

An unofficial, educational Angular 22 web app for learning six-operator FM/phase-modulation
synthesis through the Yamaha DX7's 32 operator-routing algorithms — one algorithm at a time, with
interactive routing diagrams, guided lessons, and live sound. No affiliation with Yamaha or the
Dexed project. See [full disclaimer](src/app/features/about/about.html).

**Status:** Phase 3 of 14 complete — Angular scaffold, the canonical 32-algorithm domain dataset,
and the [`InstrumentState`](src/app/state/instrument-state.ts) signal facade (immutable
patch/operator state, A/B snapshots, reset). No synthesis engine yet beyond a typed placeholder
interface ([`SynthEngine`](src/app/core/audio/synth-engine.ts)). See
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
- **Audio boundary, not yet implemented** — [`SynthEngine`](src/app/core/audio/synth-engine.ts) is
  a typed placeholder interface only. Real implementations (an MVP `OscillatorNode`/`GainNode`
  graph, later a six-operator `AudioWorklet`) land in Phases 5–9 and must never construct an
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
