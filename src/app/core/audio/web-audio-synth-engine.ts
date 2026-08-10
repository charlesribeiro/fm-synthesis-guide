import { DestroyRef, Injectable, Signal, effect, inject, signal } from '@angular/core';
import type { AlgorithmId } from '../../domain/dx7/models/algorithm';
import type { AlgorithmDefinition } from '../../domain/dx7/models/algorithm-definition';
import { deriveCarriers } from '../../domain/dx7/models/derive-role';
import { OPERATOR_IDS, type OperatorId } from '../../domain/dx7/models/operator';
import type { OperatorParameterSet } from '../../domain/dx7/models/patch';
import { planConnections } from '../../domain/dx7/audio/patch-plan';
import {
  A4_FREQUENCY_HZ,
  MASTER_GAIN,
  MAX_MIDI_NOTE,
  MAX_VELOCITY,
  MIN_MIDI_NOTE,
  MIN_VELOCITY,
  feedbackLevelToDepthHz,
  midiNoteToFrequency,
  operatorFrequencyHz,
  outputLevelToAmplitude,
  outputLevelToModulationDepthHz,
  velocityToAmplitude,
} from '../../domain/dx7/audio/value-conversion';
import { InstrumentState } from '../../state/instrument-state';
import {
  AUDIO_CONTEXT_CTOR,
  type AudioContextConstructorLike,
  type AudioContextLike,
  type AudioParamLike,
  type DelayNodeLike,
  type GainNodeLike,
  type OscillatorNodeLike,
} from './audio-context.token';
import type { AudioEngineStatus, SynthEngine } from './synth-engine';

/** Click-prevention attack ramp length (`05-RESEARCH.md` Assumptions Log A2). */
export const ATTACK_SECONDS = 0.015;

/** Exponential-decay release time constant — perceived as smooth, click-free release. */
export const RELEASE_TIME_CONSTANT = 0.015;

/** Five time constants is what the ear hears as "fully decayed"; the terminating
 * `setValueAtTime(0, ...)` anchor at this point is what makes release exact
 * and assertable rather than asymptotic. */
const RELEASE_TIME_CONSTANT_COUNT = 5;
export const RELEASE_SECONDS = RELEASE_TIME_CONSTANT * RELEASE_TIME_CONSTANT_COUNT;

/** D-04 cut-and-restart retrigger: how long the held note's gain is cut
 * toward zero before the new note's frequency/level take over. */
export const RETRIGGER_CUT_SECONDS = 0.015;

/**
 * Web Audio forbids a zero-delay cycle — a direct oscillator-to-own-
 * frequency self-loop throws `NotSupportedError` (`05-RESEARCH.md` Pattern
 * 4, Pitfall 1). One render quantum is the smallest legal delay that closes
 * a feedback self-loop; expressed as a frame count, not a literal seconds
 * value, so it scales with whatever sample rate the real `AudioContext`
 * reports.
 */
const FEEDBACK_DELAY_RENDER_QUANTUM_FRAMES = 128;

function computeFeedbackDelaySeconds(sampleRate: number): number {
  return FEEDBACK_DELAY_RENDER_QUANTUM_FRAMES / sampleRate;
}

/** Short "live re-patch" ramp length for the routing gain nodes (WR-02) —
 * long enough to avoid an audible step/click, short enough to feel
 * instantaneous for a UI-driven algorithm/level/feedback change. Mirrors
 * the click-prevention rationale behind {@link ATTACK_SECONDS}, just for a
 * step change rather than a note attack. */
const ROUTING_GAIN_RAMP_SECONDS = 0.005;

interface OperatorNodes {
  readonly oscillator: OscillatorNodeLike;
  readonly levelGain: GainNodeLike;
  readonly feedbackGain: GainNodeLike;
  readonly feedbackDelay: DelayNodeLike;
}

function validateNote(note: number): void {
  if (!Number.isInteger(note) || note < MIN_MIDI_NOTE || note > MAX_MIDI_NOTE) {
    throw new RangeError(`note must be an integer in ${MIN_MIDI_NOTE}..${MAX_MIDI_NOTE}, received ${note}`);
  }
}

function validateVelocity(velocity: number): void {
  if (!Number.isInteger(velocity) || velocity < MIN_VELOCITY || velocity > MAX_VELOCITY) {
    throw new RangeError(
      `velocity must be an integer in ${MIN_VELOCITY}..${MAX_VELOCITY}, received ${velocity}`,
    );
  }
}

/**
 * `SynthEngine` implemented as a persistent, gesture-gated six-oscillator
 * Web Audio graph (`05-01-PLAN.md`, `05-02-PLAN.md`) — the MVP
 * `OscillatorNode`/`GainNode` approximation CLAUDE.md's Audio rules scope
 * for this phase, with the AudioWorklet six-operator engine as the accuracy
 * target (Phase 7+).
 *
 * The six oscillators are built once in {@link initialize}, started once,
 * and never recreated per note or per algorithm switch
 * (`05-RESEARCH.md` Pitfall 2) — this is the architectural commitment that
 * makes a stuck voice structurally impossible. Note-on/off/retrigger only
 * touch the persistent `voiceGain`'s scheduled automation and each
 * oscillator's `frequency`; an algorithm switch only disconnects/reconnects
 * each operator's `levelGain`/`feedbackDelay` outputs (D-02) — the
 * oscillator→levelGain, oscillator→feedbackGain, and feedbackGain→
 * feedbackDelay links are built once and never touched again.
 *
 * Routing is derived solely from `planConnections()` (D-01) and
 * `deriveCarriers()` — never a per-algorithm branch, never a second copy of
 * the carrier/feedback rule.
 */
@Injectable({ providedIn: 'root' })
export class WebAudioSynthEngine implements SynthEngine {
  private readonly ctor = inject(AUDIO_CONTEXT_CTOR);
  private readonly instrumentState = inject(InstrumentState);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _status = signal<AudioEngineStatus>(this.ctor === null ? 'unavailable' : 'suspended');

  /** Read-only — never a plain writable signal, never a getter (CLAUDE.md). */
  readonly status: Signal<AudioEngineStatus> = this._status.asReadonly();

  private context: AudioContextLike | null = null;
  private masterGain: GainNodeLike | null = null;
  private voiceGain: GainNodeLike | null = null;
  private operatorNodes: Map<OperatorId, OperatorNodes> | null = null;
  private readonly startedOscillators: OscillatorNodeLike[] = [];

  private heldNote: number | null = null;

  /** Identity of the `InstrumentState` snapshot last pushed into the audio
   * graph. Reference equality is enough: `algorithm()`/`operators()` return
   * stable objects until the next validated write. Used so a synchronous
   * apply from `setAlgorithm`/`updateOperatorLevel`/`setFeedback` is not
   * immediately repeated when the constructor `effect()` flushes the same
   * write, while still letting the effect apply direct `InstrumentState`
   * mutations made elsewhere. */
  private lastAppliedAlgorithm: AlgorithmDefinition | undefined;
  private lastAppliedOperators: OperatorParameterSet | undefined;
  private lastAppliedFeedback: number | undefined;

  /** Bumped by every `initialize()` call and by `destroy()`. `context.resume()`
   * is a genuine async boundary (even the fake resolves via a real
   * `Promise`), so a `destroy()` — or a second `initialize()` after one —
   * can complete while an earlier `initialize()` is still awaiting it. The
   * generation captured at the top of that earlier call no longer matching
   * this field when it resumes is how it recognizes its own build is stale
   * and must not overwrite whatever status/context ownership the newer
   * call already established. */
  private initializationGeneration = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.destroy());

    // The one sanctioned effect() in this phase (CLAUDE.md: imperative sync
    // with an external system, never a computed() deriving graph shape).
    // Reading all three signals BEFORE the early return is load-bearing: an
    // effect that returns before reading a signal never registers it as a
    // dependency and would not re-run when that signal changes. Skips when
    // the engine methods already applied this exact snapshot synchronously.
    effect(() => {
      const algorithm = this.instrumentState.algorithm();
      const operators = this.instrumentState.operators();
      const feedback = this.instrumentState.feedback();

      if (this.operatorNodes === null) {
        return;
      }

      if (this.hasAppliedRoutingState(algorithm, operators, feedback)) {
        return;
      }

      this.applyRouting(algorithm, operators, feedback);
      this.rememberAppliedRoutingState(algorithm, operators, feedback);
    });
  }

  /**
   * The only place `new ctor()` runs, and only ever from a user-gesture
   * handler (`05-RESEARCH.md` Pitfall 3). Idempotent: a second call while a
   * context already exists is a no-op, so a double activation cannot build
   * a second graph.
   */
  async initialize(): Promise<void> {
    if (this.ctor === null || this.context !== null) {
      return;
    }

    const generation = ++this.initializationGeneration;

    try {
      await this.buildAndStart(this.ctor);
      if (generation !== this.initializationGeneration) {
        // Stale: a destroy() (or a newer initialize()) already ran while
        // `context.resume()` was pending and has its own, already-correct
        // status/context in place — this call's outcome must not overwrite
        // it (whatever it built, destroy()'s own teardown already reached).
        return;
      }
      this._status.set('ready');
    } catch {
      if (generation !== this.initializationGeneration) {
        return;
      }
      // `this.context` may have been assigned by `buildAndStart()` before it
      // threw (CR-02). The type assertion is required, not cosmetic: a
      // `const`'s control-flow type locks to its initializer's narrowed
      // type, and TypeScript's checker (unsoundly, across this `await`)
      // still considers `this.context` narrowed to `null` here from the
      // guard at the top of this method — so a plain read would silently
      // type `failedContext` as `null` and mistype the `.close()` call
      // below as unreachable, rather than actually widening it.
      const failedContext = this.context as AudioContextLike | null;
      this.teardownGraph();
      this.context = null;
      if (failedContext !== null) {
        void failedContext.close();
      }
      this._status.set('error');
    }
  }

  private async buildAndStart(ctor: AudioContextConstructorLike): Promise<void> {
    const context = new ctor();
    this.context = context;
    this.buildGraph(context);
    await context.resume();
    this.applyInstrumentStateToGraph();
  }

  /** Builds the persistent graph exactly once: one `masterGain` →
   * `context.destination`, one `voiceGain` → `masterGain` (the only node
   * whose gain moves for note transitions), and six persistent, immediately
   * started oscillators, one per {@link OPERATOR_IDS} — each connected to
   * both its own `levelGain` (the forward-modulation/carrier path) and its
   * own `feedbackGain` → `feedbackDelay` (the self-loop path, legally
   * closed by a `DelayNode` per `05-RESEARCH.md` Pitfall 1). None of these
   * four persistent links is ever disconnected outside `destroy()`. */
  private buildGraph(context: AudioContextLike): void {
    const masterGain = context.createGain();
    masterGain.gain.value = MASTER_GAIN;
    masterGain.connect(context.destination);
    this.masterGain = masterGain;

    const voiceGain = context.createGain();
    voiceGain.gain.value = 0;
    voiceGain.connect(masterGain);
    this.voiceGain = voiceGain;

    const feedbackDelaySeconds = computeFeedbackDelaySeconds(context.sampleRate);

    this.operatorNodes = new Map<OperatorId, OperatorNodes>();
    for (const operatorId of OPERATOR_IDS) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      const levelGain = context.createGain();
      const feedbackGain = context.createGain();
      const feedbackDelay = context.createDelay();
      // Never left at 0 — a zero-delay self-loop is the exact condition
      // Web Audio rejects (`05-RESEARCH.md` Pitfall 1).
      feedbackDelay.delayTime.value = feedbackDelaySeconds;

      oscillator.connect(levelGain);
      oscillator.connect(feedbackGain);
      feedbackGain.connect(feedbackDelay);

      oscillator.start();
      this.startedOscillators.push(oscillator);
      this.operatorNodes.set(operatorId, { oscillator, levelGain, feedbackGain, feedbackDelay });
    }
  }

  /**
   * The generic, all-32-algorithm routing application (D-01, D-02). Tears
   * down only the re-patchable links — every `levelGain`'s outgoing
   * connections and every `feedbackDelay`'s outgoing connection — leaving
   * the persistent oscillator→levelGain/oscillator→feedbackGain/
   * feedbackGain→feedbackDelay links untouched, then walks
   * `planConnections(algorithm)` (never a locally re-derived edge/feedback
   * test) followed by `deriveCarriers(algorithm)` (never a locally
   * re-derived carrier test) to reconnect exactly the new algorithm's
   * topology. A disabled operator contributes zero gain on whichever path
   * it occupies via a multiplier on the converted value, not by skipping
   * the connection — the live topology stays a pure function of the
   * algorithm alone.
   */
  private applyRouting(
    algorithm: AlgorithmDefinition,
    operators: OperatorParameterSet,
    feedback: number,
  ): void {
    if (this.voiceGain === null || this.operatorNodes === null) {
      return;
    }

    const now = this.context?.currentTime ?? 0;
    const voiceGain = this.voiceGain;
    const operatorNodes = this.operatorNodes;

    for (const nodes of operatorNodes.values()) {
      nodes.levelGain.disconnect();
      nodes.feedbackDelay.disconnect();
    }

    for (const connection of planConnections(algorithm)) {
      const source = operatorNodes.get(connection.from);
      const target = operatorNodes.get(connection.to);
      if (source === undefined || target === undefined) {
        continue;
      }

      if (connection.isFeedback) {
        source.feedbackDelay.connect(source.oscillator.frequency);
      } else {
        source.levelGain.connect(target.oscillator.frequency);
      }
    }

    for (const carrierId of deriveCarriers(algorithm)) {
      const nodes = operatorNodes.get(carrierId);
      if (nodes === undefined) {
        continue;
      }
      const carrierParameters = operators[carrierId];
      const enabledMultiplier = carrierParameters.enabled ? 1 : 0;
      const carrierAmplitude =
        outputLevelToAmplitude(carrierParameters.outputLevel) * enabledMultiplier;
      // Anchor at the carrier amplitude *before* connect so a former
      // modulator's Hz-scale levelGain cannot briefly drive voiceGain
      // during the routing transition (scheduleGainValue then preserves
      // its ramp from this anchored value).
      nodes.levelGain.gain.cancelScheduledValues(now);
      nodes.levelGain.gain.setValueAtTime(carrierAmplitude, now);
      this.scheduleGainValue(nodes.levelGain.gain, carrierAmplitude, now);
      nodes.levelGain.connect(voiceGain);
    }

    // CR-01: modulation/feedback depth (a Hz value) must track the
    // currently-held note's per-operator frequency, never a stale
    // AudioParam readback — recomputed here from the held note (or a
    // nominal base frequency before any note has ever played), and again
    // from scheduleAttack()/scheduleRetrigger() whenever the note changes.
    this.applyModulationDepths(algorithm, operators, feedback, this.operatorFrequenciesForCurrentNote(operators), now);
  }

  /** Recomputes and applies each operator's modulation/feedback depth (a
   * peak-frequency-deviation-in-Hz value, i.e. an effective modulation
   * index) from the given per-operator frequency map — never a stale
   * `AudioParam` readback (CR-01). Ramped, not directly assigned (WR-02),
   * so a mid-note routing/level/feedback change never steps audibly. */
  private applyModulationDepths(
    algorithm: AlgorithmDefinition,
    operators: OperatorParameterSet,
    feedback: number,
    operatorFrequencies: ReadonlyMap<OperatorId, number>,
    atTime: number,
  ): void {
    if (this.operatorNodes === null) {
      return;
    }
    const operatorNodes = this.operatorNodes;

    for (const connection of planConnections(algorithm)) {
      const source = operatorNodes.get(connection.from);
      if (source === undefined) {
        continue;
      }
      const sourceParameters = operators[connection.from];
      const enabledMultiplier = sourceParameters.enabled ? 1 : 0;
      const sourceFrequencyHz = operatorFrequencies.get(connection.from) ?? source.oscillator.frequency.value;

      if (connection.isFeedback) {
        this.scheduleGainValue(
          source.feedbackGain.gain,
          feedbackLevelToDepthHz(feedback, sourceFrequencyHz) * enabledMultiplier,
          atTime,
        );
      } else {
        this.scheduleGainValue(
          source.levelGain.gain,
          outputLevelToModulationDepthHz(sourceParameters.outputLevel, sourceFrequencyHz) * enabledMultiplier,
          atTime,
        );
      }
    }
  }

  /** Per-operator frequency map (ratio/detune/fixed-mode aware) for the
   * note currently held, or {@link A4_FREQUENCY_HZ} — the same value an
   * un-set `OscillatorNode.frequency` already defaults to — when no note
   * has ever been played yet, preserving this class's prior baseline
   * behavior for the initial `buildAndStart()` routing pass. */
  private operatorFrequenciesForCurrentNote(operators: OperatorParameterSet): ReadonlyMap<OperatorId, number> {
    const noteFrequencyHz = this.heldNote === null ? A4_FREQUENCY_HZ : midiNoteToFrequency(this.heldNote);
    return this.computeOperatorFrequencies(noteFrequencyHz, operators);
  }

  /** Per-operator frequency (ratio/detune/fixed-mode aware) for a given
   * note's fundamental — the same math `scheduleAttack()`/
   * `scheduleRetrigger()` use to retune each oscillator, factored out so
   * CR-01's depth recompute always uses the note actually sounding. */
  private computeOperatorFrequencies(
    noteFrequencyHz: number,
    operators: OperatorParameterSet,
  ): ReadonlyMap<OperatorId, number> {
    const frequencies = new Map<OperatorId, number>();
    for (const operatorId of OPERATOR_IDS) {
      frequencies.set(operatorId, operatorFrequencyHz(operators[operatorId], noteFrequencyHz));
    }
    return frequencies;
  }

  /** Ramps a gain `AudioParam` to `value` over {@link ROUTING_GAIN_RAMP_SECONDS}
   * instead of a direct `.value =` assignment (WR-02) — the same
   * cancel-then-ramp shape `scheduleAttack`/`scheduleRetrigger` already use
   * for `voiceGain`. */
  private scheduleGainValue(param: AudioParamLike, value: number, atTime: number): void {
    param.cancelAndHoldAtTime(atTime);
    param.linearRampToValueAtTime(value, atTime + ROUTING_GAIN_RAMP_SECONDS);
  }

  /** Forwards into `InstrumentState` (single source of truth) then
   * synchronously re-applies that snapshot to the live graph so D-02's
   * "immediately" re-patch does not wait on `effect()` scheduling. The
   * constructor `effect()` still covers direct `InstrumentState` writes
   * made elsewhere; `rememberAppliedRoutingState` keeps it from repeating
   * the snapshot this method just applied (WR-05). */
  setAlgorithm(algorithmId: AlgorithmId): void {
    this.instrumentState.setAlgorithm(algorithmId);
    this.applyInstrumentStateToGraph();
  }

  updateOperatorLevel(operatorId: OperatorId, level: number): void {
    this.instrumentState.updateOperator(operatorId, { outputLevel: level });
    this.applyInstrumentStateToGraph();
  }

  setFeedback(level: number): void {
    this.instrumentState.setFeedback(level);
    this.applyInstrumentStateToGraph();
  }

  /** Reads the current `InstrumentState` signals and pushes them into the
   * audio graph, recording the snapshot so a subsequent effect flush of the
   * same write is a no-op. */
  private applyInstrumentStateToGraph(): void {
    if (this.operatorNodes === null) {
      return;
    }

    const algorithm = this.instrumentState.algorithm();
    const operators = this.instrumentState.operators();
    const feedback = this.instrumentState.feedback();
    this.applyRouting(algorithm, operators, feedback);
    this.rememberAppliedRoutingState(algorithm, operators, feedback);
  }

  private hasAppliedRoutingState(
    algorithm: AlgorithmDefinition,
    operators: OperatorParameterSet,
    feedback: number,
  ): boolean {
    return (
      this.lastAppliedAlgorithm === algorithm &&
      this.lastAppliedOperators === operators &&
      this.lastAppliedFeedback === feedback
    );
  }

  private rememberAppliedRoutingState(
    algorithm: AlgorithmDefinition,
    operators: OperatorParameterSet,
    feedback: number,
  ): void {
    this.lastAppliedAlgorithm = algorithm;
    this.lastAppliedOperators = operators;
    this.lastAppliedFeedback = feedback;
  }

  /** Validates first — before touching any `AudioParam` (T-05-01) — then
   * schedules a click-safe attack, or, when a note is already held, D-04's
   * cut-and-restart retrigger. Each operator's oscillator is retuned to its
   * own `operatorFrequencyHz` (ratio/detune/fixed-mode aware), not a single
   * shared note frequency. Silently no-ops when the graph has not been
   * built (`status()` is not `'ready'`). */
  noteOn(note: number, velocity: number): void {
    validateNote(note);
    validateVelocity(velocity);

    if (this.context === null || this.voiceGain === null || this.operatorNodes === null) {
      return;
    }

    const now = this.context.currentTime;
    const noteFrequencyHz = midiNoteToFrequency(note);
    const targetLevel = velocityToAmplitude(velocity);
    const voiceGain = this.voiceGain;
    const operatorNodes = this.operatorNodes;
    const operators = this.instrumentState.operators();

    if (this.heldNote !== null) {
      this.scheduleRetrigger(now, noteFrequencyHz, operators, targetLevel, voiceGain, operatorNodes);
    } else {
      this.scheduleAttack(now, noteFrequencyHz, operators, targetLevel, voiceGain, operatorNodes);
    }

    this.heldNote = note;
  }

  private scheduleAttack(
    now: number,
    noteFrequencyHz: number,
    operators: OperatorParameterSet,
    targetLevel: number,
    voiceGain: GainNodeLike,
    operatorNodes: ReadonlyMap<OperatorId, OperatorNodes>,
  ): void {
    for (const [operatorId, { oscillator }] of operatorNodes) {
      oscillator.frequency.setValueAtTime(operatorFrequencyHz(operators[operatorId], noteFrequencyHz), now);
    }

    // CR-01: this note's own pitch, not whatever frequency happened to be
    // live the last time the algorithm/level/feedback changed.
    this.applyModulationDepths(
      this.instrumentState.algorithm(),
      operators,
      this.instrumentState.feedback(),
      this.computeOperatorFrequencies(noteFrequencyHz, operators),
      now,
    );

    voiceGain.gain.cancelAndHoldAtTime(now);
    voiceGain.gain.linearRampToValueAtTime(targetLevel, now + ATTACK_SECONDS);
  }

  /** D-04: cuts the held note (ramp to zero, not a hard stop) and restarts
   * immediately at the new note — no oscillator is created, started, or
   * stopped. Retuning is scheduled at the cut boundary, not at call time,
   * so the pitch jump is masked by the near-silent gain. */
  private scheduleRetrigger(
    now: number,
    noteFrequencyHz: number,
    operators: OperatorParameterSet,
    targetLevel: number,
    voiceGain: GainNodeLike,
    operatorNodes: ReadonlyMap<OperatorId, OperatorNodes>,
  ): void {
    const cutTime = now + RETRIGGER_CUT_SECONDS;

    voiceGain.gain.cancelAndHoldAtTime(now);
    voiceGain.gain.linearRampToValueAtTime(0, cutTime);

    for (const [operatorId, { oscillator }] of operatorNodes) {
      oscillator.frequency.setValueAtTime(operatorFrequencyHz(operators[operatorId], noteFrequencyHz), cutTime);
    }

    // CR-01: recompute at the cut boundary — the moment the new note's
    // pitch actually takes over — not the stale frequency from whenever
    // routing was last (re)applied.
    this.applyModulationDepths(
      this.instrumentState.algorithm(),
      operators,
      this.instrumentState.feedback(),
      this.computeOperatorFrequencies(noteFrequencyHz, operators),
      cutTime,
    );

    voiceGain.gain.setValueAtTime(0, cutTime);
    voiceGain.gain.linearRampToValueAtTime(targetLevel, cutTime + ATTACK_SECONDS);
  }

  /** Ignores a release for a note that is not the currently held note — a
   * stale release from a superseded key must not silence the note now
   * sounding (D-04). */
  noteOff(note: number): void {
    if (note !== this.heldNote) {
      return;
    }
    this.releaseVoice();
    this.heldNote = null;
  }

  allNotesOff(): void {
    this.releaseVoice();
    this.heldNote = null;
  }

  /** Exponential-decay release terminating at an exact, assertable zero. */
  private releaseVoice(): void {
    if (this.context === null || this.voiceGain === null) {
      return;
    }
    const now = this.context.currentTime;
    this.voiceGain.gain.cancelAndHoldAtTime(now);
    this.voiceGain.gain.setTargetAtTime(0, now, RELEASE_TIME_CONSTANT);
    this.voiceGain.gain.setValueAtTime(0, now + RELEASE_SECONDS);
  }

  destroy(): void {
    // Invalidates any initialize() still awaiting context.resume() — its
    // continuation must not resurrect 'ready'/'error' over what this call
    // is about to set.
    this.initializationGeneration += 1;

    if (this.voiceGain !== null && this.context !== null) {
      const now = this.context.currentTime;
      this.voiceGain.gain.cancelScheduledValues(now);
      this.voiceGain.gain.setValueAtTime(0, now);
    }
    this.heldNote = null;

    this.teardownGraph();

    if (this.context !== null) {
      void this.context.close();
    }
    this.context = null;

    this._status.set(this.ctor === null ? 'unavailable' : 'suspended');
  }

  /** Stops every started oscillator exactly once and disconnects every node
   * `initialize()` created — including the persistent feedback gain/delay
   * pair, not only the re-patchable levelGain/feedbackDelay outputs — the
   * no-leaked-node invariant (`05-RESEARCH.md` Pitfall 2, T-05-03). Safe to
   * call on a partially-built graph (an `initialize()` that threw
   * partway through). */
  private teardownGraph(): void {
    if (this.operatorNodes !== null) {
      for (const { oscillator, levelGain, feedbackGain, feedbackDelay } of this.operatorNodes.values()) {
        oscillator.disconnect();
        levelGain.disconnect();
        feedbackGain.disconnect();
        feedbackDelay.disconnect();
      }
    }

    for (const oscillator of this.startedOscillators) {
      oscillator.stop();
    }
    this.startedOscillators.length = 0;

    this.voiceGain?.disconnect();
    this.masterGain?.disconnect();

    this.operatorNodes = null;
    this.voiceGain = null;
    this.masterGain = null;
    this.lastAppliedAlgorithm = undefined;
    this.lastAppliedOperators = undefined;
    this.lastAppliedFeedback = undefined;
  }
}
