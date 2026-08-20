import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InstrumentState } from '../../../state/instrument-state';
import { DEFAULT_PATCH } from '../../../domain/dx7/models/patch';
import { ToolsPanel } from './tools-panel';

async function setup(): Promise<{
  fixture: ComponentFixture<ToolsPanel>;
  compiled: HTMLElement;
  state: InstrumentState;
}> {
  await TestBed.configureTestingModule({
    imports: [ToolsPanel],
  }).compileComponents();

  const state = TestBed.inject(InstrumentState);
  const fixture = TestBed.createComponent(ToolsPanel);
  await fixture.whenStable();

  return { fixture, compiled: fixture.nativeElement as HTMLElement, state };
}

/** Finds a button by its exact or prefix-matched accessible text — never by
 * position — so a layout change cannot silently retarget an assertion. */
function findButton(compiled: HTMLElement, matcher: (text: string) => boolean): HTMLButtonElement {
  const buttons = Array.from(compiled.querySelectorAll<HTMLButtonElement>('button'));
  const found = buttons.find((button) => matcher((button.textContent ?? '').trim()));
  if (!found) {
    throw new Error('no button found matching the given text predicate');
  }
  return found;
}

const captureAButton = (compiled: HTMLElement) => findButton(compiled, (text) => text === 'Capture A');
const captureBButton = (compiled: HTMLElement) => findButton(compiled, (text) => text === 'Capture B');
const recallAButton = (compiled: HTMLElement) => findButton(compiled, (text) => text.startsWith('Recall A'));
const recallBButton = (compiled: HTMLElement) => findButton(compiled, (text) => text.startsWith('Recall B'));
const resetButton = (compiled: HTMLElement) => findButton(compiled, (text) => text === 'Reset');
const randomizeButton = (compiled: HTMLElement) => findButton(compiled, (text) => text === 'Randomize');

function statusText(compiled: HTMLElement): string {
  return compiled.querySelector('[role="status"]')?.textContent?.trim() ?? '';
}

describe('ToolsPanel', () => {
  it('renders exactly six button elements and no checkbox/radio input', async () => {
    const { compiled } = await setup();

    expect(compiled.querySelectorAll('button').length).toBe(6);
    expect(compiled.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(compiled.querySelectorAll('input[type="radio"]').length).toBe(0);
  });

  it('disables both recall buttons before any capture, then enables only Recall A after Capture A', async () => {
    const { fixture, compiled } = await setup();

    expect(recallAButton(compiled).disabled).toBe(true);
    expect(recallBButton(compiled).disabled).toBe(true);

    captureAButton(compiled).click();
    await fixture.whenStable();

    expect(recallAButton(compiled).disabled).toBe(false);
    expect(recallBButton(compiled).disabled).toBe(true);
  });

  it('calls captureSnapshot with the slot exactly once per capture button', async () => {
    const { fixture, compiled, state } = await setup();
    const captureSpy = vi.spyOn(state, 'captureSnapshot');

    captureAButton(compiled).click();
    await fixture.whenStable();
    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith('a');

    captureBButton(compiled).click();
    await fixture.whenStable();
    expect(captureSpy).toHaveBeenCalledTimes(2);
    expect(captureSpy).toHaveBeenNthCalledWith(2, 'b');
  });

  it('calls recallSnapshot with the slot exactly once and restores the exact captured patch', async () => {
    const { fixture, compiled, state } = await setup();
    const recallSpy = vi.spyOn(state, 'recallSnapshot');

    const patchAtCapture = state.patch();
    captureAButton(compiled).click();
    await fixture.whenStable();

    // Change the live patch away from what was captured.
    state.setFeedback(5);
    expect(state.patch()).not.toBe(patchAtCapture);

    recallAButton(compiled).click();
    await fixture.whenStable();

    expect(recallSpy).toHaveBeenCalledTimes(1);
    expect(recallSpy).toHaveBeenCalledWith('a');
    expect(state.patch()).toBe(patchAtCapture);
  });

  it('Reset restores the default patch and leaves both slots and their recall buttons exactly as they were', async () => {
    const { fixture, compiled, state } = await setup();

    const patchAtCapture = state.patch();
    captureAButton(compiled).click();
    await fixture.whenStable();

    state.setFeedback(6);
    expect(state.patch()).not.toBe(DEFAULT_PATCH);

    resetButton(compiled).click();
    await fixture.whenStable();

    expect(state.patch()).toBe(DEFAULT_PATCH);
    expect(state.hasSnapshot('a')).toBe(true);
    expect(recallAButton(compiled).disabled).toBe(false);
    expect(recallBButton(compiled).disabled).toBe(true);

    recallAButton(compiled).click();
    await fixture.whenStable();
    expect(state.patch()).toBe(patchAtCapture);
  });

  it('calls randomize zero times across creation, activation of the five non-randomize buttons, and destruction', async () => {
    const { fixture, compiled, state } = await setup();
    const randomizeSpy = vi.spyOn(state, 'randomize');

    captureAButton(compiled).click();
    await fixture.whenStable();
    captureBButton(compiled).click();
    await fixture.whenStable();
    recallAButton(compiled).click();
    await fixture.whenStable();
    recallBButton(compiled).click();
    await fixture.whenStable();
    resetButton(compiled).click();
    await fixture.whenStable();

    expect(randomizeSpy).not.toHaveBeenCalled();

    fixture.destroy();
    expect(randomizeSpy).not.toHaveBeenCalled();
  });

  it('calls randomize exactly once when Randomize is activated', async () => {
    const { fixture, compiled, state } = await setup();
    const randomizeSpy = vi.spyOn(state, 'randomize');
    const patchBefore = state.patch();

    randomizeButton(compiled).click();
    await fixture.whenStable();

    expect(randomizeSpy).toHaveBeenCalledTimes(1);
    expect(state.patch()).not.toBe(patchBefore);
  });

  it('states each slot\'s captured-or-empty condition in words, and the wording for slot A changes after Capture A', async () => {
    const { fixture, compiled } = await setup();

    expect(compiled.textContent).toContain('Slot A: empty.');
    expect(compiled.textContent).toContain('Slot B: empty.');

    captureAButton(compiled).click();
    await fixture.whenStable();

    expect(compiled.textContent).toContain('Slot A: captured.');
    expect(compiled.textContent).toContain('Slot B: empty.');
  });

  it('changes the status region text to a distinct message after each of the six activations', async () => {
    const { fixture, compiled } = await setup();
    const seen = new Set<string>();

    captureAButton(compiled).click();
    await fixture.whenStable();
    const afterCaptureA = statusText(compiled);
    expect(afterCaptureA).toContain('slot A');
    seen.add(afterCaptureA);

    captureBButton(compiled).click();
    await fixture.whenStable();
    const afterCaptureB = statusText(compiled);
    expect(afterCaptureB).toContain('slot B');
    seen.add(afterCaptureB);

    recallAButton(compiled).click();
    await fixture.whenStable();
    const afterRecallA = statusText(compiled);
    expect(afterRecallA.toLowerCase()).toContain('recalled slot a');
    seen.add(afterRecallA);

    recallBButton(compiled).click();
    await fixture.whenStable();
    const afterRecallB = statusText(compiled);
    expect(afterRecallB.toLowerCase()).toContain('recalled slot b');
    seen.add(afterRecallB);

    resetButton(compiled).click();
    await fixture.whenStable();
    const afterReset = statusText(compiled);
    expect(afterReset.toLowerCase()).toContain('reset');
    seen.add(afterReset);

    randomizeButton(compiled).click();
    await fixture.whenStable();
    const afterRandomize = statusText(compiled);
    expect(afterRandomize.toLowerCase()).toContain('randomized');
    seen.add(afterRandomize);

    expect(seen.size).toBe(6);
  });
});
