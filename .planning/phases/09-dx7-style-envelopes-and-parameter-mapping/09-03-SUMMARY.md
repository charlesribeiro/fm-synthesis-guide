---
phase: 09-dx7-style-envelopes-and-parameter-mapping
plan: 03
subsystem: audio
tags: [dx7, envelope, lessons, fm-synthesis, documentation, vitest]

# Dependency graph
requires:
  - phase: 09-dx7-style-envelopes-and-parameter-mapping
    provides: "Plan 09-01's Dx7Envelope model, EnvelopeGenerator kernel, and setGate wiring end to end"
provides:
  - "Algorithm 1 lesson starting patch with carrier-sustains/modulator-decays envelope differentiation, audible over the life of one held note"
  - "Dataset-iterating shipped-envelope invariants (validation guard, zero release target, frozen) covering every lesson row and DEFAULT_ENVELOPE"
  - "README.md and docs/ARCHITECTURE.md updated to describe the shipped envelope engine without upgrading the standing approximation claim"
affects: [09-04]

# Actuals (#2632)
actuals:
  tokens: 3733
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Role-derived envelope assignment: lessons.ts reads deriveCarriers(algorithm) over the canonical ALGORITHMS dataset to decide which operator gets which envelope, never a hardcoded carrier-id list — the same pattern the file already used in prose for its output-level comment, now made real for envelope assignment"
    - "Shared invariant helper (expectShippedEnvelopeInvariants) applied identically to every lesson-data envelope and to DEFAULT_ENVELOPE itself, so the default and the lesson data are held to one standard rather than two copies that could drift"

key-files:
  created: []
  modified:
    - src/app/domain/dx7/lessons/lessons.ts
    - src/app/domain/dx7/lessons/lessons.spec.ts
    - README.md
    - docs/ARCHITECTURE.md

key-decisions:
  - "Playground finding: confirmed by reading playground.ts and playground.html — Playground is a thin host with no InstrumentPatch construction of its own; it only renders page framing around the shared PlaySurface, which plays whatever InstrumentState holds (the uniform DEFAULT_PATCH on first load, per D-08/D-09/D-11). No Playground change made; per the plan's flagged assumption, the envelope differentiation lands only in the Algorithm 1 lesson's starting patch."
  - "Algorithm 1's two carriers (operators 1 and 3, per deriveCarriers) keep the shared DEFAULT_ENVELOPE reference unchanged. The four modulators (2, 4, 5, 6) get a new ALGORITHM_1_MODULATOR_ENVELOPE: rates [80, 16, 16, 55], levels [99, 70, 40, 0] — attacks slightly faster than the default's 74, decays through a middle level (70), settles at a third-segment level (40) well under half the attack peak, then releases through the same zero target. Decay rates of 16 (not 60) are what make the 99→40 drop take roughly one second under the geometric curve. A held note therefore opens at full modulation brightness and audibly mellows toward the sustain over roughly a second while the carriers hold steady, then releases cleanly."
  - "Carrier/modulator role split for envelope assignment is read from deriveCarriers(ALGORITHMS.find(a => a.id === 1)) at build time, not restated as a literal operator-id list — lessons.ts and the canonical algorithm dataset cannot disagree about which operator gets which envelope."
  - "Documentation sentence considered and rejected: an early draft of the README's engine-description edit read '...faithfully models the DX7's envelope curve...' — rejected during drafting as exactly the kind of upgrade-by-detail the plan's prohibition warns against; the shipped sentence instead says the rate curve is 'an informed approximation, with constants chosen from published measurements of real hardware and tuned by listening, not a reproduction of the DX7's internal ROM tables,' matching envelope-generator.ts's own head-comment framing."

patterns-established: []

requirements-completed: [ENGINE-03]

coverage:
  - id: D1
    description: "Algorithm 1 lesson's starting patch gives its two derived carriers a sustained envelope (DEFAULT_ENVELOPE) and its four derived modulators a decaying envelope (rates 80/16/16/55, levels 99/70/40/0), read from deriveCarriers over the canonical ALGORITHMS dataset rather than a hardcoded operator-id list"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/lessons/lessons.spec.ts#Algorithm 1 lesson envelope differentiation (D-06, T-09-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Algorithm 32 lesson's starting patch keeps one uniform envelope (the shared DEFAULT_ENVELOPE reference) across all six operators, documented as a pedagogical fact (no modulators to contrast against) rather than an oversight"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/lessons/lessons.spec.ts#Algorithm 32 lesson shares the default envelope reference (D-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every envelope shipped in the repository (both lesson starting patches and DEFAULT_ENVELOPE) has a zero release-segment level and passes the same throwing validation guard the user-edit boundary applies, iterated from the dataset so a future Phase 11 lesson inherits the guarantee automatically"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "src/app/domain/dx7/lessons/lessons.spec.ts#Lesson $id ($title) > has every operator's envelope pass the throwing validation guard, have a zero release-segment level, and be frozen (T-09-03)"
        status: pass
      - kind: unit
        ref: "src/app/domain/dx7/lessons/lessons.spec.ts#DEFAULT_ENVELOPE shipped-envelope invariants (T-09-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "README.md and docs/ARCHITECTURE.md describe per-operator envelopes as shipped (Phase 9) rather than roadmap, without upgrading the standing educational-approximation claim into an emulation claim; about.html's user-facing disclaimer is unchanged"
    requirement: "ENGINE-03"
    verification:
      - kind: other
        ref: "grep -rEic 'bit-accurate emulation|exact emulation|accurately emulates|faithful emulation' README.md docs/ARCHITECTURE.md -> 0"
        status: pass
      - kind: other
        ref: "git diff --stat HEAD -- src/app/features/about/about.html -> empty"
        status: pass
    human_judgment: false

# Metrics
duration: ~10min
completed: 2026-08-15
status: complete
---

# Phase 9 Plan 03: Algorithm 1 lesson envelope differentiation and documentation Summary

**Algorithm 1's lesson now demonstrates per-operator timbral evolution — carriers sustain while modulators decay toward a lower level — with every shipped envelope in the repository mechanically guaranteed not to drone or fail the user-edit validation guard, and README/ARCHITECTURE docs updated to describe the shipped envelope engine without claiming DX7 emulation.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- The Algorithm 1 lesson's starting patch now gives its two derived carriers (operators 1 and 3) the shared `DEFAULT_ENVELOPE` and its four derived modulators (2, 4, 5, 6) a new decaying envelope (rates `[80, 16, 16, 55]`, levels `[99, 70, 40, 0]`) — a held note opens at full modulation brightness and audibly mellows over roughly a second as the modulators decay toward their lower sustain while the carriers hold steady, then releases cleanly. The role split is read from `deriveCarriers` over the canonical `ALGORITHMS` dataset, never a hardcoded operator-id list.
- Algorithm 32's starting patch keeps its uniform `DEFAULT_ENVELOPE` reference unchanged across all six operators; its doc comment now states why (no modulation edges exist to differentiate against), so this is documented as a stated pedagogical fact rather than an oversight.
- `lessons.spec.ts`'s dataset-iterating suite now proves, for every lesson row and every one of its six operators: the envelope passes `validateDx7Envelope` without throwing, has a release-segment level of exactly `MIN_ENVELOPE_LEVEL`, and is frozen at every level (the envelope object and both tuples). A dedicated Algorithm 1 case proves the differentiation is real by comparing carrier-derived vs. modulator-derived held-segment levels; a dedicated Algorithm 32 case proves the reference-level sharing with `toBe`; a dedicated `DEFAULT_ENVELOPE` case holds the shared default to the exact same standard.
- README's status line advances to Phase 9 and names per-operator envelopes and the note-lifecycle gate message among what has shipped; its audio-boundary description now states that amplitude shaping happens per operator inside the worklet kernel, and that the rate curve is an informed approximation tuned by listening, not a ROM-table reproduction.
- `docs/ARCHITECTURE.md` marks envelope generators as shipped (naming `envelope-generator.ts`) in both the layer-1 domain list and the AudioWorklet-engine list; the polyphony section's per-voice envelope/note-state item stays roadmap, with one sentence noting the per-instance state shape was chosen not to preclude that future work.

## Task Commits

1. **Task 1: Give the Algorithm 1 lesson a carrier-sustains / modulator-decays envelope pair, and lock every shipped envelope behind invariants** - `a8f8b6b` (test)
2. **Task 2: Bring README and the architecture document in line with the shipped engine without overstating it** - `1b4fe0b` (docs)

_Note: Task 1 is `tdd="true"`. The RED step (differentiation assertion written and confirmed failing against the pre-change uniform Algorithm 1 patch) and the GREEN step (lessons.ts envelope differentiation making it pass) were landed as one commit rather than two separate `test`/`feat` commits, because the differentiation assertion and every other new invariant assertion live in the same file region of the same describe block and were authored, run RED, then made GREEN within one continuous edit — splitting them would have required either committing a spec-only diff that also included the already-passing invariant tests (which never went RED), or hand-separating interleaved test additions from a single logical review unit. The RED verification itself was still performed and recorded (see Deviations/Issues below) before any production code changed; only the commit granularity differs from the RED/GREEN template. This mirrors 09-01-SUMMARY.md's precedent of documenting a deliberate deviation from per-subgroup commit splitting when the plan's own commit suggestion would leave the tree in an awkward intermediate state._

## Files Created/Modified

- `src/app/domain/dx7/lessons/lessons.ts` - `ALGORITHM_1_MODULATOR_ENVELOPE` added; `buildAlgorithm1StartingPatch` now assigns per-operator envelopes by role (derived via `deriveCarriers`), reads carriers from `ALGORITHMS`; `buildAlgorithm32StartingPatch`'s doc comment extended to record the uniform-envelope pedagogical rationale.
- `src/app/domain/dx7/lessons/lessons.spec.ts` - `expectShippedEnvelopeInvariants` helper; three new envelope invariant assertions added to the dataset-iterating suite; three new `describe` blocks (Algorithm 1 differentiation, Algorithm 32 shared reference, `DEFAULT_ENVELOPE` standard).
- `README.md` - Status line advanced to Phase 9; audio-boundary bullet describes per-operator amplitude shaping and the rate-curve approximation.
- `docs/ARCHITECTURE.md` - Envelope generators marked shipped in the layer-1 list and the AudioWorklet-engine list; polyphony section's per-voice envelope item gets one roadmap-preserving sentence.

## Decisions Made

See `key-decisions` in frontmatter for the Playground finding, the exact envelope values shipped and their audible intent, and the documentation sentence considered and rejected as an over-claim.

## Deviations from Plan

### Process note (not a Rule 1-4 deviation)

**Task 1's RED/GREEN commit granularity.** The plan's `<action>` text instructs: "Write the differentiation assertion before changing the lesson data, confirm it fails against the current uniform patch, then make it pass. Record that red step in the summary." This was followed exactly as a *process*: `lessons.spec.ts`'s differentiation case (plus the other new invariant assertions) was written first, `npx ng test --include 'src/app/domain/dx7/lessons/lessons.spec.ts'` was run and showed the differentiation case failing with `AssertionError: expected 99 to be greater than 99` (28 of 29 new/existing tests passing, the differentiation case the sole failure) — confirming the pre-change uniform Algorithm 1 patch does not satisfy the differentiation the lesson is meant to teach. `lessons.ts` was then edited to assign envelopes by derived role, and the same command was re-run, showing all 29 tests passing. Both the spec and production changes were committed together as a single `test(09-03)` commit rather than as separate `test`→`feat` commits, since the tdd_execution template's separate-commit convention did not cleanly apply to a diff where most of the new spec assertions (validation guard, release target, frozen) were never RED in the first place — only the differentiation case was. No production behavior shipped without a preceding, recorded RED confirmation.

**Total deviations:** 0 Rule 1-4 auto-fixes. 1 process note (commit granularity, documented above).
**Impact on plan:** None on scope or correctness — `npm test`, `npm run lint`, and `npm run build` all pass; every acceptance criterion and must-have in the plan is satisfied.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-04 (wave 3, depends on 09-02 and 09-03) can proceed: this plan's Algorithm 1 lesson data and documentation changes are self-contained and do not alter any exported symbol or interface 09-04 would need to react to.
- `REQUIREMENTS.md`'s `ENGINE-03` checkbox is left unchecked by this plan — plan 09-01 and this plan (09-03) both declare `requirements: [ENGINE-03]`, and 09-04 (the phase's final plan) also does; marking the requirement complete is left to the orchestrator once the whole phase's wave sequence finishes, consistent with 09-01-SUMMARY.md's precedent of not touching `REQUIREMENTS.md` itself.
- No blockers.

---
*Phase: 09-dx7-style-envelopes-and-parameter-mapping*
*Completed: 2026-08-15*

## Self-Check: PASSED

- `src/app/domain/dx7/lessons/lessons.ts` — FOUND
- `src/app/domain/dx7/lessons/lessons.spec.ts` — FOUND
- `README.md` — FOUND
- `docs/ARCHITECTURE.md` — FOUND
- Commit `a8f8b6b` — FOUND
- Commit `1b4fe0b` — FOUND
