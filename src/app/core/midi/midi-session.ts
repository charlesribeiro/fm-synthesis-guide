import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { SYNTH_ENGINE } from '../audio/synth-engine.token';
import {
  REQUEST_MIDI_ACCESS,
  type MidiAccessLike,
  type MidiInputLike,
  type MidiMessageEventLike,
} from '../browser/midi-access.token';
import {
  parseMidiNoteMessage,
  type ParsedMidiNote,
} from '../../domain/dx7/midi/parse-midi-note-message';
import { SavedDocumentStore } from '../../state/saved-document-store';

export type MidiSessionStatus =
  | 'off'
  | 'unsupported'
  | 'permission-denied'
  | 'no-devices'
  | 'disconnected'
  | 'ready';

export interface MidiPortView {
  readonly id: string;
  readonly name: string;
  readonly connected: boolean;
}

@Injectable({ providedIn: 'root' })
export class MidiSession {
  private readonly requestMidiAccess = inject(REQUEST_MIDI_ACCESS);
  private readonly engine = inject(SYNTH_ENGINE);
  private readonly store = inject(SavedDocumentStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _status = signal<MidiSessionStatus>(
    this.requestMidiAccess === null ? 'unsupported' : 'off',
  );
  readonly status: Signal<MidiSessionStatus> = this._status.asReadonly();

  private readonly _ports = signal<readonly MidiPortView[]>([]);
  readonly ports: Signal<readonly MidiPortView[]> = this._ports.asReadonly();

  private readonly _selectedPortId = signal<string | null>(null);
  readonly selectedPortId: Signal<string | null> = this._selectedPortId.asReadonly();

  readonly selectedPortName: Signal<string | null> = computed(() => {
    const id = this._selectedPortId();
    if (id === null) {
      return null;
    }
    return this._ports().find((port) => port.id === id)?.name ?? null;
  });

  private access: MidiAccessLike | null = null;
  private selectedInput: MidiInputLike | null = null;
  private selectedPortNameCache: string | null = null;
  private readonly noteListeners = new Set<(parsed: ParsedMidiNote) => void>();

  constructor() {
    this.destroyRef.onDestroy(() => this.dropHandlers());
  }

  async enable(): Promise<void> {
    if (this.requestMidiAccess === null) {
      this._status.set('unsupported');
      return;
    }
    try {
      if (this.access === null) {
        this.access = await this.requestMidiAccess({ sysex: false });
      }
      this.attachAccess(this.access);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      this._status.set(name === 'NotAllowedError' ? 'permission-denied' : 'unsupported');
    }
  }

  disable(): void {
    this.dropHandlers();
    this.engine.allNotesOff();
    this._status.set('off');
  }

  selectPort(id: string): void {
    if (this.access === null) {
      return;
    }
    this.applySelection(id);
    this.store.setLastMidiDeviceId(id);
  }

  subscribeNotes(listener: (parsed: ParsedMidiNote) => void): () => void {
    this.noteListeners.add(listener);
    return () => {
      this.noteListeners.delete(listener);
    };
  }

  private attachAccess(access: MidiAccessLike): void {
    access.onstatechange = (event) => this.refreshPorts(event?.port);
    const inputs = [...access.inputs.values()];
    this.syncPorts(inputs);
    const priorSelectedId = this._selectedPortId();
    if (priorSelectedId !== null) {
      this.applySelection(priorSelectedId);
      return;
    }
    const saved = this.store.document().lastMidiDeviceId;
    if (typeof saved === 'string' && inputs.some((input) => input.id === saved)) {
      this.selectPort(saved);
      return;
    }
    const firstConnected = inputs.find((input) => input.state === 'connected');
    if (firstConnected !== undefined) {
      this.selectPort(firstConnected.id);
      return;
    }
    this.detachSelectedInput();
    this._selectedPortId.set(null);
    this._status.set('no-devices');
  }

  private refreshPorts(changedPort?: MidiInputLike): void {
    if (this.access === null || this._status() === 'off') {
      return;
    }
    const inputs = [...this.access.inputs.values()];
    this.syncPorts(inputs, changedPort);
    const selectedId = this._selectedPortId();
    if (selectedId === null) {
      const firstConnected = inputs.find((input) => input.state === 'connected');
      if (firstConnected === undefined) {
        this.detachSelectedInput();
        this._status.set('no-devices');
        return;
      }
      this.selectPort(firstConnected.id);
      return;
    }
    const selected = inputs.find((input) => input.id === selectedId);
    if (selected === undefined || selected.state !== 'connected') {
      this.detachSelectedInput();
      this.engine.allNotesOff();
      this._status.set('disconnected');
      return;
    }
    this.attachSelectedInput(selected);
    this._status.set('ready');
  }

  private applySelection(id: string): void {
    if (this.access === null) {
      return;
    }
    const inputs = [...this.access.inputs.values()];
    this._selectedPortId.set(id);
    this.syncPorts(inputs);
    const input = inputs.find((candidate) => candidate.id === id);
    if (input === undefined || input.state !== 'connected') {
      this.detachSelectedInput();
      this._status.set(inputs.length === 0 ? 'no-devices' : 'disconnected');
      return;
    }
    this.attachSelectedInput(input);
    this._status.set('ready');
  }

  private syncPorts(
    inputs: readonly MidiInputLike[],
    changedPort?: MidiInputLike,
  ): void {
    const views: MidiPortView[] = inputs.map((input) => ({
      id: input.id,
      name: input.name,
      connected: input.state === 'connected',
    }));
    const selectedId = this._selectedPortId();
    if (selectedId !== null && !views.some((port) => port.id === selectedId)) {
      const eventName =
        changedPort !== undefined && changedPort.id === selectedId
          ? changedPort.name
          : undefined;
      views.push({
        id: selectedId,
        name: this.selectedPortNameCache ?? eventName ?? selectedId,
        connected: false,
      });
    }
    this._ports.set(views);
  }

  private attachSelectedInput(input: MidiInputLike): void {
    this.selectedPortNameCache = input.name;
    if (this.selectedInput !== null && this.selectedInput !== input) {
      this.selectedInput.onmidimessage = null;
    }
    this.selectedInput = input;
    input.onmidimessage = this.onMidiMessage;
  }

  private detachSelectedInput(): void {
    if (this.selectedInput !== null) {
      this.selectedInput.onmidimessage = null;
      this.selectedInput = null;
    }
  }

  private dropHandlers(): void {
    this.detachSelectedInput();
    if (this.access !== null) {
      this.access.onstatechange = null;
    }
  }

  private readonly onMidiMessage = (event: MidiMessageEventLike): void => {
    const parsed = parseMidiNoteMessage(event.data);
    if (parsed === null) {
      return;
    }
    for (const listener of this.noteListeners) {
      listener(parsed);
    }
  };
}
