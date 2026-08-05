import { Injectable, Signal, computed, signal } from '@angular/core';
import type { AlgorithmId } from '../domain/dx7/models/algorithm';
import type { AlgorithmDefinition } from '../domain/dx7/models/algorithm-definition';
import { ALGORITHMS } from '../domain/dx7/models/algorithms';
import { OPERATOR_IDS, isOperatorId, type OperatorId } from '../domain/dx7/models/operator';
import {
  validateOperatorParameters,
  type OperatorParameters,
} from '../domain/dx7/models/operator-parameters';
import {
  DEFAULT_PATCH,
  validateFeedbackLevel,
  type InstrumentPatch,
  type OperatorParameterSet,
} from '../domain/dx7/models/patch';
import {
  deriveCarriers,
  getFeedbackOperator,
  getOperatorRole,
  type OperatorRole,
} from '../domain/dx7/models/derive-role';

/**
 * D-03: the two named, independent A/B snapshot slots — not an undo stack
 * and not a dynamically keyed collection. Mirrors the `OperatorId`/
 * `OPERATOR_IDS` and `TeachingTag`/`TEACHING_TAGS` restricted-literal +
 * frozen-array convention already used across the domain layer, so "exactly
 * two slots" is a compile-time fact rather than a convention a future phase
 * could quietly widen.
 */
export type SnapshotSlot = 'a' | 'b';

export const SNAPSHOT_SLOTS: readonly SnapshotSlot[] = Object.freeze(['a', 'b']);

/**
 * Runtime membership guard for `SnapshotSlot`, mirroring `isOperatorId` in
 * `operator.ts`. `SnapshotSlot` is a compile-time-restricted type, but a
 * caller can still bypass it with a cast or a value from outside
 * TypeScript's reach — this is what the snapshot commands validate against
 * before touching `_snapshots` at all.
 */
export function isSnapshotSlot(value: string): value is SnapshotSlot {
  return SNAPSHOT_SLOTS.includes(value as SnapshotSlot);
}

/**
 * The two slots' current contents. `null` is how an uncaptured slot is
 * represented — deliberately no parallel `hasBeenCaptured` boolean field
 * that could disagree with it.
 */
export type SnapshotSlots = Readonly<Record<SnapshotSlot, InstrumentPatch | null>>;

const EMPTY_SNAPSHOT_SLOTS: SnapshotSlots = Object.freeze({ a: null, b: null });

/** O(1) selected-algorithm lookup — `ALGORITHMS` has no by-id helper of its own. */
const ALGORITHMS_BY_ID: ReadonlyMap<AlgorithmId, AlgorithmDefinition> = new Map(
  ALGORITHMS.map((algorithm) => [algorithm.id, algorithm]),
);

function resolveAlgorithm(algorithmId: AlgorithmId): AlgorithmDefinition {
  const algorithm = ALGORITHMS_BY_ID.get(algorithmId);
  if (!algorithm) {
    throw new RangeError(`algorithmId ${algorithmId} is not a known algorithm (expected 1..32)`);
  }
  return algorithm;
}

/**
 * Signal-based facade over the in-memory instrument patch (STATE-01,
 * STATE-02): the selected algorithm, all six operators' parameters, and the
 * global feedback depth, as read-only selectors, updated only through
 * explicit immutable command methods. Mirrors `MotionPreference`'s private
 * `WritableSignal` + `.asReadonly()` pattern — the only difference is that
 * writes here come from explicit command methods, not an external browser
 * event.
 *
 * D-01/D-02 carryover contract: switching the selected algorithm (`
 * setAlgorithm`) changes only routing/role interpretation. The six
 * operators' parameters and the feedback depth are untouched — the same six
 * physical operators exist under every algorithm on a real DX7, and the
 * feedback depth is an instrument-level value, not owned by any one
 * algorithm.
 *
 * Operator role, the carrier set, and the feedback-owning operator are
 * derived on every read from `derive-role.ts` against the currently
 * selected `AlgorithmDefinition` (Phase 2 D-05/D-07) — never cached as
 * state here, so they cannot drift from the edge list they summarize.
 * `feedback` is the depth value only; `feedbackOperator` is the derived
 * answer to *which* operator that depth applies to.
 *
 * D-05: A/B snapshots and `reset` are in-memory only for this phase — there
 * is no persistence across a page reload. Versioned storage and
 * import/export are PERSIST-01's job (Phase 12); an ad hoc version added
 * here would have to be removed.
 */
@Injectable({ providedIn: 'root' })
export class InstrumentState {
  private readonly _patch = signal<InstrumentPatch>(DEFAULT_PATCH);

  /** Read-only: the full current patch (algorithm id + operators + feedback). */
  readonly patch: Signal<InstrumentPatch> = this._patch.asReadonly();

  private readonly _snapshots = signal<SnapshotSlots>(EMPTY_SNAPSHOT_SLOTS);

  /** Read-only: the current contents of the A/B snapshot slots (D-03). */
  readonly snapshots: Signal<SnapshotSlots> = this._snapshots.asReadonly();

  /** Read-only: the id of the currently selected algorithm. */
  readonly algorithmId: Signal<AlgorithmId> = computed(() => this._patch().algorithmId);

  /** Read-only: the resolved `AlgorithmDefinition` for the selected id. */
  readonly algorithm: Signal<AlgorithmDefinition> = computed(() => resolveAlgorithm(this.algorithmId()));

  /** Read-only: all six operators' current parameters. */
  readonly operators: Signal<OperatorParameterSet> = computed(() => this._patch().operators);

  /** Read-only: the instrument-level feedback depth (0-7). */
  readonly feedback: Signal<number> = computed(() => this._patch().feedback);

  /**
   * Read-only, derived (Phase 2 D-05/D-07): the operator ids that are
   * carriers under the currently selected algorithm, in ascending order.
   */
  readonly carriers: Signal<readonly OperatorId[]> = computed(() => deriveCarriers(this.algorithm()));

  /**
   * Read-only, derived: the operator carrying the currently selected
   * algorithm's feedback self-loop, or `null` when the algorithm has none.
   */
  readonly feedbackOperator: Signal<OperatorId | null> = computed(() => getFeedbackOperator(this.algorithm()));

  /**
   * Derived role for one operator under the currently selected algorithm.
   * A method rather than a signal because it is parameterized by operator
   * id — it reads `algorithm()` internally, so it stays reactive when
   * called from a template or another `computed`.
   */
  operatorRole(operatorId: OperatorId): OperatorRole {
    return getOperatorRole(this.algorithm(), operatorId);
  }

  /**
   * Selects a different algorithm. Rejects an id absent from `ALGORITHMS`
   * with a `RangeError` naming the id, leaving state untouched. Per
   * D-01/D-02, only `algorithmId` changes — `operators` and `feedback`
   * carry over unchanged via the spread below.
   */
  setAlgorithm(algorithmId: AlgorithmId): void {
    resolveAlgorithm(algorithmId); // throws RangeError before any write on an unknown id
    const previous = this._patch();
    this._patch.set({ ...previous, algorithmId });
  }

  /**
   * Immutably updates one operator's parameters (STATE-02). Validates
   * `operatorId` and `changes` first — before reading or writing any state —
   * so a rejected call never partially applies: the new patch, the new
   * operators record, and the new parameters object for `operatorId` are all
   * newly created; every other operator's parameters object stays
   * reference-identical to the one read before the call. `operatorId` is a
   * compile-time-restricted type, but it is still validated at runtime
   * (matching `setAlgorithm`'s posture) since a caller can bypass the type
   * system with a cast or a value from outside TypeScript's reach.
   */
  updateOperator(operatorId: OperatorId, changes: Partial<OperatorParameters>): void {
    if (!isOperatorId(operatorId)) {
      throw new RangeError(`operatorId must be one of ${OPERATOR_IDS.join(', ')}, received ${operatorId}`);
    }
    validateOperatorParameters(changes);
    const previous = this._patch();
    const previousOperatorParameters = previous.operators[operatorId];
    const nextOperatorParameters: OperatorParameters = { ...previousOperatorParameters, ...changes };
    const nextOperators = { ...previous.operators, [operatorId]: nextOperatorParameters } as OperatorParameterSet;
    this._patch.set({ ...previous, operators: nextOperators });
  }

  /**
   * Sets the instrument-level feedback depth. Validates first so a rejected
   * call leaves `feedback()` unchanged.
   */
  setFeedback(level: number): void {
    validateFeedbackLevel(level);
    const previous = this._patch();
    this._patch.set({ ...previous, feedback: level });
  }

  /**
   * D-03: captures the current patch into the given slot, overwriting
   * whatever it previously held. Validates `slot` first — before touching
   * `_snapshots` at all — since `SnapshotSlot` is a compile-time-restricted
   * type a caller can still bypass with a cast (matching `updateOperator`'s
   * posture). No cloning: plan 01's immutable-update contract guarantees
   * every command produces a new patch object rather than mutating the
   * previous one, so the stored reference can never change out from under
   * the slot after this call — that coupling is what makes capture exact by
   * construction, and it is what the isolation tests in this plan's Task 2
   * exist to protect.
   */
  captureSnapshot(slot: SnapshotSlot): void {
    if (!isSnapshotSlot(slot)) {
      throw new RangeError(`slot must be one of ${SNAPSHOT_SLOTS.join(', ')}, received ${slot}`);
    }
    const currentPatch = this._patch();
    this._snapshots.set({ ...this._snapshots(), [slot]: currentPatch });
  }

  /**
   * D-03: restores the given slot's captured patch, or does nothing and
   * returns `false` when the slot has never been captured (an uncaptured
   * slot is a legitimate user-reachable state, not a programmer error).
   * Rejects a `slot` outside the fixed A/B contract with a `RangeError`
   * before reading `_snapshots`, distinct from the never-captured case.
   * Recall does not clear or alter the slot, so the same snapshot can be
   * recalled repeatedly.
   */
  recallSnapshot(slot: SnapshotSlot): boolean {
    if (!isSnapshotSlot(slot)) {
      throw new RangeError(`slot must be one of ${SNAPSHOT_SLOTS.join(', ')}, received ${slot}`);
    }
    const storedPatch = this._snapshots()[slot];
    if (storedPatch === null) {
      return false;
    }
    this._patch.set(storedPatch);
    return true;
  }

  /** D-03: whether the given slot currently holds a captured patch. Rejects a `slot` outside the fixed A/B contract with a `RangeError`. */
  hasSnapshot(slot: SnapshotSlot): boolean {
    if (!isSnapshotSlot(slot)) {
      throw new RangeError(`slot must be one of ${SNAPSHOT_SLOTS.join(', ')}, received ${slot}`);
    }
    return this._snapshots()[slot] !== null;
  }

  /**
   * D-04: resets the patch to the fixed `DEFAULT_PATCH` and touches nothing
   * else — reset is a third action independent of A and B, always
   * restoring the same default regardless of what the slots hold, and
   * never overwriting them. Because it assigns the very same `DEFAULT_PATCH`
   * constant that seeds this facade's initial state, post-reset state is
   * identical to first-load state by construction rather than by a
   * parallel definition that could drift.
   */
  reset(): void {
    this._patch.set(DEFAULT_PATCH);
  }
}

