/**
 * Standalone dev-only listening harness (Phase 7, D-06/D-07 from
 * `07-CONTEXT.md`) — proves the actual built worklet bundle
 * (`public/worklets/dx7-worklet-processor.js`) loads and renders correctly
 * in a real browser, which no Vitest/jsdom test can reach: jsdom implements
 * no Web Audio API and no `AudioWorkletGlobalScope` at all.
 *
 * Extended in Phase 8 (D-12) with algorithm selection and feedback-depth
 * controls over the same `'routed'` render mode the live app uses, so the
 * blocking checkpoint can sample one algorithm per teaching-taxonomy group
 * plus maximum feedback depth.
 *
 * Extended in Phase 9 (ENGINE-03, plan 09-04): the routed play path now
 * posts a `setGate` message — same shape, same order (frequency, then gate)
 * `WorkletSynthEngine.noteOn` posts — so the kernel's six per-operator
 * envelope generators actually shape the note a human hears through this
 * page. On that path `voiceGain` (below) is held at unity rather than
 * ramped: the kernel now owns amplitude entirely, and stacking the
 * harness's own ramp on top of it would leave a listener judging this
 * file's click-safety instead of the kernel's release segment — exactly the
 * property this phase's checkpoint exists to approve. The single-operator
 * and additive proof paths are unchanged: neither runs through the router,
 * neither has envelopes, and `voiceGain`'s ramp is still the only thing
 * shaping their amplitude. An envelope-preset `<select>` lets a listener
 * compare named envelope shapes on the routed path against exactly one
 * variable at a time (see `ENVELOPE_PRESETS` below).
 *
 * Deliberately NOT an Angular file — no Angular-framework import of any
 * kind, and no import of `WorkletSynthEngine` (an injectable Angular
 * service, which would drag the framework runtime into this standalone
 * bundle and breach D-01's isolation). Every payload this harness posts is
 * built through the same shared message contract (`worklet-messages.ts`)
 * 07-02's engine posts against, and the routed-mode payloads are built
 * through the same `buildRoutingConfig` translation `graph-router.ts`
 * exposes, so a human's ears cannot drift from what the live engine would
 * send. `algorithms.ts`, `graph-router.ts`, `operator-parameters.ts`,
 * `derive-role.ts`, and `patch.ts` are all pure domain modules under the
 * DOMAIN-04 gate — none of them imports Angular, directly or transitively.
 *
 * The module URL below is a deliberate literal duplicate of
 * `src/app/core/audio/audio-worklet-node.token.ts`'s
 * `DEFAULT_WORKLET_MODULE_URL` — importing that file would also import the
 * Angular framework (it declares an injection token), which is exactly the
 * framework-free constraint this harness must hold (see the module-count
 * check in `07-03-PLAN.md`'s acceptance criteria). If the served path ever
 * moves, both constants must be updated together.
 */
import { ALGORITHMS } from '../../src/app/domain/dx7/models/algorithms';
import type { AlgorithmDefinition } from '../../src/app/domain/dx7/models/algorithm-definition';
import type { TeachingTag } from '../../src/app/domain/dx7/models/algorithm-definition';
import { deriveCarriers } from '../../src/app/domain/dx7/models/derive-role';
import {
  DEFAULT_ENVELOPE,
  MAX_OUTPUT_LEVEL,
  type Dx7Envelope,
} from '../../src/app/domain/dx7/models/operator-parameters';
import { OPERATOR_IDS, type OperatorId } from '../../src/app/domain/dx7/models/operator';
import { DEFAULT_PATCH, type OperatorParameterSet } from '../../src/app/domain/dx7/models/patch';
import { buildRoutingConfig } from '../../src/app/domain/dx7/dsp/graph-router';
import {
  DX7_OPERATOR_PROCESSOR_NAME,
  setAlgorithmMessage,
  setFeedbackMessage,
  setFrequencyMessage,
  setGateMessage,
  setModeMessage,
  setOperatorParametersMessage,
  type WorkletRenderMode,
} from '../../src/app/domain/dx7/dsp/worklet-messages';
import {
  MASTER_GAIN,
  MIN_VELOCITY,
  midiNoteToFrequency,
  velocityToAmplitude,
} from '../../src/app/domain/dx7/audio/value-conversion';
import { cancelAndHoldOrPin } from '../../src/app/core/audio/cancel-and-hold-or-pin';

/** Mirrors `audio-worklet-node.token.ts`'s `DEFAULT_WORKLET_MODULE_URL` — see file header. */
const WORKLET_MODULE_URL = '/worklets/dx7-worklet-processor.js';

/** Concert A (MIDI 69) — a comfortable single-operator proof note. */
const SINGLE_CASE_MIDI_NOTE = 69;
/** A3 (MIDI 57) — keeps the additive fixture's six-harmonic stack
 * (220Hz base x 1..6) sitting in a comfortable range. */
const ADDITIVE_CASE_MIDI_NOTE = 57;
/** Same comfortable single-note pitch as the Phase 7 single-operator proof
 * case — routed playback has no keyboard either, so one fixed note stands
 * in for every algorithm the checkpoint samples. */
const ROUTED_CASE_MIDI_NOTE = SINGLE_CASE_MIDI_NOTE;
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

/** Human-readable labels for D-10's four-group teaching taxonomy — shown in
 * each `<option>`'s text so the checkpoint's four taxonomy-group checks are
 * directly selectable rather than requiring the human to remember id
 * ranges. */
const TAXONOMY_GROUP_LABELS: Readonly<Record<TeachingTag, string>> = {
  'additive-stacks': 'Additive Stacks',
  'tree-branch': 'Tree/Branch',
  rooting: 'Rooting',
  parallel: 'Parallel',
};

function taxonomyGroupLabel(algorithm: AlgorithmDefinition): string {
  const tag = algorithm.teachingTags[0];
  return tag === undefined ? 'unlabelled' : TAXONOMY_GROUP_LABELS[tag];
}

/**
 * Named envelope shapes a listener can pick between on the routed path
 * (Phase 9, plan 09-04) — data at module scope, never assembled inline in a
 * change handler. Every shape's release-segment level (`levels[3]`) is
 * zero, matching the shipped-data invariant plan 09-03 asserts. Only the
 * `'carrier-sustain-modulator-decay'` shape's `envelopeForOperator` differs
 * per operator; the other three return the same {@link Dx7Envelope} for
 * every operator id.
 */
interface EnvelopePreset {
  readonly id: string;
  readonly label: string;
  readonly envelopeForOperator: (operatorId: OperatorId, algorithm: AlgorithmDefinition) => Dx7Envelope;
}

/** A long, unmistakable attack (rate 20 — roughly a 1.25s full-scale rise,
 * derived from `envelopeRateToLevelUnitsPerSample`'s geometric curve) into
 * the shipped default's sustain and release, so exactly the attack segment
 * differs from the default preset (check 3). */
const SLOW_SWELL_ENVELOPE: Dx7Envelope = Object.freeze({
  rates: Object.freeze([20, 74, 74, 55] as const),
  levels: Object.freeze([99, 99, 99, 0] as const),
});

/** A near-instant attack (rate 99, the fastest full-scale segment) falling
 * sharply to a low sustain plateau (level 35) and staying there for as long
 * as the note is held, then releasing at the same rate the shipped default
 * uses (check 4's "stays there" plateau). */
const PERCUSSIVE_ENVELOPE: Dx7Envelope = Object.freeze({
  rates: Object.freeze([99, 85, 85, 55] as const),
  levels: Object.freeze([99, 35, 35, 0] as const),
});

/** The decaying half of the carrier-sustains/modulator-decays pair —
 * mirrors `lessons.ts`'s `ALGORITHM_1_MODULATOR_ENVELOPE` shape (attack
 * slightly faster than the default's 74, decays through a middle level,
 * settles well under half the attack peak) so a held note opens bright and
 * audibly mellows while the derived carriers hold steady (check 5, D-01). */
const MODULATOR_DECAY_ENVELOPE: Dx7Envelope = Object.freeze({
  rates: Object.freeze([80, 16, 16, 55] as const),
  levels: Object.freeze([99, 70, 40, 0] as const),
});

const ENVELOPE_PRESETS: readonly EnvelopePreset[] = Object.freeze([
  {
    id: 'default',
    label: 'Default (shipped)',
    envelopeForOperator: () => DEFAULT_ENVELOPE,
  },
  {
    id: 'slow-swell',
    label: 'Slow swell',
    envelopeForOperator: () => SLOW_SWELL_ENVELOPE,
  },
  {
    id: 'percussive',
    label: 'Percussive decay',
    envelopeForOperator: () => PERCUSSIVE_ENVELOPE,
  },
  {
    id: 'carrier-sustain-modulator-decay',
    label: 'Carrier sustains / modulator decays',
    envelopeForOperator: (operatorId: OperatorId, algorithm: AlgorithmDefinition) =>
      deriveCarriers(algorithm).includes(operatorId) ? DEFAULT_ENVELOPE : MODULATOR_DECAY_ENVELOPE,
  },
]);

const DEFAULT_ENVELOPE_PRESET_ID = ENVELOPE_PRESETS[0]!.id;

function findEnvelopePreset(id: string): EnvelopePreset {
  const preset = ENVELOPE_PRESETS.find((candidate) => candidate.id === id);
  if (preset === undefined) {
    throw new Error(`dev harness envelope preset select carries an unknown id: ${id}`);
  }
  return preset;
}

/** Populates the envelope-preset `<select>` from {@link ENVELOPE_PRESETS} —
 * the same never-hand-write-the-option-list convention
 * `populateAlgorithmSelect` already follows for the algorithm dataset. */
function populateEnvelopePresetSelect(select: HTMLSelectElement): void {
  for (const preset of ENVELOPE_PRESETS) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.label;
    select.appendChild(option);
  }
  select.value = DEFAULT_ENVELOPE_PRESET_ID;
}

/** Builds a full six-operator parameter set for the routed path: every
 * operator's parameters are spread from `DEFAULT_PATCH.operators` (only
 * `outputLevel` — when `useMaxLevel` is set, check 8's worst-case loudness
 * step — and `envelope` are ever overridden), so no other field drifts
 * between presets and a listener is comparing exactly one variable. */
function buildOperatorParameters(
  preset: EnvelopePreset,
  algorithm: AlgorithmDefinition,
  useMaxLevel: boolean,
): OperatorParameterSet {
  const entries = OPERATOR_IDS.map((id) => {
    const base = DEFAULT_PATCH.operators[id];
    return [
      id,
      {
        ...base,
        outputLevel: useMaxLevel ? MAX_OUTPUT_LEVEL : base.outputLevel,
        envelope: preset.envelopeForOperator(id, algorithm),
      },
    ] as const;
  });
  return Object.freeze(Object.fromEntries(entries)) as OperatorParameterSet;
}

interface HarnessElements {
  readonly enableButton: HTMLButtonElement;
  readonly playSingleButton: HTMLButtonElement;
  readonly playAdditiveButton: HTMLButtonElement;
  readonly playRoutedButton: HTMLButtonElement;
  readonly stopButton: HTMLButtonElement;
  readonly algorithmSelect: HTMLSelectElement;
  readonly feedbackSlider: HTMLInputElement;
  readonly feedbackReadout: HTMLOutputElement;
  readonly maxLevelCheckbox: HTMLInputElement;
  readonly envelopePresetSelect: HTMLSelectElement;
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
    playRoutedButton: requireElement<HTMLButtonElement>('play-routed-button'),
    stopButton: requireElement<HTMLButtonElement>('stop-button'),
    algorithmSelect: requireElement<HTMLSelectElement>('algorithm-select'),
    feedbackSlider: requireElement<HTMLInputElement>('feedback-slider'),
    feedbackReadout: requireElement<HTMLOutputElement>('feedback-readout'),
    maxLevelCheckbox: requireElement<HTMLInputElement>('max-level-checkbox'),
    envelopePresetSelect: requireElement<HTMLSelectElement>('envelope-preset-select'),
    status: requireElement<HTMLElement>('status'),
  };
}

/** Populates the algorithm `<select>` from `ALGORITHMS` (never a hardcoded
 * list) so the dataset stays the single source of truth (CLAUDE.md's
 * one-canonical-dataset rule) — each option's text carries the id, name,
 * and taxonomy group label the checkpoint's four group checks need. */
function populateAlgorithmSelect(select: HTMLSelectElement): void {
  for (const algorithm of ALGORITHMS) {
    const option = document.createElement('option');
    option.value = String(algorithm.id);
    option.textContent = `${algorithm.id} — ${algorithm.name} (${taxonomyGroupLabel(algorithm)})`;
    select.appendChild(option);
  }
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
  /** True only while a routed-mode note is currently sounding — gates the
   * live re-patch handlers (D-13's harness-side equivalent) so an
   * algorithm/feedback change posts a message only when there is an actual
   * held note to re-patch. */
  private routedNoteActive = false;
  /** Distinguishes oscillator (single/additive) voiceGain ramps from the
   * routed path so Play routed can silence the prior mode before restoring
   * unity — not a same-instant cross-mode step. */
  private lastVoiceMode: 'idle' | 'oscillator' | 'routed' = 'idle';

  constructor(private readonly elements: HarnessElements) {}

  private report(note: string): void {
    const stateText = this.context === null ? 'no context' : this.context.state;
    const moduleText = this.node === null ? 'not loaded' : WORKLET_MODULE_URL;
    this.elements.status.textContent = `context: ${stateText} | module: ${moduleText} | last message: ${this.lastMessage} | ${note}`;
  }

  async enable(): Promise<void> {
    if (this.enabling) {
      this.report('enable ignored: already in progress');
      return;
    }
    if (this.context !== null) {
      this.dispose();
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

  /** Disconnects the worklet node and gain stages, then closes the context.
   * Graph teardown only — Stop keeps its scheduled release. */
  dispose(): void {
    try {
      this.node?.disconnect();
    } catch {
      // Best-effort teardown.
    }
    try {
      this.voiceGain?.disconnect();
    } catch {
      // Best-effort teardown.
    }
    try {
      this.masterGain?.disconnect();
    } catch {
      // Best-effort teardown.
    }
    if (this.context !== null) {
      void this.context.close();
    }
    this.context = null;
    this.node = null;
    this.masterGain = null;
    this.voiceGain = null;
    this.routedNoteActive = false;
    this.lastVoiceMode = 'idle';
  }

  private play(mode: WorkletRenderMode, midiNote: number): void {
    if (this.context === null || this.node === null || this.voiceGain === null) {
      this.report('play ignored: click "Enable audio" first');
      return;
    }

    if (this.routedNoteActive) {
      this.node.port.postMessage(setGateMessage(false, MIN_VELOCITY));
    }
    this.routedNoteActive = false;
    this.node.port.postMessage(setModeMessage(mode));

    const frequencyMessage = setFrequencyMessage(midiNoteToFrequency(midiNote));
    this.node.port.postMessage(frequencyMessage);
    this.lastMessage = JSON.stringify(frequencyMessage);

    const now = this.context.currentTime;
    const targetLevel = velocityToAmplitude(FIXED_VELOCITY);
    // Scheduled automation only, never a direct gain assignment (CLAUDE.md:
    // "smooth gain changes to avoid clicks").
    cancelAndHoldOrPin(this.voiceGain.gain, now);
    this.voiceGain.gain.linearRampToValueAtTime(targetLevel, now + ATTACK_SECONDS);

    this.lastVoiceMode = 'oscillator';
    this.report(`playing ${mode}`);
  }

  playSingle(): void {
    this.play('single', SINGLE_CASE_MIDI_NOTE);
  }

  playAdditive(): void {
    this.play('additive', ADDITIVE_CASE_MIDI_NOTE);
  }

  private selectedAlgorithm(): AlgorithmDefinition {
    const id = Number(this.elements.algorithmSelect.value);
    const algorithm = ALGORITHMS.find((candidate) => candidate.id === id);
    if (algorithm === undefined) {
      throw new Error(`dev harness algorithm select carries an unknown id: ${id}`);
    }
    return algorithm;
  }

  private selectedFeedbackLevel(): number {
    return Number(this.elements.feedbackSlider.value);
  }

  private selectedEnvelopePreset(): EnvelopePreset {
    return findEnvelopePreset(this.elements.envelopePresetSelect.value);
  }

  private selectedOperatorParameters(algorithm: AlgorithmDefinition): OperatorParameterSet {
    return buildOperatorParameters(this.selectedEnvelopePreset(), algorithm, this.elements.maxLevelCheckbox.checked);
  }

  playRouted(): void {
    void this.startRoutedPlayback();
  }

  /**
   * Plays the currently selected algorithm through the exact same message
   * sequence — routed mode, routing config, operator parameters, feedback,
   * note frequency, then an open gate — `WorkletSynthEngine.noteOn` posts
   * (frequency first, then gate), so what the human hears cannot drift from
   * what the live app sends (D-12, and Phase 9's gate wiring). `voiceGain`
   * is held at unity rather than ramped on this path: the kernel's six
   * per-operator envelope generators are the only amplitude shaping a
   * listener hears here (see this file's header comment).
   *
   * A prior single/additive render is silenced and released first; unity is
   * restored only after that transition completes — never a same-instant
   * `setValueAtTime(1, now)` while the previous mode is still sounding, and
   * never an `ATTACK_SECONDS` ramp on this path.
   */
  private async startRoutedPlayback(): Promise<void> {
    if (this.context === null || this.node === null || this.voiceGain === null) {
      this.report('play ignored: click "Enable audio" first');
      return;
    }

    if (this.lastVoiceMode === 'oscillator') {
      const now = this.context.currentTime;
      cancelAndHoldOrPin(this.voiceGain.gain, now);
      this.voiceGain.gain.setTargetAtTime(0, now, RELEASE_TIME_CONSTANT);
      this.voiceGain.gain.setValueAtTime(0, now + RELEASE_SECONDS);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, RELEASE_SECONDS * 1000);
      });
      if (this.context === null || this.node === null || this.voiceGain === null) {
        return;
      }
      this.voiceGain.gain.setValueAtTime(1, this.context.currentTime);
    } else if (this.lastVoiceMode === 'idle') {
      this.voiceGain.gain.setValueAtTime(1, this.context.currentTime);
    }

    const algorithm = this.selectedAlgorithm();
    const routingConfig = buildRoutingConfig(algorithm);
    const operators = this.selectedOperatorParameters(algorithm);
    const feedbackLevel = this.selectedFeedbackLevel();

    this.node.port.postMessage(setModeMessage('routed'));
    this.node.port.postMessage(setAlgorithmMessage(routingConfig.connections, routingConfig.carriers));
    this.node.port.postMessage(setOperatorParametersMessage(operators));
    this.node.port.postMessage(setFeedbackMessage(feedbackLevel));

    const frequencyMessage = setFrequencyMessage(midiNoteToFrequency(ROUTED_CASE_MIDI_NOTE));
    this.node.port.postMessage(frequencyMessage);

    const gateMessage = setGateMessage(true, FIXED_VELOCITY);
    this.node.port.postMessage(gateMessage);
    this.lastMessage = JSON.stringify(gateMessage);

    this.routedNoteActive = true;
    this.lastVoiceMode = 'routed';
    this.report(`playing routed algorithm ${algorithm.id}, envelope preset ${this.selectedEnvelopePreset().label}`);
  }

  /** Re-patches a currently-sounding routed note onto the newly selected
   * algorithm without stopping it — the harness-side equivalent of D-13's
   * live re-patch, and the only way the checkpoint's held-note switch check
   * can be exercised from this page. Also re-posts operator parameters: the
   * carrier-sustains/modulator-decays preset derives its carrier set from
   * the selected algorithm (`deriveCarriers`), so an algorithm change must
   * refresh that split too or the note keeps sounding the previous
   * algorithm's carrier/modulator assignment. A no-op when no routed note is
   * currently sounding. */
  onAlgorithmChanged(): void {
    if (!this.routedNoteActive || this.node === null) {
      return;
    }
    const algorithm = this.selectedAlgorithm();
    const routingConfig = buildRoutingConfig(algorithm);
    this.node.port.postMessage(setAlgorithmMessage(routingConfig.connections, routingConfig.carriers));
    const operators = this.selectedOperatorParameters(algorithm);
    this.node.port.postMessage(setOperatorParametersMessage(operators));
    this.report(`re-patched to algorithm ${algorithm.id}`);
  }

  /** Re-posts only the feedback message when the slider changes during a
   * held routed note — a no-op when nothing is currently sounding. */
  onFeedbackChanged(): void {
    this.elements.feedbackReadout.textContent = this.elements.feedbackSlider.value;
    if (!this.routedNoteActive || this.node === null) {
      return;
    }
    const feedbackLevel = this.selectedFeedbackLevel();
    this.node.port.postMessage(setFeedbackMessage(feedbackLevel));
    this.report(`feedback set to ${feedbackLevel}`);
  }

  /** Re-posts the operator-parameters message immediately when the envelope
   * preset changes during a held routed note, without stopping the note —
   * this is how a listener hears a live re-patch that does not restart the
   * envelopes (checkpoint check 7). A no-op when nothing is currently
   * sounding. */
  onEnvelopePresetChanged(): void {
    if (!this.routedNoteActive || this.node === null) {
      return;
    }
    const preset = this.selectedEnvelopePreset();
    const algorithm = this.selectedAlgorithm();
    const operators = this.selectedOperatorParameters(algorithm);
    this.node.port.postMessage(setOperatorParametersMessage(operators));
    this.report(`envelope preset set to ${preset.label}`);
  }

  stop(): void {
    if (this.context === null || this.node === null || this.voiceGain === null) {
      this.report('stop ignored: click "Enable audio" first');
      return;
    }
    const now = this.context.currentTime;
    if (this.routedNoteActive) {
      // The kernel's own per-operator envelope release segments own
      // amplitude entirely on the routed path (Phase 9, D-02) — ramping
      // `voiceGain` down here too would double-envelope exactly the release
      // shape this checkpoint exists to judge, so only the gate message is
      // posted; `voiceGain` stays at the unity level `playRouted` set.
      const gateMessage = setGateMessage(false, MIN_VELOCITY);
      this.node.port.postMessage(gateMessage);
      this.lastMessage = JSON.stringify(gateMessage);
      this.lastVoiceMode = 'idle';
    } else {
      cancelAndHoldOrPin(this.voiceGain.gain, now);
      this.voiceGain.gain.setTargetAtTime(0, now, RELEASE_TIME_CONSTANT);
      this.voiceGain.gain.setValueAtTime(0, now + RELEASE_SECONDS);
    }
    this.routedNoteActive = false;
    this.report('stopped');
  }
}

function main(): void {
  const elements = getElements();
  populateAlgorithmSelect(elements.algorithmSelect);
  populateEnvelopePresetSelect(elements.envelopePresetSelect);
  const harness = new Harness(elements);

  elements.enableButton.addEventListener('click', () => {
    void harness.enable();
  });
  elements.playSingleButton.addEventListener('click', () => harness.playSingle());
  elements.playAdditiveButton.addEventListener('click', () => harness.playAdditive());
  elements.playRoutedButton.addEventListener('click', () => harness.playRouted());
  elements.stopButton.addEventListener('click', () => harness.stop());
  elements.algorithmSelect.addEventListener('change', () => harness.onAlgorithmChanged());
  elements.feedbackSlider.addEventListener('input', () => harness.onFeedbackChanged());
  elements.envelopePresetSelect.addEventListener('change', () => harness.onEnvelopePresetChanged());
  window.addEventListener('pagehide', () => harness.dispose());
}

main();
