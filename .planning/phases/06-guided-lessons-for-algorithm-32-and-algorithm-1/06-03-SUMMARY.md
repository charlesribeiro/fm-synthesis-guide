---
phase: 06-guided-lessons-for-algorithm-32-and-algorithm-1
plan: 03
subsystem: ui
tags: [angular, signals, lessons, routing, accessibility]

requires:
  - phase: 06-guided-lessons-for-algorithm-32-and-algorithm-1
    provides: "Plan 06-01's LESSONS dataset, LessonProgress facade, and /learn/:lessonId LessonDetail route; plan 06-02's second LESSONS row (both lessons now exist end-to-end)"
  - phase: 04-algorithm-browser-and-svg
    provides: "The browse-index-to-detail-route card/routerLink shape (Algorithms/algorithms.html) this plan mirrors for /learn"
provides:
  - "/learn as a data-driven index: one card per LESSONS row, each linking to its own /learn/:lessonId address and showing that lesson's completion state read live from LessonProgress"
  - "The completed browse -> hear -> adjust -> understand vertical slice's front door — Phase 6's LessonDetail (06-01/06-02) was previously unreachable in-app"
affects: [06-04-PLAN, phase-11-full-curriculum]

actuals:
  tokens: 3012
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Card-as-anchor list pattern (the whole <li> body wrapped in one routerLink anchor, mirroring Algorithms' .algorithm-card) applied for the second time in this codebase, now with a per-card live facade read added on top"
    - "Completion state carried in text ('Completed' / 'Not started') plus a state class/data attribute for styling only, with the differentiating visual treatment (border weight) never color-only"

key-files:
  created: []
  modified:
    - src/app/features/learn/learn.ts
    - src/app/features/learn/learn.html
    - src/app/features/learn/learn.scss
    - src/app/features/learn/learn.spec.ts

key-decisions:
  - "Completion element binds both a CSS class (.lesson-card__completion--done) and a data-state attribute for styling hooks, but the accessible text ('Completed'/'Not started') is the actual state carrier in every assertion and in the rendered DOM — neither binding is load-bearing for correctness, both are presentation-only, per the plan's non-color-only instruction"
  - "No transition on the completion element at all (plan's stated safer default) rather than a prefers-reduced-motion-guarded one — the state should appear instantly, and there is nothing to animate between since Angular's @if swaps the two branches outright"
  - "Round-trip test in Task 2 activates the first rendered lesson card via firstCard!.click(), awaits harness stability, and asserts the lesson title — it does not extract href or call navigateByUrl, so the case exercises the anchor's routerLink activation rather than a hand-built navigation"

patterns-established: []

requirements-completed: [LESSON-01, LESSON-02]

coverage:
  - id: D1
    description: "/learn renders one card per LESSONS row, in dataset order, with Algorithm 32 first — built from the canonical lesson dataset, not a hardcoded array"
    requirement: LESSON-01
    verification:
      - kind: unit
        ref: "src/app/features/learn/learn.spec.ts#renders one card per LESSONS row, in dataset order, with Algorithm 32 first"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each /learn card links to its own /learn/:lessonId address"
    requirement: LESSON-01
    verification:
      - kind: unit
        ref: "src/app/features/learn/learn.spec.ts#links each card to its own lesson's /learn/:lessonId address"
        status: pass
    human_judgment: false
  - id: D3
    description: "Following a rendered /learn card's own routerLink (activated via click, not a hand-built URL or href extraction) lands on that lesson's detail page — the browse-index-to-detail-route round trip proven in-app"
    requirement: LESSON-02
    verification:
      - kind: unit
        ref: "src/app/features/learn/learn.spec.ts#activates the first /learn card's rendered link and lands on that lesson's own page — no direct router call standing in for the click"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every card's completion state is worded (Completed/Not started) before any lesson is completed, updates live on the same fixture after LessonProgress.markComplete with no reload, and is also correct on a freshly navigated /learn (proving the index reads live facade state, not a construction-time snapshot)"
    requirement: LESSON-01
    verification:
      - kind: unit
        ref: "src/app/features/learn/learn.spec.ts#shows every card as not started, in words, before any lesson is completed"
        status: pass
      - kind: unit
        ref: "src/app/features/learn/learn.spec.ts#marking one lesson complete changes only that lesson's card wording, live, with no reload"
        status: pass
      - kind: unit
        ref: "src/app/features/learn/learn.spec.ts#shows a lesson marked complete through LessonProgress as complete on a freshly navigated /learn, leaving the other lesson not started"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Phase 1 placeholder — upcomingLessons array and the 'lesson player isn't built yet' status line — is gone, and no storage API is referenced anywhere under src/app/features/learn or in the progress facade"
    requirement: LESSON-02
    verification:
      - kind: unit
        ref: "src/app/features/learn/learn.spec.ts#removes the Phase 1 placeholder claim that the lesson player is unbuilt"
        status: pass
      - kind: other
        ref: 'grep -rnE "localStorage|sessionStorage|indexedDB|document\.cookie" src/app/features/learn src/app/state/lesson-progress.ts | wc -l  (returns 0)'
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-10
status: complete
---

# Phase 6 Plan 3: /learn Index Rebuild Summary

**`/learn` rebuilt as a data-driven card index over `LESSONS` — each card a single routerLink anchor to `/learn/:lessonId` with a worded, live-updating completion state read from `LessonProgress`, closing Phase 6's browse-to-lesson front door.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-10T22:47:00-03:00 (approx., first task commit)
- **Completed:** 2026-08-11T02:07:24Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Rebuilt `Learn` (`learn.ts`): deleted the `UpcomingLesson` interface and the static `upcomingLessons` array — the last copy of lesson titles outside the canonical `LESSONS` dataset — and replaced them with `protected readonly lessons = LESSONS` plus an injected `protected readonly lessonProgress = inject(LessonProgress)`. Added `ChangeDetectionStrategy.OnPush` and `RouterLink` to `imports`, matching `AlgorithmDetail`'s convention.
- Rebuilt `learn.html`: each `LESSONS` row renders as a single `<a class="lesson-card" [routerLink]="['/learn', lesson.id]">` wrapping the algorithm label, title, objective, and a completion element that reads "Completed" or "Not started" in text (plus a decorative `aria-hidden="true"` checkmark glyph when complete) — mirroring `Algorithms`' `.algorithm-card` anchor-as-card shape. Deleted the `role="status"` placeholder paragraph claiming the lesson player is unbuilt.
- Rebuilt `learn.scss`: kept `.intro`/`.lesson-list`/`.lesson-card__algorithm`, converted `.lesson-card` from a plain `<li>` style into the anchor's own block/no-underline/inherited-color/`:focus-visible` treatment (mirroring `.algorithm-card`), deleted the now-unused `.status` rule, and added `.lesson-card__completion`/`--done` — the two states differ by border weight (1px vs 2px) and color, never color alone, with no transition at all (the plan's stated safer default under reduced motion).
- Rewrote `learn.spec.ts` from scratch against `LESSONS`/`LessonProgress` instead of the placeholder `upcomingLessons`: card count/order derived from `LESSONS.length`, href assertions derived from each lesson's own `id`, a not-started-before-completion assertion, a same-fixture live-update assertion after `markComplete` (only the marked card's wording changes), and — Task 2 — a full in-app round trip (`RouterTestingHarness`, `provideRouter(routes)`, `FakeAudioContext` via `AUDIO_CONTEXT_CTOR` for the destination lesson page's embedded `PlaySurface`) that reads a rendered card's own `href` and navigates to it, plus a second test proving a lesson completed through `LessonProgress` before a *fresh* `/learn` navigation still renders correctly — the index reads live facade state, not a snapshot.
- Closes Phase 6's vertical slice: `LessonDetail` (built in 06-01/06-02) was unreachable from any in-app link until this plan; `/learn` is now the only in-app entry point into a lesson, per D-09.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rebuild /learn as a data-driven lesson index with per-card completion state** - `d460ac6` (feat)
2. **Task 2: Prove the index-to-lesson round trip and the facade-to-index completion link** - `7c836fe` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/app/features/learn/learn.ts` - deleted `UpcomingLesson`/`upcomingLessons`; added `lessons = LESSONS` and injected `LessonProgress`
- `src/app/features/learn/learn.html` - `@for` over `lessons`, one anchor-card per row with a worded completion element; removed the "isn't built yet" placeholder line
- `src/app/features/learn/learn.scss` - anchor-as-card treatment (`:focus-visible`, no-underline), new `.lesson-card__completion`/`--done` rules, removed `.status`
- `src/app/features/learn/learn.spec.ts` - full rewrite: data-driven rendering/order/href/completion-wording assertions (Task 1) plus the browse-to-lesson round trip and facade-to-fresh-index assertions (Task 2)

## Decisions Made

- Completion state's CSS class and `data-state` attribute are presentation-only hooks; every test and the actual accessible content assert against the rendered text ("Completed"/"Not started"), never the class or attribute, satisfying the plan's non-color-only prohibition without any ambiguity about which signal is load-bearing.
- The round-trip test extracts the first rendered card's own `href` and navigates `RouterTestingHarness` to that literal string rather than calling `Router.navigate(['/learn', id])` — this is the same pattern `algorithms.spec.ts`'s existing round trip already uses and is what the plan's `<read_first>` list names as the precedent to follow; it proves the *rendered* link resolves correctly, not just that the route table itself is wired.
- No lesson titles, slugs, or card counts are restated as literals anywhere in the rewritten spec — every expectation is derived from the imported `LESSONS` array, so Phase 11's future rows inherit this gate with zero spec changes, matching the plan's explicit instruction.

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes were needed; `npm run build`, `npm test` (801/801), and `npm run lint` were all green on the first run for both tasks.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 6's full vertical slice (browse `/learn` → open a lesson → embedded diagram + play surface → try-this → completion, reflected back on `/learn`) is now reachable end-to-end in-app for both `LESSONS` rows.
- Plan 06-04's real-browser listening checkpoint remains open (carried over from 06-01/06-02): automated tests prove the mechanism for both lessons and the index now links to them, but no human has yet confirmed the embedded play surface sounds identical to `Playground`'s, or performed the manual UI/keyboard/reduced-motion pass over `/learn`'s new completion-state cards.
- No blockers. `npm run build`, `npm test` (801/801, up from 796 at the start of this plan), and `npm run lint` are all green; no file outside `src/app/features/learn/` was touched.

## Self-Check: PASSED

All 4 files listed under Files Created/Modified were verified present on disk with the expected
content, and both task commit hashes (`d460ac6`, `7c836fe`) were verified present in git history.

---
*Phase: 06-guided-lessons-for-algorithm-32-and-algorithm-1*
*Completed: 2026-08-10*
