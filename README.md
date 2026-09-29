<p align="center">
  <a href="https://leracherry.github.io/tracelens/">
    <img src="docs/public/logo.png" alt="TraceLens" width="144" />
  </a>
</p>
<h1 align="center">TraceLens</h1>
<p align="center"><strong>Real-user performance debugging for frontend engineers.</strong></p>

[![CI](https://github.com/leracherry/tracelens/actions/workflows/ci.yml/badge.svg)](https://github.com/leracherry/tracelens/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40leracherry%2Ftracelens-browser?label=npm&color=1683f4)](https://www.npmjs.com/package/@leracherry/tracelens-browser)
[![GitHub release](https://img.shields.io/github/v/release/leracherry/tracelens?color=a9c9f5)](https://github.com/leracherry/tracelens/releases)
[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-0863c5)](https://leracherry.github.io/tracelens/)
[![License: MIT](https://img.shields.io/badge/license-MIT-8c9891.svg)](LICENSE)

Find the interaction. Find the frame. Find the component. Find the release.

[Get started](#quick-start) · [Documentation](https://leracherry.github.io/tracelens/) · [Playground](#try-the-playground) · [Contribute](CONTRIBUTING.md)

TraceLens turns browser performance telemetry into an explanation: which interaction was slow, where its time went, what React rendered, which request overlapped it, and which release introduced the regression.

![TraceLens Studio interaction view showing a 487 ms Save settings interaction correlated with browser, React, custom, network, layout, and source-mapped script work](docs/assets/studio-interaction.png)

<p align="center"><em>One interaction, from input delay to its source-mapped long-frame contributor.</em></p>

<details>
<summary>Watch the Studio demo: interactions → correlated work → release comparison</summary>

![Animated Studio tour: select Save settings, inspect its correlated work, then compare releases in ReleaseScope](docs/assets/studio-demo.gif)

Actual Studio views with deterministic, synthetic telemetry; three views held for three seconds each. Collapse this section to stop viewing the animation. The screenshots above and below provide static alternatives. [Reproduce the demo](CONTRIBUTING.md#product-screenshots-and-demo).

</details>

## Quick start

Requires Node.js 22+ for the CLI. Packages ship compiled ESM and TypeScript declarations.

Starting with v0.2.1, both registries use `@leracherry/tracelens-*`. See [registry setup](docs/guides/publishing.md) for the authenticated GitHub Packages mirror.

```bash
npm install @leracherry/tracelens-browser
npx @leracherry/tracelens-cli@0.4.0 studio
```

Open http://127.0.0.1:4173 and initialize the SDK in your application's browser entry point:

```ts
import { init } from '@leracherry/tracelens-browser';

init({
  app: 'dashboard',
  release: '1.0.0',
  environment: 'development',
  endpoint: 'http://127.0.0.1:4173/__tracelens',
});
```

Click an instrumented control, then inspect its timing and correlated work in Studio. The CLI includes the built Studio; a repository checkout is not required.

## Follow the evidence

- Browser interaction timing with input, processing, and presentation breakdowns.
- Web Vitals, long animation frames, fetch/XHR timing, layout shifts, and custom spans.
- React profiler boundaries, component timings, and render counts.
- Vite injection of release, commit, environment, and build timestamp.
- ReleaseScope comparisons with route, interaction, and component deltas.
- CLI commands for Studio, trace inspection, release comparison, and diagnostics.
- Configurable URL/element privacy controls and a heuristic privacy audit.
- OTLP/HTTP trace export and opt-in, origin-allowlisted fetch propagation.
- Release-bound source-map resolution with original file locations and safe GitHub links.
- Release and route performance budgets with text and CI-ready JSON reports.
- A reusable GitHub Action with check runs, job summaries, artifacts, and deduplicated PR comments.

## Find the release that changed the frame

ReleaseScope compares observed responsiveness across builds and ranks interaction, route, and React component regressions.

![TraceLens ReleaseScope comparing releases 2.13.4 and 2.14.0 with INP, LCP, long-frame, interaction, route, and React component deltas](docs/assets/studio-release-comparison.png)

<p align="center"><em>Release-level signal with the exact interactions and components that moved.</em></p>

## How it fits

```text
Browser SDK + React profiler
            │
            ▼
privacy-aware event correlation ──► OTLP/HTTP
            │
            ▼
local Studio collector
            │
            ├── interaction timeline + source locations
            └── ReleaseScope + CLI reports
```

## Documentation

- [Searchable documentation site](https://leracherry.github.io/tracelens/)
- [Getting started and data handling](docs/guides/getting-started.md)
- [Browser instrumentation](docs/guides/browser-instrumentation.md)
- [Browser support, integration tests, and overhead budgets](docs/guides/browser-testing-overhead.md)
- [React attribution](docs/guides/react-attribution.md)
- [Comparing releases](docs/guides/releases.md)
- [Privacy controls and audit](docs/guides/privacy.md)
- [OpenTelemetry and collector setup](docs/guides/opentelemetry.md)
- [Source maps and GitHub file links](docs/guides/source-maps.md)
- [Performance budgets](docs/guides/performance-budgets.md)
- [GitHub Action and PR reporting](docs/guides/github-action.md)
- [Playground walkthrough](docs/guides/performance-debugging-walkthrough.md)
- [Interaction correlation](docs/architecture/interaction-correlation.md)
- [Architecture overview](docs/architecture/overview.md)
- [Publishing and registry setup](docs/guides/publishing.md)
- [v0.4.0 release notes](docs/releases/v0.4.0.md)
- [v0.3.0 release notes](docs/releases/v0.3.0.md)

## Packages

| npm package                            | Purpose                                  |
| -------------------------------------- | ---------------------------------------- |
| `@leracherry/tracelens-browser`        | Browser instrumentation and transports   |
| `@leracherry/tracelens-react`          | React profiler and explicit boundaries   |
| `@leracherry/tracelens-vite`           | Build metadata injection                 |
| `@leracherry/tracelens-cli`            | Bundled Studio, inspect, compare, doctor |
| `@leracherry/tracelens-protocol`       | Versioned telemetry types                |
| `@leracherry/tracelens-core`           | Queries and release comparisons          |
| `@leracherry/tracelens-storage-memory` | In-memory storage adapter                |
| `@leracherry/tracelens-storage-file`   | JSON file storage adapter                |
| `@leracherry/tracelens-otel`           | OTLP/HTTP JSON trace transport           |

See [GitHub Releases](https://github.com/leracherry/tracelens/releases) for release notes and tarballs. The [GitHub Packages mirror](https://github.com/leracherry/tracelens/packages) uses `@leracherry/tracelens-*` names; see the registry guide above for authentication and installation.

## CLI

```bash
npx @leracherry/tracelens-cli studio
npx @leracherry/tracelens-cli inspect trace.json
npx @leracherry/tracelens-cli compare 1.0.0 1.1.0 --file trace.json
npx @leracherry/tracelens-cli doctor
npx @leracherry/tracelens-cli privacy audit --file trace.json
npx @leracherry/tracelens-cli sourcemaps upload ./dist --app dashboard --release 1.0.0 --url-prefix https://app.example/
npx @leracherry/tracelens-cli budget check --file trace.json --release 1.0.0
```

Omit `--file` to compare events from a running Studio collector.

The released GitHub Action can enforce the same budgets in pull requests:

```yaml
- uses: leracherry/tracelens@v0.4.0
  with:
    trace-file: artifacts/tracelens-events.json
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

See the [Action guide](docs/guides/github-action.md) for permissions, inputs, output artifacts, and a complete workflow. Pin a full commit SHA when your security policy requires immutable action references.

## Try the playground

```bash
git clone https://github.com/leracherry/tracelens.git
cd tracelens
pnpm install
pnpm build
pnpm dev
```

Open http://127.0.0.1:4174 for controlled search, settings, checkout, layout, and third-party script scenarios. Open Studio at http://127.0.0.1:4173 to inspect them.

## Current limits

v0.4.0 adds performance budgets, the GitHub Action, and the searchable documentation site. The OTLP transport exports traces, not metrics, and is not an OpenTelemetry SDK SpanExporter.

Studio is a local development tool with in-memory storage and no authentication. Browser API support varies. React production profiling requires a profiling-enabled build. Release deltas describe captured samples and do not establish statistical significance; see the comparison guide for calculation details.

The SDK omits input values, request bodies, and headers. URL credentials, query strings, fragments, and email-shaped path segments are removed by default; element IDs and aria-labels require opt-in. Other path segments, app-supplied names, and metadata can still contain sensitive values. Review them before collecting production data.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, package boundaries, testing, and reproducible product captures. All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm quality:browser
pnpm format:check
pnpm docs:build

# Rebuild the README product screenshots (requires Playwright Chromium)
pnpm docs:capture

# Rebuild the animated tour as well (also requires FFmpeg)
pnpm docs:demo
```

## Support and security

Use the [issue templates](https://github.com/leracherry/tracelens/issues/new/choose) for reproducible bugs and focused feature requests. Remove private telemetry before sharing a report. Report vulnerabilities privately using the [security policy](SECURITY.md), not a public issue.

## License

MIT
