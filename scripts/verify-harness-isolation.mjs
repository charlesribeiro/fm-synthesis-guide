#!/usr/bin/env node
// The realistic build-order regression gate (Phase 7, plan 07-04).
// Reproduces 07-VERIFICATION.md's exact failing sequence — `npm run
// harness`, then a plain `npm run build`, with NO manual cleanup in
// between — and asserts the result is harness-free. Also covers the other
// build configuration reachable from `package.json` (development) and
// runs a positive control proving the harness itself still builds and
// resolves at its original URL, so this gate cannot be satisfied by
// silently breaking the harness.
//
// Runs three non-watch builds end to end (~tens of seconds); intentionally
// NOT wired into any lifecycle hook — run on demand via
// `npm run verify:harness-isolation`.
import { existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoHarnessInDist } from './assert-no-harness-in-dist.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

const DEV_DIST_JS = join(root, 'dev-dist/worklet-harness.js');
const DEV_DIST_HTML = join(root, 'dev-dist/worklet-harness.html');
const DIST_PROD = join(root, 'dist');
const TMP_DEV = join(root, '.tmp-harness-dist-dev');
const TMP_HARNESS = join(root, '.tmp-harness-dist');

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit', shell: isWindows });
}

function fail(stage, message) {
  console.error(`verify-harness-isolation: FAILED at ${stage} — ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function cleanup() {
  rmSync(TMP_DEV, { recursive: true, force: true });
  rmSync(TMP_HARNESS, { recursive: true, force: true });
}

try {
  // Stage 1 — the realistic harness-then-build sequence 07-VERIFICATION.md
  // reproduced as a failure. No cleanup between the two commands: that
  // absence is the entire point of this stage.
  console.log('verify-harness-isolation: stage 1 — harness build, then plain build, no cleanup');
  run('npm', ['run', 'harness']);
  if (!existsSync(DEV_DIST_JS) || !existsSync(DEV_DIST_HTML)) {
    fail('stage 1', 'npm run harness did not produce dev-dist/worklet-harness.{js,html}');
  }
  run('npm', ['run', 'build']);
  try {
    assertNoHarnessInDist(DIST_PROD);
  } catch (error) {
    fail('stage 1', error.message);
  }
  console.log('verify-harness-isolation: stage 1 passed');

  // Stage 2 — the other build configuration reachable from package.json
  // (the non-watch equivalent of the `watch` script).
  console.log('verify-harness-isolation: stage 2 — development configuration build');
  rmSync(TMP_DEV, { recursive: true, force: true });
  run('npx', ['ng', 'build', '--configuration', 'development', '--output-path', '.tmp-harness-dist-dev']);
  try {
    assertNoHarnessInDist(TMP_DEV);
  } catch (error) {
    fail('stage 2', error.message);
  }
  console.log('verify-harness-isolation: stage 2 passed');

  // Stage 3 — positive control: the harness build configuration must still
  // produce the harness at its documented URL, so this gate cannot be
  // satisfied by simply breaking or removing the harness.
  console.log('verify-harness-isolation: stage 3 — harness configuration positive control');
  rmSync(TMP_HARNESS, { recursive: true, force: true });
  run('npx', ['ng', 'build', '--configuration', 'harness', '--output-path', '.tmp-harness-dist']);
  const harnessHtml = join(TMP_HARNESS, 'browser/dev/worklet-harness.html');
  const harnessJs = join(TMP_HARNESS, 'browser/dev/worklet-harness.js');
  const processorJs = join(TMP_HARNESS, 'browser/worklets/dx7-worklet-processor.js');
  for (const [label, path] of [
    ['dev/worklet-harness.html', harnessHtml],
    ['dev/worklet-harness.js', harnessJs],
    ['worklets/dx7-worklet-processor.js', processorJs],
  ]) {
    if (!existsSync(path)) {
      fail('stage 3', `expected ${label} at ${path} but it does not exist`);
    }
  }
  console.log('verify-harness-isolation: stage 3 passed');

  console.log('verify-harness-isolation: ok — all three stages passed');
} finally {
  cleanup();
}
