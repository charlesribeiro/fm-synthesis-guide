# Phase 10: Visualizers and comparison tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 10-Visualizers and comparison tools
**Areas discussed:** Visualizer rendering & audio tap, Spectrum display specifics, A/B compare UX, Randomization scope & constraints

---

## Visualizer rendering & audio tap

| Option | Description | Selected |
|--------|-------------|----------|
| Canvas 2D | Imperative pixel drawing, standard fit for continuous waveform/spectrum redraw | ✓ |
| SVG | Consistent with existing SVG habit but expensive to redraw every frame | |
| WebGL | Fastest but overkill for a 2-lane display | |

**User's choice:** Canvas 2D

| Option | Description | Selected |
|--------|-------------|----------|
| Master output AnalyserNode | One AnalyserNode between masterGain and destination | ✓ |
| Per-operator tap | Analyser per operator inside the worklet graph | |

**User's choice:** Master output AnalyserNode

| Option | Description | Selected |
|--------|-------------|----------|
| requestAnimationFrame outside Angular's zone | rAF never triggers CD in a zoneless app by default | ✓ |
| Fixed setInterval polling | Decouples redraw rate from display refresh rate | |

**User's choice:** requestAnimationFrame outside Angular's zone

| Option | Description | Selected |
|--------|-------------|----------|
| New visualizer panel below PlaySurface | Dedicated always-visible region in playground.html | ✓ |
| Toggle-able / collapsible panel | Adds show/hide affordance and extra state | |

**User's choice:** New visualizer panel below PlaySurface

**Notes:** All four questions in this area resolved to the recommended option.

---

## Spectrum display specifics

| Option | Description | Selected |
|--------|-------------|----------|
| Logarithmic | Matches perceived pitch/timbre, keeps FM sidebands legible | ✓ |
| Linear | Simpler mapping but crowds low frequencies | |

**User's choice:** Logarithmic

| Option | Description | Selected |
|--------|-------------|----------|
| Frequency axis ticks + accessible text summary | Visual ticks plus sr-only description | ✓ |
| Frequency ticks only | Visual only, no accessible-text fallback | |

**User's choice:** Frequency axis ticks + accessible text summary

| Option | Description | Selected |
|--------|-------------|----------|
| Bar/column style | Classic graphic-EQ look, reads clearly at low resolution | ✓ |
| Continuous line | Risks visual confusion with the oscilloscope | |

**User's choice:** Bar/column style

| Option | Description | Selected |
|--------|-------------|----------|
| Moderate — fftSize 2048 | AnalyserNode default range, enough resolution for FM sidebands | ✓ |
| You decide at implementation time | Leave exact fftSize for planning/research | |

**User's choice:** Moderate — fftSize 2048

**Notes:** All four questions in this area resolved to the recommended option.

---

## A/B compare UX

| Option | Description | Selected |
|--------|-------------|----------|
| Capture A / Capture B / Recall A / Recall B / Reset | Five buttons mapping 1:1 to existing InstrumentState methods | ✓ |
| Single toggle 'A/B' switch | Implies a currently-on-A-or-B concept not present in InstrumentState | |

**User's choice:** Capture A / Capture B / Recall A / Recall B / Reset

| Option | Description | Selected |
|--------|-------------|----------|
| Text label + disabled state | "Recall A (empty)" disabled until hasSnapshot('a') | ✓ |
| Icon only (filled vs outline circle) | New icon system for a two-slot indicator | |

**User's choice:** Text label + disabled state

| Option | Description | Selected |
|--------|-------------|----------|
| Recall applies immediately — rely on Phase 9's envelope continuity | D-04 in Phase 9 already guarantees click-safe continuous envelope motion | ✓ |
| Block recall while a note is sounding | New interaction constraint not implied by existing work | |

**User's choice:** Recall applies immediately — rely on Phase 9's envelope continuity

**Notes:** All three questions in this area resolved to the recommended option.

---

## Randomization scope & constraints

| Option | Description | Selected |
|--------|-------------|----------|
| All 6 operators' full parameter sets + feedback | Randomizes the whole sound-shaping surface; algorithm/routing untouched | ✓ |
| Levels/detune only, envelopes untouched | Narrower scope, doesn't explore envelope shape | |

**User's choice:** All 6 operators' full parameter sets + feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded random walk from the current patch | Nudges by a bounded delta, stays audibly related to current sound | ✓ |
| Uniform random within each field's full valid range | Simpler but risks extreme/silent results | |

**User's choice:** Bounded random walk from the current patch

| Option | Description | Selected |
|--------|-------------|----------|
| Applies directly to the live patch — use A/B to preserve the prior sound | Randomize is one more InstrumentState command; A/B is the natural undo | ✓ |
| Auto-capture to a slot before randomizing | Safer default but silently overwrites an existing slot | |

**User's choice:** Applies directly to the live patch — use A/B to preserve the prior sound

| Option | Description | Selected |
|--------|-------------|----------|
| One 'Randomize' button in the new visualizer/tools panel | Single explicit action, grouped with A/B controls | ✓ |
| You decide placement at planning time | Leave exact button placement for the planner | |

**User's choice:** One 'Randomize' button in the new visualizer/tools panel

**Notes:** All four questions in this area resolved to the recommended option.

---

## Claude's Discretion

- Exact bounded-random-walk delta magnitude/formula per field (illustrative ±20% given, not locked).
- Exact visual layout/grouping of the A/B and Randomize button row within the new tools panel.
- Canvas pixel dimensions, colors (respecting existing token/reduced-motion rules), and exact
  tick-label formatting on the spectrum axis.

## Deferred Ideas

None — discussion stayed within phase scope. A single A/B toggle-switch UI and an
auto-capture-before-randomize safety net were both raised and explicitly rejected, not deferred.
