# @leracherry/tracelens-browser

Browser performance instrumentation for TraceLens v0.2.1.

## Installation

Install from npm using the command below, or see [GitHub Packages authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md). Both registries use the same package names. Keep all TraceLens packages on matching versions.

```bash
npm install @leracherry/tracelens-browser@0.2.1
```

## Usage

```tsx
import { init } from '@leracherry/tracelens-browser';

init({
  app: 'dashboard',
  release: '1.0.0',
  endpoint: 'http://127.0.0.1:4173/__tracelens',
});
```

Captures interactions, Web Vitals, long frames, fetch/XHR timings, and custom spans. Browser support varies. URL queries and fragments are stripped by default; IDs and aria-labels require opt-in. Review explicit names and metadata for sensitive data.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/privacy.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.2.1.md). Licensed MIT.
