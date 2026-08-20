---
phase: 10-visualizers-and-comparison-tools
reviewed: 2026-08-19T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - src/app/core/browser/animation-frame.token.ts
  - src/app/core/browser/canvas-2d.token.ts
  - src/app/core/browser/testing/fake-animation-frame-scheduler.ts
  - src/app/core/browser/testing/fake-canvas-2d-context.ts
  - src/app/features/playground/visualizer/visualizer-frame.ts
  - src/app/features/playground/visualizer/visualizer-frame.spec.ts
  - src/app/features/playground/visualizer/visualizer.ts
  - src/app/features/playground/visualizer/visualizer.html
  - src/app/features/playground/visualizer/visualizer.scss
  - src/app/features/playground/visualizer/visualizer.spec.ts
  - src/app/core/audio/audio-context.token.ts
  - src/app/core/audio/testing/fake-audio-context.ts
  - src/app/core/audio/synth-engine.ts
  - src/app/core/audio/worklet-synth-engine.ts
  - src/app/core/audio/worklet-synth-engine.spec.ts
  - src/app/features/playground/playground.ts
  - src/app/features/playground/playground.html
  - src/app/features/playground/playground.spec.ts
  - src/app/features/playground/visualizer/spectrum-scale.ts
  - src/app/features/playground/visualizer/spectrum-scale.spec.ts
  - src/app/domain/dx7/randomization/random-walk-patch.ts
  - src/app/domain/dx7/randomization/random-walk-patch.spec.ts
  - src/app/state/instrument-state.ts
  - src/app/state/instrument-state.spec.ts
  - src/app/features/playground/tools-panel/tools-panel.ts
  - src/app/features/playground/tools-panel/tools-panel.html
  - src/app/features/playground/tools-panel/tools-panel.scss
  - src/app/features/playground/tools-panel/tools-panel.spec.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-08-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

This phase adds the oscilloscope/spectrum visualizer (pure-canvas draw module + `AnalyserNode` tap wired through `WorkletSynthEngine`), a logarithmic frequency-scale module, a pure bounded random-walk randomizer, and the `ToolsPanel` A/B/reset/randomize UI over `InstrumentState`'s existing facade.

The domain logic (`spectrum-scale.ts`, `random-walk-patch.ts`) is careful, defensively clamped against non-finite/out-of-range inputs, and thoroughly exercised by property-style tests. The visualizer draw loop genuinely stays off the Angular signal graph (VIZ-01) and allocates no per-frame buffers, matching the architecture's stated guarantees. `InstrumentState` and `ToolsPanel` correctly delegate to already-tested facade methods with no duplicated state logic.

No blocking correctness or security defects were found. Two warnings are worth fixing: a test double that asserts a Web Audio API contract the real API does not honor, and a randomization function whose input-clamping order can silently discard a domain-valid current value before "walking" from it, arguably breaking this module's own stated bounded-walk invariant for out-of-practical-range inputs. Two lower-severity items are noted for awareness.

## Warnings

### WR-01: `FakeAnalyserNode` throws for a buffer-length mismatch that the real Web Audio API does not throw for

**File:** `src/app/core/audio/testing/fake-audio-context.ts:166-184`

**Issue:** `FakeAnalyserNode.getByteTimeDomainData`/`getByteFrequencyData` throw a `RangeError` when the target buffer's length doesn't exactly match `fftSize`/`frequencyBinCount`:

```ts
getByteTimeDomainData(target: Uint8Array): void {
  this.timeDomainReadCalls += 1;
  if (target.length !== this.fftSize) {
    throw new RangeError(
      `target buffer must have length ${this.fftSize} (fftSize), received ${target.length}`,
    );
  }
  ...
}
```

The class doc comment claims this "enforces the exact buffer-length contract a real browser enforces (`RangeError` on any other length)". That is not the real contract: per the Web Audio API spec, `AnalyserNode.getByteTimeDomainData`/`getByteFrequencyData` never throw for a mismatched array length — excess elements are dropped if the array is too long, and the write is truncated (not an error) if it is too short. `worklet-synth-engine.spec.ts:321-329` then asserts this fabricated throw as a "regression guard":

```ts
it('FakeAnalyserNode.getByteTimeDomainData/getByteFrequencyData throw a RangeError for a mismatched buffer length', async () => {
  ...
  expect(() => analyser.getByteTimeDomainData(new Uint8Array(ANALYSER_FFT_SIZE - 1))).toThrow(RangeError);
  ...
});
```

This test proves nothing about production behavior — the real browser API would silently truncate instead. Currently harmless because `Visualizer` always passes correctly-sized, once-allocated buffers, but the false contract could mislead a future maintainer into believing a mismatched-buffer bug would be caught by an exception in production, when in the real browser it would instead silently corrupt/short-fill the buffer with no error.

**Fix:** Either remove the throw and mirror the spec's actual truncate-or-ignore behavior, or rename/re-document the check as a deliberately stricter *test-only* assertion (not "the same contract a real browser enforces") so nobody relies on it as a production safety net:

```ts
/** Test-only strictness: the real API silently truncates a mismatched
 * buffer rather than throwing (Web Audio API spec) — this fake throws
 * instead, specifically so a spec that accidentally passes the wrong-sized
 * buffer fails loudly rather than passing with truncated data. Do not
 * treat this as evidence the real AnalyserNode would throw. */
```

### WR-02: `randomWalkFixedFrequencyHz` clamps an out-of-practical-range current value before computing the walk, discarding it rather than walking from it

**File:** `src/app/domain/dx7/randomization/random-walk-patch.ts:143-153`

**Issue:** `validateOperatorParameters` (in `operator-parameters.ts:267-271`) only requires `fixedFrequencyHz` to be a finite number `> 0` — there is no domain-level upper bound, and the domain layer explicitly defers quantization/range concerns to later phases. But `randomWalkFixedFrequencyHz` clamps `current` into `MIN_RANDOM_FIXED_FREQUENCY_HZ..MAX_RANDOM_FIXED_FREQUENCY_HZ` (20..8000 Hz) *before* computing the multiplicative delta:

```ts
export function randomWalkFixedFrequencyHz(current: number, rng: RandomSource): number {
  const clampedCurrent =
    Number.isFinite(current) && current > 0
      ? Math.min(MAX_RANDOM_FIXED_FREQUENCY_HZ, Math.max(MIN_RANDOM_FIXED_FREQUENCY_HZ, current))
      : MIN_RANDOM_FIXED_FREQUENCY_HZ;
  const source = readUnitSourceOrMidpoint(rng);
  const factor = 1 + (source * 2 - 1) * RANDOM_WALK_DELTA_FRACTION;
  const product = clampedCurrent * factor;
  ...
}
```

If a caller (a future operator-editor UI, or any other code driving `InstrumentState.updateOperator`) has legitimately set a fixed-mode operator's `fixedFrequencyHz` to e.g. `20000` (domain-valid, since only `> 0` is enforced) and the user then presses Randomize, this function silently substitutes `8000` as the walk's starting point and produces a result within `±20%` of `8000`, not of the operator's actual `20000` current value. That is a large, un-bounded-looking jump for the field's *current* value, which appears to contradict this module's own header doc: "every numeric field here moves by a delta bounded relative to its *current* value, never by an independent uniform draw" (D-13). Not reachable through today's UI (the operator editor is still "coming in later phases" per `playground.ts`), but reachable through the already-shipped `InstrumentState.updateOperator`/`randomize()` public API.

**Disposition:** Documented as an intentional D-13 exception rather than walking from the raw out-of-range current value. The module header and `randomWalkFixedFrequencyHz` JSDoc now state clamp-then-walk explicitly: values outside the practical 20..8000 Hz randomization range are clamped first, then walked; every other walker in the module still starts from the true current value. Production code is unchanged. Not reachable through today's UI (no fixed-frequency operator editor yet).

## Info

### IN-01: `Visualizer` discards the boolean return of `readFrequencyInto`, relying on an implicit (currently true) assumption that it always agrees with `readTimeDomainInto`

**File:** `src/app/features/playground/visualizer/visualizer.ts:184-187`

**Issue:**

```ts
const readOk = this.tap !== null && this.tap.readTimeDomainInto(this.timeDomainBuffer);
if (this.tap !== null) {
  this.tap.readFrequencyInto(this.frequencyBuffer);
}
```

Only `readTimeDomainInto`'s return value gates whether the frame is treated as "live" (drawing the waveform/spectrum) or "rest" (flat baseline/empty spectrum); `readFrequencyInto`'s own success/failure return is silently ignored. Today this is safe because `WorkletSynthEngine` backs both reads with the same single nullable `analyser` field, so the two calls can never disagree. But `AnalysisTap` is a public interface another `SynthEngine` implementation could satisfy with two independently-nullable sources (e.g. a future engine with separate time/frequency taps), in which case this code would silently keep drawing frequency data (or stale/zeroed frequency data) without ever detecting that the frequency tap specifically had gone unavailable.

**Fix:** Either drop the unused-but-typed guarantee from the interface doc (state explicitly that both reads are assumed to succeed/fail together for every implementation), or check both booleans explicitly:

```ts
const timeOk = this.tap !== null && this.tap.readTimeDomainInto(this.timeDomainBuffer);
const frequencyOk = this.tap !== null && this.tap.readFrequencyInto(this.frequencyBuffer);
```

### IN-02: Duplicated, hard-to-scan block for the eight envelope rate/level walk calls

**File:** `src/app/domain/dx7/randomization/random-walk-patch.ts:181-192`

**Issue:** The four `rates` and four `levels` entries are each written out as a nearly-identical, long `randomWalkInteger(...)` call:

```ts
const rates: [number, number, number, number] = [
  randomWalkInteger(current.envelope.rates[0], MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE, RANDOM_WALK_DELTA_FRACTION, rng),
  randomWalkInteger(current.envelope.rates[1], MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE, RANDOM_WALK_DELTA_FRACTION, rng),
  randomWalkInteger(current.envelope.rates[2], MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE, RANDOM_WALK_DELTA_FRACTION, rng),
  randomWalkInteger(current.envelope.rates[3], MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE, RANDOM_WALK_DELTA_FRACTION, rng),
];
```

This is correct (each call independently reads `rng` once, matching the documented "eight separate reads" intent) but the 8-line block is easy to miscopy (e.g. an index typo copy-pasting rows 1-4) without a compiler error, since each line differs only in one array index. A small helper would remove the duplication without changing the "one rng read per segment" behavior.

**Fix:**
```ts
function walkEnvelopeSegments(
  current: readonly [number, number, number, number],
  min: number,
  max: number,
  rng: RandomSource,
): [number, number, number, number] {
  return [
    randomWalkInteger(current[0], min, max, RANDOM_WALK_DELTA_FRACTION, rng),
    randomWalkInteger(current[1], min, max, RANDOM_WALK_DELTA_FRACTION, rng),
    randomWalkInteger(current[2], min, max, RANDOM_WALK_DELTA_FRACTION, rng),
    randomWalkInteger(current[3], min, max, RANDOM_WALK_DELTA_FRACTION, rng),
  ];
}
// ...
const rates = walkEnvelopeSegments(current.envelope.rates, MIN_ENVELOPE_RATE, MAX_ENVELOPE_RATE, rng);
const levels = walkEnvelopeSegments(current.envelope.levels, MIN_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, rng);
```

---

_Reviewed: 2026-08-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
