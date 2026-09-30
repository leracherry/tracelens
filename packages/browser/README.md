# @leracherry/tracelens-browser

Browser performance instrumentation for TraceLens v1.0.0.

## Installation

Install from npm using the command below, or see [GitHub Packages authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md). Both registries use the same package names. Keep all TraceLens packages on matching versions.

```bash
npm install @leracherry/tracelens-browser@1.0.0
```

## Usage

```tsx
import { init } from '@leracherry/tracelens-browser';

const stop = init({
  app: 'dashboard',
  release: '1.0.0',
  endpoint: 'http://127.0.0.1:4173/__tracelens',
});

// Await during application teardown when possible.
await stop();
```

Captures interactions, Web Vitals, long frames, fetch/XHR timings, and custom spans. Browser support varies. URL queries and fragments are stripped by default; IDs and aria-labels require opt-in. Review explicit names and metadata for sensitive data. Shutdown restores patched APIs and drains queued batches; it rejects on persistent delivery failure so the caller can retry while the page remains alive.

See the [privacy guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/privacy.md), [reliability guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/reliability.md), and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v1.0.0.md). Licensed MIT.
