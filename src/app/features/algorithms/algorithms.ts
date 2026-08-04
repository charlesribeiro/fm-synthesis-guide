import { Component } from '@angular/core';

interface AlgorithmGroup {
  readonly name: string;
  readonly range: string;
  readonly description: string;
}

@Component({
  selector: 'app-algorithms',
  imports: [],
  templateUrl: './algorithms.html',
  styleUrl: './algorithms.scss',
})
export class Algorithms {
  /**
   * The four structural groups used to teach the 32 algorithms without
   * requiring rote memorization. The canonical, validated dataset and the
   * interactive per-algorithm SVG diagram are built in Phases 2 and 4.
   */
  protected readonly groups: readonly AlgorithmGroup[] = [
    {
      name: 'Additive stacks',
      range: 'Algorithms 1–6',
      description: 'Stacked towers of 2–4 operators with multiple independent carrier outputs.',
    },
    {
      name: 'Tree and branch',
      range: 'Algorithms 7–18',
      description: 'Heavy serial modulation funneling several modulators into one carrier.',
    },
    {
      name: 'Rooting',
      range: 'Algorithms 19–25',
      description: 'Multiple independent carriers, some with no modulator at all.',
    },
    {
      name: 'Parallel',
      range: 'Algorithms 26–32',
      description: 'Parallel, independent carriers — pure additive synthesis at the extreme.',
    },
  ];
}
