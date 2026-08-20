import { ALGORITHMS } from '../models/algorithms';
import { MAX_FEEDBACK_LEVEL, MIN_FEEDBACK_LEVEL, type OperatorParameterSet } from '../models/patch';
import { DEFAULT_PATCH } from '../models/patch';
import { planConnections } from '../audio/patch-plan';
import { deriveCarriers } from '../models/derive-role';
import type { OperatorId } from '../models/operator';
import {
  COARSE_RATIOS,
  ENVELOPE_SEGMENT_COUNT,
  MAX_DETUNE,
  MAX_ENVELOPE_LEVEL,
  MAX_ENVELOPE_RATE,
  MAX_OUTPUT_LEVEL,
  MIN_DETUNE,
  MIN_ENVELOPE_LEVEL,
  MIN_ENVELOPE_RATE,
  MIN_OUTPUT_LEVEL,
} from '../models/operator-parameters';
import { MAX_VELOCITY, MIN_VELOCITY } from '../audio/value-conversion';
import {
  DX7_OPERATOR_PROCESSOR_NAME,
  MAX_OPERATOR_FREQUENCY_HZ,
  WORKLET_RENDER_MODES,
  parseWorkletMessage,
  setAlgorithmMessage,
  setFeedbackMessage,
  setFrequencyMessage,
  setGateMessage,
  setModeMessage,
  setOperatorParametersMessage,
} from './worklet-messages';

const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
const validConnections = planConnections(algorithm1);
const validCarriers = deriveCarriers(algorithm1);
const validOperators = DEFAULT_PATCH.operators;

describe('DX7_OPERATOR_PROCESSOR_NAME', () => {
  it('is the literal registered processor name', () => {
    expect(DX7_OPERATOR_PROCESSOR_NAME).toBe('dx7-operator');
  });
});

describe('setFrequencyMessage / setModeMessage / setAlgorithmMessage / setOperatorParametersMessage / setFeedbackMessage', () => {
  it('builds a well-formed setFrequency message', () => {
    expect(setFrequencyMessage(440)).toEqual({ kind: 'setFrequency', frequencyHz: 440 });
  });

  it('builds a well-formed setMode message', () => {
    expect(setModeMessage('additive')).toEqual({ kind: 'setMode', mode: 'additive' });
  });

  it('builds a well-formed setAlgorithm message', () => {
    expect(setAlgorithmMessage(validConnections, validCarriers)).toEqual({
      kind: 'setAlgorithm',
      connections: validConnections,
      carriers: validCarriers,
    });
  });

  it('builds a well-formed setOperatorParameters message', () => {
    expect(setOperatorParametersMessage(validOperators)).toEqual({
      kind: 'setOperatorParameters',
      operators: validOperators,
    });
  });

  it('builds a well-formed setFeedback message', () => {
    expect(setFeedbackMessage(4)).toEqual({ kind: 'setFeedback', level: 4 });
  });

  it('builds a well-formed setGate message', () => {
    expect(setGateMessage(true, 64)).toEqual({ kind: 'setGate', open: true, velocity: 64 });
    expect(setGateMessage(false, MIN_VELOCITY)).toEqual({ kind: 'setGate', open: false, velocity: MIN_VELOCITY });
  });
});

describe('parseWorkletMessage', () => {
  it('returns a typed message for a valid setFrequency payload', () => {
    expect(parseWorkletMessage({ kind: 'setFrequency', frequencyHz: 440 })).toEqual(
      setFrequencyMessage(440),
    );
  });

  it('returns a typed message for a valid setMode payload', () => {
    expect(parseWorkletMessage({ kind: 'setMode', mode: 'additive' })).toEqual(
      setModeMessage('additive'),
    );
  });

  it('accepts every entry in WORKLET_RENDER_MODES', () => {
    for (const mode of WORKLET_RENDER_MODES) {
      expect(parseWorkletMessage({ kind: 'setMode', mode })).toEqual(setModeMessage(mode));
    }
  });

  it('returns a typed message for a valid setAlgorithm payload', () => {
    expect(parseWorkletMessage({ kind: 'setAlgorithm', connections: validConnections, carriers: validCarriers })).toEqual(
      setAlgorithmMessage(validConnections, validCarriers),
    );
  });

  it('returns a typed message for a valid setOperatorParameters payload', () => {
    expect(parseWorkletMessage({ kind: 'setOperatorParameters', operators: validOperators })).toEqual(
      setOperatorParametersMessage(validOperators),
    );
  });

  it('parseWorkletMessage({ kind: "setFeedback", level: 8 }) returns null and level: 7 returns a typed message', () => {
    expect(parseWorkletMessage({ kind: 'setFeedback', level: MAX_FEEDBACK_LEVEL + 1 })).toBeNull();
    expect(parseWorkletMessage({ kind: 'setFeedback', level: MAX_FEEDBACK_LEVEL })).toEqual(
      setFeedbackMessage(MAX_FEEDBACK_LEVEL),
    );
  });

  it('returns a typed gate message for a well-formed setGate payload, and null for a non-boolean open flag', () => {
    expect(parseWorkletMessage({ kind: 'setGate', open: true, velocity: 64 })).toEqual(setGateMessage(true, 64));
    expect(parseWorkletMessage({ kind: 'setGate', open: 'yes', velocity: 64 })).toBeNull();
  });

  const rejectedPayloads: readonly { readonly name: string; readonly payload: unknown }[] = [
    { name: 'undefined', payload: undefined },
    { name: 'null', payload: null },
    { name: 'a number', payload: 42 },
    { name: 'a string', payload: 'setFrequency' },
    { name: 'an array', payload: [] },
    { name: 'an empty object', payload: {} },
    { name: 'an unknown kind', payload: { kind: 'noteOn' } },
    { name: 'setFrequency missing frequencyHz', payload: { kind: 'setFrequency' } },
    { name: 'setFrequency with a string frequencyHz', payload: { kind: 'setFrequency', frequencyHz: '440' } },
    { name: 'setFrequency with a NaN frequencyHz', payload: { kind: 'setFrequency', frequencyHz: NaN } },
    { name: 'setFrequency with an Infinity frequencyHz', payload: { kind: 'setFrequency', frequencyHz: Infinity } },
    { name: 'setFrequency with a zero frequencyHz', payload: { kind: 'setFrequency', frequencyHz: 0 } },
    { name: 'setFrequency with a negative frequencyHz', payload: { kind: 'setFrequency', frequencyHz: -440 } },
    {
      name: 'setFrequency above MAX_OPERATOR_FREQUENCY_HZ',
      payload: { kind: 'setFrequency', frequencyHz: MAX_OPERATOR_FREQUENCY_HZ + 1 },
    },
    { name: "setMode with an unknown mode ('sideways')", payload: { kind: 'setMode', mode: 'sideways' } },
    { name: 'setAlgorithm missing carriers', payload: { kind: 'setAlgorithm', connections: validConnections } },
    {
      name: 'setAlgorithm with an empty carriers array',
      payload: { kind: 'setAlgorithm', connections: validConnections, carriers: [] },
    },
    {
      name: 'setAlgorithm with a connection carrying an out-of-range operator id',
      payload: { kind: 'setAlgorithm', connections: [{ from: 7, to: 1, isFeedback: false }], carriers: validCarriers },
    },
    {
      name: 'setAlgorithm with a connection missing isFeedback',
      payload: { kind: 'setAlgorithm', connections: [{ from: 2, to: 1 }], carriers: validCarriers },
    },
    { name: 'setOperatorParameters missing an operator id entry', payload: { kind: 'setOperatorParameters', operators: {} } },
    {
      name: 'setOperatorParameters with an out-of-range outputLevel',
      payload: {
        kind: 'setOperatorParameters',
        operators: { ...validOperators, 1: { ...validOperators[1], outputLevel: 999 } },
      },
    },
    { name: 'setFeedback missing level', payload: { kind: 'setFeedback' } },
    { name: 'setFeedback with a non-integer level', payload: { kind: 'setFeedback', level: 3.5 } },
    { name: 'setFeedback below MIN_FEEDBACK_LEVEL', payload: { kind: 'setFeedback', level: MIN_FEEDBACK_LEVEL - 1 } },
    { name: 'setGate missing open', payload: { kind: 'setGate', velocity: 64 } },
    { name: 'setGate with a non-boolean open', payload: { kind: 'setGate', open: 'true', velocity: 64 } },
    { name: 'setGate missing velocity', payload: { kind: 'setGate', open: true } },
    { name: 'setGate with a non-integer velocity', payload: { kind: 'setGate', open: true, velocity: 64.5 } },
    { name: 'setGate with velocity below MIN_VELOCITY', payload: { kind: 'setGate', open: true, velocity: MIN_VELOCITY - 1 } },
    { name: 'setGate with velocity above MAX_VELOCITY', payload: { kind: 'setGate', open: true, velocity: MAX_VELOCITY + 1 } },
  ];

  it.each(rejectedPayloads)('returns null and throws nothing for $name', ({ payload }) => {
    expect(() => parseWorkletMessage(payload)).not.toThrow();
    expect(parseWorkletMessage(payload)).toBeNull();
  });

  it('returns null and throws nothing for a payload whose `kind` getter throws', () => {
    const hostilePayload = {
      get kind(): string {
        throw new Error('hostile getter');
      },
    };

    expect(() => parseWorkletMessage(hostilePayload)).not.toThrow();
    expect(parseWorkletMessage(hostilePayload)).toBeNull();
  });
});

/**
 * The tables below are Phase 8's hostile-payload matrix (T-08-01) for the
 * three message kinds widened for the routed path: `setAlgorithm`,
 * `setOperatorParameters`, `setFeedback`. These payloads are authored by
 * this project's own code on both ends of the boundary and are not
 * attacker-controlled — the discipline exists because a single non-finite
 * value entering a per-sample recurrence persists for every subsequent
 * sample on the audio render thread, so a silent own-code defect is exactly
 * as costly to let through as a hostile one would be.
 */

describe('parseWorkletMessage — hostile-payload matrix for setAlgorithm (T-08-01)', () => {
  const rejectedRoutingConfigPayloads: readonly { readonly name: string; readonly payload: unknown }[] = [
    { name: 'connections absent', payload: { kind: 'setAlgorithm', carriers: validCarriers } },
    {
      name: 'connections not an array',
      payload: { kind: 'setAlgorithm', connections: 'not-an-array', carriers: validCarriers },
    },
    {
      name: 'connections containing a non-object entry',
      payload: { kind: 'setAlgorithm', connections: [null], carriers: validCarriers },
    },
    {
      name: 'a connection entry whose from is not a legal operator id',
      payload: { kind: 'setAlgorithm', connections: [{ from: 7, to: 1, isFeedback: false }], carriers: validCarriers },
    },
    {
      name: 'a connection entry whose to is not a legal operator id',
      payload: { kind: 'setAlgorithm', connections: [{ from: 2, to: 0, isFeedback: false }], carriers: validCarriers },
    },
    {
      name: 'a connection entry whose isFeedback is not a boolean',
      payload: {
        kind: 'setAlgorithm',
        connections: [{ from: 2, to: 1, isFeedback: 'false' }],
        carriers: validCarriers,
      },
    },
    {
      name: 'a connection entry missing isFeedback',
      payload: { kind: 'setAlgorithm', connections: [{ from: 2, to: 1 }], carriers: validCarriers },
    },
    {
      name: 'an out-of-order non-feedback connection (from < to)',
      payload: {
        kind: 'setAlgorithm',
        connections: [{ from: 1, to: 2, isFeedback: false }],
        carriers: validCarriers,
      },
    },
    {
      name: 'a self-loop marked isFeedback false',
      payload: {
        kind: 'setAlgorithm',
        connections: [{ from: 3, to: 3, isFeedback: false }],
        carriers: validCarriers,
      },
    },
    {
      name: 'a non-self-loop marked isFeedback true',
      payload: {
        kind: 'setAlgorithm',
        connections: [{ from: 4, to: 2, isFeedback: true }],
        carriers: validCarriers,
      },
    },
    { name: 'carriers absent', payload: { kind: 'setAlgorithm', connections: validConnections } },
    {
      name: 'carriers not an array',
      payload: { kind: 'setAlgorithm', connections: validConnections, carriers: 'not-an-array' },
    },
    {
      name: 'carriers is an empty array',
      payload: { kind: 'setAlgorithm', connections: validConnections, carriers: [] },
    },
    {
      name: 'carriers containing a value that is not a legal operator id',
      payload: { kind: 'setAlgorithm', connections: validConnections, carriers: [1, 7] },
    },
    {
      name: 'carriers containing a duplicate operator id',
      payload: { kind: 'setAlgorithm', connections: validConnections, carriers: [1, 1] },
    },
    {
      name: 'connections containing a repeated non-feedback routing tuple',
      payload: {
        kind: 'setAlgorithm',
        connections: [
          { from: 2, to: 1, isFeedback: false },
          { from: 2, to: 1, isFeedback: false },
        ],
        carriers: validCarriers,
      },
    },
  ];

  it.each(rejectedRoutingConfigPayloads)('returns null and throws nothing for $name', ({ payload }) => {
    expect(() => parseWorkletMessage(payload)).not.toThrow();
    expect(parseWorkletMessage(payload)).toBeNull();
  });

  it('returns null and throws nothing when a nested connection-entry field getter throws', () => {
    const hostilePayload = {
      kind: 'setAlgorithm',
      connections: [
        {
          from: 2,
          to: 1,
          get isFeedback(): boolean {
            throw new Error('hostile getter');
          },
        },
      ],
      carriers: validCarriers,
    };

    expect(() => parseWorkletMessage(hostilePayload)).not.toThrow();
    expect(parseWorkletMessage(hostilePayload)).toBeNull();
  });

  it('round-trips a well-formed setAlgorithm payload to a value deep-equal to setAlgorithmMessage', () => {
    expect(
      parseWorkletMessage({ kind: 'setAlgorithm', connections: validConnections, carriers: validCarriers }),
    ).toEqual(setAlgorithmMessage(validConnections, validCarriers));
  });
});

describe('parseWorkletMessage — hostile-payload matrix for setOperatorParameters (T-08-01)', () => {
  const baseEntry = validOperators[1];

  function operatorsWith(changes: Record<string, unknown>): unknown {
    return { ...validOperators, 1: { ...baseEntry, ...changes } };
  }

  function operatorsWithout(id: OperatorId): unknown {
    const rest: Record<string, unknown> = { ...validOperators };
    delete rest[id];
    return rest;
  }

  /** Deletes the `envelope` key from operator 1's entry entirely, matching
   * `operatorsWithout`'s convention but at the member level — used for the
   * "absent" container-shape case, distinct from an explicit `envelope:
   * undefined`. */
  function operatorsWithoutEnvelope(): unknown {
    const rest: Record<string, unknown> = { ...baseEntry };
    delete rest['envelope'];
    return { ...validOperators, 1: rest };
  }

  /** The six malformed-entry-value shapes (Phase 9, T-09-01) applied at
   * every one of `ENVELOPE_SEGMENT_COUNT` indices, for both the `rates` and
   * `levels` tuples (2 × 4 × 6 = 48 cases) — generated by a loop over the
   * index range rather than hand-written per-index literals, so a future
   * index cannot be silently left unchecked. Wrong type, non-integer, NaN
   * and Infinity live in this table; below-minimum and above-maximum are
   * appended per index in the generator below. */
  const ENVELOPE_ENTRY_MALFORMED_VARIANTS: readonly { readonly name: string; readonly value: unknown }[] = [
    { name: 'wrong type', value: '5' },
    { name: 'non-integer', value: 1.5 },
    { name: 'NaN', value: NaN },
    { name: 'Infinity', value: Infinity },
  ];

  function envelopeWithEntry(member: 'rates' | 'levels', index: number, value: unknown): unknown {
    const rates: unknown[] = [1, 2, 3, 4];
    const levels: unknown[] = [99, 99, 99, 0];
    const target = member === 'rates' ? rates : levels;
    target[index] = value;
    return operatorsWith({ envelope: { rates, levels } });
  }

  const ENVELOPE_ENTRY_REJECTED_CASES: readonly { readonly name: string; readonly payload: unknown }[] = (() => {
    const cases: { readonly name: string; readonly payload: unknown }[] = [];
    for (const member of ['rates', 'levels'] as const) {
      const [min, max] = member === 'rates' ? [MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE] : [MIN_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL];
      for (let index = 0; index < ENVELOPE_SEGMENT_COUNT; index++) {
        for (const variant of ENVELOPE_ENTRY_MALFORMED_VARIANTS) {
          cases.push({
            name: `operator entry: envelope.${member}[${index}] is ${variant.name}`,
            payload: { kind: 'setOperatorParameters', operators: envelopeWithEntry(member, index, variant.value) },
          });
        }
        cases.push({
          name: `operator entry: envelope.${member}[${index}] below minimum`,
          payload: { kind: 'setOperatorParameters', operators: envelopeWithEntry(member, index, min - 1) },
        });
        cases.push({
          name: `operator entry: envelope.${member}[${index}] above maximum`,
          payload: { kind: 'setOperatorParameters', operators: envelopeWithEntry(member, index, max + 1) },
        });
      }
    }
    return cases;
  })();

  const rejectedOperatorParametersPayloads: readonly { readonly name: string; readonly payload: unknown }[] = [
    { name: 'operators absent', payload: { kind: 'setOperatorParameters' } },
    {
      name: 'operators is an array',
      payload: {
        kind: 'setOperatorParameters',
        operators: [baseEntry, baseEntry, baseEntry, baseEntry, baseEntry, baseEntry],
      },
    },
    {
      name: 'operators missing exactly one operator id (3)',
      payload: { kind: 'setOperatorParameters', operators: operatorsWithout(3) },
    },
    {
      name: 'operators carries a seventh, out-of-range id alongside the six',
      payload: { kind: 'setOperatorParameters', operators: { ...validOperators, 7: baseEntry } },
    },
    {
      name: 'operator entry: enabled is not a boolean',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ enabled: 'yes' }) },
    },
    {
      name: 'operator entry: mode is neither ratio nor fixed',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ mode: 'sideways' }) },
    },
    {
      name: 'operator entry: fixedFrequencyHz is not a number',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ fixedFrequencyHz: '440' }) },
    },
    {
      name: 'operator entry: fixedFrequencyHz is non-finite',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ fixedFrequencyHz: NaN }) },
    },
    {
      name: 'operator entry: fixedFrequencyHz is not positive',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ fixedFrequencyHz: 0 }) },
    },
    {
      name: 'operator entry: ratio is not a number',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ ratio: '1' }) },
    },
    {
      name: 'operator entry: ratio is not a coarse ratio position',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ ratio: 1.5 }) },
    },
    {
      name: 'operator entry: detune is not a number',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ detune: '0' }) },
    },
    {
      name: 'operator entry: detune is not an integer',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ detune: 0.5 }) },
    },
    {
      name: 'operator entry: detune below MIN_DETUNE',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ detune: MIN_DETUNE - 1 }) },
    },
    {
      name: 'operator entry: detune above MAX_DETUNE',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ detune: MAX_DETUNE + 1 }) },
    },
    {
      name: 'operator entry: outputLevel is not a number',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ outputLevel: '50' }) },
    },
    {
      name: 'operator entry: outputLevel is not an integer',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ outputLevel: 50.5 }) },
    },
    {
      name: 'operator entry: outputLevel below MIN_OUTPUT_LEVEL',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ outputLevel: MIN_OUTPUT_LEVEL - 1 }) },
    },
    {
      name: 'operator entry: outputLevel above MAX_OUTPUT_LEVEL',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ outputLevel: MAX_OUTPUT_LEVEL + 1 }) },
    },
    {
      name: 'operator entry: envelope with the wrong number of rates',
      payload: {
        kind: 'setOperatorParameters',
        operators: operatorsWith({ envelope: { rates: [1, 2, 3], levels: [99, 99, 99, 0] } }),
      },
    },
    {
      name: 'operator entry: envelope with the wrong number of levels',
      payload: {
        kind: 'setOperatorParameters',
        operators: operatorsWith({ envelope: { rates: [1, 2, 3, 4], levels: [99, 99, 99] } }),
      },
    },
    {
      name: 'operator entry: envelope with a non-integer entry',
      payload: {
        kind: 'setOperatorParameters',
        operators: operatorsWith({ envelope: { rates: [1.5, 2, 3, 4], levels: [99, 99, 99, 0] } }),
      },
    },
    {
      name: 'operator entry: envelope with a rate above MAX_ENVELOPE_RATE',
      payload: {
        kind: 'setOperatorParameters',
        operators: operatorsWith({
          envelope: { rates: [MAX_ENVELOPE_RATE + 1, 2, 3, 4], levels: [99, 99, 99, 0] },
        }),
      },
    },
    {
      name: 'operator entry: envelope with a level above MAX_ENVELOPE_LEVEL',
      payload: {
        kind: 'setOperatorParameters',
        operators: operatorsWith({
          envelope: { rates: [1, 2, 3, 4], levels: [MAX_ENVELOPE_LEVEL + 1, 99, 99, 0] },
        }),
      },
    },
    // Phase 9 (T-09-01): container shapes for the widened `envelope` member —
    // an absent/null/array/string envelope, and an otherwise-well-formed
    // envelope object missing one of its two required members.
    {
      name: 'operator entry: envelope is absent',
      payload: { kind: 'setOperatorParameters', operators: operatorsWithoutEnvelope() },
    },
    {
      name: 'operator entry: envelope is null',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ envelope: null }) },
    },
    {
      name: 'operator entry: envelope is an array',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ envelope: [1, 2, 3, 4] }) },
    },
    {
      name: 'operator entry: envelope is a string',
      payload: { kind: 'setOperatorParameters', operators: operatorsWith({ envelope: 'envelope' }) },
    },
    {
      name: 'operator entry: envelope missing rates',
      payload: {
        kind: 'setOperatorParameters',
        operators: operatorsWith({ envelope: { levels: [99, 99, 99, 0] } }),
      },
    },
    {
      name: 'operator entry: envelope missing levels',
      payload: {
        kind: 'setOperatorParameters',
        operators: operatorsWith({ envelope: { rates: [1, 2, 3, 4] } }),
      },
    },
    // Tuple-length shapes at both lengths either side of ENVELOPE_SEGMENT_COUNT (4).
    {
      name: 'operator entry: envelope.rates has 5 entries',
      payload: {
        kind: 'setOperatorParameters',
        operators: operatorsWith({ envelope: { rates: [1, 2, 3, 4, 5], levels: [99, 99, 99, 0] } }),
      },
    },
    {
      name: 'operator entry: envelope.levels has 5 entries',
      payload: {
        kind: 'setOperatorParameters',
        operators: operatorsWith({ envelope: { rates: [1, 2, 3, 4], levels: [99, 99, 99, 0, 0] } }),
      },
    },
    // Entry-value shapes at every one of the four rate indices and every one
    // of the four level indices — parameterised over the index range rather
    // than hand-written per-index literals, so no index can be silently left
    // unchecked (T-09-01).
    ...ENVELOPE_ENTRY_REJECTED_CASES,
  ];

  it.each(rejectedOperatorParametersPayloads)('returns null and throws nothing for $name', ({ payload }) => {
    expect(() => parseWorkletMessage(payload)).not.toThrow();
    expect(parseWorkletMessage(payload)).toBeNull();
  });

  it('returns null and throws nothing when a nested operator-entry field getter throws', () => {
    const hostilePayload = {
      kind: 'setOperatorParameters',
      operators: {
        ...validOperators,
        1: {
          ...baseEntry,
          get outputLevel(): number {
            throw new Error('hostile getter');
          },
        },
      },
    };

    expect(() => parseWorkletMessage(hostilePayload)).not.toThrow();
    expect(parseWorkletMessage(hostilePayload)).toBeNull();
  });

  it('returns null and throws nothing when the envelope member has a throwing property getter (T-09-01)', () => {
    const hostileEnvelope = {
      get rates(): number[] {
        throw new Error('hostile getter');
      },
      levels: [99, 99, 99, 0],
    };
    const hostilePayload = {
      kind: 'setOperatorParameters',
      operators: operatorsWith({ envelope: hostileEnvelope }),
    };

    expect(() => parseWorkletMessage(hostilePayload)).not.toThrow();
    expect(parseWorkletMessage(hostilePayload)).toBeNull();
  });

  it('round-trips a well-formed setOperatorParameters payload to a value deep-equal to setOperatorParametersMessage', () => {
    expect(parseWorkletMessage({ kind: 'setOperatorParameters', operators: validOperators })).toEqual(
      setOperatorParametersMessage(validOperators),
    );
  });

  it('accepts the minimum output level, matching setOperatorParametersMessage', () => {
    const operators = operatorsWith({ outputLevel: MIN_OUTPUT_LEVEL }) as OperatorParameterSet;
    expect(parseWorkletMessage({ kind: 'setOperatorParameters', operators })).toEqual(
      setOperatorParametersMessage(operators),
    );
  });

  it('accepts the maximum output level, matching setOperatorParametersMessage', () => {
    const operators = operatorsWith({ outputLevel: MAX_OUTPUT_LEVEL }) as OperatorParameterSet;
    expect(parseWorkletMessage({ kind: 'setOperatorParameters', operators })).toEqual(
      setOperatorParametersMessage(operators),
    );
  });

  it('accepts the minimum detune, matching setOperatorParametersMessage', () => {
    const operators = operatorsWith({ detune: MIN_DETUNE }) as OperatorParameterSet;
    expect(parseWorkletMessage({ kind: 'setOperatorParameters', operators })).toEqual(
      setOperatorParametersMessage(operators),
    );
  });

  it('accepts the maximum detune, matching setOperatorParametersMessage', () => {
    const operators = operatorsWith({ detune: MAX_DETUNE }) as OperatorParameterSet;
    expect(parseWorkletMessage({ kind: 'setOperatorParameters', operators })).toEqual(
      setOperatorParametersMessage(operators),
    );
  });

  it('accepts an envelope at the minimum rate/level boundaries, matching setOperatorParametersMessage', () => {
    const operators = operatorsWith({
      envelope: {
        rates: [MIN_ENVELOPE_RATE, MIN_ENVELOPE_RATE, MIN_ENVELOPE_RATE, MIN_ENVELOPE_RATE],
        levels: [MIN_ENVELOPE_LEVEL, MIN_ENVELOPE_LEVEL, MIN_ENVELOPE_LEVEL, MIN_ENVELOPE_LEVEL],
      },
    }) as OperatorParameterSet;
    expect(parseWorkletMessage({ kind: 'setOperatorParameters', operators })).toEqual(
      setOperatorParametersMessage(operators),
    );
  });

  it('accepts an envelope at the maximum rate/level boundaries, matching setOperatorParametersMessage', () => {
    const operators = operatorsWith({
      envelope: {
        rates: [MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE],
        levels: [MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL],
      },
    }) as OperatorParameterSet;
    expect(parseWorkletMessage({ kind: 'setOperatorParameters', operators })).toEqual(
      setOperatorParametersMessage(operators),
    );
  });

  it('accepts the lowest coarse ratio position (0.5), matching setOperatorParametersMessage', () => {
    const operators = operatorsWith({ ratio: COARSE_RATIOS[0] }) as OperatorParameterSet;
    expect(parseWorkletMessage({ kind: 'setOperatorParameters', operators })).toEqual(
      setOperatorParametersMessage(operators),
    );
  });

  it('accepts the highest coarse ratio position, matching setOperatorParametersMessage', () => {
    const operators = operatorsWith({ ratio: COARSE_RATIOS[COARSE_RATIOS.length - 1] }) as OperatorParameterSet;
    expect(parseWorkletMessage({ kind: 'setOperatorParameters', operators })).toEqual(
      setOperatorParametersMessage(operators),
    );
  });

  it('accepts a fixed-mode entry, matching setOperatorParametersMessage', () => {
    const operators = operatorsWith({ mode: 'fixed', fixedFrequencyHz: 880 }) as OperatorParameterSet;
    expect(parseWorkletMessage({ kind: 'setOperatorParameters', operators })).toEqual(
      setOperatorParametersMessage(operators),
    );
  });
});

describe('parseWorkletMessage — hostile-payload matrix for setFeedback (T-08-01)', () => {
  const rejectedFeedbackPayloads: readonly { readonly name: string; readonly payload: unknown }[] = [
    { name: 'level absent', payload: { kind: 'setFeedback' } },
    { name: 'level is not a number', payload: { kind: 'setFeedback', level: '4' } },
    { name: 'level is NaN', payload: { kind: 'setFeedback', level: NaN } },
    { name: 'level is Infinity', payload: { kind: 'setFeedback', level: Infinity } },
    { name: 'level is fractional', payload: { kind: 'setFeedback', level: 3.5 } },
    {
      name: 'level one step below MIN_FEEDBACK_LEVEL',
      payload: { kind: 'setFeedback', level: MIN_FEEDBACK_LEVEL - 1 },
    },
    {
      name: 'level one step above MAX_FEEDBACK_LEVEL',
      payload: { kind: 'setFeedback', level: MAX_FEEDBACK_LEVEL + 1 },
    },
  ];

  it.each(rejectedFeedbackPayloads)('returns null and throws nothing for $name', ({ payload }) => {
    expect(() => parseWorkletMessage(payload)).not.toThrow();
    expect(parseWorkletMessage(payload)).toBeNull();
  });

  it('returns null and throws nothing when the level getter throws', () => {
    const hostilePayload = {
      kind: 'setFeedback',
      get level(): number {
        throw new Error('hostile getter');
      },
    };

    expect(() => parseWorkletMessage(hostilePayload)).not.toThrow();
    expect(parseWorkletMessage(hostilePayload)).toBeNull();
  });

  it('round-trips a well-formed setFeedback payload to a value deep-equal to setFeedbackMessage', () => {
    expect(parseWorkletMessage({ kind: 'setFeedback', level: 4 })).toEqual(setFeedbackMessage(4));
  });

  it('accepts MIN_FEEDBACK_LEVEL, matching setFeedbackMessage', () => {
    expect(parseWorkletMessage({ kind: 'setFeedback', level: MIN_FEEDBACK_LEVEL })).toEqual(
      setFeedbackMessage(MIN_FEEDBACK_LEVEL),
    );
  });

  it('accepts MAX_FEEDBACK_LEVEL, matching setFeedbackMessage', () => {
    expect(parseWorkletMessage({ kind: 'setFeedback', level: MAX_FEEDBACK_LEVEL })).toEqual(
      setFeedbackMessage(MAX_FEEDBACK_LEVEL),
    );
  });
});

/**
 * Phase 9's hostile-payload matrix (T-09-01) for the note-lifecycle gate
 * message — the same discipline as the Phase 8 matrices above, applied to
 * `setGate`'s two members (`open`, `velocity`). `MIN_VELOCITY`/`MAX_VELOCITY`
 * are imported rather than written as numeric literals, matching this file's
 * existing practice of importing bounds so the worklet-side guard and the
 * main-thread `validateOperatorParameters`-style guards can never drift.
 */
describe('parseWorkletMessage — hostile-payload matrix for setGate (T-09-01)', () => {
  const rejectedGatePayloads: readonly { readonly name: string; readonly payload: unknown }[] = [
    { name: 'open is a string', payload: { kind: 'setGate', open: 'true', velocity: 64 } },
    { name: 'open is a number', payload: { kind: 'setGate', open: 1, velocity: 64 } },
    { name: 'open is null', payload: { kind: 'setGate', open: null, velocity: 64 } },
    { name: 'open is absent', payload: { kind: 'setGate', velocity: 64 } },
    { name: 'velocity is a string', payload: { kind: 'setGate', open: true, velocity: '64' } },
    { name: 'velocity is a float', payload: { kind: 'setGate', open: true, velocity: 64.5 } },
    { name: 'velocity is NaN', payload: { kind: 'setGate', open: true, velocity: NaN } },
    { name: 'velocity is Infinity', payload: { kind: 'setGate', open: true, velocity: Infinity } },
    {
      name: 'velocity is below MIN_VELOCITY',
      payload: { kind: 'setGate', open: true, velocity: MIN_VELOCITY - 1 },
    },
    {
      name: 'velocity is above MAX_VELOCITY',
      payload: { kind: 'setGate', open: true, velocity: MAX_VELOCITY + 1 },
    },
  ];

  it.each(rejectedGatePayloads)('returns null and throws nothing for $name', ({ payload }) => {
    expect(() => parseWorkletMessage(payload)).not.toThrow();
    expect(parseWorkletMessage(payload)).toBeNull();
  });

  it('returns null and throws nothing when the velocity getter throws', () => {
    const hostilePayload = {
      kind: 'setGate',
      open: true,
      get velocity(): number {
        throw new Error('hostile getter');
      },
    };

    expect(() => parseWorkletMessage(hostilePayload)).not.toThrow();
    expect(parseWorkletMessage(hostilePayload)).toBeNull();
  });

  it('accepts MIN_VELOCITY and MAX_VELOCITY, matching setGateMessage', () => {
    expect(parseWorkletMessage({ kind: 'setGate', open: true, velocity: MIN_VELOCITY })).toEqual(
      setGateMessage(true, MIN_VELOCITY),
    );
    expect(parseWorkletMessage({ kind: 'setGate', open: true, velocity: MAX_VELOCITY })).toEqual(
      setGateMessage(true, MAX_VELOCITY),
    );
  });

  it('accepts both open-flag values, matching setGateMessage', () => {
    expect(parseWorkletMessage({ kind: 'setGate', open: true, velocity: 64 })).toEqual(setGateMessage(true, 64));
    expect(parseWorkletMessage({ kind: 'setGate', open: false, velocity: 64 })).toEqual(
      setGateMessage(false, 64),
    );
  });
});
