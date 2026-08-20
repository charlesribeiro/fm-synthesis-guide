---
phase: 07-audioworklet-dsp-foundation
plan: 04
subsystem: infra
tags: [esbuild, angular-cli, build-tooling, dev-harness, audioworklet, dx7]

# Dependency graph
requires:
  - phase: 07-audioworklet-dsp-foundation
    plan: 03
    provides: "worklets/harness/harness-main.ts, worklets/harness/index.html — the dev listening harness this plan relocates the build output of; scripts/build-worklet.mjs's opt-in --harness flag this plan changes the destination of"
provides:
  - "scripts/build-worklet.mjs --harness now writes to dev-dist/, entirely outside public/ — the only directory the production asset configuration reads"
  - "angular.json harness build+serve configuration mapping dev-dist -> dev, preserving the /dev/worklet-harness.html URL without touching production/development configurations or the base options.assets"
  - "scripts/assert-no-harness-in-dist.mjs — exported assertNoHarnessInDist(distRoot), fail-closed on a leak or a missing output tree, runnable as a CLI and wired into postbuild"
  - "scripts/verify-harness-isolation.mjs — 3-stage on-demand regression gate reproducing the exact harness-then-build sequence 07-VERIFICATION.md failed on, plus development-configuration coverage and a harness-configuration positive control"
  - "npm run start:harness / prestart:harness — serves the harness at its original URL through the named configuration"
  - "npm run postbuild — every npm run build self-asserts its own output tree"
affects: [08-graph-routing-and-feedback, 09-envelopes]

actuals:
  tokens: 5954
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Structural isolation over convention: a dev-only build artifact's non-shippability is guaranteed by writing it outside the directory the production asset pipeline reads, not by remembering never to invoke a build flag from a lifecycle hook — the exact convention 07-VERIFICATION.md proved insufficient for this same harness."
    - "Every ng build self-asserts its own output tree via postbuild at near-zero cost (stats an already-built tree, never invokes a build), while the heavier realistic-sequence regression gate (3 full builds) stays an explicit on-demand command, never a lifecycle hook, so ordinary builds don't triple in cost."

key-files:
  created:
    - scripts/assert-no-harness-in-dist.mjs
  modified:
    - scripts/build-worklet.mjs
    - scripts/verify-harness-isolation.mjs
    - angular.json
    - package.json
    - .gitignore
    - README.md
    - .planning/phases/07-audioworklet-dsp-foundation/07-VALIDATION.md

key-decisions:
  - "Chose the gap report's remedy 3 (relocate harness output outside public/) over remedy 1 (clean the legacy directory) or excluding dev/** from the asset glob, per the plan's explicit reversibility rationale: relocation is the only remedy that holds independently of invocation order. Applied remedy 1 on top of it as migration repair for machines that already leaked under the pre-07-04 layout."
  - "Found and overwrote a partial, differently-shaped fix already present on disk from an earlier session (angular.json's production configuration had an `ignore: [\"dev/**\"]` asset override, and scripts/verify-harness-isolation.mjs existed as a simpler 2-command script without the exported assertNoHarnessInDist, the CLI entry point, or the 3-stage/positive-control structure this plan's Task 2 specifies). That earlier fix conflicted directly with this plan's acceptance criteria (which require production/development configurations to carry zero assets override) and predates 07-VERIFICATION.md's gap report by all appearances, so it was replaced rather than reconciled — the plan's remedy-3 design is the one this SUMMARY documents as shipped."
  - "Dropped the `--keep-dev` flag entirely: `scripts/build-worklet.mjs` has no such flag, and `package.json`'s `prestart` is `node scripts/build-worklet.mjs` with no extra arguments, matching the 07-04-PLAN acceptance assertion."

patterns-established:
  - "A build script's fail-closed assertion module (assertNoHarnessInDist) is both an importable function for a heavier gate and a standalone CLI via an import.meta.url === file://${process.argv[1]} guard — reusable pattern for any future postbuild self-check."

requirements-completed: [ENGINE-01]

coverage:
  - id: D1
    description: "The harness-then-build sequence 07-VERIFICATION.md reproduced as a failure (npm run harness, then a plain npm run build with no manual cleanup) now leaves no dev directory or harness file anywhere under dist/; the legacy public/dev/ directory is removed by the next flagless build; the real worklet processor bundle still ships"
    requirement: "ENGINE-01"
    verification:
      - kind: other
        ref: "npm run harness && test -f dev-dist/worklet-harness.js && test -f dev-dist/worklet-harness.html && test ! -e public/dev; mkdir -p public/dev && touch public/dev/worklet-harness.js public/dev/worklet-harness.html && npm run build:worklet && test ! -e public/dev; npm run build && test ! -e dist/dx7-algorithm-lab/browser/dev && test -f dist/dx7-algorithm-lab/browser/worklets/dx7-worklet-processor.js"
        status: pass
      - kind: other
        ref: "node -e checks against angular.json (harness config carries 2 assets, production/development carry none, base options.assets byte-identical) and package.json (start:harness/prestart:harness present, existing lifecycle scripts unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The isolation gate has teeth: a planted harness artifact drives assert-no-harness-in-dist.mjs red, a missing output tree drives it red, and npm run verify:harness-isolation passes all three stages (harness-then-build, development configuration, harness-configuration positive control) while cleaning its own scratch trees"
    requirement: "ENGINE-01"
    verification:
      - kind: other
        ref: "npm run verify:harness-isolation (exit 0, all 3 stages logged); planted-leak proof (copy harness html into dist/.../dev/, assert script exits non-zero, exits 0 once removed); missing-tree proof (assert script against a non-existent path exits non-zero); scratch-tree cleanup proof (.tmp-harness-dist and .tmp-harness-dist-dev both absent after the gate runs)"
        status: pass
    human_judgment: false
  - id: D3
    description: "README documents the corrected mechanism and current commands; 07-VALIDATION.md carries the gap-closure rows without disturbing the approved D-06/D-07 checkpoint record; npm run build/test/lint/typecheck:worklet all green. This plan added no tests; the recorded suite at close was 870/870 (the post-07-02 count after 2004eea added concurrent-initialize coverage in worklet-synth-engine.spec.ts and the AdditiveOperatorBank blockSize guard in additive-fixture.spec.ts). 07-04-PLAN still cited the earlier 866 figure."
    requirement: "ENGINE-01"
    verification:
      - kind: other
        ref: "grep checks on README.md (start:harness, verify:harness-isolation, dev-dist, worklet-harness.html all present) and 07-VALIDATION.md (07-04 rows present, status: validated / nyquist_compliant: true unchanged, git diff shows additions only); npm run build && npm test && npm run lint && npm run typecheck:worklet"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-12
status: complete
---

# Phase 7 Plan 4: AudioWorklet DSP Foundation — Gap Closure Summary

**Relocated the dev harness build output from `public/dev/` to `dev-dist/`, entirely outside the directory the production asset pipeline reads, closing the harness-then-build production leak 07-VERIFICATION.md reproduced twice; added a fail-closed `postbuild` assertion plus an on-demand 3-stage regression gate (`npm run verify:harness-isolation`) that reproduces the exact failing sequence and a positive control proving the harness still resolves at its original `/dev/worklet-harness.html` URL.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-12T16:36:00Z (approx)
- **Completed:** 2026-08-12T16:56:35Z
- **Tasks:** 3 of 3 complete
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- `scripts/build-worklet.mjs` — the `--harness` flag now bundles to `dev-dist/worklet-harness.js`
  and copies `dev-dist/worklet-harness.html`, a directory `angular.json`'s base and default
  configurations never read. The flagless path (invoked by `prebuild`/`prestart`/`pretest`) now
  unconditionally removes a legacy `public/dev/` directory — migration repair for any machine that
  ran a pre-07-04 `npm run harness`. Header comment rewritten to describe the mechanism that
  actually holds instead of the convention 07-VERIFICATION.md falsified.
- `angular.json` — new `harness` build configuration (mirrors `development`'s dev-ish options,
  carries the base `public` asset entry plus a second entry mapping `dev-dist` → output `dev`) and
  a matching `harness` serve configuration. `production` and `development` carry zero asset
  overrides; the base `options.assets` array is byte-identical to before this plan.
- `scripts/assert-no-harness-in-dist.mjs` (new) — exports `assertNoHarnessInDist(distRoot)`,
  walking a built tree for any `dev` directory or `worklet-harness.{js,html}` file. Throws on a
  find and throws on a missing `distRoot` (a missing tree is not a pass). Runnable as a CLI, wired
  into a new `postbuild` npm script so every `npm run build` self-asserts at near-zero cost.
- `scripts/verify-harness-isolation.mjs` (rewritten) — the on-demand 3-stage regression gate: stage
  1 reproduces the exact `npm run harness` → `npm run build` sequence with no cleanup in between and
  asserts `dist/` clean; stage 2 covers the `development` build configuration (the only other one
  reachable from `package.json`); stage 3 is a positive control that builds the `harness`
  configuration and asserts the harness page, harness script, and processor bundle all resolve at
  the paths `/dev/worklet-harness.html` serving requires — proving this gate cannot be satisfied by
  quietly breaking the harness. Scratch output trees are always removed in a `finally` block.
- `package.json` — added `start:harness`, `prestart:harness`, `postbuild`; `verify:harness-isolation`
  left pointed at the same script name (already present); `prebuild`/`prestart`/`pretest`/`build`/
  `harness`/`typecheck:worklet` all left unchanged.
- `.gitignore` — added `/dev-dist/`, `/.tmp-harness-dist/`, `/.tmp-harness-dist-dev/`; kept
  `/public/dev/` with an amended comment describing it as the legacy path the flagless build now
  deletes.
- `README.md`'s "Worklet build and dev harness" section rewritten: run instructions now name
  `npm run start:harness` (rebuild + serve at the unchanged URL) and state plainly that a plain
  `npm start` does not serve the harness; the isolation paragraph justifies the guarantee by where
  `dev-dist/` is written and names `npm run verify:harness-isolation` so a reader can check the
  claim instead of trusting it; the existing rebuild/reload guidance (no dev-server restart needed)
  survived unchanged.
- `07-VALIDATION.md` gained two new Per-Task Verification Map rows (Task 1 / `T-07-13`, Task 2 /
  `T-07-15`, both Plan `07-04`, Wave 4, Requirement `ENGINE-01`) and a gap-closure note under
  Validation Sign-Off; the frontmatter, existing rows, and Manual-Only Verifications table are
  untouched (`git diff` on the file shows additions only).
- Verified end-to-end: the realistic harness-then-build sequence with no cleanup leaves
  `dist/dx7-algorithm-lab/browser/` free of any `dev` artifact while still shipping
  `worklets/dx7-worklet-processor.js`; planted legacy `public/dev/worklet-harness.js` and
  `public/dev/worklet-harness.html` are removed by the next flagless `build:worklet` (and `public/dev`
  itself only if then empty); a planted harness artifact in `dist/` drives
  `assert-no-harness-in-dist.mjs` non-zero and clean again once removed; a missing output tree also
  drives it non-zero; `npm run verify:harness-isolation` passes all three stages and cleans its own
  scratch trees; `npm run build`, `npm test` (870/870; this plan added no tests — 07-04-PLAN's 866 was the pre-2004eea figure), `npm run
  lint`, and `npm run typecheck:worklet` are all green; `git diff --exit-code src/ worklets/
  tsconfig.harness.json tsconfig.worklet.json` confirms no application source, kernel, adapter, or
  harness page changed.

## Task Commits

1. **Task 1: Sever the leak path end-to-end — harness output leaves the production asset root and
   returns via a named dev-only route** - `b5b6ba1` (feat)
2. **Task 2: Install the realistic-sequence regression gate and prove it has teeth** - `8ae63cd` (feat)
3. **Task 3: Correct the falsified documentation and record the closure in the phase validation
   file** - `9969c5b` (docs)

## Files Created/Modified

- `scripts/build-worklet.mjs` - `--harness` outputs to `dev-dist/`; flagless path unconditionally
  removes legacy `public/dev/`; header comment corrected
- `scripts/assert-no-harness-in-dist.mjs` (new) - fail-closed `assertNoHarnessInDist(distRoot)`,
  exported and CLI-runnable
- `scripts/verify-harness-isolation.mjs` (rewritten) - 3-stage regression gate with cleanup
- `angular.json` - new `harness` build+serve configuration; production/development untouched
- `package.json` - `start:harness`, `prestart:harness`, `postbuild` added
- `.gitignore` - `/dev-dist/`, `/.tmp-harness-dist/`, `/.tmp-harness-dist-dev/` added; `/public/dev/`
  comment amended
- `README.md` - "Worklet build and dev harness" section rewritten
- `.planning/phases/07-audioworklet-dsp-foundation/07-VALIDATION.md` - two new verification rows +
  gap-closure sign-off note

## Decisions Made

See frontmatter `key-decisions` for the full account. In short: implemented the plan's chosen
remedy 3 (relocate outside `public/`) rather than the remedy-1-style partial fix (an `ignore:
["dev/**"]` asset override plus a simpler 2-command isolation script) that was already present on
disk from an earlier, unrelated session — that earlier fix predates 07-VERIFICATION.md's gap report
and directly conflicts with this plan's acceptance criteria, so it was replaced. The `--keep-dev`
flag was removed from `package.json`'s `prestart` (now `node scripts/build-worklet.mjs`) so the
recorded script, the plan's acceptance assertion, and this summary agree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reconciled a pre-existing, differently-shaped partial fix already on disk**
- **Found during:** Task 1, before editing `angular.json`
- **Issue:** `angular.json`'s `production` build configuration already carried an
  `"assets": [{"glob": "**/*", "input": "public", "ignore": ["dev/**"]}]` override, and
  `scripts/verify-harness-isolation.mjs` already existed as a simpler two-command script (delete
  `dist`, run harness, run build, check `dist/.../dev` and `public/dev` are both absent) —
  apparently committed as part of an earlier combined "Phase 7" commit, predating
  `07-VERIFICATION.md`'s gap report. This state directly contradicted the plan's acceptance
  criteria, which require `production`/`development` to carry zero `assets` override and require
  `scripts/verify-harness-isolation.mjs` to export `assertNoHarnessInDist`, run 3 stages including a
  positive control, and clean two named scratch trees.
- **Fix:** Removed the `production.assets` override entirely (reverting to the base `options.assets`
  it inherits by default) and rewrote `scripts/verify-harness-isolation.mjs` from scratch to the
  plan's 3-stage design, importing the new `assertNoHarnessInDist` module. This is the plan's
  deliberately-chosen remedy 3 rather than the ad hoc remedy-1-style fix that was already present.
- **Files modified:** `angular.json`, `scripts/verify-harness-isolation.mjs`
- **Verification:** Full Task 1 and Task 2 acceptance-criteria chains (see Task Commits) re-run and
  green after the reconciliation, including the harness-then-build sequence and the fail-closed/
  fail-first/positive-control proofs.
- **Committed in:** `b5b6ba1` (Task 1 — `angular.json`), `8ae63cd` (Task 2 —
  `verify-harness-isolation.mjs`)

---

**Total deviations:** 1 auto-fixed (Rule 1 — reconciling a pre-existing partial fix that
contradicted the plan's chosen design)
**Impact on plan:** No scope change beyond what the plan itself specified; the pre-existing partial
fix was replaced with the plan's own remedy-3 design rather than left in place or merged with it,
since the two approaches are mutually exclusive (an asset-glob `ignore` override on `production`
cannot coexist with the plan's requirement that `production` carry zero override).

## Issues Encountered

None beyond the pre-existing partial-fix reconciliation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ENGINE-01's harness-isolation must-have is closed structurally for default `npm run build`
  (relocation plus `postbuild`), with a regression gate proven to have teeth. ENGINE-01 is **not**
  fully closed while `07-REVIEW.md` still records WR-01 (lint scope), WR-02 (`typecheck:worklet` not
  hooked), WR-04 (`setMode` stale phase), and WR-06 (untested AdditiveOperatorBank custom-ratio
  branches). WR-05's Windows `postbuild` no-op was addressed by comparing `fileURLToPath(import.meta.url)`
  against `resolve(process.argv[1])` rather than concatenating `file://` onto a native path.
- `SYNTH_ENGINE` still resolves to `WebAudioSynthEngine` (D-01, unchanged this plan) — later routing
  and envelope work can build on the worklet kernel without any live-engine cutover risk carried
  over from this plan.
- The dev harness remains reachable at its original URL for later listening checks via
  `npm run start:harness`, isolated from default production build paths subject to the remaining
  review findings above.

## Self-Check: PASSED

All artifacts confirmed present on disk (`scripts/assert-no-harness-in-dist.mjs`,
`scripts/verify-harness-isolation.mjs`, `dev-dist/` build output during a `npm run harness` run,
absence of `public/dev/` and `dist/.../dev` under the realistic sequence); commit hashes `b5b6ba1`,
`8ae63cd`, `9969c5b` verified present in `git log`.

---
*Phase: 07-audioworklet-dsp-foundation*
*Status: complete*
