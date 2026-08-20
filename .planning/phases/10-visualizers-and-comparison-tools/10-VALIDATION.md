---
phase: 10
slug: visualizers-and-comparison-tools
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-17
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.8`, run via `@angular/build:unit-test` (Angular 22's integrated builder) [VERIFIED: `package.json`, `10-RESEARCH.md`] |
| **Config file** | none — builder-managed (`angular.json`'s `test` target; no standalone `vitest.config.ts`) |
| **Quick run command** | `npm test -- <changed-spec-file-pattern>` |
| **Full suite command** | `npm test` (runs once and exits outside a TTY; `pretest` runs `npm run build:worklet` first — no separate quick/full split in this project) |
| **Estimated runtime** | ~2 seconds at Phase 9 close (1189 tests); expect a small increase from ~4 new spec files |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <changed-spec-file-pattern>`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** `npm run build`, `npm test`, `npm run lint` all green, plus the recommended blocking human-verify listening/visual checkpoint (see Manual-Only Verifications)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Task ID/Plan/Wave columns filled in from the four executed plans' SUMMARY.md files
(10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md) and cross-checked
against each plan's Task Commits section, not from this draft's original TBD placeholders.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 1 | 10-01 | 1 | VIZ-01 | — | `AnalyserNode` inserted between `masterGain` and `destination`; both connections recorded | unit | `npm test -- worklet-synth-engine` (extend) | ✓ Exists | ✅ passed |
| Task 2 | 10-01 | 1 | VIZ-01 | T-10-02 | `readTimeDomainInto`/`readFrequencyInto` no-op safely (never throw) when `analyser === null` | unit | `npm test -- worklet-synth-engine` (extend) | ✓ Exists | ✅ passed |
| Task 1 | 10-01 | 1 | VIZ-01 | — | `FakeAnalyserNode` returns deterministic canned data for specs, no real FFT | unit | `npm test -- fake-audio-context` | ✓ Exists | ✅ passed |
| Task 1 | 10-02 | 2 | VIZ-01 | — | Log-frequency bucketing math (`binIndexForHz`, bar edges) is monotonically increasing and never indexes outside `[0, frequencyBinCount)` | unit | `npm test -- spectrum-scale` | ✓ Exists | ✅ passed |
| Task 2 | 10-01 | 1 | VIZ-01 | — | RAF draw loop reads analyser data from a plain method, never via a `signal`/`computed` write — structural proof it cannot drive Angular CD per frame | unit/component | `npm test -- visualizer` | ✓ Exists | ✅ passed |
| Task 1 | 10-04 | 3 | VIZ-02 (A/B) | — | Capture A/B, Recall A/B, Reset buttons call the exact `InstrumentState` method with the exact slot argument; disabled state matches `hasSnapshot()` | component | `npm test -- tools-panel` | ✓ Exists | ✅ passed |
| Task 1 | 10-03 | 1 | VIZ-02 (randomize) | T-10-01 | Every computed field from the bounded random walk stays within its domain-declared valid range across many sampled `rng()` values, including edge cases 0 and ~1 | unit (property-style) | `npm test -- random-walk-patch` | ✓ Exists | ✅ passed |
| Task 1 | 10-03 | 1 | VIZ-02 (randomize) | — | `ratio` walk always snaps to a `COARSE_RATIOS` member, never an interpolated non-member value | unit | `npm test -- random-walk-patch` | ✓ Exists | ✅ passed |
| Task 2 | 10-03 | 1 | VIZ-02 (randomize) | D-16 | `InstrumentState.randomize()` never touches `algorithmId`, `mode`, or `enabled` (D-12/D-16 scope) | unit | `npm test -- instrument-state` (extend) | ✓ Exists | ✅ passed |
| Task 2 | 10-03 | 1 | VIZ-02 (randomize) | T-10-01 | `InstrumentState.randomize()` writes a patch that independently passes `validateOperatorParameters`/`validateFeedbackLevel` for every field (never throws) | unit | `npm test -- instrument-state` (extend) | ✓ Exists | ✅ passed |

*Threat Ref candidates for the planner's `<threat_model>` block (ASVS L1, block on high — per
active `security` capability): **T-10-01** — a random-walk bug (off-by-one clamp, wrong bound
constant) writes an out-of-range value directly into the live patch, bypassing validation
(Tampering of internal state consistency; mitigation: route every computed field through the
existing `validateOperatorParameters`/`validateFeedbackLevel` choke points before the signal
write, exactly as `updateOperator`/`setFeedback` already do). **T-10-02** — a malformed/
never-initialized `AnalyserNode` read throws inside a `requestAnimationFrame` callback, silently
killing the draw loop (Denial of Service of the visualization feature only; mitigation: guard
every analyser-read method with the same `if (this.analyser === null) return;` pattern already
used for other engine methods). See `10-RESEARCH.md` § Security Domain.*

---

## Wave 0 Requirements

- [x] `src/app/core/audio/testing/fake-audio-context.ts` — `FakeAnalyserNode` + `createdAnalysers` registry (extend existing file)
- [x] `src/app/domain/dx7/randomization/random-walk-patch.ts` + `.spec.ts` — new pure function and its bounds-invariant tests
- [x] `src/app/features/playground/visualizer/visualizer.spec.ts` — new component spec
- [x] `src/app/features/playground/tools-panel/tools-panel.spec.ts` — new component spec
- [x] Framework install: none — Vitest via `@angular/build:unit-test` already fully configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Oscilloscope visibly tracks a played note's waveform | VIZ-01 | jsdom has no Canvas rendering / Web Audio signal path — waveform correctness is a visual judgment | `npm run start:harness` or `npm start`, play a note in `/playground`, confirm the oscilloscope trace visibly follows the note's pitch/timbre |
| Spectrum's log-axis bars visibly shift with pitch and show FM sidebands | VIZ-01, D-05/D-07 | Perceptual/visual judgment of frequency-domain content against a live FM signal | Play notes at different pitches and algorithms with strong modulation; confirm bars shift and sidebands are visible near the fundamental |
| Recalling a snapshot mid-note is audibly click-free | VIZ-02, D-11 | Click-safety is a listening judgment; rests on Phase 9's already-approved envelope continuity, worth a spot-check not a full re-verification | Hold a note, recall a captured snapshot mid-note, confirm no click/pop |
| Several Randomize presses in a row produce audibly-related-but-varied sounds, never silence or harsh/broken output | VIZ-02, D-13 | "Musically sensible" is a listening judgment no bounds-only unit test can confirm | Press Randomize repeatedly on a held/replayed note across a few algorithms; confirm variety without silence or broken output |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated. Automated gates in `10-VERIFICATION.md` (`npm test` 1296/1296, lint, build) and PROJECT.md / ROADMAP.md record Phase 10 complete (2026-08-19). Plan 10-04's blocking human-verify checkpoint was approved with all ten checks passing and zero findings (see 10-04-SUMMARY.md). Existing validation results above are unchanged; this sign-off only updates lifecycle and approval state.
