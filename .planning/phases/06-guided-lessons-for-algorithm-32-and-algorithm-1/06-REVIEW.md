---
phase: 06-guided-lessons-for-algorithm-32-and-algorithm-1
reviewed: 2026-08-11T02:59:00Z
reconciled: 2026-08-11T04:15:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/app/app.routes.ts
  - src/app/domain/dx7/lessons/lesson-definition.ts
  - src/app/domain/dx7/lessons/lessons.spec.ts
  - src/app/domain/dx7/lessons/lessons.ts
  - src/app/domain/dx7/lessons/try-this.ts
  - src/app/features/learn/learn.html
  - src/app/features/learn/learn.scss
  - src/app/features/learn/learn.spec.ts
  - src/app/features/learn/learn.ts
  - src/app/features/learn/lesson-detail/lesson-detail.html
  - src/app/features/learn/lesson-detail/lesson-detail.scss
  - src/app/features/learn/lesson-detail/lesson-detail.spec.ts
  - src/app/features/learn/lesson-detail/lesson-detail.ts
  - src/app/features/play-surface/play-surface.html
  - src/app/features/play-surface/play-surface.scss
  - src/app/features/play-surface/play-surface.ts
  - src/app/features/playground/playground.html
  - src/app/features/playground/playground.scss
  - src/app/features/playground/playground.ts
  - src/app/state/lesson-progress.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
  open_warnings: 0
  fixed: 2
  accepted: 2
status: approved
---

# Phase 6: Code Review Report

**Reviewed:** 2026-08-11T02:59:00Z
**Reconciled:** 2026-08-11T04:15:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** approved (2 warnings fixed, 2 warnings explicitly accepted; no open blockers)

## Summary

Reviewed the guided-lessons stack end to end: the `LessonDefinition`/`LESSONS`/`try-this` domain layer, the
`/learn` and `/learn/:lessonId` route components, the `PlaySurface` extraction from `Playground`, and
`LessonProgress`. `npm run build`-equivalent (`tsc --noEmit`), `npm run lint`, and the full Vitest suite
(804 tests, 33 files) all pass against the current working tree. No hardcoded secrets, injection vectors, or
`eval`/`innerHTML`-style sinks were found; all untrusted route input (`:lessonId`) is validated by set
membership (`isLessonId`) and only ever reaches the DOM as auto-escaped text interpolation, never an
attribute or `innerHTML` — verified both by reading and by the project's own not-found matrix tests.

Note for context: at the time of this review the working tree had uncommitted changes to
`lesson-detail.ts`/`.spec.ts`/`lessons.ts` beyond the last commit (`df991da`) — most importantly, the
constructor's one-shot `route.snapshot.paramMap` patch application had already been reworked into a
reactive `effect()` keyed off `lesson()` with a `lastAppliedLessonId` guard, which closes what would
otherwise have been a real route-reuse bug (a same-route lesson→lesson navigation leaving `InstrumentState`
on the previous lesson's patch while the page displayed the new one). This review evaluates the code as it
stands on disk now, including that fix, rather than the last committed snapshot.

**Reconciliation:** WR-02 and WR-03 were fixed in source. WR-01 and WR-04 were explicitly accepted for this
phase (documented below). Phase validation remains `validated` / `nyquist_compliant: true` with no open
review blockers.

## Warnings

### WR-01: Opening any lesson silently overwrites the shared, app-wide `InstrumentState` with no restore path — **ACCEPTED**

**File:** `src/app/features/learn/lesson-detail/lesson-detail.ts:150-173` (the `effect()` and
`applyStartingPatch`)

**Issue:** `InstrumentState` (`src/app/state/instrument-state.ts`) is a single `providedIn: 'root'`
singleton shared by every route in the app, including `/playground`. `LessonDetail`'s effect calls
`setAlgorithm` → six `updateOperator` calls → `setFeedback` unconditionally every time `lesson()` resolves
to a new id — i.e. on every navigation into a lesson page, cold or in-app. There is no capture/restore of
whatever patch was live before the lesson was opened, and nothing resets it when the learner navigates back
out.

Reproduction: visit `/playground` (today it has no editor UI yet, but `InstrumentState.patch()` is still
what the shared `SYNTH_ENGINE` renders — see `web-audio-synth-engine.ts`'s constructor effect reading
`InstrumentState` directly), then visit any `/learn/:lessonId` page, then return to `/playground`. The
instrument now plays whatever the lesson (plus any try-this edits made while there) left behind, not
whatever was live before — with zero indication to the user that navigating into a lesson page changed
global instrument state. This will get materially worse once a later phase adds the six-operator editor to
`/playground` promised in its own "coming soon" list: at that point a learner's in-progress custom patch
would be silently discarded the moment they click into a lesson from `/learn`.

This is distinct from — and not covered by — the project's documented "no persistence across reload" scope
decision (`03-CONTEXT.md` D-05): a same-session, no-navigation-away loss of unsaved editor state is a much
more surprising failure mode than losing everything on an explicit page reload.

**Disposition:** **Accepted for Phase 6.** Latent until Playground gains an editor; capture/restore or
lesson-scoped instrument state is deferred to the phase that ships that editor. Documented here so it is
not rediscovered as a surprise.

### WR-02: `[viewModel]="diagram()!"` uses a non-null assertion instead of the codebase's own established null-safe pattern — **FIXED**

**File:** `src/app/features/learn/lesson-detail/lesson-detail.html:20`

**Issue:** `lesson-detail.ts`'s own doc comment says the file mirrors `AlgorithmDetail`'s pattern
(`06-01-PLAN.md`'s `<read_first>` list even cites `algorithm-detail.ts`/`.html` as the template to mirror).
`algorithm-detail.html` narrows its view model null-safely via `@if (viewModel(); as vm)` and then passes
the narrowed `vm` — no `!` anywhere in that file. `lesson-detail.html` instead called
`buildDiagramViewModelForId`-backed `diagram()` a second time inside the already-narrowed `@if (lesson();
as currentLesson)` block and forced it non-null with `!`.

**Disposition:** **Fixed.** Template now uses `@if (diagram(); as diagramVm)` before
`<app-algorithm-diagram [viewModel]="diagramVm" />`.

### WR-03: `PlaySurface` and `Playground` omit `ChangeDetectionStrategy.OnPush`, contradicting CLAUDE.md and this phase's own new components — **FIXED**

**File:** `src/app/features/play-surface/play-surface.ts`, `src/app/features/playground/playground.ts`

**Issue:** CLAUDE.md's Angular rules state "Prefer `OnPush` semantics and immutable inputs even in a
zoneless app." `Learn` and `LessonDetail` — the two other new components authored in this same phase — both
explicitly set `changeDetection: ChangeDetectionStrategy.OnPush`. The newly-authored `PlaySurface` did not;
neither did `Playground` after the extraction.

**Disposition:** **Fixed.** Both components now set `changeDetection: ChangeDetectionStrategy.OnPush`.

### WR-04: `LessonDetail`'s `effect()` syncs into an internal Angular signal service, not an "external system" — **ACCEPTED**

**File:** `src/app/features/learn/lesson-detail/lesson-detail.ts:142-165`

**Issue:** CLAUDE.md: "Use `effect` only for imperative synchronization with an external system. Do not use
`effect`s to derive state." Elsewhere in this codebase "external system" consistently means a browser/audio
boundary — e.g. `WebAudioSynthEngine`'s constructor effect pushes `InstrumentState` into the actual
`AudioContext` graph. Here, the effect instead pushes one Angular signal-backed service's derived value
(`lesson()`, itself derived from the router's `paramMap`) into another Angular signal-backed service
(`InstrumentState`) entirely within the same process — i.e. cross-store state derivation via a side channel,
which is exactly the pattern the second sentence of that same rule warns against. The code comment's
justification ("The effect is imperative sync with InstrumentState (an external system)") stretches the
term to cover an in-memory `providedIn: 'root'` service, which is a different thing from the DOM/audio
boundaries the rule was written for elsewhere in this codebase.

This is a real, working fix for the route-reuse problem (confirmed by the new
`'reapplies the new lesson starting patch when navigating between lesson ids on the same component'` test),
so it isn't a functional bug — but it is a rule-boundary interpretation worth a second look, since it sets a
precedent other components could point to for using `effect()` to write into `InstrumentState` more broadly.

**Disposition:** **Accepted for Phase 6.** The route-reuse-safe `effect()` + `lastAppliedLessonId` pattern
is the approved carve-out for applying a lesson's `startingPatch` into root `InstrumentState`. Broader
CLAUDE.md wording tightening can land separately; this phase does not treat WR-04 as a blocker.

## Info

### IN-01: `LESSONS_BY_ID` was widened to `export` with no consumers

**File:** `src/app/domain/dx7/lessons/lessons.ts:157`

**Issue:** `export const LESSONS_BY_ID: ReadonlyMap<LessonId, LessonDefinition> = ...` has no importers
anywhere else in `src/app` (`grep -rn "LESSONS_BY_ID" src/app` only finds its own declaration, its own use
inside `getLesson`, and a doc-comment mention in `lesson-definition.ts`). Widening a module-private constant
to a public export with zero external consumers grows the file's public API surface for no reason and
invites a future caller to bypass `getLesson`'s `RangeError` guard by reading the map directly.

**Fix:** Revert to `const LESSONS_BY_ID` (module-private) unless a specific consumer needing direct map
access is added in the same change.

### IN-02: Duplicate `RangeError` validation block in `LessonProgress`

**File:** `src/app/state/lesson-progress.ts:26-31` and `:42-45`

**Issue:** `isComplete` and `markComplete` each open with the identical
`if (!isLessonId(lessonId)) { throw new RangeError(...) }` block, byte-for-byte. A future edit to the error
message or guard logic in one method has no compiler-enforced reason to also land in the other.

**Fix:**
```ts
private assertLessonId(lessonId: LessonId): void {
  if (!isLessonId(lessonId)) {
    throw new RangeError(`lessonId must be one of ${LESSON_IDS.join(', ')}, received ${lessonId}`);
  }
}
```
called from both `isComplete` and `markComplete`.

### IN-03: `LessonDetail.carriers` is a pass-through wrapper adding no logic

**File:** `src/app/features/learn/lesson-detail/lesson-detail.ts:82`

**Issue:** `protected readonly carriers = computed<readonly OperatorId[]>(() =>
this.instrumentState.carriers());` re-wraps `instrumentState.carriers` in an identical `computed` with no
transformation. The template could read `instrumentState.carriers()` directly (or the field could just be
`protected readonly carriers = this.instrumentState.carriers;`) with the same reactivity and one fewer
computed to maintain.

**Fix:** `protected readonly carriers = this.instrumentState.carriers;`

### IN-04: `enabling` signal in `PlaySurface` doesn't follow the file's own encapsulation convention

**File:** `src/app/features/play-surface/play-surface.ts:42,48-49`

**Issue:** `_heldNote`/`heldNote` in this same file follow a private-writable + `.asReadonly()` pattern so
only the component itself can mutate the underlying signal. `enabling` (`protected readonly enabling =
signal(false);`) is instead exposed directly as a writable signal under `protected` visibility — nothing
outside the class currently calls `.set()` on it, but the inconsistency means the file's own convention
isn't self-enforcing.

**Fix:**
```ts
private readonly _enabling = signal(false);
protected readonly enabling = this._enabling.asReadonly();
```
(updating the two internal `.set()` call sites in `enableAudio()` to use `_enabling`).

---

_Reviewed: 2026-08-11T02:59:00Z_
_Reconciled: 2026-08-11T04:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
