import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  buildDiagramViewModelForId,
  type AlgorithmDiagramViewModel,
} from '../../../domain/dx7/diagram/build-diagram-view-model';
import {
  TRY_THIS_PARAM_LABELS,
  isLessonId,
  type LessonDefinition,
  type LessonId,
} from '../../../domain/dx7/lessons/lesson-definition';
import { getLesson } from '../../../domain/dx7/lessons/lessons';
import { hasMovedTowardTarget, tryThisParamValues } from '../../../domain/dx7/lessons/try-this';
import type { OperatorRole } from '../../../domain/dx7/models/derive-role';
import { OPERATOR_IDS, type OperatorId } from '../../../domain/dx7/models/operator';
import type { OperatorParameters } from '../../../domain/dx7/models/operator-parameters';
import { AlgorithmDiagram } from '../../algorithms/algorithm-diagram/algorithm-diagram';
import { PlaySurface } from '../../play-surface/play-surface';
import { InstrumentState } from '../../../state/instrument-state';
import { LessonProgress } from '../../../state/lesson-progress';

function nearestLadderIndex(values: readonly number[], value: number): number {
  if (values.length === 0) {
    return 0;
  }
  const exact = values.indexOf(value);
  if (exact !== -1) {
    return exact;
  }
  let bestIndex = 0;
  let bestDistance = Math.abs(values[0]! - value);
  for (let index = 1; index < values.length; index++) {
    const distance = Math.abs(values[index]! - value);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  return bestIndex;
}

/**
 * `/learn/:lessonId` route component (D-08: one scrolling page — objective,
 * explanation + embedded diagram (D-05), try-this + embedded play surface
 * (D-03), then the completion state).
 *
 * Reads the param via injected `ActivatedRoute` + `toSignal(paramMap)`
 * rather than a `withComponentInputBinding()` signal input, exactly as
 * `AlgorithmDetail` does, so a cold deep link resolves correctly on first
 * render. `:lessonId` is a string slug, validated by set-membership
 * (`isLessonId` against the frozen `LESSON_IDS` array) rather than
 * `AlgorithmDetail`'s numeric-id regex (T-06-01, ASVS V5).
 */
@Component({
  selector: 'app-lesson-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlgorithmDiagram, PlaySurface, RouterLink],
  templateUrl: './lesson-detail.html',
  styleUrl: './lesson-detail.scss',
})
export class LessonDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly instrumentState = inject(InstrumentState);
  private readonly lessonProgress = inject(LessonProgress);

  protected readonly tryThisParamLabels = TRY_THIS_PARAM_LABELS;

  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  /** The raw, untrusted `:lessonId` route param string — never bound into
   * an attribute, a URL, or `innerHTML`; only ever interpolated as text in
   * the not-found branch so a mistyped address is echoed back safely,
   * mirroring `AlgorithmDetail`'s posture for `:id` (T-06-01). */
  protected readonly rawLessonId = computed<string | null>(() => this.paramMap().get('lessonId'));

  /** The raw segment run through `isLessonId` — a membership check against
   * the closed `LESSON_IDS` set, never a regex and never a lookup on an
   * unvalidated string. */
  protected readonly lessonId = computed<LessonId | null>(() => {
    const raw = this.rawLessonId();
    return raw !== null && isLessonId(raw) ? raw : null;
  });

  protected readonly lesson = computed<LessonDefinition | null>(() => {
    const id = this.lessonId();
    return id === null ? null : getLesson(id);
  });

  protected readonly diagram = computed<AlgorithmDiagramViewModel | null>(() => {
    const lesson = this.lesson();
    return lesson === null ? null : buildDiagramViewModelForId(lesson.algorithmId);
  });

  /** D-05: the derived teaching fact this lesson's copy is forbidden from
   * hardcoding — always read through `InstrumentState`/`derive-role.ts`, so
   * it can never drift from the canonical dataset the synth engine plays. */
  protected readonly carriers = computed<readonly OperatorId[]>(() => this.instrumentState.carriers());

  protected readonly targetRole = computed<OperatorRole | null>(() => {
    const lesson = this.lesson();
    return lesson === null ? null : this.instrumentState.operatorRole(lesson.tryThis.targetOperator);
  });

  /** The domain-owned ascending ladder of legal values for this lesson's
   * try-this parameter — the range control's positions index into this, so
   * every value it can write is already valid by construction (T-06-04). */
  protected readonly tryThisValues = computed<readonly number[]>(() => {
    const lesson = this.lesson();
    return lesson === null ? [] : tryThisParamValues(lesson.tryThis.targetParam);
  });

  /** The live value of the target parameter on the target operator, read
   * from `InstrumentState` — never a locally-held copy. */
  protected readonly tryThisValue = computed<number | null>(() => {
    const lesson = this.lesson();
    if (lesson === null) {
      return null;
    }
    const operatorParameters = this.instrumentState.operators()[lesson.tryThis.targetOperator];
    return operatorParameters[lesson.tryThis.targetParam];
  });

  /** Accessible range readout: parameter label plus the resolved value.
   * Empty when the lesson or live value is unavailable. */
  protected readonly tryThisValueText = computed(() => {
    const lesson = this.lesson();
    const value = this.tryThisValue();
    if (lesson === null || value === null) {
      return '';
    }
    return `${TRY_THIS_PARAM_LABELS[lesson.tryThis.targetParam]} ${value}`;
  });

  /** The live value's position in `tryThisValues` — what the range input's
   * `value` binds to. */
  protected readonly tryThisIndex = computed<number>(() => {
    const value = this.tryThisValue();
    if (value === null) {
      return 0;
    }
    const index = nearestLadderIndex(this.tryThisValues(), value);
    return index;
  });

  /** D-06's "moved in direction" half: a pure computed comparing the live
   * value against the lesson's own compile-time `startingPatch` — no
   * snapshot for the baseline (06-01-PLAN.md `<phase_decisions>`). */
  protected readonly paramMoved = computed<boolean>(() => {
    const lesson = this.lesson();
    if (lesson === null) {
      return false;
    }
    const baseline = lesson.startingPatch.operators[lesson.tryThis.targetOperator];
    const current = this.instrumentState.operators()[lesson.tryThis.targetOperator];
    return hasMovedTowardTarget(baseline, current, lesson.tryThis);
  });

  protected readonly isComplete = computed<boolean>(() => {
    const id = this.lessonId();
    return id === null ? false : this.lessonProgress.isComplete(id);
  });

  /** Tracks which lesson's starting patch was last pushed into
   * `InstrumentState`, so a same-id effect re-run (signal write flush)
   * does not re-apply the patch and wipe a learner's try-this edits. */
  private lastAppliedLessonId: LessonId | null = null;

  /**
   * D-04: applies the lesson's starting patch whenever the validated route
   * `lessonId` resolves to a known lesson — including same-component
   * navigations between lesson slugs — through the three existing validated
   * `InstrumentState` commands. No-ops on not-found ids; no new bulk setter
   * and no raw signal write (T-06-03). The `effect` is imperative sync with
   * `InstrumentState` (an external system), not derived UI state.
   */
  constructor() {
    effect(() => {
      const lesson = this.lesson();
      if (lesson === null) {
        return;
      }
      if (this.lastAppliedLessonId === lesson.id) {
        return;
      }
      this.lastAppliedLessonId = lesson.id;
      this.applyStartingPatch(lesson);
    });
  }

  private applyStartingPatch(lesson: LessonDefinition): void {
    this.instrumentState.setAlgorithm(lesson.algorithmId);
    for (const operatorId of OPERATOR_IDS) {
      this.instrumentState.updateOperator(operatorId, lesson.startingPatch.operators[operatorId]);
    }
    this.instrumentState.setFeedback(lesson.startingPatch.feedback);
  }

  /** Reads the range input's index, resolves it against `tryThisValues`,
   * and writes the resolved value through `InstrumentState.updateOperator`
   * — the only write path; `updateOperator`'s validation stays in place as
   * the guard, never bypassed (T-06-04). */
  protected onTryThisInput(event: Event): void {
    const lesson = this.lesson();
    if (lesson === null) {
      return;
    }
    const index = Number((event.target as HTMLInputElement).value);
    const value = this.tryThisValues()[index];
    if (value === undefined) {
      return;
    }
    const changes = { [lesson.tryThis.targetParam]: value } as Partial<OperatorParameters>;
    this.instrumentState.updateOperator(lesson.tryThis.targetOperator, changes);
  }

  /** Bound to the embedded `PlaySurface`'s `(notePlayed)` output — the "and
   * then a note was triggered" half of D-06, read imperatively at the
   * instant the event fires; no `effect()` involved. */
  protected onNotePlayed(): void {
    const id = this.lessonId();
    if (id === null) {
      return;
    }
    if (this.paramMoved()) {
      this.lessonProgress.markComplete(id);
    }
  }
}
