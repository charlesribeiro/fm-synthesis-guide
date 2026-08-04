# Product acceptance criteria

## Definition of a useful MVP

A learner can open the application, enable audio, choose Algorithm 32 or Algorithm 1, play a note, adjust operator ratios and levels, see the routing diagram update, hear a meaningful timbral change, follow a guided experiment, and restore the original state.

## Functional

- Exactly 32 validated algorithm records are available.
- Every record identifies carriers, modulation edges, and feedback.
- The diagram is generated from the same data used by the synth engine.
- Six operator strips expose the active patch parameters.
- Audio never starts before a user gesture.
- Note-off and route changes cannot leave a stuck voice.
- The app remains navigable when audio or MIDI is unavailable.
- User progress and settings survive reload after persistence is implemented.

## Technical

- Angular 22 package versions.
- No feature NgModules.
- Zoneless configuration.
- Strict build.
- Vitest suite passes headlessly.
- Browser APIs are injected/adapted.
- No unmanaged subscriptions, timers, animation frames, or audio nodes.
- Domain graph and DSP code are independent of Angular.
- No copied copyrighted assets or unreviewed patch banks.

## Accessibility

- All controls have programmatic labels and visible values.
- Keyboard access covers navigation, operator editing, and note triggering.
- Carrier/modulator meaning is conveyed through label/icon/pattern as well as color.
- Focus indicators are visible.
- Reduced-motion preference is honored.
- SVG includes an accessible title/description or equivalent text summary.

## Test evidence

- Dataset invariant tests cover all 32 algorithms.
- Signal store behavior is tested synchronously.
- SVG tests assert topology rendering from fixtures.
- Audio boundary tests use fakes.
- DSP tests render deterministic sample blocks and reject non-finite output.
- Browser smoke tests cover audio enable, note lifecycle, and algorithm switching before public release.
