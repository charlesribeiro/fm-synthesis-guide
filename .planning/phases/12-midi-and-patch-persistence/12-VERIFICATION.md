---
phase: 12-midi-and-patch-persistence
verified: 2026-09-09T14:04:02Z
status: passed
score: 26/26 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 12: MIDI and patch persistence Verification Report

**Phase Goal:** Progressive Web MIDI input and versioned, importable/exportable persistence.
**Verified:** 2026-09-09T14:04:02Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

Merged must-haves: three ROADMAP success criteria (non-negotiable) plus PLAN frontmatter truths that add specificity. PLAN items that merely restate a roadmap criterion keep the roadmap wording.

`gsd-tools query verify.artifacts` / `verify.key-links` returned empty arrays because PLAN artifacts/links are string paths, not `{path, provides}` objects. Every item below was checked by reading source, tracing wiring, and running named specs.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | MIDI note on/off/velocity works when a device is present; app is fully usable without MIDI | ✓ VERIFIED | `parseMidiNoteMessage` maps `0x90` vel 1–127 to `{kind:'on'}`, vel 0 and `0x80` to `{kind:'off'}`. PlaySurface `handleMidiNote` → `pressKey(note, velocity)` / `releaseKey`; `play-surface.spec.ts` asserts `noteOn(60, 80)`, `notePlayed` 60, and vel-0 never calls `noteOn` with 0. Playground TestBed provides `{ provide: REQUEST_MIDI_ACCESS, useValue: null }` and still enables audio / plays on-screen keys. `MidiSession` with null token is `'unsupported'` without throwing. |
| 2 | Settings/progress/patches persist across reload with a versioned schema | ✓ VERIFIED | Schema is locked `PERSISTENCE_SCHEMA_VERSION = 1` on `SavedDocument`. `LessonProgress.markComplete` → `SavedDocumentStore.persistLessonProgress` → `STORAGE.setItem(PERSISTENCE_STORAGE_KEY, JSON.stringify(doc))`. Simulated-reload spec shares one `FakeStorage` across `TestBed.resetTestingModule()` and `isComplete('algorithm-32')` stays true. Playground slot is a dedicated `playgroundPatch` field; last MIDI id is `lastMidiDeviceId`. |
| 3 | Malformed persisted or imported data is recovered from without crashing | ✓ VERIFIED | `parseSavedDocument` is try/catch fail-closed (`null`, never throws) including hostile getters, array root, missing/v2 schema, seventh operator, Dexed-shaped payload. Store constructor: missing key → defaults; unparseable → defaults + recovery message + rewrite. Settings import: confirm → size cap → `file.text()` → `JSON.parse` → `parseSavedDocument` → only then `replaceDocument`. Dexed/oversize/cancel leave `FakeStorage` unchanged. |
| 4 | Unknown extra JSON keys on an otherwise valid schema-version-1 document are ignored and the document still parses | ✓ VERIFIED | `parse-saved-document.spec.ts`: extra-key document parses; `Object.keys` are only the four `SavedDocument` fields; `'extraKey' in parsed` is false. Settings import of extra-key v1 JSON hydrates progress. |
| 5 | `PlaygroundPatchSlot.write` persists a dedicated playground patch field; `LessonProgress.markComplete` does not change that field | ✓ VERIFIED | `writePlaygroundPatch` spreads the document and replaces only `playgroundPatch`. `persistLessonProgress` replaces only `completedLessonIds`. `playground-patch-slot.spec.ts`: markComplete after write leaves `read()` equal to the written patch. |
| 6 | `InstrumentState.replacePatch` atomically replaces algorithm, six operators, and feedback after validation, and never writes storage | ✓ VERIFIED | `replacePatch` validates via `resolveAlgorithm` / `validateOperatorParameters` / `validateFeedbackLevel`, then one `_patch.set`. No `STORAGE` import. Spec: `setAlgorithm(32)` then `replacePatch(DEFAULT_PATCH)` yields algorithmId 1 in one `set`; snapshots unchanged. |
| 7 | Quota failure on `setItem` keeps the in-memory document and sets a non-destructive explanation rather than throwing into the UI | ✓ VERIFIED | `writeToStorage` catch sets `WRITE_ERROR_MESSAGE` and does not rethrow. Spec: `throwOnSetItem` + `markComplete` does not throw; in-memory completion remains; `writeError()` is non-empty. |
| 8 | Before any Enable MIDI click, `MidiSession.status()` is `'off'` (or `'unsupported'` when the token is `null`); it is never `'no-devices'` on construction | ✓ VERIFIED | Constructor: `requestMidiAccess === null ? 'unsupported' : 'off'`. `enable()` is the only caller of the token function. Specs: construction call count 0, including when `lastMidiDeviceId` is pre-filled; null token → `'unsupported'`. `app.config.ts` has no `APP_INITIALIZER` and never names MIDI. |
| 9 | Enable MIDI on PlaySurface requests access only from that click, starts audio on the same gesture if audio is not ready, and leaves `document.activeElement` on the Enable MIDI button | ✓ VERIFIED | `toggleMidi` → `initializeAudio()` (no `.key` focus) then `midiSession.enable()`. `play-surface.spec.ts`: focus stays on Enable MIDI; Enable MIDI constructs audio when suspended. Enable audio still focuses first `.key`. |
| 10 | CC, pitch bend, program change, clock, and SysEx parse to `null` and change no hold count | ✓ VERIFIED | Parser: `high >= 0xF0` → null (SysEx/clock); non-`0x90`/`0x80` → null (CC `0xB0`, pitch bend `0xE0`, program change `0xC0`). Spec names CC; PlaySurface CC emit after ready does not change `noteOn` count. Short buffers also null. |
| 11 | Notes 0–127 sound; on-screen keys still only light for 60–71 | ✓ VERIFIED | `MIN_MIDI_NOTE`/`MAX_MIDI_NOTE` are 0/127; parser and engine `validateNote` share those bounds. On-screen keys are `PLAYABLE_KEYS` (60–71) with `[class.key--pressed]="heldNotes().has(key.note)"`. Spec: MIDI note 48 calls `noteOn` and no `[data-note="48"]` exists. |
| 12 | MIDI plus pointer sharing C4 keep the note held until both owners release; a new MIDI note retunes the voice | ✓ VERIFIED | `noteHoldCount` + `midiHeldNotes` as a third owner. Spec: MIDI release while pointer holds C4 keeps `aria-pressed`. New MIDI note calls `pressKey`/`engine.noteOn`; last-note-wins is existing engine policy. |
| 13 | Disable MIDI and selected-device disconnect both call `allNotesOff`. Disconnect of a non-selected port does not change selection | ✓ VERIFIED | `disable()` and selected-port `refreshPorts` call `engine.allNotesOff()`. Specs: disable → `'off'` and `allNotesOff`; selected disconnect keeps id, `'disconnected'`, `allNotesOff`; non-selected disconnect leaves selection. PlaySurface effect releases MIDI-owned notes when status leaves `'ready'`. |
| 14 | Entering `/playground` applies `PlaygroundPatchSlot.read()` through `InstrumentState.replacePatch` | ✓ VERIFIED | Playground constructor: `replacePatch(this.playgroundPatchSlot.read())`. No `effect()`, no `router.events`. Spec: live algorithmId 1 then construct Playground with slot algorithm 32 → live is 32. |
| 15 | ToolsPanel Randomize and Reset each call `PlaygroundPatchSlot.write(state.patch())` after the live command | ✓ VERIFIED | `resetPatch`/`randomizePatch` write after `state.reset()`/`state.randomize()`. Specs: Reset writes `DEFAULT_PATCH`; Randomize writes live operators by reference. |
| 16 | ToolsPanel Capture/Recall A/B do not call `write` | ✓ VERIFIED | `captureA`/`captureB`/`recallA`/`recallB` only touch `InstrumentState` snapshots. Spec: Capture A leaves slot algorithmId 32. Production methods have no `playgroundPatchSlot.write`. |
| 17 | Opening a lesson still writes `startingPatch` into live `InstrumentState` and does not call `PlaygroundPatchSlot.write` | ✓ VERIFIED | `lesson-detail.ts` `applyStartingPatch` uses `setAlgorithm` / `updateOperator` / `setFeedback` only — no slot import. Spec spies `write` (call count 0) and `read()` remains `DEFAULT_PATCH` after `/learn/algorithm-32`. |
| 18 | `LessonDetail` production code is unchanged; isolation is proven by a spy on the slot | ✓ VERIFIED | `lesson-detail.ts` has zero `PlaygroundPatchSlot` references. Isolation lives in `lesson-detail.spec.ts`. |
| 19 | Primary nav is Learn, Algorithms, Playground, Settings, About; `/settings` lazy-loads `Settings` with title `Settings — DX7 Algorithm Lab` | ✓ VERIFIED | `app.html` five links in that order. `app.routes.ts` `path: 'settings'` `loadComponent` → `Settings`, title exact. `app.spec.ts` asserts labels and route placement. |
| 20 | Settings Enable MIDI requests access, starts audio if needed, and does not live on the play-surface-only path | ✓ VERIFIED | Settings `toggleMidi` calls `engine.initialize()` then `midiSession.enable()` — no PlaySurface import. Specs: suspended audio constructs FakeAudioContext; stored port B selected from Settings. |
| 21 | After Enable MIDI, the session reselects `document().lastMidiDeviceId` when that id is still among inputs; otherwise first connected `values()`; selecting a port writes that id | ✓ VERIFIED | `attachAccess` prefers saved id if present in `inputs`, else first `state === 'connected'`. `selectPort` → `store.setLastMidiDeviceId`. Specs: B selected despite A first; absent saved id falls back to first; Settings `<select>` writes id. |
| 22 | Settings shows a named device `<select>` that still lists a disconnected selected id as disconnected until it returns or the user picks another | ✓ VERIFIED | `ports()` includes disconnected selected; `deviceOptionLabel` appends `(disconnected)`. Fake disconnect keeps port in map. Spec: disconnected selected remains listed with that word in the label. |
| 23 | Each of unsupported, permission-denied, no-devices, disconnected, ready, and off has a full-sentence explanation on Settings; PlaySurface keeps only the short status; no footer MIDI indicator | ✓ VERIFIED | `settings.ts` `midiExplanation` switch covers all six with full sentences (ready includes device name). PlaySurface `midiStatusMessage` is the short form. `app.html` footer has motion-preference only; `app.spec.ts` asserts footer has no MIDI copy. |
| 24 | Export downloads `dx7-algorithm-lab-backup.json` of the current document. Import is a labelled file picker; after confirm a successful parse replaces the whole document; a failed parse leaves state unchanged | ✓ VERIFIED | `exportBackup` → `downloadJson(EXPORT_FILENAME, JSON.stringify(store.document()))`. Import: `window.confirm` → size → text → JSON.parse → `parseSavedDocument` → `replaceDocument` (full replace, not merge). Specs: filename, cancel, oversize, Dexed, extra-key success on `/playground`. |
| 25 | Clear saved data confirms, `removeItem`s only this app's key, restores defaults, disables MIDI, and applies `DEFAULT_PATCH` only when the current URL is `/playground` | ✓ VERIFIED | `clearDocument` uses `removeItem(PERSISTENCE_STORAGE_KEY)` only. Settings clear: confirm → `clearDocument` → `midiSession.disable()` → `replacePatch(DEFAULT_PATCH)` iff playground route. Specs: other origin key kept; lesson URL leaves live algorithmId 32; cancel does not `removeItem`. |
| 26 | Imported strings render through text interpolation only | ✓ VERIFIED | `settings.html` binds recovery, writeError, importError, and MIDI explanation with `{{ }}`. Zero `innerHTML` / `[innerHTML]` under `src/app/features/settings/`. |

**Score:** 26/26 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/app/domain/dx7/persistence/saved-document.ts` | schema v1 document + keys | ✓ VERIFIED | 35 lines; `SavedDocument`, `PERSISTENCE_SCHEMA_VERSION=1`, `PERSISTENCE_STORAGE_KEY`, `EXPORT_FILENAME`, `MAX_IMPORT_BYTES`, `defaultSavedDocument()` — no snapshots/AudioNodes |
| `src/app/domain/dx7/persistence/parse-saved-document.ts` | never-throw codec | ✓ VERIFIED | 150 lines; iterates `OPERATOR_IDS`, `validateOperatorParameters` / `validateFeedbackLevel` / `isAlgorithmId` / `isLessonId`; whole body in try/catch |
| `src/app/domain/dx7/persistence/parse-saved-document.spec.ts` | hostile matrix | ✓ VERIFIED | 114 lines; 11 rejected rows + extra-key + round-trip |
| `src/app/core/persistence/storage.token.ts` | STORAGE seam | ✓ VERIFIED | 38 lines; factory is the only `window.localStorage` name; never returns null |
| `src/app/core/persistence/testing/fake-storage.ts` | Map fake + quota flag | ✓ VERIFIED | 27 lines; `throwOnSetItem` |
| `src/app/state/saved-document-store.ts` | hydrate/persist/recover | ✓ VERIFIED | 131 lines; `hydrateLive`, recover-to-defaults, quota catch, `removeItem` only on clear |
| `src/app/state/saved-document-store.spec.ts` | store + FakeStorage tests | ✓ VERIFIED | 116 lines |
| `src/app/state/playground-patch-slot.ts` | dedicated slot facade | ✓ VERIFIED | 31 lines; validate then `writePlaygroundPatch`; no `InstrumentState` subscription |
| `src/app/state/playground-patch-slot.spec.ts` | isolation tests | ✓ VERIFIED | 74 lines |
| `src/app/state/lesson-progress.ts` | durable markComplete | ✓ VERIFIED | `replaceCompleted` + `inject(Injector).get(SavedDocumentStore).persistLessonProgress` |
| `src/app/state/instrument-state.ts` | `replacePatch` | ✓ VERIFIED | atomic validate-then-set; no persistence import |
| `src/app/app.ts` | `hydrateLive()` on boot | ✓ VERIFIED | injects store and hydrates in constructor |
| `src/app/core/browser/midi-access.token.ts` | feature-detect, never invoke | ✓ VERIFIED | 59 lines; factory returns function or null |
| `src/app/core/midi/testing/fake-midi-access.ts` | fake access/input | ✓ VERIFIED | 87 lines; Map insertion order; disconnect keeps port |
| `src/app/domain/dx7/midi/parse-midi-note-message.ts` | fail-closed parser | ✓ VERIFIED | 52 lines |
| `src/app/domain/dx7/midi/parse-midi-note-message.spec.ts` | parser matrix | ✓ VERIFIED | 51 lines |
| `src/app/core/midi/midi-session.ts` | session + D-20 | ✓ VERIFIED | 205 lines; named states; selected-port handler only; saved-id preference |
| `src/app/core/midi/midi-session.spec.ts` | session tests | ✓ VERIFIED | 311 lines |
| `src/app/features/play-surface/play-surface.ts` | MIDI ownership + initializeAudio | ✓ VERIFIED | `pressKey(note, velocity)`, `toggleMidi`, `midiHeldNotes`, status effect |
| `src/app/features/play-surface/play-surface.html` | MIDI toggle + short status | ✓ VERIFIED | MIDI button outside `.gate`; second `role="status"` |
| `src/app/features/play-surface/play-surface.spec.ts` | MIDI + FakeStorage TestBed | ✓ VERIFIED | STORAGE fake in setup; MIDI velocity/focus/hold/disconnect cases |
| `src/app/features/playground/playground.ts` | constructor restore | ✓ VERIFIED | `replacePatch(read())`; no effect |
| `src/app/features/playground/playground.spec.ts` | restore-on-enter | ✓ VERIFIED | named D-21 spec passed |
| `src/app/features/playground/tools-panel/tools-panel.ts` | write after randomize/reset | ✓ VERIFIED | write only on those two paths |
| `src/app/features/playground/tools-panel/tools-panel.spec.ts` | write/non-write | ✓ VERIFIED | Reset/Randomize/Capture A cases passed |
| `src/app/features/learn/lesson-detail/lesson-detail.spec.ts` | slot write spy | ✓ VERIFIED | spy call count 0 |
| `src/app/features/settings/settings.ts` | MIDI + import/export/clear | ✓ VERIFIED | 170 lines; decode-then-replace; playground-only live patch smash |
| `src/app/features/settings/settings.html` | labelled controls | ✓ VERIFIED | 59 lines; file picker, device select, live regions |
| `src/app/features/settings/settings.scss` | page layout tokens | ✓ VERIFIED | 110 lines |
| `src/app/features/settings/settings.spec.ts` | Settings behavior | ✓ VERIFIED | 419 lines |
| `src/app/core/persistence/download-json.ts` | Blob download helper | ✓ VERIFIED | 10 lines, complete (Blob → object URL → `<a download>` → revoke) |
| `src/app/core/persistence/download-json.spec.ts` | download helper tests | ✓ VERIFIED | 31 lines |
| `src/app/app.routes.ts` | lazy `/settings` | ✓ VERIFIED | after playground, before about |
| `src/app/app.html` | Settings nav link | ✓ VERIFIED | after Playground |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `STORAGE.getItem(PERSISTENCE_STORAGE_KEY)` | `SavedDocumentStore` document → `LessonProgress.replaceCompleted` / `PlaygroundPatchSlot.read` | `parseSavedDocument` then `hydrateLive()` | WIRED | Store constructor loads; `App` constructor calls `hydrateLive()` |
| `LessonProgress.markComplete` | `STORAGE.setItem` of whole v1 document | `SavedDocumentStore.persistLessonProgress` | WIRED | After non-idempotent mark |
| `PlaygroundPatchSlot.write` | `playgroundPatch` field only | `writePlaygroundPatch` | WIRED | Lesson ids untouched |
| `parseSavedDocument` | validators | `OPERATOR_IDS` + `raw[String(id)]` | WIRED | Exact-six-key check rejects a seventh operator |
| App / Learn / LessonProgress TestBeds | origin isolation | `{ provide: STORAGE, useValue: new FakeStorage() }` | WIRED | Present in `app.spec.ts`, `lesson-progress.spec.ts`, `learn.spec.ts` |
| `REQUEST_MIDI_ACCESS` factory | `MidiSession.enable` | only `this.requestMidiAccess({ sysex: false })` | WIRED | Grep: sole invocation is `midi-session.ts` line 70 |
| selected-port `onmidimessage` | `SYNTH_ENGINE` | `parseMidiNoteMessage` → PlaySurface `pressKey`/`releaseKey` | WIRED | Unselected `onmidimessage` stays null (session spec) |
| `initializeAudio()` vs `enableAudio()` | focus contract | no querySelector in initialize; enableAudio focuses `.key` | WIRED | Specs for both |
| `/playground` constructor | live patch | `PlaygroundPatchSlot.read` → `replacePatch` | WIRED | |
| ToolsPanel reset/randomize | slot | live command then `write` | WIRED | |
| `LessonDetail.applyStartingPatch` | live state only | `setAlgorithm` / `updateOperator` / `setFeedback` | WIRED | No slot write |
| `app.routes.ts` `path: 'settings'` | `Settings` | lazy `loadComponent` | WIRED | |
| `MidiSession.enable` | saved device | `document().lastMidiDeviceId` → `selectPort` or first connected | WIRED | |
| Settings import | store | size cap → `file.text()` → `JSON.parse` → `parseSavedDocument` → `replaceDocument` | WIRED | |
| `downloadJson` | file save | Blob → object URL → `<a download>` → revoke | WIRED | Spec spies URL + click |
| `play-surface.spec.ts` TestBeds | SavedDocumentStore | `STORAGE: FakeStorage` | WIRED | After MidiSession injects the store |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `SavedDocumentStore` | `_document` | `STORAGE.getItem` → `JSON.parse` → `parseSavedDocument` | Yes — FakeStorage/origin bytes, not a hardcoded `[]` | ✓ FLOWING |
| `Playground` | live `InstrumentState.patch` | `PlaygroundPatchSlot.read()` → `replacePatch` | Yes — document `playgroundPatch` | ✓ FLOWING |
| `Settings` MIDI UI | `midiSession.status/ports/selectedPortId` | `MidiSession` signals after Enable MIDI | Yes — fake or real MIDIAccess | ✓ FLOWING |
| `Settings` recovery/import errors | `store.recoveryMessage` / `_importError` | corrupt storage / failed parse | Yes — live region text from those signals | ✓ FLOWING |
| `PlaySurface` MIDI | `subscribeNotes` parsed events | selected-port `onmidimessage` | Yes — FakeMidiInput.emit in tests | ✓ FLOWING |
| ToolsPanel A/B | `snapshots()` | in-memory `InstrumentState` only | Session-only by design (not persisted) | ✓ FLOWING (not durable) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Persistence + MIDI + Settings cluster | `npm test -- --watch=false --include='**/parse-saved-document.spec.ts' --include='**/saved-document-store.spec.ts' --include='**/lesson-progress.spec.ts' --include='**/playground-patch-slot.spec.ts' --include='**/parse-midi-note-message.spec.ts' --include='**/midi-session.spec.ts' --include='**/play-surface.spec.ts' --include='**/settings.spec.ts' --include='**/download-json.spec.ts' --include='**/app.spec.ts' --include='**/tools-panel.spec.ts'` | 11 files, 114 passed | ✓ PASS |
| Playground restore, lesson isolation, replacePatch | `npm test -- --watch=false --include='**/playground.spec.ts' --include='**/lesson-detail.spec.ts' --include='**/instrument-state.spec.ts'` | 3 files, 124 passed | ✓ PASS |

Named behaviors covered in those runs include simulated reload, unparseable recovery, quota writeError, hostile parse matrix, MIDI vel-0, Enable MIDI focus, disconnect `allNotesOff`, last-device id, Dexed import refusal, clear-without-smashing-lesson, restore-on-enter, and slot write spy.

Full workspace `npm test` / `npm run build` / `npm run lint` were **not** re-run in this verification (constraint: full suite at most once; orchestrator reported 2096 passed post-merge). Spot-checks above are the verifier-owned evidence.

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No `scripts/*/tests/probe-*.sh` and no probe paths in Phase 12 PLAN/SUMMARY | SKIP (not applicable) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PERSIST-01 | 12-01, 12-03, 12-04 | Versioned local persistence with JSON import/export and malformed-data recovery | ✓ SATISFIED | Schema v1 codec, FakeStorage seam, durable LessonProgress, Playground slot isolation, Settings export/import/clear, recovery without throw |
| MIDI-01 | 12-02, 12-04 | Progressive Web MIDI note on/off, velocity, device connect/disconnect | ✓ SATISFIED | Feature-detect token, Enable MIDI gesture, parser + PlaySurface ownership, named states, disconnect/disable `allNotesOff`, Settings picker + last-device id, usable with null token |

No REQUIREMENTS.md IDs map to Phase 12 beyond PERSIST-01 and MIDI-01 — no orphaned requirements.

### Prohibitions

PLAN `must_haves.prohibitions` are `verification: test` without projected `check_*` scalars, so `gsd-tools check prohibition-enforcement` cannot locate a fixture-driven producer. Enforcement was verified by reading production code and the named specs that already fail-closed on the forbidden behavior:

| Statement | Status | Evidence |
| --------- | ------ | -------- |
| MUST NOT persist A/B snapshot slots, AudioNodes, or in-flight note state | enforced | `SavedDocument` has four fields only; `replacePatch` does not touch `_snapshots`; Capture A spec leaves slot unchanged |
| MUST NOT accept Dexed banks / SysEx / missing-or-not-1 schema | enforced | parse hostile matrix + Settings Dexed import leaves storage unchanged |
| MUST NOT throw from parse/store construction on malformed JSON, hostile getters, or quota | enforced | parse never-throw specs; store unparseable + quota specs |
| MUST NOT wipe the entire origin storage collection | enforced | `clearDocument` `removeItem` only; other-key spec |
| MUST NOT let `markComplete` write the Playground patch field | enforced | isolation spec |
| MUST NOT pass MIDI velocity 0 into engine note-on | enforced | parser rewrites vel-0 as off; PlaySurface spec |
| MUST NOT request MIDI at module eval / factory invoke / APP_INITIALIZER | enforced | factory does not call the function; construction call count 0; no APP_INITIALIZER |
| MUST NOT attach the selected-port handler to every input | enforced | `attachSelectedInput` on one port; unselected `onmidimessage` null |
| MUST NOT move focus after Enable MIDI | enforced | PlaySurface D-10 spec |
| MUST NOT start audio from a MIDI note-on | enforced | `handleMidiNote` returns if `!isReady()`; audio starts from Enable MIDI / Enable audio |
| MUST NOT persist live InstrumentState from a global subscription/effect | enforced | slot writes are call-site only; Playground has no `effect()` |
| MUST NOT serialize A/B when writing the Playground slot | enforced | `writePlaygroundPatch` writes `InstrumentPatch` only |
| MUST NOT add a reactive route-sync hook on Playground | enforced | constructor restore only |
| MUST NOT merge an imported document | enforced | `replaceDocument` replaces whole doc |
| MUST NOT apply a failed import | enforced | parse-null / oversize / cancel specs |
| MUST NOT assign imported bytes as HTML markup | enforced | interpolation-only template |
| MUST NOT auto-enable MIDI on boot when hydrating lastMidiDeviceId | enforced | hydrate does not call `enable()`; construction request count 0 with pre-filled id |
| MUST NOT smash a live lesson patch when clearing saved data | enforced | clear spec on `/learn/algorithm-32` leaves algorithmId 32 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/app/features/playground/playground.ts` | 49–52 | `comingSoon` list | ℹ️ Info | Pre-existing Phase 10 leftover (algorithm selector / operator strips). Not a Phase 12 stub; persistence/MIDI wiring is real. |
| PLAN prohibitions | — | `verification: test` without `check_*` projection | ℹ️ Info | GSD prohibition-enforcement producer cannot run; actual tests still enforce the must-NOTs (see table above). |
| `parse-midi-note-message.spec.ts` | 28–36 | CC named; pitch bend / program change / clock / SysEx not named rows | ℹ️ Info | Parser catch-all + `high >= 0xF0` covers them; PlaySurface also asserts CC does not change hold/`noteOn`. Not a missing implementation. |
| `saved-document-store.ts` `loadFromStorage` | 85–89 | `getItem` throw → treat as missing | ℹ️ Info | Path exists; no dedicated spec (unparseable string and quota `setItem` are covered). |

No `TBD` / `FIXME` / `XXX` in Phase 12 production files. No `localStorage.clear()`. No Settings `innerHTML`.

### Human Verification Required

None. PLAN `<verify>` blocks are automated-only (no harvested `<human-check>`). Phase contract is fake MIDIAccess + FakeStorage (REQUIREMENTS.md: closed by automated fakes). Visual polish and a physical MIDI controller are not must-haves for this phase; hardware UX belongs to later hardening if at all.

### Gaps Summary

No actionable gaps. The three ROADMAP success criteria hold in code and in named passing specs. PERSIST-01 and MIDI-01 are accounted for. Later Phase 13 (HARDEN-01) does not cover leftover MIDI/persistence work that this phase missed — there is nothing to defer.

---

_Verified: 2026-09-09T14:04:02Z_
_Verifier: Claude (gsd-verifier)_
