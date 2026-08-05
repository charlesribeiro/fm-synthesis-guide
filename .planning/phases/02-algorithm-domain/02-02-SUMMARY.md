---
phase: 02-algorithm-domain
plan: 02
subsystem: testing
tags: [eslint, typescript-eslint, flat-config, domain-purity]

# Dependency graph
requires:
  - phase: 02-algorithm-domain
    provides: "src/app/domain/dx7/models/ tree (02-01) — the directory this plan's rule protects"
provides:
  - "Domain-scoped @typescript-eslint/no-restricted-imports override in eslint.config.js banning @angular/* imports (value and type-only) under src/app/domain/**/*.ts"
  - "Negative-control proof that the rule fires: a disposable probe file tripped it, then npm run lint returned to green after the probe was removed"
affects: [02-03, 02-04, 02-05, phase-03-instrument-state, phase-04-algorithm-visualization]

actuals:
  tokens: 430
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "DOMAIN-04 is machine-enforced via a third defineConfig array entry scoped to src/app/domain/**/*.ts, layered after the repo-wide **/*.ts block so the narrower glob overrides it for that subtree only"
    - "@typescript-eslint/no-restricted-imports (not the base ESLint rule) used specifically because it understands allowTypeImports: false — the base rule cannot catch type-only imports"

key-files:
  created: []
  modified:
    - eslint.config.js

key-decisions:
  - "Rule scoped via a third array element in defineConfig([...]) rather than editing the existing **/*.ts block's rules object — keeps the domain restriction additive and easy to remove/relocate without touching the framework-wide config"
  - "Negative-control probe (src/app/domain/dx7/models/__lint-probe.ts) was written, proven to trip the gate, then deleted unconditionally before any assertion ran — per plan instruction, nothing about the probe was committed; only this SUMMARY records the observed result"

patterns-established:
  - "Domain-purity enforcement pattern: any future domain-scoped ESLint restriction should follow the same third-array-entry shape (files glob narrower than the repo-wide block, rule set to 'error', message names the requirement ID it enforces)"

requirements-completed: [DOMAIN-04]

coverage:
  - id: D1
    description: "npm run lint fails with a nonzero exit code when a file under src/app/domain/ imports an Angular scoped package, including a type-only import — proven by negative control, not assumed"
    requirement: "DOMAIN-04"
    verification:
      - kind: other
        ref: "manual negative-control run: printf probe file with `import type { Injector } from \"@angular/core\"` under src/app/domain/dx7/models/__lint-probe.ts, then `npm run lint` — RC=1, output contained 'DOMAIN-04'"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm run lint exits 0 against the domain tree as it actually stands (live gate, not permanently red) — both before adding the rule and again immediately after the probe was deleted"
    requirement: "DOMAIN-04"
    verification:
      - kind: other
        ref: "npm run lint (baseline before Task 1, after Task 1, and again after probe removal in Task 2) — all three runs: 'All files pass linting.'"
        status: pass
    human_judgment: false
  - id: D3
    description: "The rule's violation message names DOMAIN-04 and explains the constraint in project terms, so a future contributor learns why rather than deleting the rule"
    requirement: "DOMAIN-04"
    verification:
      - kind: other
        ref: "eslint.config.js message string; observed verbatim in the negative-control lint output (see Negative-Control Result below)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The restriction is scoped to src/app/domain/ only — Angular imports elsewhere in src/app/ remain legal"
    requirement: "DOMAIN-04"
    verification:
      - kind: other
        ref: "eslint.config.js files: ['src/app/domain/**/*.ts'] glob on the new array entry, layered after (not replacing) the repo-wide **/*.ts block"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-04
status: complete
---

# Phase 02, Plan 02: ESLint Domain-Purity Gate Summary

**A domain-scoped `@typescript-eslint/no-restricted-imports` override in `eslint.config.js` that fails `npm run lint` on any Angular import (value or type-only) under `src/app/domain/`, proven to fire by a disposable negative-control probe rather than assumed to work.**

## Performance

- **Duration:** 12min
- **Started:** 2026-08-04T23:44:00Z
- **Completed:** 2026-08-04T23:47:30Z
- **Tasks:** 2
- **Files modified:** 1 (`eslint.config.js`)

## Accomplishments
- Added a third `defineConfig` array entry to `eslint.config.js`, scoped to `files: ['src/app/domain/**/*.ts']`, that turns off the base `no-restricted-imports` rule and enables `@typescript-eslint/no-restricted-imports` at `error` with a `patterns` group matching `@angular/*` and `@angular/*/**`, `allowTypeImports: false`.
- Verified `npm run lint`, `grep -c` acceptance criteria, and `node -e "require('./eslint.config.js')"` all pass with the rule in place, against the repository as it currently stands (zero pre-existing Angular imports in the domain tree — the gate is live, not permanently red).
- Ran a disposable negative-control probe (`src/app/domain/dx7/models/__lint-probe.ts`, a type-only import of `Injector` from `@angular/core`) to prove the gate actually fires rather than assuming a glob match. Captured the failing exit code and message, deleted the probe unconditionally, then re-ran lint to confirm it returns to green. No probe residue committed or left on disk.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a domain-scoped no-restricted-imports override to the flat ESLint config** - `5de3c72` (feat)
2. **Task 2: Prove the gate fires with a disposable negative control** - no commit (by design — the plan requires the probe be written, observed, and deleted without ever being committed; the only durable record is this SUMMARY)

## Exact Rule Configuration Added

```js
{
  files: ['src/app/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': 'off',
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@angular/*', '@angular/*/**'],
            message:
              'DOMAIN-04: domain logic (graph, frequency, envelope, patch, DSP) must stay ' +
              'framework-independent of Angular. Put the Angular dependency behind an ' +
              'injected boundary under src/app/core/ instead of importing it here.',
            allowTypeImports: false,
          },
        ],
      },
    ],
  },
},
```

This is appended as the third element of the `defineConfig([...])` array in `eslint.config.js`, after the existing `**/*.ts` and `**/*.html` blocks, so it layers a narrower restriction on top of the repo-wide TypeScript config for files matching `src/app/domain/**/*.ts` only.

## Negative-Control Result (Task 2)

**Probe file:** `src/app/domain/dx7/models/__lint-probe.ts` (transient, never committed)
```ts
import type { Injector } from "@angular/core";
export type LintProbe = Injector;
```

**Run 1 — probe present:**
- Exit code: `1` (nonzero, as required)
- Violation message (verbatim from `npm run lint` output):
  ```text
  src/app/domain/dx7/models/__lint-probe.ts
    1:1  error  '@angular/core' import is restricted from being used by a pattern. DOMAIN-04: domain logic (graph, frequency, envelope, patch, DSP) must stay framework-independent of Angular. Put the Angular dependency behind an injected boundary under src/app/core/ instead of importing it here  @typescript-eslint/no-restricted-imports

  ✖ 1 problem (1 error, 0 warnings)
  ```
  (Path normalized to repository-relative; original lint output used an absolute workstation path.)

**Run 2 — probe deleted:**
- Exit code: `0`
- Output: `All files pass linting.`

This confirms: (a) the glob `src/app/domain/**/*.ts` covers `src/app/domain/dx7/models/`, (b) `allowTypeImports: false` catches a type-only import, not just a value import, and (c) the rule does not leave the tree permanently red — it only fires on an actual violation.

## Files Created/Modified
- `eslint.config.js` - added the domain-scoped `no-restricted-imports` override (third `defineConfig` array entry); no other files changed. The probe file used in Task 2 was created and deleted within the same task and never committed.

## Decisions Made
- Scoped the rule as a new third array entry in `defineConfig([...])` rather than modifying the existing repo-wide `**/*.ts` block's `rules` object — flat config resolves overlapping glob matches by merging in array order, so a narrower `files` glob appended later cleanly layers additional restrictions onto the matching subtree without touching the framework-wide block that every other `.ts` file (including Angular components/services) still needs.
- Used `@typescript-eslint/no-restricted-imports` instead of the base ESLint `no-restricted-imports`, and explicitly set the base rule to `'off'` in the same block — this is the standard typescript-eslint extension-rule pairing, required here because only the typescript-eslint variant understands `allowTypeImports` and can flag a type-only import.
- Did not add an `ignorePatterns` or per-file disable comment, and did not carve out domain `.spec.ts` files from the restriction — per the plan's explicit prohibition, domain spec files are held to the same DOMAIN-04 constraint as production domain code.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 auto-fixes were needed; the baseline lint state was already green, the rule change didn't require any pre-existing code changes, and the negative control confirmed the rule works on the first attempt (no glob adjustment needed).

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- DOMAIN-04 is now machine-enforced: `npm run lint` will fail with a `DOMAIN-04`-labeled message if any future edit under `src/app/domain/` (including 02-03's remaining validation work and 02-04's 30 additional dataset rows) introduces an Angular import, value or type-only.
- Plan 02-05's phase-gate re-run of `npm run lint` can rely on this rule being present and correctly scoped; no further action needed from that plan regarding this gate.
- No blockers. `npm run lint`, `npm test`, and `npm run build` all exit 0 as of this plan's completion.

---
*Phase: 02-algorithm-domain*
*Completed: 2026-08-04*

## Self-Check: PASSED

- FOUND: eslint.config.js
- FOUND: .planning/phases/02-algorithm-domain/02-02-SUMMARY.md
- FOUND: commit 5de3c72
- PASS: no `__lint-probe` residue under src/app/domain/ (`git status --porcelain src/app/domain/` empty)
