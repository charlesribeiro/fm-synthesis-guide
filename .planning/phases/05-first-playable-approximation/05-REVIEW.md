---
phase: 05-first-playable-approximation
reviewed: 2026-08-07T14:12:49Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/app/core/audio/audio-context.token.ts
  - src/app/core/audio/synth-engine.token.ts
  - src/app/core/audio/testing/fake-audio-context.ts
  - src/app/core/audio/web-audio-synth-engine.spec.ts
  - src/app/core/audio/web-audio-synth-engine.ts
  - src/app/domain/dx7/audio/patch-plan.spec.ts
  - src/app/domain/dx7/audio/patch-plan.ts
  - src/app/domain/dx7/audio/value-conversion.spec.ts
  - src/app/domain/dx7/audio/value-conversion.ts
  - src/app/features/playground/keyboard-note-map.spec.ts
  - src/app/features/playground/keyboard-note-map.ts
  - src/app/features/playground/playground.html
  - src/app/features/playground/playground.scss
  - src/app/features/playground/playground.spec.ts
  - src/app/features/playground/playground.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 05: Code Review Report (Round 4 — final independent confirmation pass)

**Reviewed:** 2026-08-07
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This round verifies commit `b41bd76` — the orchestrator's fix for round 3's WR-07 (right-click release events silencing a note held via another input path) and WR-08 (no regression test for overlapping keyboard presses). I traced the current source directly (not the commit message's framing of it) against both scenarios, plus the specific "does this fix reopen the door the *previous* round's suggested implementation would have closed" question, since round 3's fix suggestion was `pointerId`-based tracking and the shipped fix is `note`-based tracking instead.

**WR-07: confirmed resolved for the reported scenario.** `pointerHeldNote` is set only inside `onKeyPointerDown` after the `event.button !== 0` guard passes, and `onKeyPointerUp` (bound to `pointerup`/`pointerleave`/`pointercancel` in `playground.html:51-54`) now checks `this.pointerHeldNote !== note` before calling `releaseKey`. Traced: hold note 60 via the keyboard (`keyboardHeldCode` path, `pointerHeldNote` stays `null`) → right-click `pointerdown` on the same on-screen key is ignored by the `button !== 0` guard without touching `pointerHeldNote` → the right-click's own `pointerup` reaches `onKeyPointerUp(60)`, finds `pointerHeldNote === null !== 60`, and returns without calling `releaseKey`. `noteOff(60)` is never called. This matches the new spec at `playground.spec.ts:214-236` and I traced it independently of that test.

**WR-08: confirmed resolved.** Traced `onDocumentKeydown`/`onDocumentKeyup` through the overlapping-key sequence: press `KeyA` (60) → `keyboardHeldCode = 'KeyA'`; press `KeyS` (62) while `KeyA` still held → `keyboardHeldCode` is reassigned to `'KeyS'` and the engine retriggers to 62 (`WebAudioSynthEngine.heldNote` becomes 62). Releasing `KeyA` (the superseded key): `isTrackedRelease` is `false` (code doesn't match `keyboardHeldCode`), the guard's `return` only fires when `!isTrackedRelease && (modifier || editable)` — neither holds here, so the guard does not return, and `releaseKey(60)` runs unconditionally. This reaches `engine.noteOff(60)`, which the engine's own stale-release rule (`note !== heldNote`) turns into a no-op, and `releaseKey`'s local guard (`this._heldNote() === note`) also declines to clear component state since `_heldNote` is 62, not 60. The still-sounding note (62) is undisturbed. Releasing `KeyS` afterward correctly matches `isTrackedRelease`, clears the tracker, and releases cleanly. This matches the new regression test at `playground.spec.ts:363-395`. Both `WR-07` and `WR-08` are genuinely fixed — I found no critical or blocker-level issues in this pass.

One new, real gap surfaced from tracing the shipped implementation choice against round 3's own fix suggestion (below, WR-10) — it does not reopen either reported bug, but it is a residual crack in the same "every note-ending path" contract this round's fix was hardening.

## Warnings

### WR-10: `pointerHeldNote` tracks the *note*, not the *pointer session* that started it — a same-key, cross-button interleave can still end a note the primary button is still holding

**File:** `src/app/features/playground/playground.ts:109-129`

**Issue:** Round 3's suggested fix for WR-07 (in the prior `05-REVIEW.md`) was explicitly `pointerId`-based: track the `pointerId` accepted by a primary-button `pointerdown`, and have every release handler ignore any pointer event whose `pointerId` doesn't match — noted at the time as also closing "the gap for multi-touch/pen cases, not just mouse buttons." The shipped fix instead tracks the *note* (`pointerHeldNote: number | null`), which is a strictly weaker guard: it only distinguishes "was some primary-button press still active for this note," not "did *this specific* release event correspond to the press that's being tracked."

Concretely, on real mouse hardware, pressing a second button while the first is still held dispatches its own `pointerdown`/`pointerup` pair sharing the same `pointerId`:

1. Left-click-hold (`button: 0`) on key N → `onKeyPointerDown` sets `pointerHeldNote = N`, `pressKey(N)` sounds the note.
2. While the left button is still physically down, right-click the *same* key → its `pointerdown` (`button: 2`) is correctly ignored by the `event.button !== 0` guard and does not touch `pointerHeldNote` (still `N`).
3. Release the *right* button → its `pointerup` fires on the same element. `onKeyPointerUp(N)` is bound directly to `key.note` in the template (`playground.html:52-54`), not to `$event`, so it has no way to know this `pointerup` belongs to the right button, not the left. `pointerHeldNote === N` still matches, so it clears the tracker and calls `releaseKey(N)` — silencing the note even though the left button that started it is still physically held down.

The doc comment on `onKeyPointerUp` even acknowledges `pointerup` "does" carry reliable button semantics (unlike `pointerleave`/`pointercancel`), but the implementation discards the event entirely for all three bindings, so that reliable information is never used, even where it's available. This is a materially narrower window than the WR-07 scenario (requires the *same* on-screen key and an interleaved second mouse button, or a second concurrent touch/pen contact resolving to the same key), so it is not a blocker, but it is a real, reachable gap in exactly the contract this commit was hardening, and it's a direct consequence of choosing note-based tracking over the previously-suggested pointerId-based tracking.

**Fix:** Track the `pointerId` (not just the note) the way round 3's review originally suggested:
```ts
private pointerHeldNote: number | null = null;
private primaryPointerId: number | null = null;

protected onKeyPointerDown(event: PointerEvent, note: number): void {
  if (event.button !== 0) {
    return;
  }
  this.pointerHeldNote = note;
  this.primaryPointerId = event.pointerId;
  this.pressKey(note);
}

protected onKeyPointerUp(event: PointerEvent, note: number): void {
  if (this.pointerHeldNote !== note || event.pointerId !== this.primaryPointerId) {
    return;
  }
  this.pointerHeldNote = null;
  this.primaryPointerId = null;
  this.releaseKey(note);
}
```
(Requires passing `$event` through from the three release bindings in `playground.html`, which currently pass only `key.note`.)

### WR-09 (carried forward, still open): monophonic last-note-priority engine plus last-key-wins tracker means an earlier still-held key never resumes sounding

**File:** `src/app/core/audio/web-audio-synth-engine.ts:411-433` (retrigger model)
**File:** `src/app/features/playground/playground.ts:56-65` (`keyboardHeldCode`/`pointerHeldNote`)

**Issue:** Unchanged from round 3's finding — not a defect, a real user-facing consequence of the single-voice design that still isn't called out anywhere in the code comments. If a player holds key A, then also holds key W without releasing A, the engine retriggers to W (A's tone stops, per D-04) and the relevant tracker reassigns to W. Releasing W while A is still physically held silences the voice entirely — there is no note-stack to fall back to A. This round's diff (`b41bd76`) added a second tracker (`pointerHeldNote`) built on the exact same last-writer-wins shape without adding the documentation round 3 suggested.

**Fix:** As before — document this as an accepted Phase 5 limitation next to `keyboardHeldCode`'s/`pointerHeldNote`'s doc comments, or implement a small held-key stack if it's worth fixing behaviorally.

## Info

### IN-01 (carried forward, still open): `onKeyPointerDown` guard comment says "middle click" but only checks `button !== 0`

**File:** `src/app/features/playground/playground.ts:92-109`

**Issue:** Unchanged from round 3 — the doc comment says the guard ignores "non-primary pointer buttons (right/middle click)," which is accurate for `button !== 0`, but is worth double-checking once WR-10's `pointerId`-based approach (or any touch/pen handling) lands, since `button` semantics differ for those pointer types. No functional issue.

**Fix:** No action required this round; revisit the comment's wording if WR-10 is addressed.

---

_Reviewed: 2026-08-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
