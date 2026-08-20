#!/usr/bin/env node
// Fail-closed assertion that a built output tree contains no harness
// artifact (Phase 7, plan 07-04). Exported for reuse by
// scripts/verify-harness-isolation.mjs and runnable directly as a CLI via
// `npm run postbuild` (wired automatically after every `npm run build`).
//
// Walks `distRoot` recursively and collects every path that is either a
// directory named `dev` or a file named `worklet-harness.js` or
// `worklet-harness.html`. Throws when the collection is non-empty, and
// also throws when `distRoot` does not exist at all — a missing output
// tree means the assertion had nothing to inspect, and reporting success
// there would be exactly the vacuous green this gate exists to eliminate.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS_FILE_NAMES = new Set(['worklet-harness.js', 'worklet-harness.html']);

function collectHarnessArtifacts(dir, offenders) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (basename(fullPath) === 'dev') {
        offenders.push(fullPath);
        continue;
      }
      collectHarnessArtifacts(fullPath, offenders);
    } else if (HARNESS_FILE_NAMES.has(basename(fullPath))) {
      offenders.push(fullPath);
    }
  }
}

export function assertNoHarnessInDist(distRoot) {
  if (!existsSync(distRoot)) {
    throw new Error(
      `assertNoHarnessInDist: output tree "${distRoot}" does not exist — nothing to assert against`,
    );
  }

  const offenders = [];
  collectHarnessArtifacts(distRoot, offenders);

  if (offenders.length > 0) {
    throw new Error(
      `assertNoHarnessInDist: harness artifact(s) leaked into "${distRoot}":\n${offenders
        .map((path) => `  - ${path}`)
        .join('\n')}`,
    );
  }
}

function invokedAsCli() {
  const entry = process.argv[1];
  if (typeof entry !== 'string' || entry.length === 0) {
    return false;
  }
  try {
    return fileURLToPath(import.meta.url).toLowerCase() === resolve(entry).toLowerCase();
  } catch {
    return false;
  }
}

if (invokedAsCli()) {
  const distRoot = process.argv[2] ?? 'dist';
  try {
    assertNoHarnessInDist(distRoot);
    console.log(`assert-no-harness-in-dist: ok — no harness artifact under "${distRoot}"`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
