# Phase 2 Dataset Review — Historical-Fidelity Sign-off

**Prepared:** 2026-08-04 (Plan 02-05, Task 1)
**Initial sign-off:** 2026-08-04 (Plan 02-05, Task 2) — approved as-is.
**Superseding update:** 2026-08-05 — Algorithm 26/27 routing corrected; Algorithm 19 marked
`unresolved` with stated edges restored. The 2026-08-04 "final canon" claim is **not** current —
see Section 5. Algorithms 4 and 6 retain self-loop feedback (D-01); multi-operator return-edge
feedback is out of model scope.
**Scope of this review:** DOMAIN-01 through DOMAIN-04 already pass automatically as of Plan
02-04 — 358 tests green at that gate, `npm run build`/`npm test`/`npm run lint` all exit 0. This
review does **not** re-check those. It concerns one thing no automated test can settle: whether
the routing this dataset encodes is *historically* correct for the real Yamaha DX7. A
consistently wrong row still passes every structural invariant, so this judgement can only be
made by a human looking at the compiled table, per `02-CONTEXT.md` D-09.

Nothing in this document blocks the phase's structural acceptance criteria. A reviewer may
approve without checking every row — the sections below are ordered by risk, highest first, so a
partial review still buys the most confidence per minute spent. Section 4 lists what the test
suite already proves and does not need your attention at all.

---

## Section 1: Reconciled rows (highest risk — read this first)

These 14 rows had an edge list, as originally compiled in `02-RESEARCH.md`'s Routing Reference
Table, that did **not** reproduce that same row's own researched carrier set once run through this
project's carrier-derivation rule (D-05). Plan 02-04 repaired the edge list to match the carrier
set (never the reverse — carrier sets are the higher-confidence fact per `02-RESEARCH.md`'s
Metadata section). Every repair is a documented, non-arbitrary edit; some had exactly one valid
repair (`repaired`), others had a repair that was forced in shape but with one edge whose exact
target was not uniquely determined by the constraints (`ambiguous`, with the alternative recorded
below). Source: `02-04-SUMMARY.md` § Routing Reconciliation Ledger, cross-referenced against
`02-RESEARCH.md` § Routing Reference Table.

| Alg | RESEARCH.md stated edges | Entered edges (`algorithms.ts`) | Forcing constraint | Derived carriers | Status |
|---|---|---|---|---|---|
| 7 | 6→5, 5→4, 4→2, 3→2, 2→1 | 6→5, 5→4, 4→2, 2→1 | Dropped `3→2` — operator 3 is a researched carrier, so it must have zero outgoing edges; the only single-edge removal that reproduces carrier set {1,3}. Leaves operator 3 an isolated node (structurally valid, worth a second look). | [1, 3] | repaired |
| 10 | 6→5, 5→4, 2→1 | 6→5, 5→4, 2→1, 3→2 | Added an edge from operator 3 (had none, contradicting its non-carrier status). Target 1 or 2 both satisfy the constraint; chose `3→2` to match the identical edge shape already established by rows 3/4 (same carrier set {1,4}). **Alternative not chosen: `3→1`.** | [1, 4] | ambiguous |
| 11 | 6→5, 5→4, 2→1 | 6→5, 5→4, 2→1, 3→2 | Same conflict and same choice as row 10. After repair, Algorithm 11 is topologically identical to Algorithms 3 and 4. **Alternative not chosen: `3→1`.** | [1, 4] | ambiguous |
| 15 | 6→5, 5→2, 4→2 | 6→5, 5→2, 4→2, 2→1 | Added `2→1` — operator 2 is a researched non-carrier but had no outgoing edge; 1 is the *only* valid lower target for operator 2, so this addition is forced, not chosen. | [1, 3] | repaired |
| 17 | 6→5, 5→1, 4→3, 3→1 | 6→5, 5→1, 4→3, 3→1, 2→1 | Added `2→1` — same forced-unique-target reasoning as row 15. | [1] | repaired |
| 18 | 6→5, 5→4, 4→1, 2→1 | 6→5, 5→4, 4→1, 2→1, 3→1 | Added an edge from operator 3 (had none, contradicting its non-carrier status). Target 1 or 2 both satisfy the constraint; chose `3→1` to continue the row's existing direct-to-1 fan pattern (`4→1`, `2→1` already go straight to operator 1). **Alternative not chosen: `3→2`.** | [1] | ambiguous |
| 19 | 6→5, 5→4, 5→3, 5→2 | 6→5, 5→4, 5→3, 5→2 *(stated restored 2026-08-05)* | Stop-condition: more than one invented edge. Stated edges retained; does not reproduce researched carriers `{1,4,5}` under `deriveCarriers`. | [1, 2, 3, 4] (researched: [1, 4, 5]) | unresolved |
| 20 | 5→4, 3→2, 2→1, 6→5 | 5→4, 3→2, 6→5 | Removed `2→1` (only edge with `from=2`) — operator 2 is a researched carrier, so it must have zero outgoing edges; unique single-edge removal. | [1, 2, 4] | repaired |
| 21 | 6→5, 3→2, 2→1 | 6→5, 3→2 | Removed `2→1` (only edge with `from=2`) — same reasoning as row 20. | [1, 2, 4, 5] | repaired |
| 23 | 6→5, 5→4 | 6→5, 3→1 | Removed `5→4` (forced — operator 5 is a researched carrier). Operator 3 then needed a new outgoing edge (had none, contradicting non-carrier status); chose `3→1` over the equally valid `3→2` (no distinguishing signal in this row). **Alternative not chosen: `3→2`.** | [1, 2, 4, 5] | ambiguous |
| 24 | 6→5, 5→4 | 6→5 | Removed `5→4` (forced — operator 5 is a researched carrier). | [1, 2, 3, 4, 5] | repaired |
| 25 | 6→5, 5→4 | 6→5 | Same conflict and repair as row 24 (identical resulting topology). | [1, 2, 3, 4, 5] | repaired |
| 26 | 6→5, 5→4, 2→1 | 6→4, 5→4, 3→2 | Corrected 2026-08-05 (D-09 reopen): two modulators into carrier 4 plus 3→2; prior ambiguous 3→1 withdrawn. Carriers `{1,2,4}` preserved. | [1, 2, 4] | repaired |
| 27 | 6→5, 5→4, 2→1 | 6→4, 5→4, 3→2 | Same non-feedback shape as Algorithm 26 after the 2026-08-05 correction. | [1, 2, 4] | repaired |

A reviewer judging only this section has judged the rows most likely to be wrong — every other row
in the dataset was either transcribed verbatim from the primary source (`dxwire`) or is a
MEDIUM-confidence reconstruction that at least didn't contradict its own carrier set.

---

## Section 2: Named open questions

`02-RESEARCH.md` § Open Questions and § Assumptions Log (A2, A3) name three specific yes/no
judgement calls that this project's own research could not resolve alone. Each is stated below so
a reviewer can answer without re-reading the research.

### Q1 — Are Algorithms 3 and 4 genuinely distinct, or the same topology twice?

- **Entered value:** Topologically identical. Both algorithms carry the same edges (6→5, 5→4,
  3→2, 2→1), the same carrier set {1, 4}, and the same feedback operator (6). `algorithms.ts`'s
  name field for Algorithm 4 states this plainly.
- **Alternative:** The two are genuinely distinct real DX7 algorithms with some difference this
  research didn't decode (e.g. a different feedback operator, not visible in the summary fields
  extracted from `dxwire`).
- **Why the entered value was chosen:** `dxwire`'s only per-pair difference is its `fb` field,
  documented in that source's own code comment as a purely cosmetic feedback-loop drawing style
  (`0=none, 1=short, 2=long, 3=medium, 4=left-loop`), not a routing fact. No independent source
  consulted this session gave either algorithm a distinguishing edge or feedback-operator fact.
  *(`02-RESEARCH.md` § Assumptions Log A2, § Open Questions Q1)*

### Q2 — Are Algorithms 5 and 6 likewise genuinely distinct, or the same topology twice?

- **Entered value:** Topologically identical. Both carry edges 6→5, 4→3, 2→1, carrier set
  {1, 3, 5}, feedback operator 6.
- **Alternative:** Same alternative as Q1 — a real hardware difference not captured by the
  sources' summary fields.
- **Why the entered value was chosen:** Same reasoning as Q1 — `dxwire`'s only differentiator
  between the pair is the cosmetic `fb` rendering-style field. *(`02-RESEARCH.md` § Assumptions
  Log A2)*

### Q3 — Is Algorithm 26's carrier set {1, 2, 4} as entered, or the set `yamahablackboxes.com`'s prose implies?

- **Entered value:** {1, 2, 4}, per `dxwire` (this research's primary, most complete source,
  read directly and cross-validated against a second independent source for 5 of the 32 rows).
- **Alternative:** `yamahablackboxes.com`'s prose describes Algorithm 26 differently — "operator
  2 is a carrier with a single modulator, operator 3" — which implies operator 3 modulates
  operator 2 rather than operator 2 being an unmodulated carrier feeding nothing, a shape that
  conflicts with the entered {1, 2, 4} carrier set.
- **Why the entered value was chosen:** `dxwire` is the single most complete, internally
  consistent, directly-read source for all 32 rows this session, whereas the
  `yamahablackboxes.com` description was a WebSearch-summarized prose spot-check, not a
  full-table source. This is a single, contained disagreement — it does not affect any other row.
  *(`02-RESEARCH.md` § Routing Reference Table row 26, § Open Questions Q2)*

---

## Section 3: Reconstructed rows (full-pass option)

These 10 rows are the remaining MEDIUM-confidence rows named in `02-RESEARCH.md` § Assumptions
Log A1 — their carrier set and feedback operator are solid (sourced from `dxwire`), but their
exact intermediate edges were reconstructed from the "higher-modulates-lower" structural rule plus
pattern-matching against higher-confidence rows, not independently re-derived from a second
source. Unlike Section 1, these rows' originally researched edges already reproduced their own
carrier set, so no repair was needed — they are listed here only because their edge order itself
carries the same lower research confidence. Approving without reading this section is a
reasonable choice; Sections 1 and 2 are the high-value part of this review.

| Alg | Entered edges | Derived carriers |
|---|---|---|
| 3 | 6→5, 5→4, 3→2, 2→1 | [1, 4] |
| 4 | 6→5, 5→4, 3→2, 2→1 | [1, 4] |
| 6 | 6→5, 4→3, 2→1 | [1, 3, 5] |
| 12 | 6→5, 5→4, 4→3, 2→1 | [1, 3] |
| 13 | 6→5, 5→4, 4→3, 2→1 | [1, 3] |
| 14 | 6→5, 5→4, 4→3, 2→1 | [1, 3] |
| 16 | 6→5, 5→1, 4→3, 3→1, 2→1 | [1] |
| 28 | 5→4, 4→3, 2→1 | [1, 3, 6] |
| 29 | 6→5, 4→3 | [1, 2, 3, 5] |
| 30 | 5→4, 4→3 | [1, 2, 3, 6] |

---

## Section 4: What the tests already prove (skip this — no reviewer attention needed)

`algorithms.spec.ts`'s test suite already machine-verifies, for all 32 rows, everything below
(except unresolved Algorithm 19's carrier cross-check, which intentionally documents mismatch).
Chronology:
- **Plan 02-04 completion (2026-08-04, historical baseline in `02-04-SUMMARY.md`):** 304 tests in
  `algorithms.spec.ts` (8 tracer, 256 per-algorithm, 5 set-level, 35 structural) out of **358**
  total `npm test` tests across 13 files — this was current at the initial Section 5 sign-off.
- **Code-review fix cycle (`02-REVIEW-FIX.md`, 2026-08-05):** suite rose to **364** total tests
  across 14 files (`algorithms.spec.ts` at 305 with 36 structural cases after the CR-01 nested
  edge-object freeze regression).
- Later sessions may add further cases (e.g. `EXPECTED_EDGES`, unresolved-row handling); treat
  live `npm test` counts as authoritative for the working tree.

Machine-checked properties:

- Exactly 32 algorithms with unique ids covering 1 through 32, no gap.
- Every row passes `validateAlgorithm()` without throwing (structural validity).
- Every row's `deriveCarriers()`/`getFeedbackOperator()` output matches the independently-sourced
  `EXPECTED_CARRIERS`/`EXPECTED_FEEDBACK_OP` cross-check tables (hand-populated from
  `02-RESEARCH.md`, never derived from `ALGORITHMS` itself — T-02-07).
- Every row declares exactly one feedback self-loop.
- Every non-self-loop edge respects the higher-modulates-lower rule (`from > to`).
- No row declares a duplicate edge.
- Every entry and its `edges` array is frozen at module load (mutation attempts throw, dataset
  unchanged).
- Every entry exposes exactly the four `AlgorithmDefinition` members (no smuggled-in precomputed
  role/carrier field).

None of the above is what this review is for. This document exists for the one property that
*none* of these tests can check: whether the entered routing matches real DX7 hardware.

---

## Section 5: Sign-off

**Date:** 2026-08-04 (initial) / **superseded 2026-08-05**
**Initial decision (2026-08-04):** Approved as-is. The 32-row dataset (14 reconciled rows in
Section 1, 10 reconstructed rows in Section 3) was signed off as final canon for Phases 4, 5,
and 6 with no corrections and no unresolved rows.
**Superseding decision (2026-08-05):** The approved-as-is outcome is **not** final canon.
Corrections:
- Algorithms 26 and 27: edges corrected to `6→4, 5→4, 3→2` (+ feedback self-loop), preserving
  carriers `{1,2,4}`.
- Algorithm 19: restored to stated RESEARCH.md edges (`6→5, 5→4, 5→3, 5→2` + feedback);
  status `unresolved` under the multi-invented-edge stop-condition.
- Algorithms 4 and 6: self-loop feedback retained (D-01); no `4→6`/`5→6` return-edge model.

**Named open questions (Section 2) — initial answers retained except where superseded:**
- **Q1 (Algorithms 3 and 4):** Confirmed **same modulation topology** under the self-loop model;
  D-01 does not encode multi-operator return-edge feedback.
- **Q2 (Algorithms 5 and 6):** Same as Q1 for this model.
- **Q3 (Algorithm 26 carriers):** Confirmed **{1, 2, 4} per `dxwire`** — retained; edge list
  corrected 2026-08-05 while preserving that carrier set.

A future reader should treat Section 5's superseding block and `algorithms.ts` provenance
point 5 as the current authority, not the 2026-08-04 "no unresolved rows" sentence alone.
