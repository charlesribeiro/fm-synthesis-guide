---
phase: 14-playwright-release
plan: 01
status: implementation_complete_deployment_pending
requirements: [RELEASE-01]
---
# Phase 14 plan 01 — review-ready implementation

## Scope and preserved work

Resumed from uncommitted Phase 14 work at 7ff71ae on the mandated feature branch.
Preserved the installed Playwright dependencies, original two smoke journeys and plan.
No Phase 13 work was repeated. Restored CI checks/security that the interrupted edit
had accidentally removed; removed its redundant generated browser workflow.

## Delivered

- Normal-app Chromium smoke coverage plus identical real-audio journeys against a
  production build under /fm-synthesis-guide/. Dedicated loopback ports 4201/4202
  never reuse the LAN preview. All 8 tests pass (3 dev, 5 production Pages).
- Real analyser checks for sound/release silence, algorithm switching and route cleanup.
  Pages deep-link reload, fixed worklet path/MIME and documentation publication checks.
- Strict E2E typechecking and lint. CI retains every original quality gate.
- Build-time Pages base href; fixed worklet URL resolved using injected DOCUMENT.baseURI.
  Two regression tests observed failing before the fix, then passing with the fix.
- 404.html SPA shell preserving clean routes/query strings, with documented HTTP 404
  limitation. No hash routing or dynamic redirect script introduced.
- Pages workflow deploys the tested artifact after all CI gates on main push only.
  PR and feature runs never deploy. No main commit, merge or public dev-server tunnel.
- README, architecture and release methodology updated; docs copied into Pages artifact.

## Final local evidence (2026-09-21)

- Unit/component: 2108 passed in 60 files.
- Lint: passed (Angular, templates, E2E/config).
- Production build: passed, 112.07 kB initial; worklet typechecks passed.
- Harness isolation: all three stages passed.
- E2E: 8 passed; production subpath build included; no skipped tests.

One development test initially waited for a page response event for a worklet module.
Trace/snapshot showed the engine ready but no such network event; replaced the invalid
observation mechanism with direct HTTP/MIME checks plus real engine initialization.
Audio rendering assertions remain in the shared smoke suite; no audio was mocked.

## Hosting state and remaining acceptance

User selected https://charlesribeiro.github.io/fm-synthesis-guide/ and explicitly allowed
review before publication when main is needed. Configured Pages via API and read it back:
workflow build type, HTTPS enforced, correct URL. Public root still returns HTTP 404;
this is NOT a verified deployment. The workflow must reach main before its main-only
publication path executes. RELEASE-01 stays open until live HTTPS tests pass.

Exact post-merge steps and live Pages test command are in docs/RELEASE.md. Remaining
manual checks: Safari/iPad, VoiceOver, real MIDI, touch and subjective listening.
LAN preview kept running at http://192.168.31.36:4200/ for UI review.
