# Release readiness and verification methodology

## Current release status

Canonical production URL: https://charlesribeiro.github.io/fm-synthesis-guide/

Phase 14 implementation is ready for review; public deployment verification is pending
merge and the first successful main CI/deployment run. Repository Pages settings have
been read back as `build_type: workflow` and `https_enforced: true`. Configuration is
not publication. RELEASE-01 remains open until the live checks below pass.

## Reproduce the gates

Use Node 22 (as in CI), `npm ci`, then `npx playwright install --with-deps chromium`.
Installing Linux browser system dependencies may require administrator privileges.
Do not skip tests if installation fails; report the missing dependency.

Run `npm test -- --watch=false`, `npm run lint`, `npm run build`, and `npm run e2e`.
Also run `npm run verify:harness-isolation` for the development-harness isolation regression.
Build/test/start hooks rebuild and typecheck the worklet. CI retains the existing
harness isolation and worklet typecheck gates in addition to the browser tests.

Playwright starts the normal Angular app on 127.0.0.1:4201 and builds/serves the
production Pages artifact on 127.0.0.1:4202/fm-synthesis-guide/. Neither reuses an
existing server. The independent LAN preview on port 4200 is left running.
`npm run build:pages` builds production with `--base-href /fm-synthesis-guide/`, runs
normal pre/postbuild safeguards, then prepares the 404 shell and publishes the two
Markdown documentation files under `docs/`. Output: `dist/pages/browser/`.

Failure screenshots/traces are retained; `npx playwright show-report` opens the report.
Reports and caches are gitignored. CI uploads browser evidence for 14 days. CI runs
on every push and pull request, preserving all earlier quality gates. Both browser
projects exercise real audio; two extra Pages tests cover deep links/resources/docs.

## What the tests establish

- Vitest tests pure graph/DSP behavior, Angular components and browser adapters with
  deterministic browser-boundary fakes. It cannot establish real AudioWorklet rendering.
- Chromium smoke tests exercise the actual app and worklet bundle: navigation, the
  audio gesture gate, pointer and computer-keyboard note lifecycle, switching lesson
  algorithms, and leaving a lesson while a note remains held.
- The audio probe reads the real engine analyser's float samples. It does not replace
  the AudioContext, processor, rendering, or requests. Polling requires nonzero audio
  during notes and near-silence after release/route teardown, with an envelope-release
  allowance. This establishes rendering/lifecycle behavior, not perceived sound quality
  or bit-accurate DX7 emulation.
- Browser console errors and uncaught exceptions fail the smoke tests.
- Browser coverage is Chromium only. Safari/WebKit, Firefox, physical MIDI devices,
  touch behavior and subjective listening remain manual checks, not implied passes.

## Deployment architecture and GitHub Pages limitations

`.github/workflows/ci.yml` runs lint, all unit tests, production build, harness isolation,
worklet typecheck and all Playwright tests. Only a push to main uploads the verified
`dist/pages/browser/` artifact. Its deployment job depends on the successful verify job
and calls `.github/workflows/deploy-pages.yml`. That reusable workflow uses
`actions/deploy-pages` in the `github-pages` environment with Pages-write/OIDC permissions.
PR/feature-branch runs cannot deploy. No rebuild occurs between test and artifact upload.
Development servers, harnesses, credentials and source code are not deployed.

The Angular base href controls router and asset URLs. The worklet DI token resolves a
fixed filename against `DOCUMENT.baseURI` (not the current deep route or a user-supplied
URL). Root-origin development remains supported. Architecture and methodology are
published at `docs/ARCHITECTURE.md` and `docs/RELEASE.md` below the production URL.
Markdown files are served as static documentation, not a separate generated docs site.

GitHub Pages has no SPA rewrite configuration. The build copies the exact application
shell to `404.html`, so direct `/learn/algorithm-32`, `/algorithms/1`, `/settings`, etc.
load Angular at the original URL, including query strings. The initial response still
has HTTP 404; this is an SEO/link-checking limitation, not an asset failure. Subsequent
client navigation is normal. Tests explicitly assert the 404 contract; only that exact
document console error is exempted, never missing JS/worklet assets or runtime errors.
This approach preserves existing clean routes instead of changing all URLs to hashes.

The deployed HTTPS site is the canonical environment for manual audio validation.
LAN HTTP is for UI/layout review: AudioWorklet and Web MIDI generally require a secure
context outside localhost. Do not expose the development server publicly.

## Exact post-merge activation and verification

1. A maintainer merges the reviewed single-commit PR. The agent must not merge it.
2. In repository Settings → Pages, confirm Source = GitHub Actions (already configured).
   Approve the `github-pages` environment deployment if repository rules request it.
3. Wait for CI on the merged main commit, including its reusable deployment job. If a
   transient failure occurs, rerun that CI run from Actions; never bypass failed gates.
4. Confirm the root URL is HTTP 200 over HTTPS. Confirm
   `/fm-synthesis-guide/worklets/dx7-worklet-processor.js` is HTTP 200 with JavaScript
   MIME type; both `/fm-synthesis-guide/docs/ARCHITECTURE.md` and `docs/RELEASE.md` are 200.
5. With dependencies and Chromium installed, run against the live deployment:
   `PAGES_BASE_URL=https://charlesribeiro.github.io/fm-synthesis-guide/ npm run e2e -- --project=pages-chromium`
   This runs all five Pages cases against HTTPS, including actual audio output. Local
   support servers still start but are not the selected project's target.
6. Open `/learn/algorithm-32?source=bookmark`, reload, enable audio and play/release;
   switch to Algorithm 1. The document's expected 404 must not prevent rendering.
   Verify JS/worklet resources are successful, then perform Safari/iPad checks below.
7. Record deployment run URL, deployed main SHA, HTTPS browser results and documentation
   URLs in `14-VERIFICATION.md`. Only then mark RELEASE-01/Phase 14 complete.

## Remaining manual release checks

- Mac Safari and iPad Safari over HTTPS: audio enable, note release, tab/background
  recovery, touch target usability and rotation.
- Keyboard-only lesson completion, VoiceOver announcements and reduced-motion mode.
- Real MIDI note on/off/velocity, device disconnect and permission denial.
- Audible quality, comfortable volume and no clicks/stuck notes (begin at low volume).
- Fresh/reloaded deep links and worklet requests on the final static host.
- Persistence/import/export across reload in the supported browsers.

## Third-party additions

`@playwright/test`, `playwright`, and `playwright-core` are Apache-2.0 development-only
packages; `@types/node` and its `undici-types` dependency are MIT licensed. Exact
versions and license metadata are recorded in `package-lock.json`. No browser binary,
patch ROM, sample song, copied diagram or copyrighted bank is shipped with the app.
