---
schema_version: 1
open_count: 0
waived_count: 0
fixed_count: 1
total_count: 1
last_updated: 2026-08-06T16:15:00.000Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 04 | deviation | src/app/features/algorithms/algorithms.spec.ts |  | Plan named Algorithm 7 for the browse-to-detail round-trip test; substituted Algorithm 1 because Algorithm 7's layout record is authored by sibling wave-2 Plan 02 in a separate worktree not yet merged | fixed | Round-trip now follows Algorithm 7's rendered link and asserts Algorithm 7 detail content after all 32 layouts are present | 2026-08-06T12:45:38.641Z | 2026-08-06T16:15:00.000Z |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "04",
    "file": "src/app/features/algorithms/algorithms.spec.ts",
    "line": null,
    "description": "Plan named Algorithm 7 for the browse-to-detail round-trip test; substituted Algorithm 1 because Algorithm 7's layout record is authored by sibling wave-2 Plan 02 in a separate worktree not yet merged",
    "status": "fixed",
    "reason": "Round-trip now follows Algorithm 7's rendered link and asserts Algorithm 7 detail content after all 32 layouts are present",
    "recorded_at": "2026-08-06T12:45:38.641Z",
    "resolved_at": "2026-08-06T16:15:00.000Z"
  }
]
````
