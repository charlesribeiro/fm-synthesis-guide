#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d .git ]]; then
  echo "This script expects to run inside an initialized Git repository." >&2
  echo "Run: git init && git branch -M main" >&2
  exit 1
fi

if [[ -f package.json || -f angular.json ]]; then
  echo "This repository already looks scaffolded." >&2
  echo "Install GSD, then use /gsd-onboard instead of /gsd-new-project." >&2
fi

npx @opengsd/gsd-core@latest --claude --local

cat <<'MSG'

GSD Core is installed locally.

Next:
  1. Copy CLAUDE.md and docs/ from the starter kit into this repository.
  2. Start or restart Claude Code here: claude
  3. Run: /gsd-new-project
  4. Paste GSD_NEW_PROJECT_PROMPT.md when asked what to build.
MSG
