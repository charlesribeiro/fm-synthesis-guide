# Phase 11: Curriculum across all 32 algorithms - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-23
**Phase:** 11-curriculum-across-all-32-algorithms
**Areas discussed:** Lesson grouping & order (prior session, resumed), Original preset depth,
Per-lesson content depth, Progress aggregation

---

## Lesson grouping & order

*Captured in a prior session (2026-08-22) and resumed from checkpoint in this session.*

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse teachingTags as-is | Structure/order follows the dataset's existing four groups unchanged | ✓ |
| Different complexity-based sequence | A new ordering not tied to teachingTags | |
| You decide | Claude picks the sequence | |

**User's choice:** Reuse teachingTags as-is

| Option | Description | Selected |
|--------|-------------|----------|
| Reorder groups to open with Parallel | Sequence the four groups so Parallel (containing Algorithm 32, the existing opener) comes first | ✓ |
| Keep teachingTags order literally | Additive Stacks first, as teachingTags itself orders them | |
| You decide | Claude picks | |

**User's choice:** Reorder groups to open with Parallel

| Option | Description | Selected |
|--------|-------------|----------|
| Pin 32 and 1 as group openers | Algorithm 32 and Algorithm 1 stay first within their respective groups | ✓ |
| Plain ascending ID within each group | No special pinning, just id order | |

**User's choice:** Pin 32 and 1 as group openers

---

## Original preset depth

| Option | Description | Selected |
|--------|-------------|----------|
| Systematic rule set | One shared, documented builder function derives ratio/output-level/envelope from each algorithm's graph structure | ✓ |
| Full bespoke depth per algorithm | Hand-tune all 30 remaining patches individually, matching Algorithm 32/1's authorial depth | |
| You decide | Claude picks per algorithm, no fixed rule | |

**User's choice:** Systematic rule set

| Option | Description | Selected |
|--------|-------------|----------|
| One shared modulator envelope | Every derived modulator across all 30 algorithms gets the same envelope shape | ✓ |
| Small family keyed by chain depth/group | Multiple envelope shapes varying by structural depth | |

**User's choice:** One shared modulator envelope

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed structural rule | Output level computed from role + hop-distance from output | ✓ |
| Hand-picked per algorithm within guardrails | Structural rule as a starting point, manually adjusted | |

**User's choice:** Fixed structural rule

| Option | Description | Selected |
|--------|-------------|----------|
| Ratio 1 everywhere except pure-additive-style algorithms | Default ratio 1, except algorithms whose teaching point is independent partials summing | ✓ |
| Ratio 1 everywhere, no exceptions | Simplest rule, no exceptions | |
| You decide per algorithm | Claude judges case-by-case | |

**User's choice:** Ratio 1 everywhere except pure-additive-style algorithms

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed mid-scale value for every feedback-bearing algorithm | Every algorithm with a declared feedback self-loop gets the same fixed non-zero value | ✓ |
| Always 0 unless the lesson is specifically about feedback | Feedback off by default, only enabled for feedback-focused lessons | |

**User's choice:** Fixed mid-scale value for every feedback-bearing algorithm

**Notes:** None of these questions surfaced additional clarifications — the user selected the
recommended option in every case, keeping the "derived from the canonical graph, never restated"
discipline of the two existing lessons intact while making it scale to 30 algorithms.

---

## Per-lesson content depth

| Option | Description | Selected |
|--------|-------------|----------|
| Structured template, 2-3 paragraphs | Same paragraph structure as Algorithm 32/1, written more concisely | ✓ |
| Match Algorithm 32/1's full prose depth exactly | Same 3 rich paragraphs, same nuance level, for all 30 lessons | |
| Shorter, single-paragraph explanation | One tight paragraph per lesson | |

**User's choice:** Structured template, 2-3 paragraphs

| Option | Description | Selected |
|--------|-------------|----------|
| Systematic rule tied to the algorithm's structure | tryThis target chosen by a fixed rule derived from the graph | ✓ |
| Hand-picked per algorithm | Claude picks per algorithm without one fixed rule | |

**User's choice:** Systematic rule tied to the algorithm's structure

| Option | Description | Selected |
|--------|-------------|----------|
| Share structure, vary the specifics | Lessons in the same group may share template/language but must call out the specific algorithm's distinguishing feature | ✓ |
| Each lesson must be structurally distinct | Every explanation must foreground a genuinely different teaching angle | |

**User's choice:** Share structure, vary the specifics

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed "Hear X, then prove it by Y" pattern | Every objective follows the existing grammatical pattern | ✓ |
| Free-form per lesson | Objective structure varies lesson to lesson | |

**User's choice:** Fixed "Hear X, then prove it by Y" pattern

---

## Progress aggregation

| Option | Description | Selected |
|--------|-------------|----------|
| Group headers matching the 4 teachingTags groups | /learn index renders 4 labelled sections in curriculum order | ✓ |
| Keep it a flat list, just reordered | All 32 cards in one continuous list, no section breaks | |

**User's choice:** Group headers matching the 4 teachingTags groups

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — overall + per-group counts | Computed selector derives "X/32" overall and a count per group | ✓ |
| Yes — overall count only | Just one overall summary | |
| No aggregate count | Keep relying on each card's own badge | |

**User's choice:** Yes — overall + per-group counts

| Option | Description | Selected |
|--------|-------------|----------|
| Stay session-only | No change to LessonProgress's persistence model this phase | ✓ |
| Add persistence now | Pull persistence work forward into Phase 11 | |

**User's choice:** Stay session-only

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed curriculum order always | Cards never move regardless of completion state | ✓ |
| Reorder to surface incomplete lessons | Completed cards visually demote within their group | |

**User's choice:** Fixed curriculum order always

**Notes:** The "stay session-only" question explicitly confirmed persistence remains Phase 12's
(PERSIST-01) responsibility, not a scope expansion for this phase.

---

## Claude's Discretion

- Which specific algorithms qualify as "Algorithm-32-like" under the ratio-exception rule
  (independent partials summing) — judged from each algorithm's derived carrier/modulator
  structure, not a hand-maintained list.
- Exact wording of each lesson's title, explanation paragraphs, and tryThis instruction/
  expectedEffect sentences, within the agreed structural constraints.
- The precise fixed mid-scale feedback numeric value (Algorithm 1's precedent is `3`).
- Exact visual/markup treatment of the new group headers and aggregate counts on `/learn`.

## Deferred Ideas

None — discussion stayed within phase scope.
