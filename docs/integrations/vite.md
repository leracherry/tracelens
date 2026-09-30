# Vite integration

`@leracherry/tracelens-vite` injects release metadata at build time so every browser event can be compared and resolved without duplicating configuration in application code.

## Install

```bash
npm install @leracherry/tracelens-browser
npm install --save-dev @leracherry/tracelens-vite
```

## Configure

```ts
import { defineConfig } from 'vite';
import { tracelens } from '@leracherry/tracelens-vite';

export default defineConfig({
  plugins: [tracelens()],
});
```

The plugin discovers:

- the nearest `package.json` version as `release`;
- `git rev-parse --short HEAD` as `commit`;
- the build time as `buildTimestamp`;
- the Vite mode as `environment`.

Explicit values override discovery:

```ts
tracelens({
  release: process.env.APP_RELEASE,
  commit: process.env.GITHUB_SHA,
  environment: 'production',
});
```

Initialize the browser SDK normally. Explicit `init()` metadata takes precedence over injected metadata.

## CI builds

Checkout enough Git history for the desired commit identity and pass a stable application release. Avoid using a random deployment identifier when two deployments should compare as the same product release.

## Monorepos

Use `root` when the Vite project should discover metadata from a different directory:

```ts
tracelens({ root: new URL('../app', import.meta.url).pathname });
```

See the [React + Vite example](../examples/react-vite.md) and [release comparison guide](../guides/releases.md).
