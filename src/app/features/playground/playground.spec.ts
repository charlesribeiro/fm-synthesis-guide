import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AUDIO_CONTEXT_CTOR } from '../../core/audio/audio-context.token';
import { AUDIO_WORKLET_NODE_CTOR } from '../../core/audio/audio-worklet-node.token';
import { FakeAudioContext, FakeGainNode } from '../../core/audio/testing/fake-audio-context';
import { FakeAudioWorkletContext, FakeAudioWorkletNode } from '../../core/audio/testing/fake-audio-worklet-node';
import { SYNTH_ENGINE } from '../../core/audio/synth-engine.token';
import type { SynthEngine } from '../../core/audio/synth-engine';
import { Playground } from './playground';

/** The masterGain is the fake gain node connected to `context.destination`. */
function findMasterGain(context: FakeAudioContext): FakeGainNode {
  const masterGain = context.createdGains.find((gain) => gain.connections.has(context.destination));
  if (masterGain === undefined) {
    throw new Error('masterGain was not created — buildGraph did not run as expected');
  }
  return masterGain;
}

/** The voiceGain is the fake gain node connected to masterGain. */
function findVoiceGain(context: FakeAudioContext): FakeGainNode {
  const masterGain = findMasterGain(context);
  const voiceGain = context.createdGains.find((gain) => gain.connections.has(masterGain));
  if (voiceGain === undefined) {
    throw new Error('voiceGain was not created — buildGraph did not run as expected');
  }
  return voiceGain;
}

const APPROXIMATION_LABEL = 'Educational approximation — not a bit-accurate DX7 emulation';

describe('Playground', () => {
  let fixture: ComponentFixture<Playground>;

  // D-01 (Phase 8): SYNTH_ENGINE now resolves WorkletSynthEngine, which needs
  // both an AudioContext-like constructor AND an AudioWorkletNode-like
  // constructor to leave 'unavailable' — FakeAudioWorkletContext (extends
  // FakeAudioContext, so `findMasterGain`/`findVoiceGain`'s `createdGains`
  // lookups keep working unchanged) plus FakeAudioWorkletNode mirror
  // `worklet-synth-engine.spec.ts`'s own doubles.
  async function setup(
    ctor: typeof FakeAudioWorkletContext | null = FakeAudioWorkletContext,
  ): Promise<ComponentFixture<Playground>> {
    FakeAudioContext.instances.length = 0;
    FakeAudioWorkletNode.instances.length = 0;
    await TestBed.configureTestingModule({
      imports: [Playground],
      providers: [
        { provide: AUDIO_CONTEXT_CTOR, useValue: ctor },
        { provide: AUDIO_WORKLET_NODE_CTOR, useValue: ctor === null ? null : FakeAudioWorkletNode },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Playground);
    await fixture.whenStable();
    return fixture;
  }

  async function enableAudio(currentFixture: ComponentFixture<Playground>): Promise<void> {
    const compiled = currentFixture.nativeElement as HTMLElement;
    const enableButton = compiled.querySelector('button.button--primary') as HTMLButtonElement;
    enableButton.click();
    await currentFixture.whenStable();
  }

  function keyByNote(compiled: HTMLElement, note: number): HTMLButtonElement {
    const key = compiled.querySelector(`[data-note="${note}"]`);
    if (key === null) {
      throw new Error(`no key rendered for note ${note}`);
    }
    return key as HTMLButtonElement;
  }

  it('constructs no AudioContext before the Enable-audio gesture', async () => {
    await setup();

    expect(FakeAudioContext.instances.length).toBe(0);
  });

  it('activates the keyboard and constructs exactly one AudioContext after Enable-audio', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;

    await enableAudio(currentFixture);

    expect(FakeAudioContext.instances.length).toBe(1);
    expect(compiled.querySelector('.gate')).toBeNull();
    expect(compiled.querySelector('.key')?.getAttribute('aria-disabled')).toBeNull();
    expect(compiled.querySelector('[role="status"]')?.textContent).toContain('Audio is ready');
    expect(document.activeElement).toBe(compiled.querySelector('.key'));
  });

  it('schedules a rising ramp on note-on and a release-to-zero on note-off', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;

    await enableAudio(currentFixture);

    const context = FakeAudioContext.instances[0];
    const voiceGain = findVoiceGain(context);
    const key = compiled.querySelector('.key') as HTMLButtonElement;

    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await currentFixture.whenStable();

    const risingRamp = voiceGain.gain.automationEntries.find(
      (entry) => entry.method === 'linearRampToValueAtTime' && entry.value > 0,
    );
    expect(risingRamp).toBeTruthy();

    key.dispatchEvent(new Event('pointerup'));
    await currentFixture.whenStable();

    const lastEntry = voiceGain.gain.automationEntries.at(-1);
    expect(lastEntry?.method).toBe('setValueAtTime');
    expect(lastEntry?.value).toBe(0);
  });

  it('shows the approximation label before and after enabling audio', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain(APPROXIMATION_LABEL);

    await enableAudio(currentFixture);

    expect(compiled.textContent).toContain(APPROXIMATION_LABEL);
  });

  it('renders the unavailable message and no Enable-audio button when Web Audio is unsupported', async () => {
    const currentFixture = await setup(null);
    const compiled = currentFixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[role="status"]')?.textContent).toContain(
      "doesn't support Web Audio",
    );
    expect(compiled.querySelector('button.button--primary')).toBeNull();
    expect(compiled.textContent).toContain(APPROXIMATION_LABEL);
  });

  it('lists the planned Playground capabilities', async () => {
    await setup();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.feature-list li').length).toBeGreaterThan(0);
  });

  it('renders exactly 12 key buttons before and after audio is enabled, in ascending note order', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;

    const beforeKeys = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.key'));
    expect(beforeKeys.length).toBe(12);
    const beforeNotes = beforeKeys.map((key) => Number(key.getAttribute('data-note')));
    expect(beforeNotes).toEqual([...beforeNotes].sort((a, b) => a - b));
    expect(beforeKeys[0].textContent).toContain('C4');
    expect(beforeKeys[0].textContent).toContain('A'); // printed key hint

    await enableAudio(currentFixture);

    const afterKeys = compiled.querySelectorAll('.key');
    expect(afterKeys.length).toBe(12);
  });

  it('marks every key out of the tab order and aria-disabled before ready, and neither once ready', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;

    const beforeKeys = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.key'));
    for (const key of beforeKeys) {
      expect(key.getAttribute('tabindex')).toBe('-1');
      expect(key.getAttribute('aria-disabled')).toBe('true');
    }

    await enableAudio(currentFixture);

    const afterKeys = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.key'));
    for (const key of afterKeys) {
      expect(key.getAttribute('tabindex')).not.toBe('-1');
      expect(key.getAttribute('aria-disabled')).toBeNull();
    }
  });

  it('does not call the engine when a key is pressed before audio is ready', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOnSpy = vi.spyOn(engine, 'noteOn');

    const key = keyByNote(compiled, 60);
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await currentFixture.whenStable();

    expect(noteOnSpy).not.toHaveBeenCalled();
  });

  it('plays and releases a specific key with pointerdown/pointerup, calling the engine with that note', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOnSpy = vi.spyOn(engine, 'noteOn');
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    const key = keyByNote(compiled, 67); // G4
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await currentFixture.whenStable();
    expect(noteOnSpy).toHaveBeenCalledWith(67, expect.any(Number));

    key.dispatchEvent(new Event('pointerup'));
    await currentFixture.whenStable();
    expect(noteOffSpy).toHaveBeenCalledWith(67);
  });

  it('ignores a right-click pointerdown so it cannot start a note that a swallowed release would strand', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOnSpy = vi.spyOn(engine, 'noteOn');

    const key = keyByNote(compiled, 67); // G4
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }));
    await currentFixture.whenStable();

    expect(noteOnSpy).not.toHaveBeenCalled();
  });

  it("WR-07: a right-click's own pointerup does not release a note actually held via the keyboard on the same key", async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    // Hold note 60 (C4) via the keyboard.
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    await currentFixture.whenStable();

    // A right-click on the same on-screen key: its pointerdown is ignored
    // (see the right-click pointerdown test above), but the browser still
    // delivers the matching release-side event once the click resolves.
    const key = keyByNote(compiled, 60);
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }));
    await currentFixture.whenStable();
    key.dispatchEvent(new PointerEvent('pointerup', { button: 2 }));
    await currentFixture.whenStable();

    expect(noteOffSpy).not.toHaveBeenCalledWith(60);
  });

  it('ends the note on pointerleave, exactly as pointerup does', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    const key = keyByNote(compiled, 62); // D4
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await currentFixture.whenStable();

    key.dispatchEvent(new Event('pointerleave'));
    await currentFixture.whenStable();

    expect(noteOffSpy).toHaveBeenCalledWith(62);
  });

  it('ends the note on pointercancel, exactly as pointerup does', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    const key = keyByNote(compiled, 64); // E4
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await currentFixture.whenStable();

    key.dispatchEvent(new Event('pointercancel'));
    await currentFixture.whenStable();

    expect(noteOffSpy).toHaveBeenCalledWith(64);
  });

  it('plays and releases a note from the computer keyboard via document keydown/keyup', async () => {
    const currentFixture = await setup();
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOnSpy = vi.spyOn(engine, 'noteOn');
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    await currentFixture.whenStable();
    expect(noteOnSpy).toHaveBeenCalledWith(60, expect.any(Number));

    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    await currentFixture.whenStable();
    expect(noteOffSpy).toHaveBeenCalledWith(60);
  });

  it("WR-06: a keyup at an editable target does not release a note currently held via the pointer, even when the codes match", async () => {
    const currentFixture = await setup();
    await enableAudio(currentFixture);
    const compiled = currentFixture.nativeElement as HTMLElement;

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    // Hold note 64 (E4, code 'KeyD') via the pointer path.
    const key = keyByNote(compiled, 64);
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await currentFixture.whenStable();

    // An unrelated editable element's keyup fires with the *same* code —
    // its matching keydown would have been suppressed by isEditableTarget,
    // but before WR-06, onDocumentKeyup applied no such guard.
    const input = document.createElement('input');
    document.body.appendChild(input);
    try {
      input.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', bubbles: true }));
      await currentFixture.whenStable();

      expect(noteOffSpy).not.toHaveBeenCalledWith(64);
    } finally {
      document.body.removeChild(input);
    }
  });

  it('releases a keyboard-held note on its own keyup even if a modifier key was pressed mid-hold', async () => {
    const currentFixture = await setup();
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    // Hold KeyA (note 60) via the document keydown path, with no modifier.
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    await currentFixture.whenStable();

    // While the physical key is still held, the user also presses Ctrl for
    // an unrelated shortcut — the matching keyup now carries ctrlKey: true.
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', ctrlKey: true }));
    await currentFixture.whenStable();

    expect(noteOffSpy).toHaveBeenCalledWith(60);
  });

  it('releases a keyboard-held note on its own keyup even if focus moved to an editable element mid-hold', async () => {
    const currentFixture = await setup();
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    // Hold KeyS (note 62) via the document keydown path, focus on <body>.
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    await currentFixture.whenStable();

    // While the physical key is still held, focus moves to an editable
    // element — the matching keyup's target is now that element.
    const input = document.createElement('input');
    document.body.appendChild(input);
    try {
      input.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS', bubbles: true }));
      await currentFixture.whenStable();

      expect(noteOffSpy).toHaveBeenCalledWith(62);
    } finally {
      document.body.removeChild(input);
    }
  });

  it('WR-08: releasing an overlapping, already-superseded keyboard key does not disturb the newer note, and the newer key still releases cleanly', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOnSpy = vi.spyOn(engine, 'noteOn');
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    // Press KeyA (60), then — while still physically held — press KeyS (62)
    // too. The engine is monophonic/last-note-priority (WR-09): the second
    // press supersedes the first.
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    await currentFixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    await currentFixture.whenStable();
    expect(noteOnSpy).toHaveBeenNthCalledWith(1, 60, expect.any(Number));
    expect(noteOnSpy).toHaveBeenNthCalledWith(2, 62, expect.any(Number));

    // Releasing the older, already-superseded key (A) is not the tracked
    // keyboardHeldCode — ownership is KeyS — so noteOff must not run for 60.
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    await currentFixture.whenStable();
    expect(noteOffSpy).not.toHaveBeenCalled();
    expect(keyByNote(compiled, 62).getAttribute('aria-pressed')).toBe('true');

    // Releasing the newer key (S) — the one the tracker actually follows —
    // must still cleanly turn its note off.
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
    await currentFixture.whenStable();
    expect(noteOffSpy).toHaveBeenCalledWith(62);
    expect(keyByNote(compiled, 62).getAttribute('aria-pressed')).toBe('false');
  });

  it('does not retain pointerHeldNote across a pre-ready pointerdown, so later pointerleave cannot noteOff a keyboard-started note', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOnSpy = vi.spyOn(engine, 'noteOn');
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    const key = keyByNote(compiled, 60);
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await currentFixture.whenStable();
    expect(noteOnSpy).not.toHaveBeenCalled();

    await enableAudio(currentFixture);

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    await currentFixture.whenStable();
    expect(noteOnSpy).toHaveBeenCalledWith(60, expect.any(Number));

    key.dispatchEvent(new Event('pointerleave'));
    await currentFixture.whenStable();
    expect(noteOffSpy).not.toHaveBeenCalled();
  });

  it('does not retrigger on an OS auto-repeat keydown (event.repeat)', async () => {
    const currentFixture = await setup();
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOnSpy = vi.spyOn(engine, 'noteOn');

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', repeat: true }));
    await currentFixture.whenStable();

    expect(noteOnSpy).not.toHaveBeenCalled();
  });

  it('does not play when a modifier key is held', async () => {
    const currentFixture = await setup();
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOnSpy = vi.spyOn(engine, 'noteOn');

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', ctrlKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', metaKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', altKey: true }));
    await currentFixture.whenStable();

    expect(noteOnSpy).not.toHaveBeenCalled();
  });

  it('does not play when the event target is an editable element', async () => {
    const currentFixture = await setup();
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOnSpy = vi.spyOn(engine, 'noteOn');

    const input = document.createElement('input');
    document.body.appendChild(input);
    try {
      input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
      await currentFixture.whenStable();

      expect(noteOnSpy).not.toHaveBeenCalled();
    } finally {
      document.body.removeChild(input);
    }
  });

  it('does not play on an unmapped code', async () => {
    const currentFixture = await setup();
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOnSpy = vi.spyOn(engine, 'noteOn');

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
    await currentFixture.whenStable();

    expect(noteOnSpy).not.toHaveBeenCalled();
  });

  it('starts and ends a note with Space on a focused key button', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOnSpy = vi.spyOn(engine, 'noteOn');
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    const key = keyByNote(compiled, 65); // F4
    key.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await currentFixture.whenStable();
    expect(noteOnSpy).toHaveBeenCalledWith(65, expect.any(Number));

    key.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    await currentFixture.whenStable();
    expect(noteOffSpy).toHaveBeenCalledWith(65);
    expect(noteOffSpy).toHaveBeenCalledTimes(1);

    // Bubbled document keyup must not double-release after the button path
    // already cleared buttonHeldNote.
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    await currentFixture.whenStable();
    expect(noteOffSpy).toHaveBeenCalledTimes(1);
  });

  it('a Space keyup delivered to a different button (Tab moved focus while held) does not release the wrong note and still ends the one actually sounding', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const noteOffSpy = vi.spyOn(engine, 'noteOff');

    // Space held down on F4 (65) starts the note; focus then moves to G4
    // (67) via Tab without a keyup ever reaching F4 — the eventual keyup
    // fires on G4 instead.
    const startingKey = keyByNote(compiled, 65);
    startingKey.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await currentFixture.whenStable();

    const focusedKey = keyByNote(compiled, 67);
    focusedKey.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    await currentFixture.whenStable();

    // The mismatched keyup must not release a note that was never started.
    expect(noteOffSpy).not.toHaveBeenCalledWith(67);

    // Document-level keyup for the activation code releases the note this
    // path actually started (the focused button's keyup never matched).
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    await currentFixture.whenStable();
    expect(noteOffSpy).toHaveBeenCalledWith(65);

    // A later keyup on the original button must not double-release.
    const noteOffCallsAfterDocument = noteOffSpy.mock.calls.length;
    startingKey.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    await currentFixture.whenStable();
    expect(noteOffSpy.mock.calls.length).toBe(noteOffCallsAfterDocument);
  });

  it('calls allNotesOff on window blur while a note is held', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const allNotesOffSpy = vi.spyOn(engine, 'allNotesOff');

    const key = keyByNote(compiled, 69); // A4
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await currentFixture.whenStable();

    window.dispatchEvent(new Event('blur'));
    await currentFixture.whenStable();

    expect(allNotesOffSpy).toHaveBeenCalled();
  });

  it('calls allNotesOff when the component is destroyed', async () => {
    const currentFixture = await setup();
    await enableAudio(currentFixture);

    const engine = TestBed.inject<SynthEngine>(SYNTH_ENGINE);
    const allNotesOffSpy = vi.spyOn(engine, 'allNotesOff');

    currentFixture.destroy();

    expect(allNotesOffSpy).toHaveBeenCalled();
  });

  it('marks exactly one key aria-pressed="true" while a note sounds, all others "false"', async () => {
    const currentFixture = await setup();
    const compiled = currentFixture.nativeElement as HTMLElement;
    await enableAudio(currentFixture);

    const key = keyByNote(compiled, 71); // B4
    key.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    await currentFixture.whenStable();

    const allKeys = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.key'));
    const pressed = allKeys.filter((candidate) => candidate.getAttribute('aria-pressed') === 'true');
    expect(pressed.length).toBe(1);
    expect(pressed[0]).toBe(key);

    for (const candidate of allKeys) {
      if (candidate !== key) {
        expect(candidate.getAttribute('aria-pressed')).toBe('false');
      }
    }
  });
});
