// Bundles the project's one AudioWorkletProcessor adapter into a
// self-contained, import-free script (Phase 7, RESEARCH.md "Code Examples").
// `format: 'iife'` is load-bearing, not stylistic — ES-module imports inside
// AudioWorkletGlobalScope are not reliably supported across browsers
// (RESEARCH.md Anti-Patterns), so the output must have zero runtime
// `import`/`require` statements. Run via `npm run build:worklet`, and
// automatically before `ng build`/`ng serve`/`ng test` via the `prebuild`/
// `prestart`/`pretest` npm lifecycle hooks (RESEARCH.md Pitfall 6).
//
// The `--harness` flag (Phase 7, plan 07-03) is opt-in and additionally
// bundles the dev-only listening harness to `dev-dist/`, a directory
// entirely outside `public/` — the only directory the production asset
// configuration reads (see `angular.json`'s `harness` build configuration,
// Phase 7 plan 07-04). Because the harness output never lands inside
// `public/`, no default build path can ever copy it into `dist/`,
// regardless of what was built before it or in what order — the guarantee
// holds structurally rather than resting on a convention never to pass this
// flag from a lifecycle hook (which is what 07-VERIFICATION.md's
// harness-then-build regression falsified about the previous layout).
//
// The flagless form below (what `prebuild`/`prestart`/`pretest` invoke)
// additionally removes a legacy `public/dev/` directory unconditionally —
// migration repair for any machine that ran a pre-07-04 `npm run harness`
// and still has that stale directory on disk. `npm run verify:harness-
// isolation` reproduces the exact harness-then-build sequence
// 07-VERIFICATION.md failed on and asserts it clean.
import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, rmdirSync } from 'node:fs';

const buildHarness = process.argv.includes('--harness');

/** Migration repair for pre-07-04 `npm run harness` output. Removes only the
 * known legacy files, then `public/dev` itself only when empty — never a
 * recursive delete of that directory. Literal repo-relative paths only. */
function removeLegacyPublicDevHarnessFiles() {
  rmSync('public/dev/worklet-harness.js', { force: true });
  rmSync('public/dev/worklet-harness.html', { force: true });
  if (existsSync('public/dev') && readdirSync('public/dev').length === 0) {
    rmdirSync('public/dev');
  }
}

removeLegacyPublicDevHarnessFiles();

await build({
  entryPoints: ['worklets/dx7-worklet-processor.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  outfile: 'public/worklets/dx7-worklet-processor.js',
});

if (buildHarness) {
  mkdirSync('dev-dist', { recursive: true });
  await build({
    entryPoints: ['worklets/harness/harness-main.ts'],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    outfile: 'dev-dist/worklet-harness.js',
  });
  copyFileSync('worklets/harness/index.html', 'dev-dist/worklet-harness.html');
}
