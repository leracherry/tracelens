# TraceLens

**Real-user performance debugging for frontend engineers.**

Find the interaction. Find the frame. Find the component. Find the release.

TraceLens is a local-first toolkit for understanding why browser interactions are slow. The current `0.1` foundation captures Event Timing, Web Vitals, and Long Animation Frames, then correlates them in a focused local Studio.

## Try the milestone

Requires Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev
```

Then:

1. Open the playground at <http://localhost:4174>.
2. Open Studio at <http://localhost:4173>.
3. Click **Save settings** in the playground.
4. Inspect the interaction timing in Studio.

The playground is intentionally slow. Its settings action produces blocking validation and rendering work so the browser has something useful to report.

## Packages

| Package                     | Purpose                                |
| --------------------------- | -------------------------------------- |
| `@tracelens/protocol`       | Versioned telemetry event types        |
| `@tracelens/browser`        | Browser instrumentation and transports |
| `@tracelens/core`           | Storage interfaces and trace queries   |
| `@tracelens/storage-memory` | In-memory trace storage                |
| `@tracelens/storage-file`   | JSON file trace storage                |
| `@tracelens/studio`         | Local interaction explorer             |
| `@tracelens/playground`     | Intentionally slow example app         |

## Browser setup

```ts
import { init } from '@tracelens/browser';

init({
  app: 'checkout',
  release: '2.14.0',
  endpoint: 'http://localhost:4173/__tracelens',
});
```

Privacy-sensitive values are not collected: element text and input values are ignored, script query strings are stripped, and the SDK sends no request bodies or headers from the instrumented application.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

## Status

Milestone 0.1 is the active foundation. Browser support depends on the relevant Performance APIs; unsupported entry types degrade without breaking the application.

## License

MIT
