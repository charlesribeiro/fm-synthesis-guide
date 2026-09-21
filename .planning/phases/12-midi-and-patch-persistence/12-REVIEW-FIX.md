---
phase: 12-midi-and-patch-persistence
fixed_at: 2026-09-17T15:41:57Z
review_path: .planning/phases/12-midi-and-patch-persistence/12-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-09-17T15:41:57Z
**Source review:** `.planning/phases/12-midi-and-patch-persistence/12-REVIEW.md`
**Iteration:** 1
**Fix scope:** critical_warning (IN-01 and IN-02 left untouched)

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

All work ran in the main checkout on `feature/phase-12-midi-and-patch-persistence` (no isolated worktree). After the three per-finding commits, the same checkout ran `npm test` (2098/2098 passing), `npm run lint` (clean), and `npm run build` (success). Those numbers are reproducible from the tree you are looking at now.

## Fixed Issues

### CR-01: Disconnected selected device vanishes from `ports()` on a spec-compliant MIDIAccess

**Files modified:** `src/app/core/browser/midi-access.token.ts`, `src/app/core/midi/midi-session.ts`, `src/app/core/midi/midi-session.spec.ts`, `src/app/core/midi/testing/fake-midi-access.ts`, `src/app/features/settings/settings.spec.ts`
**Commit:** `fb934d4`
**Applied fix:** `MidiAccessLike.onstatechange` now carries `MIDIConnectionEvent.port`. `FakeMidiAccess.disconnectInput` deletes the port from `inputs` (Web MIDI) and fires that event; `reconnectInput` restores it from a side map. `MidiSession` caches the selected port name and injects a sticky `{ id, name, connected: false }` row when the selected id is missing from the map. D-04 specs now assert `inputs.get(id)` is undefined while `ports()` / the Settings `<select>` still list the disconnected selected device.

### WR-01: Hotplug after `'no-devices'` never persists `lastMidiDeviceId`

**Files modified:** `src/app/core/midi/midi-session.ts`, `src/app/core/midi/midi-session.spec.ts`
**Commit:** `684e6e0`
**Applied fix:** `refreshPorts` auto-selects the first connected port through `selectPort` instead of `applySelection`, so `SavedDocumentStore.setLastMidiDeviceId` runs. Spec: enable with zero inputs, `addInput`, expect `document().lastMidiDeviceId` to equal the new port id.

### WR-02: Failed recovery write leaves the corrupt storage blob in place

**Files modified:** `src/app/state/saved-document-store.ts`, `src/app/state/saved-document-store.spec.ts`
**Commit:** `9135cf5`
**Applied fix:** On parse failure, `recoverToDefaults` `removeItem`s `PERSISTENCE_STORAGE_KEY` before writing defaults, and keeps `recoveryMessage` if the follow-up `setItem` throws. Spec: seed `'{not-json'` then `throwOnSetItem = true`; after construction `getItem` is not the corrupt blob (it is `null`), recovery copy remains, and `writeError` is set.

## Remaining out-of-scope issues

Info findings were excluded by `fix_scope: critical_warning`:

- **IN-01:** Settings live `replacePatch` on import/clear is unreachable in production (`router.url === '/playground'` never holds on `/settings`).
- **IN-02:** Probe-failure `NOOP_STORAGE` swallows writes without `writeError`.

---

_Fixed: 2026-09-17T15:41:57Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
