# DX7 Algorithm Lab — Angular 22 + Claude Code + GSD Core

This kit is designed for a greenfield repository managed by Claude Code through Open-GSD's GSD Core workflow.

## Recommended workflow: let GSD create the Angular project

Start from an empty Git repository so the scaffold, architecture, and first vertical slice are all planned and committed through GSD.

```bash
mkdir dx7-algorithm-lab
cd dx7-algorithm-lab
git init

git branch -M main

# Install GSD Core only in this repository.
npx @opengsd/gsd-core@latest --claude --local

# Copy this starter kit's CLAUDE.md and docs/ into the repository.
# Then launch or restart Claude Code from the repository root.
claude
```

Inside Claude Code:

```text
/gsd-new-project
```

When GSD asks **“What do you want to build?”**, paste the entire contents of `GSD_NEW_PROJECT_PROMPT.md`.

Then follow the phase loop:

```text
/gsd-discuss-phase 1
/gsd-plan-phase 1
/gsd-execute-phase 1
/gsd-verify-work 1
/gsd-ship 1
```

Repeat for later phases. Let GSD's generated `.planning/` files be the source of truth. The roadmap in `docs/ROADMAP_SEED.md` is a seed, not a replacement for GSD planning.

## Angular scaffold that Phase 1 should create

GSD/Claude should run this from the empty repository root:

```bash
npx @angular/cli@22 new dx7-algorithm-lab \
  --directory=. \
  --routing \
  --style=scss \
  --standalone \
  --strict \
  --test-runner=vitest \
  --zoneless \
  --skip-git \
  --defaults
```

The `--skip-git` flag matters because the repository is already initialized. Do not use Angular's `--minimal` option because it omits the testing setup.

## Alternative workflow: scaffold first, then onboard GSD

Use this only when you already created the Angular workspace yourself.

```bash
npx @angular/cli@22 new dx7-algorithm-lab \
  --routing \
  --style=scss \
  --standalone \
  --strict \
  --test-runner=vitest \
  --zoneless

cd dx7-algorithm-lab
npx @opengsd/gsd-core@latest --claude --local
claude
```

Then run:

```text
/gsd-onboard
```

## First usable milestone

Do not attempt all 32 algorithms or full DX7 compatibility immediately. The first vertical slice should deliver:

1. A polished learning-shell UI.
2. Algorithm 32 as the simplest additive baseline.
3. Algorithm 1 as the first modulation-stack lesson.
4. A playable monophonic keyboard.
5. Six operator controls using Angular signals.
6. A data-driven SVG algorithm diagram.
7. Original generated sound examples.
8. Vitest coverage for topology, state, rendering, and audio-engine boundaries.

## Local verification commands

```bash
npm run build
npm test -- --run
npm run lint
```

Add Playwright later for critical browser/audio interaction smoke tests. Unit tests must not require speakers or real-time audio hardware.
