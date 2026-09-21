import { TestBed } from '@angular/core/testing';
import { REQUEST_MIDI_ACCESS } from '../browser/midi-access.token';
import { SYNTH_ENGINE } from '../audio/synth-engine.token';
import type { SynthEngine } from '../audio/synth-engine';
import { STORAGE } from '../persistence/storage.token';
import { FakeStorage } from '../persistence/testing/fake-storage';
import {
  PERSISTENCE_STORAGE_KEY,
  defaultSavedDocument,
} from '../../domain/dx7/persistence/saved-document';
import { SavedDocumentStore } from '../../state/saved-document-store';
import { createFakeRequestMidiAccess, FakeMidiAccess, FakeMidiInput } from './testing/fake-midi-access';
import { MidiSession } from './midi-session';

function createFakeEngine(): SynthEngine {
  return {
    status: () => 'ready',
    initialize: async () => undefined,
    setAlgorithm: () => undefined,
    updateOperatorLevel: () => undefined,
    setFeedback: () => undefined,
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    allNotesOff: vi.fn(),
    destroy: () => undefined,
  };
}

function sessionProviders(
  request: ReturnType<typeof createFakeRequestMidiAccess> | null,
  extra: { storage?: FakeStorage; engine?: SynthEngine } = {},
): { provide: unknown; useValue: unknown }[] {
  return [
    { provide: REQUEST_MIDI_ACCESS, useValue: request },
    { provide: SYNTH_ENGINE, useValue: extra.engine ?? createFakeEngine() },
    { provide: STORAGE, useValue: extra.storage ?? new FakeStorage() },
  ];
}

describe('REQUEST_MIDI_ACCESS factory', () => {
  it('is null in jsdom and does not throw', () => {
    TestBed.configureTestingModule({});
    expect(TestBed.inject(REQUEST_MIDI_ACCESS)).toBeNull();
  });
});

describe('MidiSession construction and enable', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('does not invoke the request function on construction (D-08)', () => {
    const input = new FakeMidiInput('port-a', 'Test Keys');
    const access = new FakeMidiAccess([input]);
    const request = createFakeRequestMidiAccess({ access });
    TestBed.configureTestingModule({
      providers: sessionProviders(request),
    });

    const session = TestBed.inject(MidiSession);

    expect(request.callCount).toBe(0);
    expect(session.status()).toBe('off');
  });

  it('does not invoke the request function when the store already holds a device id (D-08)', () => {
    const storage = new FakeStorage();
    storage.setItem(
      PERSISTENCE_STORAGE_KEY,
      JSON.stringify({ ...defaultSavedDocument(), lastMidiDeviceId: 'port-b' }),
    );
    const request = createFakeRequestMidiAccess({
      access: new FakeMidiAccess([
        new FakeMidiInput('port-a', 'A'),
        new FakeMidiInput('port-b', 'B'),
      ]),
    });
    TestBed.configureTestingModule({
      providers: sessionProviders(request, { storage }),
    });

    TestBed.inject(MidiSession);

    expect(request.callCount).toBe(0);
  });

  it('sets unsupported when the token is null and does not throw', async () => {
    TestBed.configureTestingModule({
      providers: sessionProviders(null),
    });

    const session = TestBed.inject(MidiSession);
    expect(session.status()).toBe('unsupported');

    await expect(session.enable()).resolves.toBeUndefined();
    expect(session.status()).toBe('unsupported');
  });

  it('selects the first inputs.values() port and requests without sysex', async () => {
    const input = new FakeMidiInput('port-a', 'Test Keys');
    const access = new FakeMidiAccess([input]);
    const request = createFakeRequestMidiAccess({ access });
    TestBed.configureTestingModule({
      providers: sessionProviders(request),
    });

    const session = TestBed.inject(MidiSession);
    await session.enable();

    expect(request.callCount).toBe(1);
    expect(request.lastOptions).toEqual({ sysex: false });
    expect(session.status()).toBe('ready');
    expect(session.selectedPortId()).toBe('port-a');
    expect(session.selectedPortName()).toBe('Test Keys');
  });

  it('notifies subscribeNotes with parsed note-on on the selected port only', async () => {
    const selected = new FakeMidiInput('port-a', 'A');
    const other = new FakeMidiInput('port-b', 'B');
    const access = new FakeMidiAccess([selected, other]);
    const request = createFakeRequestMidiAccess({ access });
    TestBed.configureTestingModule({
      providers: sessionProviders(request),
    });

    const session = TestBed.inject(MidiSession);
    const received: unknown[] = [];
    session.subscribeNotes((parsed) => received.push(parsed));
    await session.enable();

    expect(other.onmidimessage).toBeNull();

    selected.emit(Uint8Array.of(0x90, 60, 100));
    expect(received).toEqual([{ kind: 'on', note: 60, velocity: 100 }]);

    other.emit(Uint8Array.of(0x90, 64, 90));
    expect(received).toEqual([{ kind: 'on', note: 60, velocity: 100 }]);
  });
});

describe('MidiSession named states, disconnect, and disable', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function setupSession(
    request: ReturnType<typeof createFakeRequestMidiAccess>,
    engine: SynthEngine = createFakeEngine(),
  ): { session: MidiSession; engine: SynthEngine } {
    TestBed.configureTestingModule({
      providers: sessionProviders(request, { engine }),
    });
    return { session: TestBed.inject(MidiSession), engine };
  }

  it('maps NotAllowedError to permission-denied', async () => {
    const request = createFakeRequestMidiAccess({
      rejectWith: new DOMException('Permission denied', 'NotAllowedError'),
    });
    const { session } = setupSession(request);
    await session.enable();
    expect(session.status()).toBe('permission-denied');
  });

  it('sets no-devices when access resolves with zero inputs', async () => {
    const request = createFakeRequestMidiAccess({ access: new FakeMidiAccess([]) });
    const { session } = setupSession(request);
    await session.enable();
    expect(session.status()).toBe('no-devices');
    expect(session.selectedPortId()).toBeNull();
  });

  it('auto-selects the first iterator port and does not switch when a non-selected port disconnects (D-03, D-04)', async () => {
    const portA = new FakeMidiInput('port-a', 'A');
    const portB = new FakeMidiInput('port-b', 'B');
    const access = new FakeMidiAccess([portA, portB]);
    const request = createFakeRequestMidiAccess({ access });
    const { session } = setupSession(request);
    await session.enable();

    expect(session.selectedPortId()).toBe('port-a');
    expect(portB.onmidimessage).toBeNull();

    session.selectPort('port-b');
    expect(session.status()).toBe('ready');
    expect(session.selectedPortId()).toBe('port-b');
    expect(portA.onmidimessage).toBeNull();

    access.disconnectInput('port-a');
    expect(access.inputs.get('port-a')).toBeUndefined();
    expect(session.status()).toBe('ready');
    expect(session.selectedPortId()).toBe('port-b');
    expect(session.ports().some((port) => port.id === 'port-a')).toBe(false);
  });

  it('keeps the selected id and calls allNotesOff when that port disconnects (D-04, D-09)', async () => {
    const portA = new FakeMidiInput('port-a', 'A');
    const portB = new FakeMidiInput('port-b', 'B');
    const access = new FakeMidiAccess([portA, portB]);
    const request = createFakeRequestMidiAccess({ access });
    const engine = createFakeEngine();
    const { session } = setupSession(request, engine);
    await session.enable();

    access.disconnectInput('port-a');

    expect(access.inputs.get('port-a')).toBeUndefined();
    expect(session.status()).toBe('disconnected');
    expect(session.selectedPortId()).toBe('port-a');
    expect(session.selectedPortName()).toBe('A');
    expect(engine.allNotesOff).toHaveBeenCalled();
    expect(session.ports()).toContainEqual({ id: 'port-a', name: 'A', connected: false });
    expect(portA.onmidimessage).toBeNull();
    expect(portB.onmidimessage).toBeNull();
  });

  it('reattaches onmidimessage when the same selected id reconnects', async () => {
    const portA = new FakeMidiInput('port-a', 'A');
    const access = new FakeMidiAccess([portA]);
    const request = createFakeRequestMidiAccess({ access });
    const { session } = setupSession(request);
    await session.enable();
    const received: unknown[] = [];
    session.subscribeNotes((parsed) => received.push(parsed));

    access.disconnectInput('port-a');
    expect(session.status()).toBe('disconnected');

    access.reconnectInput('port-a');
    expect(session.status()).toBe('ready');
    expect(portA.onmidimessage).not.toBeNull();

    portA.emit(Uint8Array.of(0x90, 64, 90));
    expect(received).toEqual([{ kind: 'on', note: 64, velocity: 90 }]);
  });

  it('disable calls allNotesOff, returns to off, and re-enable does not request again', async () => {
    const input = new FakeMidiInput('port-a', 'A');
    const access = new FakeMidiAccess([input]);
    const request = createFakeRequestMidiAccess({ access });
    const engine = createFakeEngine();
    const { session } = setupSession(request, engine);
    await session.enable();
    expect(request.callCount).toBe(1);

    session.disable();

    expect(engine.allNotesOff).toHaveBeenCalled();
    expect(session.status()).toBe('off');
    expect(input.onmidimessage).toBeNull();
    expect(access.onstatechange).toBeNull();

    await session.enable();
    expect(request.callCount).toBe(1);
    expect(session.status()).toBe('ready');
  });

  it('keeps a prior selected id as disconnected on re-enable when that port is gone (D-04)', async () => {
    const portA = new FakeMidiInput('port-a', 'A');
    const portB = new FakeMidiInput('port-b', 'B');
    const access = new FakeMidiAccess([portA, portB]);
    const request = createFakeRequestMidiAccess({ access });
    const { session } = setupSession(request);
    await session.enable();
    session.selectPort('port-b');
    session.disable();
    access.disconnectInput('port-b');

    await session.enable();

    expect(session.selectedPortId()).toBe('port-b');
    expect(session.status()).toBe('disconnected');
    expect(portA.onmidimessage).toBeNull();
  });
});

describe('MidiSession saved last device id (D-20)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('reselects the stored id even when it is not first in values()', async () => {
    const portA = new FakeMidiInput('port-a', 'A');
    const portB = new FakeMidiInput('port-b', 'B');
    const access = new FakeMidiAccess([portA, portB]);
    const request = createFakeRequestMidiAccess({ access });
    TestBed.configureTestingModule({
      providers: sessionProviders(request),
    });
    TestBed.inject(SavedDocumentStore).setLastMidiDeviceId('port-b');
    const session = TestBed.inject(MidiSession);

    await session.enable();

    expect(session.selectedPortId()).toBe('port-b');
    expect(session.selectedPortName()).toBe('B');
    expect(portA.onmidimessage).toBeNull();
    expect(portB.onmidimessage).not.toBeNull();
  });

  it('falls back to the first values() port when the stored id is absent (D-03)', async () => {
    const portA = new FakeMidiInput('port-a', 'A');
    const portB = new FakeMidiInput('port-b', 'B');
    const access = new FakeMidiAccess([portA, portB]);
    const request = createFakeRequestMidiAccess({ access });
    TestBed.configureTestingModule({
      providers: sessionProviders(request),
    });
    TestBed.inject(SavedDocumentStore).setLastMidiDeviceId('missing-port');
    const session = TestBed.inject(MidiSession);

    await session.enable();

    expect(session.selectedPortId()).toBe('port-a');
  });

  it('persists lastMidiDeviceId when the first device appears after no-devices (D-20)', async () => {
    const access = new FakeMidiAccess([]);
    const request = createFakeRequestMidiAccess({ access });
    TestBed.configureTestingModule({
      providers: sessionProviders(request),
    });
    const store = TestBed.inject(SavedDocumentStore);
    const session = TestBed.inject(MidiSession);

    await session.enable();
    expect(session.status()).toBe('no-devices');
    expect(store.document().lastMidiDeviceId).toBeNull();

    access.addInput(new FakeMidiInput('port-hotplug', 'Hotplug Keys'));

    expect(session.status()).toBe('ready');
    expect(session.selectedPortId()).toBe('port-hotplug');
    expect(store.document().lastMidiDeviceId).toBe('port-hotplug');
  });

  it('writes the chosen id into the saved document when selectPort runs', async () => {
    const portA = new FakeMidiInput('port-a', 'A');
    const portB = new FakeMidiInput('port-b', 'B');
    const access = new FakeMidiAccess([portA, portB]);
    const request = createFakeRequestMidiAccess({ access });
    TestBed.configureTestingModule({
      providers: sessionProviders(request),
    });
    const store = TestBed.inject(SavedDocumentStore);
    const session = TestBed.inject(MidiSession);
    await session.enable();

    session.selectPort('port-b');

    expect(store.document().lastMidiDeviceId).toBe('port-b');
  });
});
