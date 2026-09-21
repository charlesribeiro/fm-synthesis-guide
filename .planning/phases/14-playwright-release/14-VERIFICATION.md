---
phase: 14-playwright-release
status: deployment_pending
requirements: [RELEASE-01]
---
# RELEASE-01 verification — 2026-09-21

| Roadmap criterion | Evidence | Status |
| --- | --- | --- |
| Playwright covers audio enable, note lifecycle and algorithm switching without errors | 8 local Chromium tests (3 dev/5 Pages production), real analyser energy/silence and route cleanup; browser errors checked | Passed locally |
| CI runs build/test/lint/Playwright on every change | Every push/PR triggers all original gates plus browser tests, including typecheck and harness isolation | Implemented; remote result belongs to PR checks |
| App deployed to static hosting with architecture/methodology docs published | Production subpath artifact and docs tested; Pages configured for Actions/HTTPS; canonical public URL still 404 | Pending main deployment and live verification |

RELEASE-01 and Phase 14 are NOT marked complete. User authorized a review-ready PR
before publication, with no agent merge. A workflow file or Pages setting is not proof
of deployment.

## Final local gates

- Unit/component: 2108/2108, 60 files.
- Lint: passed, including E2E/config.
- Production build: passed; initial 112.07 kB; worklet typechecks passed.
- E2E: 8/8 Chromium; strict TypeScript passed; production base path tested.
- Harness isolation: all three stages passed.
- New URL regressions: two failures observed before fix, then both passed.

## Publication and closure checklist

1. Maintainer merges PR after review (agent must not merge).
2. Pages Source is GitHub Actions (API read-back already confirms it); approve environment
   if required. Main CI must pass every gate before its deploy job runs.
3. Verify https://charlesribeiro.github.io/fm-synthesis-guide/ is HTTP 200 over HTTPS.
4. Verify worklets/dx7-worklet-processor.js is 200/JavaScript under that prefix, and
   docs/ARCHITECTURE.md plus docs/RELEASE.md are published.
5. Run `PAGES_BASE_URL=https://charlesribeiro.github.io/fm-synthesis-guide/ npm run e2e -- --project=pages-chromium`.
6. Record successful Actions deployment URL, deployed main SHA and live browser results
   here, then mark the roadmap, requirement and state complete.

Direct deep links intentionally receive the custom 404 shell and retain HTTP 404 while
Angular renders correctly. This is a documented Pages/SEO limitation, not a passed-off
resource failure. Only this exact document error is excepted by the smoke collector.

## Manual checks

Use deployed HTTPS for real audio; LAN HTTP preview is UI-only on most browsers.
Repeat Safari/iPad touch, VoiceOver, reduced motion, real MIDI and low-volume listening
checks from docs/RELEASE.md. Headless Chromium is not evidence for those devices.
