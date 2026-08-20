import { DestroyRef, Injectable, Signal, effect, inject, signal } from '@angular/core';
import type { AlgorithmId } from '../../domain/dx7/models/algorithm';
import type { AlgorithmDefinition } from '../../domain/dx7/models/algorithm-definition';
import type { OperatorId } from '../../domain/dx7/models/operator';
import type { OperatorParameterSet } from '../../domain/dx7/models/patch';
import {
  MASTER_GAIN,
  MAX_MIDI_NOTE,
  MAX_VELOCITY,
  MIN_MIDI_NOTE,
  MIN_VELOCITY,
  midiNoteToFrequency,
} from '../../domain/dx7/audio/value-conversion';
import { buildRoutingConfig } from '../../domain/dx7/dsp/graph-router';
import {
  DX7_OPERATOR_PROCESSOR_NAME,
  setAlgorithmMessage,
  setFeedbackMessage,
  setFrequencyMessage,
  setGateMessage,
  setModeMessage,
  setOperatorParametersMessage,
  type WorkletRenderMode,
} from '../../domain/dx7/dsp/worklet-messages';
import { InstrumentState } from '../../state/instrument-state';
import {
  AUDIO_CONTEXT_CTOR,
  type AnalyserNodeLike,
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
import { ANALYSER_FFT_SIZE, type AnalysisTap, type AudioEngineStatus, type SynthEngine } from './synth-engine';

interface BuiltWorkletGraph {
  readonly context: AudioContextLike;
  node: AudioWorkletNodeLike | null;
  masterGain: GainNodeLike | null;
  analyser: AnalyserNodeLike | null;
}

/**
 * `postMessage` to the worklet's port crosses the main-thread ->
 * `AudioWorkletGlobalScope` realm boundary asynchronously — the render
 * thread is not guaranteed to have applied a `setMode` message by the time
 * `postMessage` returns. `setRenderMode` schedules its gain change this many
 * seconds past `AudioContext.currentTime` (never at the same instant the
 * mode message is posted) so the message has a real audio-clock window to
 * land before a render quantum can observe the new gain target applied to
 * the processor's still-prior mode. One render quantum at 44.1kHz is
 * ~2.9ms; this margin is a multiple of that with headroom for slower
 * devices, and costs nothing audible — nothing new starts playing during
 * it, since the graph is silent (or already in its prior, gain-matched
 * mode) throughout.
 */
const WORKLET_MODE_SWITCH_SETTLE_SECONDS = 0.01;

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

/**
 * `SynthEngine` implemented over an `AudioWorkletNode` (Phase 7, ENGINE-01,
 * D-02; routed live by Phase 8, ENGINE-02, D-01) — the accuracy-target
 * six-operator phase-modulation engine that `synth-engine.token.ts`'s own
 * doc comment promises can swap in without touching UI code. The shared
 * message contract it posts against (`worklet-messages.ts`) is the same
 * one the real built worklet bundle exercises.
 *
 * Routing across the canonical 32-algorithm dataset, and per-operator pitch
 * and level, are real as of this phase — `setAlgorithm`, `setFeedback` and
 * `updateOperatorLevel` all forward into `InstrumentState` and reapply the
 * resulting snapshot to the worklet's persistent `GraphRouter`. Envelope
 * shaping is real as of Phase 9 (ENGINE-03): the note lifecycle now reaches
 * the kernel as a validated `setGate` message, and six independent
 * per-operator `EnvelopeGenerator` instances inside `GraphRouter` do the
 * attack/decay/sustain/release shaping — click safety lives entirely in
 * those per-operator release segments now, not in this class. This is NOT
 * an exact DX7 emulation and must never be documented as one (CLAUDE.md).
 *
 * D-01: `SYNTH_ENGINE` (`synth-engine.token.ts`) now resolves to this
 * class — Playground and the `/learn` lessons hear this routed worklet
 * engine. `WebAudioSynthEngine` is retained as an unused reference
 * fallback (D-04), neither deleted nor auto-selected.
 */
@Injectable({ providedIn: 'root' })
export class WorkletSynthEngine implements SynthEngine, AnalysisTap {
  private readonly contextCtor = inject(AUDIO_CONTEXT_CTOR);
  private readonly nodeCtor = inject(AUDIO_WORKLET_NODE_CTOR);
  private readonly moduleUrl = inject(AUDIO_WORKLET_MODULE_URL);
  private readonly destroyRef = inject(DestroyRef);
  private readonly instrumentState = inject(InstrumentState);

  private readonly _status = signal<AudioEngineStatus>(
    this.contextCtor === null || this.nodeCtor === null ? 'unavailable' : 'suspended',
  );

  /** Read-only — never a plain writable signal, never a getter (CLAUDE.md). */
  readonly status: Signal<AudioEngineStatus> = this._status.asReadonly();

  private context: AudioContextLike | null = null;
  private node: AudioWorkletNodeLike | null = null;
  private masterGain: GainNodeLike | null = null;
  private analyser: AnalyserNodeLike | null = null;

  private heldNote: number | null = null;
  /** True from the first `noteOn` until graph teardown. Distinct from
   * `heldNote`: key-up (`noteOff`) starts the envelope release but the
   * analyser still carries live samples until the graph is torn down. */
  private voiceActive = false;

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

  /** Identity of the `InstrumentState` snapshot last pushed into the
   * worklet — mirrors `WebAudioSynthEngine`'s identical fields exactly.
   * Reference equality is enough: `algorithm()`/`operators()` return stable
   * objects until the next validated write. Used so a synchronous apply
   * from `setAlgorithm`/`updateOperatorLevel`/`setFeedback` is not
   * immediately repeated when the constructor `effect()` flushes the same
   * write, while still letting the effect apply direct `InstrumentState`
   * mutations made elsewhere. */
  private lastAppliedAlgorithm: AlgorithmDefinition | undefined;
  private lastAppliedOperators: OperatorParameterSet | undefined;
  private lastAppliedFeedback: number | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.destroy());

    // The one sanctioned effect() in this class (CLAUDE.md: imperative sync
    // with an external system, never a computed() deriving graph shape) —
    // mirrors WebAudioSynthEngine's constructor effect() exactly.
    // `applyInstrumentStateToWorklet` itself reads all three signals BEFORE
    // its own early return, which is load-bearing here too: an effect that
    // returns before reading a signal never registers it as a dependency and
    // would not re-run when that signal changes. Delegating to the shared
    // method (rather than duplicating the reads here) is what lets a direct
    // write to `InstrumentState` — made from anywhere, not just through this
    // engine's own methods — reach the worklet through this same path.
    effect(() => {
      this.applyInstrumentStateToWorklet();
    });
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
        this.analyser = built.analyser;
        this._status.set('ready');
        // The constructor effect() already ran and returned early while
        // `this.node` was still null, so nothing else delivers the initial
        // routing/parameters/feedback snapshot — push it once now, and put
        // the node into routed mode so it actually renders through the
        // router rather than the single-operator fallback. Routed mode
        // applies MASTER_GAIN inside GraphRouter, so the Web Audio
        // masterGain must stay at unity for that path.
        if (this.node !== null) {
          this.setRenderMode('routed');
        }
        this.applyInstrumentStateToWorklet();
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
      analyser: null,
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
      // Committed to `built` immediately on creation — same convention as
      // `built.node = node` just above — so a throw anywhere in the
      // remaining wiring below still leaves `discardLocalGraph` able to
      // disconnect every node this call actually created, not just the
      // ones assigned before the throw (T-10-03/T-10-05: no created node
      // may go uncleaned on a partial-failure path).
      built.masterGain = masterGain;
      const now = context.currentTime;
      // Starts at zero rather than MASTER_GAIN — a real regression guard,
      // not cosmetics (Phase 9, D-02). The dedicated per-voice gain node
      // that used to hold the graph silent between the node being built and
      // the routed-mode message arriving is gone; the processor is still in
      // its default single-operator mode (a continuous tone) during that
      // window, so starting the master gain at zero closes it at no cost.
      // `setRenderMode` assigns the mode-appropriate value once routing is
      // actually established.
      masterGain.gain.setValueAtTime(0, now);

      // The analyser is a read tap on the final mix and passes audio through
      // unmodified, so inserting it changes what can be observed and nothing
      // about what is heard (D-02).
      const analyser = context.createAnalyser();
      built.analyser = analyser;
      analyser.fftSize = ANALYSER_FFT_SIZE;

      node.connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(context.destination);

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
    built.masterGain?.disconnect();
    built.analyser?.disconnect();
    void built.context.close();
  }

  /** Forwards into `InstrumentState` (single source of truth — its own
   * `resolveAlgorithm` already throws the documented `RangeError` for an
   * unknown id, so no redundant local guard is kept here, matching
   * `WebAudioSynthEngine`'s shape exactly) then synchronously re-applies
   * that snapshot to the live worklet so the routing change is audible
   * immediately rather than waiting on `effect()` scheduling. */
  setAlgorithm(algorithmId: AlgorithmId): void {
    this.instrumentState.setAlgorithm(algorithmId);
    this.applyInstrumentStateToWorklet();
  }

  setFeedback(level: number): void {
    this.instrumentState.setFeedback(level);
    this.applyInstrumentStateToWorklet();
  }

  updateOperatorLevel(operatorId: OperatorId, level: number): void {
    this.instrumentState.updateOperator(operatorId, { outputLevel: level });
    this.applyInstrumentStateToWorklet();
  }

  /**
   * Concrete-class extension, deliberately not part of `SynthEngine` — lets
   * tests and future tooling drive both the single-operator and additive
   * proof cases without widening the shared interface.
   */
  setRenderMode(mode: WorkletRenderMode): void {
    if (this.node === null || this.context === null || this.masterGain === null) {
      return;
    }
    this.node.port.postMessage(setModeMessage(mode));
    // GraphRouter.render() (routed) already applies MASTER_GAIN + clamp;
    // single/additive fixture paths do not, so this gain supplies it.
    // Scheduled WORKLET_MODE_SWITCH_SETTLE_SECONDS past `now`, not at `now`
    // itself — see that constant's doc for why raising gain in the same
    // instant the mode message is posted is unsafe.
    const now = this.context.currentTime;
    this.masterGain.gain.setValueAtTime(
      mode === 'routed' ? 1 : MASTER_GAIN,
      now + WORKLET_MODE_SWITCH_SETTLE_SECONDS,
    );
  }

  /**
   * Reads the current `InstrumentState` snapshot and posts exactly the
   * messages needed to bring the worklet's cached routing/parameters/
   * feedback up to date with it — never all three unconditionally
   * (Pitfall 5). Comparing each of the three fields independently against
   * `lastAppliedX` (rather than an all-or-nothing gate) is what keeps a
   * level/pitch edit from posting a routing-config message, and an
   * algorithm switch from re-posting an unchanged operator-parameters or
   * feedback snapshot: a level edit changes only `operators()`'s reference,
   * an algorithm switch changes only `algorithm()`'s reference, and a
   * feedback edit changes only `feedback()`'s value —
   * `instrument-state.ts`'s per-field spread-on-write contract guarantees
   * the other two stay reference/value-identical.
   *
   * Reading all three signals BEFORE the early `node === null` return is
   * load-bearing when this runs inside the constructor's `effect()`: an
   * effect that returns before reading a signal never registers it as a
   * dependency and would not re-run when that signal later changes — which
   * matters here because this method is called before the worklet node
   * exists (during the effect's first run) as well as after.
   */
  private applyInstrumentStateToWorklet(): void {
    const algorithm = this.instrumentState.algorithm();
    const operators = this.instrumentState.operators();
    const feedback = this.instrumentState.feedback();

    if (this.node === null) {
      return;
    }

    if (algorithm !== this.lastAppliedAlgorithm) {
      const routingConfig = buildRoutingConfig(algorithm);
      this.node.port.postMessage(setAlgorithmMessage(routingConfig.connections, routingConfig.carriers));
      this.lastAppliedAlgorithm = algorithm;
    }

    if (operators !== this.lastAppliedOperators) {
      this.node.port.postMessage(setOperatorParametersMessage(operators));
      this.lastAppliedOperators = operators;
    }

    if (feedback !== this.lastAppliedFeedback) {
      this.node.port.postMessage(setFeedbackMessage(feedback));
      this.lastAppliedFeedback = feedback;
    }
  }

  /** Validates first, then resolves the note frequency, posts the shared
   * frequency message and an open gate message carrying the raw velocity,
   * and records the held note. Performs no `AudioParam` scheduling of any
   * kind (Phase 9, D-02) — click-safe attack shaping now lives entirely in
   * the kernel's six per-operator envelope generators, reached through the
   * gate message. Silently no-ops when the graph has not been built
   * (`status()` is not `'ready'`). */
  noteOn(note: number, velocity: number): void {
    validateNote(note);
    validateVelocity(velocity);

    if (this.context === null || this.node === null) {
      return;
    }

    const frequencyHz = midiNoteToFrequency(note);

    this.node.port.postMessage(setFrequencyMessage(frequencyHz));
    this.node.port.postMessage(setGateMessage(true, velocity));
    this.heldNote = note;
    this.voiceActive = true;
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

  /** Posts a closed gate message with the minimum velocity — performs no
   * `AudioParam` scheduling of any kind (Phase 9, D-02). The kernel's
   * per-operator envelope release segments run from wherever each
   * envelope's level currently sits (D-04), which is what keeps this
   * click-free without any Web Audio ramp. */
  private releaseVoice(): void {
    if (this.context === null || this.node === null) {
      return;
    }
    this.node.port.postMessage(setGateMessage(false, MIN_VELOCITY));
  }

  destroy(): void {
    // Invalidates any initialize() still awaiting an async boundary — its
    // continuation must not resurrect 'ready'/'error' over what this call
    // is about to set (T-07-07). Also drops the cached in-flight promise so
    // a subsequent initialize() starts a fresh build instead of returning
    // this now-stale one.
    this.initializationGeneration += 1;
    this.pendingInitialize = null;

    // Release an in-flight note before tearing the graph down, rather than
    // just cutting it — mirrors the previous voice-gain cancel/silence
    // behaviour but through the gate message the kernel now understands.
    if (this.node !== null) {
      this.node.port.postMessage(setGateMessage(false, MIN_VELOCITY));
    }
    this.heldNote = null;
    this.voiceActive = false;

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
    this.masterGain?.disconnect();
    this.analyser?.disconnect();

    this.node = null;
    this.masterGain = null;
    this.analyser = null;
    this.lastAppliedAlgorithm = undefined;
    this.lastAppliedOperators = undefined;
    this.lastAppliedFeedback = undefined;
  }

  /** Returns the context's sample rate when a context exists, `0` otherwise
   * — used by a caller to convert a frequency-bin index into Hz. */
  getAnalysisSampleRate(): number {
    return this.context === null ? 0 : this.context.sampleRate;
  }

  /** `false` and untouched when there is no analyser yet (before
   * `initialize()`), no longer (after `destroy()`), or no voice has started
   * — initialization alone is not live audio. Key-up does not clear this:
   * envelope release still feeds the analyser. The same null-guard-then-return
   * convention every other method in this file already uses (T-10-02).
   * Buffer-length validation is intentionally not duplicated here: the
   * boundary type and the fake both enforce it, and adding a third check
   * would be a fourth place for the size convention to drift. */
  readTimeDomainInto(target: Uint8Array): boolean {
    if (this.analyser === null || !this.voiceActive) {
      return false;
    }
    this.analyser.getByteTimeDomainData(target);
    return true;
  }

  readFrequencyInto(target: Uint8Array): boolean {
    if (this.analyser === null || !this.voiceActive) {
      return false;
    }
    this.analyser.getByteFrequencyData(target);
    return true;
  }
}
