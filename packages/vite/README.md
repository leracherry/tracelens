# @tracelens/vite

Vite build metadata for TraceLens v0.2.0.

## Installation

See [registry availability and authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md) before installing. npm scope publication is not yet confirmed; the GitHub Packages mirror and source builds are alternatives. Keep all TraceLens packages on matching versions.

```bash
npm install @tracelens/vite@0.2.0
```

## Usage

```tsx
import { defineConfig } from 'vite';
import { tracelens } from '@tracelens/vite';

export default defineConfig({ plugins: [tracelens()] });
```

Injects release, commit, environment, and build timestamp for the browser SDK. Explicit plugin options override discovered values. No source maps are uploaded.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/getting-started.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.2.0.md). Licensed MIT.
