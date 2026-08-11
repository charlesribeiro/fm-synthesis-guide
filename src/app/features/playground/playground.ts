import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaySurface } from '../play-surface/play-surface';

/**
 * `/playground` route component. A thin host embedding the shared
 * `PlaySurface` (D-03: exactly one on-screen/computer-keyboard note-lifecycle
 * implementation in the repository — `06-01-PLAN.md`). Playground itself
 * owns only the page framing (heading, intro copy) and the roadmap list of
 * capabilities still to come; all engine access, note state, and keyboard/
 * pointer handling live on `PlaySurface`.
 */
@Component({
  selector: 'app-playground',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaySurface],
  templateUrl: './playground.html',
  styleUrl: './playground.scss',
})
export class Playground {
  /** What Playground mode becomes once its remaining dependency phases land. */
  protected readonly comingSoon: readonly string[] = [
    'Full 32-algorithm selector with live routing diagram',
    'Six operator strips: ratio, level, detune, envelope',
    'Oscilloscope and spectrum display',
    'A/B snapshot compare and constrained randomization',
  ];
}
