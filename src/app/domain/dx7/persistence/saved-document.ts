import type { LessonId } from '../lessons/lesson-definition';
import { DEFAULT_PATCH, type InstrumentPatch } from '../models/patch';

/** Locked schema version for this phase (D-27). Missing or unknown versions are malformed. */
export const PERSISTENCE_SCHEMA_VERSION = 1 as const;

/** Origin storage key for the single versioned document. Never `localStorage.clear()`. */
export const PERSISTENCE_STORAGE_KEY = 'dx7-algorithm-lab.saved-document';

/** Download filename for Settings export (plan 12-04). */
export const EXPORT_FILENAME = 'dx7-algorithm-lab-backup.json';

/** Import file size cap shared with plan 12-04 (Assumption A1). */
export const MAX_IMPORT_BYTES = 262144;

/**
 * Schema-version-1 durable document (D-24): Playground patch slot, lesson
 * completion, and last MIDI device id. Does not include snapshot slots or
 * audio types.
 */
export interface SavedDocument {
  readonly schemaVersion: 1;
  readonly playgroundPatch: InstrumentPatch;
  readonly completedLessonIds: readonly LessonId[];
  readonly lastMidiDeviceId: string | null;
}

export function defaultSavedDocument(): SavedDocument {
  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    playgroundPatch: DEFAULT_PATCH,
    completedLessonIds: [],
    lastMidiDeviceId: null,
  };
}
