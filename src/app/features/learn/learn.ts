import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { groupLessonsByTeachingTag, type LessonGroup } from '../../domain/dx7/lessons/lesson-grouping';
import { LESSONS } from '../../domain/dx7/lessons/lessons';
import { ALGORITHMS } from '../../domain/dx7/models/algorithms';
import { LessonProgress } from '../../state/lesson-progress';

/**
 * `/learn` index (D-13): the curriculum presented as four labelled sections
 * — Parallel, Additive Stacks, Tree and Branch, Rooting, in that order —
 * each holding its own group's lesson cards, plus a live overall and
 * per-section completed-of-total count (D-14). No group name, group
 * boundary, or lesson count is ever hardcoded here — all three come from
 * `groupLessonsByTeachingTag` and `LESSONS` (CLAUDE.md: algorithm topology
 * is data, never hardcoded template layout). Cards never reorder based on
 * completion (D-16): `groupedLessons` is derived from `LESSONS`'s fixed
 * curriculum order and completion is read only for display, never for
 * sorting.
 */
@Component({
  selector: 'app-learn',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './learn.html',
  styleUrl: './learn.scss',
})
export class Learn {
  /** Read through the facade so a completion marked elsewhere in the app
   * updates this index live, with no local mirror of the state. */
  protected readonly lessonProgress = inject(LessonProgress);

  /** The four curriculum sections, in fixed curriculum order (D-01/D-02),
   * each carrying its own lessons in fixed curriculum order (D-03) — the
   * only source of grouped lesson cards this template renders. */
  protected readonly groupedLessons = computed(() => groupLessonsByTeachingTag(LESSONS, ALGORITHMS));

  /** Total lessons in the curriculum, read from the dataset rather than a
   * literal, so growing or shrinking `LESSONS` never desyncs this count. */
  protected readonly totalLessonCount = computed(() => LESSONS.length);

  /** Overall completed count (D-14). Counted over `LESSONS` rather than
   * read directly off `LessonProgress.completed()`'s size, so the number
   * can never exceed the number of cards actually rendered. */
  protected readonly completedLessonCount = computed(() => {
    const completed = this.lessonProgress.completed();
    return LESSONS.filter((lesson) => completed.has(lesson.id)).length;
  });

  /** Per-section completed count (D-14). Reads `LessonProgress.completed`
   * on each call — no new signal, no new `LessonProgress` method (D-15) —
   * which is what keeps this count live under `OnPush` the same way the
   * existing per-card `lessonProgress.isComplete(lesson.id)` template read
   * already does. */
  protected completedCountFor(group: LessonGroup): number {
    const completed = this.lessonProgress.completed();
    return group.lessons.filter((lesson) => completed.has(lesson.id)).length;
  }
}
