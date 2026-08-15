---
phase: 08-algorithm-routing-and-feedback
reviewed: 2026-08-14T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - README.md
  - src/app/core/audio/synth-engine.token.ts
  - src/app/core/audio/worklet-processor-bundle.spec.ts
  - src/app/core/audio/worklet-synth-engine.spec.ts
  - src/app/core/audio/worklet-synth-engine.ts
  - src/app/domain/dx7/dsp/algorithm-routing.spec.ts
  - src/app/domain/dx7/dsp/graph-router.spec.ts
  - src/app/domain/dx7/dsp/graph-router.ts
  - src/app/domain/dx7/dsp/operator.spec.ts
  - src/app/domain/dx7/dsp/operator.ts
  - src/app/domain/dx7/dsp/reference-evaluator.spec.ts
  - src/app/domain/dx7/dsp/reference-evaluator.ts
  - src/app/domain/dx7/dsp/worklet-messages.spec.ts
  - src/app/domain/dx7/dsp/worklet-messages.ts
  - src/app/features/learn/lesson-detail/lesson-detail.spec.ts
  - src/app/features/play-surface/play-surface.spec.ts
  - src/app/features/playground/playground.spec.ts
  - worklets/dx7-worklet-processor.ts
  - worklets/harness/harness-main.ts
  - worklets/harness/index.html
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-08-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the Phase 8 (ENGINE-02) routed-algorithm/feedback delivery: the `GraphRouter` kernel and
its independent cross-check (`reference-evaluator.ts` + `algorithm-routing.spec.ts`), the widened
`worklet-messages.ts` message contract and its hostile-payload matrix, the `Dx7WorkletProcessor`
adapter, `WorkletSynthEngine` (now the live `SYNTH_ENGINE`), the dev harness, and the three feature
specs that depend on the new cutover. The DSP core is unusually well proven — a genuinely
independent second implementation (`reference-evaluator.ts`) is cross-checked sample-for-sample
against `GraphRouter` across all 32 algorithms, and the hostile-payload matrix in
`worklet-messages.spec.ts` is thorough for the fields it does check. Test quality throughout is
high.

The defects found are narrower but real: `WorkletSynthEngine`'s master-gain wiring silently drops
the project's own audio safety clamp for two of the three render modes it exposes (a genuine
regression from the Phase 5 engine, currently reachable only through a public but so-far-unused
method); the routing-config message validator — explicitly documented as "the single choke point"
for this boundary — doesn't enforce the structural invariants `GraphRouter.render()`'s single-pass
descending sweep actually depends on for correctness; and the README's top-level status line is
stale to the point of contradicting the rest of the same file.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: `WorkletSynthEngine` drops the `MASTER_GAIN` safety clamp for `'single'`/`'additive'` render modes

**File:** `src/app/core/audio/worklet-synth-engine.ts:277-291` (gain setup) and `:339-344` (`setRenderMode`)

**Issue:** `buildAndStart` wires `masterGain` to unity (`1`), not `MASTER_GAIN`, with this
justification:

```ts
// Unity, not MASTER_GAIN: as of Phase 8, GraphRouter.render() already
// applies MASTER_GAIN to every rendered block (D-08's rationale — ...).
// Applying it again here would apply the gain twice; the
// total gain from carrier sum to destination is unchanged from
// Phase 5.
masterGain.gain.setValueAtTime(1, now);
```

That reasoning is correct only for `'routed'` mode, where `GraphRouter.render()` does apply
`MASTER_GAIN` and a hard clamp internally. But this same class exposes a public
`setRenderMode(mode: WorkletRenderMode)` method (`:339-344`) that can switch the live node into
`'single'` or `'additive'` mode. In `'additive'` mode the worklet renders through
`AdditiveOperatorBank.render()`, whose own docstring is explicit: *"Sums six independent
`PhaseModulatedOperator` instances with no gain and no scaling applied... attenuation is the
engine's job."* With `masterGain` pinned to unity, that attenuation never happens: a six-carrier
additive render can reach amplitude 6 and reach `context.destination` essentially unattenuated
(only the final per-sample `[-1,1]` clamp inside `GraphRouter`/individual operators would apply —
and in `'additive'`/`'single'` mode there is no such clamp at all, since neither
`AdditiveOperatorBank.render()` nor `PhaseModulatedOperator.render()` clamps its output). This is a
real regression from the retained Phase 5 reference engine
(`web-audio-synth-engine.ts:243`, `masterGain.gain.value = MASTER_GAIN`), and it contradicts the
comment's own claim that "the total gain from carrier sum to destination is unchanged from Phase
5" — that claim is false for any mode other than `'routed'`.

The dev harness (`worklets/harness/harness-main.ts:211`) gets this right —
`masterGain.gain.setValueAtTime(MASTER_GAIN, now)` — which is why this asymmetry is verifiable by
comparing the two files directly. `setRenderMode` is not part of the `SynthEngine` interface and no
current UI wires it up (confirmed: no non-spec caller exists in `src/`), but it is a public method
on a `providedIn: 'root'` service, explicitly documented as existing for "tests and future
tooling" to drive — i.e., it is meant to be called outside this file. `worklet-synth-engine.spec.ts`
only asserts that `setRenderMode('additive')` posts the expected `setMode` message; no test asserts
anything about the resulting loudness/gain-staging, so this gap is untested as well as
unenforced.

**Fix:** Make the master gain mode-aware, or remove the non-routed modes from the production
engine's public surface. Minimal fix:

```ts
setRenderMode(mode: WorkletRenderMode): void {
  if (this.node === null || this.context === null || this.masterGain === null) {
    return;
  }
  this.node.port.postMessage(setModeMessage(mode));
  const now = this.context.currentTime;
  // GraphRouter.render() (routed mode) already applies MASTER_GAIN/clamp
  // internally; the single-operator and additive fixture paths do not, so
  // this gain must supply it whenever the node is not in 'routed' mode.
  this.masterGain.gain.setValueAtTime(mode === 'routed' ? 1 : MASTER_GAIN, now);
}
```
and call the same logic from `buildAndStart`/`initialize()` before the initial
`setModeMessage('routed')` push, so the invariant holds from construction, not only after a
`setRenderMode` call.

### Warnings

#### WR-01: Routing-config message validation doesn't enforce the invariants `GraphRouter.render()` depends on for correctness

**File:** `src/app/domain/dx7/dsp/worklet-messages.ts:131-145` (`isOperatorConnectionLike`,
`isRoutingConnectionsArray`, `isCarrierIdArray`); depended on by
`src/app/domain/dx7/dsp/graph-router.ts:255-267` (modulation accumulation) and `:277-284` (carrier
summation)

**Issue:** `worklet-messages.ts`'s own header calls `parseWorkletMessage` "this phase's single
security choke point" and states "no second validator appears anywhere in the processor." In
practice the validators for a `setAlgorithm` payload only check per-field *types* (operator id
range, boolean-ness), not the structural invariants `GraphRouter` actually relies on:

1. **`from > to` ordering.** `GraphRouter.render()` walks `DESCENDING_OPERATOR_IDS` (`[6,5,4,3,2,1]`)
   exactly once, accumulating each target's incoming connections from
   `this.operatorBlocks[connection.from]` under the assumption that `connection.from` was already
   rendered earlier in the same pass — which is only guaranteed when `from > to`
   (`graph-router.ts:39-46` documents this as the load-bearing invariant, enforced only at
   *dataset*-authoring time by `validate-algorithm.ts`, not at the message boundary). A
   `setAlgorithm` payload with a connection where `from < to` passes `isOperatorConnectionLike`
   unchanged, and would cause `GraphRouter` to silently read a stale, previous-block value instead
   of failing or rendering correctly.
2. **Self-loop ⇔ `isFeedback` consistency.** Nothing requires `from === to` when `isFeedback` is
   `true`, or forbids `from === to` when `isFeedback` is `false`. A connection like
   `{ from: 3, to: 3, isFeedback: false }` passes validation; in `render()`
   (`graph-router.ts:258-267`) it is *not* skipped (only `connection.isFeedback` short-circuits the
   skip), so it accumulates `operatorBlocks[3]` — the *previous* render call's block for operator 3,
   since operator 3's block for the current pass hasn't been written yet — into its own modulation
   input. That is a different (and wrong) delay semantics from the true one-sample feedback delay
   `renderWithFeedback` implements.
3. **Carrier uniqueness.** `isCarrierIdArray` (`:143-145`) only checks length > 0 and per-element
   operator-id validity, not uniqueness. A `carriers` array with a duplicate id causes
   `graph-router.ts:277-284`'s summation loop to add that operator's contribution twice into the
   final output.

None of these three shapes are exercised by `worklet-messages.spec.ts`'s hostile-payload matrix or
by `algorithm-routing.spec.ts`'s degenerate-config tests (T-08-06), which cover empty carriers and
a feedback-only connection list but not an out-of-order or duplicate one. Today this is unreachable
through the shipped product because the only production caller,
`buildRoutingConfig`/`WorkletSynthEngine.applyInstrumentStateToWorklet`, always derives connections
from the already-validated 32-algorithm dataset — but that also means the "single choke point" no
longer actually holds the line if a future bug (in `planConnections`, a new algorithm entry, or a
new caller) produces an out-of-order or duplicate list; it would degrade to "silently produces
subtly wrong but bounded audio" rather than the fail-loud posture the rest of this module aims for.

**Fix:** Extend `isRoutingConnectionsArray`/`isCarrierIdArray` to check the structural invariants,
e.g.:

```ts
function isRoutingConnectionsArray(value: unknown): value is readonly OperatorConnection[] {
  if (!Array.isArray(value) || !value.every(isOperatorConnectionLike)) {
    return false;
  }
  return (value as OperatorConnection[]).every((connection) =>
    connection.isFeedback ? connection.from === connection.to : connection.from > connection.to,
  );
}

function isCarrierIdArray(value: unknown): value is readonly OperatorId[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isOperatorIdValue)) {
    return false;
  }
  return new Set(value).size === value.length;
}
```

#### WR-02: README.md's status summary is stale and contradicts the rest of the document

**File:** `README.md:8-12`

**Issue:** The "Status" line reads: *"Phase 3 of 14 complete — Angular scaffold, the canonical
32-algorithm domain dataset, and the `InstrumentState` signal facade... No synthesis engine yet
beyond a typed placeholder interface."* This directly contradicts the same document's later
sections — "Worklet build and dev harness" (line 36 onward) describes "the six-operator
phase-modulation kernel that Phase 7's accuracy-target engine runs on," "As of Phase 8, the harness
exercises the routed 32-algorithm path," etc. — and contradicts the actual code under review in
this phase (a fully wired `WorkletSynthEngine` routed engine, D-01 cutover complete). A reader
landing on the README first would be actively misled about how far the project has progressed.

**Fix:** Update the Status line to reflect the current phase (Phase 8 complete: routed
32-algorithm engine, live re-patching, feedback) or remove the specific phase-count claim from
README.md in favor of a pointer to `.planning/ROADMAP.md`/`STATE.md`, which are presumably kept
current.

### Info

#### IN-01: Per-operator-entry validation doesn't close its key set the way the top-level set validator does

**File:** `src/app/domain/dx7/dsp/worklet-messages.ts:151-184` vs `:192-200`

**Issue:** `isOperatorParameterSetLike` (`:192-200`) was explicitly hardened (per its own comment)
so an operator-parameter-set payload with a stray 7th key alongside all six valid entries is
rejected: `Object.keys(value).length !== OPERATOR_IDS.length` closes that door. But
`isValidOperatorParametersEntry` (`:151-184`), which validates each *individual* operator's
parameter object, only checks that the seven expected fields are present and well-typed — it never
checks `Object.keys(entry).length`. A payload like
`{ ...validOperators, 1: { ...validOperators[1], maliciousExtra: 'x' } }` still passes validation
today, whereas the sibling top-level check treats an analogous "unexpected extra key" shape as
reason to reject. The impact is currently benign (the extra field is never read), but it's an
inconsistency in a module whose whole design principle is a single, complete choke point.

**Fix:** Mirror the same closed-set check used for the outer object:

```ts
const EXPECTED_OPERATOR_ENTRY_KEYS = ['enabled', 'mode', 'fixedFrequencyHz', 'ratio', 'detune', 'outputLevel', 'envelopeLevel'];

function isValidOperatorParametersEntry(value: unknown): boolean {
  if (!isPlainObject(value) || Object.keys(value).length !== EXPECTED_OPERATOR_ENTRY_KEYS.length) {
    return false;
  }
  // ...existing field checks...
}
```

---

_Reviewed: 2026-08-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
