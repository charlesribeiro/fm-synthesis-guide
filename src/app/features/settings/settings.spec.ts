import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { AUDIO_CONTEXT_CTOR } from '../../core/audio/audio-context.token';
import { AUDIO_WORKLET_NODE_CTOR } from '../../core/audio/audio-worklet-node.token';
import { SYNTH_ENGINE } from '../../core/audio/synth-engine.token';
import { FakeAudioContext } from '../../core/audio/testing/fake-audio-context';
import { FakeAudioWorkletContext, FakeAudioWorkletNode } from '../../core/audio/testing/fake-audio-worklet-node';
import { REQUEST_MIDI_ACCESS } from '../../core/browser/midi-access.token';
import type { RequestMidiAccessLike } from '../../core/browser/midi-access.token';
import { MidiSession } from '../../core/midi/midi-session';
import { createFakeRequestMidiAccess, FakeMidiAccess, FakeMidiInput } from '../../core/midi/testing/fake-midi-access';
import { STORAGE } from '../../core/persistence/storage.token';
import { FakeStorage } from '../../core/persistence/testing/fake-storage';
import {
  EXPORT_FILENAME,
  MAX_IMPORT_BYTES,
  PERSISTENCE_STORAGE_KEY,
  defaultSavedDocument,
  type SavedDocument,
} from '../../domain/dx7/persistence/saved-document';
import { parseSavedDocument } from '../../domain/dx7/persistence/parse-saved-document';
import { DEFAULT_PATCH } from '../../domain/dx7/models/patch';
import { InstrumentState } from '../../state/instrument-state';
import { LessonProgress } from '../../state/lesson-progress';
import { SavedDocumentStore } from '../../state/saved-document-store';
import { Settings } from './settings';

function findButton(compiled: HTMLElement, label: string): HTMLButtonElement {
  const buttons = Array.from(compiled.querySelectorAll<HTMLButtonElement>('button'));
  const found = buttons.find((button) => (button.textContent ?? '').trim() === label);
  if (!found) {
    throw new Error(`no button labelled "${label}"`);
  }
  return found;
}

function findSelectByLabel(compiled: HTMLElement, label: string): HTMLSelectElement {
  const labels = Array.from(compiled.querySelectorAll('label'));
  const match = labels.find((node) => (node.textContent ?? '').trim() === label);
  const controlId = match?.getAttribute('for');
  const select =
    controlId === null || controlId === undefined
      ? null
      : compiled.querySelector<HTMLSelectElement>(`#${controlId}`);
  if (select === null) {
    throw new Error(`no select labelled "${label}"`);
  }
  return select;
}

async function setupSettings(
  request: RequestMidiAccessLike | null = null,
  storage: FakeStorage = new FakeStorage(),
  url = '/',
): Promise<{ fixture: ComponentFixture<Settings>; storage: FakeStorage }> {
  FakeAudioContext.instances.length = 0;
  FakeAudioWorkletNode.instances.length = 0;
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [Settings],
    providers: [
      { provide: REQUEST_MIDI_ACCESS, useValue: request },
      { provide: STORAGE, useValue: storage },
      { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioWorkletContext },
      { provide: AUDIO_WORKLET_NODE_CTOR, useValue: FakeAudioWorkletNode },
      { provide: Router, useValue: { url } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Settings);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, storage };
}

function seedCompletedLesson(storage: FakeStorage): string {
  const document: SavedDocument = {
    ...defaultSavedDocument(),
    completedLessonIds: ['algorithm-32'],
    lastMidiDeviceId: 'port-a',
  };
  const serialized = JSON.stringify(document);
  storage.setItem(PERSISTENCE_STORAGE_KEY, serialized);
  return serialized;
}

function fileListOf(file: File): FileList {
  return {
    0: file,
    length: 1,
    item: (index: number) => (index === 0 ? file : null),
    [Symbol.iterator]: function* () {
      yield file;
    },
  } as FileList;
}

async function chooseImportFile(fixture: ComponentFixture<Settings>, file: File): Promise<void> {
  const compiled = fixture.nativeElement as HTMLElement;
  const labels = Array.from(compiled.querySelectorAll('label'));
  const match = labels.find((node) => (node.textContent ?? '').trim() === 'Import backup');
  const controlId = match?.getAttribute('for');
  const input =
    controlId === null || controlId === undefined
      ? compiled.querySelector<HTMLInputElement>('input[type="file"]')
      : compiled.querySelector<HTMLInputElement>(`#${controlId}`);
  if (input === null) {
    throw new Error('no labelled file picker for Import backup');
  }
  Object.defineProperty(input, 'files', { configurable: true, value: fileListOf(file) });
  input.dispatchEvent(new Event('change'));
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('Settings route', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: STORAGE, useValue: new FakeStorage() },
        { provide: REQUEST_MIDI_ACCESS, useValue: null },
        { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioWorkletContext },
        { provide: AUDIO_WORKLET_NODE_CTOR, useValue: FakeAudioWorkletNode },
      ],
    });
  });

  it('renders an h1 containing Settings and a MIDI section heading', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/settings', Settings);

    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent).toContain('Settings');
    expect(root.querySelector('#midi-heading')?.textContent).toMatch(/MIDI/i);
  });
});

describe('Settings MIDI section', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the unsupported explanation and does not throw when Enable MIDI has a null token', async () => {
    const { fixture } = await setupSettings(null);
    const compiled = fixture.nativeElement as HTMLElement;

    expect(() => findButton(compiled, 'Enable MIDI').click()).not.toThrow();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector('[role="status"]')?.textContent).toContain(
      'This browser does not support the Web MIDI API',
    );
    expect(TestBed.inject(MidiSession).status()).toBe('unsupported');
  });

  it('selects stored port B despite A being first in values() (D-20)', async () => {
    const portA = new FakeMidiInput('port-a', 'A');
    const portB = new FakeMidiInput('port-b', 'B');
    const request = createFakeRequestMidiAccess({ access: new FakeMidiAccess([portA, portB]) });
    const { fixture } = await setupSettings(request);
    TestBed.inject(SavedDocumentStore).setLastMidiDeviceId('port-b');

    findButton(fixture.nativeElement as HTMLElement, 'Enable MIDI').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(TestBed.inject(MidiSession).selectedPortId()).toBe('port-b');
    const select = findSelectByLabel(fixture.nativeElement as HTMLElement, 'MIDI device');
    expect(select.value).toBe('port-b');
  });

  it('falls back to the first values() port when the saved id is absent (D-03)', async () => {
    const request = createFakeRequestMidiAccess({
      access: new FakeMidiAccess([new FakeMidiInput('port-a', 'A'), new FakeMidiInput('port-b', 'B')]),
    });
    const { fixture } = await setupSettings(request);
    TestBed.inject(SavedDocumentStore).setLastMidiDeviceId('missing-port');

    findButton(fixture.nativeElement as HTMLElement, 'Enable MIDI').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(TestBed.inject(MidiSession).selectedPortId()).toBe('port-a');
  });

  it('writes lastMidiDeviceId when the Settings device select changes', async () => {
    const request = createFakeRequestMidiAccess({
      access: new FakeMidiAccess([new FakeMidiInput('port-a', 'A'), new FakeMidiInput('port-b', 'B')]),
    });
    const { fixture } = await setupSettings(request);
    findButton(fixture.nativeElement as HTMLElement, 'Enable MIDI').click();
    await fixture.whenStable();
    fixture.detectChanges();

    const select = findSelectByLabel(fixture.nativeElement as HTMLElement, 'MIDI device');
    select.value = 'port-b';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(TestBed.inject(SavedDocumentStore).document().lastMidiDeviceId).toBe('port-b');
  });

  it('constructs a FakeAudioContext when Enable MIDI runs while audio is suspended (D-06)', async () => {
    const request = createFakeRequestMidiAccess({
      access: new FakeMidiAccess([new FakeMidiInput('port-a', 'Test Keys')]),
    });
    const { fixture } = await setupSettings(request);
    expect(FakeAudioContext.instances.length).toBe(0);

    findButton(fixture.nativeElement as HTMLElement, 'Enable MIDI').click();
    await fixture.whenStable();

    expect(FakeAudioContext.instances.length).toBe(1);
  });

  it('Disable MIDI calls allNotesOff and returns status off (D-09)', async () => {
    const request = createFakeRequestMidiAccess({
      access: new FakeMidiAccess([new FakeMidiInput('port-a', 'Test Keys')]),
    });
    const { fixture } = await setupSettings(request);
    findButton(fixture.nativeElement as HTMLElement, 'Enable MIDI').click();
    await fixture.whenStable();
    fixture.detectChanges();

    const engine = TestBed.inject(SYNTH_ENGINE);
    const allNotesOff = vi.spyOn(engine, 'allNotesOff');
    findButton(fixture.nativeElement as HTMLElement, 'Disable MIDI').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(allNotesOff).toHaveBeenCalled();
    expect(TestBed.inject(MidiSession).status()).toBe('off');
  });

  it('keeps a disconnected selected port listed with disconnected in the label (D-04)', async () => {
    const portA = new FakeMidiInput('port-a', 'A');
    const portB = new FakeMidiInput('port-b', 'B');
    const access = new FakeMidiAccess([portA, portB]);
    const request = createFakeRequestMidiAccess({ access });
    const { fixture } = await setupSettings(request);
    findButton(fixture.nativeElement as HTMLElement, 'Enable MIDI').click();
    await fixture.whenStable();
    fixture.detectChanges();

    access.disconnectInput('port-a');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(access.inputs.get('port-a')).toBeUndefined();
    const select = findSelectByLabel(fixture.nativeElement as HTMLElement, 'MIDI device');
    const disconnectedOption = Array.from(select.options).find((option) => option.value === 'port-a');
    expect(disconnectedOption).toBeDefined();
    expect(disconnectedOption?.textContent?.toLowerCase()).toContain('disconnected');
    expect(select.value).toBe('port-a');
  });
});

const IMPORT_CONFIRM_COPY =
  'Replace all saved data (lesson progress, Playground patch, last MIDI device) with this file? This cannot be undone from inside the app.';
const CLEAR_CONFIRM_COPY =
  'Clear all saved data? Lesson progress, the Playground patch, and the last MIDI device will be reset. This cannot be undone from inside the app.';

describe('Settings saved data', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('export downloads the current document as dx7-algorithm-lab-backup.json', async () => {
    const { fixture } = await setupSettings();
    const objectUrl = 'blob:test-backup';
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.fn();
    let anchor: HTMLAnchorElement | undefined;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        anchor = element as HTMLAnchorElement;
        element.click = click;
      }
      return element;
    });

    findButton(fixture.nativeElement as HTMLElement, 'Export backup').click();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe('application/json');
    const text = await blob.text();
    const parsed = parseSavedDocument(JSON.parse(text));
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(TestBed.inject(SavedDocumentStore).document());
    expect(anchor?.download).toBe(EXPORT_FILENAME);
    expect(click).toHaveBeenCalled();
  });

  it('cancelled import confirm does not replace the document', async () => {
    const storage = new FakeStorage();
    const before = seedCompletedLesson(storage);
    const { fixture } = await setupSettings(null, storage);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const file = new File([JSON.stringify(defaultSavedDocument())], 'backup.json', {
      type: 'application/json',
    });
    await chooseImportFile(fixture, file);

    expect(window.confirm).toHaveBeenCalledWith(IMPORT_CONFIRM_COPY);
    expect(storage.getItem(PERSISTENCE_STORAGE_KEY)).toBe(before);
    expect(TestBed.inject(SavedDocumentStore).document().completedLessonIds).toEqual(['algorithm-32']);
  });

  it('refuses an oversize file after confirm and leaves storage unchanged', async () => {
    const storage = new FakeStorage();
    const before = seedCompletedLesson(storage);
    const { fixture } = await setupSettings(null, storage);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_BYTES + 1 });

    await chooseImportFile(fixture, file);

    expect(storage.getItem(PERSISTENCE_STORAGE_KEY)).toBe(before);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('too large');
  });

  it('refuses Dexed-shaped JSON after confirm and leaves storage unchanged (D-28, D-26)', async () => {
    const storage = new FakeStorage();
    const before = seedCompletedLesson(storage);
    const { fixture } = await setupSettings(null, storage);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const dexed = { format: 'dexed', bank: 0, voices: [{ name: 'INIT VOICE' }] };
    const file = new File([JSON.stringify(dexed)], 'dexed.json', { type: 'application/json' });

    await chooseImportFile(fixture, file);

    expect(storage.getItem(PERSISTENCE_STORAGE_KEY)).toBe(before);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('malformed backup');
  });

  it('imports extra-key schema-version-1 JSON, hydrates lesson progress, and applies the patch on /playground', async () => {
    const imported: SavedDocument = {
      ...defaultSavedDocument(),
      playgroundPatch: { ...DEFAULT_PATCH, algorithmId: 32 },
      completedLessonIds: ['algorithm-1'],
      lastMidiDeviceId: 'port-b',
    };
    const raw = { ...imported, extraKey: 'ignore me' };
    const storage = new FakeStorage();
    seedCompletedLesson(storage);
    const { fixture } = await setupSettings(null, storage, '/playground');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const file = new File([JSON.stringify(raw)], 'backup.json', { type: 'application/json' });

    await chooseImportFile(fixture, file);

    const store = TestBed.inject(SavedDocumentStore);
    expect(store.document().completedLessonIds).toEqual(['algorithm-1']);
    expect(store.document().playgroundPatch.algorithmId).toBe(32);
    expect(store.document().lastMidiDeviceId).toBe('port-b');
    expect(TestBed.inject(LessonProgress).isComplete('algorithm-1')).toBe(true);
    expect(TestBed.inject(InstrumentState).patch().algorithmId).toBe(32);
  });

  it('cancelled clear confirm does not removeItem', async () => {
    const storage = new FakeStorage();
    const before = seedCompletedLesson(storage);
    const { fixture } = await setupSettings(null, storage);
    const removeItem = vi.spyOn(storage, 'removeItem');
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    findButton(fixture.nativeElement as HTMLElement, 'Clear saved data').click();

    expect(window.confirm).toHaveBeenCalledWith(CLEAR_CONFIRM_COPY);
    expect(removeItem).not.toHaveBeenCalled();
    expect(storage.getItem(PERSISTENCE_STORAGE_KEY)).toBe(before);
  });

  it('confirmed clear restores defaults, disables MIDI, and does not smash a live lesson patch', async () => {
    const storage = new FakeStorage();
    seedCompletedLesson(storage);
    const request = createFakeRequestMidiAccess({
      access: new FakeMidiAccess([new FakeMidiInput('port-a', 'A')]),
    });
    const { fixture } = await setupSettings(request, storage, '/learn/algorithm-32');
    findButton(fixture.nativeElement as HTMLElement, 'Enable MIDI').click();
    await fixture.whenStable();
    const instrument = TestBed.inject(InstrumentState);
    instrument.replacePatch({ ...DEFAULT_PATCH, algorithmId: 32 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    findButton(fixture.nativeElement as HTMLElement, 'Clear saved data').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(TestBed.inject(SavedDocumentStore).document()).toEqual(defaultSavedDocument());
    expect(TestBed.inject(LessonProgress).completed().size).toBe(0);
    expect(TestBed.inject(SavedDocumentStore).document().lastMidiDeviceId).toBeNull();
    expect(TestBed.inject(MidiSession).status()).toBe('off');
    expect(instrument.patch().algorithmId).toBe(32);
  });

  it('renders recoveryMessage from corrupt boot storage in a live region', async () => {
    const storage = new FakeStorage();
    storage.setItem(PERSISTENCE_STORAGE_KEY, '{not-json');
    const { fixture } = await setupSettings(null, storage);
    const statuses = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[role="status"]'),
    );

    expect(statuses.some((node) => (node.textContent ?? '').includes('unreadable'))).toBe(true);
  });
});
