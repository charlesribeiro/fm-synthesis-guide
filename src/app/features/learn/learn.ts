import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LESSONS } from '../../domain/dx7/lessons/lessons';
import { LessonProgress } from '../../state/lesson-progress';

/**
 * `/learn` index (D-09): one card per `LESSONS` row, in curriculum order,
 * each linking to its own `/learn/:lessonId` address and reading its
 * completion state live from `LessonProgress` — no second, hardcoded lesson
 * list (D-01). Mirrors `Algorithms`' data-driven browse-index shape.
 */
@Component({
  selector: 'app-learn',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './learn.html',
  styleUrl: './learn.scss',
})
export class Learn {
  /** The canonical lesson dataset (D-01) — the only source of lesson cards.
   * Adding a Phase 11 row here adds a card with no change to this file. */
  protected readonly lessons = LESSONS;

  /** Read through the facade per card so a completion marked elsewhere in
   * the app updates this index live, with no local mirror of the state. */
  protected readonly lessonProgress = inject(LessonProgress);
}
