---
phase: 05
slug: first-playable-approximation
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-07
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| DOM event → `SynthEngine` | Pointer and keyboard events carry note/velocity numbers into `AudioParam` scheduling; the only untrusted numeric input surface in this phase. | Note/velocity integers |
| `InstrumentState` signals → audio graph | Patch values (already validated at the `InstrumentState` boundary in Phase 3) cross into Web Audio scheduling and must stay finite and bounded. | Operator ratio/detune/level values |
| Canonical algorithm dataset → node topology | `AlgorithmDefinition.edges` decides which nodes connect; a malformed edge would shape the live audio graph. | Edge/topology data |
| Browser Web Audio global → app | The only browser-global touchpoint, isolated behind `AUDIO_CONTEXT_CTOR` so an absent or throwing implementation degrades to a status, never a crash. | Browser API surface |
| Document-level key listeners → app | A document-scoped listener sees every keystroke on the page, including ones meant for the browser or a future text field. | Keyboard events |
| Engine output → the listener's ears and speakers | The only boundary in this phase where a defect causes physical rather than software harm. | Audio signal loudness |
| Rendered copy → the learner's understanding | The page's claims about what the engine is are the AUDIO-03 surface. | Static UI copy |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Denial of Service (local) | `WebAudioSynthEngine.noteOn` / key input path | medium | mitigate | `note`/`velocity` validated as integers in `MIN_MIDI_NOTE..MAX_MIDI_NOTE` / `MIN_VELOCITY..MAX_VELOCITY`, throwing `RangeError` before any `AudioParam` call (`web-audio-synth-engine.ts:79-87`); key input sources values only from the frozen `PLAYABLE_KEYS` table before the same re-validation. | closed |
| T-05-02 | Denial of Service (user harm) | master gain / feedback path | high | mitigate | Fixed `MASTER_GAIN` clamp downstream of every carrier (`web-audio-synth-engine.ts:230`); `MAX_FEEDBACK_INDEX` (2) bounded strictly below `MAX_MODULATION_INDEX` (8) in `value-conversion.ts:97-152`; listening-verified worst case (six carriers, max feedback) in 05-04, re-confirmed for the shipped 1/6 value in 05-UAT.md Test 1. | closed |
| T-05-03 | Denial of Service (resource) | engine lifecycle / re-patching / listeners | medium | mitigate | `DestroyRef.onDestroy` → `destroy()` stops/disconnects every node and closes the context (`web-audio-synth-engine.ts:143,549,581-594`); re-patching only disconnects/reconnects existing persistent nodes (zero new nodes on algorithm switch); host-binding listeners have automatic teardown, with window blur and `DestroyRef` both calling `allNotesOff`. | closed |
| T-05-04 | Tampering | `AUDIO_CONTEXT_CTOR` factory | low | accept | The factory reads a browser global that only the browser controls; a compromised global implies the page is already compromised. No app-level mitigation is meaningful. | closed |
| T-05-05 | Tampering | routing application | medium | mitigate | Routing is derived solely from `planConnections` and `deriveCarriers` (`patch-plan.ts`); a 32-algorithm sweep test asserts live topology equals derived expectation, so a stale or extra link fails a named test. | closed |
| T-05-06 | Denial of Service (usability) | document key listeners | medium | mitigate | Keydown guard rejects modifier-held events (`ctrlKey`/`metaKey`/`altKey`) and events targeting editable elements (`playground.ts:18,226`), so the play surface cannot swallow browser shortcuts or future text input. | closed |
| T-05-07 | Spoofing (of capability) | Playground copy | medium | mitigate | 05-04 checklist item 8 (approximation-copy honesty) reviewed every string on the page for accuracy claims; recorded as approved in 05-04-SUMMARY.md. | closed |
| T-05-SC | Tampering | npm installs | high | accept | No package-manager install occurred in this phase — `05-RESEARCH.md` §Package Legitimacy Audit records zero proposed packages; `package.json` history confirms no change since initial scaffold. | closed |

*Status: all eight threats are closed; `threats_open` is 0*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-05-01 | T-05-04 | Browser Web Audio global is outside app control; a compromised global implies the page itself is already compromised. No app-level mitigation is meaningful. | Plan 05-01 threat model | 2026-08-07 |
| R-05-02 | T-05-SC | No package-manager install occurred in Phase 5 (verified zero proposed packages in 05-RESEARCH.md and unchanged `package.json`). | Plan 05-01/02/03/04 threat models | 2026-08-07 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-07 | 8 | 8 | 0 | /gsd-secure-phase orchestrator (L1 grep-depth verification; register authored at plan time, ASVS level 1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-07
