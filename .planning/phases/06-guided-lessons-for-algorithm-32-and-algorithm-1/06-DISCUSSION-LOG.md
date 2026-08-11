# Phase 6: Guided lessons for Algorithm 32 and Algorithm 1 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 6-Guided lessons for Algorithm 32 and Algorithm 1
**Areas discussed:** Lesson framework generality, "Try this" interactive surface, Completion check
mechanism, Lesson navigation structure

---

## Lesson framework generality

| Option | Description | Selected |
|--------|-------------|----------|
| Generic data-driven model | One LessonDefinition shape + one LessonPlayer that reads it, matching ARCHITECTURE.md's "Lesson definitions and completion rules." Phase 11 becomes "add 30 more data records," not a rewrite. | ✓ |
| Two bespoke components | Hand-write Lesson32 and Lesson1 as their own components. Faster for two lessons, but Phase 11 would need to retrofit a generic model out of diverging implementations. | |

**User's choice:** Generic data-driven model (recommended option).
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Structured + verifiable | Try-this step names the exact parameter/operator/direction as data, enabling a behavior-verified completion check and reuse across all 30 future lessons. | ✓ |
| Free-text instructional copy | Just written instructions; completion can then only be self-reported since there's no structured target to check. | |

**User's choice:** Structured + verifiable (recommended option).
**Notes:** None.

---

## "Try this" interactive surface

| Option | Description | Selected |
|--------|-------------|----------|
| Embedded inline | Lesson page embeds the same keyboard/engine surface Playground uses (shared, not duplicated) so the learner never leaves the lesson to hear the change. | ✓ |
| Hand off to /playground | Lesson sets up InstrumentState then links to /playground. Simpler, but breaks the single-page lesson flow. | |

**User's choice:** Embedded inline (recommended option).

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, auto-set on lesson start | Starting a lesson auto-sets InstrumentState to that lesson's algorithm/starting patch via existing setAlgorithm/reset commands. | ✓ |
| No, leave current state untouched | Lesson only shows instructions; try-this may not sound as described if the learner isn't already on the right patch. | |

**User's choice:** Yes, auto-set on lesson start (recommended option).

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, embed the diagram | Reuses Phase 4's diagram component inline in the lesson, alongside the explanation. | ✓ |
| No, just link to /algorithms/:id | Lesson text links out to the existing detail route instead. | |

**User's choice:** Yes, embed the diagram (recommended option).
**Notes:** None.

---

## Completion check mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Behavior-verified | Lesson watches InstrumentState and marks the step done once the learner actually moved the named parameter in the named direction. | ✓ |
| Self-reported "Mark complete" | A button the learner clicks whenever they feel done, regardless of whether they touched the parameter. | |

**User's choice:** Behavior-verified (recommended option).

| Option | Description | Selected |
|--------|-------------|----------|
| Parameter change + at least one note played | Completion requires both the parameter moving as instructed AND a note triggered afterward, so the change was actually audible. | ✓ |
| Parameter change alone is enough | Mark complete as soon as the parameter moves, whether or not a note was played after. | |

**User's choice:** Parameter change + at least one note played (recommended option).

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, in-memory completion tracked + shown | A LessonProgress facade marks each lesson done/not-done, shown as a checkmark on the /learn index. Resets on reload. | ✓ |
| No progress tracking this phase | Completion is only a per-lesson-page confirmation; nothing tracked or shown elsewhere. | |

**User's choice:** Yes, in-memory completion tracked + shown (recommended option).
**Notes:** None.

---

## Lesson navigation structure

| Option | Description | Selected |
|--------|-------------|----------|
| One scrolling page | All four parts visible on one page — objective, explanation + diagram, try-this + play surface, completion state. No step-tracking UI. | ✓ |
| Step-by-step wizard | Next/Back buttons reveal one part at a time. More scaffolded, but adds wizard-state UI complexity. | |

**User's choice:** One scrolling page (recommended option).

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, /learn index → /learn/:lessonId | /learn becomes an index of lesson cards linking to /learn/:lessonId, matching GSD_NEW_PROJECT_PROMPT.md's suggested route shape and Phase 4's browse→detail pattern. | ✓ |
| No, keep /learn as a single page | Both lessons render inline on /learn itself, no per-lesson route. | |

**User's choice:** Yes, /learn index → /learn/:lessonId (recommended option).
**Notes:** None.

---

## Claude's Discretion

- Exact TypeScript shape of `LessonDefinition` beyond the try-this data shape, and of the
  `LessonProgress` facade's public API.
- Exact wording/pedagogical framing of the two lessons' objective and explanation text.
- Exact starting patch each lesson auto-sets.
- Exact `targetOperator`/`targetParam`/`direction` chosen for each lesson's try-this step.
- Whether the shared play-surface component is extracted from Playground into a standalone
  component now, or the lesson composes Playground's existing sub-pieces directly.
- Exact visual treatment of the completion checkmark/done state.
- Whether `LessonProgress` lives as its own facade or a thin extension alongside `InstrumentState`.

## Deferred Ideas

None — discussion stayed within phase scope. The full 32-algorithm curriculum, per-algorithm
curated presets (CURR-01/Phase 11), and lesson-progress persistence across reload (PERSIST-01/
Phase 12) were named as explicitly out of scope, not new deferred ideas.
