# TraceLens

**Real-user performance debugging for frontend engineers.**

Find the interaction. Find the frame. Find the component. Find the release.

TraceLens captures browser performance events and correlates slow interactions with long frames, network requests, custom spans, and React profiler commits. Run Studio locally to inspect traces and compare releases.

## Quick start

Requires Node.js 22+ for the CLI. Packages ship compiled ESM and TypeScript declarations.

```bash
npm install @tracelens/browser
npx @tracelens/cli@0.1.0 studio
```

Open http://127.0.0.1:4173 and initialize the SDK in your application's browser entry point:

```ts
import { init } from '@tracelens/browser';

init({
  app: 'dashboard',
  release: '1.0.0',
  environment: 'development',
  endpoint: 'http://127.0.0.1:4173/__tracelens',
});
```

Click an instrumented control, then inspect its timing and correlated work in Studio. The CLI includes the built Studio; a repository checkout is not required.

## What is included

- Browser interaction timing with input, processing, and presentation breakdowns.
- Web Vitals, long animation frames, fetch/XHR timing, layout shifts, and custom spans.
- React profiler boundaries, component timings, and render counts.
- Vite injection of release, commit, environment, and build timestamp.
- ReleaseScope comparisons with route, interaction, and component deltas.
- CLI commands for Studio, trace inspection, release comparison, and diagnostics.

## Documentation

- [Getting started and data handling](docs/guides/getting-started.md)
- [React attribution](docs/guides/react-attribution.md)
- [Comparing releases](docs/guides/releases.md)
- [Playground walkthrough](docs/guides/performance-debugging-walkthrough.md)
- [Interaction correlation](docs/architecture/interaction-correlation.md)
- [Publishing and registry setup](docs/guides/publishing.md)
- [v0.1.0 release notes](docs/releases/v0.1.0.md)

## Packages

| npm package                 | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| `@tracelens/browser`        | Browser instrumentation and transports   |
| `@tracelens/react`          | React profiler and explicit boundaries   |
| `@tracelens/vite`           | Build metadata injection                 |
| `@tracelens/cli`            | Bundled Studio, inspect, compare, doctor |
| `@tracelens/protocol`       | Versioned telemetry types                |
| `@tracelens/core`           | Queries and release comparisons          |
| `@tracelens/storage-memory` | In-memory storage adapter                |
| `@tracelens/storage-file`   | JSON file storage adapter                |

See [GitHub Releases](https://github.com/leracherry/tracelens/releases) for release notes and tarballs. The [GitHub Packages mirror](https://github.com/leracherry/tracelens/packages) uses `@leracherry/tracelens-*` names; see the registry guide above for authentication and installation.

## CLI

```bash
npx @tracelens/cli studio
npx @tracelens/cli inspect trace.json
npx @tracelens/cli compare 1.0.0 1.1.0 --file trace.json
npx @tracelens/cli doctor
```

Omit `--file` to compare events from a running Studio collector.

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

v0.1.0 covers the plan through Phase 15 (ReleaseScope). Configurable privacy controls, source maps, OpenTelemetry, and CI budgets are future work.

Studio is a local development tool with in-memory storage and no authentication. Browser API support varies. React production profiling requires a profiling-enabled build. Release deltas describe captured samples and do not establish statistical significance; see the comparison guide for calculation details.

The SDK omits input values, request bodies, and headers, and strips network query strings. App-supplied names, labels, IDs, routes, and metadata can still contain sensitive values. Review them before collecting production data.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

## License

MIT
