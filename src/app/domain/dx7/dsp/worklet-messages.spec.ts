import {
  DX7_OPERATOR_PROCESSOR_NAME,
  MAX_OPERATOR_FREQUENCY_HZ,
  WORKLET_RENDER_MODES,
  parseWorkletMessage,
  setFrequencyMessage,
  setModeMessage,
} from './worklet-messages';

describe('DX7_OPERATOR_PROCESSOR_NAME', () => {
  it('is the literal registered processor name', () => {
    expect(DX7_OPERATOR_PROCESSOR_NAME).toBe('dx7-operator');
  });
});

describe('setFrequencyMessage / setModeMessage', () => {
  it('builds a well-formed setFrequency message', () => {
    expect(setFrequencyMessage(440)).toEqual({ kind: 'setFrequency', frequencyHz: 440 });
  });

  it('builds a well-formed setMode message', () => {
    expect(setModeMessage('additive')).toEqual({ kind: 'setMode', mode: 'additive' });
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
