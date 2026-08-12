/**
 * Standalone dev-only listening harness (Phase 7, D-06/D-07 from
 * `07-CONTEXT.md`) — proves the actual built worklet bundle
 * (`public/worklets/dx7-worklet-processor.js`) loads and renders correctly
 * in a real browser, which no Vitest/jsdom test can reach: jsdom implements
 * no Web Audio API and no `AudioWorkletGlobalScope` at all.
 *
 * Deliberately NOT an Angular file — no Angular-framework import of any
 * kind, and no import of `WorkletSynthEngine` (an injectable Angular
 * service, which would drag the framework runtime into this standalone
 * bundle and breach D-01's isolation). Every payload this harness posts is
 * built through the same shared message contract (`worklet-messages.ts`)
 * 07-02's engine posts against, so a human's ears cannot drift from what
 * the engine would send.
 *
 * The module URL below is a deliberate literal duplicate of
 * `src/app/core/audio/audio-worklet-node.token.ts`'s
 * `DEFAULT_WORKLET_MODULE_URL` — importing that file would also import the
 * Angular framework (it declares an injection token), which is exactly the
 * framework-free constraint this harness must hold (see the module-count
 * check in `07-03-PLAN.md`'s acceptance criteria). If the served path ever
 * moves, both constants must be updated together.
 */
import {
  DX7_OPERATOR_PROCESSOR_NAME,
  setFrequencyMessage,
  setModeMessage,
  type WorkletRenderMode,
} from '../../src/app/domain/dx7/dsp/worklet-messages';
import {
  MASTER_GAIN,
  midiNoteToFrequency,
  velocityToAmplitude,
} from '../../src/app/domain/dx7/audio/value-conversion';

/** Mirrors `audio-worklet-node.token.ts`'s `DEFAULT_WORKLET_MODULE_URL` — see file header. */
const WORKLET_MODULE_URL = '/worklets/dx7-worklet-processor.js';

/** Concert A (MIDI 69) — a comfortable single-operator proof note. */
const SINGLE_CASE_MIDI_NOTE = 69;
/** A3 (MIDI 57) — keeps the additive fixture's six-harmonic stack
 * (220Hz base x 1..6) sitting in a comfortable range. */
const ADDITIVE_CASE_MIDI_NOTE = 57;
/** A fixed, representative mid velocity — this harness has no keyboard, so
 * one value stands in for `value-conversion.ts`'s velocity curve. */
const FIXED_VELOCITY = 100;

/** Click-prevention attack ramp — mirrors `worklet-synth-engine.ts`'s
 * `WORKLET_ATTACK_SECONDS`, duplicated rather than imported for the same
 * D-01 framework-isolation reason as the module URL above. */
const ATTACK_SECONDS = 0.015;
const RELEASE_TIME_CONSTANT = 0.015;
const RELEASE_TIME_CONSTANT_COUNT = 5;
const RELEASE_SECONDS = RELEASE_TIME_CONSTANT * RELEASE_TIME_CONSTANT_COUNT;

interface HarnessElements {
  readonly enableButton: HTMLButtonElement;
  readonly playSingleButton: HTMLButtonElement;
  readonly playAdditiveButton: HTMLButtonElement;
  readonly stopButton: HTMLButtonElement;
  readonly status: HTMLElement;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`dev harness page is missing #${id}`);
  }
  return element as T;
}

function getElements(): HarnessElements {
  return {
    enableButton: requireElement<HTMLButtonElement>('enable-button'),
    playSingleButton: requireElement<HTMLButtonElement>('play-single-button'),
    playAdditiveButton: requireElement<HTMLButtonElement>('play-additive-button'),
    stopButton: requireElement<HTMLButtonElement>('stop-button'),
    status: requireElement<HTMLElement>('status'),
  };
}

/**
 * Holds no module-level `AudioContext` — one is constructed only inside
 * {@link Harness.enable}, and only ever from that button's click handler
 * (CLAUDE.md: "resume/start audio only after explicit user gesture").
 */
class Harness {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private masterGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private lastMessage = 'none';
  private enabling = false;

  constructor(private readonly elements: HarnessElements) {}

  private report(note: string): void {
    const stateText = this.context === null ? 'no context' : this.context.state;
    const moduleText = this.node === null ? 'not loaded' : WORKLET_MODULE_URL;
    this.elements.status.textContent = `context: ${stateText} | module: ${moduleText} | last message: ${this.lastMessage} | ${note}`;
  }

  async enable(): Promise<void> {
    if (this.enabling || this.context !== null) {
      this.report('enable ignored: already enabled or in progress');
      return;
    }

    this.enabling = true;
    let context: AudioContext | null = null;
    let node: AudioWorkletNode | null = null;
    let masterGain: GainNode | null = null;
    let voiceGain: GainNode | null = null;

    try {
      context = new AudioContext();
      await context.resume();
      await context.audioWorklet.addModule(WORKLET_MODULE_URL);

      node = new AudioWorkletNode(context, DX7_OPERATOR_PROCESSOR_NAME, {
        outputChannelCount: [1],
      });

      masterGain = context.createGain();
      voiceGain = context.createGain();
      const now = context.currentTime;
      // Same safety clamp Phase 5 proved safe (05-UAT.md), applied before the
      // destination — the additive six-carrier worst case cannot bypass it.
      masterGain.gain.setValueAtTime(MASTER_GAIN, now);
      voiceGain.gain.setValueAtTime(0, now);

      node.connect(voiceGain);
      voiceGain.connect(masterGain);
      masterGain.connect(context.destination);

      this.context = context;
      this.node = node;
      this.masterGain = masterGain;
      this.voiceGain = voiceGain;

      this.report('enabled');
    } catch (error) {
      try {
        node?.disconnect();
      } catch {
        // Best-effort teardown of a failed enable attempt.
      }
      try {
        voiceGain?.disconnect();
      } catch {
        // Best-effort teardown of a failed enable attempt.
      }
      try {
        masterGain?.disconnect();
      } catch {
        // Best-effort teardown of a failed enable attempt.
      }
      if (context !== null) {
        void context.close();
      }
      if (this.context === context) {
        this.context = null;
      }
      if (this.node === node) {
        this.node = null;
      }
      if (this.masterGain === masterGain) {
        this.masterGain = null;
      }
      if (this.voiceGain === voiceGain) {
        this.voiceGain = null;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.report(`enable failed: ${message}`);
      // A silent failure here would waste the human checkpoint's time.
      // eslint-disable-next-line no-console -- dev-only harness diagnostics, never shipped
      console.error('[dx7-harness] enable failed', error);
    } finally {
      this.enabling = false;
    }
  }

  private play(mode: WorkletRenderMode, midiNote: number): void {
    if (this.context === null || this.node === null || this.voiceGain === null) {
      this.report('play ignored: click "Enable audio" first');
      return;
    }

    this.node.port.postMessage(setModeMessage(mode));

    const frequencyMessage = setFrequencyMessage(midiNoteToFrequency(midiNote));
    this.node.port.postMessage(frequencyMessage);
    this.lastMessage = JSON.stringify(frequencyMessage);

    const now = this.context.currentTime;
    const targetLevel = velocityToAmplitude(FIXED_VELOCITY);
    // Scheduled automation only, never a direct gain assignment (CLAUDE.md:
    // "smooth gain changes to avoid clicks").
    this.voiceGain.gain.cancelAndHoldAtTime(now);
    this.voiceGain.gain.linearRampToValueAtTime(targetLevel, now + ATTACK_SECONDS);

    this.report(`playing ${mode}`);
  }

  playSingle(): void {
    this.play('single', SINGLE_CASE_MIDI_NOTE);
  }

  playAdditive(): void {
    this.play('additive', ADDITIVE_CASE_MIDI_NOTE);
  }

  stop(): void {
    if (this.context === null || this.voiceGain === null) {
      this.report('stop ignored: click "Enable audio" first');
      return;
    }
    const now = this.context.currentTime;
    this.voiceGain.gain.cancelAndHoldAtTime(now);
    this.voiceGain.gain.setTargetAtTime(0, now, RELEASE_TIME_CONSTANT);
    this.voiceGain.gain.setValueAtTime(0, now + RELEASE_SECONDS);
    this.report('stopped');
  }
}

function main(): void {
  const elements = getElements();
  const harness = new Harness(elements);

  elements.enableButton.addEventListener('click', () => {
    void harness.enable();
  });
  elements.playSingleButton.addEventListener('click', () => harness.playSingle());
  elements.playAdditiveButton.addEventListener('click', () => harness.playAdditive());
  elements.stopButton.addEventListener('click', () => harness.stop());
}

main();
