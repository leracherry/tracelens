# Browser instrumentation

`@leracherry/tracelens-browser` captures the browser signals needed to explain an interaction: Event Timing, Web Vitals, long animation frames, layout shifts, fetch/XHR spans, navigation, marks, and explicit application work.

## Install and initialize

```bash
npm install @leracherry/tracelens-browser
```

Initialize once, before application code begins making requests. Keep the returned shutdown function for tests, hot reload, or single-page application teardown.

```ts
import { init } from '@leracherry/tracelens-browser';

const stopTraceLens = init({
  app: 'billing-dashboard',
  release: '2.14.0',
  environment: 'production',
  endpoint: 'https://telemetry.example.com/tracelens',
  sampleRate: 0.1,
});

// Later, when instrumentation should stop:
await stopTraceLens();
```

`app` is required. Set `release` in every production build so ReleaseScope, budgets, and source maps can select a stable population. A sampled-out session returns a no-op shutdown function.

## Build metadata with Vite

The Vite plugin injects package version, Git commit, build timestamp, and Vite mode. Explicit `init()` values take precedence.

```bash
npm install --save-dev @leracherry/tracelens-vite
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { tracelens } from '@leracherry/tracelens-vite';

export default defineConfig({
  plugins: [
    tracelens({
      release: process.env.RELEASE_VERSION,
      environment: process.env.DEPLOY_ENV,
    }),
  ],
});
```

## Choose a transport

By default, TraceLens sends JSON batches to `endpoint` with `fetch`. The default endpoint is `/__tracelens`, the default batch size is 20 events, and the default flush interval is one second.

Implement `Transport` when events must go through an existing ingestion client:

```ts
import { init, type Transport } from '@leracherry/tracelens-browser';

const transport: Transport = {
  async send(events) {
    await telemetryClient.send('tracelens', events);
  },
};

init({ app: 'dashboard', release: '2.14.0', transport });
```

The SDK retries a failed batch on the next flush. Put authentication, persistence, retry backoff, and server-side access control in the transport or collector; the SDK does not manage credentials.

Use `MemoryTransport` for deterministic tests:

```ts
import { init, MemoryTransport } from '@leracherry/tracelens-browser';

const transport = new MemoryTransport();
const stop = init({ app: 'test', release: 'test', transport });
// interact with the page
await stop();
expect(transport.events.some((event) => event.type === 'interaction')).toBe(
  true,
);
```

## Name interactions safely

TraceLens never reads DOM text. Add an explicit, non-sensitive label when the tag, role, and input type would be ambiguous:

```html
<button data-tracelens-name="Save settings">Save</button>
```

The default element allowlist is `data-tracelens-name`, `role`, and `type`. IDs and `aria-label` values are collected only when explicitly enabled. See [privacy controls](privacy.md) before broadening the allowlist.

## Trace application work

Use `trace()` for expensive work that browser entries cannot name. It preserves return values, awaits promises, records success or error, and rethrows failures.

```ts
import { mark, trace } from '@leracherry/tracelens-browser';

mark('checkout-opened');

const quote = await trace('calculate-shipping', () =>
  shippingClient.quote(cart),
);
```

Work started within the active interaction window inherits the interaction ID and trace context. Keep names low-cardinality and free of customer data.

## Propagate trace context

Cross-origin `traceparent` propagation is disabled by default. Enable only exact origins that accept the header and include it in their CORS policy:

```ts
init({
  app: 'dashboard',
  release: '2.14.0',
  tracePropagation: {
    allowedOrigins: ['https://api.example.com'],
  },
});
```

TraceLens does not overwrite an existing `traceparent` or `tracestate`, does not add headers to `no-cors` requests, and never injects context into origins outside the allowlist.

## Browser support and overhead

Instrumentation is capability-based. Unsupported `PerformanceObserver` entry types are skipped, so older browsers can still report the signals they expose. Event Timing and Long Animation Frames have narrower browser support than fetch/XHR and basic marks.

Sampling is decided once per page session. Start with a conservative production `sampleRate`, watch event volume and collector latency, and keep custom transports asynchronous. TraceLens patches `fetch` and `XMLHttpRequest` until shutdown; initialize only once.

The repository runs the compiled SDK in Chromium and enforces bundle-size, initialization, mark, trace, and idle-task budgets in CI. See [browser testing and overhead](browser-testing-overhead.md) for coverage, thresholds, and local commands.

## Next steps

- Add [React attribution](react-attribution.md).
- Inspect a trace with the [interaction debugging walkthrough](performance-debugging-walkthrough.md).
- Apply [privacy controls](privacy.md) before production collection.
- Export correlated spans with [OpenTelemetry](opentelemetry.md).
