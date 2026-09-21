import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SYNTH_ENGINE } from '../../core/audio/synth-engine.token';
import { MidiSession, type MidiPortView } from '../../core/midi/midi-session';
import { downloadJson } from '../../core/persistence/download-json';
import { parseSavedDocument } from '../../domain/dx7/persistence/parse-saved-document';
import {
  EXPORT_FILENAME,
  MAX_IMPORT_BYTES,
} from '../../domain/dx7/persistence/saved-document';
import { DEFAULT_PATCH } from '../../domain/dx7/models/patch';
import { InstrumentState } from '../../state/instrument-state';
import { SavedDocumentStore } from '../../state/saved-document-store';

export const IMPORT_CONFIRM_MESSAGE =
  'Replace all saved data (lesson progress, Playground patch, last MIDI device) with this file? This cannot be undone from inside the app.';

export const CLEAR_CONFIRM_MESSAGE =
  'Clear all saved data? Lesson progress, the Playground patch, and the last MIDI device will be reset. This cannot be undone from inside the app.';

const OVERSIZE_IMPORT_ERROR =
  'This file is too large to import. Choose a backup smaller than 256 KB.';
const MALFORMED_IMPORT_ERROR =
  'This file is a malformed backup and was not imported. Your current saved data was not changed.';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly engine = inject(SYNTH_ENGINE);
  private readonly router = inject(Router);
  private readonly instrumentState = inject(InstrumentState);
  protected readonly midiSession = inject(MidiSession);
  protected readonly store = inject(SavedDocumentStore);

  private readonly _importError = signal<string | null>(null);
  protected readonly importError = this._importError.asReadonly();

  protected readonly midiToggleLabel = computed(() =>
    this.midiSession.status() === 'ready' ? 'Disable MIDI' : 'Enable MIDI',
  );

  protected readonly midiExplanation = computed(() => {
    switch (this.midiSession.status()) {
      case 'unsupported':
        return 'This browser does not support the Web MIDI API, so MIDI keyboards cannot be used here. The rest of the app still works.';
      case 'permission-denied':
        return 'MIDI permission was denied. You can still play with the on-screen keyboard. To try again, allow MIDI in the browser and choose Enable MIDI.';
      case 'no-devices':
        return 'MIDI access is granted, but no MIDI input devices are connected. Connect a keyboard and this list will update.';
      case 'disconnected': {
        const name = this.midiSession.selectedPortName();
        return name === null
          ? 'The selected MIDI device is disconnected. It stays selected here until it returns or you pick another device.'
          : `${name} is disconnected. It stays selected here until it returns or you pick another device.`;
      }
      case 'ready': {
        const name = this.midiSession.selectedPortName();
        return name === null
          ? 'MIDI is ready. Notes from the selected device will play through this app on any page with a keyboard.'
          : `MIDI is ready. Notes from ${name} will play through this app on any page with a keyboard.`;
      }
      default:
        return 'MIDI is turned off. Choose Enable MIDI to request access to your MIDI devices. This app will not connect on its own after a reload.';
    }
  });

  protected readonly midiStatusWarning = computed(() => {
    const status = this.midiSession.status();
    return status === 'unsupported' || status === 'permission-denied' || status === 'disconnected';
  });

  protected readonly deviceSelectDisabled = computed(() => {
    const status = this.midiSession.status();
    return status === 'off' || status === 'unsupported' || status === 'permission-denied';
  });

  async toggleMidi(): Promise<void> {
    if (this.midiSession.status() === 'ready') {
      this.midiSession.disable();
      return;
    }
    const audioStatus = this.engine.status();
    if (audioStatus !== 'ready' && audioStatus !== 'unavailable') {
      try {
        await this.engine.initialize();
      } catch {
        // Failure reporting stays on the engine's `status` signal — Enable MIDI
        // must still reach midiSession.enable() and must not surface an
        // unhandled promise rejection.
      }
    }
    await this.midiSession.enable();
  }

  protected onDeviceChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    this.midiSession.selectPort(target.value);
  }

  protected deviceOptionLabel(port: MidiPortView): string {
    return port.connected ? port.name : `${port.name} (disconnected)`;
  }

  protected exportBackup(): void {
    downloadJson(EXPORT_FILENAME, JSON.stringify(this.store.document()));
  }

  protected async onImportSelected(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.files === null || input.files.length === 0) {
      return;
    }
    const file = input.files[0]!;
    input.value = '';
    await this.importBackup(file);
  }

  protected clearSavedData(): void {
    if (!window.confirm(CLEAR_CONFIRM_MESSAGE)) {
      return;
    }
    this.store.clearDocument();
    this.midiSession.disable();
    this._importError.set(null);
    if (this.isPlaygroundRoute()) {
      this.instrumentState.replacePatch(DEFAULT_PATCH);
    }
  }

  private async importBackup(file: File): Promise<void> {
    if (!window.confirm(IMPORT_CONFIRM_MESSAGE)) {
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      this._importError.set(OVERSIZE_IMPORT_ERROR);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      this._importError.set(MALFORMED_IMPORT_ERROR);
      return;
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      this._importError.set(MALFORMED_IMPORT_ERROR);
      return;
    }
    const document = parseSavedDocument(parsedJson);
    if (document === null) {
      this._importError.set(MALFORMED_IMPORT_ERROR);
      return;
    }
    this._importError.set(null);
    if (!this.store.replaceDocument(document)) {
      return;
    }
    if (this.isPlaygroundRoute()) {
      this.instrumentState.replacePatch(document.playgroundPatch);
    }
  }

  private isPlaygroundRoute(): boolean {
    const path = this.router.url.split('?')[0];
    return path === '/playground' || path === '/playground/';
  }
}
