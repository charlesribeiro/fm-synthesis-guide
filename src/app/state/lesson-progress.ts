import { Injectable, Signal, signal } from '@angular/core';
import { LESSON_IDS, isLessonId, type LessonId } from '../domain/dx7/lessons/lesson-definition';

/**
 * In-memory per-lesson completion facade (D-07), mirroring
 * `InstrumentState`'s private-`WritableSignal` + `.asReadonly()` shape. Only
 * ever holds `LessonId`s — no note number, timestamp, or engine reference
 * (CLAUDE.md: never store `AudioNode`s in Angular signal state, and this
 * facade has no reason to hold anything audio-adjacent at all).
 *
 * Completion is a one-way ratchet within a session (06-01-PLAN.md
 * `<phase_decisions>`, RESEARCH.md Open Question 2): `markComplete` only
 * ever adds to the set, never removes. Resets on reload — no persistence
 * this phase (PERSIST-01 is Phase 12's job).
 */
@Injectable({ providedIn: 'root' })
export class LessonProgress {
  private readonly _completed = signal<ReadonlySet<LessonId>>(new Set());

  /** Read-only: the set of lesson ids completed so far this session. */
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
   * observable change; otherwise writes a brand-new `Set` built from the
   * previous one plus the id — an immutable update, and a one-way ratchet
   * that never removes.
   */
  markComplete(lessonId: LessonId): void {
    if (!isLessonId(lessonId)) {
      throw new RangeError(`lessonId must be one of ${LESSON_IDS.join(', ')}, received ${lessonId}`);
    }
    const previous = this._completed();
    if (previous.has(lessonId)) {
      return;
    }
    this._completed.set(new Set([...previous, lessonId]));
  }
}
