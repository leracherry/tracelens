# @leracherry/tracelens-storage-memory

In-memory storage for TraceLens v0.2.1.

## Installation

Install from npm using the command below, or see [GitHub Packages authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md). Both registries use the same package names. Keep all TraceLens packages on matching versions.

```bash
npm install @leracherry/tracelens-storage-memory@0.2.1
```

## Usage

```tsx
import { MemoryStorage } from '@leracherry/tracelens-storage-memory';

const storage = new MemoryStorage();
await storage.append(events);
const interactions = await storage.query({ type: 'interaction', limit: 100 });
```

Implements the core StorageAdapter interface. Data lasts only for this instance; clear() removes it. This adapter has no automatic size cap. Pass validated, sanitized TraceLens events to append().

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/getting-started.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.2.1.md). Licensed MIT.
