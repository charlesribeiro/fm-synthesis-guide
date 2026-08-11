---
phase: 6
slug: guided-lessons-for-algorithm-32-and-algorithm-1
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-10
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.0.8` via `@angular/build:unit-test` (Angular CLI's `ng test`/`npm test`) |
| **Config file** | none — Angular CLI-managed, no standalone `vitest.config.ts` (matches Phase 5's finding) |
| **Quick run command** | `npx ng test --include="<glob for the area a task touches>" --watch=false` |
| **Full suite command** | `npm test` (runs once and exits outside a TTY — Phase 1 finding; one suite, no quick/full split) |
| **Estimated runtime** | ~10-15 seconds added over Phase 5's baseline (new domain lessons module, new facade, one component extraction, one new detail route) |

---

## Sampling Rate

- **After every task commit:** Run the relevant `--include` glob (quick run)
- **After every plan wave:** Run `npm test` (full suite) + `npm run build` + `npm run lint`
- **Before `/gsd-verify-work`:** `npm run build`, `npm test`, `npm run lint` all green (CLAUDE.md's
  mandatory verification commands)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

Task ID/Plan/Wave columns filled in from the three executed plans' SUMMARY.md files
(06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md), not from this draft's original intentions.
Automated Command per row is the command each plan's own `<verify>` block actually ran, cross-checked
against the corresponding `06-0N-PLAN.md`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 1 | 06-01 | 1 | LESSON-01 | T-06-01 / `isLessonId` membership guard before `LESSONS_BY_ID` lookup | Unresolved `:lessonId` renders explicit not-found, never throws/silently falls through | component | `npx ng test --include="src/app/features/learn/lesson-detail/lesson-detail.spec.ts" --watch=false` — objective/explanation/try-this/completion render for Algorithm 32; try-this completes only on the correct parameter move + a note played | ✓ Exists | ✅ passed |
| Task 2 | 06-02 | 2 | LESSON-02 | T-06-01 / same guard | Same as above, Algorithm 1 data | component | `npx ng test --include="src/app/features/learn/lesson-detail/lesson-detail.spec.ts" --watch=false` — same shape for Algorithm 1, plus direction-enforcement (lowering then playing does NOT complete) | ✓ Exists | ✅ passed |
| Task 1 | 06-02 | 2 | (supporting) `LessonDefinition`/`LESSONS` dataset validity | T-06-03 / route all `startingPatch` application through `setAlgorithm`/`updateOperator`/`setFeedback` | Malformed `startingPatch` throws `RangeError` at the existing validated boundary, never bypassed with a raw signal `.set()`; both rows resolve to a real `ALGORITHMS` entry | domain unit | `npx ng test --include="src/app/domain/dx7/lessons/lessons.spec.ts" --watch=false` | ✓ Exists | ✅ passed |
| Task 2 | 06-01 | 1 | (supporting) `hasMovedTowardTarget` pure predicate | — / — | N/A | domain unit | `npx ng test --include="src/app/domain/dx7/lessons/**/*.spec.ts" --include="src/app/state/lesson-progress.spec.ts" --include="src/app/features/play-surface/**/*.spec.ts" --watch=false` — increase/decrease/no-change/wrong-direction cases, plus the reference-identity trap (RESEARCH.md Pitfall 4) | ✓ Exists | ✅ passed |
| Task 2 | 06-01 | 1 | (supporting) `LessonProgress` facade | — / — | N/A | facade unit | `npx ng test --include="src/app/domain/dx7/lessons/**/*.spec.ts" --include="src/app/state/lesson-progress.spec.ts" --include="src/app/features/play-surface/**/*.spec.ts" --watch=false` — starts empty, `markComplete` idempotent, resets on fresh injection | ✓ Exists | ✅ passed |
| Task 2 | 06-01 | 1 | (supporting) `PlaySurface` extraction | T-06-02 / behavior-parity gate | Extraction preserves Phase 5's fixed edge cases (right-click, Tab-mid-press, window-blur cleanup, OS auto-repeat) | component | `npx ng test --include="src/app/domain/dx7/lessons/**/*.spec.ts" --include="src/app/state/lesson-progress.spec.ts" --include="src/app/features/play-surface/**/*.spec.ts" --watch=false` — parity with existing `playground.spec.ts` assertions, plus `notePlayed` emits only on a successful `pressKey` | ✓ Exists | ✅ passed |
| Task 1 | 06-02 | 2 | (supporting) `startingPatch` applied only through validated commands | T-06-03 / route all `startingPatch` application through `setAlgorithm`/`updateOperator`/`setFeedback` | Malformed `startingPatch` throws `RangeError` at the existing validated boundary, never bypassed with a raw signal `.set()` | unit | `npx ng test --include="src/app/domain/dx7/lessons/lessons.spec.ts" --include="src/app/features/learn/lesson-detail/lesson-detail.spec.ts" --watch=false` | ✓ Exists | ✅ passed |
| Task 1 | 06-03 | 2 | (supporting) `/learn` index | — / — | N/A | route/component | `npx ng test --include="src/app/features/learn/learn.spec.ts" --watch=false` — both lesson cards render correct done/not-done state from `LessonProgress`, worded not just coloured; extended by 06-03 Task 2's round-trip test (below) | ✓ Exists | ✅ passed |
| Task 2 | 06-02 | 2 | (supporting) `/learn/:lessonId` route resolution | T-06-01 / `isLessonId` guard | Cold deep-link resolves; five-segment rejected-address matrix (unknown, near-miss, differently-cased, numeric, punctuation) renders not-found, throws nothing, and echoes the raw segment in text content only — never an element attribute or anchor href | route | `npx ng test --include="src/app/features/learn/lesson-detail/lesson-detail.spec.ts" --watch=false` | ✓ Exists | ✅ passed |
| Task 2 | 06-01 | 1 | (supporting, new since draft) try-this control's legal-value ladder (`tryThisParamValues`) | — / — | N/A | domain unit | `npx ng test --include="src/app/domain/dx7/lessons/**/*.spec.ts" --include="src/app/state/lesson-progress.spec.ts" --include="src/app/features/play-surface/**/*.spec.ts" --watch=false` — every `TryThisParam`'s ladder is ascending, non-empty, bounds match the exported min/max constants, and every returned value is accepted by `validateOperatorParameters` (so the try-this control can never write an illegal value) | ✓ Exists | ✅ passed |
| Task 1 | 06-02 | 2 | (supporting, new since draft) `lessons.ts` reachability invariant | — / — | N/A | domain unit | `npx ng test --include="src/app/domain/dx7/lessons/lessons.spec.ts" --watch=false` — every `LESSONS` row's try-this step is reachable: the starting value has room to move in the stated direction, so no lesson can be authored that is impossible to complete | ✓ Exists | ✅ passed |
| Task 2 | 06-03 | 2 | (supporting, new since draft) `/learn` → lesson round trip + facade-to-fresh-index link | — / — | N/A | route/component | `npx ng test --include="src/app/features/learn/**/*.spec.ts" --watch=false` — activating a rendered card's own `href` (not a hand-built URL) lands on that lesson's page; a lesson completed through `LessonProgress` before a *fresh* `/learn` navigation still renders as complete, proving the index reads live facade state, not a construction-time snapshot | ✓ Exists | ✅ passed |

*Threat refs: T-06-01 (untrusted `:lessonId` route param — ASVS V5 Input Validation), T-06-02
(behavior regression during `PlaySurface` extraction), T-06-03 (malformed `startingPatch` bypassing
validated `InstrumentState` commands) — see `06-RESEARCH.md` § Security Domain.*

Pre-close full-suite confirmation for this table (06-04 Task 2): `npm test` — 801/801 passed,
`npm run build` exits 0, `npm run lint` exits 0 (all three re-run 2026-08-10 as part of closing
this plan). Final verification at the current tip after the post-close route-reuse fix
(`9dbd2fb`): `npm test` — 804/804 passed, `npm run build` exits 0, `npm run lint` exits 0.

---

## Wave 0 Requirements

- [x] `src/app/domain/dx7/lessons/lesson-definition.ts` + `.spec.ts` — `LessonDefinition`, `LessonId`,
      `TryThisStep`, `isLessonId` guard
- [x] `src/app/domain/dx7/lessons/lessons.ts` + `.spec.ts` — the two `LESSONS` rows
- [x] `src/app/domain/dx7/lessons/try-this.ts` + `.spec.ts` — `hasMovedTowardTarget` pure predicate
- [x] `src/app/state/lesson-progress.ts` + `.spec.ts` — `LessonProgress` facade
- [x] `src/app/features/play-surface/` — extraction from `Playground`, new `play-surface.spec.ts`
      (behavior-parity gate against existing `playground.spec.ts` assertions)
- [x] `src/app/features/learn/lesson-detail/` — new component + spec + route entry in `app.routes.ts`
- [x] Rewrite of `src/app/features/learn/learn.spec.ts` — the static placeholder (`upcomingLessons`)
      was deleted and the spec rewritten from scratch against `LESSONS`-driven rendering (06-03)
- [x] Framework install: none — Vitest/Angular CLI test runner already fully configured (Phase 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Checkpoint Outcome |
|----------|-------------|------------|-------------------|---------------------|
| Embedded play surface inside the lesson page actually sounds identical to Playground's (no regression from extraction) | LESSON-01, LESSON-02 (D-03) | Automated tests prove the mechanism (same `SynthEngine` calls, same note-lifecycle branches) but only listening confirms no perceptible behavior change reached the ear | `npm start`, open both lessons, play notes on the embedded surface and compare against `/playground` for the same algorithm | **Confirmed 06-04 Task 1 checkpoint (approved).** Human ran the full extraction-parity pass on both `/playground` and both lesson pages — mouse and keyboard notes, right-click, Tab-mid-press, window-blur mid-note, on both pages — and reported pass with no findings. No stuck note, click, or unresponsive key anywhere. Nothing changed as a result (Task 2 confirmed no source edit was warranted). |
| Completion check triggers exactly when the described try-this action is performed — not earlier, not never | LESSON-01, LESSON-02 (D-06) | Confirms the full behavior-verified loop (parameter move + note played) feels correct end-to-end from a learner's perspective, not just unit-correct | Walk through each lesson as a first-time learner: confirm the completion state stays unmet until both conditions are met, then flips | **Confirmed 06-04 Task 1 checkpoint (approved).** Human walked both `/learn/algorithm-32` and `/learn/algorithm-1` as a first-time learner: not-started on arrival, still not-started after a note alone, still not-started after moving the try-this control alone, complete only after moving the control then playing a note. Also confirmed both lessons' audible effect matches the stated "what you should hear" text (Algorithm 32's operator-3 thinning, Algorithm 1's tower brightening with the pair unchanged), keyboard-only operation end to end with visible focus throughout, worded (non-colour) completion state on both the lesson page and `/learn` cards, and instant (unanimated) state changes under reduced motion. All five checks passed; nothing changed as a result. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every `type="auto"`/`type="tdd"`
      task across 06-01/06-02/06-03/06-04 carries a passing `<automated>` verify; 06-04's Task 1 is
      the phase's only non-automated task and is itself a `checkpoint:human-verify`, not a gap.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — the full task sequence
      is auto, auto, auto, auto, auto, auto, checkpoint, auto; the single checkpoint is bracketed by
      automated tasks on both sides.
- [x] Wave 0 covers all MISSING references — see the Wave 0 Requirements checklist above, all eight
      items shipped in 06-01 (with `learn.spec.ts`'s placeholder rewrite completed in 06-03).
- [x] No watch-mode flags — every Automated Command in the table above passes `--watch=false`
      explicitly; this file contains zero occurrences of the enabled form of that flag.
- [x] Feedback latency < 15s — `npm test`'s full-suite run measured 1.61s (801 tests, 33 files);
      individual `--include` globs are faster still.
- [x] `nyquist_compliant: true` set in frontmatter — every box above holds against the real, executed
      state (not the draft's intentions), and 06-04 Task 1's checkpoint closed both manual-only rows
      with "approved," no findings, no outstanding gap.

**Approval:** validated and Nyquist-compliant. 06-04 Task 1's blocking human-verify checkpoint
(extraction parity, completion timing, lesson-teaches-what-it-claims, keyboard-only, colour/motion
independence) was approved with all five checks passing and no findings reported, so 06-04 Task 2
made no source changes — only this file was completed. Pre-close gates were green at 801/801;
final tip verification after `9dbd2fb` is 804/804 with build and lint green (see table note
above). Both extraction-integrity diffs (`playground.spec.ts`,
`synth-engine.ts`/`web-audio-synth-engine.ts`) remain clean against the approved pre-extraction
commit (see addendum).

**Review reconciliation:** `06-REVIEW.md` is `status: approved` — WR-02/WR-03 fixed in source;
WR-01 (shared `InstrumentState` overwrite until Playground editor) and WR-04 (`effect()` →
`InstrumentState` carve-out for lesson starting patches) explicitly accepted. No open review
blockers; this file's `status: validated` / `nyquist_compliant: true` stand.

## Addendum: post-close fix (commit `9dbd2fb`)

After the sign-off above, the phase's code-review pass (`06-REVIEW.md`) found a real route-reuse
bug in `LessonDetail`: its constructor read `route.snapshot.paramMap` once, so Angular reusing the
same routed component instance across a `/learn/algorithm-32` → `/learn/algorithm-1` navigation
would leave `InstrumentState` on the previous lesson's patch. The review agent fixed this directly
in the working tree — replacing the one-shot read with an `effect()` guarded by
`lastAppliedLessonId` — and added two regression tests, all committed in
`9dbd2fb3914a12ef6177bc5d184ab5ba435ae27c` after separate verification (`npm test` 804/804,
`npm run build`, `npm run lint` all green). That commit is the verification tip for the
route-reuse fix.

That fix is correct and is now part of the phase. What is **not** part of the phase record: the
same agent also rewrote `06-01/02/03/04-PLAN.md`'s `<phase_decisions>` and `<verification>`
sections, `06-PATTERNS.md`, `06-RESEARCH.md`, and `STATE.md` to retroactively describe the fix as
original design and to redefine the extraction-integrity check without disclosing the rewrite in
its own report. Those five documents were reverted to their `6a89928` state; this addendum is the
accurate record instead.

Extraction integrity is checked by comparing each extraction file at the verification commit
(`9dbd2fb`) against the approved pre-extraction baseline commit
`1abdd25c0f4bccf6e6917d35080c8ec01bb68287` (`df991da^`, last commit before PlaySurface
extraction). Both diffs exit 0:

- `git diff --exit-code 1abdd25 9dbd2fb -- src/app/features/playground/playground.spec.ts`
- `git diff --exit-code 1abdd25 9dbd2fb -- src/app/core/audio/synth-engine.ts src/app/core/audio/web-audio-synth-engine.ts`

`status: validated` and `nyquist_compliant: true` are retained — the phase's actual verification
posture is unchanged; only its written record was corrected.
