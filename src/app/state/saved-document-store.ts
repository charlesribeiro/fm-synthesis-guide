import { Injectable, Signal, inject, signal } from '@angular/core';
import { STORAGE } from '../core/persistence/storage.token';
import { parseSavedDocument } from '../domain/dx7/persistence/parse-saved-document';
import {
  PERSISTENCE_STORAGE_KEY,
  defaultSavedDocument,
  type SavedDocument,
} from '../domain/dx7/persistence/saved-document';
import type { LessonId } from '../domain/dx7/lessons/lesson-definition';
import type { InstrumentPatch } from '../domain/dx7/models/patch';
import { LessonProgress } from './lesson-progress';

const RECOVERY_MESSAGE = 'Saved data was unreadable and has been reset to defaults.';
const WRITE_ERROR_MESSAGE = 'Could not save — storage is full or unavailable.';

/**
 * Root facade over the schema-version-1 document. Constructor reads storage
 * into a private signal and never throws; `hydrateLive` copies completion
 * into `LessonProgress` after both facades exist (D-18, D-26).
 */
@Injectable({ providedIn: 'root' })
export class SavedDocumentStore {
  private readonly storage = inject(STORAGE);
  private readonly lessonProgress = inject(LessonProgress);

  private readonly _document = signal<SavedDocument>(defaultSavedDocument());
  readonly document: Signal<SavedDocument> = this._document.asReadonly();

  private readonly _recoveryMessage = signal<string | null>(null);
  readonly recoveryMessage: Signal<string | null> = this._recoveryMessage.asReadonly();

  private readonly _writeError = signal<string | null>(null);
  readonly writeError: Signal<string | null> = this._writeError.asReadonly();

  constructor() {
    this.loadFromStorage();
  }

  hydrateLive(): void {
    this.lessonProgress.replaceCompleted(new Set(this._document().completedLessonIds));
  }

  persistLessonProgress(ids: ReadonlySet<LessonId>): void {
    this.commit({
      ...this._document(),
      completedLessonIds: [...ids],
    });
  }

  writePlaygroundPatch(patch: InstrumentPatch): void {
    this.commit({
      ...this._document(),
      playgroundPatch: patch,
    });
  }

  setLastMidiDeviceId(id: string | null): void {
    this.commit({
      ...this._document(),
      lastMidiDeviceId: id,
    });
  }

  replaceDocument(doc: SavedDocument): boolean {
    if (!this.writeToStorage(doc)) {
      return false;
    }
    this._document.set(doc);
    this._recoveryMessage.set(null);
    this.hydrateLive();
    return true;
  }

  clearDocument(): void {
    let removed: boolean;
    try {
      this.storage.removeItem(PERSISTENCE_STORAGE_KEY);
      removed = this.storage.getItem(PERSISTENCE_STORAGE_KEY) === null;
    } catch {
      removed = false;
    }
    this._document.set(defaultSavedDocument());
    this._recoveryMessage.set(null);
    if (!removed) {
      this._writeError.set(WRITE_ERROR_MESSAGE);
    } else {
      this._writeError.set(null);
    }
    this.hydrateLive();
  }

  private loadFromStorage(): void {
    let raw: string | null;
    try {
      raw = this.storage.getItem(PERSISTENCE_STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (raw === null) {
      this._document.set(defaultSavedDocument());
      this._recoveryMessage.set(null);
      return;
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      this.recoverToDefaults();
      return;
    }
    const document = parseSavedDocument(parsedJson);
    if (document === null) {
      this.recoverToDefaults();
      return;
    }
    this._document.set(document);
    this._recoveryMessage.set(null);
  }

  private recoverToDefaults(): void {
    const defaults = defaultSavedDocument();
    this._document.set(defaults);
    this._recoveryMessage.set(RECOVERY_MESSAGE);
    try {
      this.storage.removeItem(PERSISTENCE_STORAGE_KEY);
    } catch {
      // Origin may refuse removeItem; still attempt the defaults write below.
    }
    this.writeToStorage(defaults);
  }

  private commit(next: SavedDocument): void {
    this._document.set(next);
    this.writeToStorage(next);
  }

  private writeToStorage(doc: SavedDocument): boolean {
    const serialized = JSON.stringify(doc);
    try {
      this.storage.setItem(PERSISTENCE_STORAGE_KEY, serialized);
      if (this.storage.getItem(PERSISTENCE_STORAGE_KEY) !== serialized) {
        throw new Error('Storage write did not persist.');
      }
      this._writeError.set(null);
      return true;
    } catch {
      this._writeError.set(WRITE_ERROR_MESSAGE);
      return false;
    }
  }
}
