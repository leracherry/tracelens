# @tracelens/storage-memory

In-memory storage for TraceLens v0.2.0.

## Installation

See [registry availability and authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md) before installing. npm scope publication is not yet confirmed; the GitHub Packages mirror and source builds are alternatives. Keep all TraceLens packages on matching versions.

```bash
npm install @tracelens/storage-memory@0.2.0
```

## Usage

```tsx
import { MemoryStorage } from '@tracelens/storage-memory';

const storage = new MemoryStorage();
await storage.append(events);
const interactions = await storage.query({ type: 'interaction', limit: 100 });
```

Implements the core StorageAdapter interface. Data lasts only for this instance; clear() removes it. This adapter has no automatic size cap. Pass validated, sanitized TraceLens events to append().

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/getting-started.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.2.0.md). Licensed MIT.
