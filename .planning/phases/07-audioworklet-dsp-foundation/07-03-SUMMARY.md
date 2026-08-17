---
phase: 07-audioworklet-dsp-foundation
plan: 03
subsystem: audio
tags: [web-audio, audioworklet, esbuild, dev-tooling, dx7, phase-modulation]

# Dependency graph
requires:
  - phase: 07-audioworklet-dsp-foundation
    plan: 01
    provides: "DX7_OPERATOR_PROCESSOR_NAME, setFrequencyMessage, setModeMessage, WorkletRenderMode (worklet-messages.ts) — the shared message contract the harness posts against; the built public/worklets/dx7-worklet-processor.js bundle the harness loads"
  - phase: 07-audioworklet-dsp-foundation
    plan: 02
    provides: "DEFAULT_WORKLET_MODULE_URL (audio-worklet-node.token.ts) — the same-origin path the harness's literal WORKLET_MODULE_URL constant mirrors"
provides:
  - "worklets/harness/harness-main.ts — standalone, framework-free dev listening harness (no Angular import of any kind) driving the real built worklet bundle through the shared message contract"
  - "worklets/harness/index.html — accessible dev harness page (semantic HTML, labelled buttons, aria-live status, non-shipped-surface banner)"
  - "tsconfig.harness.json — sibling DOM-only TypeScript program to tsconfig.worklet.json"
  - "scripts/build-worklet.mjs --harness — opt-in flag emitting public/dev/, never invoked by prebuild/prestart/pretest"
  - "npm run harness — the one command that builds the dev harness on demand"
affects: [08-graph-routing-and-feedback, 09-envelopes]

# Actuals (#2632) — Task 1's implementation cost. Task 2 (the blocking
# human-listening checkpoint) is now complete and approved with zero
# findings; per its own "an approval with unresolved findings is not a
# pass" / no-source-change-on-clean-approval instruction, it added no
# implementation tokens of its own beyond a one-paragraph README correction
# and this SUMMARY/tracking-doc finalization.
actuals:
  tokens: 4122
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Dev-only harness kept a standalone, framework-free bundle (no Angular import of any kind, including no import of the DI-wrapped DEFAULT_WORKLET_MODULE_URL token file, which would drag @angular/core into the bundle) — the module URL and attack/release timing constants are literal duplicates of their Angular-side counterparts, documented at the duplication site, mirroring 07-02's D-01 isolation rationale for WorkletSynthEngine's own duplicated constants."
    - "Opt-in build flag (`--harness` on `process.argv`) gates a second esbuild pass and a static-file copy, added to the same script that already handles the default flagless worklet bundle — the default npm lifecycle hooks (prebuild/prestart/pretest) are structurally incapable of passing the flag, so a clean checkout's production build cannot create the harness output directory."

key-files:
  created:
    - worklets/harness/harness-main.ts
    - worklets/harness/index.html
    - tsconfig.harness.json
  modified:
    - scripts/build-worklet.mjs
    - package.json
    - .gitignore
    - README.md

key-decisions:
  - "The module-URL literal-duplication approach was necessary, not just a stylistic choice: an early draft's doc comment used the literal string '@angular/core' inside a code comment explaining *why* the harness avoids importing it, which itself tripped the plan's own `grep -c '@angular' harness-main.ts` acceptance check (the check has no way to distinguish a comment mentioning the framework from an actual import). Reworded to describe the framework by name ('the Angular framework') rather than by package-specifier string, with zero change to runtime behavior."
  - "Task 2 (the blocking human-listening checkpoint, D-06/D-07) was approved with all nine checks passing and zero findings, presented directly to the human rather than through this continuation agent. Per its own 'an approval with unresolved findings is not a pass' / no-source-change-on-clean-approval instruction, the only change it triggers is the README's Check-8 rebuild-loop wording (corrected from 'restart the dev server, treat as the safe default' to the confirmed 'reload is enough — no restart needed') plus this SUMMARY and related tracking docs. `ENGINE-01` stays incomplete until 07-04 closes the production-asset harness leak."

patterns-established:
  - "Dev-harness accessibility baseline for future standalone (non-Angular) test pages: semantic HTML, an explicit non-shipped-surface banner, `aria-live=\"polite\"` status region, and `:focus-visible` styling on every control — CLAUDE.md's accessibility rules apply even to a page with no Angular template."

requirements-completed: []  # ENGINE-01 spans 07-01..07-04; listening checkpoint approved, but production harness-isolation gap remains open until 07-04

coverage:
  - id: D1
    description: "worklets/harness/harness-main.ts builds and typechecks as a standalone, framework-free program using the shared worklet-messages.ts contract and value-conversion.ts's MASTER_GAIN/midiNoteToFrequency/velocityToAmplitude, with zero Angular import of any kind"
    requirement: "ENGINE-01"
    verification:
      - kind: unit
        ref: "npm run typecheck:worklet (tsconfig.harness.json pass) — exit 0"
        status: pass
      - kind: other
        ref: "grep -c '@angular' worklets/harness/harness-main.ts == 0; grep -c 'DX7_OPERATOR_PROCESSOR_NAME' >= 1; grep -cE 'setFrequencyMessage|setModeMessage' >= 2; grep -c 'MASTER_GAIN' >= 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "On a clean checkout, npm run harness builds public/dev/worklet-harness.{js,html}; flagless npm run build:worklet / npm run build do not create public/dev in that scenario. The realistic npm run harness then npm run build sequence, and production isolation of harness output, are 07-04's fix — this row does not claim every production build lacks a dev directory"
    requirement: "ENGINE-01"
    verification:
      - kind: other
        ref: "npm run harness && test -f public/dev/worklet-harness.js && test -f public/dev/worklet-harness.html; rm -rf public/dev && npm run build:worklet && test ! -d public/dev; npm run build && find dist -maxdepth 3 (worklets/ present, no dev/)"
        status: pass
    human_judgment: false
  - id: D3
    description: "worklets/harness/index.html has at least four labelled buttons, an aria-live status region, and a visible non-shipped-application banner; the harness page and its script serve correctly from a running dev server"
    requirement: "ENGINE-01"
    verification:
      - kind: other
        ref: "grep -c '<button' index.html == 4; grep -c 'aria-live' index.html == 1; fetch http://localhost:4200/dev/worklet-harness.html and .../dev/worklet-harness.js both return 200 with npm start running"
        status: pass
    human_judgment: false
  - id: D4
    description: "The worklet loads without console errors and both the single-operator and additive six-carrier cases sound correct, click-free, at a safe level, in a real browser — the ROADMAP's success criterion 1"
    requirement: "ENGINE-01"
    verification:
      - kind: manual_procedural
        ref: "07-03-PLAN.md Task 2, checks 1-7 and 9 — reported 'approved'; human's own words: \"opened and tested. working fine.\""
        status: pass
      - kind: manual_procedural
        ref: "07-03-PLAN.md Task 2, check 8 (RESEARCH Assumption A5, rebuild-loop) — explicit confirmed answer: \"Reload was enough — no restart needed.\" ng serve's live-reload served the rebuilt public/dev/worklet-harness.js after npm run harness; a plain browser reload showed the change with no dev-server restart required."
        status: pass
    human_judgment: true
    rationale: "jsdom implements no Web Audio API and no AudioWorkletGlobalScope at all — nothing in npm test can reach audioWorklet.addModule() actually fetching/evaluating the bundle, or what comes out of a speaker. Task 2's blocking-human checkpoint (D-06/D-07) discharged this: all nine checks passed with zero findings, presented directly to the human. Check 8's rebuild-loop answer is recorded above and the README's guidance corrected accordingly."

duration: ~15min (Task 1) + human-listening checkpoint (Task 2, duration not tracked by this agent)
completed: 2026-08-11
status: complete
---

# Phase 7 Plan 3: AudioWorklet DSP Foundation Summary

**Framework-free dev listening harness (opt-in `npm run harness` build) that drives the real built worklet bundle through the same message contract and safety clamp 07-02's engine uses — a human has now confirmed in a real browser that the worklet loads and both proof cases sound correct, closing D-06/D-07. ENGINE-01 remains open until 07-04 isolation closes.**

## Performance

- **Duration:** ~15 min (Task 1) + human-listening checkpoint (Task 2, duration not tracked by this agent)
- **Started:** 2026-08-11T23:45Z (approx)
- **Completed (Task 1):** 2026-08-11T23:51Z
- **Completed (Task 2):** 2026-08-11 — approved, all nine checks passing, zero findings
- **Tasks:** 2 of 2 complete
- **Files modified:** 7 (3 created, 4 modified) in Task 1; README's Check-8 wording additionally corrected as Task 2's sole source-adjacent change

## Accomplishments

- `worklets/harness/harness-main.ts` — a standalone TypeScript entry point with no Angular import
  of any kind. Imports `DX7_OPERATOR_PROCESSOR_NAME`/`setFrequencyMessage`/`setModeMessage` from
  07-01's shared `worklet-messages.ts` contract and `MASTER_GAIN`/`midiNoteToFrequency`/
  `velocityToAmplitude` from `value-conversion.ts`. Constructs an `AudioContext` only inside the
  enable button's click handler, awaits `resume()` then `audioWorklet.addModule()` against the
  same same-origin path `DEFAULT_WORKLET_MODULE_URL` names (duplicated as a literal constant,
  documented at the duplication site, to avoid pulling `@angular/core` into a non-Angular bundle),
  constructs an `AudioWorkletNode`, and wires a voice-gain → master-gain → destination graph with
  the master gain scheduled to `MASTER_GAIN` and the voice gain to 0 — the same safety clamp Phase
  5 proved safe. Single-operator (A4) and additive six-carrier (A3) play actions post a
  `setModeMessage` + `setFrequencyMessage` pair and ramp the voice gain up over 15ms via
  `linearRampToValueAtTime`; stop schedules an exponential release. All gain changes are scheduled
  automation only, never a direct assignment. A try/catch around `enable()` writes any failure to
  both the visible status line and the console.
- `worklets/harness/index.html` — semantic HTML with a visible banner stating plainly this is a
  development test page for a phase-modulation kernel (not a DX7 emulation, not part of the
  shipped app), four labelled buttons (enable, play single, play additive, stop), an
  `aria-live="polite"` status region, and `:focus-visible` styling so every control's focus is
  visibly indicated.
- `tsconfig.harness.json` — a sibling TypeScript program to 07-01's `tsconfig.worklet.json`:
  extends the root config, `"types": []`, `"noEmit": true`, includes only
  `worklets/harness/**/*.ts` — DOM types only, no worklet-only globals, and no collision with the
  worklet program's `@types/audioworklet`.
- `scripts/build-worklet.mjs` extended with an opt-in `--harness` flag (checked via
  `process.argv.includes`) that additionally bundles `harness-main.ts` to
  `public/dev/worklet-harness.js` and copies `index.html` to `public/dev/worklet-harness.html`.
  The flagless form used by `prebuild`/`prestart`/`pretest` is byte-for-byte unchanged from 07-01.
- `package.json` gained the `harness` script (`node scripts/build-worklet.mjs --harness`) and
  `typecheck:worklet` now runs both `tsconfig.worklet.json` and `tsconfig.harness.json`.
- `.gitignore` gained a `/public/dev/` entry alongside 07-01's `/public/worklets/` entry.
- `README.md` gained a `## Worklet build and dev harness` section between `## Verification
  commands` and `## Architecture summary`, documenting the bundle's build/serve path, the
  lifecycle-hook regeneration guarantee, how to run the harness, the (as-of-writing unverified)
  rebuild-loop guidance, and that the harness never reaches a production build.
- Verified end-to-end before committing: `npm run typecheck:worklet`, `npm run harness` (both
  `public/dev/worklet-harness.js` and `.html` created), `rm -rf public/dev && npm run build:worklet`
  (confirms `public/dev` stays absent while the processor bundle still builds), `npm test`
  (866/866 passing), `npm run build` (confirms `dist/.../browser/worklets/` exists and no `dev`
  directory does), `npm run lint` (clean), and `git diff --exit-code angular.json src/` (no
  Angular source or config touched).
- Started the dev server (`npm start`, running in the background) and confirmed via `fetch()` that
  `http://localhost:4200/dev/worklet-harness.html`, `.../dev/worklet-harness.js`, and
  `.../worklets/dx7-worklet-processor.js` all return `200` — the verification environment is ready
  for Task 2's human listening pass.
- **Task 2 (human-listening checkpoint) approved with zero findings.** All nine checks passed:
  the worklet loaded with a clean console (Check 1), no audio before the enable gesture (Check 2),
  a pure single-operator sine at concert A (Check 3), a fused organ-like additive six-carrier tone
  (Check 4), click-free starts/stops/restarts (Check 5), a safe loudness step from single to
  additive (Check 6), 30+ seconds glitch-free on the additive case (Check 7), and full
  keyboard-only operation with visible focus (Check 9) — human's own words: "opened and tested.
  working fine." Check 8 (RESEARCH Assumption A5, the rebuild loop) got an explicit, separately
  confirmed answer: **"Reload was enough — no restart needed."** `ng serve`'s live-reload served
  the rebuilt `public/dev/worklet-harness.js` after `npm run harness`; a plain browser reload
  showed the change with no `npm start` restart required. `README.md`'s Check-8 guidance corrected
  from "restart the dev server, treat that as the safe default" to the confirmed reload-is-enough
  answer.

## Task Commits

1. **Task 1: Build the standalone dev listening harness behind an opt-in build flag** -
   `4c443ad` (feat)
2. **Task 2: Listen to the worklet in a real browser and approve the phase (D-07)** — **approved**,
   blocking human-verify checkpoint, presented directly to the human (not through this continuation
   agent); zero findings, no source commit of its own beyond the README correction and this
   plan's tracking-doc close-out commit(s).

## Files Created/Modified

- `worklets/harness/harness-main.ts` - `Harness` class: gesture-gated enable/play-single/
  play-additive/stop, scheduled-only gain automation, live status reporting
- `worklets/harness/index.html` - semantic dev harness page: banner, four buttons, aria-live status
- `tsconfig.harness.json` - DOM-only TypeScript program, sibling of `tsconfig.worklet.json`
- `scripts/build-worklet.mjs` - opt-in `--harness` flag (second esbuild pass + static HTML copy)
- `package.json` - new `harness` script; `typecheck:worklet` extended to both worklet+harness
- `.gitignore` - `/public/dev/` entry
- `README.md` - new `## Worklet build and dev harness` section

## Decisions Made

- Reworded a doc comment that literally contained the string `@angular/core` (explaining why the
  harness avoids that import) after discovering it tripped the plan's own `grep -c '@angular'`
  acceptance check — see frontmatter `key-decisions` for the full account. No runtime behavior
  changed.
- Listening approved; ENGINE-01 remains open until 07-04 isolation closes — Task 2's human-listening
  checkpoint approved with zero findings, discharging D-06/D-07 and ROADMAP success criterion 1's
  listening half, but `requirements-completed` stays `[]` until 07-04 closes production-asset
  harness isolation. See frontmatter `key-decisions`.
- README's rebuild-loop guidance (Check 8 / RESEARCH Assumption A5) corrected from "restart the
  dev server, treat as the safe default" to the confirmed "reload is enough — no restart needed,"
  per the human's explicit answer during the checkpoint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comment tripped its own acceptance check's literal grep**
- **Found during:** Task 1, self-check pass before committing
- **Issue:** The file header's doc comment explained the harness's framework-free constraint using
  the literal strings `@angular/*` and `@angular/core` — accurate prose, but the plan's own
  acceptance criterion (`grep -c '@angular' worklets/harness/harness-main.ts` must equal `0`) has
  no way to distinguish a comment mentioning the framework from an actual import statement, so it
  matched and failed the check.
- **Fix:** Reworded the two sentences to name "the Angular framework" and "an injection token"
  instead of the literal package-specifier strings. No import, code path, or bundle output
  changed — confirmed by re-running the full verification chain after the edit.
- **Files modified:** `worklets/harness/harness-main.ts`
- **Verification:** `grep -c '@angular' worklets/harness/harness-main.ts` now returns `0`; full
  `npm run typecheck:worklet && npm run harness && ... && npm test && npm run build && npm run
  lint` chain re-run and green.
- **Committed in:** `4c443ad` (Task 1 commit — caught before the commit, not a follow-up fix)

**2. [Rule 1 - Bug] `state.record-session` over-derived progress counters from disk**
- **Found during:** STATE.md session-continuity update after Task 1
- **Issue:** `gsd_run query state.record-session` (called only to update `stopped_at`/
  `last_updated`/session fields) also silently re-derived `progress.completed_phases` (5→6) and
  `progress.completed_plans` (22→23) from disk, apparently by counting the presence of a
  `07-03-SUMMARY.md` file rather than checking its `status` field — this SUMMARY documents a
  checkpoint-paused plan whose Task 2 has not run, so Phase 7 is not actually complete.
- **Fix:** Manually corrected `progress.completed_phases` back to `5` and `progress.completed_plans`
  back to `22` in `STATE.md`'s frontmatter after the tool call. Also found and fixed a second,
  unrelated corruption from the same call: the "Blockers/Concerns" section's leading `None ` was
  stripped from "None currently open." leaving a dangling sentence fragment ("currently open.")
  before the newly appended blocker bullet — reworded the section so the new blocker leads and the
  prior GSD-tooling note reads as its own sentence.
- **Files modified:** `.planning/STATE.md`
- **Verification:** Manual re-read of `STATE.md`'s frontmatter and Blockers/Concerns section after
  the fix; both now read correctly.
- **Committed in:** this plan's docs commit (not a task commit — STATE.md is tracking-doc
  maintenance, not plan source)
- **Flag for future work:** this looks like a genuine tool-level gap — the disk-derivation logic in
  `state-transition.cjs`/`state-document.cjs` appears to treat "a `{phase}-{plan}-SUMMARY.md` file
  exists" as equivalent to "that plan is complete," which is false whenever a SUMMARY is written at
  a checkpoint pause (as this executor's own instructions require). Not fixed here — out of this
  plan's scope (a `.claude/gsd-core/` tooling file, not a project source file) — but worth a GSD
  Core issue.

---

**Total deviations:** 2 auto-fixed (1 bug in harness source caught pre-commit, 1 bug in GSD
tooling's STATE.md progress derivation caught post-hoc and manually corrected)
**Impact on plan:** No functional scope change to the harness; no runtime behavior changed. The
STATE.md correction restored tracking-doc accuracy at the time. Listening is approved; ENGINE-01
remains open until 07-04 closes isolation.

## Issues Encountered

None beyond the doc-comment self-check catch above and the STATE.md progress-derivation bug, both
already documented under "Deviations from Plan."

## User Setup Required

None - no external service configuration required. The dev server that was running in the
background for Task 2's listening pass has been stopped as part of closing out this plan.

## Next Phase Readiness

- **Task 2 is complete and approved.** All nine checks in `07-03-PLAN.md`'s Task 2
  (`<how-to-verify>`) passed with zero findings, including Check 8's rebuild-loop answer
  ("Reload was enough — no restart needed") and Check 9's keyboard-only pass. See "Accomplishments"
  above for the full per-check account.
- Listening approved; ENGINE-01 remains open until 07-04 isolation closes — matching this SUMMARY's
  empty `requirements-completed: []`. `07-VALIDATION.md`'s manual listening row is verified; the
  production-asset harness leak is still a verification gap until 07-04.
- `SYNTH_ENGINE` still resolves to `WebAudioSynthEngine` (D-01) — nothing in Playground or `/learn`
  calls anything built in this phase. No regression risk to the shipped MVP engine. The Angular
  cutover to `WorkletSynthEngine` remains future work for whichever phase performs it.
- This SUMMARY's frontmatter (`status: complete`, `requirements-completed: []`, the D4
  coverage entry's `verification`) records listening approval without closing ENGINE-01, along with
  `STATE.md`'s plan-position advance.

## Self-Check: PASSED

All 3 created files (`worklets/harness/harness-main.ts`, `worklets/harness/index.html`,
`tsconfig.harness.json`) verified present on disk; commit hashes `4c443ad` and `fdc0552` verified
present in git history; the README's Check-8 rebuild-loop wording verified corrected on disk.
Task 2's checkpoint was presented directly to the human and returned "approved" with the Check 8
answer quoted verbatim above; no code changes resulted from Task 2 beyond the README correction,
consistent with the plan's "zero findings → no source file changes" acceptance criterion.

---
*Phase: 07-audioworklet-dsp-foundation*
*Status: complete — Task 2 (blocking human-verify) approved, zero findings*
