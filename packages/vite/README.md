# @leracherry/tracelens-vite

Vite build metadata for TraceLens v0.2.1.

## Installation

Install from npm using the command below, or see [GitHub Packages authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md). Both registries use the same package names. Keep all TraceLens packages on matching versions.

```bash
npm install @leracherry/tracelens-vite@0.2.1
```

## Usage

```tsx
import { defineConfig } from 'vite';
import { tracelens } from '@leracherry/tracelens-vite';

export default defineConfig({ plugins: [tracelens()] });
```

Injects release, commit, environment, and build timestamp for the browser SDK. Explicit plugin options override discovered values. No source maps are uploaded.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/getting-started.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.2.1.md). Licensed MIT.
