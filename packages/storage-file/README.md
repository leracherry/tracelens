# @tracelens/storage-file

JSON file storage for TraceLens v0.2.0.

## Installation

See [registry availability and authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md) before installing. npm scope publication is not yet confirmed; the GitHub Packages mirror and source builds are alternatives. Keep all TraceLens packages on matching versions.

```bash
npm install @tracelens/storage-file@0.2.0
```

## Usage

```tsx
import { FileStorage } from '@tracelens/storage-file';

const storage = new FileStorage('./traces/session.json');
await storage.append(events);
const interactions = await storage.query({ type: 'interaction' });
```

Node.js-only StorageAdapter backed by a JSON array. Each append reads and rewrites the file; it is intended for small local traces, not concurrent writers or production ingestion. clear() overwrites the file with an empty array. Sanitize events before storing them.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/privacy.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.2.0.md). Licensed MIT.
