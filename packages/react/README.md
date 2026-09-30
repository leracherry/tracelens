# @leracherry/tracelens-react

React profiler boundaries for TraceLens v1.0.0.

## Installation

Install from npm using the command below, or see [GitHub Packages authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md). Both registries use the same package names. Keep all TraceLens packages on matching versions.

```bash
npm install @leracherry/tracelens-react@1.0.0
```

## Usage

```tsx
import { TraceBoundary } from '@leracherry/tracelens-react';

<TraceBoundary name="Checkout">
  <Checkout />
</TraceBoundary>;
```

Initialize @leracherry/tracelens-browser first. Wrap regions with TraceBoundary or the app with TraceLensProfiler. Production timing requires a profiling-enabled React build; boundaries report region timings, not automatic fiber-level attribution.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/react-attribution.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v1.0.0.md). Licensed MIT.
