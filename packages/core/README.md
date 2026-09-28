# @tracelens/core

Queries and release comparisons for TraceLens v0.2.0.

## Installation

See [registry availability and authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md) before installing. npm scope publication is not yet confirmed; the GitHub Packages mirror and source builds are alternatives. Keep all TraceLens packages on matching versions.

```bash
npm install @tracelens/core@0.2.0
```

## Usage

```tsx
import { aggregateReleases, compareReleases } from '@tracelens/core';

const releases = aggregateReleases(events);
const comparison = compareReleases(events, '1.0.0', '1.1.0');
```

Pass captured TraceLens events as events. Exports the StorageAdapter and TraceQuery interfaces. Comparisons summarize observed samples, not statistical significance; the current INP-labeled metric is p75 of captured interactions.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/releases.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.2.0.md). Licensed MIT.
