---
phase: 7
slug: audioworklet-dsp-foundation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-11
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.8`, run through Angular 22's `@angular/build:unit-test` builder |
| **Config file** | none — no standalone `vitest.config.ts`; the builder derives its Vitest config from `angular.json`/`tsconfig.spec.json` |
| **Quick run command** | `npm test` (already runs once and exits outside a TTY — Phase 1 finding in `.planning/STATE.md`: `npm test -- --run` is not a real flag this builder proxies) |
| **Full suite command** | `npm test` (same command — this project has not established a separate quick/full split) |
| **Estimated runtime** | ~2-3 seconds added over Phase 6's baseline (new pure DSP kernel module + fake worklet DI boundary; no component/template work expected this phase) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test` + `npm run build` + `npm run lint`
- **Before `/gsd-verify-work`:** `npm run build`, `npm test`, `npm run lint` all green (CLAUDE.md's mandatory verification commands)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

Task ID / Plan / Wave columns are re-derived from the four executed plans' SUMMARY.md files
(07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md), not from this draft's
original guesses.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 2 | 07-01 | 1 | ENGINE-01 | — / — | N/A | unit | `npm test` (covers `src/app/domain/dx7/dsp/operator.spec.ts`) — single operator renders `sin(2πft)` within tolerance to 6 decimal places over both a 128-sample and a full 44100-sample block | ✓ Exists | ✅ passed |
| Task 3 | 07-01 | 1 | ENGINE-01 | — / — | N/A | unit | `npm test` (covers `additive-fixture.spec.ts`) — `AdditiveOperatorBank` sums six independent operators and equals the ascending-order per-operator sum exactly | ✓ Exists | ✅ passed |
| Task 3 | 07-01 | 1 | ENGINE-01 | T-07-01 / `parseWorkletMessage` validation choke point | Every malformed `postMessage` payload shape is rejected (returns `null`), never throws | unit | `npm test` (covers `worklet-messages.spec.ts` — 16-row hostile-payload table) | ✓ Exists | ✅ passed |
| Task 2 | 07-01 | 1 | ENGINE-01 | — / — | N/A | unit | `npm test` (covers `worklet-processor-bundle.spec.ts`) — the built `public/worklets/dx7-worklet-processor.js` bundle registers `dx7-operator`, renders correctly, and handles messages correctly when evaluated in Node against stub `AudioWorkletProcessor`/`registerProcessor`/`sampleRate` globals | ✓ Exists | ✅ passed |
| Task 2 | 07-02 | 2 | ENGINE-01 | — / — | N/A | unit | `npm test` (covers `worklet-synth-engine.spec.ts`, 21 tests, TDD RED `89486af` → GREEN `70cce8f`) — `WorkletSynthEngine` implements the full `SynthEngine` interface shape over a fake `AudioWorkletNode`-like boundary; `SYNTH_ENGINE` still resolves to `WebAudioSynthEngine` (D-01 isolation asserted by test) | ✓ Exists | ✅ passed |
| Task 1 | 07-02 | 2 | ENGINE-01 | T-07-06 / build-time-fixed module URL | `AUDIO_WORKLET_NODE_CTOR`/`AUDIO_WORKLET_MODULE_URL` follow `audio-context.token.ts`'s exact InjectionToken shape; no Phase 5 file modified | unit | `npm run build && npm run lint` (both green); `git diff --exit-code` against Phase 5 token/fake/engine files | ✓ Exists | ✅ passed |
| Task 1 | 07-03 | 3 | ENGINE-01 | T-07-09 / opt-in harness build flag | Clean-checkout isolation only (superseded for realistic harness-then-build by 07-04): the harness bundle only exists when `npm run harness` is invoked explicitly; flagless `build:worklet` does not create `public/dev/` on a clean tree. Full structural isolation (output outside `public/`, postbuild, `verify:harness-isolation`) is 07-04's job | unit + other | `npm run typecheck:worklet && npm run harness && test -f public/dev/worklet-harness.js && test -f public/dev/worklet-harness.html && npm test && npm run lint` | ✓ Exists | ✅ passed (clean-checkout; superseded by 07-04 for realistic sequence) |
| Task 2 | 07-03 | 3 | ENGINE-01 | T-07-11 / hearing-safety `MASTER_GAIN` clamp | The worklet loads without console errors and both the single-operator and additive six-carrier cases sound correct, click-free, at a safe level, in a real browser — the ROADMAP's success criterion 1 | manual, blocking | none — jsdom has no `AudioWorkletGlobalScope`; human used the dev harness at `http://localhost:4200/dev/worklet-harness.html` and listened through headphones | N/A — inherently manual, by design | ✅ approved |
| Task 1 | 07-04 | 4 | ENGINE-01 | T-07-13 / dev-only harness reaching production | The harness build output is relocated to `dev-dist/`, entirely outside `public/` (the only directory the production asset configuration reads); the flagless `build:worklet` path unconditionally removes a legacy `public/dev/`; the harness keeps its original `/dev/worklet-harness.html` URL via a named `harness` build/serve configuration; the exact harness-then-build sequence 07-VERIFICATION.md reproduced as a failure now leaves no `dev` artifact under `dist/` | unit + other | `npm run harness && test -f dev-dist/worklet-harness.js && test -f dev-dist/worklet-harness.html && test ! -e public/dev && mkdir -p public/dev && touch public/dev/stale.js && npm run build:worklet && test ! -e public/dev && npm run build && test ! -e dist/dx7-algorithm-lab/browser/dev && npm test && npm run lint && npm run typecheck:worklet` | ✓ Exists | ✅ passed |
| Task 2 | 07-04 | 4 | ENGINE-01 | T-07-15 / the isolation gate itself | `scripts/assert-no-harness-in-dist.mjs` fails closed on a planted harness artifact and on a missing output tree; `scripts/verify-harness-isolation.mjs` reproduces the harness-then-build sequence, covers the `development` build configuration, and runs a positive control proving the `harness` configuration still builds and maps to its URL; every `npm run build` self-asserts via `postbuild` | unit + other | `npm run verify:harness-isolation` (all three stages pass); planted-leak proof (`node scripts/assert-no-harness-in-dist.mjs` exits non-zero on a copied harness artifact, exits 0 once removed); missing-tree proof (`node scripts/assert-no-harness-in-dist.mjs .tmp-harness-dist-absent` exits non-zero) | ✓ Exists | ✅ passed |

*Status: ⬜ pending · ✅ green/passed/approved · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/app/domain/dx7/dsp/operator.ts` + `operator.spec.ts` — new pure phase-accumulator/PM kernel, covers success criterion 2 (deterministic sample-block testing outside the browser)
- [x] `src/app/domain/dx7/dsp/additive-fixture.ts` + `additive-fixture.spec.ts` — synthetic additive multi-operator fixture
- [x] `src/app/core/audio/worklet-synth-engine.ts` + `.spec.ts` — `SynthEngine` implementation for the worklet boundary
- [x] `src/app/core/audio/audio-worklet-node.token.ts` + `testing/fake-audio-worklet-node.ts` — DI/fake-boundary seam (mirrors the existing `AUDIO_CONTEXT_CTOR`/`AudioContextLike` pattern)
- [x] `worklets/dx7-worklet-processor.ts` + `tsconfig.worklet.json` + `scripts/build-worklet.mjs` — no Vitest coverage possible (jsdom has no `AudioWorkletGlobalScope`); proven by the blocking human-listening checkpoint below, now approved
- [x] Framework install: `esbuild` (explicit devDependency, previously transitive) + `@types/audioworklet` — legitimacy checkpoint approved in 07-01 Task 1 (Vitest itself was already present; no new test framework needed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Checkpoint Outcome |
|----------|-------------|------------|-------------------|---------------------|
| Worklet loads and runs a single operator and an additive multi-operator case correctly in a real browser | ENGINE-01 (success criterion 1) | jsdom has no `AudioWorkletGlobalScope` (RESEARCH.md Pitfall 2) — nothing short of a real `AudioContext` + `audioWorklet.addModule()` proves the module actually registers, loads, and runs | Historical 07-03 procedure: `npm start`, open `http://localhost:4200/dev/worklet-harness.html`, and run the nine-check listening pass in `07-03-PLAN.md` Task 2. After 07-04, the dedicated command is `npm run start:harness` (plain `npm start` no longer serves the harness). | **Approved 07-03 Task 2 checkpoint, zero findings — recorded against `npm start`, which served the harness at that time.** Checks 1–7 and 9 (module loads with a clean console, silence before the enable gesture, pure single-operator sine, fused additive six-carrier tone, click-free start/stop/restart, safe loudness on the six-carrier worst case, 30+s glitch-free run, full keyboard operation with visible focus) all passed as-is — human's own words: "opened and tested. working fine." Check 8 (RESEARCH Assumption A5, the rebuild-loop question): **explicit answer — "Reload was enough — no restart needed."** `ng serve`'s live-reload picked up the rebuilt harness after rebuild; a plain browser reload showed the change with no dev-server restart required. README's rebuild-loop guidance corrected to state this (see `README.md` § Worklet build and dev harness). No source change resulted from this checkpoint beyond that documentation correction. |
| Dedicated harness serve configuration (`npm run start:harness`) loads the same listening page | ENGINE-01 (D-06/D-07, 07-04) | Same real-browser constraint as the row above; 07-04 relocated harness assets to `dev-dist/` and a named serve configuration | Follow-up procedure: `npm run start:harness`, then open `http://localhost:4200/dev/worklet-harness.html`. Not a separately recorded real-browser checkpoint — the approved 07-03 outcome above remains the historical listening record. | **Follow-up — not separately recorded.** `start:harness` / `prestart:harness` exist and are documented; no additional human-verify payload was captured for that command. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every `type="auto"`/`type="tdd"` task across 07-01/07-02/07-03/07-04 (Waves 1–4) carries a passing `<automated>` verify; 07-03's Task 2 is the phase's only non-automated task and is itself a `checkpoint:human-verify`, not a gap.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — the full task sequence is checkpoint (legitimacy, 07-01 Task 1), auto, tdd, auto, tdd(RED)/tdd(GREEN), auto, checkpoint (07-03 Task 2), then 07-04's auto tasks; no run of 3+ consecutive non-automated tasks.
- [x] Wave 0 covers all MISSING references — see the Wave 0 Requirements checklist above, all six items shipped across 07-01/07-02/07-03, with 07-04's isolation gate recorded in the Per-Task Verification Map.
- [x] No watch-mode flags — every Automated Command in the table above passes non-watch invocations (`npm test`, `npm run build`, `npm run lint`, `npm run harness`, `npm run typecheck:worklet`, `npm run verify:harness-isolation`); this file contains zero occurrences of an enabled watch flag.
- [x] Feedback latency < 15s for per-commit commands — `npm test` full-suite run stayed within the phase's ~2-3s-over-baseline estimate (870/870 tests in the phase's final suite, per `07-VERIFICATION.md`); individual task verification chains are faster still. Intentional exception: `npm run verify:harness-isolation` runs three full non-watch builds (~tens of seconds) and is an on-demand gate, not a per-commit hook.
- [x] `nyquist_compliant: true` set in frontmatter — every box above holds against the real, executed state (not the draft's intentions), and 07-03 Task 2's checkpoint closed the sole manual-only row with "approved," zero findings, zero outstanding gap.

**Approval:** validated and Nyquist-compliant. 07-03 Task 2's blocking human-verify checkpoint (worklet load, single-operator purity, additive-case fusion, click-free starts/stops, loudness safety, 30+s glitch-free run, the rebuild-loop question, and keyboard-only operation) was approved with all nine checks passing and zero findings — human's own words: "opened and tested. working fine," with Check 8 separately confirmed as "Reload was enough — no restart needed." `npm run build`, `npm test`, `npm run lint`, and `npm run typecheck:worklet` were all green at the 07-03 Task 1 tip (`4c443ad`).

**07-04 gap-closure note:** 07-VERIFICATION.md's initial pass found one failing must-have — the dev
harness's build output could reach a production `dist/` under the realistic harness-then-build
sequence its own README documented (no gap in the ROADMAP's two core success criteria, both of
which stayed verified throughout). 07-04 closed it by relocating the harness output to `dev-dist/`,
outside the only directory the production asset configuration reads, and installing
`npm run verify:harness-isolation` as an on-demand regression gate. That command runs three full
non-watch builds (~tens of seconds), well outside a per-commit 15s budget by design — it is
intentionally not wired into any lifecycle hook, matching this file's own instruction that
`postbuild`'s near-zero-cost assertion (not the full three-build gate) is what runs on every
ordinary build. Sign-off for ENGINE-01 covers 07-04 plus `npm run verify:harness-isolation`.
ENGINE-01 is now fully closed.
