# Phase 7 — API Coverage Declaration

**Gate:** `workflow.api_coverage_gate`
**Detector verdict:** `detected: true`
**Planner verdict:** false positive — no matrix required.

No external API integration: the detector's single signal is the phrase "Web Audio API" appearing in
prose inside `07-CONTEXT.md` ("jsdom has no Web Audio API at all"), and the Web Audio API /
`AudioWorklet` is a browser-native platform API, not a third-party SDK, service, or network endpoint.

Re-read of the phase scope confirms it: this phase ships a pure DSP kernel
(`src/app/domain/dx7/dsp/`), a browser-native `AudioWorkletProcessor` adapter, an `esbuild` build
step, and a main-thread `SynthEngine` implementation. There is no HTTP client, no REST/GraphQL/gRPC
endpoint, no OAuth, no webhook, no MCP server, and no vendor SDK anywhere in scope. The app has no
backend at all (`RELEASE-01`: static hosting), so there is no API surface whose coverage could be
opted into or out of.

The two packages this phase adds (`esbuild`, `@types/audioworklet`) are build-time tooling, not
integrations; their legitimacy is handled by the package-legitimacy gate and the blocking checkpoint
in `07-01-PLAN.md`, not by this file.
