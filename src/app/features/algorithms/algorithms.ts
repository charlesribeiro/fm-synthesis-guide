import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { AlgorithmId } from '../../domain/dx7/models/algorithm';
import { ALGORITHMS } from '../../domain/dx7/models/algorithms';
import { isUnresolvedAlgorithm, TEACHING_TAGS, type TeachingTag } from '../../domain/dx7/models/algorithm-definition';

interface BrowseAlgorithm {
  readonly id: AlgorithmId;
  readonly name: string;
  readonly isUnresolved: boolean;
}

interface AlgorithmGroup {
  readonly tag: TeachingTag;
  readonly name: string;
  readonly range: string;
  readonly description: string;
  readonly algorithms: readonly BrowseAlgorithm[];
}

/**
 * Presentation copy for the four teaching-taxonomy groups (D-01). Only the
 * human-facing label and description live here — which algorithms belong to
 * each group is never hardcoded; it is read from each row's `teachingTags`
 * in `buildGroups` below, so a dataset change can never leave this component
 * disagreeing with `ALGORITHMS`.
 */
const GROUP_COPY: Readonly<Record<TeachingTag, { readonly name: string; readonly description: string }>> =
  Object.freeze({
    'additive-stacks': {
      name: 'Additive stacks',
      description: 'Stacked towers of 2–4 operators with multiple independent carrier outputs.',
    },
    'tree-branch': {
      name: 'Tree and branch',
      description: 'Heavy serial modulation funneling several modulators into one carrier.',
    },
    rooting: {
      name: 'Rooting',
      description: 'Multiple independent carriers, some with no modulator at all.',
    },
    parallel: {
      name: 'Parallel',
      description: 'Parallel, independent carriers — pure additive synthesis at the extreme.',
    },
  });

function buildGroups(): readonly AlgorithmGroup[] {
  return Object.freeze(
    TEACHING_TAGS.map((tag) => {
      const rows = ALGORITHMS.filter((algorithm) => algorithm.teachingTags.includes(tag)).sort(
        (a, b) => a.id - b.id,
      );

      const algorithms: readonly BrowseAlgorithm[] = Object.freeze(
        rows.map((row) =>
          Object.freeze({
            id: row.id,
            name: row.name,
            isUnresolved: isUnresolvedAlgorithm(row),
          }),
        ),
      );

      const firstId = rows[0]?.id;
      const lastId = rows[rows.length - 1]?.id;
      const copy = GROUP_COPY[tag];

      return Object.freeze({
        tag,
        name: copy.name,
        range: `Algorithms ${firstId}–${lastId}`,
        description: copy.description,
        algorithms,
      });
    }),
  );
}

@Component({
  selector: 'app-algorithms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './algorithms.html',
  styleUrl: './algorithms.scss',
})
export class Algorithms {
  /**
   * The four structural groups used to teach the 32 algorithms without
   * requiring rote memorization. Built once at module load by filtering the
   * canonical `ALGORITHMS` dataset on `teachingTags` — no algorithm id or
   * id range is written anywhere in this file.
   */
  protected readonly groups: readonly AlgorithmGroup[] = buildGroups();
}
