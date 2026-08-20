import { TestBed } from '@angular/core/testing';
import { InstrumentState, SNAPSHOT_SLOTS, type SnapshotSlot } from './instrument-state';
import { ALGORITHMS } from '../domain/dx7/models/algorithms';
import { deriveCarriers, getFeedbackOperator, getOperatorRole } from '../domain/dx7/models/derive-role';
import {
  DEFAULT_ENVELOPE,
  validateOperatorParameters,
  type Dx7Envelope,
} from '../domain/dx7/models/operator-parameters';
import { validateFeedbackLevel } from '../domain/dx7/models/patch';
import { OPERATOR_IDS, type OperatorId } from '../domain/dx7/models/operator';
import type { RandomSource } from '../domain/dx7/randomization/random-walk-patch';

/** A deterministic source that cycles through a fixed list of unit-interval values. */
function cyclingSource(values: readonly number[]): RandomSource {
  let index = 0;
  return () => {
    const value = values[index % values.length]!;
    index++;
    return value;
  };
}

describe('InstrumentState', () => {
  function setup() {
    TestBed.configureTestingModule({});
    return { service: TestBed.inject(InstrumentState) };
  }

  // D-11: a fresh facade reports the uniform default patch.
  it('reports the default patch on fresh injection', () => {
    const { service } = setup();

    expect(service.algorithmId()).toBe(1);
    expect(service.operators()[1].outputLevel).toBe(50);
  });

  // STATE-01 / ROADMAP SC1: setAlgorithm round-trips synchronously through
  // both the raw id selector and the resolved AlgorithmDefinition selector.
  it('round-trips an algorithm selection through algorithmId() and algorithm()', () => {
    const { service } = setup();
    const row32 = ALGORITHMS.find((a) => a.id === 32);
    if (!row32) {
      throw new Error('fixture assumption failed: ALGORITHMS has no row with id 32');
    }

    service.setAlgorithm(32);

    expect(service.algorithmId()).toBe(32);
    expect(service.algorithm().id).toBe(32);
    expect(service.algorithm().name).toBe(row32.name);
  });

  // STATE-02: updateOperator produces a new operators object; a
  // previously-captured reference is never mutated.
  it('updates one operator immutably, leaving a prior reference unchanged', () => {
    const { service } = setup();
    const before = service.operators();

    service.updateOperator(3, { outputLevel: 72 });

    expect(service.operators()[3].outputLevel).toBe(72);
    expect(before[3].outputLevel).toBe(50);
    expect(service.operators()).not.toBe(before);
  });

  // Phase 2 D-02: feedback() reads the depth value; setFeedback() writes it.
  it('reports feedback 0 by default and setFeedback(5) round-trips', () => {
    const { service } = setup();

    expect(service.feedback()).toBe(0);
    service.setFeedback(5);
    expect(service.feedback()).toBe(5);
  });

  // D-10: setFeedback rejects out-of-range/non-integer input without partially applying it.
  it('rejects an out-of-range or non-integer setFeedback call, leaving feedback() unchanged', () => {
    const { service } = setup();

    expect(() => service.setFeedback(8)).toThrow(RangeError);
    expect(() => service.setFeedback(-1)).toThrow(RangeError);
    expect(() => service.setFeedback(2.5)).toThrow(RangeError);
    expect(service.feedback()).toBe(0);
  });

  // STATE-02: a rejected updateOperator call must not partially apply.
  it('rejects an out-of-range updateOperator call, leaving the operator unchanged', () => {
    const { service } = setup();

    expect(() => service.updateOperator(1, { outputLevel: 120 })).toThrow(RangeError);
    expect(service.operators()[1].outputLevel).toBe(50);
  });

  // Regression: operatorId is a compile-time-restricted type, but a caller
  // can still bypass it with a cast or a value from outside TypeScript's
  // reach, so updateOperator must reject it at runtime too — mirroring
  // setAlgorithm's posture — before touching operators() or patch() at all.
  it('rejects an out-of-range or non-integer operatorId in updateOperator, leaving state unchanged', () => {
    const { service } = setup();
    const beforePatch = service.patch();
    const beforeOperators = service.operators();

    expect(() => service.updateOperator(0 as unknown as OperatorId, { outputLevel: 80 })).toThrow(RangeError);
    expect(() => service.updateOperator(7 as unknown as OperatorId, { outputLevel: 80 })).toThrow(RangeError);
    expect(() => service.updateOperator(1.5 as unknown as OperatorId, { outputLevel: 80 })).toThrow(RangeError);
    expect(service.patch()).toBe(beforePatch);
    expect(service.operators()).toBe(beforeOperators);
  });

  // STATE-01: setAlgorithm rejects an id absent from ALGORITHMS, leaving algorithmId() unchanged.
  it('rejects an out-of-range or non-integer setAlgorithm call, leaving algorithmId() unchanged', () => {
    const { service } = setup();

    expect(() => service.setAlgorithm(0)).toThrow(RangeError);
    expect(() => service.setAlgorithm(33)).toThrow(RangeError);
    expect(() => service.setAlgorithm(1.5)).toThrow(RangeError);
    expect(service.algorithmId()).toBe(1);
  });

  // Phase 2 D-05/D-07: carriers()/operatorRole() delegate to derive-role.ts, never stored.
  it('derives carriers() and operatorRole() from the selected algorithm via derive-role.ts', () => {
    const { service } = setup();
    const row32 = ALGORITHMS.find((a) => a.id === 32);
    if (!row32) {
      throw new Error('fixture assumption failed: ALGORITHMS has no row with id 32');
    }

    service.setAlgorithm(32);

    expect(service.carriers()).toEqual(deriveCarriers(row32));
    expect(service.operatorRole(6)).toBe(getOperatorRole(row32, 6));
  });

  // Phase 2 D-02: feedbackOperator() delegates to derive-role.ts's getFeedbackOperator.
  it('derives feedbackOperator() from the selected algorithm', () => {
    const { service } = setup();
    const row1 = ALGORITHMS.find((a) => a.id === 1);
    if (!row1) {
      throw new Error('fixture assumption failed: ALGORITHMS has no row with id 1');
    }

    expect(service.feedbackOperator()).toBe(getFeedbackOperator(row1));
  });

  // D-01 carryover: switching algorithm carries operator parameters over unchanged.
  it('carries operator parameters over unchanged (same reference) across setAlgorithm (D-01)', () => {
    const { service } = setup();
    service.updateOperator(2, { outputLevel: 80 });
    service.updateOperator(5, { detune: -3 });
    const operatorsBeforeSwitch = service.operators();

    service.setAlgorithm(7);

    expect(service.operators()[2].outputLevel).toBe(80);
    expect(service.operators()[5].detune).toBe(-3);
    expect(service.operators()).toBe(operatorsBeforeSwitch);
  });

  // D-02 carryover: switching algorithm carries the feedback depth over unchanged.
  it('carries feedback depth over unchanged across setAlgorithm (D-02)', () => {
    const { service } = setup();
    service.setFeedback(6);

    service.setAlgorithm(19);

    expect(service.feedback()).toBe(6);
  });

  // STATE-02: a previously captured patch snapshot is never mutated by later commands.
  it('never mutates a previously captured patch reference (STATE-02)', () => {
    const { service } = setup();
    const beforePatch = service.patch();
    const beforePatchClone = structuredClone(beforePatch);

    service.updateOperator(4, { ratio: 2 });
    service.setFeedback(3);

    expect(beforePatch).toEqual(beforePatchClone);
    expect(service.patch()).not.toBe(beforePatch);
  });

  // STATE-02: updateOperator must not disturb any operator other than its target.
  it('leaves every non-target operator reference-identical after updateOperator (STATE-02)', () => {
    const { service } = setup();
    const operator5Before = service.operators()[5];

    service.updateOperator(4, { ratio: 2 });

    expect(service.operators()[5]).toBe(operator5Before);
  });

  // STATE-02: an empty changes object still produces a new patch object, not a short-circuit.
  it('produces a new patch object for an empty updateOperator changes argument', () => {
    const { service } = setup();
    const patchBefore = service.patch();

    expect(() => service.updateOperator(4, {})).not.toThrow();

    expect(service.patch()).not.toBe(patchBefore);
  });

  it('deep-clones a supplied envelope so later mutation of the caller-owned object cannot change stored state', () => {
    const { service } = setup();
    const rates: [number, number, number, number] = [10, 20, 30, 40];
    const levels: [number, number, number, number] = [50, 60, 70, 0];
    const envelope: Dx7Envelope = { rates, levels };

    service.updateOperator(1, { envelope });
    rates[0] = 99;
    levels[1] = 11;

    expect(service.operators()[1].envelope.rates[0]).toBe(10);
    expect(service.operators()[1].envelope.levels[1]).toBe(60);
    expect(service.operators()[1].envelope).not.toBe(envelope);
  });

  // ROADMAP SC1: every selector resolves synchronously, no await, no fixture change detection.
  it('reflects a setAlgorithm call synchronously in the same block, with no await', () => {
    const { service } = setup();

    service.setAlgorithm(12);

    expect(service.algorithm().id).toBe(12);
    expect(service.carriers()).toEqual(deriveCarriers(service.algorithm()));
    expect(service.feedbackOperator()).toBe(getFeedbackOperator(service.algorithm()));
  });

  // D-03: a fresh facade reports both slots empty.
  it('reports both snapshot slots empty on fresh injection', () => {
    const { service } = setup();

    expect(service.hasSnapshot('a')).toBe(false);
    expect(service.hasSnapshot('b')).toBe(false);
    expect(service.snapshots()).toEqual({ a: null, b: null });
  });

  // Regression: slot is a compile-time-restricted type, but a caller can
  // still bypass it with a cast or a value from outside TypeScript's reach,
  // so captureSnapshot/recallSnapshot/hasSnapshot must reject it at runtime
  // too — mirroring updateOperator's operatorId posture — before touching
  // _snapshots or _patch at all.
  it('rejects a slot outside the fixed A/B contract in captureSnapshot, recallSnapshot, and hasSnapshot', () => {
    const { service } = setup();
    service.setFeedback(4);
    service.captureSnapshot('a');
    const beforePatch = service.patch();
    const beforeSnapshots = service.snapshots();

    expect(() => service.captureSnapshot('c' as unknown as SnapshotSlot)).toThrow(RangeError);
    expect(() => service.recallSnapshot('c' as unknown as SnapshotSlot)).toThrow(RangeError);
    expect(() => service.hasSnapshot('c' as unknown as SnapshotSlot)).toThrow(RangeError);
    expect(service.patch()).toBe(beforePatch);
    expect(service.snapshots()).toBe(beforeSnapshots);
  });

  // D-03 / STATE-03: capture/recall round-trips the full patch exactly.
  it('round-trips algorithm, operator parameters, and feedback through capture/recall (D-03)', () => {
    const { service } = setup();
    service.setAlgorithm(5);
    service.updateOperator(2, { outputLevel: 80 });
    service.setFeedback(4);
    service.captureSnapshot('a');

    service.setAlgorithm(30);
    service.updateOperator(2, { outputLevel: 10 });
    service.setFeedback(0);

    expect(service.recallSnapshot('a')).toBe(true);
    expect(service.algorithmId()).toBe(5);
    expect(service.operators()[2].outputLevel).toBe(80);
    expect(service.feedback()).toBe(4);
  });

  // D-03 / STATE-03: recall restores all six operators, not just the edited one.
  it('restores every operator id after recall, not only the edited one (D-03)', () => {
    const { service } = setup();
    service.updateOperator(2, { outputLevel: 80 });
    const capturedOperators = service.operators();
    service.captureSnapshot('a');

    service.updateOperator(1, { outputLevel: 1 });
    service.updateOperator(3, { outputLevel: 2 });
    service.updateOperator(4, { outputLevel: 3 });
    service.updateOperator(5, { outputLevel: 4 });
    service.updateOperator(6, { outputLevel: 5 });

    service.recallSnapshot('a');

    for (const id of [1, 2, 3, 4, 5, 6] as const) {
      expect(service.operators()[id]).toEqual(capturedOperators[id]);
    }
  });

  // D-03: capturing into 'a' does not affect 'b'.
  it('reports hasSnapshot true only for the captured slot (D-03)', () => {
    const { service } = setup();

    service.captureSnapshot('a');

    expect(service.hasSnapshot('a')).toBe(true);
    expect(service.hasSnapshot('b')).toBe(false);
  });

  // D-03: recalling a never-captured slot is a no-op that reports failure.
  it('returns false and leaves state unchanged when recalling a never-captured slot (D-03)', () => {
    const { service } = setup();
    service.setAlgorithm(9);
    service.updateOperator(3, { outputLevel: 42 });
    service.setFeedback(2);
    const algorithmIdBefore = service.algorithmId();
    const operatorsBefore = service.operators();
    const feedbackBefore = service.feedback();

    expect(service.recallSnapshot('b')).toBe(false);

    expect(service.algorithmId()).toBe(algorithmIdBefore);
    expect(service.operators()).toBe(operatorsBefore);
    expect(service.feedback()).toBe(feedbackBefore);
  });

  // D-03: capturing into an occupied slot overwrites it.
  it('overwrites a slot on a second capture (D-03)', () => {
    const { service } = setup();
    service.setFeedback(4);
    service.captureSnapshot('a');
    service.setFeedback(7);
    service.captureSnapshot('a');
    service.setFeedback(1);

    service.recallSnapshot('a');

    expect(service.feedback()).toBe(7);
  });

  // D-04 / D-11: reset restores the fixed default patch, asserted against literal values.
  it('restores the D-11 default patch literals on reset', () => {
    const { service } = setup();
    const editedEnvelope: Dx7Envelope = { rates: [10, 20, 30, 40], levels: [50, 60, 70, 0] };
    service.setAlgorithm(9);
    service.updateOperator(1, { outputLevel: 3, ratio: 2, detune: -5, envelope: editedEnvelope });
    service.setFeedback(6);

    service.reset();

    expect(service.algorithmId()).toBe(1);
    expect(service.feedback()).toBe(0);
    for (const id of [1, 2, 3, 4, 5, 6] as const) {
      expect(service.operators()[id]).toEqual({
        enabled: true,
        mode: 'ratio',
        ratio: 1,
        fixedFrequencyHz: 440,
        detune: 0,
        outputLevel: 50,
        envelope: DEFAULT_ENVELOPE,
      });
    }
  });

  // D-04: reset determinism — a heavily edited-then-reset service reports the same patch a
  // freshly injected service does, without instantiating two competing TestBed environments.
  it('produces a patch deep-equal to a fresh injection after reset (D-04)', () => {
    const { service } = setup();
    const freshPatch = service.patch();
    service.setAlgorithm(20);
    service.updateOperator(4, { outputLevel: 1 });
    service.setFeedback(7);

    service.reset();

    expect(service.patch()).toEqual(freshPatch);
  });

  // D-03: SNAPSHOT_SLOTS is exactly the two-member frozen array the type promises.
  it('freezes SNAPSHOT_SLOTS to exactly two entries, a and b', () => {
    expect(SNAPSHOT_SLOTS).toEqual(['a', 'b']);
    expect(() => (SNAPSHOT_SLOTS as unknown as SnapshotSlot[]).push('a')).toThrow();
  });

  // These regression tests protect the coupling between plan 01's immutable-update contract and
  // the exactness of A/B recall (T-03-05). captureSnapshot stores the current patch signal value
  // directly, with no clone — that is only sound because every command produces a new patch
  // object rather than mutating the previous one. If a future change makes a command mutate a
  // patch in place, these are the tests that must fail.
  describe('slot isolation and immutability regressions', () => {
    // D-03: capturing into 'b' must not disturb what 'a' already holds.
    it('keeps slot a unaffected by a later capture into slot b (D-03)', () => {
      const { service } = setup();
      service.setFeedback(4);
      service.captureSnapshot('a');
      service.setFeedback(7);
      service.captureSnapshot('b');

      expect(service.snapshots().a?.feedback).toBe(4);
      expect(service.snapshots().b?.feedback).toBe(7);
    });

    // D-03: recalling 'a' must not disturb what 'b' already holds.
    it('leaves slot b untouched by a recall of slot a (D-03)', () => {
      const { service } = setup();
      service.setFeedback(4);
      service.captureSnapshot('a');
      service.setFeedback(7);
      service.captureSnapshot('b');
      const bBeforeRecall = service.snapshots().b;

      service.recallSnapshot('a');

      expect(service.snapshots().b).toEqual(bBeforeRecall);
    });

    // STATE-02 x D-03: a captured snapshot is immune to edits made after the capture.
    it('keeps a captured snapshot unchanged by edits made after the capture (STATE-02, D-03)', () => {
      const { service } = setup();
      service.captureSnapshot('a');
      const capturedPatch = service.snapshots().a;

      service.updateOperator(3, { outputLevel: 90 });
      service.setFeedback(6);
      service.setAlgorithm(15);

      expect(service.snapshots().a).toEqual(capturedPatch);
      expect(service.snapshots().a).not.toBe(service.patch());
    });

    // Snapshot immunity after a recall: recall hands out an immutable value, not live state.
    it('keeps a snapshot unchanged by edits made after recalling it', () => {
      const { service } = setup();
      service.captureSnapshot('a');
      const capturedOutputLevel = service.snapshots().a?.operators[1].outputLevel;
      service.recallSnapshot('a');

      service.updateOperator(1, { outputLevel: 12 });

      expect(service.snapshots().a?.operators[1].outputLevel).toBe(capturedOutputLevel);
    });

    // D-04: reset must not clear or overwrite either slot.
    it('preserves both slots deep-equal across a reset (D-04)', () => {
      const { service } = setup();
      service.setFeedback(4);
      service.captureSnapshot('a');
      service.setFeedback(6);
      service.captureSnapshot('b');
      const aBefore = service.snapshots().a;
      const bBefore = service.snapshots().b;

      service.reset();

      expect(service.snapshots().a).toEqual(aBefore);
      expect(service.snapshots().b).toEqual(bBefore);
      expect(service.hasSnapshot('a')).toBe(true);
      expect(service.hasSnapshot('b')).toBe(true);
    });

    // D-04: reset does not invalidate the slots — recall after reset still works.
    it('still recalls a captured slot correctly after a reset (D-04)', () => {
      const { service } = setup();
      service.setFeedback(5);
      service.captureSnapshot('a');

      service.reset();

      expect(service.recallSnapshot('a')).toBe(true);
      expect(service.feedback()).toBe(5);
    });

    // STATE-03: recalling the same slot repeatedly is deterministic.
    it('produces the same patch on repeated recalls of the same slot (STATE-03)', () => {
      const { service } = setup();
      service.setFeedback(3);
      service.captureSnapshot('a');

      service.recallSnapshot('a');
      const firstRecallPatch = service.patch();
      service.updateOperator(2, { outputLevel: 33 });
      service.recallSnapshot('a');
      const secondRecallPatch = service.patch();

      expect(secondRecallPatch).toEqual(firstRecallPatch);
    });
  });

  // VIZ-02: InstrumentState.randomize()
  describe('randomize', () => {
    // D-13/VIZ-02: a bounded walk from an extreme source changes every operator and the feedback.
    it('changes at least one field on every operator and the feedback depth, relative to the prior patch', () => {
      const { service } = setup();
      const before = service.operators();
      const feedbackBefore = service.feedback();
      const source = cyclingSource([0.75, 0.9, 1, 0.8, 0.7, 0.85]);

      service.randomize(source);

      for (const id of OPERATOR_IDS) {
        expect(service.operators()[id]).not.toEqual(before[id]);
      }
      expect(service.feedback()).not.toBe(feedbackBefore);
    });

    it('leaves the patch unchanged when the source is the midpoint identity value 0.5', () => {
      const { service } = setup();
      const before = service.patch();

      service.randomize(() => 0.5);

      expect(service.patch()).toEqual(before);
    });

    // D-12: algorithmId is never touched by randomize, across varied sources.
    it('leaves algorithmId unchanged across 100 calls with varied sources', () => {
      const { service } = setup();
      const source = cyclingSource([0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1]);
      const algorithmIdBefore = service.algorithmId();

      for (let i = 0; i < 100; i++) {
        service.randomize(source);
      }

      expect(service.algorithmId()).toBe(algorithmIdBefore);
    });

    // T-10-01: every randomize() call produces a patch that independently passes both validators.
    it('never throws across 1000 calls, and the resulting patch always passes both validators', () => {
      const { service } = setup();
      const source = cyclingSource([0, 0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 1]);

      for (let i = 0; i < 1000; i++) {
        expect(() => service.randomize(source)).not.toThrow();
        for (const id of OPERATOR_IDS) {
          expect(() => validateOperatorParameters(service.operators()[id])).not.toThrow();
        }
        expect(() => validateFeedbackLevel(service.feedback())).not.toThrow();
      }
    });

    // Regression: randomize must be exactly one write to the patch signal, not one per operator.
    // A `computed` over the patch signal is lazy — it only recomputes on read, so it cannot by
    // itself distinguish "one set() call" from "six set() calls, only read once afterward."
    // Spying directly on the private `_patch` signal's own `set` method is what actually pins
    // "exactly one write": a future refactor to a per-operator write loop fails this test even
    // though every `computed`-based observation would look identical from the outside.
    it('performs exactly one write to the patch signal per call', () => {
      const { service } = setup();
      const patchSignal = (service as unknown as { _patch: { set: (value: unknown) => void } })._patch;
      const setSpy = vi.spyOn(patchSignal, 'set');

      service.randomize(() => 0.75);

      expect(setSpy).toHaveBeenCalledTimes(1);
    });

    // T-10-13 / D-14: randomize does not mutate the pre-call patch, and a snapshot captured
    // into slot A before randomize still deep-equals the pre-randomize patch afterward.
    it('does not mutate the pre-call patch, and leaves a captured slot A snapshot untouched', () => {
      const { service } = setup();
      service.captureSnapshot('a');
      const capturedPatch = service.snapshots().a;
      const prePatch = service.patch();
      const prePatchClone = structuredClone(prePatch);
      const hasSnapshotABefore = service.hasSnapshot('a');
      const hasSnapshotBBefore = service.hasSnapshot('b');

      service.randomize(() => 0.9);

      expect(prePatch).toEqual(prePatchClone);
      expect(service.snapshots().a).toEqual(capturedPatch);
      expect(service.hasSnapshot('a')).toBe(hasSnapshotABefore);
      expect(service.hasSnapshot('b')).toBe(hasSnapshotBBefore);

      expect(service.recallSnapshot('a')).toBe(true);
      expect(service.patch()).toEqual(capturedPatch);
    });

    // D-14: randomize does not change the snapshots signal contents at all.
    it('does not change hasSnapshot results across a randomize call', () => {
      const { service } = setup();

      expect(service.hasSnapshot('a')).toBe(false);
      expect(service.hasSnapshot('b')).toBe(false);

      service.randomize(() => 0.2);

      expect(service.hasSnapshot('a')).toBe(false);
      expect(service.hasSnapshot('b')).toBe(false);
    });

    // No-argument call uses the platform randomness source.
    it('with no argument uses the platform randomness source, producing an in-range, non-throwing patch', () => {
      const { service } = setup();

      expect(() => service.randomize()).not.toThrow();
      for (const id of OPERATOR_IDS) {
        expect(() => validateOperatorParameters(service.operators()[id])).not.toThrow();
      }
      expect(() => validateFeedbackLevel(service.feedback())).not.toThrow();
    });
  });
});
