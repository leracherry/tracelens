# @leracherry/tracelens-core

Queries and release comparisons for TraceLens v1.0.0.

## Installation

Install from npm using the command below, or see [GitHub Packages authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md). Both registries use the same package names. Keep all TraceLens packages on matching versions.

```bash
npm install @leracherry/tracelens-core@1.0.0
```

## Usage

```tsx
import { aggregateReleases, compareReleases } from '@leracherry/tracelens-core';

const releases = aggregateReleases(events);
const comparison = compareReleases(events, '1.0.0', '1.1.0');
```

Pass captured TraceLens events as events. Exports the StorageAdapter and TraceQuery interfaces. Comparisons summarize observed samples, not statistical significance; the current INP-labeled metric is p75 of captured interactions.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/releases.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v1.0.0.md). Licensed MIT.
