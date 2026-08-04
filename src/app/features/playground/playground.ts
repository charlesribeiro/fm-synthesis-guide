import { Component } from '@angular/core';

@Component({
  selector: 'app-playground',
  imports: [],
  templateUrl: './playground.html',
  styleUrl: './playground.scss',
})
export class Playground {
  /**
   * What Playground mode becomes once its dependency phases land, in build
   * order (`docs/ROADMAP_SEED.md` Phases 3–10).
   */
  protected readonly comingSoon: readonly string[] = [
    'Full 32-algorithm selector with live routing diagram',
    'Six operator strips: ratio, level, detune, envelope',
    'On-screen and computer keyboard, monophonic to start',
    'Oscilloscope and spectrum display',
    'A/B snapshot compare and constrained randomization',
  ];
}
