import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AUDIO_CONTEXT_CTOR } from '../../core/audio/audio-context.token';
import { AUDIO_WORKLET_NODE_CTOR } from '../../core/audio/audio-worklet-node.token';
import { SYNTH_ENGINE } from '../../core/audio/synth-engine.token';
import { FakeAudioContext } from '../../core/audio/testing/fake-audio-context';
import { FakeAudioWorkletContext, FakeAudioWorkletNode } from '../../core/audio/testing/fake-audio-worklet-node';
import { REQUEST_MIDI_ACCESS } from '../../core/browser/midi-access.token';
import type { RequestMidiAccessLike } from '../../core/browser/midi-access.token';
import { createFakeRequestMidiAccess, FakeMidiAccess, FakeMidiInput } from '../../core/midi/testing/fake-midi-access';
import { STORAGE } from '../../core/persistence/storage.token';
import { FakeStorage } from '../../core/persistence/testing/fake-storage';
import { MIN_VELOCITY } from '../../domain/dx7/audio/value-conversion';
import { setGateMessage } from '../../domain/dx7/dsp/worklet-messages';
import { PlaySurface } from './play-surface';

function findButton(compiled: HTMLElement, label: string): HTMLButtonElement {
  const buttons = Array.from(compiled.querySelectorAll<HTMLButtonElement>('button'));
  const found = buttons.find((button) => (button.textContent ?? '').trim() === label);
  if (!found) {
    throw new Error(`no button labelled "${label}"`);
  }
  return found;
}

// D-01 (Phase 8): SYNTH_ENGINE now resolves WorkletSynthEngine, which needs
// both an AudioContext-like constructor AND an AudioWorkletNode-like
// constructor to leave 'unavailable' — mirrors `playground.spec.ts`'s fakes.
async function setup(
  requestMidiAccess?: RequestMidiAccessLike | null,
): Promise<ComponentFixture<PlaySurface>> {
  FakeAudioContext.instances.length = 0;
  FakeAudioWorkletNode.instances.length = 0;
  TestBed.resetTestingModule();
  const providers: { provide: unknown; useValue: unknown }[] = [
    { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioWorkletContext },
    { provide: AUDIO_WORKLET_NODE_CTOR, useValue: FakeAudioWorkletNode },
    { provide: STORAGE, useValue: new FakeStorage() },
  ];
  if (requestMidiAccess !== undefined) {
    providers.push({ provide: REQUEST_MIDI_ACCESS, useValue: requestMidiAccess });
  }
  await TestBed.configureTestingModule({
    imports: [PlaySurface],
    providers,
  }).compileComponents();

  const fixture = TestBed.createComponent(PlaySurface);
  await fixture.whenStable();
  return fixture;
}

async function enableAudio(fixture: ComponentFixture<PlaySurface>): Promise<void> {
  const compiled = fixture.nativeElement as HTMLElement;
  const enableButton = compiled.querySelector('button.button--primary') as HTMLButtonElement;
  enableButton.click();
  await fixture.whenStable();
}

function keyByNote(compiled: HTMLElement, note: number): HTMLButtonElement {
  const key = compiled.querySelector(`[data-note="${note}"]`);
  if (key === null) {
    throw new Error(`no key rendered for note ${note}`);
  }
  return key as HTMLButtonElement;
}

/** Subscribes to `notePlayed` and returns the array of emitted note numbers
 * so a spec can assert both count and payload. */
function collectNotePlayed(fixture: ComponentFixture<PlaySurface>): number[] {
  const emitted: number[] = [];
  fixture.componentInstance.notePlayed.subscribe((note) => emitted.push(note));
  return emitted;
}

describe('PlaySurface enable-audio focus', () => {
  it('focuses the first key button after audio becomes ready', async () => {
    const fixture = await setup();
    await enableAudio(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    const firstKey = compiled.querySelector('.key') as HTMLButtonElement | null;

    expect(firstKey).not.toBeNull();
    expect(firstKey!.getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(firstKey);
  });
});

describe('PlaySurface notePlayed output', () => {
  it('emits nothing when a key is pressed before audio is ready', async () => {
    const fixture = await setup();
    const compiled = fixture.nativeElement as HTMLElement;
    const emitted = collectNotePlayed(fixture);

    const key = keyByNote(compiled, 60);
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await fixture.whenStable();

    expect(emitted).toEqual([]);
  });

  it('emits the pressed MIDI note exactly once for a pointer press, and not on release', async () => {
    const fixture = await setup();
    await enableAudio(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    const emitted = collectNotePlayed(fixture);

    const key = keyByNote(compiled, 67); // G4
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await fixture.whenStable();
    key.dispatchEvent(new Event('pointerup'));
    await fixture.whenStable();

    expect(emitted).toEqual([67]);
  });

  it('emits for the computer-keyboard path and not on its release', async () => {
    const fixture = await setup();
    await enableAudio(fixture);
    const emitted = collectNotePlayed(fixture);

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' })); // C4 (60)
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    await fixture.whenStable();

    expect(emitted).toEqual([60]);
  });

  it('emits for the Space/Enter-on-a-focused-key path and not on its release', async () => {
    const fixture = await setup();
    await enableAudio(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    const emitted = collectNotePlayed(fixture);

    const key = keyByNote(compiled, 65); // F4
    key.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await fixture.whenStable();
    key.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    await fixture.whenStable();

    expect(emitted).toEqual([65]);
  });

  it('emits exactly once per successful press even across multiple presses', async () => {
    const fixture = await setup();
    await enableAudio(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    const emitted = collectNotePlayed(fixture);

    const key = keyByNote(compiled, 62); // D4
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await fixture.whenStable();
    key.dispatchEvent(new Event('pointerup'));
    await fixture.whenStable();
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await fixture.whenStable();

    expect(emitted).toEqual([62, 62]);
  });
});

describe('PlaySurface multi-source note ownership', () => {
  it('keeps a note sounding when a second source releases while a first still holds it, and only releases the engine note once the last owner lets go', async () => {
    const fixture = await setup();
    await enableAudio(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    const node = FakeAudioWorkletNode.instances[0];

    const key = keyByNote(compiled, 60); // C4 — also mapped to KeyA
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' })); // same note, second owner
    await fixture.whenStable();

    const closeCount = (): number =>
      node.port.postedMessages.filter(
        (message) => (message as { kind?: unknown; open?: unknown }).kind === 'setGate' && (message as { open?: unknown }).open === false,
      ).length;

    expect(closeCount()).toBe(0);

    // Release the pointer only — the keyboard key is still physically held.
    key.dispatchEvent(new Event('pointerup'));
    await fixture.whenStable();

    expect(closeCount()).toBe(0);
    expect(node.port.postedMessages).not.toContainEqual(setGateMessage(false, MIN_VELOCITY));

    // Release the last remaining owner — now the note actually stops.
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    await fixture.whenStable();

    expect(closeCount()).toBe(1);
    expect(node.port.postedMessages).toContainEqual(setGateMessage(false, MIN_VELOCITY));
  });

  it('does not leak a superseded pointer press\'s hold count (glissando: a second pointerdown lands before the first pointerup)', async () => {
    // WorkletSynthEngine is monophonic and only releases a note that still
    // matches its own single `heldNote` — pressKey(62) already retunes the
    // engine's one voice away from 60 before the supersede handling runs,
    // so releaseKey(60) at that point correctly posts no message (D-04's
    // stale-release rule, mirrored in releaseKey's own comment). The real,
    // previously-broken observable is a *leaked* hold count on note 60:
    // without the fix, a later fresh press-then-release of 60 needs two
    // releases to actually reach the engine, because unmarkHeld() (unlike
    // releaseKey()) never decremented noteHoldCount for the superseded note.
    const fixture = await setup();
    await enableAudio(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    const node = FakeAudioWorkletNode.instances[0];

    const closeCount = (): number =>
      node.port.postedMessages.filter(
        (message) => (message as { kind?: unknown; open?: unknown }).kind === 'setGate' && (message as { open?: unknown }).open === false,
      ).length;

    const firstKey = keyByNote(compiled, 60); // C4
    const secondKey = keyByNote(compiled, 62); // D4

    firstKey.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await fixture.whenStable();
    // Second pointerdown lands on a different key before the first key's
    // pointerup ever fires — e.g. a drag across the on-screen keys.
    secondKey.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await fixture.whenStable();
    // Releases the second (current) owner cleanly.
    secondKey.dispatchEvent(new Event('pointerup'));
    await fixture.whenStable();

    expect(closeCount()).toBe(1);

    // A fresh press-then-release of the superseded note must still reach
    // the engine in exactly one release, not require a second one to work
    // off a leaked hold count from the earlier supersede.
    firstKey.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await fixture.whenStable();
    firstKey.dispatchEvent(new Event('pointerup'));
    await fixture.whenStable();

    expect(closeCount()).toBe(2);
  });

  it('does not leak a superseded key-button activation\'s hold count (Tab moves focus before the first key\'s keyup fires)', async () => {
    const fixture = await setup();
    await enableAudio(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    const node = FakeAudioWorkletNode.instances[0];

    const closeCount = (): number =>
      node.port.postedMessages.filter(
        (message) => (message as { kind?: unknown; open?: unknown }).kind === 'setGate' && (message as { open?: unknown }).open === false,
      ).length;

    const firstKey = keyByNote(compiled, 65); // F4
    const secondKey = keyByNote(compiled, 67); // G4

    firstKey.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await fixture.whenStable();
    // Space is activated on a second key-button before the first ever gets
    // its keyup (mirrors focus moving via Tab while Space is still held).
    secondKey.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await fixture.whenStable();
    secondKey.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    await fixture.whenStable();

    expect(closeCount()).toBe(1);

    firstKey.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await fixture.whenStable();
    firstKey.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    await fixture.whenStable();

    expect(closeCount()).toBe(2);
  });

  it('retriggers a note still held by a pointer after MIDI allNotesOff leaves the ready state', async () => {
    const input = new FakeMidiInput('port-a', 'Test Keys');
    const access = new FakeMidiAccess([input]);
    const request = createFakeRequestMidiAccess({ access });
    const fixture = await setup(request);
    const compiled = fixture.nativeElement as HTMLElement;
    findButton(compiled, 'Enable MIDI').click();
    await fixture.whenStable();
    fixture.detectChanges();

    const engine = TestBed.inject(SYNTH_ENGINE);
    const noteOn = vi.spyOn(engine, 'noteOn');
    const allNotesOff = vi.spyOn(engine, 'allNotesOff');
    const key = keyByNote(compiled, 60);

    input.emit(Uint8Array.of(0x90, 60, 80));
    await fixture.whenStable();
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await fixture.whenStable();
    fixture.detectChanges();
    noteOn.mockClear();
    allNotesOff.mockClear();

    access.disconnectInput('port-a');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(allNotesOff).toHaveBeenCalled();
    expect(noteOn).toHaveBeenCalledWith(60, 100);
    expect(key.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('PlaySurface MIDI enable and notes', () => {
  function midiHarness(): { input: FakeMidiInput; request: ReturnType<typeof createFakeRequestMidiAccess> } {
    const input = new FakeMidiInput('port-a', 'Test Keys');
    const access = new FakeMidiAccess([input]);
    const request = createFakeRequestMidiAccess({ access });
    return { input, request };
  }

  async function enableMidi(fixture: ComponentFixture<PlaySurface>): Promise<HTMLButtonElement> {
    const compiled = fixture.nativeElement as HTMLElement;
    const button = findButton(compiled, 'Enable MIDI');
    button.focus();
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();
    return button;
  }

  it('does not move focus after Enable MIDI succeeds (D-10)', async () => {
    const { request } = midiHarness();
    const fixture = await setup(request);
    const button = await enableMidi(fixture);

    expect(document.activeElement).toBe(button);
    expect(findButton(fixture.nativeElement as HTMLElement, 'Disable MIDI')).toBe(button);
  });

  it('starts audio on the Enable MIDI click when audio is still suspended (D-06)', async () => {
    const { request } = midiHarness();
    const fixture = await setup(request);
    expect(FakeAudioContext.instances.length).toBe(0);

    await enableMidi(fixture);

    expect(FakeAudioContext.instances.length).toBe(1);
  });

  it('routes a MIDI note-on through pressKey so notePlayed fires with MIDI velocity (D-16)', async () => {
    const { input, request } = midiHarness();
    const fixture = await setup(request);
    await enableMidi(fixture);
    const engine = TestBed.inject(SYNTH_ENGINE);
    const noteOn = vi.spyOn(engine, 'noteOn');
    const emitted = collectNotePlayed(fixture);

    input.emit(Uint8Array.of(0x90, 60, 80));
    await fixture.whenStable();

    expect(emitted).toEqual([60]);
    expect(noteOn).toHaveBeenCalledWith(60, 80);
  });

  it('treats velocity-0 note-on as release and never calls noteOn with 0 (D-14)', async () => {
    const { input, request } = midiHarness();
    const fixture = await setup(request);
    await enableMidi(fixture);
    const engine = TestBed.inject(SYNTH_ENGINE);
    const noteOn = vi.spyOn(engine, 'noteOn');
    input.emit(Uint8Array.of(0x90, 60, 80));
    await fixture.whenStable();
    noteOn.mockClear();

    expect(() => input.emit(Uint8Array.of(0x90, 60, 0))).not.toThrow();
    await fixture.whenStable();

    expect(noteOn).not.toHaveBeenCalled();
    expect(noteOn.mock.calls.some((call) => call[1] === 0)).toBe(false);
  });

  it('omits velocity on pointer and keyboard presses so they use PLAYABLE_VELOCITY 100', async () => {
    const fixture = await setup();
    await enableAudio(fixture);
    const engine = TestBed.inject(SYNTH_ENGINE);
    const noteOn = vi.spyOn(engine, 'noteOn');
    const compiled = fixture.nativeElement as HTMLElement;

    keyByNote(compiled, 60).dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await fixture.whenStable();
    expect(noteOn).toHaveBeenCalledWith(60, 100);

    noteOn.mockClear();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' })); // D4 (62)
    await fixture.whenStable();
    expect(noteOn).toHaveBeenCalledWith(62, 100);
  });

  it('does not change noteOn count when a CC message arrives after ready (D-11)', async () => {
    const { input, request } = midiHarness();
    const fixture = await setup(request);
    await enableMidi(fixture);
    const engine = TestBed.inject(SYNTH_ENGINE);
    const noteOn = vi.spyOn(engine, 'noteOn');

    input.emit(Uint8Array.of(0xb0, 1, 1));
    await fixture.whenStable();

    expect(noteOn).not.toHaveBeenCalled();
  });

  it('keeps C4 pressed when MIDI releases while a pointer still holds it (D-17)', async () => {
    const { input, request } = midiHarness();
    const fixture = await setup(request);
    await enableMidi(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    const key = keyByNote(compiled, 60);

    input.emit(Uint8Array.of(0x90, 60, 80));
    await fixture.whenStable();
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await fixture.whenStable();
    fixture.detectChanges();

    input.emit(Uint8Array.of(0x80, 60, 64));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(key.getAttribute('aria-pressed')).toBe('true');

    key.dispatchEvent(new Event('pointerup'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(key.getAttribute('aria-pressed')).toBe('false');
  });

  it('sounds MIDI note 48 without adding an on-screen key (D-12, D-15)', async () => {
    const { input, request } = midiHarness();
    const fixture = await setup(request);
    await enableMidi(fixture);
    const engine = TestBed.inject(SYNTH_ENGINE);
    const noteOn = vi.spyOn(engine, 'noteOn');
    const compiled = fixture.nativeElement as HTMLElement;

    input.emit(Uint8Array.of(0x90, 48, 90));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(noteOn).toHaveBeenCalledWith(48, 90);
    expect(compiled.querySelector('[data-note="48"]')).toBeNull();
    expect(compiled.querySelectorAll('[data-note]').length).toBe(12);
  });

  it('clears the MIDI-held C4 highlight when the selected device disconnects', async () => {
    const input = new FakeMidiInput('port-a', 'Test Keys');
    const access = new FakeMidiAccess([input]);
    const request = createFakeRequestMidiAccess({ access });
    const fixture = await setup(request);
    await enableMidi(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    const key = keyByNote(compiled, 60);

    input.emit(Uint8Array.of(0x90, 60, 80));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(key.getAttribute('aria-pressed')).toBe('true');

    access.disconnectInput('port-a');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(key.getAttribute('aria-pressed')).toBe('false');
  });
});
