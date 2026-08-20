---
phase: 10-visualizers-and-comparison-tools
plan: 01
subsystem: audio
tags: [angular-signals, web-audio, analysernode, canvas-2d, animation-frame, injection-tokens, oscilloscope]

# Dependency graph
requires:
  - phase: 09-dx7-style-envelopes-and-parameter-mapping
    provides: WorkletSynthEngine's live final mix (masterGain -> context.destination), now widened with an analyser tap
provides:
  - "AnalyserNodeLike/AudioContextLike.createAnalyser() boundary widening (D-02)"
  - "AnalysisTap capability interface + hasAnalysisTap() guard on synth-engine.ts, implemented by WorkletSynthEngine"
  - "ANIMATION_FRAME_SCHEDULER and CANVAS_2D_CONTEXT_FACTORY browser-seam injection tokens (D-03), mirroring MATCH_MEDIA's precedent"
  - "visualizer-frame.ts — pure, Angular-free, audio-free Canvas 2D draw module (drawOscilloscope/drawFlatBaseline)"
  - "Visualizer standalone component embedded in Playground below the play surface, repainting from real tapped audio on an injected frame loop that touches no signal"
affects: [10-02-spectrum-analyzer, 10-03-comparison-tools, 10-04-integration-and-human-verify]

# Actuals (#2632)
actuals:
  tokens: 18301
  tasks: 2
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Capability-guard pattern for optional engine features: AnalysisTap is a separate interface from SynthEngine, checked with hasAnalysisTap() rather than added as a required member — the reference fallback engine is not given a tap"
    - "Browser-seam injection tokens for requestAnimationFrame and Canvas 2D context acquisition, following motion-preference.ts's MATCH_MEDIA precedent exactly (root-provided token, feature-detecting factory, graceful no-op/null fallback)"
    - "Structural off-change-detection guarantee: visualizer-frame.ts imports nothing from Angular or the audio layer, so the draw path cannot write a signal by construction, not by discipline"
    - "committed-to-built-graph-immediately-on-creation ordering in WorkletSynthEngine.buildAndStart, so a partial-construction throw always leaves discardLocalGraph able to clean up whatever was actually created"

key-files:
  created:
    - src/app/core/browser/animation-frame.token.ts
    - src/app/core/browser/canvas-2d.token.ts
    - src/app/core/browser/testing/fake-animation-frame-scheduler.ts
    - src/app/core/browser/testing/fake-canvas-2d-context.ts
    - src/app/features/playground/visualizer/visualizer-frame.ts
    - src/app/features/playground/visualizer/visualizer-frame.spec.ts
    - src/app/features/playground/visualizer/visualizer.ts
    - src/app/features/playground/visualizer/visualizer.html
    - src/app/features/playground/visualizer/visualizer.scss
    - src/app/features/playground/visualizer/visualizer.spec.ts
  modified:
    - src/app/core/audio/audio-context.token.ts
    - src/app/core/audio/testing/fake-audio-context.ts
    - src/app/core/audio/synth-engine.ts
    - src/app/core/audio/worklet-synth-engine.ts
    - src/app/core/audio/worklet-synth-engine.spec.ts
    - src/app/features/playground/playground.ts
    - src/app/features/playground/playground.html
    - src/app/features/playground/playground.spec.ts

key-decisions:
  - "This execution resumed a stalled prior attempt: Task 1 (6 commits) was transplanted via cherry-pick from a different worktree's branch after a session-quota interruption, verified green (test/lint/build), then treated as complete without re-implementation."
  - "Task 2's teardown-and-rebuild plan item ('interrupted-initialization discard path... leaving the analyser disconnected') was not reachable as literally specified against Task 1's implementation — buildAndStart had no async gap between analyser creation and graph commit, so no generation-race could ever discard a built analyser. Fixed the underlying ordering bug (Rule 1/2: built.masterGain/built.analyser are now committed immediately on creation, matching the existing built.node = node convention) so a partial-construction throw always leaves discardLocalGraph able to clean up whatever was created, then proved it with a new regression that throws from masterGain.connect(analyser)."
  - "visualizer-frame.spec.ts's full-range (0-255) draw-shape case, listed in Task 2's action text, was already present verbatim in Task 1's committed spec file — no new test added for it, consistent with the 02-03/03-01/08-01/08-03 fix-attempt-finds-nothing-to-fix precedent."

patterns-established:
  - "Every new browser global seam (animation frame, canvas 2D context) gets its own hand-rolled fake in core/browser/testing/, mirroring core/audio/testing/'s existing conventions exactly (recorded ordered calls, settable canned data, explicit query helpers)."

requirements-completed: []  # VIZ-01 stays open until 10-01 D3 (real-browser 60fps CD) is verified

coverage:
  - id: D1
    description: "A single AnalyserNode-shaped tap sits on WorkletSynthEngine's live final mix (masterGain -> analyser -> destination), exposed only via three plain read-only methods (getAnalysisSampleRate/readTimeDomainInto/readFrequencyInto) — never a node reference in reach of Angular signal state"
    requirement: VIZ-01
    verification:
      - kind: unit
        ref: "src/app/core/audio/worklet-synth-engine.spec.ts#AnalyserNode tap (10-01-PLAN.md, D-02, D-08)"
        status: pass
      - kind: unit
        ref: "src/app/core/audio/worklet-synth-engine.spec.ts#AnalyserNode teardown and rebuild (10-01-PLAN.md Task 2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Canvas 2D oscilloscope (Visualizer), embedded in Playground below the play surface and always visible, repaints from real tapped time-domain bytes on an injected requestAnimationFrame loop — allocating its read buffer once, requesting exactly one outstanding frame at a time, cancelling on destroy, and drawing a visible flat baseline (never synthetic waveform data) whenever there is no live tap"
    requirement: VIZ-01
    verification:
      - kind: unit
        ref: "src/app/features/playground/visualizer/visualizer.spec.ts"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/visualizer/visualizer-frame.spec.ts"
        status: pass
      - kind: unit
        ref: "src/app/features/playground/playground.spec.ts#embedded Visualizer (10-01-PLAN.md Task 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "In a real browser at 60fps the oscilloscope repaint runs entirely outside Angular's change-detection cycle"
    verification: []
    human_judgment: true
    rationale: "jsdom cannot time real requestAnimationFrame/change-detection interaction against each other. The in-repo proof is structural (visualizer-frame.ts imports no Angular symbol at all, so it cannot write a signal by construction) plus a 500-scheduler-tick regression proving zero DOM mutation and a settled fixture in this environment — but neither substitutes for a genuine real-browser observation. Deferred to the plan 10-04 human-verify checkpoint per this plan's own must_haves backstop statement."

duration: ~55min (resumed session; Task 1 transplant+verify ~15min, Task 2 implementation ~40min)
completed: 2026-08-18
status: complete
---

# Phase 10 Plan 01: Oscilloscope Tracer Slice Summary

**AnalyserNode tap inserted into WorkletSynthEngine's live final mix, exposed as three plain read methods, driving a Canvas 2D oscilloscope embedded in Playground via an injected requestAnimationFrame loop that touches no Angular signal.**

## Performance

- **Duration:** ~55 min (this resumed session; Task 1's original authoring time is not counted here — it was produced and committed in an earlier, separately-quota-limited session)
- **Tasks:** 2/2 complete
- **Files modified:** 18 (10 created, 8 modified)
- **Commits:** 7 (6 transplanted from Task 1's original attempt + 1 new for Task 2)

## Accomplishments

- Widened the hand-rolled `AudioContextLike` boundary with `AnalyserNodeLike`/`createAnalyser()` (D-02), and gave `WorkletSynthEngine` an analyser tap sitting between `masterGain` and `context.destination` — inserted as a read-only pass-through, changing what can be observed and nothing about what is heard.
- Exposed the tap as `AnalysisTap` (`getAnalysisSampleRate`/`readTimeDomainInto`/`readFrequencyInto`), a capability interface guarded by `hasAnalysisTap()` rather than a required `SynthEngine` member — the unused reference fallback engine is not given a tap.
- Added two new browser-seam injection tokens (`ANIMATION_FRAME_SCHEDULER`, `CANVAS_2D_CONTEXT_FACTORY`) following `motion-preference.ts`'s `MATCH_MEDIA` precedent exactly, each with a hand-rolled deterministic test fake.
- Built `visualizer-frame.ts`, a pure Canvas 2D draw module that imports no Angular or audio symbol at all — a structural guarantee that the draw path cannot write a signal, not a discipline someone has to remember.
- Built the `Visualizer` standalone component: preallocates its read buffer once, resolves the analysis tap once via the capability guard, sizes its canvas backing store defensively for device pixel ratio, and runs a self-renewing single-outstanding-request animation-frame loop that draws real tapped bytes (or a flat rest baseline when there is none) and cancels cleanly on destroy.
- Embedded `<app-visualizer>` in Playground directly below `<app-play-surface>`, always visible in every audio status including `unavailable`.
- Locked the analyser tap's teardown/rebuild invariants and the visualizer loop's lifecycle invariants with a dedicated Task 2 proof pass: full created-node-registry teardown walk (analyser named explicitly), read-methods-false-after-destroy, an interrupted-construction discard case, destroy-then-reinitialize (second analyser + full chain re-established), 500-tick no-Angular-work proof, rest-state/live-data transition, buffer-identity-across-ticks, engine-lifecycle-never-called, null-context-factory, and Playground-embedding-position-across-statuses.
- Fixed a latent partial-construction leak in `WorkletSynthEngine.buildAndStart`: `built.masterGain`/`built.analyser` are now committed to the local graph immediately on creation (matching the pre-existing `built.node = node` convention) rather than only after every connection succeeds, so a throw partway through wiring always leaves `discardLocalGraph` able to disconnect whatever was actually created.

## Task Commits

Each task was committed atomically:

1. **Task 1: One waveform end to end — analyser boundary, engine tap, injected frame loop, Canvas 2D oscilloscope, embedded in Playground** (transplanted via cherry-pick from a stalled prior attempt in a different worktree, verified green in this session — see Deviations below):
   - `51319b5` — feat(10-01): widen AudioContextLike with AnalyserNodeLike and AnalysisTap contract
   - `42ebd84` — feat(10-01): insert analyser tap into WorkletSynthEngine's final mix
   - `76b6ed5` — feat(10-01): add animation-frame and canvas-2d browser seams (D-03)
   - `fbf3e24` — feat(10-01): add visualizer-frame pure Canvas 2D draw module
   - `c554b29` — feat(10-01): add Visualizer oscilloscope component (D-01, D-03, D-04)
   - `8086aa7` — feat(10-01): embed Visualizer in Playground below the play surface (D-04)
2. **Task 2: Lock the tap's invariants — teardown coverage, buffer-size discipline, loop-lifecycle proof, and the no-change-detection assertion** — `4cb2851` (test, includes one production reordering fix in `worklet-synth-engine.ts`)

_Note: this SUMMARY covers both tasks; Task 2's commit is the only one authored in this resumed session._

## Files Created/Modified

- `src/app/core/audio/audio-context.token.ts` — extended: `AnalyserNodeLike`, `AudioContextLike.createAnalyser`
- `src/app/core/audio/testing/fake-audio-context.ts` — extended: `FakeAnalyserNode`, `createdAnalysers`, buffer-length enforcement
- `src/app/core/audio/synth-engine.ts` — extended: `ANALYSER_FFT_SIZE`, `ANALYSER_FREQUENCY_BIN_COUNT`, `AnalysisTap`, `hasAnalysisTap`
- `src/app/core/audio/worklet-synth-engine.ts` — extended: analyser field, insertion point, read methods, teardown; Task 2 reordering fix (built.masterGain/built.analyser committed on creation, not after connect)
- `src/app/core/audio/worklet-synth-engine.spec.ts` — repaired `findMasterGain`/added `findAnalyser` helper (Task 1, Pitfall 1); Task 2 teardown/rebuild proof suite
- `src/app/core/browser/animation-frame.token.ts` — `AnimationFrameScheduler`, `ANIMATION_FRAME_SCHEDULER`
- `src/app/core/browser/canvas-2d.token.ts` — `CanvasRenderingContext2DLike`, `Canvas2dContextFactory`, `CANVAS_2D_CONTEXT_FACTORY`
- `src/app/core/browser/testing/fake-animation-frame-scheduler.ts` — `FakeAnimationFrameScheduler`
- `src/app/core/browser/testing/fake-canvas-2d-context.ts` — `FakeCanvas2dContext`
- `src/app/features/playground/visualizer/visualizer-frame.ts` — `drawOscilloscope`, `drawFlatBaseline`, geometry/colour constants
- `src/app/features/playground/visualizer/visualizer-frame.spec.ts` — draw-shape invariants; Task 2 allocation-discipline + zero-length-buffer cases
- `src/app/features/playground/visualizer/visualizer.ts` / `.html` / `.scss` — the `Visualizer` component
- `src/app/features/playground/visualizer/visualizer.spec.ts` — loop lifecycle; Task 2 500-tick/rest-state/buffer-identity/lifecycle-spy/null-context cases
- `src/app/features/playground/playground.ts` / `.html` — embeds `<app-visualizer>`
- `src/app/features/playground/playground.spec.ts` — Task 2: fake scheduler/context-factory providers, `app-visualizer` positioning case

## Decisions Made

- **Resumed-execution transplant:** Task 1's 6 commits from a prior, session-quota-interrupted attempt were cherry-picked wholesale from the stalled worktree's branch onto this worktree's branch, applying cleanly with zero conflicts (both worktrees forked from the same base commit `34f0ca5`). Re-verified green (`npm test`, `npm run lint`, `npm run build`) before treating Task 1 as complete — no re-implementation.
- **Production fix during Task 2 (Rule 1/2):** `worklet-synth-engine.ts`'s `buildAndStart` assigned `built.masterGain`/`built.analyser` only after all connections succeeded, meaning a throw during `masterGain.connect(analyser)` or `analyser.connect(context.destination)` would leak the just-created nodes uncleaned (`discardLocalGraph` sees `null` fields and no-ops). This directly violates CLAUDE.md's audio rule ("every created … analyser … must have an explicit cleanup path") and made the plan's own "interrupted-initialization discard path… leaving the analyser disconnected" acceptance case structurally unreachable. Fixed by committing each field to `built` immediately on creation (matching the pre-existing `built.node = node` line), then proved it with a new regression test.
- **Documented no-op case:** the full-range (0–255) draw-shape test Task 2's action text calls for was already present, verbatim, in Task 1's committed `visualizer-frame.spec.ts` — left as-is rather than duplicated.

## Deviations from Plan

**This was a resumed execution.** Task 1 was transplanted via cherry-pick from an earlier attempt (a different worktree, branch `worktree-agent-abf02e1e2849b3f78`) that was stopped mid-Task-2 by a session-quota error — not a code defect. Task 1's 6 commits applied cleanly with zero merge conflicts and were re-verified green in this session before being treated as complete. The stalled worktree's ~80 lines of uncommitted, partial Task-2 test edits were deliberately left behind (not part of the cherry-pick); Task 2 was implemented fresh in this run directly from the plan's own spec.

### Auto-fixed Issues

**1. [Rule 1/2 — Bug / Missing critical cleanup] `discardLocalGraph` could leak a partially-wired masterGain/analyser on a mid-construction throw**
- **Found during:** Task 2, item 1 (worklet-synth-engine.spec.ts teardown/rebuild proof) — the plan's "interrupted-initialization discard path… leaving the analyser disconnected" acceptance case was not reachable against Task 1's implementation as written, because `built.masterGain`/`built.analyser` were only assigned after all three `connect()` calls succeeded, with no `await` between analyser creation and the assignment. Any throw in that window (e.g. `masterGain.connect(analyser)` failing) would leave `built.masterGain`/`built.analyser` still `null`, so `discardLocalGraph`'s `built.masterGain?.disconnect()`/`built.analyser?.disconnect()` calls would silently no-op instead of cleaning up the nodes that were actually created — a genuine resource-cleanup gap under CLAUDE.md's "every created … analyser … must have an explicit cleanup path" rule.
- **Issue:** `built.masterGain = masterGain; built.analyser = analyser;` ran only at the very end of `buildAndStart`'s try block, after all connect() calls, rather than immediately at creation (unlike `built.node = node`, which was already assigned right after node construction).
- **Fix:** Moved both assignments to run immediately after each node's creation, before any connect() call — same convention as the pre-existing `built.node = node` line.
- **Files modified:** `src/app/core/audio/worklet-synth-engine.ts`
- **Verification:** New regression test throws from `masterGain.connect(analyser)` via `vi.spyOn(FakeGainNode.prototype, 'connect').mockImplementationOnce(...)` and asserts both the analyser and the masterGain end up disconnected after the discard; full suite (1228 tests) + lint + build all green.
- **Committed in:** `4cb2851` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/missing-critical-cleanup) + 1 resumed-execution transplant (documented above, not a deviation from correctness but from normal single-session flow).
**Impact on plan:** The production fix is a small, behavior-preserving-on-the-happy-path reordering; it only changes what's cleaned up on an already-exceptional path. No scope creep — every other Task 2 item was proof-surface-only, several already satisfied by Task 1's implementation (documented as such rather than duplicated).

## Issues Encountered

None beyond the resumed-execution transplant and the reordering fix documented above. `TestBed.configureTestingModule` cannot be called twice within a single `it()` — an initial draft of the Playground positioning test called `setup()` twice in one case and was split into three separate `it()` blocks (unavailable/suspended/ready) instead.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The analyser tap and the injected animation-frame/Canvas-2D seams are now proven infrastructure plan 10-02 (spectrum analyzer) can reuse directly — `readFrequencyInto`/`ANALYSER_FREQUENCY_BIN_COUNT` already exist and are tested, just not yet drawn from.
- `10-CONTEXT.md`'s D-04 "coming soon" list in Playground still names "Oscilloscope and spectrum display" and "A/B snapshot compare and constrained randomization" as a single combined pending item; plans 10-02 and 10-04 are expected to remove/split it as they land — left untouched here as the plan specified.
- The real-browser 60fps off-change-detection observation remains a genuine, undischarged human-verify item (coverage `D3` above) — deferred to the plan 10-04 checkpoint per this plan's own must_haves backstop statement, not resolved by anything in this plan.

---
*Phase: 10-visualizers-and-comparison-tools*
*Completed: 2026-08-18*
