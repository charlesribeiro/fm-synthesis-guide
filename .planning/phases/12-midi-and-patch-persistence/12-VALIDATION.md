---
phase: 12
slug: midi-and-patch-persistence
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-09
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `12-RESEARCH.md` § Validation Architecture. Per-task rows filled
> from executed PLAN/SUMMARY files and re-audited by `/gsd-validate-phase 12`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.8` via `@angular/build:unit-test` (Angular 22's integrated builder) [VERIFIED: `package.json`, `12-RESEARCH.md`] |
| **Config file** | none — builder-managed (`angular.json`'s `test` target; no standalone `vitest.config.ts`) |
| **Quick run command** | `npm test -- --include='**/<changed-spec-file>.spec.ts'` (`ng test`'s positional argument is the *project* name, not a spec filter) |
| **Full suite command** | `npm test` (runs once and exits outside a TTY; `pretest` runs `npm run build:worklet` first) |
| **Estimated runtime** | ~2s for the 14 Phase 12 mapped spec files (240 tests, 2026-09-18 Nyquist re-run); full suite remains under 60s |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --include='**/<changed-spec-file>.spec.ts'`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** `npm run build`, `npm test`, and `npm run lint` all green (CLAUDE.md three-gate)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Cross-checked against 12-01..12-04 PLAN verify blocks, SUMMARY coverage, 12-VERIFICATION.md (26/26), and a 2026-09-18 re-run of the mapped specs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-T1 | 12-01 | 1 | PERSIST-01 | T-12-01, T-12-03 | Round-trip encode/decode; hostile matrix never throws; corrupt STORAGE hydrates defaults | unit | `npm test -- --include='**/parse-saved-document.spec.ts'` / `saved-document-store.spec.ts` / `lesson-progress.spec.ts` | ✓ Exists | ✅ green |
| 12-01-T2 | 12-01 | 1 | PERSIST-01 | T-12-12 | Playground slot write isolated from markComplete; replacePatch atomic | unit | `npm test -- --include='**/playground-patch-slot.spec.ts'` / `instrument-state.spec.ts` | ✓ Exists | ✅ green |
| 12-02-T1 | 12-02 | 1 | MIDI-01 | T-12-08, T-12-10 | Note-on 1–127 -> pressKey; vel 0 -> release; Enable MIDI no focus steal | unit | `npm test -- --include='**/parse-midi-note-message.spec.ts'` / `midi-session.spec.ts` / `play-surface.spec.ts` | ✓ Exists | ✅ green |
| 12-02-T2 | 12-02 | 1 | MIDI-01 | T-12-09 | Named states; disconnect selected; disable allNotesOff; MIDI+pointer hold | unit | `npm test -- --include='**/midi-session.spec.ts'` / `play-surface.spec.ts` | ✓ Exists | ✅ green |
| 12-03-T1 | 12-03 | 2 | PERSIST-01 | T-12-13 | Entering Playground restores slot; Randomize/Reset write; Capture does not | component | `npm test -- --include='**/playground.spec.ts'` / `tools-panel.spec.ts` | ✓ Exists | ✅ green |
| 12-03-T2 | 12-03 | 2 | PERSIST-01 | T-12-12 | Lesson startingPatch does not call PlaygroundPatchSlot.write | component | `npm test -- --include='**/lesson-detail.spec.ts'` | ✓ Exists | ✅ green |
| 12-04-T1 | 12-04 | 2 | MIDI-01 | T-12-16 | `/settings` + nav; D-20 saved id; Enable MIDI from Settings | component | `npm test -- --include='**/app.spec.ts'` / `settings.spec.ts` / `midi-session.spec.ts` / `play-surface.spec.ts` | ✓ Exists | ✅ green |
| 12-04-T2 | 12-04 | 2 | PERSIST-01 | T-12-03, T-12-14, T-12-15 | Export/import/clear confirm; failed import non-destructive; Dexed refused | component | `npm test -- --include='**/settings.spec.ts'` / `download-json.spec.ts` / `saved-document-store.spec.ts` | ✓ Exists | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Threat Ref candidates for the planner's `<threat_model>` block (ASVS L1, block on high — per active `security` capability): see `12-RESEARCH.md` § Security Domain and `12-SECURITY.md`. Headline threats: malformed JSON / hostile getters (DoS), prototype pollution via `__proto__`, Dexed/ROM/SysEx import (licensing + Tampering), XSS via imported strings, MIDI SysEx fingerprinting, quota/private-mode `setItem` throw, stuck MIDI note on disconnect. All closed 2026-09-18.*

---

## Wave 0 Requirements

- [x] `src/app/domain/dx7/midi/parse-midi-note-message.spec.ts` — MIDI-01 parse matrix
- [x] `src/app/domain/dx7/persistence/parse-saved-document.spec.ts` — PERSIST-01 codec + hostile payloads
- [x] `src/app/core/midi/testing/fake-midi-access.ts` — maplike inputs, `onstatechange`, per-port `onmidimessage`
- [x] `src/app/core/persistence/testing/fake-storage.ts` — in-memory `StorageLike`
- [x] `src/app/core/midi/midi-session.spec.ts` — status machine, selection, D-04
- [x] `src/app/state/saved-document-store.spec.ts` — hydrate/import/export/clear/recovery
- [x] `src/app/state/playground-patch-slot.spec.ts` — D-21/D-22 isolation
- [x] `src/app/features/settings/settings.spec.ts` — labelled controls, confirm gates
- [x] Extend `play-surface.spec.ts`, `lesson-progress.spec.ts`, `playground.spec.ts`, `app.spec.ts`, `tools-panel.spec.ts`
- [x] Framework install: none — Vitest already configured

Existing infrastructure covers the test runner. Wave 0 seams landed during execution; none remain MISSING.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Outcome |
|----------|-------------|------------|-------------------|---------|
| Real hardware MIDI keyboard note on/off/velocity | MIDI-01 | Fakes cover the state machine; ROADMAP SC1 names a present device. Optional, non-blocking. | Enable audio + Enable MIDI, play/release notes, unplug device, confirm disconnected copy and silence. | Optional UAT. Automated fakes close MIDI-01 for Nyquist. 12-UAT.md Test 2 passed for Enable MIDI / on-screen fallback. |
| Settings import/export round-trip in a real browser | PERSIST-01 | File picker / download are hard to fully fake as a user | Export JSON, reload, import the file, confirm progress and Playground patch restore. | Optional UAT. Automated Settings specs cover confirm/size/Dexed/extra-key. 12-UAT.md Test 2 passed for export/import/clear rules. |

Automated fakes are sufficient to close MIDI-01 / PERSIST-01 for Nyquist; the rows above are optional UAT, not Wave-0 blockers.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-18. Gap analysis found 0 MISSING and 0 PARTIAL rows. Mapped specs re-run green: 14 files, 240 tests (~1.92s). 12-VERIFICATION.md 26/26; 12-UAT.md 27/27.

---

## Validation Audit 2026-09-18

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
