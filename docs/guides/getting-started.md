# Getting started

Use Node.js 22 or newer for the CLI and build integration. Packages are ESM with TypeScript declarations.

```bash
npm install @tracelens/browser
npx @tracelens/cli@0.1.0 studio
```

Open http://127.0.0.1:4173. Add this to your application's browser entry point:

```ts
import { init } from '@tracelens/browser';

const stop = init({
  app: 'dashboard',
  release: '1.0.0',
  environment: 'development',
  endpoint: 'http://127.0.0.1:4173/__tracelens',
});
// Call await stop() when instrumentation should stop.
```

Initialize once per page. The SDK batches events every second by default. Use explicit, non-sensitive `data-tracelens-name` attributes on controls to make interactions recognizable.

## Vite

```bash
npm install --save-dev @tracelens/vite
```

```ts
import { defineConfig } from 'vite';
import { tracelens } from '@tracelens/vite';

export default defineConfig({ plugins: [tracelens()] });
```

The plugin injects the nearest package version, Git commit, current build time, and Vite mode. You can override these in the plugin options or SDK `init()`; explicit SDK values take priority.

## React and custom work

Install `@tracelens/react` alongside `@tracelens/browser` and follow the [React guide](react-attribution.md). Wrap expensive operations with `trace('operation-name', fn)` to capture custom spans.

## Local collection and data handling

The packaged Studio requires neither Vite nor a repository checkout. It retains the most recent 50,000 events in memory, accepts batches up to 1 MiB, and loses data when stopped. To save events:

```bash
curl http://127.0.0.1:4173/__tracelens -o trace.json
npx @tracelens/cli inspect trace.json
```

Use Studio on loopback for local debugging. It has no authentication and permits browser applications to post telemetry across origins. An HTTPS application may block an HTTP collector as mixed content; use a suitable local proxy in that case.

The SDK does not capture input values, request bodies, or headers. Network query strings and fragments are removed, but routes, hash routes, accessible labels, element IDs, explicit names, and build metadata can still contain sensitive information. Review those values and your consent requirements before production use. Configurable privacy controls are planned for the next phase.
