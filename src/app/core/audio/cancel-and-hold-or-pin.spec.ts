import { cancelAndHoldOrPin } from './cancel-and-hold-or-pin';

/**
 * Fallback-path double: no `cancelAndHoldAtTime`. `cancelScheduledValues`
 * jumps `.value` away from the mid-ramp reading — the browser inconsistency
 * the native hold API exists to close — so a post-cancel read would pin
 * silence instead of the held gain.
 */
function fallbackParam(midRampValue: number): {
  value: number;
  calls: { method: string; value: number; time: number }[];
  cancelScheduledValues: (time: number) => void;
  setValueAtTime: (value: number, time: number) => void;
} {
  const calls: { method: string; value: number; time: number }[] = [];
  let value = midRampValue;
  return {
    get value(): number {
      return value;
    },
    set value(next: number) {
      value = next;
    },
    calls,
    cancelScheduledValues(time: number): void {
      calls.push({ method: 'cancelScheduledValues', value, time });
      value = 0;
    },
    setValueAtTime(next: number, time: number): void {
      value = next;
      calls.push({ method: 'setValueAtTime', value: next, time });
    },
  };
}

describe('cancelAndHoldOrPin', () => {
  it('on the fallback path, captures .value before cancelScheduledValues and pins that held gain', () => {
    const param = fallbackParam(0.42);
    const now = 1.25;

    cancelAndHoldOrPin(param, now);

    expect(param.calls.map((entry) => entry.method)).toEqual(['cancelScheduledValues', 'setValueAtTime']);
    expect(param.calls[0]).toEqual({ method: 'cancelScheduledValues', value: 0.42, time: now });
    expect(param.calls[1]).toEqual({ method: 'setValueAtTime', value: 0.42, time: now });
    expect(param.value).toBe(0.42);
  });

  it('uses cancelAndHoldAtTime when present and does not cancel-then-re-read', () => {
    const calls: string[] = [];
    const param = {
      value: 0.5,
      cancelAndHoldAtTime(time: number): void {
        calls.push(`cancelAndHoldAtTime:${time}`);
      },
      cancelScheduledValues(): void {
        calls.push('cancelScheduledValues');
      },
      setValueAtTime(): void {
        calls.push('setValueAtTime');
      },
    };

    cancelAndHoldOrPin(param, 3);

    expect(calls).toEqual(['cancelAndHoldAtTime:3']);
  });
});
