# Phase 12: MIDI and patch persistence - Research

**Researched:** 2026-09-09
**Domain:** Progressive Web MIDI input + versioned local JSON persistence (Angular 22 zoneless SPA)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Enable MIDI lives on the shared `PlaySurface` (so it appears next to Enable audio on
  Playground and in lessons). Settings also has Enable MIDI, so permission can be requested
  there without visiting Playground first. Once connected, MIDI notes work anywhere
  `PlaySurface` can play. — **Reversibility:** costly — PlaySurface, lessons, Playground, and
  Settings all share one MIDI session; splitting later means re-deriving enable/status wiring.
- **D-02:** New lazy `/settings` route is added to the primary nav this phase. Settings holds
  device status, the named device picker, full explanations of each MIDI state, import/export,
  and Clear saved data. Play surface shows only a short live MIDI status plus the enable/disable
  control.
- **D-03:** After permission, auto-select the first available input in `MIDIAccess.inputs`
  iterator order — no name heuristics. A named picker on Settings changes the selection.
- **D-04:** Remember the selected device. If it disconnects, show disconnected and reattach if
  that same device returns — do not silently switch to a different device. The Settings picker
  keeps it selected and marked disconnected until it returns or the user picks another. The
  device list updates live as ports appear and disappear.
- **D-05:** Distinct named MIDI states: unsupported, permission denied, no devices,
  disconnected, ready. Play surface shows a short status including the selected device name when
  ready. Settings has the full explanation for each state. No shell-footer MIDI indicator.
- **D-06:** Enable MIDI also starts audio on that same click if audio is not ready yet — the
  click is the AUDIO-01 user gesture, so a connected keyboard is not a silent trap.
- **D-07:** Listen on all MIDI channels (omni). No channel picker this phase.
- **D-08:** Always require Enable MIDI after reload — never call `requestMIDIAccess` on boot.
  Last selected device id may be persisted (D-20) and applied only after that explicit click.
- **D-09:** One play-surface control that reads Enable MIDI or Disable MIDI based on state;
  Settings has a matching disable. Disabling (or selected-device disconnect) calls
  `allNotesOff` so a held MIDI key cannot stick.
- **D-10:** Do not move focus after Enable MIDI succeeds.
- **D-11:** Ignore CC, pitch bend, program change, clock, and SysEx silently — only note on/off
  and velocity this phase.
- **D-12:** Play the full MIDI range 0–127. The on-screen keyboard stays C4–B4; notes outside
  that octave still sound.
- **D-13:** Overlapping MIDI notes use the engine's existing last-note-wins policy: a new note
  retunes the voice; releasing an older key does nothing; releasing the sounding note goes
  silent even if other MIDI keys are still down. No hold stack this phase.
- **D-14:** Pass MIDI velocity 1–127 through to the engine. Note-off velocity is ignored.
  Note-on with velocity 0 is treated as note-off (MIDI spec).
- **D-15:** Light matching on-screen keys when a MIDI note is in C4–B4. Notes outside that
  octave sound but do not highlight a key and do not get an extra pitch readout this phase.
- **D-16:** A sounding MIDI note counts as playing a note for lesson completion, same as the
  on-screen/computer keyboard — MIDI must go through the shared play-surface press/release path
  so `notePlayed` fires.
- **D-17:** MIDI is a third owner of a given note number alongside pointer and computer
  keyboard: if MIDI and an on-screen/computer key both hold C4, C4 stays down until every owner
  releases (existing `noteHoldCount` semantics). Last-note-wins still applies across *different*
  note numbers at the engine.
- **D-18:** Lesson completion persists across reload. `LessonProgress` is no longer session-only.
- **D-19:** Auto-save the last Playground patch (algorithm id + six operators + feedback) into a
  dedicated Playground slot and restore it when entering `/playground`. No named user patch
  library this phase. A/B snapshot slots stay session-only — do not serialize `SnapshotSlots`
  as-is (Phase 3 D-05).
- **D-20:** Remember the last selected MIDI device id. After Enable MIDI, reselect it if still
  present, otherwise fall back to first available (D-03). This does not auto-enable MIDI on boot
  (D-08).
- **D-21:** Persist a dedicated Playground patch slot, not whatever live `InstrumentState`
  currently holds. Lessons keep writing `startingPatch` into live `InstrumentState` as they do
  today, but that must not overwrite the saved Playground patch. Entering `/playground` restores
  the Playground slot even within a session, so a lesson just left does not stay on Playground.
  — **Reversibility:** costly — Playground restore-on-enter and lesson `startingPatch` sync both
  depend on this isolation; dropping it would make lessons destroy saved Playground sounds.
- **D-22:** Write the Playground slot on every Playground-originated patch change (today:
  ToolsPanel capture-recall is session-only A/B, but Randomize and Reset are Playground
  commands; any future Playground editor writes here too). Lesson-originated `InstrumentState`
  writes do not touch the slot.
- **D-23:** Settings has one Clear saved data control that wipes lesson progress, the Playground
  patch slot, and the last MIDI device id, then restores defaults.
- **D-24:** The persisted/exported document is versioned schema v1 containing: schema version,
  Playground patch, lesson progress, last MIDI device id. Never persist AudioNodes or transient
  note state. Domain validators already on `InstrumentPatch` / operator parameters / feedback /
  lesson ids police the boundary — do not hand-roll a weaker second check.
- **D-25:** Export downloads a `.json` file of the whole document. Import is a file picker.
  Import replaces the whole saved document after an explicit confirmation (backup/restore, not
  a merge). A successful import writes storage and updates live state immediately: lesson
  completion updates everywhere; if the user is on Playground the restored patch is applied;
  last MIDI device id is used on the next Enable MIDI.
- **D-26:** Corrupt data already in storage: reset that document to defaults, explain on
  Settings, app stays up. Corrupt import file: refuse the import, keep current live/saved
  state, explain what failed. Import failure is never destructive.
- **D-27:** This phase ships schema v1. Unknown or missing schema versions are malformed
  (refuse import / reset stored data). No migration table yet. Unknown extra JSON keys on a
  valid v1 document are ignored. — **Reversibility:** costly — exported v1 files become a
  published shape; changing required fields later needs a migration, not a silent rewrite.
- **D-28:** Only this app's versioned JSON. Dexed, SysEx, ROM dumps, and other synth formats
  are refused as malformed imports (licensing: no copyrighted banks).

### Claude's Discretion
- Exact MIDI status copy for each named state, and exact Settings section layout/grouping,
  within existing tokens, semantic HTML, and “not color-only” rules.
- Storage adapter implementation (`localStorage` vs IndexedDB) behind a DI seam in
  `src/app/core/persistence/` — payload is small; researcher/planner pick the adapter that
  matches existing browser-API DI (`MATCH_MEDIA`, `AudioContext` tokens) and is fakeable in
  Vitest.
- Exact JSON field names, filename, and confirmation-dialog copy for import-replace and clear.
- MIDI adapter DI token/`MidiAccessLike` surface — hand-rolled minimal fake, same posture as
  `AudioContextLike`, never `navigator.requestMIDIAccess` at module evaluation time.
- How “Playground-originated change” is detected (dedicated Playground-slot writer vs route
  awareness) — as long as D-21/D-22 hold: lessons never write the slot, entering Playground
  restores it.
- Whether velocity-0 note-on shares the exact `releaseKey` path or an equivalent MIDI-side
  helper, as long as D-14/D-16/D-17 hold.

### Deferred Ideas (OUT OF SCOPE)
None new — discussion stayed inside MIDI-01 / PERSIST-01. Explicitly out of scope (not
backlog-new, already later or rejected):

- MIDI CC, pitch bend, program change, clock, SysEx, Dexed/ROM import (D-11, D-28)
- Named user patch library (D-19)
- Persisting A/B slots (D-19)
- Polyphony / last-note hold stack (D-13)
- Six-operator editor / algorithm selector on Playground (existing `comingSoon`, not Phase 12)
- Accessibility/performance hardening (Phase 13, HARDEN-01)
- Auto-reconnect MIDI on boot (explicitly rejected, D-08)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERSIST-01 | Versioned local persistence with JSON import/export and malformed-data recovery | Versioned schema-v1 codec in `domain/` using existing `validateOperatorParameters` / `validateFeedbackLevel` / `isAlgorithmId` / `isLessonId`; `localStorage` adapter behind `STORAGE`; Playground slot isolated from `InstrumentState`; D-26 fail-closed decode |
| MIDI-01 | Progressive Web MIDI note on/off, velocity, device connect/disconnect | `REQUEST_MIDI_ACCESS` token + `MidiSession` root facade; Enable MIDI only from user click; omni note-on/off; velocity 1–127; velocity-0 as note-off; `PlaySurface.pressKey`/`releaseKey` ownership; usable when API absent |
</phase_requirements>

## Summary

Phase 12 adds two browser-API seams that must match the existing `MATCH_MEDIA` / `AUDIO_CONTEXT_CTOR` posture: a hand-rolled Web MIDI adapter that is never constructed at module evaluation, and a synchronous `localStorage` adapter for one small versioned JSON document. No new npm packages. MIDI is a third owner on the existing `PlaySurface` press/release path so lesson `notePlayed` still fires. Persistence is a dedicated Playground patch slot plus durable `LessonProgress` plus last MIDI device id — never `InstrumentState` itself and never A/B snapshots.

The planner should treat two implementation traps as blocking: (1) `enableAudio()` currently moves focus to the first key, which Enable MIDI must not do (D-10) even when that click also starts audio (D-06); (2) `WorkletSynthEngine.noteOn` rejects velocity `0` because `MIN_VELOCITY` is `1`, so MIDI note-on velocity 0 must be rewritten to `releaseKey` *before* the engine.

**Primary recommendation:** Ship a root `MidiSession` + `SavedDocument` pair of facades, a pure `parseSavedDocument` codec, a `localStorage` `STORAGE` token, a lazy `/settings` route, and PlaySurface MIDI ownership — zero new dependencies.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Web MIDI permission + port enumeration | Browser / Client | — | `requestMIDIAccess` is a secure-context Navigator API; no server |
| MIDI note on/off/velocity → engine | Browser / Client | — | Messages stay on the main thread; `PlaySurface` already owns note lifecycle |
| Versioned document codec | Browser / Client (domain layer) | — | Pure TypeScript in `src/app/domain/`; Angular-free by DOMAIN-04 |
| Durable storage | Browser / Client | — | Origin `localStorage`; no backend |
| JSON import/export files | Browser / Client | — | `Blob` download + `<input type="file">`; no upload server |
| `/settings` UI | Browser / Client | — | Lazy standalone route like About |
| Lesson progress durability | Browser / Client | — | `LessonProgress` facade writes through `SavedDocument` |
| Playground patch slot | Browser / Client | — | Isolated from live `InstrumentState` (D-21) |

This app has no API/SSR/database tier. Do not plan a backend, IndexedDB migration service, or Angular `HttpClient` for this phase.

## Project Constraints (from CLAUDE.md)

- Angular 22, standalone, zoneless, strict templates; signal inputs/outputs; `inject()`; `@if`/`@for`/`@switch`/`@defer`; lazy feature routes.
- `effect` only for imperative sync with an external system. Existing exception: `LessonDetail` `startingPatch` sync. Do not add effects to derive MIDI or persistence UI state.
- Domain (graph, frequency, envelope, patch, DSP, **and this phase's document codec**) has zero Angular imports (ESLint `src/app/domain/**/*.ts`).
- Browser APIs behind DI. Never create `AudioContext` at module eval. Resume/start audio only after user gesture. Never store `AudioNode`s in signals. Explicit cleanup for every listener/timer.
- Vitest mandatory. Mock browser boundaries, not pure domain logic. Hostile-payload matrices at storage/import boundaries.
- Semantic HTML, labelled controls, not color-only, keyboard + visible focus, reduced motion.
- No copyrighted patch ROMs, Dexed/SysEx banks, or commercial formats (D-28).
- Verify with `npm run build`, `npm test`, `npm run lint`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Angular | `^22.1.0` (in-repo `package.json`) | UI, DI, lazy routes, signals | Already the app |
| TypeScript | `~6.0.2` | Strict types | Already the app |
| Web MIDI API | browser platform | MIDI ports + messages | Locked by MIDI-01; not an npm package |
| Web Storage (`localStorage`) | browser platform | Durable JSON document | Matches sync DI + Vitest fakes; payload is tiny |
| File / Blob APIs | browser platform | Export download + import picker | Baseline; no File System Access API |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | `^4.0.8` | Unit tests | Existing `npm test` (`ng test`) |
| jsdom | `^28.0.0` | Test DOM | Has `localStorage`; **does not** implement `requestMIDIAccess` (probed this session: `typeof navigator.requestMIDIAccess === 'undefined'`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `MidiAccessLike` | `webmidi` npm / Jazz-Plugin shim | Rejected: locked discretion is a hand-rolled fake like `AudioContextLike`; shims need a native plugin; licensing/fingerprint risk |
| `localStorage` | IndexedDB | IndexedDB is async, overkill for one document, worse constructor-hydration fit than `MATCH_MEDIA` |
| Domain validators | zod / JSON Schema | Extra package; DOMAIN-04; D-24 forbids a weaker second check |
| `<input type="file">` | `showOpenFilePicker()` | Limited availability; not Baseline |
| Native `window.confirm` | Custom `<dialog>` component | Dialog is nicer copy/layout; `confirm` is blocking, labelled, and zero new UI chrome. **Use `window.confirm`.** |

**Installation:** none. Do not add `@types/webmidi`, `webmidi`, or a storage library.

**Version verification:** Angular/Vitest versions read from in-repo `package.json` this session. Web MIDI / Web Storage are platform APIs, not registry packages. TypeScript 6.0's `lib.dom.d.ts` in this repo contains **no** `MIDIAccess` / `requestMIDIAccess` types (repo grep of `node_modules/typescript/lib`). That is why `MidiAccessLike` is mandatory, matching `AudioContextLike`.

## Package Legitimacy Audit

> No external packages are installed this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | None to install |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
[Enable MIDI click on PlaySurface or Settings]
        |
        v
 REQUEST_MIDI_ACCESS token  --null-->  status: unsupported
        | (user gesture only; never at boot)
        v
 navigator.requestMIDIAccess({ sysex: false })
        |-- reject NotAllowedError --> status: permission-denied
        |-- reject NotSupportedError --> status: unsupported
        |-- resolve MIDIAccess
                |
                +-- onstatechange --> refresh port list; D-04 reattach-or-stay-disconnected
                |
                +-- select port: saved id if present else first inputs.values()
                |
                +-- empty inputs --> status: no-devices
                +-- selected missing --> status: disconnected
                +-- selected present --> status: ready; onmidimessage on THAT port only
                        |
                        v
              MidiSession (root, signals)
                        |
                        v
              PlaySurface (mounted on /playground and /learn/:id only)
                 pressKey(note, velocity) / releaseKey(note)
                 noteHoldCount (pointer | keyboard | MIDI)
                 notePlayed --> LessonDetail completion
                        |
                        v
              SYNTH_ENGINE.noteOn / noteOff / allNotesOff

[Playground Randomize/Reset] --> PlaygroundPatchSlot.write(patch) --> SavedDocument.encode --> STORAGE.setItem
[/playground activate]       --> PlaygroundPatchSlot.read --> InstrumentState atomic replace
[LessonDetail startingPatch] --> InstrumentState only (does NOT write slot)
[LessonProgress.markComplete] --> SavedDocument
[Settings Import] --confirm--> parseSavedDocument --> STORAGE + hydrate live (D-25)
[Settings Export] --> Blob + <a download>
[Corrupt STORAGE] --> defaults + Settings explanation (D-26)
```

### Recommended Project Structure

```
src/app/
├── app.routes.ts                          # add lazy /settings
├── app.html                               # primary-nav Settings link (D-02)
├── core/
│   ├── browser/
│   │   └── midi-access.token.ts           # REQUEST_MIDI_ACCESS + MidiAccessLike
│   ├── midi/
│   │   ├── midi-session.ts                # root facade: status, ports, enable/disable, select
│   │   ├── midi-message.ts                # pure note-on/off parse (or live in domain/)
│   │   └── testing/fake-midi-access.ts
│   └── persistence/
│       ├── storage.token.ts               # STORAGE: StorageLike
│       └── testing/fake-storage.ts
├── domain/dx7/
│   └── persistence/
│       ├── saved-document.ts              # types, STORAGE key, filename, schemaVersion=1
│       └── parse-saved-document.ts        # never-throw codec
├── state/
│   ├── saved-document-store.ts            # hydrate/write/clear/import/export orchestration
│   ├── playground-patch-slot.ts           # D-21/D-22 writer; Playground + ToolsPanel call this
│   └── lesson-progress.ts                 # add hydrate/replace + persist on markComplete
└── features/
    ├── play-surface/                      # Enable MIDI toggle, short status, MIDI ownership
    ├── playground/                        # restore slot on enter; ToolsPanel writes slot
    └── settings/                          # new lazy feature
        ├── settings.ts
        ├── settings.html
        └── settings.scss
```

Put `parseMidiChannelVoiceMessage` in `src/app/domain/dx7/midi/` **or** `core/midi/midi-message.ts`. Prefer **domain** so Vitest covers it with zero Angular — it has no browser types.

### Pattern 1: Browser-API InjectionToken (mirror `AUDIO_CONTEXT_CTOR`)

**What:** Factory returns a constructor/function or `null`; never constructs the real API at eval time.
**When to use:** Every new browser global (`requestMIDIAccess`, `localStorage`).

`AUDIO_CONTEXT_CTOR` already documents the rule:

```72:92:src/app/core/audio/audio-context.token.ts
/** A *constructor*, never an instance — nothing here is ever constructed at
 * module/DI-factory time (`05-RESEARCH.md` Pitfall 3, CLAUDE.md's "never
 * construct an AudioContext at module evaluation time"). */
export type AudioContextConstructorLike = new () => AudioContextLike;

/**
 * Feature-detects the browser's `AudioContext` (and the legacy
 * `webkitAudioContext` name) without ever constructing one. The narrowing
 * cast here is confined to this one factory — no other file in the app may
 * reference a Web Audio global directly.
 */
function resolveAudioContextConstructor(): AudioContextConstructorLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
```

MIDI token shape (planner must use these names):

```typescript
export const REQUEST_MIDI_ACCESS = new InjectionToken<RequestMidiAccessLike | null>(
  'REQUEST_MIDI_ACCESS',
  {
    providedIn: 'root',
    factory: (): RequestMidiAccessLike | null => {
      if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
        return null;
      }
      return (options) => navigator.requestMIDIAccess(options);
    },
  },
);
```

The factory may *read* `typeof navigator.requestMIDIAccess` (feature detect, D-05 `unsupported`). It must **not** *call* it. Tests provide a fake function, never `navigator`.

### Pattern 2: Fail-closed decode (mirror `parseWorkletMessage`)

**What:** `unknown` in, typed document or `null` out, never throw — wrap the body in `try/catch` including hostile getters.
**When to use:** `localStorage.getItem` payload and imported file text.

```typescript
export function parseSavedDocument(data: unknown): SavedDocument | null {
  try {
    // schemaVersion === 1, then playgroundPatch / completedLessonIds / lastMidiDeviceId
    return document;
  } catch {
    return null;
  }
}
```

### Pattern 3: Playground slot writer (not `InstrumentState`)

**What:** A small root facade `PlaygroundPatchSlot` with `read(): InstrumentPatch` and `write(patch: InstrumentPatch): void`. `InstrumentState` stays storage-free (Phase 3 D-05).
**When to use:** ToolsPanel `randomizePatch` / `resetPatch`; Playground constructor restore; Settings import/clear.

Do **not** subscribe to `instrumentState.patch()` globally — that would persist lesson `startingPatch`. Detect Playground origin by **call site**: only ToolsPanel Randomize/Reset (and a future editor) call `PlaygroundPatchSlot.write`. Capture/Recall A/B do not (D-19).

`Playground` constructor (or an `afterNextRender` once) applies `slot.read()` into `InstrumentState` via a new atomic `replacePatch(patch)` that validates then one `_patch.set`. Do not add `effect()` on the route.

### Anti-Patterns to Avoid

- **`requestMIDIAccess` in a token factory or `APP_INITIALIZER`:** violates D-08 and the permission prompt.
- **Attach `onmidimessage` to every input:** MDN samples do this; D-03/D-04 require the *selected* port only.
- **`InstrumentState` reading `localStorage`:** Phase 3 D-05; lessons would clobber the Playground slot.
- **`localStorage.clear()`:** wipes the whole origin. Use `removeItem(PERSISTENCE_STORAGE_KEY)` only.
- **`JSON.parse` without try/catch:** throws into the UI; D-26 requires the app to stay up.
- **Passing MIDI velocity `0` into `engine.noteOn`:** throws `RangeError` (`MIN_VELOCITY` is `1`).
- **Calling `enableAudio()` unchanged from Enable MIDI:** it focuses the first `.key` (D-10 forbids that).
- **Installing Web MIDI types/packages:** TypeScript 6 DOM lib has no MIDI interfaces here; hand-roll `MidiAccessLike`.
- **Jazz-Plugin / WebMIDIAPIShim:** native plugin, not progressive enhancement.
- **Serializing `SnapshotSlots`:** D-19 / Phase 3 D-05.
- **`NgZone.run`:** the app is zoneless (`provideZonelessChangeDetection()` in `src/app/app.config.ts`). Update signals; that is the CD trigger, same as `MotionPreference`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Patch/operator validation | Second JSON schema | `validateOperatorParameters`, `validateFeedbackLevel`, `isAlgorithmId`, `isLessonId`, exact six `OPERATOR_IDS` keys | D-24; Phase 8 already closed the seventh-key gap |
| Storage availability | Ad-hoc `!!window.localStorage` | MDN `storageAvailable` try/catch `setItem` | Safari private mode exposes a quota-zero `Storage` that still throws |
| File download | Server or File System Access API | `Blob` + `URL.createObjectURL` + `<a download>` + `revokeObjectURL` | Baseline; `download` works for `blob:` URLs |
| File import | `showOpenFilePicker` | Labelled `<input type="file" accept=".json,application/json">` + `file.text()` | `accept` is a hint; codec is the real gate |
| Confirm import/clear | Modal library | `window.confirm` | Blocking explicit confirm (D-25/D-23); no new chrome |
| MIDI stack | `webmidi` npm | 20-line status-nibble parser + `MidiAccessLike` | Locked; jsdom has no MIDI |

**Key insight:** The expensive parts (validation, note lifecycle, last-note-wins) already exist. This phase is adapters + a codec + wiring.

## Common Pitfalls

### Pitfall 1: Enable MIDI steals focus
**What goes wrong:** Enable MIDI also starts audio (D-06) by reusing `enableAudio()`, which focuses the first key after success.
**Why it happens:** `PlaySurface.enableAudio` currently does:

```148:151:src/app/features/play-surface/play-surface.ts
    if (this.isReady()) {
      this.changeDetector.detectChanges();
      const firstKey = this.host.nativeElement.querySelector('.key') as HTMLButtonElement | null;
      firstKey?.focus();
```

**How to avoid:** Split `initializeAudio()` (no focus) from `enableAudio()` (gesture + focus). Enable MIDI calls `initializeAudio()` only. Spec: after Enable MIDI, `document.activeElement` stays the Enable MIDI button (D-10).
**Warning signs:** Keyboard users land on C4 after enabling MIDI from Settings or PlaySurface.

### Pitfall 2: Velocity-0 note-on throws in the engine
**What goes wrong:** MIDI spec note-on velocity 0 is note-off (D-14). `validateVelocity` requires `MIN_VELOCITY` (`1`) .. `MAX_VELOCITY` (`127`):

```26:35:src/app/domain/dx7/audio/value-conversion.ts
export const MIN_MIDI_NOTE = 0;
export const MAX_MIDI_NOTE = 127;
// ...
export const MIN_VELOCITY = 1;
export const MAX_VELOCITY = 127;
```

```77:82:src/app/core/audio/worklet-synth-engine.ts
function validateVelocity(velocity: number): void {
  if (!Number.isInteger(velocity) || velocity < MIN_VELOCITY || velocity > MAX_VELOCITY) {
    throw new RangeError(
      `velocity must be an integer in ${MIN_VELOCITY}..${MAX_VELOCITY}, received ${velocity}`,
```

**How to avoid:** In the MIDI message handler, `(status & 0xf0) === 0x90 && velocity === 0` must call the release path, never `pressKey`/`noteOn`. Do not widen `MIN_VELOCITY`.
**Warning signs:** Uncaught `RangeError` when a controller uses running-status note-offs.

### Pitfall 3: `pressKey` hard-codes velocity 100
**What goes wrong:** Pointer/computer keys must stay at `PLAYABLE_VELOCITY`; MIDI must pass 1–127.

```15:18:src/app/features/play-surface/play-surface.ts
/** D-07/AUDIO-02: a fixed nominal velocity for both input surfaces — this
 * phase has no velocity-sensitive input (pointer pressure, MIDI velocity),
 * so every note-on uses the same mid-range value. */
const PLAYABLE_VELOCITY = 100;
```

**How to avoid:** `pressKey(note: number, velocity: number = PLAYABLE_VELOCITY)`. MIDI calls `pressKey(note, midiVelocity)`. Pointer/keyboard omit the second arg. `notePlayed` still emits.
**Warning signs:** All MIDI notes sound the same regardless of key velocity.

### Pitfall 4: JSON operator keys become strings
**What goes wrong:** `JSON.stringify` turns numeric `OperatorId` keys `1`–`6` into `"1"`–`"6"`. A naive cast after `JSON.parse` yields a record that fails `isOperatorId` / exact-six-key checks depending on how keys are read.
**How to avoid:** Codec rebuilds `OperatorParameterSet` by iterating `OPERATOR_IDS` and reading `raw[String(id)]`. Same pattern as `isOperatorParameterSetLike` which uses `value[String(id)]` (`worklet-messages.ts`).
**Warning signs:** Valid exports fail to re-import; or extra string keys slip through.

### Pitfall 5: Lesson `startingPatch` overwrites the Playground slot
**What goes wrong:** A global `effect` on `InstrumentState.patch()` persists every lesson apply.

```181:194:src/app/features/learn/lesson-detail/lesson-detail.ts
  constructor() {
    effect(() => {
      const lesson = this.lesson();
      if (lesson === null) {
        return;
      }
      if (this.lastAppliedLessonId === lesson.id) {
        return;
      }
      this.lastAppliedLessonId = lesson.id;
      untracked(() => {
        this.applyStartingPatch(lesson);
      });
    });
  }
```

**How to avoid:** Only `PlaygroundPatchSlot.write` from Playground-originated commands. Entering `/playground` restores the slot into live state (D-21).
**Warning signs:** Opening Algorithm 32's lesson then returning to Playground plays the lesson preset.

### Pitfall 6: `localStorage` throws
**What goes wrong:** Feature-detecting the property is not enough. Private mode / blocked cookies / `file:` origins throw `SecurityError` or `QuotaExceededError` on `setItem`.
**How to avoid:** Token factory returns a no-op `StorageLike` when MDN `storageAvailable('localStorage')` is false. Every `setItem` in the real adapter is still try/catch: quota failure keeps live state, explains on Settings (same posture as failed import — non-destructive).
**Warning signs:** App crash on first `markComplete` in Safari private windows.

### Pitfall 7: Import is destructive on failure
**What goes wrong:** Decode runs after `removeItem` or after live hydrate.
**How to avoid:** `parseSavedDocument` first; only on success write storage and hydrate (D-26). Size-cap the file before `text()`/`JSON.parse` (recommend `262144` bytes — [ASSUMED] DoS guard, not a locked product number).
**Warning signs:** A Dexed `.syx` wipe of lesson progress.

### Pitfall 8: Stuck MIDI notes
**What goes wrong:** Disable, disconnect, route change, or `PlaySurface` destroy while a MIDI key is down.
**How to avoid:** D-09: disable and selected-device disconnect call `engine.allNotesOff()` and clear MIDI entries in `noteHoldCount` / a `midiHeldNotes` set. Remove `onmidimessage` / `onstatechange` on disable and `DestroyRef` (W3C: leaving those handlers attached prevents GC).
**Warning signs:** Drone after unplugging the keyboard.

### Pitfall 9: Pre-enable vs D-05 five states
**What goes wrong:** D-08 forbids probing ports on boot, so the session cannot honestly be `no-devices` until after Enable MIDI.
**How to avoid:** Internal union includes `'off'` (user has not enabled). Map `'unsupported'` without calling the API (`REQUEST_MIDI_ACCESS === null`). The five D-05 names are for post-attempt and Settings copy. PlaySurface short status while `'off'`: “MIDI is off.”
**Warning signs:** Settings claims “no devices” before the user has clicked Enable MIDI.

### Pitfall 10: Shell nav spec still expects four links
**What goes wrong:** `app.spec.ts` asserts `['Learn', 'Algorithms', 'Playground', 'About']`.
**How to avoid:** Update that spec when adding Settings. Place Settings after Playground, before About (Claude's discretion: this order). Do not put a MIDI indicator in the footer (D-05).

## Code Examples

Verified patterns from this repo and official APIs:

### MIDI enable (W3C + D-08/D-11)

DATA_K7m2pQ9x_START
requestMIDIAccess() is `[SecureContext] Promise<MIDIAccess>`. Failure `.name` should be `"NotAllowedError"` if denied, `"NotSupportedError"` otherwise (also `"AbortError"`, `"InvalidStateError"`). `MIDIOptions.sysex` default is not requested. `MIDIAccess.inputs` is `readonly maplike<DOMString, MIDIInput>`. `MIDIPort.id` SHOULD be maintained across reboots so apps can cache ids. Setting `MIDIInput.onmidimessage` implicitly opens the port. `midimessage.data` is a `Uint8Array` of one complete MIDI message. Remove `onstatechange` / `onmidimessage` to allow GC.
DATA_K7m2pQ9x_END

Source: [W3C Web MIDI API](https://webaudio.github.io/web-midi-api/)

```typescript
async enableMidi(): Promise<void> {
  const request = this.requestMidiAccess; // injected; null => unsupported
  if (request === null) {
    this._status.set('unsupported');
    return;
  }
  try {
    const access = await request({ sysex: false });
    this.attachAccess(access);
    this.selectPort(this.savedDeviceId() ?? firstInputId(access));
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    this._status.set(name === 'NotAllowedError' ? 'permission-denied' : 'unsupported');
  }
}
```

Do **not** call `navigator.permissions.query({ name: 'midi' })` on boot (D-08 spirit; extra fingerprint). Permission is the Enable MIDI click.

### MIDI message parse (omni, D-07/D-11/D-14)

DATA_P9j3sF2q_START
MIDI 1.0: a note may be turned off by Note-Off (`8n`) or by Note-On (`9n`) with velocity zero. A receiver must recognize either method. Note-on status `0x90`–`0x9F` (channel in the low nibble). Velocity 0 note-on is note-off.
DATA_P9j3sF2q_END

Source: MIDI 1.0 Detailed Specification (quoted via midi.org community + teragonaudio note-on reference); product D-14.

```typescript
export type ParsedMidiNote =
  | { readonly kind: 'on'; readonly note: number; readonly velocity: number }
  | { readonly kind: 'off'; readonly note: number };

export function parseMidiNoteMessage(data: Uint8Array | null): ParsedMidiNote | null {
  if (data === null || data.length < 3) {
    return null;
  }
  const status = data[0]!;
  const high = status & 0xf0;
  const note = data[1]!;
  const velocity = data[2]!;
  if (note < MIN_MIDI_NOTE || note > MAX_MIDI_NOTE) {
    return null;
  }
  if (high === 0x90) {
    if (velocity === 0) {
      return { kind: 'off', note };
    }
    if (velocity < MIN_VELOCITY || velocity > MAX_VELOCITY) {
      return null;
    }
    return { kind: 'on', note, velocity };
  }
  if (high === 0x80) {
    return { kind: 'off', note }; // ignore note-off velocity (D-14)
  }
  return null; // CC, pitch bend, clock, SysEx, etc. (D-11)
}
```

Use `MIN_MIDI_NOTE` / `MAX_MIDI_NOTE` / `MIN_VELOCITY` / `MAX_VELOCITY` from `value-conversion.ts` — do not relitigate `0`/`127`/`1`/`127`.

On-screen highlight range is independent:

```8:9:src/app/features/play-surface/keyboard-note-map.ts
export const LOWEST_PLAYABLE_NOTE = 60;
export const HIGHEST_PLAYABLE_NOTE = 71;
```

`heldNotes` may contain notes outside 60–71; the template only iterates `PLAYABLE_KEYS`, so D-15 falls out of existing markup (`[class.key--pressed]="heldNotes().has(key.note)"`).

### Schema v1 document (discretion — use these names)

```typescript
export const PERSISTENCE_SCHEMA_VERSION = 1;
export const PERSISTENCE_STORAGE_KEY = 'dx7-algorithm-lab.saved-document';
export const EXPORT_FILENAME = 'dx7-algorithm-lab-backup.json';

export interface SavedDocument {
  readonly schemaVersion: 1;
  readonly playgroundPatch: InstrumentPatch;
  readonly completedLessonIds: readonly LessonId[];
  readonly lastMidiDeviceId: string | null;
}

export function defaultSavedDocument(): SavedDocument {
  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    playgroundPatch: DEFAULT_PATCH,
    completedLessonIds: [],
    lastMidiDeviceId: null,
  };
}
```

`parseSavedDocument` rules:

- `JSON.parse` in try/catch; non-object / array → `null`.
- `schemaVersion` must be the number `1` (D-27: missing/unknown = malformed).
- Ignore unknown extra keys (D-27).
- `playgroundPatch`: `isAlgorithmId(algorithmId)` (`MIN_ALGORITHM_ID` `1` .. `MAX_ALGORITHM_ID` `32`); exact six operator keys via `OPERATOR_IDS` (`1 | 2 | 3 | 4 | 5 | 6`); each operator through `validateOperatorParameters` in try/catch; `validateFeedbackLevel` in try/catch. Rebuild numeric keys.
- `completedLessonIds`: must be an array; keep only `isLessonId` strings; drop unknown slugs (forward-compatible) rather than failing the whole document.
- `lastMidiDeviceId`: `string` or `null`; empty string → `null`; other types → `null` document.
- Envelope arrays of length `ENVELOPE_SEGMENT_COUNT` (`4`) already pass `validateDx7Envelope`.
- `isOperatorParameterSetLike` in `worklet-messages.ts` is **not exported**. Do not import from DSP into persistence. Duplicate the exact-six-key rule using `OPERATOR_IDS.length` + `OPERATOR_IDS.every` + `validateOperatorParameters`, or extract a shared exported helper into `patch.ts` and switch the worklet parser over (nice-to-have, not required if the persistence check is not weaker).

### Storage adapter

DATA_H5t1vB6d_START
MDN: always use `getItem`/`setItem`/`removeItem`, not property access. Values are strings; use `JSON.stringify`/`JSON.parse`. Feature-detect with try/catch `setItem`. Private browsing may expose quota-zero storage. `SecurityError` on `file:` / blocked cookies. `localStorage.clear()` empties the entire origin.
DATA_H5t1vB6d_END

Source: [MDN Using the Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API), [MDN Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

```typescript
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE = new InjectionToken<StorageLike>('STORAGE', {
  providedIn: 'root',
  factory: (): StorageLike => {
    try {
      const storage = window.localStorage;
      const probe = '__dx7_storage_probe__';
      storage.setItem(probe, probe);
      storage.removeItem(probe);
      return storage;
    } catch {
      return {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      };
    }
  },
});
```

On boot, `SavedDocumentStore` reads `STORAGE.getItem(PERSISTENCE_STORAGE_KEY)`: missing → defaults; present but `parseSavedDocument` fails → write defaults, set `recoveryMessage` for Settings (D-26). Do not throw.

### Export / import

```typescript
export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
```

Import: labelled `<input type="file" accept=".json,application/json">`. MDN: `accept` is a hint, not validation. After confirm (`window.confirm`), `file.size` check, `await file.text()`, `JSON.parse` + `parseSavedDocument`. Failure: keep live+saved, set import error copy (D-26). Success: `STORAGE.setItem`, hydrate `LessonProgress`, write Playground slot, apply patch only if current url is `/playground` (D-25).

Clear: confirm, `removeItem`, hydrate `defaultSavedDocument()`, if on Playground `replacePatch(DEFAULT_PATCH)`, MIDI saved id cleared (does not auto-disable a live session — planner: disable MIDI as part of clear to avoid a stale device id).

### `/settings` route

Mirror About's lazy `loadComponent` in `app.routes.ts`. Title: `'Settings — DX7 Algorithm Lab'`. Primary nav in `app.html` after Playground. Settings sections (discretion): (1) MIDI — enable/disable, status explanation, named `<select>` of ports with disconnected marker; (2) Saved data — export, import, clear, recovery/import error live region. Semantic `<section>` + headings. Status text carries the state; do not color-only.

### MIDI ownership on PlaySurface

Keep a `midiHeldNotes = new Set<number>()`. On parsed `on`: if set has note, do not increment `noteHoldCount` again; still `pressKey` to retrigger (last-note-wins). Else `pressKey(note, velocity)` and add. On `off`: if set has note, delete and `releaseKey`. Engine stale-release (note !== `heldNote`) already implements D-13 for *different* notes.

`PlaySurface` injects `MidiSession` and registers a message callback in the constructor; unregisters on `DestroyRef`. When PlaySurface is unmounted (user on Settings/About), MIDI notes do not sound — D-01: “anywhere `PlaySurface` can play.” `MidiSession` still owns ports; disable/disconnect still `allNotesOff` via injected `SYNTH_ENGINE` so a held key cannot stick if the user disables from Settings while a note was started on Playground.

Same click as D-06: if `engine.status() !== 'ready'`, `await engine.initialize()` without focusing keys.

### `LessonProgress` durability

Today:

```12:14:src/app/state/lesson-progress.ts
 * Completion is a one-way ratchet within a session (06-01-PLAN.md
 * `<phase_decisions>`, RESEARCH.md Open Question 2): `markComplete` only
 * ever adds to the set, never removes. Resets on reload — no persistence
 * this phase (PERSIST-01 is Phase 12's job).
```

Add `replaceCompleted(ids: ReadonlySet<LessonId>): void` for hydrate/import/clear (validate each id with `isLessonId`). `markComplete` after its immutable set-write calls `SavedDocumentStore.persistLessonProgress`. One-way ratchet stays; clear/import are explicit replace.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Session-only `LessonProgress` | Durable `SavedDocument` | Phase 12 | D-18 |
| In-memory A/B only | Still in-memory; Playground slot is a *separate* persisted document field | Phase 3 D-05 vs 12 D-19 | Do not serialize `SnapshotSlots` |
| Pointer + computer keyboard only | + MIDI third owner | Phase 12 | `pressKey` velocity param |
| TypeScript DOM MIDI types | Absent in TS 6.0 lib here | n/a | Must hand-roll `MidiAccessLike` |
| Web MIDI Baseline | **Not Baseline** (MDN “Limited availability”) | ongoing | Feature-detect; app fully usable without MIDI |

**Deprecated/outdated:**

- Jazz-Plugin Web MIDI shim: requires a native plugin; not progressive.
- `showOpenFilePicker` as the only import path: limited availability.
- Direct `localStorage.key = value` property access: MDN warns of prototype collisions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Import file size cap of `262144` bytes is sufficient and acceptable | Pitfall 7 | Too small: large-but-valid pretty-printed exports refused. Too large: `JSON.parse` hitch. Planner may pick another cap; codec still fail-closes. |
| A2 | `window.confirm` is acceptable for import-replace and clear | Standard Stack | If a11y review in Phase 13 wants a custom dialog, swap later; behavior (blocking confirm) stays. |
| A3 | Dropping unknown `completedLessonIds` slugs (instead of failing the document) is the right v1 forward-compat | Schema | A typo silently drops one lesson's completion. Alternative: fail the document. Recommend drop. |
| A4 | Specific Chrome/Firefox/Safari version matrix | Environment | MDN tables did not render in fetch; feature-detect is the product requirement. Do not write browser names into UI copy beyond “this browser”. |
| A5 | `Playground` constructor restore is enough (no `router.events` subscription) | Pattern 3 | If Angular ever reused the Playground component instance across navigations, restore would not re-run. Current `loadComponent` creates a new instance per navigation (same pattern as other features). If reuse is observed, restore in a route `effect` analogue — still not an `InstrumentState` effect. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

The table is not empty — A1–A5 are discretion-level, not blockers.

## Open Questions (RESOLVED)

1. **Extract `isOperatorParameterSetLike` to `patch.ts`?** RESOLVED
   - What we know: it is a private function in `worklet-messages.ts` and requires exact six keys.
   - What's unclear: whether touching Phase 8 DSP parse is in scope.
   - Recommendation: persistence codec independently applies `OPERATOR_IDS.length === Object.keys(...).length` plus `validateOperatorParameters`. Optional follow-up extract; do not import DSP into persistence.
   - Resolution: Plans follow the recommendation. 12-01 `parseSavedDocument` duplicates the exact-six-key rule locally and does not import DSP helpers.

2. **Does Disable MIDI close `MIDIAccess` or only detach handlers?** RESOLVED
   - What we know: W3C `MIDIPort.close()` stops `midimessage`; `requestMIDIAccess` may be called again.
   - Recommendation: remove handlers, `allNotesOff`, set status `'off'`, keep `MIDIAccess` for fast re-enable without a second prompt. Re-select using saved id. Do not call `requestMIDIAccess` again unless access was never obtained.
   - Resolution: Plans follow the recommendation. 12-02 `MidiSession.disable` detaches handlers, calls `allNotesOff`, keeps the access object; a later `enable()` does not increment the request-function call count.

3. **Clear saved data while a lesson is open?** RESOLVED
   - What we know: D-23 restores defaults for *saved* data; lesson `startingPatch` effect owns live patch on that route.
   - Recommendation: clear storage + empty progress + default Playground slot; do not smash a live lesson patch; if url is `/playground`, `replacePatch(DEFAULT_PATCH)`.
   - Resolution: Plans follow the recommendation. 12-04 Clear applies `replacePatch(DEFAULT_PATCH)` only when the URL is `/playground`; a lesson route keeps the live `startingPatch`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test | ✓ | v22.22.3 | — |
| npm | scripts | ✓ | 10.9.8 | — |
| `localStorage` in jsdom | persistence unit tests | ✓ | jsdom 28 (in-repo) | Fake `STORAGE` token |
| `navigator.requestMIDIAccess` in jsdom | MIDI unit tests | ✗ | undefined (probed) | Mandatory `REQUEST_MIDI_ACCESS` fake |
| Physical MIDI device | real-browser UAT | unknown | — | Unit tests with fake ports; optional human checkpoint |
| HTTPS / secure context | Web MIDI in real browsers | ✓ for `ng serve` localhost | — | `unsupported` / `permission-denied` states |
| TypeScript DOM MIDI types | compile | ✗ | TS ~6.0.2 lib.dom has none | `MidiAccessLike` |
| ctx7 CLI / Context7 MCP | docs lookup | ✗ | — | Official W3C/MDN fetched directly |

**Missing dependencies with no fallback:** none for implementation. Physical MIDI hardware is optional for automated tests.

**Missing dependencies with fallback:** jsdom MIDI (fake token); TS MIDI types (hand-rolled interfaces).

Step 2.6 note: no extra CLIs to install.

## Validation Architecture

`.planning/config.json` does not set `workflow.nyquist_validation` to false — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.8` via `@angular/build:unit-test` |
| Config file | `angular.json` `test` builder; `tsconfig.spec.json` `types: ["vitest/globals"]` |
| Quick run command | `npm test` |
| Full suite command | `npm test` (then `npm run build` && `npm run lint` at phase gate) |
| Focused file | `ng test --include=src/app/domain/dx7/persistence/parse-saved-document.spec.ts --watch=false` (pattern already used by `test:worklet-bundle`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MIDI-01 | Unsupported when token is `null` | unit | `ng test --include=src/app/core/midi/midi-session.spec.ts --watch=false` | ❌ Wave 0 |
| MIDI-01 | Enable from click; `requestMIDIAccess` not called in factory | unit | same | ❌ Wave 0 |
| MIDI-01 | `NotAllowedError` → permission-denied | unit | same | ❌ Wave 0 |
| MIDI-01 | First input in `inputs.values()` order auto-selected | unit | same | ❌ Wave 0 |
| MIDI-01 | Disconnect selected → disconnected; other device ignored; same id returns → ready | unit | same | ❌ Wave 0 |
| MIDI-01 | Note-on 0x90 vel 1–127 → `pressKey`; vel 0 and 0x80 → `releaseKey`; CC ignored | unit | `ng test --include=src/app/domain/dx7/midi/parse-midi-note-message.spec.ts --watch=false` | ❌ Wave 0 |
| MIDI-01 | MIDI note emits `notePlayed`; MIDI+pointer share `noteHoldCount` | unit | `ng test --include=src/app/features/play-surface/play-surface.spec.ts --watch=false` | ❌ extend existing |
| MIDI-01 | Enable MIDI does not move focus; starts audio if needed | unit | play-surface.spec.ts | ❌ extend existing |
| MIDI-01 | Disable / disconnect → `allNotesOff` | unit | midi-session + play-surface | ❌ Wave 0 |
| PERSIST-01 | Round-trip encode/decode v1 document | unit | parse-saved-document.spec.ts | ❌ Wave 0 |
| PERSIST-01 | Hostile matrix: non-JSON, wrong version, seventh operator, Dexed-like, throwing getters | unit | same | ❌ Wave 0 |
| PERSIST-01 | Corrupt STORAGE hydrates defaults without throw | unit | saved-document-store.spec.ts | ❌ Wave 0 |
| PERSIST-01 | Failed import leaves prior document | unit | same | ❌ Wave 0 |
| PERSIST-01 | Lesson complete survives simulated reload (new TestBed + same FakeStorage) | unit | lesson-progress.spec.ts | ❌ extend existing |
| PERSIST-01 | Playground randomize writes slot; lesson startingPatch does not | unit | playground-patch-slot.spec.ts + lesson-detail.spec.ts | ❌ Wave 0 |
| PERSIST-01 | Entering Playground restores slot after a lesson | unit | playground.spec.ts | ❌ extend existing |
| D-02 | `/settings` lazy route + five primary nav labels | unit | app.spec.ts | ❌ extend existing |

### Sampling Rate

- **Per task commit:** `npm test` (and focused `--include` during TDD)
- **Per wave merge:** `npm test` && `npm run build` && `npm run lint`
- **Phase gate:** Full suite green before `/gsd-verify-work`

Optional later: a blocking human-verify with a real MIDI keyboard is **not** required for MIDI-01 if fakes cover the state machine; ROADMAP success criterion 1 is device-present behavior. Planner may add a non-blocking UAT checklist, not a Wave-0 blocker.

### Wave 0 Gaps

- [ ] `src/app/domain/dx7/midi/parse-midi-note-message.spec.ts` — MIDI-01 parse matrix (on/off/vel0/CC/short/out-of-range)
- [ ] `src/app/domain/dx7/persistence/parse-saved-document.spec.ts` — PERSIST-01 codec + hostile payloads (mirror `worklet-messages.spec.ts` T-08-01)
- [ ] `src/app/core/midi/testing/fake-midi-access.ts` — maplike inputs, `onstatechange`, per-port `onmidimessage`
- [ ] `src/app/core/persistence/testing/fake-storage.ts` — in-memory `StorageLike`; optional throwing `setItem`
- [ ] `src/app/core/midi/midi-session.spec.ts` — status machine, selection, D-04
- [ ] `src/app/state/saved-document-store.spec.ts` — hydrate/import/export/clear/recovery
- [ ] `src/app/state/playground-patch-slot.spec.ts` — D-21/D-22 isolation
- [ ] `src/app/features/settings/settings.spec.ts` — labelled controls, confirm gates
- [ ] Extend `play-surface.spec.ts`, `lesson-progress.spec.ts`, `playground.spec.ts`, `app.spec.ts`, `tools-panel.spec.ts`
- [ ] Framework install: none

Hostile-payload rows to copy from Phase 8/9: throwing getters, seventh operator key, non-object, array root, missing `schemaVersion`, `schemaVersion: 2`, SysEx/Dexed binary-as-text, `__proto__` key, extra unknown keys on an otherwise valid v1 (must succeed).

## Security Domain

`security_enforcement` is not set to false.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single-user origin storage |
| V5 Input Validation | yes | `parseSavedDocument` + domain validators; MIDI bytes range-checked; file size cap |
| V6 Cryptography | no | No secrets; do not encrypt localStorage |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed JSON / hostile getters crash the app | Denial of service | never-throw codec (`parseWorkletMessage` posture) |
| Prototype pollution via `__proto__` / `constructor` keys | Tampering | Read only known fields; rebuild records; `isPlainObject` rejects arrays; never `Object.assign` onto prototypes |
| Dexed/ROM/SysEx import (licensing + unexpected shape) | Tampering | D-28: missing `schemaVersion: 1` → refuse; no SysEx request |
| XSS via imported strings in UI | Tampering | Text interpolation only; never `innerHTML` of file contents |
| MIDI SysEx as device dump / fingerprint | Information disclosure | `requestMIDIAccess({ sysex: false })`; ignore status `>= 0xf0` |
| Silent MIDI trap (notes with audio off) | Denial of service (UX) | D-06: Enable MIDI starts audio on the same gesture |
| `localStorage.clear()` wiping unrelated origin data | Tampering | `removeItem` of one key |
| Quota / private-mode throw | Denial of service | no-op `STORAGE` + catch on write |
| Permissions-Policy `midi` default `'self'` | Information disclosure | Do not embed the app in a third-party iframe that expects MIDI this phase |

## Sources

### Primary (HIGH confidence)

- In-repo: `play-surface.ts`, `keyboard-note-map.ts`, `value-conversion.ts`, `worklet-synth-engine.ts`, `lesson-progress.ts`, `instrument-state.ts`, `lesson-detail.ts`, `tools-panel.ts`, `audio-context.token.ts`, `motion-preference.ts`, `patch.ts`, `operator-parameters.ts`, `algorithm.ts`, `operator.ts`, `worklet-messages.ts`, `app.routes.ts`, `app.html`, `app.spec.ts`, `app.config.ts`, `package.json`, `eslint.config.js`
- [W3C Web MIDI API](https://webaudio.github.io/web-midi-api/) — `requestMIDIAccess`, maps, `MIDIPort.id`, implicit open, `midimessage` complete messages, exception names, `sysex`, GC warning
- [MDN requestMIDIAccess](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMIDIAccess) — secure context, Limited availability, `sysex` default `false`
- [MDN Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
- [MDN MIDIAccess](https://developer.mozilla.org/en-US/docs/Web/API/MIDIAccess) — `onstatechange`
- [MDN MIDIPort](https://developer.mozilla.org/en-US/docs/Web/API/MIDIPort) — `id`, `state` connected/disconnected
- [MDN MIDIMessageEvent](https://developer.mozilla.org/en-US/docs/Web/API/MIDIMessageEvent) — `data` Uint8Array
- [MDN Using the Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API) — `storageAvailable`, JSON stringify
- [MDN Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) — `SecurityError`, private browsing
- [MDN HTML a download](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#download) — `blob:` URLs
- [MDN URL.createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)
- [MDN input type=file](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file) — `accept` is a hint
- [MDN Permissions-Policy midi](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/midi) — default allowlist `'self'`
- `.planning/phases/12-midi-and-patch-persistence/12-CONTEXT.md` — locked D-01..D-28
- `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/ACCEPTANCE_CRITERIA.md`

### Secondary (MEDIUM confidence)

- MIDI 1.0 velocity-0 = note-off: MIDI 1.0 Detailed Specification language as quoted by [midi.org forum](https://midi.org/community/midi-specifications/zero-velocity-note-on) and [teragonaudio note-on](http://midi.teragonaudio.com/tech/midispec/noteon.htm). Product D-14 already locked this.
- localStorage vs IndexedDB for tiny JSON: payload-size first-principles (one patch + ≤32 lesson ids + one string); IndexedDB not fetched from Angular docs because it is out of the locked DI shape.

### Tertiary (LOW confidence)

- Per-browser Web MIDI version lists (Chrome 43+, Firefox 108+, Safari none) from unofficial aggregators — **do not put version numbers in product copy**. Feature-detect only.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — in-repo Angular 22 + platform APIs; no new packages; TypeScript MIDI types absence verified by grep of `node_modules/typescript/lib`
- Architecture: HIGH — locked CONTEXT + existing DI/note-lifecycle/validator seams read this session
- Pitfalls: HIGH — engine velocity bounds, `enableAudio` focus, JSON keys, lesson isolation, jsdom MIDI gap all file-verified

**Research date:** 2026-09-09
**Valid until:** 2026-10-09 (platform APIs stable; re-check MDN Baseline status if Safari ships Web MIDI)
