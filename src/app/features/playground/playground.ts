import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InstrumentState } from '../../state/instrument-state';
import { PlaygroundPatchSlot } from '../../state/playground-patch-slot';
import { PlaySurface } from '../play-surface/play-surface';
import { ToolsPanel } from './tools-panel/tools-panel';
import { Visualizer } from './visualizer/visualizer';

/**
 * `/playground` route component. A thin host embedding, in document order,
 * the shared `PlaySurface` (D-03: exactly one on-screen/computer-keyboard
 * note-lifecycle implementation in the repository — `06-01-PLAN.md`), the
 * always-visible `Visualizer` oscilloscope-and-spectrum region (D-04), and
 * the `ToolsPanel` comparison/randomization controls (`10-04-PLAN.md`) — play,
 * then see, then compare. Playground itself owns only the page framing
 * (heading, intro copy) and the roadmap list of capabilities still to come;
 * all engine access, note state, and keyboard/pointer handling live on
 * `PlaySurface`, all draw-loop/canvas ownership lives on `Visualizer`, and
 * all A/B/reset/randomize dispatch lives on `ToolsPanel`.
 */
@Component({
  selector: 'app-playground',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaySurface, Visualizer, ToolsPanel],
  templateUrl: './playground.html',
  styleUrl: './playground.scss',
})
export class Playground {
  private readonly instrumentState = inject(InstrumentState);
  private readonly playgroundPatchSlot = inject(PlaygroundPatchSlot);

  /**
   * D-21: `loadComponent` constructs a new Playground per navigation, so
   * constructor restore is enough (Assumption A5). Reads the dedicated slot
   * into live state; never writes it. Not a reactive effect, not a
   * route-signal subscription — a lesson `startingPatch` left in live state
   * must not remain on Playground.
   */
  constructor() {
    this.instrumentState.replacePatch(this.playgroundPatchSlot.read());
  }

  /** What Playground mode becomes once its remaining dependency phases land.
   * "Oscilloscope and spectrum display" was removed once plan 10-02 landed
   * the labelled spectrum lane alongside the oscilloscope. "A/B snapshot
   * compare and constrained randomization" was removed once this plan
   * (10-04) landed the tools panel — both are now real, live regions, not
   * future work. Only the algorithm selector and the operator strips remain
   * genuine future-phase work. */
  protected readonly comingSoon: readonly string[] = [
    'Full 32-algorithm selector with live routing diagram',
    'Six operator strips: ratio, level, detune, envelope',
  ];
}
