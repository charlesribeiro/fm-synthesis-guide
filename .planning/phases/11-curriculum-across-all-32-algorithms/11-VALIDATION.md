---
phase: 11
slug: curriculum-across-all-32-algorithms
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-23
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` via `@angular/build:unit-test` (Angular 22's integrated builder) [VERIFIED: `package.json`, `11-RESEARCH.md`] |
| **Config file** | none — builder-managed (`angular.json`'s `test` target; no standalone `vitest.config.ts`) |
| **Quick run command** | `npm test -- --include='**/<changed-spec-file>.spec.ts'` (`ng test`'s positional argument is the *project* name, not a spec filter — `npm test -- <pattern>` errors with "Invalid values: Argument: project"; `--include` is the documented glob-filter option) |
| **Full suite command** | `npm test` (runs once and exits outside a TTY — no separate quick/full split in this project) |
| **Actual runtime at phase close** | 1978/1978 tests, 52 test files, ~2.16s (up from 1296/1296 at Phase 10 close) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --include='**/<changed-spec-file>.spec.ts'`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** `npm run build`, `npm test`, `npm run lint` all green (per CLAUDE.md's three-gate requirement)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Filled in from the five executed plans' actual task breakdowns (11-01-PLAN.md through 11-05-PLAN.md)
and cross-checked against each plan's SUMMARY.md Task Commits section and `git log`, not from this
draft's original placeholder rows.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure/Observable Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------------------|-----------|--------------------|-------------|--------|
| Task 1 | 11-01 | 1 | CURR-01 | T-11-03, T-11-04 | `hopDistanceFromOutput`/`maxModulatorHopDistance`/`deepestModulators` compute hop-distance-from-output over an algorithm's edges, refusing to guess on a fan-out depth disagreement (Algorithms 19/22) or a modulation cycle (explicit visited-operator guard, proven via break/restore probe); Algorithm 26's lesson renders end to end through the new structural builder as the tracer proof | unit/component (tdd) | `npm test -- --include='**/hop-distance.spec.ts'` | ✓ Exists | ✅ passed |
| Task 2 | 11-01 | 1 | CURR-01 | T-11-01, T-11-02 | `buildStructuralStartingPatch`/`selectTryThisTarget`/`buildStructuralTryThis` generate a valid, frozen, derived preset and try-this experiment for the Parallel group's remaining five algorithms (27-31), each reachable at its own `/learn/:lessonId` route; `LESSON_IDS` reaches its eight-member curriculum sequence | unit/component (tdd) | `npm test -- --include='**/lessons.spec.ts'` | ✓ Exists | ✅ passed |
| Task 1 | 11-02 | 1 | CURR-01 (success criterion 1) | — | `groupLessonsByTeachingTag` is a pure, framework-independent transform bucketing lessons into the four curriculum sections in D-02's fixed order (`parallel`, `additive-stacks`, `tree-branch`, `rooting`), frozen at every level, raising `RangeError` on an unknown algorithm id or empty `teachingTags` rather than silently dropping a lesson | unit (tdd, tracer) | `npm test -- --include='**/lesson-grouping.spec.ts'` | ✓ Exists | ✅ passed |
| Task 2 | 11-02 | 1 | CURR-01 (success criterion 1) | T-11-05, T-11-06 | `CURRICULUM_GROUP_ORDER` is a permutation of the dataset's own `TEACHING_TAGS` (asserted twice: module-load guard + spec); `CURRICULUM_GROUP_LABELS`/`CURRICULUM_GROUP_DESCRIPTIONS` are total, frozen, original prose naming no third-party product | unit (tdd) | `npm test -- --include='**/lesson-grouping.spec.ts'` | ✓ Exists | ✅ passed |
| Task 1 | 11-03 | 2 | CURR-01 | T-11-02, T-11-07 | Additive Stacks group's five remaining lessons (Algorithms 2-6) each ship a `structuralLesson` row with a derived preset and experiment; duplicate-topology pair 5≡6 states the shared shape honestly | unit/component | `npm test -- --include='**/lessons.spec.ts'` | ✓ Exists | ✅ passed |
| Task 2 | 11-03 | 2 | CURR-01 | T-11-01, T-11-02, T-11-07 | Tree and Branch group's first six lessons (Algorithms 7-12) ship; feedback-relocation pairs (2 v 1, 8 v 9, 10 v 3) and duplicate cluster 3≡4≡11 cross-checked by a hand-populated expected-target table front-loaded from this task | unit/component | `npm test -- --include='**/try-this-selection.spec.ts'` | ✓ Exists | ✅ passed |
| Task 3 | 11-03 | 2 | CURR-01 | — | Generic `describe.each` prose-shape invariant suite over every `LESSONS` row (paragraph count, D-12 objective grammar, non-emptiness, `algorithm-<id>` naming, id uniqueness), written against `LESSON_IDS`/`LESSONS` length rather than a literal count; duplicate-cluster converse proofs (3/4/11, 2/12) | unit (tdd) | `npm test -- --include='**/lessons.spec.ts'` | ✓ Exists | ✅ passed |
| Task 1 | 11-04 | 3 | CURR-01 | T-11-01, T-11-02 | Tree and Branch group's last six lessons (Algorithms 13-18) ship; 13≡14≡1 three-way identical cluster stated honestly; Algorithm 15's role taken from `deriveCarriers`/`deriveIsolatedCarriers`, not the dataset's loose free-text name | unit/component | `npm test -- --include='**/lessons.spec.ts'` | ✓ Exists | ✅ passed |
| Task 2 | 11-04 | 3 | CURR-01 | T-11-08 | Rooting group's seven lessons (Algorithms 19-25) ship; Algorithm 19's `reviewStatus: 'unresolved'` provenance flag handled per the flagged assumption — ordinary row, same rules as every other, no learner-facing caveat or badge, tested directly (`isUnresolvedAlgorithm(algorithm19) === true`) | unit/component | `npm test -- --include='**/structural-lesson-patch.spec.ts'` | ✓ Exists | ✅ passed |
| Task 3 | 11-04 | 3 | CURR-01, D-01, D-02, D-13 | — | Whole-curriculum invariant suite: lesson-to-algorithm bijection (every one of the 32 canonical algorithms has exactly one lesson); curriculum ordering checked against `CURRICULUM_GROUP_ORDER` and the dataset's own teaching tags; `groupLessonsByTeachingTag` yields four non-empty groups of 7/6/12/7; `isAdditiveLikeAlgorithm` whole-dataset membership (21, 23, 24, 25, 29, 31, 32); all five duplicate-topology clusters proven pairwise-equal, with Algorithm 1 proven NOT equal to Algorithm 13 despite identical routing | unit (tdd) | `npm test -- --include='**/lessons.spec.ts'` | ✓ Exists | ✅ passed |
| Task 1 | 11-05 | 4 | CURR-01 (success criteria 1, 2) | T-11-09 | `Learn.groupedLessons`/`totalLessonCount`/`completedLessonCount`/`completedCountFor(group)` render four labelled curriculum sections holding all 32 cards in fixed curriculum order with live per-section and overall completion counts; no group name, boundary or count hardcoded in `learn.html`; `LessonProgress` untouched (D-15); cards never reorder on completion (D-16); heading hierarchy is one `h1`, four `h2`, thirty-two `h3` | component (tdd) | `npm test -- --include='**/learn.spec.ts'` | ✓ Exists | ✅ passed |
| Task 2 | 11-05 | 4 | CURR-01, D-10 | T-11-07 | Blocking human-verify checkpoint: index legibility at 32 cards, duplicate-cluster prose honesty, distinguishing-feature sampling across the rest, preset audibility/click-safety, keyboard/screen-reader/colour/motion accessibility, provenance including Algorithm 19's treatment — see Manual-Only Verifications below for the recorded outcome | manual (blocking checkpoint) | none — human review, `npm start` dev server | N/A | ✅ approved 2026-08-24 |
| Task 3 | 11-05 | 4 | CURR-01 | — | Checkpoint findings applied (none — zero findings) and this validation record completed: per-task verification map filled with real task ids/plans/waves, both manual-only rows recorded with the checkpoint's actual outcome, sign-off checklist completed, frontmatter status set to `validated` | docs/validation | `npm test && npm run lint && npm run build` | ✓ Exists (this file) | ✅ passed |

*Threat Ref detail (ASVS L1, block on high — per active `security` capability): **T-11-01** — an untrusted
`:lessonId` route segment reaches `LESSONS_BY_ID` without validation (Tampering); mitigation is the
existing `isLessonId` guard, unchanged mechanism, now covering 32 legal values instead of 2, exercised by
`lesson-detail.spec.ts`'s rejected-address matrix (kept meaningful across all three growth plans by
replacing the `algorithm-2`/`algorithm-33` landmine slug as the union grew). **T-11-02** — a malformed/
invalid generated `startingPatch` reaches `InstrumentState` (Tampering/DoS via crash); mitigation is the
existing `validateOperatorParameters`/`validateFeedbackLevel` guards at the `LessonDetail` →
`InstrumentState` boundary, plus the `describe.each([...LESSONS])` invariant suite and
`structural-lesson-patch.spec.ts`'s derivation-rule assertions catching an invalid or wrongly-derived
patch at test time. **T-11-03** — unbounded recursion in `hopDistanceFromOutput` over a malformed cyclic
edge list (DoS); mitigation is the explicit visited-operator guard raising a `RangeError` naming the
operator, proven via break/restore probe to have real teeth (V8's own stack-overflow `RangeError` would
otherwise have silently defeated a weaker assertion). **T-11-04** — a fan-out operator whose targets sit
at differing hop-distances (Tampering, silent wrong-answer); mitigation is an explicit
depth-agreement check across every outgoing edge, asserted against real fan-out rows (Algorithms 19, 22)
and a synthetic disagreeing fixture. **T-11-05** — a lesson whose `algorithmId` is absent from the
algorithm list, or whose row carries no teaching tag, silently dropped from the grouped index
(Tampering/correctness); mitigation is `groupLessonsByTeachingTag` raising `RangeError` naming the id.
**T-11-06** — group labels/descriptions rendered to learners (Information Disclosure, accepted — original
prose, no third-party product/patch-bank/manual text named). **T-11-07** — lesson prose and preset
provenance across the whole phase (Repudiation); mitigation closed at this plan's blocking checkpoint,
which explicitly confirmed every preset value is rule-derived from this repository's own dataset and
every explanation is originally authored, with no patch bank, manual scan or third-party diagram
consulted (Check 2, Check 3, Check 6 — approved, zero findings). **T-11-08** — Algorithm 19's
`unresolved` provenance flag (Repudiation, accepted); the flag records an unreconciled edge-list reading,
not routing invalidity, and the decision to generate its lesson normally with no learner-facing caveat
was raised explicitly at the 11-05 checkpoint (Check 6) and approved. **T-11-09** — lesson titles,
objectives and group descriptions rendered on `/learn` (Tampering via markup injection, low); mitigation
is that all rendered curriculum text is compile-time constant from the domain layer, bound through
interpolation only (never inner-HTML), confirmed by
`grep -c "innerHTML" src/app/features/learn/learn.html` reporting `0`. See `11-RESEARCH.md` § Security
Domain and each plan's own `<threat_model>` block.*

---

## Wave 0 Requirements

- [x] A dedicated spec for the new shared builder function (`structural-lesson-patch.spec.ts`) directly
      asserting the D-05/D-06/D-07/D-08 rules per role (carrier vs. modulator envelope, hop-distance-based
      output level, ratio-exception membership via `isAdditiveLikeAlgorithm`, fixed feedback value) — met
      by plan 11-01 Task 1/2, extended by 11-04 Task 2/3.
- [x] A dedicated spec for the new hop-distance helper (`hop-distance.spec.ts`), including explicit
      coverage of the fan-out cases flagged in `11-RESEARCH.md` (Algorithm 19, Algorithm 22) — met by
      plan 11-01 Task 1 (threat T-11-04's mitigation row).
- [x] A dedicated spec for the "Algorithm-32-like" predicate (D-07), asserting `true` for the locked-in
      candidates and `false` for at least one clear non-candidate — met by `structural-lesson-patch.spec.ts`'s
      hand-populated `EXPECTED_TRUE_IDS`/`EXPECTED_FALSE_IDS` table, extended to the whole dataset (21, 23,
      24, 25, 29, 31, 32) by plan 11-04 Task 3.
- [x] `learn.spec.ts` restructured with new assertions for grouped rendering (D-13) and aggregate counts
      (D-14) — met by plan 11-05 Task 1: four-section assertions, per-section/total counts derived from
      `groupLessonsByTeachingTag` rather than literals, document-order stability proof, live count-update
      proof, heading-hierarchy proof.
- [x] Framework install: none — Vitest via `@angular/build:unit-test` already fully covered this phase's
      needs; every plan's `tech-stack.added` is `[]`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Outcome |
|----------|-------------|------------|--------------------|---------|
| The eight duplicate-cluster lessons among the 30 new rows (Algorithms 13/14, 3/4/11, 24/25/31) plus a sampled remainder of the other twenty-two name a concrete distinguishing structural feature (chain length, branch count, feedback-operator position, independent-path count) rather than generic shared template prose. Fully identical clusters must honestly describe their shared topology rather than inventing distinct routing features. | CURR-01, D-10 | Prose distinguishing-feature quality is a human-judgment reading task; no automated check can verify an explanation is honest and specific rather than templated filler | Read the eight duplicate-cluster lessons (Algorithms 13, 14, 3, 4, 11, 24, 25, 31) plus a sampled remainder of the other twenty-two (not all 30 as an exhaustive pass). Identical clusters must state the shared shape; do not require invented per-algorithm routing features. | **Verified 2026-08-24 (sampled, not exhaustive).** Human reviewer read the checkpoint's Check 2 (eight duplicate-cluster lessons: Algorithms 13, 14, 3, 4, 11, 24, 25, 31) and Check 3 (eight-plus of the remaining twenty-two lessons across all four groups, including the Algorithm 8 v 9 feedback-relocated pair) and replied **"approved"** with zero findings against either check. This row does **not** claim all 30 explanations were read. No routing difference was found asserted where the dataset does not declare one; no lesson read as boilerplate with a number swapped in. |
| `/learn`'s 4-group, 32-card layout stays legible and uncluttered (not a wall of cards) and the D-14 aggregate counts read clearly at a glance | CURR-01 (success criterion 1) | "Legible" and "not competing with the educational signal" (CLAUDE.md) are visual judgments jsdom component tests cannot make | `npm start`, visit `/learn`, confirm the 4 group sections and counts are scannable and keyboard/screen-reader accessible per existing a11y conventions | **Verified 2026-08-24.** Human reviewer worked through the checkpoint's Check 1 (index legibility at narrow and wide viewport), Check 4 (four lessons' presets — Algorithm 31, 7, 22, 5 — audible, click-free, character matching their explanations, try-this steps firing completion), and Check 5 (keyboard-only navigation, visible focus, screen-reader heading/count announcement order, colour-independent completion legibility, no animation under reduced motion) and replied **"approved"** with zero findings against any check. Algorithm 19's `unresolved`-flag treatment (Check 6) was explicitly presented for approval and approved as shipped, unchanged: an ordinary lesson row generated by the same rules as every other, no learner-facing caveat or badge. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — the one exception, plan 11-05 Task 2,
      is a `checkpoint:human-verify gate="blocking"` task by design (prose honesty, visual legibility and
      accessibility are explicitly not machine-checkable per this phase's `must_haves` "backstop"
      convention), and it is bracketed on both sides by tasks with green automated verify.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — the single manual task
      (11-05 Task 2) sits between 11-05 Task 1 (automated) and 11-05 Task 3 (automated), so at most one
      consecutive task lacks automated feedback.
- [x] Wave 0 covers all MISSING references — all five Wave 0 requirements above are met.
- [x] No watch-mode flags — every automated command above runs once and exits (`npm test`/`npm run
      build`/`npm run lint`, no `--watch`).
- [x] Feedback latency < 60s — full suite runs in ~2.2s at phase close (1978/1978 tests, 52 files).
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** validated. Automated gates green across all five plans (`npm test` 1978/1978, `npm run
lint` clean, `npm run build` clean including `assert-no-harness-in-dist`) as re-confirmed at this task's
own commit. Plan 11-05's blocking human-verify checkpoint (Task 2) was answered verbatim **"approved"**
on 2026-08-24 with zero findings across all six checks, including explicit approval of Algorithm 19's
`unresolved`-provenance treatment as shipped. No blocking finding required a fix, so this task changes
only this validation record — `git diff --stat` for this task's commit shows only `11-VALIDATION.md`
changed. CURR-01 is fully satisfied: all 32 canonical algorithms have a lesson (objective, explanation,
original derived preset, derived try-this experiment), the `/learn` index presents them as four labelled,
counted curriculum sections rather than a flat 32-item list, and lesson completion is tracked per
algorithm and aggregated per group and overall, updating live with no reload.
