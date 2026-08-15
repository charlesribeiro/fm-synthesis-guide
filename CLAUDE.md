# Claude Code project instructions — DX7 Algorithm Lab

## Mission

Build a polished Angular 22 educational instrument that teaches six-operator DX7-style FM/phase-modulation algorithms through interactive diagrams, guided lessons, and live sound.

Use GSD Core as the project harness. `.planning/` is the durable project memory. Follow the current phase plan; do not improvise across future phases unless needed to preserve an interface boundary.

## Required workflow

1. Discuss ambiguous product and architecture decisions before implementation.
2. Plan small tasks with explicit verification.
3. Write tests with or before domain logic.
4. Execute only the active phase scope.
5. Run build, unit tests, and lint before declaring work complete.
6. Make atomic commits with meaningful messages.
7. Record trade-offs and unresolved risks in GSD planning artifacts.

## Angular rules

- Angular 22 only.
- Standalone components only.
- Zoneless.
- Strict TypeScript and templates.
- Prefer signal inputs, signal outputs, `signal`, `computed`, and read-only facades.
- Use `effect` only for imperative synchronization with an external system. Do not use effects to derive state.
- Narrow exception: `LessonDetail` may use `effect()` for route-reuse-safe `startingPatch` sync into `InstrumentState` (imperative external-state sync on param reuse, not derived UI state).
- Use `@if`, `@for`, `@switch`, and `@defer` where appropriate.
- Prefer `OnPush` semantics and immutable inputs even in a zoneless app.
- Route-level features should be lazy loaded.
- Use `inject()` consistently unless constructor injection improves clarity for a special case.
- Keep templates declarative; move nontrivial calculations into computed signals or pure functions.
- Avoid manual subscriptions. When RxJS is necessary, use Angular interop utilities and deterministic cleanup.

## Domain rules

- All algorithm topology is data, never hardcoded template layout.
- Keep graph, frequency, envelope, patch, and DSP logic independent of Angular.
- Use immutable readonly models.
- Validate external data at boundaries.
- Represent operator IDs with a restricted type.
- One canonical algorithm dataset; no duplicated routing knowledge.
- Add invariant tests whenever an algorithm-data bug is fixed.

## Audio rules

- Browser audio is behind dependency-injected interfaces.
- Never create AudioContext at module evaluation time.
- Resume/start audio only after explicit user gesture.
- Never store AudioNodes in Angular signal state.
- Every created voice, oscillator, worklet, analyser, timer, and animation frame must have an explicit cleanup path.
- Smooth gain changes to avoid clicks.
- Do not claim exact DX7 emulation unless the implementation and verification justify it.
- Native OscillatorNode modulation is an MVP approximation; the accurate architecture target is a custom six-operator AudioWorklet phase-modulation engine.
- DSP code must not allocate excessively inside the audio render loop.

## Testing rules

- Vitest is mandatory.
- New domain behavior requires tests.
- New components require behavior-focused tests when meaningful.
- Do not test private implementation details.
- Mock browser boundaries, not pure domain logic.
- Audio tests must be deterministic and must not require a physical output device.
- A bug fix needs a regression test.
- Keep fixtures small and named by pedagogical intent.

## UI and accessibility rules

- Original design; do not clone Dexed or Yamaha panel artwork.
- Semantic HTML and labelled controls.
- Do not communicate carrier/modulator state by color alone.
- Support keyboard operation and visible focus.
- Respect reduced motion.
- Use SVG for algorithm graphs and include accessible text descriptions.
- Keep mobile usable without pretending a six-operator editor is phone-first.
- Avoid decorative complexity that competes with the educational signal flow.

## Licensing and content

- No copyrighted patch ROMs, commercial banks, manual scans, copied diagrams, or sampled songs.
- Generated examples must be original.
- Record third-party package and asset licenses.
- Dexed source is GPLv3; do not copy it into a differently licensed project without an explicit licensing decision.

## Verification commands

Run at minimum:

```bash
npm run build
npm test
npm run lint
```

When a command fails, fix the cause. Do not disable strictness, tests, lint rules, or budgets without documenting and approving the decision.
