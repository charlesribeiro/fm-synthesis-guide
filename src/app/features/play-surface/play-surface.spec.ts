import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AUDIO_CONTEXT_CTOR } from '../../core/audio/audio-context.token';
import { AUDIO_WORKLET_NODE_CTOR } from '../../core/audio/audio-worklet-node.token';
import { FakeAudioContext } from '../../core/audio/testing/fake-audio-context';
import { FakeAudioWorkletContext, FakeAudioWorkletNode } from '../../core/audio/testing/fake-audio-worklet-node';
import { PlaySurface } from './play-surface';

// D-01 (Phase 8): SYNTH_ENGINE now resolves WorkletSynthEngine, which needs
// both an AudioContext-like constructor AND an AudioWorkletNode-like
// constructor to leave 'unavailable' — mirrors `playground.spec.ts`'s fakes.
async function setup(): Promise<ComponentFixture<PlaySurface>> {
  FakeAudioContext.instances.length = 0;
  FakeAudioWorkletNode.instances.length = 0;
  await TestBed.configureTestingModule({
    imports: [PlaySurface],
    providers: [
      { provide: AUDIO_CONTEXT_CTOR, useValue: FakeAudioWorkletContext },
      { provide: AUDIO_WORKLET_NODE_CTOR, useValue: FakeAudioWorkletNode },
    ],
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
    expect(firstKey!.disabled).toBe(false);
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
