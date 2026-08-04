import { Component } from '@angular/core';

interface UpcomingLesson {
  readonly algorithm: number;
  readonly title: string;
  readonly teaches: string;
}

@Component({
  selector: 'app-learn',
  imports: [],
  templateUrl: './learn.html',
  styleUrl: './learn.scss',
})
export class Learn {
  /**
   * Static placeholder curriculum. Phase 6 replaces this with a real lesson
   * framework driven by the Phase 2 algorithm dataset and Phase 3 instrument
   * state (`docs/ROADMAP_SEED.md`).
   */
  protected readonly upcomingLessons: readonly UpcomingLesson[] = [
    {
      algorithm: 32,
      title: 'Pure additive synthesis',
      teaches: 'Six independent carriers, zero modulation — the simplest algorithm to start from.',
    },
    {
      algorithm: 1,
      title: 'A stack and a tower',
      teaches: 'Two carriers: one simple pair, one four-operator modulation chain with feedback.',
    },
  ];
}
