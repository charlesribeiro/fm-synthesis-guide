import { Injectable, Injector, Signal, inject, signal } from '@angular/core';
import { LESSON_IDS, isLessonId, type LessonId } from '../domain/dx7/lessons/lesson-definition';
import { SavedDocumentStore } from './saved-document-store';

/**
 * Per-lesson completion facade (D-07 / D-18). Private writable signal plus
 * a read-only selector. `markComplete` is a one-way ratchet; `replaceCompleted`
 * is the hydrate / import / clear path. Persistence goes through
 * `SavedDocumentStore` after a successful non-idempotent mark.
 */
@Injectable({ providedIn: 'root' })
export class LessonProgress {
  private readonly injector = inject(Injector);
  private readonly _completed = signal<ReadonlySet<LessonId>>(new Set());

  /** Read-only: the set of lesson ids completed so far. */
  readonly completed: Signal<ReadonlySet<LessonId>> = this._completed.asReadonly();

  /** Whether `lessonId` has been completed. Rejects a `lessonId` outside
   * `LESSON_IDS` with a `RangeError` naming the legal ids, mirroring
   * `InstrumentState.hasSnapshot`'s validate-then-read posture. */
  isComplete(lessonId: LessonId): boolean {
    if (!isLessonId(lessonId)) {
      throw new RangeError(`lessonId must be one of ${LESSON_IDS.join(', ')}, received ${lessonId}`);
    }
    return this._completed().has(lessonId);
  }

  /**
   * Marks `lessonId` complete. Validates first — before touching
   * `_completed` at all — matching `InstrumentState`'s validate-before-write
   * commands. Returns early (keeping the existing `Set` reference) when the
   * id is already complete, so a repeat call is idempotent and produces no
   * observable change; otherwise writes a brand-new `Set` and persists.
   */
  markComplete(lessonId: LessonId): void {
    if (!isLessonId(lessonId)) {
      throw new RangeError(`lessonId must be one of ${LESSON_IDS.join(', ')}, received ${lessonId}`);
    }
    const previous = this._completed();
    if (previous.has(lessonId)) {
      return;
    }
    const next = new Set([...previous, lessonId]);
    this._completed.set(next);
    this.injector.get(SavedDocumentStore).persistLessonProgress(next);
  }

  /**
   * Replaces the completed set (hydrate, import, clear). Every id must pass
   * `isLessonId`; this is not a ratchet and does not persist on its own.
   */
  replaceCompleted(ids: ReadonlySet<LessonId>): void {
    for (const id of ids) {
      if (!isLessonId(id)) {
        throw new RangeError(`lessonId must be one of ${LESSON_IDS.join(', ')}, received ${id}`);
      }
    }
    this._completed.set(new Set(ids));
  }
}
