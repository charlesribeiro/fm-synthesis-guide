import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';
import { isAlgorithmId, MAX_ALGORITHM_ID, MIN_ALGORITHM_ID, type AlgorithmId } from '../../domain/dx7/models/algorithm';
import { isOperatorId, type OperatorId } from '../../domain/dx7/models/operator';
import { validateOperatorParameters } from '../../domain/dx7/models/operator-parameters';
import { validateFeedbackLevel } from '../../domain/dx7/models/patch';
import {
  MASTER_GAIN,
  MAX_MIDI_NOTE,
  MAX_VELOCITY,
  MIN_MIDI_NOTE,
  MIN_VELOCITY,
  midiNoteToFrequency,
  velocityToAmplitude,
} from '../../domain/dx7/audio/value-conversion';
import {
  DX7_OPERATOR_PROCESSOR_NAME,
  setFrequencyMessage,
  setModeMessage,
  type WorkletRenderMode,
} from '../../domain/dx7/dsp/worklet-messages';
import {
  AUDIO_CONTEXT_CTOR,
  type AudioContextConstructorLike,
  type AudioContextLike,
  type GainNodeLike,
} from './audio-context.token';
import {
  AUDIO_WORKLET_MODULE_URL,
  AUDIO_WORKLET_NODE_CTOR,
  supportsAudioWorklet,
  type AudioWorkletNodeConstructorLike,
  type AudioWorkletNodeLike,
} from './audio-worklet-node.token';
import type { AudioEngineStatus, SynthEngine } from './synth-engine';

interface BuiltWorkletGraph {
  readonly context: AudioContextLike;
  node: AudioWorkletNodeLike | null;
  masterGain: GainNodeLike | null;
  voiceGain: GainNodeLike | null;
}

/**
 * Click-prevention attack ramp length — intentionally mirrors
 * `web-audio-synth-engine.ts`'s `ATTACK_SECONDS` (listening-checkpoint
 * verified in Phase 5), but is declared independently rather than imported:
 * importing it would make this module depend on Phase 5's live engine
 * class, which D-01's isolation forbids. Independently tunable per engine.
 */
export const WORKLET_ATTACK_SECONDS = 0.015;

/** Exponential-decay release time constant — same value/rationale as
 * `web-audio-synth-engine.ts`'s `RELEASE_TIME_CONSTANT`, declared
 * independently for the same D-01 isolation reason. */
export const WORKLET_RELEASE_TIME_CONSTANT = 0.015;

/** Five time constants is what the ear hears as "fully decayed" — mirrors
 * `web-audio-synth-engine.ts`'s `RELEASE_SECONDS` derivation. */
const WORKLET_RELEASE_TIME_CONSTANT_COUNT = 5;
export const WORKLET_RELEASE_SECONDS = WORKLET_RELEASE_TIME_CONSTANT * WORKLET_RELEASE_TIME_CONSTANT_COUNT;

/**
 * Duplicated in shape from `web-audio-synth-engine.ts`'s `validateNote` —
 * the four-line guard is copied rather than imported (D-01 isolation), but
 * the bounds themselves are imported from `value-conversion.ts` so they
 * cannot drift. Flagged as consolidation work for the live-cutover phase.
 */
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

function validateAlgorithmId(algorithmId: AlgorithmId): void {
  if (!isAlgorithmId(algorithmId)) {
    throw new RangeError(
      `algorithmId must be an integer in ${MIN_ALGORITHM_ID}..${MAX_ALGORITHM_ID}, received ${algorithmId}`,
    );
  }
}

function validateOperatorId(operatorId: OperatorId): void {
  if (!isOperatorId(operatorId)) {
    throw new RangeError(`operatorId must be one of 1..6, received ${operatorId}`);
  }
}

/**
 * `SynthEngine` implemented over an `AudioWorkletNode` (Phase 7, ENGINE-01,
 * D-02) — the accuracy-target six-operator phase-modulation engine that
 * `synth-engine.token.ts`'s own doc comment promises can swap in without
 * touching UI code. Proven only against hand-rolled fakes this phase (see
 * `07-02-PLAN.md`'s flagged assumption); the shared message contract it
 * posts against (`worklet-messages.ts`) is the same one 07-01's real built
 * worklet bundle exercises.
 *
 * This class currently drives a single operator or a synthetic six-carrier
 * additive fixture (07-01's `AdditiveOperatorBank`) — it is NOT an exact
 * DX7 emulation and must never be documented as one (CLAUDE.md). Routing
 * across the canonical 32-algorithm dataset is Phase 8 (ENGINE-02);
 * per-operator level shaping is Phase 9 (ENGINE-03) — `setAlgorithm`,
 * `updateOperatorLevel` and `setFeedback` are validating no-ops until then,
 * a deliberate honest contract rather than an unexplained throw.
 *
 * D-01: `SYNTH_ENGINE` (`synth-engine.token.ts`) is untouched by this class
 * and still resolves to `WebAudioSynthEngine` — this engine exists
 * standalone, not yet wired to the token, so Playground and the `/learn`
 * lessons keep their Phase 5 sound.
 */
@Injectable({ providedIn: 'root' })
export class WorkletSynthEngine implements SynthEngine {
  private readonly contextCtor = inject(AUDIO_CONTEXT_CTOR);
  private readonly nodeCtor = inject(AUDIO_WORKLET_NODE_CTOR);
  private readonly moduleUrl = inject(AUDIO_WORKLET_MODULE_URL);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _status = signal<AudioEngineStatus>(
    this.contextCtor === null || this.nodeCtor === null ? 'unavailable' : 'suspended',
  );

  /** Read-only — never a plain writable signal, never a getter (CLAUDE.md). */
  readonly status: Signal<AudioEngineStatus> = this._status.asReadonly();

  private context: AudioContextLike | null = null;
  private node: AudioWorkletNodeLike | null = null;
  private masterGain: GainNodeLike | null = null;
  private voiceGain: GainNodeLike | null = null;

  private heldNote: number | null = null;

  /** Bumped by every `initialize()` call and by `destroy()` — mirrors
   * `WebAudioSynthEngine`'s stale-resume guard exactly (`05-RESEARCH.md`
   * Pitfall 3 / T-07-07). */
  private initializationGeneration = 0;

  /** Caches the in-flight build so a second, unawaited `initialize()` call
   * (e.g. a double-fired enable gesture) reuses the same promise instead of
   * racing a second `AudioContext`/`addModule()`/node build concurrently —
   * `this.context` alone cannot serve as that guard, since it is only
   * assigned after the build resolves. */
  private pendingInitialize: Promise<void> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.destroy());
    // No effect() here: unlike WebAudioSynthEngine, this engine has no
    // InstrumentState subscription this phase, and an effect deriving
    // nothing would violate CLAUDE.md's "effects exist only for imperative
    // synchronisation" rule.
  }

  /**
   * The only place either injected constructor runs, and only ever from a
   * user-gesture handler. Idempotent: a second call while a context already
   * exists, or while a build is already in flight, reuses that outcome
   * rather than starting a second, concurrent one.
   */
  async initialize(): Promise<void> {
    if (this.contextCtor === null || this.nodeCtor === null || this.context !== null) {
      return;
    }
    if (this.pendingInitialize !== null) {
      return this.pendingInitialize;
    }

    const contextCtor = this.contextCtor;
    const nodeCtor = this.nodeCtor;
    const generation = ++this.initializationGeneration;

    const run = async (): Promise<void> => {
      try {
        const built = await this.buildAndStart(contextCtor, nodeCtor, generation);
        if (built === null) {
          // Already discarded inside buildAndStart — a destroy() (or a
          // newer initialize()) ran while an async boundary was pending.
          return;
        }
        if (generation !== this.initializationGeneration) {
          // Stale: destroy() (or a newer initialize()) already ran while an
          // await was pending — discard the local graph without touching
          // instance ownership or status (T-07-07).
          this.discardLocalGraph(built);
          return;
        }
        this.context = built.context;
        this.node = built.node;
        this.masterGain = built.masterGain;
        this.voiceGain = built.voiceGain;
        this._status.set('ready');
      } catch {
        if (generation !== this.initializationGeneration) {
          return;
        }
        // buildAndStart already discarded any partially-built local graph.
        this._status.set('error');
      } finally {
        // Only clear if nothing newer (a fresh initialize(), or destroy())
        // has already taken ownership of pendingInitialize.
        if (generation === this.initializationGeneration) {
          this.pendingInitialize = null;
        }
      }
    };

    this.pendingInitialize = run();
    return this.pendingInitialize;
  }

  private async buildAndStart(
    contextCtor: AudioContextConstructorLike,
    nodeCtor: AudioWorkletNodeConstructorLike,
    generation: number,
  ): Promise<BuiltWorkletGraph | null> {
    const context = new contextCtor();
    const built: BuiltWorkletGraph = {
      context,
      node: null,
      masterGain: null,
      voiceGain: null,
    };

    try {
      if (!supportsAudioWorklet(context)) {
        throw new Error('AudioWorklet is not supported on this AudioContext');
      }

      await context.resume();
      if (generation !== this.initializationGeneration) {
        // Stale before the node was ever constructed — discard now rather
        // than paying for a module load and a graph the caller no longer
        // wants.
        this.discardLocalGraph(built);
        return null;
      }

      await context.audioWorklet.addModule(this.moduleUrl);
      if (generation !== this.initializationGeneration) {
        this.discardLocalGraph(built);
        return null;
      }

      const node = new nodeCtor(context, DX7_OPERATOR_PROCESSOR_NAME, {
        outputChannelCount: [1],
        processorOptions: { frequencyHz: 440 },
      });
      built.node = node;

      const masterGain = context.createGain();
      const voiceGain = context.createGain();
      const now = context.currentTime;
      masterGain.gain.setValueAtTime(MASTER_GAIN, now);
      voiceGain.gain.setValueAtTime(0, now);

      node.connect(voiceGain);
      voiceGain.connect(masterGain);
      masterGain.connect(context.destination);

      built.masterGain = masterGain;
      built.voiceGain = voiceGain;
      return built;
    } catch (error) {
      this.discardLocalGraph(built);
      throw error;
    }
  }

  /** Disconnects and closes a graph that was never committed to instance fields. */
  private discardLocalGraph(built: BuiltWorkletGraph): void {
    if (built.node !== null) {
      built.node.port.onmessage = null;
      built.node.disconnect();
    }
    built.voiceGain?.disconnect();
    built.masterGain?.disconnect();
    void built.context.close();
  }

  setAlgorithm(algorithmId: AlgorithmId): void {
    validateAlgorithmId(algorithmId);
    // Phase 8 (ENGINE-02): routing across the canonical dataset is not yet
    // implemented on this engine — validated no-op, not a silent lie or an
    // unexplained throw. Hardcoding any algorithm-id-to-fixture mapping
    // here would duplicate routing knowledge the canonical dataset already
    // owns (D-04, CLAUDE.md domain rules).
  }

  setFeedback(level: number): void {
    validateFeedbackLevel(level);
    // Phase 8 (ENGINE-02): feedback depth is not yet wired to the kernel —
    // validated no-op.
  }

  updateOperatorLevel(operatorId: OperatorId, level: number): void {
    validateOperatorId(operatorId);
    validateOperatorParameters({ outputLevel: level });
    // Phase 9 (ENGINE-03): per-operator level shaping is not yet
    // implemented on this engine — validated no-op.
  }

  /**
   * Concrete-class extension, deliberately not part of `SynthEngine` — lets
   * tests and future tooling drive both the single-operator and additive
   * proof cases without widening the shared interface.
   */
  setRenderMode(mode: WorkletRenderMode): void {
    if (this.node === null) {
      return;
    }
    this.node.port.postMessage(setModeMessage(mode));
  }

  /** Validates first — before touching the port or any `AudioParam` — then
   * posts the shared frequency message and schedules a click-safe attack.
   * Silently no-ops when the graph has not been built (`status()` is not
   * `'ready'`). */
  noteOn(note: number, velocity: number): void {
    validateNote(note);
    validateVelocity(velocity);

    if (this.context === null || this.node === null || this.voiceGain === null) {
      return;
    }

    const now = this.context.currentTime;
    const frequencyHz = midiNoteToFrequency(note);
    const targetLevel = velocityToAmplitude(velocity);

    this.node.port.postMessage(setFrequencyMessage(frequencyHz));
    this.heldNote = note;

    this.voiceGain.gain.cancelAndHoldAtTime(now);
    this.voiceGain.gain.linearRampToValueAtTime(targetLevel, now + WORKLET_ATTACK_SECONDS);
  }

  /** Ignores a release for a note that is not the currently held note — a
   * stale release from a superseded key must not silence the note now
   * sounding (mirrors `WebAudioSynthEngine.noteOff`'s D-04 posture). */
  noteOff(note: number): void {
    validateNote(note);
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

  /** Exponential-decay release terminating at an exact, assertable zero —
   * identical shape to `WebAudioSynthEngine.releaseVoice()`. */
  private releaseVoice(): void {
    if (this.context === null || this.voiceGain === null) {
      return;
    }
    const now = this.context.currentTime;
    this.voiceGain.gain.cancelAndHoldAtTime(now);
    this.voiceGain.gain.setTargetAtTime(0, now, WORKLET_RELEASE_TIME_CONSTANT);
    this.voiceGain.gain.setValueAtTime(0, now + WORKLET_RELEASE_SECONDS);
  }

  destroy(): void {
    // Invalidates any initialize() still awaiting an async boundary — its
    // continuation must not resurrect 'ready'/'error' over what this call
    // is about to set (T-07-07). Also drops the cached in-flight promise so
    // a subsequent initialize() starts a fresh build instead of returning
    // this now-stale one.
    this.initializationGeneration += 1;
    this.pendingInitialize = null;

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

    this._status.set(this.contextCtor === null || this.nodeCtor === null ? 'unavailable' : 'suspended');
  }

  /** Clears the worklet port's message handler and disconnects every node
   * `initialize()` created — including a partially-built graph from an
   * `initialize()` that threw partway through. */
  private teardownGraph(): void {
    if (this.node !== null) {
      this.node.port.onmessage = null;
      this.node.disconnect();
    }
    this.voiceGain?.disconnect();
    this.masterGain?.disconnect();

    this.node = null;
    this.voiceGain = null;
    this.masterGain = null;
  }
}
