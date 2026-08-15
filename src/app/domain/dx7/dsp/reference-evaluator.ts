/**
 * Independent recursive reference evaluator (Phase 8 plan 08-02, D-10;
 * ENGINE-02). Zero Angular imports, enforced by the same domain-purity
 * ESLint gate (DOMAIN-04) every sibling in `dsp/` is held to.
 *
 * This module exists to be the *second*, separately-derived side of a
 * two-implementation correctness proof (`algorithm-routing.spec.ts`'s
 * 32-row cross-check). It must never import from `./graph-router.ts` (the
 * implementation under test), from `../models/derive-role.ts` (the
 * canonical carrier/feedback role derivation `graph-router.ts` itself
 * calls), or from `../audio/patch-plan.ts` (the connection planner
 * `graph-router.ts` also calls). Those three modules are already proven in
 * isolation by Phase 2's and Phase 5's own suites — this evaluator's job is
 * to catch a bug in `GraphRouter`'s own graph-to-render translation, and
 * calling into any of that same shared code would let a bug shared between
 * the two implementations pass both sides of the cross-check, defeating the
 * entire purpose of an independent second implementation.
 *
 * It is test-only: nothing outside a `.spec.ts` file imports it. Because it
 * never runs on the audio render thread, it may recompute freely — the
 * no-allocation-in-the-render-loop rule (CLAUDE.md's audio rule) targets the
 * real-time worklet render loop, not a Vitest-only evaluator that runs once
 * per test case.
 *
 * This is an original implementation, written from first principles
 * (a per-sample recursive phase-modulation evaluation over `algorithm.edges`
 * directly), structurally different from `GraphRouter`'s iterative
 * per-block descending sweep. It is never derived from, and must never be
 * described as, an exact DX7 emulation, nor from any DX7 ROM disassembly or
 * from Dexed (GPLv3) source.
 */
import type { AlgorithmDefinition } from '../models/algorithm-definition';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';

/** The two-sided hard output bound `GraphRouter.render` also applies —
 * mirrored here as a structural constant, not imported, since importing it
 * from `graph-router.ts` would violate this module's independence. */
const OUTPUT_BOUND = 1;

/**
 * The full parameter set both sides of the cross-check evaluate against.
 * Every numeric field is already resolved to the units this evaluator's
 * per-sample math needs directly (Hz, dimensionless modulation index,
 * linear amplitude) — no DX7-integer-scale conversion happens inside this
 * module.
 */
export interface ReferenceEvaluationInput {
  readonly sampleRate: number;
  readonly blockSize: number;
  readonly operatorFrequenciesHz: Readonly<Record<OperatorId, number>>;
  readonly modulationIndices: Readonly<Record<OperatorId, number>>;
  readonly carrierAmplitudes: Readonly<Record<OperatorId, number>>;
  readonly feedbackIndex: number;
  readonly outputGain: number;
}

/** True when `operatorId` has an edge to a *different* operator — the
 * negation of this is the carrier test (mirrors `derive-role.ts`'s own
 * documented rule, re-derived independently here rather than imported): a
 * self-loop alone must never disqualify an operator from being a carrier,
 * the exact subtlety Algorithm 32's operator 6 depends on. */
function modulatesAnotherOperator(algorithm: AlgorithmDefinition, operatorId: OperatorId): boolean {
  return algorithm.edges.some((edge) => edge.from === operatorId && edge.to !== operatorId);
}

/** Every operator id whose only outgoing edges (if any) are its own
 * self-loop — i.e. every carrier under the rule above. */
function carriersOf(algorithm: AlgorithmDefinition): readonly OperatorId[] {
  return OPERATOR_IDS.filter((id) => !modulatesAnotherOperator(algorithm, id));
}

/** Every operator id that modulates `operatorId` from a *different*
 * operator (never includes `operatorId` itself — that is the self-loop
 * case, handled separately by {@link hasSelfLoop}). */
function incomingModulatorsOf(algorithm: AlgorithmDefinition, operatorId: OperatorId): readonly OperatorId[] {
  return algorithm.edges
    .filter((edge) => edge.to === operatorId && edge.from !== operatorId)
    .map((edge) => edge.from);
}

/** True when `operatorId` carries the algorithm's feedback self-loop. */
function hasSelfLoop(algorithm: AlgorithmDefinition, operatorId: OperatorId): boolean {
  return algorithm.edges.some((edge) => edge.from === operatorId && edge.to === operatorId);
}

function clamp(value: number): number {
  return Math.min(OUTPUT_BOUND, Math.max(-OUTPUT_BOUND, value));
}

/**
 * Renders `input.blockSize` samples for `algorithm` by recursively
 * evaluating each carrier's contribution sample by sample, entirely from
 * `algorithm.edges` — never from `GraphRouter`, `derive-role.ts`, or
 * `patch-plan.ts`.
 *
 * For each sample index `i` (ascending, so a self-loop's feedback history
 * is always the previous sample's already-computed value), an inner
 * `sampleAt(id, i)` computes operator `id`'s phase as
 * `((frequencyHz[id] * i) / sampleRate) % 1`, sums
 * `sampleAt(modulatorId, i) * modulationIndices[modulatorId]` over every
 * incoming modulator from a *different* operator, adds
 * `feedbackIndex * feedbackHistory[id]` when `id` carries the self-loop
 * (zero at `i = 0`, since no sample has been produced yet), evaluates
 * `Math.sin(2 * Math.PI * phase + modulation)`, and — when `id` carries the
 * self-loop — writes the result back into `feedbackHistory[id]` for the
 * next sample index to read.
 *
 * `Math.fround` is applied to each operator's returned sample and to each
 * accumulated modulation total. This mirrors the router's own
 * `Float32Array`-backed storage precision only — it is not shared code and
 * does not weaken this evaluator's independence from `GraphRouter`'s
 * implementation. It matters because a five-deep modulation chain amplifies
 * a single-precision rounding difference by roughly the product of the
 * chain's modulation indices; without mirroring that same rounding here,
 * the cross-check's tight tolerance would fail for a reason that is storage
 * precision, not a routing bug.
 */
export function evaluateAlgorithmReference(
  algorithm: AlgorithmDefinition,
  input: ReferenceEvaluationInput,
): Float32Array {
  const { sampleRate, blockSize, operatorFrequenciesHz, modulationIndices, carrierAmplitudes, feedbackIndex, outputGain } =
    input;

  const carriers = carriersOf(algorithm);
  const incomingByOperator = new Map<OperatorId, readonly OperatorId[]>(
    OPERATOR_IDS.map((id) => [id, incomingModulatorsOf(algorithm, id)]),
  );
  const selfLoopByOperator = new Map<OperatorId, boolean>(OPERATOR_IDS.map((id) => [id, hasSelfLoop(algorithm, id)]));

  // Per-operator one-sample feedback history, initialised to zero for every
  // id (D-06's true one-sample delay — sample_(-1) = 0).
  const feedbackHistory = new Map<OperatorId, number>(OPERATOR_IDS.map((id) => [id, 0]));

  const output = new Float32Array(blockSize);

  for (let sampleIndex = 0; sampleIndex < blockSize; sampleIndex++) {
    // Per-sample cache so each operator's value is computed once even when
    // it feeds more than one downstream modulator target within the same
    // sample index.
    const samplesThisIndex = new Map<OperatorId, number>();

    const sampleAt = (id: OperatorId): number => {
      const cached = samplesThisIndex.get(id);
      if (cached !== undefined) {
        return cached;
      }

      const frequencyHz = operatorFrequenciesHz[id];
      const phase = ((frequencyHz * sampleIndex) / sampleRate) % 1;

      let modulation = 0;
      for (const modulatorId of incomingByOperator.get(id)!) {
        modulation += sampleAt(modulatorId) * modulationIndices[modulatorId];
      }
      if (selfLoopByOperator.get(id)) {
        modulation += feedbackIndex * feedbackHistory.get(id)!;
      }
      modulation = Math.fround(modulation);

      const sample = Math.fround(Math.sin(2 * Math.PI * phase + modulation));
      samplesThisIndex.set(id, sample);
      if (selfLoopByOperator.get(id)) {
        feedbackHistory.set(id, sample);
      }
      return sample;
    };

    let carrierSum = 0;
    for (const carrierId of carriers) {
      carrierSum += sampleAt(carrierId) * carrierAmplitudes[carrierId];
    }
    output[sampleIndex] = clamp(carrierSum * outputGain);
  }

  return output;
}
