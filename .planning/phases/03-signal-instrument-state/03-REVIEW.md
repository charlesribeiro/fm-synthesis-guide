---
phase: 03-signal-instrument-state
reviewed: 2026-08-05T21:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - README.md
  - src/app/domain/dx7/models/operator-parameters.spec.ts
  - src/app/domain/dx7/models/operator-parameters.ts
  - src/app/domain/dx7/models/patch.spec.ts
  - src/app/domain/dx7/models/patch.ts
  - src/app/state/instrument-state.spec.ts
  - src/app/state/instrument-state.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-08-05T21:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the `InstrumentState` signal facade, its `OperatorParameters`/`InstrumentPatch` domain
models, and the accompanying README architecture update at standard depth. `npm test` (456 tests,
17 files) and `npm run lint` both pass locally. The domain-model validators
(`validateOperatorParameters`, `validateFeedbackLevel`) are correct and thorough: every numeric
field's boundary is checked with `Number.isInteger`/`Number.isFinite` guards, partial-update
semantics are honored (only present fields are validated), and the immutable-update contract in
`InstrumentState` (new patch/operators/parameters objects on every command, prior references never
mutated) is implemented correctly and is well covered by the isolation/immutability regression
tests in `instrument-state.spec.ts`. No security issues, no dead code, no unhandled promise/async
concerns (the facade is fully synchronous), and no domain-purity violations were found.

The one substantive issue is an inconsistency in how command methods validate restricted-literal
parameters at the public API boundary: `setAlgorithm` (and, as of a post-review fix, `updateOperator`)
validate their restricted-literal argument before writing, but the snapshot methods' `slot`
argument does not get the same runtime check, even though `CLAUDE.md` calls for validating external
data at boundaries. Two documentation/quality nits round out the findings.

## Warnings

### WR-01: the snapshot methods' `slot` argument is not runtime-validated, unlike `setAlgorithm`'s `algorithmId` and `updateOperator`'s `operatorId`

**File:** `src/app/state/instrument-state.ts:137-141`, `154-159` (both now validate, for contrast), `185-209`
**Issue:** `setAlgorithm` calls `resolveAlgorithm(algorithmId)` before writing, which throws a
`RangeError` for any id not present in `ALGORITHMS_BY_ID`. `updateOperator` was fixed in a
post-review pass to call `isOperatorId(operatorId)` before touching state, for the same reason.
`captureSnapshot`/`recallSnapshot`/`hasSnapshot` (lines 185-209) are the only commands left relying
entirely on the compile-time `SnapshotSlot` literal-union type, with no runtime check.

Today every call site is statically typed, so this is latent rather than actively triggered. But
`SnapshotSlot` is exactly the kind of restricted type `CLAUDE.md` calls out ("Represent operator IDs
with a restricted type", "Validate external data at boundaries"), and Phase 4/5 will wire these
commands to UI-originated values (e.g. a slot key parsed from a template loop, DOM event, or route
param) that require a cast back to the narrow type at some point — exactly the boundary where an
out-of-range or malformed value can reach these methods undetected.

If it does, the failure mode is silent state corruption rather than a thrown error:
`captureSnapshot('c')` / `recallSnapshot('c')` / `hasSnapshot('c')` read/write a key outside
`SNAPSHOT_SLOTS`, silently growing `SnapshotSlots` past its documented "exactly two named slots"
contract (see the `SnapshotSlot` doc comment, lines 24-30).

**Fix:** Add the same fail-fast guard `setAlgorithm`/`updateOperator` already use — a small
`isSnapshotSlot(value: string): value is SnapshotSlot` guard checking membership in
`SNAPSHOT_SLOTS`, called at the top of each of the three snapshot methods.

**Resolved (post-review fix pass):** `isSnapshotSlot` was added exactly as suggested and is now
called at the top of `captureSnapshot`, `recallSnapshot`, and `hasSnapshot`, each throwing
`RangeError` before touching `_snapshots` or `_patch`. Regression test added covering `'c'` for all
three methods and asserting `patch()`/`snapshots()` stay reference-identical on rejection. WR-01 is
fully closed — both halves (`operatorId` and `slot`) are now runtime-validated.

## Info

### IN-01: `setAlgorithm`, `updateOperator`, and `setFeedback` duplicate the same read-validate-spread-set shape

**File:** `src/app/state/instrument-state.ts:137-167`
**Issue:** All three command methods repeat the identical three-step shape — read `this._patch()`
into `previous`, validate the incoming argument, then `this._patch.set({ ...previous, <field> })`.
This is currently small and readable per-method, but as more commands are added in later phases
(the file's own docs mention lesson/progress, audio lifecycle, and settings facades following this
pattern) the duplicated spread is a spot where a future edit (e.g. adding a field that must be
recomputed/derived on write) could be applied to one command and missed in the others.
**Fix:** Optional for this phase; consider a small private helper once a third or fourth similarly-shaped
command lands, e.g. `private updatePatch(patch: Partial<InstrumentPatch>): void { this._patch.set({ ...this._patch(), ...patch }); }`.

### IN-02: README "Status" line is stale relative to the architecture text this diff added to the same file

**File:** `README.md:8`
**Issue:** Line 8 still reads "Phase 1 of 14 complete", but this very diff added the "Instrument
state facade" bullet (README.md:56-61) describing `InstrumentState` as already implemented, and
`.planning/ROADMAP.md` already shows Phase 2 checked off with Phase 3 (this phase) in
`status: verifying` per `.planning/STATE.md`. The file is now internally inconsistent: the
"Status" line undersells progress by two phases relative to the Architecture summary immediately
below it in the same document.
**Fix:** Update the Status line (and the two `npm test`/build claims stay accurate) to reflect the
actual completed-phase count, e.g. "Phase 2 of 14 complete" (or defer to whatever phase-completion
wording the ship workflow uses), so the top-of-file summary and the Architecture summary agree.

---

_Reviewed: 2026-08-05T21:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
