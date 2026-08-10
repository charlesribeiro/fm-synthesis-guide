---
phase: 5
slug: first-playable-approximation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-06
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.8` [VERIFIED: `package.json`], run via `@angular/build:unit-test` (Angular 22's integrated builder, not the raw Vitest CLI) |
| **Config file** | none — builder-managed; no dedicated `vitest.config.ts` exists (`angular.json`'s `test` target has no `runner-config` option set) |
| **Quick run command** | `npx ng test --include="src/app/core/audio/**/*.spec.ts" --watch=false` (swap the glob for `src/app/domain/dx7/audio/**` or `src/app/features/playground/**` depending on which area a task touches) |
| **Full suite command** | `npm test` (runs once and exits outside a TTY — Phase 1 finding; single suite, no quick/full split) |
| **Estimated runtime** | ~10-15 seconds (adds ~4 new spec files — fake audio context, engine, patch-plan/value-conversion, playground extension — over Phase 4's baseline; still no real audio device) |

---

## Sampling Rate

- **After every task commit:** Run the relevant `--include` glob above (quick run)
- **After every plan wave:** Run `npm test` (full suite) + `npm run build` + `npm run lint`
- **Before `/gsd-verify-work`:** `npm run build`, `npm test`, `npm run lint` all green (CLAUDE.md verification commands)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

Rows below map each phase requirement to its test per `05-RESEARCH.md` § Validation Architecture.
Task ID/Plan/Wave and Status filled in retroactively from the executed plans and
`05-VERIFICATION.md`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 1 | 05-01 | 1 | AUDIO-01 | — / — | N/A | unit | `npx ng test --include="src/app/core/audio/web-audio-synth-engine.spec.ts" --watch=false` — `status()` stays `'suspended'` until a simulated gesture resolves `initialize()`; reports `'unavailable'` when the DI token yields no constructor | ✓ Exists | ✅ passed |
| Task 3 | 05-01 | 1 | AUDIO-02 | T-05-01 / validate `note`/`velocity` at the `SynthEngine` boundary before any `AudioParam` call | Malformed/out-of-range `noteOn(note, velocity)` input rejected before it reaches `AudioParam` scheduling (no `NaN`/`Infinity` propagation, no thrown exception mid-note) | unit | `npx ng test --include="src/app/core/audio/web-audio-synth-engine.spec.ts" --watch=false` — `noteOn`/`noteOff` schedule expected `AudioParam` automation on the fake graph; `allNotesOff`/`setAlgorithm` never leave a fake oscillator un-stopped/un-disconnected after `destroy()`; D-04 retrigger cancels prior scheduled ramps | ✓ Exists | ✅ passed |
| Task 1 | 05-02 | 2 | AUDIO-02 (patch planning) | — / — | N/A | unit | `npx ng test --include="src/app/domain/dx7/audio/patch-plan.spec.ts" --watch=false` — `planConnections()` produces correct connection lists for representative algorithms (Algorithm 1, Algorithm 32) including feedback flagging (every feedback edge is a `from === to` self-loop needing a `DelayNode`, per Pitfall 1) | ✓ Exists | ✅ passed |
| Task 2 | 05-03 | 2 | AUDIO-02 (keyboard input) | — / — | N/A | unit/component | `npx ng test --include="src/app/features/playground/**/*.spec.ts" --watch=false` — held computer key (`event.repeat === true`) does not retrigger `noteOn`; `keyup` calls `noteOff` | ✓ Exists (extends `playground.spec.ts`) | ✅ passed |
| Task 1 | 05-01 | 1 | AUDIO-03 | — / — | N/A | component | `npx ng test --include="src/app/features/playground/playground.spec.ts" --watch=false` — approximation label text present and visible without extra interaction, in every render state (suspended/ready) | ✓ Exists (extends spec; the "No audio engine is wired up yet" assertion was replaced) | ✅ passed |

*Threat Ref T-5-01 is the only applicable threat this phase carries — see `05-RESEARCH.md` §
Security Domain: no auth/session/persistence/network surface, only input-robustness at the
`noteOn`/`noteOff` audio boundary (ASVS V5 Input Validation).*

---

## Wave 0 Requirements

- [x] `src/app/core/audio/testing/fake-audio-context.ts` — hand-rolled `FakeAudioContext`/
      `FakeOscillatorNode`/`FakeGainNode`/`FakeDelayNode` test doubles, mirroring
      `motion-preference.spec.ts`'s `FakeMediaQueryList` pattern (introspectable: track
      `connect`/`disconnect`/`start`/`stop` calls and scheduled `AudioParam` automation events)
- [x] `src/app/core/audio/web-audio-synth-engine.spec.ts` — implemented in plan 05-01, extended in 05-02/05-03
- [x] `src/app/domain/dx7/audio/patch-plan.spec.ts` and `value-conversion.spec.ts` — implemented in plans 05-01/05-02
- [x] `playground.spec.ts`'s existing assertion on `"No audio engine is wired up yet"` was replaced
      in the same commit that changed the template (plan 05-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audible click-free note-on/off and no stutter under held/rapid keys | AUDIO-02 (D-03/D-04) | Automated tests can prove the *mechanism* (ramp scheduling, not step assignment; `event.repeat` guard) is used, but only listening confirms no perceptible click/pop or retrigger stutter reaches the ear (RESEARCH.md Pitfalls 4/5) | `npm start`, enable audio, play/hold/rapid-retrigger notes on both on-screen keys and computer keyboard across a few algorithms, listen for clicks or stutter |
| No copy elsewhere on the Playground page implies emulation precision | AUDIO-03 (D-08) | The literal label-presence check is automatable, but scanning nearby copy (algorithm name, any operator-strip text, tooltips) for words like "accurate," "authentic," or "emulates" is a review/copywriting judgment, not a code-level check (RESEARCH.md Pitfall 7) | Read every string rendered on the Playground page in the ready state; confirm none implies bit-accurate DX7 emulation without qualification |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter — `MASTER_GAIN: 1/6` re-audition closed via
      05-UAT.md Test 1 (`result: pass`)

**Approval:** validated and Nyquist-compliant after 05-UAT.md Test 1 confirmed the shipped
`MASTER_GAIN: 1/6` is comfortably audible (single note + Algorithm 32 six-carrier worst case).
