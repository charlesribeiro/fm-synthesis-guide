# Phase 13: Accessibility and performance hardening - Context

**Status:** Ready for planning

<domain>
## Phase Boundary

Keyboard-only navigation, screen-reader compatibility, reduced-motion honoring, mobile/tablet layout parity, and performance profiling to ensure zero resource leaks (animation frames, audio nodes, timers).

HARDEN-01 specifically mandates: "Keyboard-only and screen-reader audit, reduced motion, mobile/tablet refinement".
</domain>

<decisions>
## Implementation Decisions

### Keyboard and Screen Reader Audit
- **D-01:** Ensure every interactive control (lesson steps, algorithm selector, playground parameters, MIDI/audio toggle) is fully keyboard-accessible (Tab/Enter/Space).
- **D-02:** Verify `aria-label`, `aria-describedby`, and live regions are used appropriately (e.g., when an algorithm is selected or a lesson progresses).
- **D-03:** Focus management: when navigating between lessons or routes, ensure focus moves logically rather than resetting completely to the document body.

### Reduced Motion
- **D-04:** Check usages of `MotionPreference` and `prefers-reduced-motion` CSS media queries. Disable all CSS transitions, animations, or programmatic SVG animations (like the data-flow diagrams) when reduced motion is preferred.

### Mobile and Tablet Refinement
- **D-05:** Audit the `PlaySurface` and `InstrumentState` controls on narrow viewports. Ensure no horizontal scrolling unless explicitly intended (e.g., swipable menus).
- **D-06:** Touch targets must meet the minimum 44x44 CSS pixel recommendation.

### Performance Profiling
- **D-07:** Verify `synth-engine.ts` and `AudioContext` do not leak `AudioWorkletNode` or `OscillatorNode` instances upon repeated algorithm switching or rapid note playing.
- **D-08:** Audit `requestAnimationFrame` or RxJS timers (like those used for Oscilloscope or Spectrum visualizers) to ensure they are cleaned up cleanly on component destruction (using `DestroyRef`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `CLAUDE.md` — UI and accessibility rules, Audio rules (every created voice, oscillator, worklet, analyser, timer, and animation frame must have an explicit cleanup path).
- `.planning/ROADMAP.md` — Phase 13 goal and success criteria.
- `.planning/REQUIREMENTS.md` — HARDEN-01.
</canonical_refs>

<code_context>
## Existing Code Insights

- `MotionPreference` is already provided via DI in `core/browser/motion-preference.ts`.
- The `synth-engine.ts` handles DSP nodes.
- Oscilloscope and spectrum visualizers likely use `requestAnimationFrame` and must be checked for proper teardown.
- App layout uses SCSS design tokens (established in Phase 1).
</code_context>
