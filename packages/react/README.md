# @tracelens/react

React profiler boundaries for TraceLens v0.2.0.

## Installation

See [registry availability and authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md) before installing. npm scope publication is not yet confirmed; the GitHub Packages mirror and source builds are alternatives. Keep all TraceLens packages on matching versions.

```bash
npm install @tracelens/react@0.2.0
```

## Usage

```tsx
import { TraceBoundary } from '@tracelens/react';

<TraceBoundary name="Checkout">
  <Checkout />
</TraceBoundary>;
```

Initialize @tracelens/browser first. Wrap regions with TraceBoundary or the app with TraceLensProfiler. Production timing requires a profiling-enabled React build; boundaries report region timings, not automatic fiber-level attribution.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/react-attribution.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.2.0.md). Licensed MIT.
