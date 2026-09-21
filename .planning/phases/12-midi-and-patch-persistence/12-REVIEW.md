---
phase: 12-midi-and-patch-persistence
reviewed: 2026-09-09T14:15:00Z
depth: deep
files_reviewed: 38
files_reviewed_list:
  - src/app/domain/dx7/persistence/saved-document.ts
  - src/app/domain/dx7/persistence/parse-saved-document.ts
  - src/app/domain/dx7/persistence/parse-saved-document.spec.ts
  - src/app/core/persistence/storage.token.ts
  - src/app/core/persistence/testing/fake-storage.ts
  - src/app/core/persistence/download-json.ts
  - src/app/core/persistence/download-json.spec.ts
  - src/app/state/saved-document-store.ts
  - src/app/state/saved-document-store.spec.ts
  - src/app/state/playground-patch-slot.ts
  - src/app/state/playground-patch-slot.spec.ts
  - src/app/state/lesson-progress.ts
  - src/app/state/lesson-progress.spec.ts
  - src/app/state/instrument-state.ts
  - src/app/state/instrument-state.spec.ts
  - src/app/app.ts
  - src/app/app.html
  - src/app/app.routes.ts
  - src/app/app.spec.ts
  - src/app/features/learn/learn.spec.ts
  - src/app/core/browser/midi-access.token.ts
  - src/app/core/midi/testing/fake-midi-access.ts
  - src/app/domain/dx7/midi/parse-midi-note-message.ts
  - src/app/domain/dx7/midi/parse-midi-note-message.spec.ts
  - src/app/core/midi/midi-session.ts
  - src/app/core/midi/midi-session.spec.ts
  - src/app/features/play-surface/play-surface.ts
  - src/app/features/play-surface/play-surface.html
  - src/app/features/play-surface/play-surface.spec.ts
  - src/app/features/playground/playground.ts
  - src/app/features/playground/playground.spec.ts
  - src/app/features/playground/tools-panel/tools-panel.ts
  - src/app/features/playground/tools-panel/tools-panel.spec.ts
  - src/app/features/learn/lesson-detail/lesson-detail.spec.ts
  - src/app/features/settings/settings.ts
  - src/app/features/settings/settings.html
  - src/app/features/settings/settings.scss
  - src/app/features/settings/settings.spec.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-09-09T14:15:00Z
**Depth:** deep
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Phase 12's persistence codec, STORAGE seam, Playground slot isolation, MIDI note path, and Settings backup UI are carefully fail-closed at the JSON and gesture boundaries. `parseSavedDocument` never throws, Dexed-shaped input is refused, `LessonProgress.markComplete` does not touch the Playground field, Enable MIDI does not steal focus, and velocity 0 never reaches `engine.noteOn`.

The MIDI disconnect story is not actually proven against Web MIDI. `MidiSession` rebuilds `ports()` only from `access.inputs`, while the spec removes a disconnected device from that map. `FakeMidiAccess.disconnectInput` keeps the port in the map, so D-04's "still listed as disconnected" specs are green against a non-spec fake. Two smaller persistence gaps remain: hotplug-from-empty never writes `lastMidiDeviceId`, and a failed recovery write leaves the corrupt blob on disk.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Disconnected selected device vanishes from `ports()` on a spec-compliant MIDIAccess

**File:** `src/app/core/midi/midi-session.ts:100-145`
**Also:** `src/app/core/browser/midi-access.token.ts:23-26`, `src/app/core/midi/testing/fake-midi-access.ts:50-56`, `src/app/features/settings/settings.html:14-24`

**Issue:** D-04 requires the Settings `<select>` to keep listing the selected device as disconnected until it returns or the user picks another. `refreshPorts` / `syncPorts` only project `access.inputs.values()`. The Web MIDI spec states that a disconnected port **must not appear** in that map (`MIDIPort.state` `"disconnected"`: "it should not appear in the relevant map of input and output ports"). `onstatechange` is typed and assigned as `() => void`, so the `MIDIConnectionEvent.port` that still names the unplugged device is discarded.

`FakeMidiAccess.disconnectInput` leaves the port in the map with `state: 'disconnected'`. Session and Settings specs therefore assert a listing that Chromium/Safari will not provide. In production:

1. `syncPorts` drops the selected id.
2. `selectedPortName()` is `null` (`_ports().find(...)` misses).
3. The native `<select>` has no matching `<option>`, so the picker goes blank while status is `'disconnected'`.
4. Silent-switch protection still holds (`selectedPortId` is kept; reconnect by the same id can still reattach). The named picker and explanation do not.

**Fix:** Cache the selected port's name on attach. On statechange, if the selected id is missing from `inputs`, keep a sticky `{ id, name, connected: false }` row. Thread `MIDIConnectionEvent.port` through the Like and the fake. Make `FakeMidiAccess.disconnectInput` **delete** the port from the map (and pass the port into `onstatechange`) so the D-04 spec actually fails until the sticky row exists.

```ts
// midi-access.token.ts — onstatechange must carry the port
onstatechange: ((event?: { port: MidiInputLike }) => void) | null;

// midi-session.ts — keep a ghost row when the map drops the selection
private selectedPortNameCache: string | null = null;

private syncPorts(inputs: readonly MidiInputLike[]): void {
  const views: MidiPortView[] = inputs.map((input) => ({
    id: input.id,
    name: input.name,
    connected: input.state === 'connected',
  }));
  const selectedId = this._selectedPortId();
  if (
    selectedId !== null &&
    !views.some((port) => port.id === selectedId)
  ) {
    views.push({
      id: selectedId,
      name: this.selectedPortNameCache ?? selectedId,
      connected: false,
    });
  }
  this._ports.set(views);
}

private attachAccess(access: MidiAccessLike): void {
  access.onstatechange = (event) => this.refreshPorts(event?.port);
  // ...
}

private attachSelectedInput(input: MidiInputLike): void {
  this.selectedPortNameCache = input.name;
  // existing onmidimessage wiring
}
```

```ts
// fake-midi-access.ts — match the spec: disconnected ⇒ absent from the map
disconnectInput(id: string): void {
  const input = this.inputMap.get(id);
  if (input === undefined) {
    return;
  }
  input.state = 'disconnected';
  this.inputMap.delete(id);
  this.onstatechange?.({ port: input });
}
```

## Warnings

### WR-01: Hotplug after `'no-devices'` never persists `lastMidiDeviceId`

**File:** `src/app/core/midi/midi-session.ts:126-134`

**Issue:** `enable()` auto-selects through `selectPort`, which calls `store.setLastMidiDeviceId`. `refreshPorts`, when `selectedPortId` is `null` (the `'no-devices'` case), auto-selects with `applySelection` instead. A keyboard plugged in after Enable MIDI with an empty list becomes `'ready'` but `document().lastMidiDeviceId` stays `null`. The next Enable MIDI falls back to first `values()` and can pick a different port once two devices exist (D-20 incomplete for this path).

**Fix:** Route that auto-select through `selectPort` (or call `setLastMidiDeviceId` after `applySelection`):

```ts
if (selectedId === null) {
  const firstConnected = inputs.find((input) => input.state === 'connected');
  if (firstConnected === undefined) {
    this.detachSelectedInput();
    this._status.set('no-devices');
    return;
  }
  this.selectPort(firstConnected.id);
  return;
}
```

Add a spec: enable with zero inputs, `addInput`, expect `store.document().lastMidiDeviceId` to equal the new port's id.

### WR-02: Failed recovery write leaves the corrupt storage blob in place

**File:** `src/app/state/saved-document-store.ts:111-116`

**Issue:** Unparseable storage calls `recoverToDefaults()`, which sets in-memory defaults and then `writeToStorage(defaults)`. If that `setItem` throws (quota still full), `writeError` is set but `getItem(PERSISTENCE_STORAGE_KEY)` still returns the corrupt string. Every later boot repeats D-26 recovery. `clearDocument` uses `removeItem`, which often succeeds when `setItem` cannot; recovery never tries that.

**Fix:** On parse failure, `removeItem` the app key before (or instead of) writing defaults, and keep `recoveryMessage` even if the follow-up write fails:

```ts
private recoverToDefaults(): void {
  const defaults = defaultSavedDocument();
  this._document.set(defaults);
  this._recoveryMessage.set(RECOVERY_MESSAGE);
  try {
    this.storage.removeItem(PERSISTENCE_STORAGE_KEY);
  } catch {
    // still attempt the defaults write below
  }
  this.writeToStorage(defaults);
}
```

Cover this with `throwOnSetItem = true` after seeding a corrupt string: after construction, `getItem` must not still return `'{not-json'`.

## Info

### IN-01: Settings live `replacePatch` on import/clear is unreachable in production

**File:** `src/app/features/settings/settings.ts:161-169`

**Issue:** `isPlaygroundRoute()` is `router.url === '/playground'`. Settings is a distinct lazy route, so while the page is showing, the URL is `/settings`. The import/clear tests inject `{ provide: Router, useValue: { url: '/playground' } }`, which never happens in the real shell. Production Playground restore still works via the constructor `replacePatch(read())` (Assumption A5). The live-apply branch is dead code that gives false confidence that Settings can patch live Playground state in place.

**Fix:** Drop the branch and rely on Playground constructor restore, or apply the imported/cleared playground patch unconditionally to `InstrumentState` only when it would not smash a lesson (for example by also checking the current activated route). If the branch stays, drive it with `RouterTestingHarness` at `/playground` plus a Settings overlay — not a fake `url` string.

### IN-02: Probe-failure `NOOP_STORAGE` swallows writes without `writeError`

**File:** `src/app/core/persistence/storage.token.ts:14-18`
**Also:** `src/app/state/saved-document-store.ts:123-129`

**Issue:** When the factory probe throws (private mode, disabled storage), callers get a Like whose `setItem` is a no-op that does not throw. `writeToStorage` therefore treats persist as success and leaves `writeError` null. Lesson completion looks saved for the session and vanishes on reload with no Settings explanation. Quota-throwing real `localStorage` is handled; the no-op fallback is not. Matches the plan's "never null" factory, but D-18's durable-progress story is silent here.

**Fix:** Make the no-op `setItem` throw (so the existing `writeError` path fires), or have the store detect a failed round-trip (`getItem` after `setItem`).

---

_Reviewed: 2026-09-09T14:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
