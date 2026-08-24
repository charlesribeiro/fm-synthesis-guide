# Phase 11: Curriculum across all 32 algorithms - Pattern Map

**Mapped:** 2026-08-23
**Files analyzed:** 6 (2 new, 4 modified)
**Analogs found:** 6 / 6 — this phase is entirely additive to code it already owns (Phase 6), so
every "new" file's closest analog is the very file it extends.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/domain/dx7/lessons/lessons.ts` (add builder fn + 30 rows) | domain data/service (pure fn) | transform (CRUD-like generation) | itself — `buildAlgorithm1StartingPatch` (same file, lines 109-137) | exact |
| `src/app/domain/dx7/lessons/lesson-definition.ts` (grow `LessonId`/`LESSON_IDS`) | model/config | CRUD (type + frozen array) | itself, lines 14-19 | exact |
| `src/app/domain/dx7/lessons/hop-distance.ts` (NEW, suggested name) | utility (pure fn) | transform | `src/app/domain/dx7/models/derive-role.ts` (whole file) | role-match |
| `src/app/domain/dx7/lessons/lesson-grouping.ts` (NEW, suggested name) | utility (pure fn) | transform | `derive-role.ts`'s `deriveCarriers` (lines 33-40) | role-match |
| `src/app/features/learn/learn.ts` (add grouped + count `computed()`) | component/provider (view-model) | request-response (reactive read) | itself, whole file | exact |
| `src/app/features/learn/learn.html` (group headers + counts) | component template | request-response | itself, whole file | exact |

No files in this phase have zero analog — every file is a direct extension of a Phase 6
predecessor with an identical role and data-flow shape.

## Pattern Assignments

### `src/app/domain/dx7/lessons/lessons.ts` — shared structural builder function (D-04–D-08) + 30 `LESSONS` rows

**Analog:** the same file's existing `buildAlgorithm1StartingPatch` (lines 109-137) and
`buildAlgorithm32StartingPatch` (lines 58-73), plus the `LESSONS` array literal (lines 144-208).

**Imports pattern** (lines 1-11):
```typescript
import { ALGORITHMS } from '../models/algorithms';
import { deriveCarriers } from '../models/derive-role';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import {
  DEFAULT_ENVELOPE,
  DEFAULT_OPERATOR_PARAMETERS,
  type Dx7Envelope,
  type OperatorParameters,
} from '../models/operator-parameters';
import type { InstrumentPatch, OperatorParameterSet } from '../models/patch';
import type { LessonDefinition, LessonId } from './lesson-definition';
```
New builder function additionally needs `getFeedbackOperator` from `derive-role.ts` and (if split
into its own file) an export of `ALGORITHM_1_MODULATOR_ENVELOPE` — currently module-local, lines
30-33; RESEARCH.md's own recommendation is to keep the new builder in this same file so the const
stays unexported.

**Shared envelope-by-role pattern** (line 126, inside `buildAlgorithm1StartingPatch`):
```typescript
envelope: carriers.includes(operatorId) ? DEFAULT_ENVELOPE : ALGORITHM_1_MODULATOR_ENVELOPE,
```
Copy verbatim into the new builder function — D-05 requires the exact same two-envelope rule
reused across all 30 algorithms, no per-algorithm variation.

**Frozen-at-every-level construction pattern** (lines 58-73, `buildAlgorithm32StartingPatch` — the
simpler of the two existing builders, best template for a parametrized version):
```typescript
function buildAlgorithm32StartingPatch(): InstrumentPatch {
  const operatorEntries = OPERATOR_IDS.map((operatorId) => {
    const parameters: OperatorParameters = Object.freeze({
      ...DEFAULT_OPERATOR_PARAMETERS,
      ratio: operatorId,
    });
    return [operatorId, parameters] as const;
  });
  const operators = Object.freeze(Object.fromEntries(operatorEntries)) as OperatorParameterSet;

  return Object.freeze({
    algorithmId: 32,
    operators,
    feedback: 0,
  });
}
```
The new `buildStructuralStartingPatch(algorithm: AlgorithmDefinition): InstrumentPatch` follows this
exact shape (`.map` over `OPERATOR_IDS` → spread `DEFAULT_OPERATOR_PARAMETERS` → freeze each
parameter object → freeze the `Object.fromEntries` map → freeze the returned patch object), but
takes an `AlgorithmDefinition` parameter instead of hardcoding `algorithmId`/`ratio`, and derives
`carriers`/`feedbackOperator` from that parameter via `deriveCarriers`/`getFeedbackOperator` (never
a hardcoded per-operator table like `buildAlgorithm1StartingPatch`'s `outputLevels` record — that
record is fine as a *precedent for shape* but must NOT be copied as literal numbers; D-06 requires
levels computed from role + hop distance, not authored per operator).

**Output-level rule precedent to generalize** (lines 113-120, `buildAlgorithm1StartingPatch`'s
`outputLevels` record) — shows the "descending by hop, carriers higher than modulators" pattern
D-06 asks the new hop-distance-driven formula to reproduce structurally, not verbatim:
```typescript
const outputLevels: Readonly<Record<OperatorId, number>> = Object.freeze({
  1: 75, // carrier — short pair (2→1)
  2: 60, // modulator feeding the short pair
  3: 75, // carrier — deeper chain (6→5→4→3)
  4: 55, // deeper chain, nearest output
  5: 50, // deeper chain, middle
  6: 45, // deeper chain, topmost — carries the feedback self-loop
});
```

**`LESSONS` array entry shape to replicate 30x** (lines 144-173, the Algorithm 32 row — simpler
template than Algorithm 1's for the mechanical shape; Algorithm 1's row at lines 174-207 shows the
tryThis-targeting-a-specific-operator pattern for D-11):
```typescript
Object.freeze({
  id: 'algorithm-32' as LessonId,
  algorithmId: 32,
  title: 'Pure additive synthesis',
  objective: "Hear six independent operators sum into one tone, then prove it by removing one of them.",
  explanation: Object.freeze([ /* 2-3 paragraphs, D-09 */ ]),
  startingPatch: buildAlgorithm32StartingPatch(),
  tryThis: Object.freeze({
    targetOperator: 3,
    targetParam: 'outputLevel',
    direction: 'decrease',
    instruction: "Pull operator 3's output level down.",
    expectedEffect: '...',
  }),
}),
```

**Error handling / validation:** none inside builder functions themselves — validation of the
resulting `OperatorParameters`/`InstrumentPatch` happens downstream in `patch.ts`'s
`validateOperatorParameters` (exercised automatically by `lessons.spec.ts`'s `describe.each`, no new
test file needed).

---

### `src/app/domain/dx7/lessons/lesson-definition.ts` — grow `LessonId`/`LESSON_IDS`

**Analog:** itself, lines 14-19.

**Current shape:**
```typescript
export type LessonId = 'algorithm-32' | 'algorithm-1';
export const LESSON_IDS: readonly LessonId[] = Object.freeze(['algorithm-32', 'algorithm-1']);
```

**Target shape** (union grows to 32 members `'algorithm-1'` through `'algorithm-32'`; `LESSON_IDS`
lists all 32 in the exact curriculum order derived from D-01/D-02/D-03 — see RESEARCH.md's fully
worked-out 32-element array, reproduced below for direct reuse):
```typescript
[
  'algorithm-32',
  'algorithm-26', 'algorithm-27', 'algorithm-28', 'algorithm-29', 'algorithm-30', 'algorithm-31',
  'algorithm-1',
  'algorithm-2', 'algorithm-3', 'algorithm-4', 'algorithm-5', 'algorithm-6',
  'algorithm-7', 'algorithm-8', 'algorithm-9', 'algorithm-10', 'algorithm-11', 'algorithm-12',
  'algorithm-13', 'algorithm-14', 'algorithm-15', 'algorithm-16', 'algorithm-17', 'algorithm-18',
  'algorithm-19', 'algorithm-20', 'algorithm-21', 'algorithm-22', 'algorithm-23', 'algorithm-24',
  'algorithm-25',
]
```
`isLessonId` (lines 24-26) is unchanged — already generic over `LESSON_IDS`.

---

### NEW `hop-distance.ts` (suggested location: `src/app/domain/dx7/models/` alongside `derive-role.ts`, or inline as a private helper in `lessons.ts` — Claude's discretion per RESEARCH.md)

**Analog:** `src/app/domain/dx7/models/derive-role.ts` — whole file (55 lines), same "pure function
over `AlgorithmDefinition.edges`, no Angular import, throws/asserts on contract violation" pattern.

**Pattern to copy — pure recursive/BFS fn over `edges`, following the file's existing style:**
```typescript
// mirror this file's getFeedbackOperator/getOperatorRole style: pure, reads algorithm.edges
// directly, no memoization, no hidden state
export function hopDistanceFromOutput(algorithm: AlgorithmDefinition, operatorId: OperatorId): number {
  if (getOperatorRole(algorithm, operatorId) === 'carrier') return 0;
  const outgoing = algorithm.edges.filter(
    (edge) => edge.from === operatorId && edge.to !== operatorId, // exclude self-loop, mirrors
                                                                    // getOperatorRole's own
                                                                    // "edge.to !== operatorId" guard
  );
  const targetHops = outgoing.map((edge) => hopDistanceFromOutput(algorithm, edge.to));
  // RESEARCH.md Pitfall 5: do not just take targetHops[0] — assert all fan-out targets agree,
  // mirroring this codebase's "throw on contract violation" convention (getLesson's RangeError, etc.)
  if (new Set(targetHops).size > 1) {
    throw new RangeError(`operator ${operatorId} fans out to targets at differing hop-depths`);
  }
  return 1 + targetHops[0];
}
```

---

### NEW `lesson-grouping.ts` (suggested location: `src/app/domain/dx7/lessons/`)

**Analog:** `deriveCarriers` (`derive-role.ts` lines 33-40) — same "filter/bucket a fixed-order
source array by a derived key" shape.

```typescript
// mirrors derive-role.ts:33-40's "filter the fixed source array" style
export function groupLessonsByTeachingTag(
  lessons: readonly LessonDefinition[],
  algorithms: readonly AlgorithmDefinition[],
): readonly LessonGroup[] {
  // bucket by algorithm.teachingTags[0], in curriculum group order (parallel, additive-stacks,
  // tree-branch, rooting per D-02) — a single pass over `lessons` (already in curriculum order
  // per LESSON_IDS), no re-sort needed
}
```
Consumed by `Learn`'s `computed()` — never hardcode group boundaries in `learn.html` (CLAUDE.md:
"algorithm topology is data, never hardcoded template layout").

---

### `src/app/features/learn/learn.ts` — grouped view-model + D-14 aggregate counts

**Analog:** itself, whole file (28 lines) — the existing flat `lessons`/`lessonProgress` fields are
the direct precedent for adding two more `computed()`-derived fields alongside them.

**Current shape to extend** (lines 20-28):
```typescript
export class Learn {
  protected readonly lessons = LESSONS;
  protected readonly lessonProgress = inject(LessonProgress);
}
```

**Pattern to add** — `computed()` reading the live `LessonProgress.completed` signal, mirroring the
existing "read-through the facade, no local mirror" discipline already stated in this file's doc
comment (lines 25-26):
```typescript
protected readonly groupedLessons = computed(() => groupLessonsByTeachingTag(LESSONS, ALGORITHMS));
protected readonly overallCompletedCount = computed(() => this.lessonProgress.completed().size);
// per-group counts: computed() closing over groupedLessons() + lessonProgress.completed()
```
No new facade method beyond `LessonProgress.completed` itself (D-14) — count arithmetic is a plain
`computed()` in the component, matching CLAUDE.md's "prefer computed... read-only facades."

---

### `src/app/features/learn/learn.html` — group headers + per-group/overall counts

**Analog:** itself, whole file (29 lines) — the existing flat `@for (lesson of lessons; ...)` loop
(lines 8-29) is the direct precedent for a nested `@for` over groups then lessons.

**Current shape:**
```html
<ul class="lesson-list">
  @for (lesson of lessons; track lesson.id) {
    <li>
      <a class="lesson-card" [routerLink]="['/learn', lesson.id]">
        ...
      </a>
    </li>
  }
</ul>
```
**Target shape (D-13):** nest an outer `@for (group of groupedLessons; track group.tag)` producing a
labelled `<section>`/heading per group, with the existing `<li>`/`.lesson-card` markup unchanged
inside an inner `@for` — so `learn.spec.ts`'s per-card assertions (querying `.lesson-card` class)
keep working, only the DOM nesting around them changes. **Flag:** `learn.spec.ts` lines 26-36
currently assert a *flat* `.lesson-card` NodeList in `LESSONS` order — this test's selector
strategy needs updating (query cards within `.lesson-group` sections) once grouping ships; this is
not purely additive to the DOM structure it depends on.

## Shared Patterns

### Frozen-at-every-level construction
**Source:** `src/app/domain/dx7/lessons/lessons.ts` lines 58-73 and 109-137
**Apply to:** the new shared builder function and every one of the 30 new `LESSONS` rows —
`Object.freeze` on the patch object, the `operators` map, and each individual `OperatorParameters`
object; never mutate `DEFAULT_OPERATOR_PARAMETERS`/`DEFAULT_ENVELOPE` in place.

### Derive-don't-restate structural facts
**Source:** `src/app/domain/dx7/models/derive-role.ts` (whole file) — `deriveCarriers`,
`getFeedbackOperator`, `getOperatorRole`
**Apply to:** the new builder function, the new hop-distance helper, and every lesson's prose —
never hardcode a per-algorithm carrier/role/feedback list; always call these functions against the
live `ALGORITHMS` row. Also: do not trust the dataset's free-text `name` field for role information
(RESEARCH.md Pitfall 3) — `edges` via these functions is the only source of truth.

### Validate-or-throw on lookup / contract violation
**Source:** `src/app/domain/dx7/lessons/lessons.ts`'s `getLesson` (lines 225-231) and
`src/app/state/lesson-progress.ts`'s `isComplete`/`markComplete` (lines 26-31, 42-51)
**Apply to:** the new hop-distance helper's fan-out-disagreement guard (throw `RangeError`, mirror
existing message style: `` `lessonId ${id} is not a known lesson` ``-style template literals naming
the offending value).

### Read-through facade, no local state mirror
**Source:** `src/app/features/learn/learn.ts` (whole file, esp. lines 25-27)
**Apply to:** the new grouped/aggregate-count `computed()` signals in `Learn` — derive live from
`LessonProgress.completed`, never copy it into a new local signal.

### `describe.each` dataset-iterating invariant test — no spec changes needed
**Source:** `src/app/domain/dx7/lessons/lessons.spec.ts` lines 58-124 (not read this session in
full; referenced from RESEARCH.md and confirmed by file structure)
**Apply to:** all 30 new `LESSONS` rows — this suite already iterates `LESSON_IDS`/`LESSONS`, so
growing the array to 32 rows inherits full invariant coverage (frozen-at-every-level, valid operator
parameters, valid feedback level, non-empty prose, reachable try-this direction) with zero spec
file edits.

## No Analog Found

None — every file in this phase's scope is a direct extension of an existing Phase 6 file with an
identical role and data-flow shape (see File Classification table above).

## Metadata

**Analog search scope:** `src/app/domain/dx7/lessons/`, `src/app/domain/dx7/models/`,
`src/app/state/`, `src/app/features/learn/`
**Files scanned:** `lessons.ts`, `lesson-definition.ts`, `derive-role.ts`, `try-this.ts`,
`lesson-progress.ts`, `learn.ts`, `learn.html`, `algorithms.ts` (partial, lines 1-100)
**Pattern extraction date:** 2026-08-23
