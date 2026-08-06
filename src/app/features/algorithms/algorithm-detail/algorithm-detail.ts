import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { AlgorithmId } from '../../../domain/dx7/models/algorithm';
import { MAX_ALGORITHM_ID, MIN_ALGORITHM_ID, isAlgorithmId } from '../../../domain/dx7/models/algorithm';
import {
  buildDiagramViewModelForId,
  type AlgorithmDiagramViewModel,
} from '../../../domain/dx7/diagram/build-diagram-view-model';
import { AlgorithmDiagram } from '../algorithm-diagram/algorithm-diagram';

/**
 * A route `:id` segment must be composed entirely of ASCII digits before it
 * is even offered to `Number()` — rejects exponent notation (`1e1`), hex
 * (`0x10`), decimals, signs and surrounding junk at the string level, so a
 * value that *numerically* lands in range (e.g. `Number('1e1') === 10`)
 * still can't slip past the guard on its textual shape alone (T-4-01).
 */
const STRICT_INTEGER_ID_PATTERN = /^\d+$/;

/**
 * `/algorithms/:id` route component (D-02). Resolves the untrusted `:id`
 * route param through `isAlgorithmId` before any dataset lookup (T-4-01,
 * ASVS V5) and renders either the resolved diagram or an explicit
 * not-found state — never a thrown error or a blank page.
 *
 * Reads the param via injected `ActivatedRoute` + `toSignal(paramMap)`
 * rather than a `withComponentInputBinding()` signal input (RESEARCH.md
 * Pitfall 1's deep-link gap), with `route.snapshot.paramMap` as the
 * `initialValue` so a cold deep link resolves correctly on first render and
 * a same-route navigation (Plan 04's prev/next links) still updates it.
 */
@Component({
  selector: 'app-algorithm-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlgorithmDiagram, RouterLink],
  templateUrl: './algorithm-detail.html',
  styleUrl: './algorithm-detail.scss',
})
export class AlgorithmDetail {
  private readonly route = inject(ActivatedRoute);

  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  /** The raw, untrusted `:id` route param string — never bound into an
   * attribute, a URL, or `innerHTML`; only ever interpolated as text in the
   * not-found branch so a mistyped address is echoed back safely (T-4-04).
   */
  protected readonly rawId = computed<string | null>(() => this.paramMap().get('id'));

  protected readonly algorithmId = computed<AlgorithmId | null>(() => {
    const raw = this.rawId();
    if (raw === null || !STRICT_INTEGER_ID_PATTERN.test(raw)) {
      return null;
    }
    const parsed = Number(raw);
    return isAlgorithmId(parsed) ? parsed : null;
  });

  protected readonly viewModel = computed<AlgorithmDiagramViewModel | null>(() => {
    const id = this.algorithmId();
    return id === null ? null : buildDiagramViewModelForId(id);
  });

  protected readonly isUnresolved = computed(() => this.viewModel()?.reviewStatus === 'unresolved');

  /**
   * D-04 pager bounds: `null` at either end rather than wrapping, so the
   * sequence of 32 never presents as a cycle. Bounds are read from the
   * domain constants that also back {@link isAlgorithmId}, so the pager can
   * never disagree with the validator that guards the same range.
   */
  protected readonly previousId = computed<AlgorithmId | null>(() => {
    const id = this.algorithmId();
    return id !== null && id > MIN_ALGORITHM_ID ? id - 1 : null;
  });

  protected readonly nextId = computed<AlgorithmId | null>(() => {
    const id = this.algorithmId();
    return id !== null && id < MAX_ALGORITHM_ID ? id + 1 : null;
  });
}
