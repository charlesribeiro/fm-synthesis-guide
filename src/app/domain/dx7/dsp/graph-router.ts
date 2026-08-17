/**
 * Six-operator routed graph kernel (Phase 8, D-08/D-09/D-15/D-16 from
 * `08-CONTEXT.md`; ENGINE-02). Zero Angular imports, enforced by the
 * domain-purity ESLint gate (DOMAIN-04) — every formula here is
 * independently unit-testable in Node with no browser, no `AudioContext`,
 * and no jsdom Web Audio surface.
 *
 * This is the first module in `dsp/` deliberately allowed to bridge the
 * canonical 32-algorithm dataset into kernel configuration —
 * `additive-fixture.ts`'s header explains why *that* module deliberately
 * does NOT read `algorithms.ts`/`derive-role.ts` (Phase 8 was explicitly
 * deferred to be the place that does this translation); this module is
 * where that deferred work lands. `buildRoutingConfig` is the single
 * translation entry point — the worklet processor never re-derives roles
 * from algorithm data itself (D-14, CLAUDE.md's one-canonical-dataset
 * rule).
 *
 * This is an original phase-modulation routing implementation built toward
 * DX7-style behaviour, written from first principles on top of
 * `operator.ts`'s phase-accumulator kernel — never a transcription of, or
 * derived from, any DX7/Dexed source. It must never be described as an
 * exact DX7 emulation.
 */
import { planConnections, type OperatorConnection } from '../audio/patch-plan';
import {
  MASTER_GAIN,
  feedbackLevelToDepthHz,
  operatorFrequencyHz,
  outputLevelToAmplitude,
  outputLevelToModulationDepthHz,
  velocityToAmplitude,
} from '../audio/value-conversion';
import type { AlgorithmDefinition } from '../models/algorithm-definition';
import { deriveCarriers } from '../models/derive-role';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import { DEFAULT_PATCH, type OperatorParameterSet } from '../models/patch';
import { EnvelopeGenerator } from './envelope-generator';
import { PhaseModulatedOperator } from './operator';

/**
 * The fixed render order every algorithm in the canonical dataset resolves
 * against: descending operator id, `[6, 5, 4, 3, 2, 1]`. Every non-self-loop
 * edge in all 32 `ALGORITHMS` rows satisfies `from > to` (the
 * higher-modulates-lower invariant `validate-algorithm.ts` already enforces
 * at dataset-authoring time) — so walking ids in descending order guarantees
 * a modulator's block is always already rendered before the operator it
 * feeds, with no per-algorithm topological sort required.
 */
export const DESCENDING_OPERATOR_IDS: readonly OperatorId[] = Object.freeze([...OPERATOR_IDS].reverse());

/**
 * The kernel's own routing shape — a flat connection list plus the ordered
 * carrier set — produced once per algorithm by {@link buildRoutingConfig}
 * and handed to {@link GraphRouter.setRouting}. Deliberately structural
 * only: no operator parameters, no feedback depth (those are `patch`-level
 * concerns, applied through the router's other setters).
 */
export interface RoutingConfig {
  readonly connections: readonly OperatorConnection[];
  readonly carriers: readonly OperatorId[];
}

/**
 * The one translation from an `AlgorithmDefinition` (the canonical dataset
 * shape) to the kernel's `RoutingConfig` — delegates to the already-tested
 * `planConnections` (edge list + feedback flag) and `deriveCarriers`
 * (carrier-role derivation) rather than re-deriving either. This is the
 * only place in this phase that performs that derivation; the worklet
 * processor consumes only the already-translated result.
 */
export function buildRoutingConfig(algorithm: AlgorithmDefinition): RoutingConfig {
  return Object.freeze({
    connections: planConnections(algorithm),
    carriers: deriveCarriers(algorithm),
  });
}

/** Mirrors `additive-fixture.ts`'s `validateBlockSize` convention — reject
 * before allocation rather than let a bad value silently reach
 * `new Float32Array(blockSize)`. */
function validateBlockSize(blockSize: number): void {
  if (!Number.isInteger(blockSize) || blockSize <= 0) {
    throw new RangeError(`blockSize must be a finite positive integer, received ${blockSize}`);
  }
}

/** Index 0 is never read or written — operator ids are 1..6, and indexing a
 * plain array by id directly (rather than through a `Map`) is cheaper on the
 * render thread. */
const OPERATOR_TABLE_LENGTH = OPERATOR_IDS.length + 1;

/** Reads a `RoutingConfig`'s own `isFeedback` flag rather than re-deriving
 * the feedback operator from algorithm data — the config is already the
 * translated, authoritative shape by the time it reaches the router. */
function findFeedbackOperatorId(config: RoutingConfig): OperatorId | null {
  const feedbackConnection = config.connections.find((connection) => connection.isFeedback);
  return feedbackConnection ? feedbackConnection.from : null;
}

/**
 * The persistent six-operator routed kernel: one long-lived instance per
 * worklet processor, configured through `setRouting`/`setOperatorParameters`/
 * `setFeedbackLevel`/`setNoteFrequencyHz` and rendered one block at a time
 * through `render`. Every allocation happens once, in the constructor —
 * `render` never allocates (CLAUDE.md's audio rule; T-08-03).
 */
export class GraphRouter {
  private readonly blockSize: number;

  /** Length {@link OPERATOR_TABLE_LENGTH}; index 0 unused. */
  private readonly operatorsById: readonly PhaseModulatedOperator[];
  /** Length {@link OPERATOR_TABLE_LENGTH}; index 0 unused — one independent
   * `EnvelopeGenerator` per operator (Phase 9, D-01), constructed once
   * alongside `operatorsById`. */
  private readonly envelopesById: readonly EnvelopeGenerator[];
  /** Length {@link OPERATOR_TABLE_LENGTH}; index 0 unused. One persistent
   * block per operator, reused every render call. */
  private readonly operatorBlocks: readonly Float32Array[];
  /** Shared per-target modulation-accumulation scratch buffer, reset with
   * `.fill(0)` at the start of each operator's turn in `render`. */
  private readonly modulationAccumulator: Float32Array;
  /** Shared per-operator envelope-amplitude scratch buffer, allocated once
   * and overwritten every operator's turn in `render` (Phase 9) — mirrors
   * `modulationAccumulator`'s allocate-once-overwrite-every-call convention. */
  private readonly envelopeScratch: Float32Array;

  private readonly frequencyHzTable = new Float64Array(OPERATOR_TABLE_LENGTH);
  private readonly modulationIndexTable = new Float64Array(OPERATOR_TABLE_LENGTH);
  private readonly carrierAmplitudeTable = new Float64Array(OPERATOR_TABLE_LENGTH);

  private routingConfig: RoutingConfig = Object.freeze({ connections: [], carriers: [] });
  private feedbackOperatorId: OperatorId | null = null;
  private operatorParametersValue: OperatorParameterSet = DEFAULT_PATCH.operators;
  private feedbackLevel = 0;
  private noteFrequencyHzValue = 0;
  private feedbackIndexValue = 0;
  /** The velocity-derived output-stage amplitude multiplier (Phase 9, D-02).
   * Starts at `0` — load-bearing: a router that has never received a
   * `setGate(true, ...)` call renders silence even before any envelope has
   * advanced, which is what keeps the engine quiet at rest now that the
   * dedicated Web Audio voice gain node is gone. */
  private velocityAmplitude = 0;

  constructor(sampleRate: number, blockSize: number) {
    validateBlockSize(blockSize);
    this.blockSize = blockSize;

    const operators: PhaseModulatedOperator[] = [];
    const envelopes: EnvelopeGenerator[] = [];
    const blocks: Float32Array[] = [];
    for (let index = 0; index < OPERATOR_TABLE_LENGTH; index++) {
      operators.push(new PhaseModulatedOperator(sampleRate, 0));
      envelopes.push(new EnvelopeGenerator(sampleRate));
      blocks.push(new Float32Array(blockSize));
    }
    this.operatorsById = operators;
    this.envelopesById = envelopes;
    this.operatorBlocks = blocks;
    this.modulationAccumulator = new Float32Array(blockSize);
    this.envelopeScratch = new Float32Array(blockSize);
  }

  /**
   * Applies a new topology. Caches the feedback operator id read directly
   * from `config`'s own `isFeedback` flag (never re-derived from algorithm
   * data here), then resets phase and feedback history on all six operators
   * so a topology change that relocates the feedback operator cannot read a
   * stale previous sample belonging to a different topology (Pitfall 4,
   * T-08-04). Deliberately does NOT reset or re-gate `envelopesById` —
   * envelope state must survive a routing change so a held-note algorithm
   * switch re-patches the sound rather than restarting all six envelopes
   * with an audible pop (D-04, Phase 8 D-13).
   */
  setRouting(config: RoutingConfig): void {
    this.routingConfig = config;
    this.feedbackOperatorId = findFeedbackOperatorId(config);
    for (const id of OPERATOR_IDS) {
      this.operatorsById[id]!.resetPhase();
    }
    this.recomputeDerivedValues();
  }

  setOperatorParameters(operators: OperatorParameterSet): void {
    this.operatorParametersValue = operators;
    this.recomputeDerivedValues();
  }

  setFeedbackLevel(level: number): void {
    this.feedbackLevel = level;
    this.recomputeDerivedValues();
  }

  setNoteFrequencyHz(noteFrequencyHz: number): void {
    this.noteFrequencyHzValue = noteFrequencyHz;
    this.recomputeDerivedValues();
  }

  /**
   * The note-lifecycle entry point (Phase 9, D-01/D-02). Opening converts
   * `velocity` through `velocityToAmplitude` and stores it, then gates all
   * six envelope generators on; closing gates all six off and leaves the
   * stored velocity amplitude alone, so the release tail keeps the loudness
   * of the note being released. Deliberately does NOT call
   * `recomputeDerivedValues` — that method exists for discrete parameter,
   * routing, feedback and frequency changes, and an envelope's level changes
   * every sample, so it can never be a cached derived value.
   */
  setGate(open: boolean, velocity: number): void {
    if (open) {
      this.velocityAmplitude = velocityToAmplitude(velocity);
      for (const id of OPERATOR_IDS) {
        this.envelopesById[id]!.gateOn();
      }
    } else {
      for (const id of OPERATOR_IDS) {
        this.envelopesById[id]!.gateOff();
      }
    }
  }

  /**
   * Recomputes every derived per-operator value from the currently stored
   * routing/parameters/feedback/note-frequency — `render` never recomputes
   * anything itself.
   *
   * The modulation-index division is load-bearing:
   * `outputLevelToModulationDepthHz` returns a peak frequency deviation in
   * Hz (the unit Phase 5's oscillator engine needed), whereas this kernel
   * adds its modulation input directly to the phase argument in radians —
   * dividing by the modulating operator's own frequency converts Hz-of-
   * deviation into a dimensionless index, which is what the phase argument
   * needs. Using the Hz value unmodified would silently scale the
   * effective index by the modulator's own frequency. The feedback index
   * is computed the same way from {@link feedbackLevelToDepthHz}.
   *
   * Whenever an operator's resolved frequency is not finite or not greater
   * than zero, it is sanitised to `0` before `setFrequencyHz` (which would
   * otherwise throw on the render thread), and that operator's modulation
   * index — and, when it is the feedback operator, the feedback index — is
   * set to `0` rather than divided by an unusable frequency.
   */
  private recomputeDerivedValues(): void {
    const operators = this.operatorParametersValue;
    this.feedbackIndexValue = 0;

    for (const id of OPERATOR_IDS) {
      const parameters = operators[id];
      const enabledMultiplier = parameters.enabled ? 1 : 0;

      this.carrierAmplitudeTable[id] = outputLevelToAmplitude(parameters.outputLevel) * enabledMultiplier;

      const rawFrequencyHz = operatorFrequencyHz(parameters, this.noteFrequencyHzValue);
      const frequencyIsUsable = Number.isFinite(rawFrequencyHz) && rawFrequencyHz > 0;
      const frequencyHz = frequencyIsUsable ? rawFrequencyHz : 0;

      this.frequencyHzTable[id] = frequencyHz;
      this.operatorsById[id]!.setFrequencyHz(frequencyHz);
      // Deliberately does not reset level or segment index (EnvelopeGenerator.setEnvelope's
      // own contract) — a live operator-parameter edit re-targets a sounding
      // envelope without restarting it (D-04).
      this.envelopesById[id]!.setEnvelope(parameters.envelope);

      this.modulationIndexTable[id] = frequencyIsUsable
        ? (outputLevelToModulationDepthHz(parameters.outputLevel, frequencyHz) / frequencyHz) * enabledMultiplier
        : 0;

      if (frequencyIsUsable && id === this.feedbackOperatorId) {
        this.feedbackIndexValue =
          (feedbackLevelToDepthHz(this.feedbackLevel, frequencyHz) / frequencyHz) * enabledMultiplier;
      }
    }
  }

  /**
   * Renders exactly one block. Walks {@link DESCENDING_OPERATOR_IDS}: for
   * each operator id, accumulates every non-feedback incoming connection's
   * already-rendered source block (weighted by the source's own modulation
   * index) into the shared accumulator, then renders that operator's own
   * block — through `renderWithFeedback` when it is the cached feedback
   * operator (passing the accumulator through even then: "is the feedback
   * operator" and "has incoming edges" are never treated as mutually
   * exclusive), or through the plain `render` otherwise.
   *
   * Immediately after an operator's block is rendered and strictly before
   * that block is read by anything else, that operator's own
   * `EnvelopeGenerator` renders into the shared {@link envelopeScratch}
   * buffer and the block is multiplied by it sample for sample (Phase 9,
   * D-01). Placing the multiply here — outside `renderWithFeedback`'s own
   * body — is load-bearing twice over. First, the feedback delay line's
   * one-sample history (`PhaseModulatedOperator.previousSample`) keeps
   * reading the raw unscaled sample, so Phase 8's feedback correctness proof
   * survives untouched. Second, because the descending render order
   * guarantees a modulator's block is fully rendered before the operator it
   * feeds reads it, applying the envelope to the block here reaches both
   * consumers of that block — the carrier-summing loop below and the next
   * operator's modulation accumulation above. Neither derived table
   * (`modulationIndexTable`, `carrierAmplitudeTable`) is touched: folding
   * the envelope into either would make a modulator's envelope silently
   * inaudible, this phase's single highest-impact available mistake.
   *
   * Finally sums each carrier's already-enveloped block by its carrier
   * amplitude, multiplies by the stored {@link velocityAmplitude} (Phase 9,
   * D-02 — this is where velocity scaling lives now that the dedicated Web
   * Audio voice gain node that used to supply it is removed; the total gain
   * from carrier sum to destination is unchanged from Phase 8) and
   * {@link MASTER_GAIN}, and hard-clamps every sample to `[-1, 1]`. Both the
   * gain and the clamp live here — not only on a downstream Web Audio gain
   * node — for two reasons: the Vitest bounded-output proof in plan 08-02
   * never touches Web Audio, so nothing downstream of this method can be
   * relied on to bound the signal; and without the gain, a six-carrier
   * algorithm's raw sum reaches six, so a bound applied to the unnormalised
   * sum would clip ordinary playing rather than acting as a safety
   * ceiling. This scaling preserves Phase 5's already-approved loudness
   * exactly: six unity carriers reach one, not six. No other output shaping
   * of any kind is applied — no smooth transfer curve, no averaging on the
   * self-feedback path, no soft ceiling. The hard clamp is the only limiter
   * (D-07/D-08); it is not moved or duplicated by this phase's addition.
   */
  render(output: Float32Array): void {
    if (output.length !== this.blockSize) {
      throw new RangeError(
        `output.length must equal the configured block size ${this.blockSize}, received ${output.length}`,
      );
    }

    for (const id of DESCENDING_OPERATOR_IDS) {
      this.modulationAccumulator.fill(0);

      for (const connection of this.routingConfig.connections) {
        if (connection.isFeedback || connection.to !== id) {
          continue;
        }
        const sourceBlock = this.operatorBlocks[connection.from]!;
        const sourceIndex = this.modulationIndexTable[connection.from]!;
        for (let i = 0; i < this.blockSize; i++) {
          this.modulationAccumulator[i] += sourceBlock[i]! * sourceIndex;
        }
      }

      const block = this.operatorBlocks[id]!;
      if (id === this.feedbackOperatorId) {
        this.operatorsById[id]!.renderWithFeedback(block, this.feedbackIndexValue, this.modulationAccumulator);
      } else {
        this.operatorsById[id]!.render(block, this.modulationAccumulator);
      }

      this.envelopesById[id]!.render(this.envelopeScratch);
      for (let i = 0; i < this.blockSize; i++) {
        block[i] = block[i]! * this.envelopeScratch[i]!;
      }
    }

    output.fill(0);
    for (const carrierId of this.routingConfig.carriers) {
      const block = this.operatorBlocks[carrierId]!;
      const amplitude = this.carrierAmplitudeTable[carrierId]!;
      for (let i = 0; i < this.blockSize; i++) {
        output[i] += block[i]! * amplitude;
      }
    }

    for (let i = 0; i < this.blockSize; i++) {
      const scaled = output[i]! * this.velocityAmplitude * MASTER_GAIN;
      output[i] = Math.min(1, Math.max(-1, scaled));
    }
  }
}
