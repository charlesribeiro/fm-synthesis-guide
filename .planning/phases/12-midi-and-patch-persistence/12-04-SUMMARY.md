---
phase: 12-midi-and-patch-persistence
plan: 04
subsystem: settings
tags: [angular, vitest, settings, web-midi, json-backup, localStorage]
status: complete

requires:
  - phase: 12-midi-and-patch-persistence
    provides: SavedDocumentStore replaceDocument/clearDocument/lastMidiDeviceId, MidiSession enable/disable/selectPort, FakeStorage TestBed pattern
  - phase: 01-angular-foundation
    provides: lazy loadComponent + title, primary nav, About page analog

provides:
  - lazy `/settings` route titled `Settings — DX7 Algorithm Lab` in primary nav after Playground (D-02)
  - Settings MIDI enable/disable, named device select with disconnected option, full-sentence status copy (D-01, D-04, D-05)
  - MidiSession.enable prefers SavedDocumentStore lastMidiDeviceId when still among inputs; selectPort persists the id (D-20)
  - downloadJson Blob + object URL helper; confirmed import-replace and confirmed clear (D-23, D-25, D-26)

affects: [phase-13-hardening]

actuals:
  tokens: 11417
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Enable MIDI on Settings starts audio when suspended and never moves focus (D-06, D-10)"
    - "Import pipeline is confirm → size cap → file.text → JSON.parse → parseSavedDocument → only then replaceDocument"
    - "Clear restore is storage + MIDI off; live InstrumentState.replacePatch(DEFAULT_PATCH) only when Router.url is /playground"

key-files:
  created:
    - src/app/features/settings/settings.ts
    - src/app/features/settings/settings.html
    - src/app/features/settings/settings.scss
    - src/app/features/settings/settings.spec.ts
    - src/app/core/persistence/download-json.ts
    - src/app/core/persistence/download-json.spec.ts
  modified:
    - src/app/app.routes.ts
    - src/app/app.html
    - src/app/app.spec.ts
    - src/app/core/midi/midi-session.ts
    - src/app/core/midi/midi-session.spec.ts
    - src/app/features/play-surface/play-surface.spec.ts

key-decisions:
  - "MidiSession now injects SavedDocumentStore; enable() reselects lastMidiDeviceId when that id is still among inputs, otherwise first connected values() port (D-20, D-03). Construction still does not call requestMIDIAccess (D-08)."
  - "Settings import is a confirmed full replace, never a merge. Failed parse/oversize/Dexed-shaped input leaves FakeStorage unchanged (D-25, D-26, D-28)."
  - "Clear saved data confirms, removeItem of this app key only, disables MIDI, and applies DEFAULT_PATCH to live InstrumentState only on /playground so an open lesson patch is not smashed (D-23)."

patterns-established:
  - "Every TestBed that constructs PlaySurface, MidiSession, Settings, or App provides STORAGE: FakeStorage after MidiSession injects SavedDocumentStore."
  - "Imported recovery and import-error copy is bound with text interpolation only — no innerHTML."

requirements-completed: [PERSIST-01, MIDI-01]

coverage:
  - id: D1
    description: "Primary nav is Learn, Algorithms, Playground, Settings, About; lazy /settings title is Settings — DX7 Algorithm Lab (D-02)"
    requirement: MIDI-01
    verification:
      - kind: unit
        ref: "src/app/app.spec.ts#exposes all five primary nav links"
        status: pass
    human_judgment: false
  - id: D2
    description: "Settings Enable MIDI with a saved port-B id selects B despite A being first in values() (D-20)"
    requirement: MIDI-01
    verification:
      - kind: unit
        ref: "src/app/core/midi/midi-session.spec.ts#reselects the stored id even when it is not first in values()"
        status: pass
    human_judgment: false
  - id: D3
    description: "Injecting MidiSession with a pre-filled lastMidiDeviceId does not call requestMIDIAccess (D-08)"
    requirement: MIDI-01
    verification:
      - kind: unit
        ref: "src/app/core/midi/midi-session.spec.ts#does not invoke the request function when the store already holds a device id (D-08)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Disconnected selected port remains in the Settings select with disconnected in the label (D-04)"
    requirement: MIDI-01
    verification:
      - kind: unit
        ref: "src/app/features/settings/settings.spec.ts#keeps a disconnected selected port listed with disconnected in the label (D-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Failed import (oversize, Dexed-shaped, confirm cancelled) leaves storage unchanged (D-26, D-28)"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/features/settings/settings.spec.ts#refuses Dexed-shaped JSON after confirm and leaves storage unchanged"
        status: pass
    human_judgment: false
  - id: D6
    description: "Successful extra-key v1 import hydrates LessonProgress and applies the playground patch when url is /playground (D-25)"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/features/settings/settings.spec.ts#imports extra-key schema-version-1 JSON, hydrates lesson progress, and applies the patch on /playground"
        status: pass
    human_judgment: false
  - id: D7
    description: "Confirmed clear restores defaults, disables MIDI, and does not smash a live lesson patch (D-23)"
    requirement: PERSIST-01
    verification:
      - kind: unit
        ref: "src/app/features/settings/settings.spec.ts#confirmed clear restores defaults, disables MIDI, and does not smash a live lesson patch"
        status: pass
    human_judgment: false
  - id: D8
    description: "Settings templates do not assign imported bytes as HTML markup"
    requirement: PERSIST-01
    verification:
      - kind: other
        ref: "grep -v '^#' src/app/features/settings/settings.ts src/app/features/settings/settings.html | grep -c innerHTML"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-09-09
---

# Phase 12 Plan 04: Settings MIDI picker and backup import/export Summary

**Lazy `/settings` route with MIDI device picker, last-device preference on Enable MIDI, and confirmed JSON backup export/import/clear**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-09T13:51:51Z
- **Completed:** 2026-09-09T13:58:41Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Primary nav is now Learn, Algorithms, Playground, Settings, About. `/settings` lazy-loads `Settings` with title `Settings — DX7 Algorithm Lab`. Footer still has only the motion-preference line — no MIDI indicator.
- Settings Enable MIDI requests access without visiting Playground, starts audio if needed, and does not move focus. After enable, the session reselects `lastMidiDeviceId` when that id is still among inputs; otherwise it uses the first `values()` port. Selecting a port writes the id. MIDI is never auto-enabled on boot.
- Export downloads `dx7-algorithm-lab-backup.json`. Import is a labelled file picker; after `window.confirm`, a successful parse replaces the whole document and hydrates live state; a failed parse (oversize, Dexed-shaped, bad JSON) refuses and keeps current storage. Clear confirms, removes only this app's key, restores defaults, disables MIDI, and applies `DEFAULT_PATCH` only on `/playground`.

## Task Commits

Each task was committed atomically:

1. **Task 1: `/settings` MIDI section, primary nav, and last-device preference** - `abd0998` (feat)
2. **Task 2: Export, confirmed import-replace, confirmed clear, recovery copy** - `73bbfb4` (test, RED) then `2a2bee8` (feat, GREEN)

**Plan metadata:** docs(12-04) commit of this SUMMARY plus STATE.md, ROADMAP.md, and REQUIREMENTS.md

_Note: Task 2 followed RED → GREEN. No refactor commit._

## Files Created/Modified

- `src/app/app.routes.ts` - lazy `path: 'settings'` after playground
- `src/app/app.html` - Settings nav link after Playground
- `src/app/app.spec.ts` - five nav labels; footer has no MIDI copy
- `src/app/core/midi/midi-session.ts` - SavedDocumentStore last-device preference and persist on selectPort
- `src/app/core/midi/midi-session.spec.ts` - D-20 / D-08 coverage; STORAGE FakeStorage on every session TestBed
- `src/app/features/play-surface/play-surface.spec.ts` - STORAGE FakeStorage after MidiSession injects the store
- `src/app/features/settings/settings.ts` - MIDI section plus confirmed import/export/clear
- `src/app/features/settings/settings.html` - semantic MIDI and Saved data sections; interpolation-only status
- `src/app/features/settings/settings.scss` - layout.page + existing tokens
- `src/app/features/settings/settings.spec.ts` - MIDI picker, last-device, backup, recovery
- `src/app/core/persistence/download-json.ts` - Blob + object URL + click + revoke
- `src/app/core/persistence/download-json.spec.ts` - URL create/revoke/click spies

## Decisions Made

- `MidiSession.enable` reads `SavedDocumentStore.document().lastMidiDeviceId` only after access resolves. Hydration stores the id; Enable MIDI is still required after reload (D-08, D-20).
- Import never merges. Size is checked before `file.text()`. `parseSavedDocument` returning null is a malformed backup and does not write.
- Clear while a lesson is open restores saved defaults and turns MIDI off, but leaves the live lesson patch in `InstrumentState` unless the URL is `/playground`.
- Settings does not inject unused `PlaygroundPatchSlot`. `replaceDocument` already updates the persisted playground field; live apply is `InstrumentState.replacePatch` on the Playground route.

## Deviations from Plan

### Auto-fixed Issues

None that required production bugfixes.

### Other deviations

**1. [Rule 3 - Blocking] Skipped unused PlaygroundPatchSlot inject on Settings**
- **Found during:** Task 2
- **Issue:** The plan listed `PlaygroundPatchSlot` among Settings injects. Wiring it without a call site would fail `@typescript-eslint/no-unused-vars`.
- **Fix:** Live Playground hydrate uses `InstrumentState.replacePatch`; the slot field is already inside `SavedDocumentStore.replaceDocument` / `clearDocument`.
- **Files modified:** `src/app/features/settings/settings.ts`
- **Verification:** import-on-`/playground` and clear-on-lesson specs pass
- **Committed in:** `2a2bee8`

**2. [Process] Tracer did not pause for interactive human-verify**
- **Found during:** Task 1
- **Issue:** `AUTO_CFG` is false, which would normally checkpoint a tracer. The plan is `autonomous: true` and the sequential executor was instructed to complete all tasks.
- **Fix:** Re-ran Task 1 `<verify>` (app/settings/midi-session/play-surface specs) after the tracer commit; all passed, then Task 2 proceeded.
- **Files modified:** none extra
- **Verification:** 2096 tests passing at close-out
- **Committed in:** n/a (process)

---

**Total deviations:** 2 (1 unused-inject skip, 1 autonomous tracer continuation)
**Impact on plan:** Goal met. No scope creep. No packages added.

## TDD Gate Compliance

- RED: `73bbfb4` `test(12-04): add failing tests for backup export, import, and clear` — 9 failing tests (downloadJson no-op; missing Export/Import/Clear controls; recovery copy absent). A no-op `downloadJson` stub was included so `download-json.spec.ts` could compile; assertions still failed.
- GREEN: `2a2bee8` `feat(12-04): implement confirmed backup export, import-replace, and clear` — settings, download-json, and saved-document-store specs pass.
- REFACTOR: not needed.

## Issues Encountered

- Vitest cannot `vi.spyOn` the ESM `downloadJson` named export (`Cannot redefine property`). Export coverage spies `URL.createObjectURL` / `revokeObjectURL` / `HTMLAnchorElement.click` instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MIDI-01 and PERSIST-01 are closed by automated fakes. Optional later UAT (real MIDI keyboard and a real file round-trip) is non-blocking.
- Phase 12's four plans are complete. Ready for phase verification / security review / Phase 13 hardening.

---
*Phase: 12-midi-and-patch-persistence*
*Completed: 2026-09-09*

## Self-Check: PASSED
