import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';

import type {
  AlgorithmDiagramViewModel,
  DiagramEdge,
} from '../../../domain/dx7/diagram/build-diagram-view-model';
import type { OperatorId } from '../../../domain/dx7/models/operator';

/** Monotonic suffix so two diagram instances never share SVG `id`s. */
let nextDiagramInstanceId = 0;

/**
 * Presentational SVG routing diagram. Its only data input is a fully
 * resolved `AlgorithmDiagramViewModel` — it never injects the shared
 * instrument-state facade, the router, or any audio type, and never
 * re-derives operator role, carrier, or feedback facts itself (those are
 * already resolved in the view model, per `docs/ARCHITECTURE.md`'s
 * rendering-strategy boundary).
 *
 * D-10: node selection is local-only UI state, deliberately kept out of the
 * view model so a selection change never rebuilds the node/edge arrays
 * (RESEARCH.md Pitfall 4) — mirrors `MotionPreference`'s private-writable /
 * public-readonly signal shape. `linkedSignal` keyed by
 * `viewModel().algorithmId` resets selection whenever the algorithm changes
 * (same-route prev/next reuse).
 */
@Component({
  selector: 'app-algorithm-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './algorithm-diagram.html',
  styleUrl: './algorithm-diagram.scss',
})
export class AlgorithmDiagram {
  readonly viewModel = input.required<AlgorithmDiagramViewModel>();

  private readonly instanceId = ++nextDiagramInstanceId;

  private readonly _selectedOperator = linkedSignal({
    source: () => this.viewModel().algorithmId,
    computation: (): OperatorId | null => null,
  });
  protected readonly selectedOperator = this._selectedOperator.asReadonly();

  protected readonly titleId = computed(
    () => `algorithm-${this.viewModel().algorithmId}-diagram-title-${this.instanceId}`,
  );
  protected readonly descId = computed(
    () => `algorithm-${this.viewModel().algorithmId}-diagram-desc-${this.instanceId}`,
  );
  protected readonly arrowMarkerId = computed(
    () => `algorithm-${this.viewModel().algorithmId}-diagram-arrow-${this.instanceId}`,
  );

  protected readonly selectionAnnouncement = computed(() => {
    const selectedId = this._selectedOperator();
    if (selectedId === null) {
      return '';
    }
    const node = this.viewModel().nodes.find((candidate) => candidate.id === selectedId);
    return node ? node.label : '';
  });

  protected selectNode(id: OperatorId): void {
    this._selectedOperator.set(this._selectedOperator() === id ? null : id);
  }

  protected isEdgeConnected(edge: DiagramEdge): boolean {
    const selectedId = this._selectedOperator();
    return selectedId !== null && (edge.from === selectedId || edge.to === selectedId);
  }

  protected onNodeKeydown(event: KeyboardEvent, id: OperatorId): void {
    if (event.key === 'Enter') {
      this.selectNode(id);
    } else if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.selectNode(id);
    }
  }
}
