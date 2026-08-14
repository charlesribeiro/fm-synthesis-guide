---
phase: 07-audioworklet-dsp-foundation
reviewed: 2026-08-12T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - .gitignore
  - README.md
  - angular.json
  - package-lock.json
  - package.json
  - scripts/assert-no-harness-in-dist.mjs
  - scripts/build-worklet.mjs
  - scripts/verify-harness-isolation.mjs
  - src/app/core/audio/audio-worklet-node.token.ts
  - src/app/core/audio/testing/fake-audio-worklet-node.ts
  - src/app/core/audio/worklet-processor-bundle.spec.ts
  - src/app/core/audio/worklet-synth-engine.spec.ts
  - src/app/core/audio/worklet-synth-engine.ts
  - src/app/domain/dx7/dsp/additive-fixture.spec.ts
  - src/app/domain/dx7/dsp/additive-fixture.ts
  - src/app/domain/dx7/dsp/operator.spec.ts
  - src/app/domain/dx7/dsp/operator.ts
  - src/app/domain/dx7/dsp/worklet-messages.spec.ts
  - src/app/domain/dx7/dsp/worklet-messages.ts
  - tsconfig.harness.json
  - tsconfig.worklet.json
  - worklets/dx7-worklet-processor.ts
  - worklets/harness/harness-main.ts
  - worklets/harness/index.html
findings:
  critical: 0
  warning: 5
  info: 7
  total: 12
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-08-12
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

This is a fresh, complete review of the current state of Phase 7 (waves 1–4, plus the
standalone `WorkletSynthEngine` concurrency-guard / `AdditiveOperatorBank.validateBlockSize()`
fix layered on top). Every prior-review finding was individually re-verified against the code as
it stands now rather than carried forward blind.

**Two prior findings are now resolved** and are not repeated as open findings below:
- The prior WR-03 ("`processorOptions.frequencyHz` bypasses `worklet-messages.ts` validation")
  is fixed: `worklets/dx7-worklet-processor.ts:39-41` now routes the constructor-supplied
  frequency through `isValidFrequencyHz(...)` before use, falling back to `DEFAULT_FREQUENCY_HZ`
  exactly as the prior review's suggested fix proposed.
- The prior IN-01 ("`AdditiveOperatorBank`'s harmonic-multiplier fallback silently mismatches
  non-default lengths") is fixed: the constructor now hard-rejects any `frequencies` array whose
  length isn't 6, and `deriveFrequencyMultipliers` computes real ratios from the supplied array
  instead of falling back to `?? 1`. (This surfaces a new, narrower gap — see WR-06 below: the new
  logic itself is untested.)

**Three prior findings are still open, unchanged:** lint scope excludes `worklets/**`/`scripts/**`
(WR-01), `typecheck:worklet` is still wired into no hook (WR-02), and `setMode` still leaves the
inactive kernel's phase stale across a mode switch (WR-04). The stale README status line (IN-02),
the now-genuinely-unused `eslint-disable` comment (IN-03), and the un-line-reviewed lockfile
(IN-04) are also all still present, confirmed against the current file contents rather than
assumed.

New to this review: the 07-04 gap-closure scripts (`assert-no-harness-in-dist.mjs`,
`verify-harness-isolation.mjs`) and `build-worklet.mjs`'s relocation logic are well-designed and
match their own documentation, but `assert-no-harness-in-dist.mjs`'s `isMain` self-invocation
check breaks on Windows, silently turning `postbuild` into a no-op on that platform (WR-05) — a
real gap in exactly the "fail closed" guarantee the surrounding README section advertises at
length. The new `AdditiveOperatorBank` custom-frequency-ratio logic (the fix for the old IN-01) is
itself untested on its two new branches (WR-06).

No critical/blocker-level defects were found. The DSP kernel, message-validation choke point, and
`WorkletSynthEngine` lifecycle/concurrency guard are all careful, correctly reasoned, and matched
by tests that actually exercise the claimed behavior.

## Warnings

### WR-01: `worklets/**` and `scripts/**` are still invisible to `npm run lint`

**File:** `angular.json:102`
**Issue:** `"lintFilePatterns": ["src/**/*.ts", "src/**/*.html"]` still does not include
`worklets/**` or `scripts/**`. Both are source directories this phase introduced and both remain
outside every lint invocation `npm run lint` performs. Confirmed still true by direct read of the
current `angular.json`.
**Fix:** Widen `lintFilePatterns` to include `worklets/**/*.ts` and `scripts/**/*.mjs`, or add a
second `eslint worklets scripts` invocation so `npm run lint` covers the full reviewed diff.

### WR-02: `typecheck:worklet` is still defined but invoked by nothing

**File:** `package.json:20`
**Issue:** `"typecheck:worklet": "tsc -p tsconfig.worklet.json && tsc -p tsconfig.harness.json"`
remains unreferenced by `prebuild`, `prestart`, `pretest`, `build`, `test`, `lint`, or any other
script (`prebuild`/`prestart`/`pretest` all still resolve only to `npm run build:worklet`, which
is an esbuild transpile with no type-checking). A genuine type error in
`worklets/dx7-worklet-processor.ts` or `worklets/harness/harness-main.ts` — the two files that are
this phase's actual new runtime surface — would still ship into `public/worklets/*.js` /
`dev-dist/*.js` undetected by any of the three commands CLAUDE.md mandates before declaring work
complete.
**Fix:** Wire `typecheck:worklet` into `prebuild`/`pretest` (e.g.
`"prebuild": "npm run build:worklet && npm run typecheck:worklet"`).

### WR-04: `setMode` still leaves the inactive kernel's phase accumulator frozen, risking a click on resume

**File:** `worklets/dx7-worklet-processor.ts:56-70`, `PhaseModulatedOperator.phase` in
`src/app/domain/dx7/dsp/operator.ts:55`
**Issue:** `process()` renders only `this.operator` (single mode) or `this.bank` (additive mode),
never both, so the inactive kernel's phase accumulator does not advance while it is not selected.
Toggling `setMode` back to a previously-active kernel mid-note resumes it from a stale phase
relative to elapsed real time, producing an audible phase discontinuity/click — unchanged from the
prior review. `setRenderMode` remains a concrete-class-only method not on `SynthEngine`, and
`worklet-processor-bundle.spec.ts`'s mode-switch test (`worklet-processor-bundle.spec.ts:136-156`)
only exercises a single-then-additive transition where the additive bank had never rendered
before, so it cannot observe the discontinuity — the gap is still real and still untested for the
mid-note ping-pong case.
**Fix:** Call `resetPhase()` (or an equivalent re-sync) on the kernel being switched into inside
`handleMessage`'s `setMode` branch, or explicitly document that a mid-note mode switch is expected
to click and is out of scope until Phase 8 supersedes `setRenderMode`.

### WR-05: `assert-no-harness-in-dist.mjs`'s CLI self-check silently never runs on Windows, defeating the `postbuild` fail-closed guarantee there

**File:** `scripts/assert-no-harness-in-dist.mjs:53`
**Issue:**
```js
const isMain = import.meta.url === `file://${process.argv[1]}`;
```
On Windows, `process.argv[1]` is a native path such as `C:\repo\scripts\assert-no-harness-in-dist.mjs`,
while `import.meta.url` is a correctly-formed URL such as
`file:///C:/repo/scripts/assert-no-harness-in-dist.mjs`. String-concatenating `file://` onto the
raw Windows path (`file://C:\repo\...`, wrong slash direction, missing the third slash) can never
equal the real `import.meta.url`, so `isMain` evaluates to `false` and the entire CLI block —
including the call to `assertNoHarnessInDist` and the `process.exit(1)` on failure — never
executes. `"postbuild": "node scripts/assert-no-harness-in-dist.mjs"` would then exit `0`
unconditionally on Windows without ever inspecting `dist/` for a leaked harness artifact, which is
precisely the regression this gate exists to catch (the README's "Worklet build and dev harness"
section describes this as turning "a leak" into "a failed build, not a silent shipped file" — a
guarantee that silently does not hold on this platform). The project shows deliberate Windows
awareness elsewhere (`verify-harness-isolation.mjs`'s `isWindows = process.platform === 'win32'`
/ `shell: isWindows` handling for `execFileSync`), which makes this a live cross-platform gap
rather than an out-of-scope concern.
**Fix:** Use a URL-safe comparison, e.g. `import { pathToFileURL } from 'node:url';` then
`const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;`, which is correct on
every platform.

### WR-06: `AdditiveOperatorBank`'s new custom-frequency-ratio logic (the fix for the old IN-01) has zero test coverage

**File:** `src/app/domain/dx7/dsp/additive-fixture.ts:106-120`, spec:
`src/app/domain/dx7/dsp/additive-fixture.spec.ts`
**Issue:** `deriveFrequencyMultipliers` now has two real branches beyond the "matches the default
fixture" case that the previous review's IN-01 identified as silently wrong: (1) computing correct
ratios for a valid custom same-length (6) frequency array whose values differ from the default,
and (2) throwing `RangeError` when `frequencies[0]` (the base) is zero, negative, or non-finite.
Neither branch is exercised anywhere in `additive-fixture.spec.ts` — the only new test added is
"throws … for a frequencies array of the wrong length" (a different guard, the constructor-level
length check, not this function). I traced both branches by hand and they appear correct (ratios
derived as `frequencyHz / base`, matching what `setBaseFrequencyHz` later multiplies back out),
but this is exactly the kind of newly-introduced domain logic CLAUDE.md's testing rules require
coverage for ("New domain behavior requires tests" / "Add invariant tests whenever an
algorithm-data bug is fixed" — this *is* a fix for a previously-flagged algorithm-data bug). It is
currently unreachable from any production call site (`Dx7WorkletProcessor` always constructs the
bank with the default `frequencies` argument), which limits blast radius today but not once a
later phase starts passing a real per-algorithm frequency set.
**Fix:** Add two cases to `additive-fixture.spec.ts`: a valid custom 6-length array with
non-default values, asserting `setBaseFrequencyHz` + `render` reproduces the same ratios
independently computed against `frequencies[i] / frequencies[0]`; and a construction call with a
zero/negative/`NaN` `frequencies[0]`, asserting it throws `RangeError`.

## Info

### IN-02: README's top-of-file `Status` line is still stale

**File:** `README.md:8`
**Issue:** Still reads `**Status:** Phase 3 of 14 complete — … No synthesis engine yet beyond a
typed placeholder interface`, directly above a "Worklet build and dev harness" section (added by
this same phase) describing a real six-operator AudioWorklet engine, and after Phase 5 already
shipped an `OscillatorNode`-based engine. Unchanged from the prior review.
**Fix:** Update the `Status` line whenever a phase's README section is added, or replace it with a
pointer to `.planning/STATE.md`.

### IN-03: Stale `eslint-disable` directive confirms the WR-01 lint-scope gap is live

**File:** `worklets/harness/harness-main.ts:177`
**Issue:** `// eslint-disable-next-line no-console -- dev-only harness diagnostics, never shipped`
suppresses a rule (`no-console`) that `eslint.config.js` does not enable anywhere in this project
(only `@eslint/js` recommended, `typescript-eslint` recommended/stylistic, and Angular rules are
configured — no `no-console`). Directly running `npx eslint worklets/harness/harness-main.ts`
reports "Unused eslint-disable directive", a warning `npm run lint` never surfaces because of
WR-01's scope gap.
**Fix:** Remove the disable comment, or add `no-console` to the shared config if suppression is
actually intended and reference it from there instead of an inline comment.

### IN-04: `package-lock.json` not line-reviewed

**File:** `package-lock.json`
**Issue:** Generated lockfile; not meaningfully human-reviewable line-by-line. Spot-checked every
`"resolved"` URL (all point to `https://registry.npmjs.org/`) and scanned for git-protocol
dependencies (only `"type": "github"` funding-metadata entries found, not dependency sources) —
no anomalies found.
**Fix:** None required — noted for completeness of `files_reviewed_list`.

### IN-05: Default operator frequency (`440`) is a duplicated magic number instead of a shared constant

**File:** `src/app/core/audio/worklet-synth-engine.ts:251`, `worklets/dx7-worklet-processor.ts:25`
**Issue:** `worklet-synth-engine.ts` hardcodes `processorOptions: { frequencyHz: 440 }` as a raw
literal, while `dx7-worklet-processor.ts` separately declares `const DEFAULT_FREQUENCY_HZ = 440;`.
Both files already import from `worklet-messages.ts` (a shared, framework-free domain module both
sides can depend on without breaching D-01 isolation), so a single exported
`DEFAULT_OPERATOR_FREQUENCY_HZ` constant there would remove the duplication and the risk of the
two values silently drifting apart in a future edit.
**Fix:** Export a `DEFAULT_OPERATOR_FREQUENCY_HZ` constant from `worklet-messages.ts` and import
it from both call sites in place of the two independent `440` literals.

### IN-06: `verify-harness-isolation.mjs`'s `fail()` throws after already setting `process.exitCode`, producing a redundant uncaught-exception stack trace

**File:** `scripts/verify-harness-isolation.mjs:33-37`
**Issue:** `fail()` sets `process.exitCode = 1`, logs a formatted error, and then `throw`s. The
`throw` is never caught by anything in the surrounding `try { … } finally { cleanup(); }` (there
is no `catch`), so it propagates out of the whole script as an uncaught exception. The `finally`
block still runs (cleanup happens correctly) and the process still exits non-zero as intended, but
Node additionally prints a full uncaught-exception stack trace on top of the already-logged
`console.error` message, which is noisy for a script whose whole purpose is a clear pass/fail
signal for a human running it on demand.
**Fix:** Either `return` immediately after logging in `fail()` (relying solely on
`process.exitCode`) or wrap the body in a `try { … } catch (error) { … } finally { cleanup(); }`
that logs once and calls `process.exit(1)` explicitly, rather than letting the throw escape
uncaught.

### IN-07: `Dx7WorkletProcessor.process()` indexes `outputs[0][0]` with no defensive check

**File:** `worklets/dx7-worklet-processor.ts:72-74`
**Issue:** `const output = outputs[0]; const channel = output[0];` assumes at least one output and
at least one channel are always present. This holds today only because both current construction
sites (`worklet-synth-engine.ts:250`, `worklets/harness/harness-main.ts:120-122`) explicitly pass
`outputChannelCount: [1]`. If a future call site ever constructs the node without that option (or
the host ever calls `process()` with a disconnected/zero-channel output), `channel` would be
`undefined` and `channel.length`/`channel.fill(0)` would throw inside the audio render thread,
which most browsers handle by silently disabling the processor (silent audio dropout, not a
crash-with-message the user or developer would see).
**Fix:** Guard with `if (channel === undefined) { return true; }` (or equivalent) before using
`channel`, matching the defensive posture `parseWorkletMessage` and the frequency validation
already take at this same realm boundary.

### IN-08: One of `WorkletSynthEngine`'s two generation-staleness checks inside `buildAndStart` is untested

**File:** `src/app/core/audio/worklet-synth-engine.ts:234-241`, spec:
`src/app/core/audio/worklet-synth-engine.spec.ts:191-215`
**Issue:** `buildAndStart` re-checks `generation !== this.initializationGeneration` at two points:
right after `await context.resume()` (line 235) and right after `await
context.audioWorklet.addModule(...)` (line 244). Only the second is exercised by a test — "destroy()
during a deferred addModule() discards the local graph…" — because `FakeAudioWorklet` exposes a
`deferredAddModule` static hook to suspend exactly at that await point, but there is no equivalent
`deferredResume` hook on the fake context, so no test can suspend execution between `context.new()`
and the `resume()` await resolving to exercise the first check. I traced the logic by hand and it
is structurally identical to (and no more risky than) the tested second check, so this is a
coverage gap rather than a suspected bug.
**Fix:** Add a `deferredResume` static hook to `FakeAudioWorkletContext`/its `resume()` mirroring
`FakeAudioWorklet.deferredAddModule`, and a test analogous to the existing deferred-`addModule`
one but suspending at `resume()` instead, to give the first staleness check the same regression
protection as the second.

---

_Reviewed: 2026-08-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
