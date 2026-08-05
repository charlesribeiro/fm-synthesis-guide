# Phase 3: Signal instrument state - Context

**Gathered:** 2026-08-05
**Updated:** 2026-08-05 (default patch numbers pinned down — D-10, D-11)
**Status:** Ready for planning

<domain>
## Phase Boundary

A signal-based facade over instrument/patch state: the selected algorithm, all six operators'
parameters, and the global feedback level — with immutable updates, two named full-patch A/B
snapshot slots, and a reset to a fixed default patch. Covers: `OperatorParameters` shape,
read-only selectors, explicit command methods, algorithm-switch carryover semantics, A/B/reset
semantics, and default-patch values. Does NOT cover: any UI (Phase 4), audio engine wiring or
DSP (Phase 5+), envelope modeling beyond a placeholder field (Phase 9, ENGINE-03), per-algorithm
curated presets (Phase 11, CURR-01), or persistence/import-export (Phase 12, PERSIST-01) — this
phase's snapshots and reset are in-memory only.

</domain>

<decisions>
## Implementation Decisions

### Algorithm-switch carryover
- **D-01:** Switching the selected algorithm does NOT reset any of the six operators' parameter
  values (ratio, level, detune, mode, envelope stub) — they carry over unchanged. Switching only
  changes routing/role interpretation (carrier vs. modulator, derived from Phase 2's
  `getOperatorRole`/`deriveCarriers`), never per-operator settings. Matches real DX7 behavior:
  the same six physical operators exist regardless of algorithm.
- **D-02:** The global feedback level (0–7 depth, D-02 from `02-CONTEXT.md`) also carries over
  unchanged across an algorithm switch, consistent with D-01 above — only *which* operator the
  depth applies to changes (derived from the new algorithm's self-loop edge), never the depth
  value itself.

### A/B snapshot and reset semantics
- **D-03:** "A" and "B" are two named, independent, explicitly-captured full-patch snapshot
  slots — each captures the entire instrument state (selected algorithm id + all six operators'
  parameters + feedback level) at the moment the user commands a capture. Recalling A or B
  restores that captured state exactly. This is not an undo stack; exactly two slots, matching
  ROADMAP.md's literal "A/B" wording — an unbounded snapshot list would be scope growth beyond
  what STATE-03/ROADMAP SC3 ask for.
- **D-04:** "Reset" is a third action, independent of A and B — it always restores a fixed
  default patch (see D-06/D-07 below), regardless of what is currently captured in A or B.
  Reset never overwrites A or B. — **Reversibility:** reversible — this is a facade-level command
  semantic, cheap to redefine later if it turns out wrong.
- **D-05:** A/B snapshots and reset are in-memory state only for this phase — no persistence
  across a page reload. Versioned storage/import-export is PERSIST-01 (v2, Phase 12); Phase 3
  must not build ad hoc localStorage handling to compensate.

### Operator parameter shape
- **D-06:** `OperatorParameters` models the full future DX7 shape now — `enabled`, `mode:
  'ratio' | 'fixed'`, `ratio`, `fixedFrequencyHz`, `detune`, `outputLevel`, and an envelope
  field — rather than a Phase-5-only minimal subset. — **Reversibility:** costly — Phase 4's SVG
  view model, Phase 5's MVP engine, and Phase 9's envelope work all read this same shape;
  widening it later means revisiting every call site that destructures `OperatorParameters`.
- **D-07:** The envelope field is stubbed as a single sustain-level number (e.g.
  `envelopeLevel: number`) for this phase, NOT the full 4-rate/4-level DX7 envelope structure —
  that structure is Phase 9's (ENGINE-03) to design and is a straight type-widening of this one
  field, not a new field or a breaking rename. Gives Phase 5's MVP engine one real amplitude
  knob beyond `outputLevel` without inventing envelope semantics prematurely.

### Default patch feel
- **D-08:** The default patch (used both on first load and by `reset`) sets operators to a
  pleasant, audible starting point — not a silent/all-zero baseline. Core value alignment: a
  learner who opens Playground and does nothing should still eventually hear something once
  Phase 5 lands, not silence. Exact numeric defaults (specific `outputLevel`/`ratio`/`detune`
  values) are Claude's discretion (see below).
- **D-09:** The default patch is ONE uniform formula applied identically regardless of which of
  the 32 algorithms is selected (e.g., every operator gets the same default `outputLevel` and
  `ratio` value) — not a bespoke hand-tuned default per algorithm. Bespoke, musically-considered
  per-algorithm starting patches are CURR-01's job (v2, Phase 11 curriculum: "every algorithm has
  ... an original preset") — building that here would duplicate later work and pull content
  authoring into a state-facade phase.

### Default patch numeric values
- **D-10:** `OperatorParameters` uses DX7-authentic integer scales, not normalized floats:
  `outputLevel` 0–99, `ratio` as a small set of coarse multiples (0.5, 1, 2, 3, …), `detune`
  -7..+7 — consistent with the feedback level's existing 0–7 integer scale (Phase 2 D-02) and
  with real DX7 panel values. Phase 5's audio engine converts these to Web Audio gain/frequency
  values at its own boundary; the facade itself always stores and exposes DX7-scale numbers, not
  pre-converted audio values.
- **D-11:** The concrete default patch (D-08/D-09's uniform formula, applied identically to all
  six operators and independent of which algorithm is selected) is: `outputLevel: 50`,
  `ratio: 1.0`, `detune: 0`, `envelopeLevel: 99` (near-max on the same 0–99 scale as
  `outputLevel`, per D-10), and instrument-level `feedback: 0`. Rationale:
  - `outputLevel: 50` — a moderate FM index keeps modulator-heavy stacks (e.g. Algorithm 1's
    tower) from sounding harsh, while staying reasonably present once summed across all six
    carriers on all-additive algorithms (e.g. Algorithm 32) — the same value has to work for
    both extremes since D-09 forbids per-role or per-algorithm tuning.
  - `ratio: 1.0` — unison on every operator avoids any operator landing on an unexpectedly
    dissonant default interval.
  - `detune: 0` — no beating/chorus artifacts in the first sound a learner hears.
  - `envelopeLevel: 99` — the sustain-level stub stays fully open so the default patch's audible
    character is governed by `outputLevel`/`ratio`/`feedback` alone, not additionally muffled by
    the envelope placeholder (simplest mental model until Phase 9 designs the real envelope).
  - `feedback: 0` — feedback starts off so the very first sound stays clean regardless of which
    algorithm's self-loop it would otherwise drive; the learner discovers feedback's audible
    effect by raising the knob themselves, which is arguably more pedagogically interesting than
    a pre-seeded amount.

### Claude's Discretion
- Exact TypeScript/Angular shape of the facade (a single `@Injectable({providedIn:'root'})`
  service vs. multiple cooperating services; exact method names for capture/recall/reset) —
  informed by the existing `MotionPreference` pattern (private writable signal, `.asReadonly()`
  public signal, external-system sync only inside `effect`/lifecycle hooks per CLAUDE.md).
- Whether "selected operator" (which operator a future UI focuses/edits) is tracked in this
  facade at all — STATE-01 only names "selected algorithm, operator parameters, and feedback
  level" as the facade's read-only selectors, not a "selected operator" concept; if Phase 4's SVG
  view model needs a notion of a focused operator, that can be Phase 4's own local UI state
  rather than added here. Planner's call whether to stub a seam for it now.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and data model
- `docs/ARCHITECTURE.md` §"Application state" — instrument state as a signal-based facade,
  writable signals private, read-only signals + explicit commands.
- `docs/ARCHITECTURE.md` §"Proposed audio interfaces" — the `SynthEngine`/`OperatorParameters`
  shape this facade's state must line up with for Phase 5.
- `GSD_NEW_PROJECT_PROMPT.md` §"Data model" (`OperatorParameters` sketch, ~line 127) and
  §"Application state" (~line 140) — starting hypothesis for the parameter shape and suggested
  facade state list; treat the `envelope: Dx7Envelope` field as the placeholder D-07 stubs, not
  a fully-specified type to copy verbatim (`Dx7Envelope` itself is undefined in this doc — Phase
  9's to design).

### Project state and requirements
- `.planning/REQUIREMENTS.md` §"Instrument State" — STATE-01 through STATE-03, this phase's
  binding acceptance criteria.
- `.planning/ROADMAP.md` §"Phase 3: Signal instrument state" — success criteria (synchronous
  computed selectors, immutable updates never mutate prior snapshots, A/B + reset restore exact
  deterministic state).
- `CLAUDE.md` Angular rules — signal inputs/outputs, `computed`, read-only facades; `effect` only
  for imperative sync with an external system, never to derive state; immutable inputs even in a
  zoneless app.
- `.planning/phases/02-algorithm-domain/02-CONTEXT.md` — D-02 (feedback *level* is Phase 3 state,
  which operator owns it is Phase 2/derived data) and D-05/D-07 (role is always derived from
  `edges`, never stored) — this facade must read roles via `getOperatorRole`/`deriveCarriers`,
  never re-derive or cache them itself.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/domain/dx7/models/algorithms.ts`, `algorithm-definition.ts` — the canonical
  `ALGORITHMS` dataset and `AlgorithmDefinition` type this facade selects an entry from.
- `src/app/domain/dx7/models/derive-role.ts` — `getOperatorRole`, `deriveCarriers`,
  `getFeedbackOperator`; the facade must call these to know which operator currently owns the
  feedback self-loop, never store that fact itself (D-05/D-07 from Phase 2).
- `src/app/domain/dx7/models/operator.ts` — `OperatorId`, `OPERATOR_IDS` for iterating the six
  operator parameter records in a fixed order.
- `src/app/core/audio/synth-engine.ts` — the `SynthEngine` placeholder interface
  (`setAlgorithm`, `updateOperatorLevel`, `setFeedback`) that Phase 5 will wire to this facade;
  its method shapes are a strong signal for what commands this facade should expose.

### Established Patterns
- `src/app/core/browser/motion-preference.ts` — the app's only existing signal-based facade:
  private `WritableSignal` updated from a single imperative source, `.asReadonly()` public
  `Signal`, `@Injectable({providedIn: 'root'})`. This is the pattern to mirror for the
  instrument-state facade (though instrument state's writes come from explicit command methods,
  not an external browser event, so the `effect`/DI-listener shape won't directly apply the same
  way — commands can just `.set()`/`.update()` the private signal directly).
- Domain layer (`src/app/domain/dx7/models/`) has zero Angular imports, machine-enforced by a
  scoped ESLint rule (Phase 2, DOMAIN-04). The facade itself lives in the Angular
  (`@Injectable`) layer and imports domain types, never the reverse.

### Integration Points
- Phase 4 (SVG diagram) and Phase 5 (audio engine) both read this facade read-only; Phase 6
  (guided lessons) will drive it via its command methods to set up lesson starting patches.
  No other phase should define a second, competing instrument-state store.

</code_context>

<specifics>
## Specific Ideas

No specific visual/UX references — this phase is state-only, no UI surface. The one concrete
"feel" decision is D-08 (audible-by-default, not silent) — a product-value call, not a visual one.

</specifics>

<deferred>
## Deferred Ideas

- Bespoke, hand-tuned per-algorithm default/demo patches (one considered starting sound per
  algorithm) — belongs to CURR-01 (v2, Phase 11 curriculum: "every algorithm has ... an original
  preset"), not this phase's uniform-default state facade (see D-09).

</deferred>

---

*Phase: 3-Signal instrument state*
*Context gathered: 2026-08-05*
