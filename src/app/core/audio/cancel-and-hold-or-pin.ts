/**
 * Cancels in-flight automation and holds the interpolated value. Prefer
 * `cancelAndHoldAtTime` when the param implements it.
 *
 * The fallback must read `.value` *before* `cancelScheduledValues(now)`:
 * after cancel, `.value` is not consistently the mid-ramp interpolated
 * value across browsers, which is the documented reason
 * `cancelAndHoldAtTime` exists. Pin the captured value with
 * `setValueAtTime` so the next ramp continues from the held gain.
 *
 * This module must stay free of Angular imports: the framework-free
 * listening harness loads it directly.
 */
export function cancelAndHoldOrPin(
  param: {
    cancelAndHoldAtTime?: (time: number) => unknown;
    cancelScheduledValues: (time: number) => unknown;
    value: number;
    setValueAtTime: (value: number, time: number) => unknown;
  },
  now: number,
): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now);
    return;
  }
  const held = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(held, now);
}
