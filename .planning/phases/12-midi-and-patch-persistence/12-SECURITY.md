---
phase: 12
slug: midi-and-patch-persistence
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-09-18
---

# Phase 12 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|----------------|
| Origin `localStorage` string → codec | Untrusted JSON, possibly hostile getters or prototype keys | Serialized `SavedDocument` |
| Imported file text → codec | Same parser; Settings owns the picker, `parseSavedDocument` owns fail-closed decode | Backup file bytes / JSON |
| `SavedDocument` → `LessonProgress` / Playground slot | Hydrate must not throw; invalid ids dropped or document rejected per field rules | Lesson ids, playground patch |
| MIDI bytes → parser | Untrusted `Uint8Array` from a device | Channel-voice note messages |
| Permission prompt → session | `NotAllowedError` must become a named UI state, not an unhandled rejection | Web MIDI permission |
| Enable MIDI click → AudioContext | Same gesture may start audio (D-06); must not start audio from note-on | User gesture |
| Lesson `startingPatch` → live `InstrumentState` | Trusted in-app data; must not cross into the durable Playground field | Lesson patch |
| ToolsPanel commands → slot | Only Randomize/Reset (and future Playground editors) are Playground-originated writes | Validated `InstrumentPatch` |
| Confirm dialog → destructive import/clear | User intent gate (D-25, D-23) | Boolean confirm |
| Imported strings → Settings template | XSS if assigned as markup | Recovery / import error copy |
| Hydrated `lastMidiDeviceId` → Enable MIDI | Must not request access until click (D-08) | Device id string |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-12-01 | Denial of Service | `parseSavedDocument` | high | mitigate | Whole body in try/catch; returns `null` and never throws (`parse-saved-document.ts:121-149`). Hostile-getter row in `parse-saved-document.spec.ts`. | closed |
| T-12-02 | Tampering | prototype keys on imported JSON | medium | mitigate | Known fields only; rebuilds `OperatorParameterSet` from `OPERATOR_IDS`; rejects arrays via `isPlainObject`; never copies unknown keys onto a prototype (`parse-saved-document.ts:12-14,58-91,141-146`). | closed |
| T-12-03 | Tampering | Dexed / SysEx / ROM-shaped import | high | mitigate | `schemaVersion` must be the number `1` (`PERSISTENCE_SCHEMA_VERSION`); otherwise `null` (`parse-saved-document.ts:126-128`). Settings import calls `parseSavedDocument` before `replaceDocument` (`settings.ts:154-160`). | closed |
| T-12-04 | Tampering | seventh / extra operator key | medium | mitigate | Exact six keys via `Object.keys(operatorsRaw).length !== OPERATOR_IDS.length` plus `every` id parse (`parse-saved-document.ts:70-80`). Extra operator key → `null`. | closed |
| T-12-05 | Denial of Service | `STORAGE.setItem` quota / private mode | medium | mitigate | Probe failure returns a no-op Like whose `setItem` throws (`storage.token.ts:14-35`), so a silent no-op cannot look like a successful write. `writeToStorage` try/catch plus read-back of the stored value (`saved-document-store.ts:128-139`) leaves `writeError` set and live state intact. | closed |
| T-12-06 | Tampering | clearing saved data | medium | mitigate | `removeItem(PERSISTENCE_STORAGE_KEY)` only (`saved-document-store.ts:71-73`); Settings confirm first (`settings.ts:120-124`). Spec asserts only that key is removed. | closed |
| T-12-07 | Information Disclosure | SysEx / `requestMIDIAccess({ sysex: true })` | medium | mitigate | Always `{ sysex: false }` (`midi-session.ts:71`). Parser returns `null` for status `>= 0xF0` (`parse-midi-note-message.ts:14,28-30`). | closed |
| T-12-08 | Denial of Service | velocity 0 note-on → `engine.noteOn` | high | mitigate | Parser rewrites to `kind: 'off'` (`parse-midi-note-message.ts:37-38`). PlaySurface spec asserts `noteOn` is never called with 0. | closed |
| T-12-09 | Denial of Service | stuck note on disable/disconnect | medium | mitigate | `allNotesOff` on disable and selected disconnect (`midi-session.ts:82,140`); PlaySurface clears `midiHeldNotes` (`play-surface.ts:175-179,419-423`). | closed |
| T-12-10 | Denial of Service | silent MIDI trap (audio off) | medium | mitigate | Enable MIDI calls `initializeAudio()` / `engine.initialize()` on the same click (`play-surface.ts:221-225`, `settings.ts:87-91`). | closed |
| T-12-11 | Tampering | CC / SysEx as note | low | mitigate | Parser ignores non-note channel voice messages (`parse-midi-note-message.ts:45-48`). | closed |
| T-12-12 | Tampering | LessonDetail → Playground slot | medium | mitigate | No `write` from lesson production code; spy in `lesson-detail.spec.ts`. | closed |
| T-12-13 | Tampering | global `patch()` subscription | medium | mitigate | Call-site writes only (`tools-panel.ts:91,98`); Playground constructor reads, never writes (`playground.ts:38-40`). | closed |
| T-12-14 | Tampering | XSS via imported strings | medium | mitigate | Bind `recoveryMessage` / `writeError` / import error with `{{ }}` only (`settings.html:50-58`). No `innerHTML` / bypass in Settings. | closed |
| T-12-15 | Denial of Service | oversized import | medium | mitigate | Refuse when `file.size > MAX_IMPORT_BYTES` (262144) before reading text (`settings.ts:136-138`). | closed |
| T-12-16 | Information Disclosure | auto `enable()` on hydrate | medium | mitigate | Hydrate stores the id on the document; only Enable MIDI calls `request` (`midi-session.ts:60-72,105-108`). Constructor never calls `enable()`. | closed |
| T-12-SC | Tampering | npm installs | low | accept | No packages added this phase (`tech-stack.added: []` in 12-01..12-04 SUMMARYs). | closed |

*Status: all 17 threats are closed; `threats_open` is 0*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-12-01 | T-12-SC | No package-manager install occurred in Phase 12. Hand-rolled `MidiAccessLike` because TypeScript 6 `lib.dom` has no MIDI types. | Plans 12-01/02/03/04 threat models | 2026-09-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-18 | 17 | 17 | 0 | /gsd-secure-phase orchestrator (L1 grep-depth verification; register authored at plan time, ASVS level 1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-18
