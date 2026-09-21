# Phase 12: MIDI and patch persistence - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Progressive Web MIDI input and versioned local persistence with JSON import/export.

MIDI (MIDI-01): detect support, request permission only from an explicit user action, note
on/off plus velocity, device connect/disconnect, fully usable without MIDI, distinct
unsupported/denied/empty/disconnected/ready states. MIDI is another play-surface input into the
existing monophonic `SynthEngine` — not a second engine, not polyphony, not CC/SysEx.

Persistence (PERSIST-01): a versioned serializable document for lesson progress, one dedicated
Playground patch slot, and last MIDI device id; auto-save and restore; file-based JSON backup
that round-trips that document; malformed stored data recovers without crashing; malformed
imports are refused. Does not persist AudioNodes, in-flight notes, A/B snapshot slots, or a
named patch library. Does not add a six-operator editor.

New `/settings` route in the primary nav is in scope as the home for MIDI device status/picker
and persistence import/export/clear.

</domain>

<decisions>
## Implementation Decisions

### MIDI permission, devices, and Settings
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

### MIDI notes vs the monophonic engine
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

### What survives reload
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

### Import/export and recovery
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and phase framing
- `CLAUDE.md` — audio rules (no `AudioNode` in signal state, never construct `AudioContext` at
  module eval, resume only after user gesture, explicit cleanup); browser APIs behind DI;
  domain purity; licensing (no copyrighted patch ROMs or commercial banks).
- `GSD_NEW_PROJECT_PROMPT.md` — Browser MIDI (progressive enhancement, permission from explicit
  action, note on/off/velocity, connect/disconnect, usable without MIDI) and Persistence
  (serializable settings/progress/custom patches, versioned schema, JSON import/export, never
  persist AudioNodes or transient note state); suggested `/settings` route.
- `.planning/ROADMAP.md` §"Phase 12: MIDI and patch persistence" — goal and success criteria.
- `.planning/REQUIREMENTS.md` — PERSIST-01, MIDI-01.
- `.planning/PROJECT.md` — core value; Phase 12 is the active requirement.
- `docs/ARCHITECTURE.md` — MIDI adapter, local storage adapter, MIDI unsupported/denied and
  invalid imported patch as explicit error states; patch serialization/migrations in the domain
  layer.
- `docs/ACCEPTANCE_CRITERIA.md` — app remains navigable when MIDI is unavailable; progress and
  settings survive reload after persistence.
- `docs/ROADMAP_SEED.md` §Phase 12 — Progressive Web MIDI, versioned local persistence, JSON
  import/export.

### Prior-phase contracts this phase must honor
- `.planning/phases/03-signal-instrument-state/03-CONTEXT.md` D-05 and
  `.planning/phases/03-signal-instrument-state/03-02-SUMMARY.md` — `InstrumentState` itself does
  not read/write browser storage; Phase 12 designs its own versioned schema rather than
  serializing `SnapshotSlots` as-is.
- `.planning/phases/06-guided-lessons-for-algorithm-32-and-algorithm-1/06-CONTEXT.md` D-07 and
  `.planning/phases/11-curriculum-across-all-32-algorithms/11-CONTEXT.md` D-15 — `LessonProgress`
  was session-only until this phase; this phase owns durability.
- `.planning/phases/05-first-playable-approximation/05-CONTEXT.md` — AUDIO-01 gesture gate;
  monophonic engine; `noteOn`/`noteOff` already MIDI-ranged.

### Code the MIDI path must reuse
- `src/app/features/play-surface/play-surface.ts` — Enable audio, `pressKey`/`releaseKey`,
  `noteHoldCount`, `notePlayed`, `heldNotes` highlighting. MIDI enable/toggle and MIDI note
  ownership plug in here (D-01, D-16, D-17).
- `src/app/features/play-surface/keyboard-note-map.ts` — C4–B4 `PLAYABLE_KEYS` for highlighting
  only (D-15); engine range is `MIN_MIDI_NOTE`..`MAX_MIDI_NOTE`.
- `src/app/core/audio/synth-engine.ts` — `noteOn`/`noteOff`/`allNotesOff`; last-note-wins lives
  in the engine (`worklet-synth-engine.ts` `heldNote` / stale-release D-04).
- `src/app/domain/dx7/audio/value-conversion.ts` — `MIN_MIDI_NOTE`/`MAX_MIDI_NOTE`,
  `MIN_VELOCITY`/`MAX_VELOCITY`, `midiNoteToFrequency`, `velocityToAmplitude`.
- `src/app/core/browser/motion-preference.ts` — DI-token + fakeable browser API + private
  writable signal pattern the MIDI adapter should mirror.

### Code the persistence path must reuse
- `src/app/state/lesson-progress.ts` — `LessonProgress` facade to make durable (D-18).
- `src/app/state/instrument-state.ts` — live patch commands; do not add storage here; Playground
  slot is a new persistence concern (D-21).
- `src/app/domain/dx7/models/patch.ts` — `InstrumentPatch`, `DEFAULT_PATCH`,
  `validateFeedbackLevel`.
- `src/app/domain/dx7/models/operator-parameters.ts` — `validateOperatorParameters`.
- `src/app/domain/dx7/dsp/worklet-messages.ts` — `isOperatorParameterSetLike` (exact six-key
  operators object) as the import-boundary shape precedent.
- `src/app/app.routes.ts` / `src/app/app.html` — add `/settings` and primary-nav link (D-02).
- `src/app/features/learn/lesson-detail/lesson-detail.ts` — existing `startingPatch` sync into
  `InstrumentState` must keep working and must not write the Playground slot (D-21).

No external MIDI/storage specs beyond the above — Web MIDI and storage details are researcher
work against official Web MIDI / Web Storage docs at plan time.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PlaySurface` already maps pointer + computer keyboard onto one `pressKey`/`releaseKey` /
  `noteHoldCount` model and emits `notePlayed` for lessons. MIDI should be a third owner on
  that same path, not a parallel `engine.noteOn` caller.
- `MotionPreference` + `MATCH_MEDIA` is the template for a MIDI adapter: injected browser
  global, graceful unsupported stand-in, private writable signal, read-only public selector,
  `DestroyRef` cleanup.
- Domain validators (`validateOperatorParameters`, `validateFeedbackLevel`, `isLessonId`,
  `isAlgorithmId`, `isOperatorParameterSetLike`) are the import/storage boundary. Phase 2
  exported them specifically so Phase 12 would not hand-roll a weaker check.
- `DEFAULT_PATCH` is the clear-data / corrupt-storage fallback.

### Established Patterns
- Browser APIs never at module evaluation time; tests fake the token, not `navigator`.
- `InstrumentState` validate-then-immutable-write; invalid command input throws `RangeError`.
  Persistence decode should fail closed into D-26 recovery, not throw through the UI.
- Feature routes are lazy-loaded standalone components; Settings follows that.
- Hostile-payload matrices at message/storage boundaries (Phase 8 worklet messages, Phase 9
  envelopes) are the test shape for malformed JSON.

### Integration Points
- MIDI adapter (new, `core/browser` or `core` MIDI) → PlaySurface note lifecycle → existing
  `SYNTH_ENGINE`.
- Persistence adapter (new, `core/persistence`) → versioned document codec (pure domain) →
  `LessonProgress` + dedicated Playground slot + MIDI last-device preference. Not inside
  `InstrumentState`.
- `/settings` is a new lazy feature; Playground `comingSoon` (algorithm selector, operator
  strips) stays untouched — those are not this phase.

### Creative options
- Playground-slot writer can be a small facade that Playground/ToolsPanel call, keeping
  `InstrumentState` storage-free (honors Phase 3 D-05).
- MIDI permission + audio `initialize()` on the same click is allowed because D-06 names that
  click as the gesture; do not start audio from a MIDI note-on.

</code_context>

<specifics>
## Specific Ideas

No visual mockups. Concrete feel locked in discussion: MIDI as progressive play-surface input
(not a Settings-only toy), Playground patch isolated from lessons so opening a lesson cannot
destroy a saved sound, export as a full backup file, import as confirmed restore, recovery that
never crashes and never destroys state on a failed import.

</specifics>

<deferred>
## Deferred Ideas

None new — discussion stayed inside MIDI-01 / PERSIST-01. Explicitly out of scope (not
backlog-new, already later or rejected):

- MIDI CC, pitch bend, program change, clock, SysEx, Dexed/ROM import (D-11, D-28)
- Named user patch library (D-19)
- Persisting A/B slots (D-19)
- Polyphony / last-note hold stack (D-13)
- Six-operator editor / algorithm selector on Playground (existing `comingSoon`, not Phase 12)
- Accessibility/performance hardening (Phase 13, HARDEN-01)
- Auto-reconnect MIDI on boot (explicitly rejected, D-08)

</deferred>

---

*Phase: 12-MIDI and patch persistence*
*Context gathered: 2026-09-08*
