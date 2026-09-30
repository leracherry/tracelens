# Browser API

Install `@leracherry/tracelens-browser` and call `init()` once in a browser entry point.

## `init(options)`

Starts observers, browser instrumentation, correlation, batching, and the configured transport. It returns the same async shutdown function exported as `shutdown()`.

```ts
const stop = init({
  app: 'dashboard',
  release: '1.0.0',
  endpoint: '/__tracelens',
});

await stop();
```

Calling `init()` twice without a successful shutdown throws. Invalid sampling, batching, or flush values throw before browser APIs are patched.

## `trace(name, fn)`

Records named synchronous or asynchronous application work and preserves the original return value or error.

```ts
const report = await trace('generate-report', () => generateReport());
```

The returned value is always a promise because TraceLens records both synchronous and asynchronous functions through one API.

## `mark(name)`

Creates `performance.mark('tracelens:' + name)` and emits a TraceLens mark when the runtime is active.

```ts
mark('hydration-complete');
```

## `shutdown()`

Disconnects observers, restores patched `fetch` and XHR methods, stops the timer, and drains queued telemetry. Delivery failures reject without discarding the batch so shutdown can be retried.

```ts
await shutdown();
```

## `MemoryTransport`

Stores sanitized events in memory. It is useful for tests and adapters.

```ts
const transport = new MemoryTransport();
init({ app: 'test', transport });
```

## `Transport`

```ts
interface Transport {
  send(events: readonly AnyTraceLensEvent[]): Promise<void>;
}
```

A rejected `send()` call is treated as retryable. Implementations should reject only when sending the same batch again is safe.

## Diagnostic helpers

- `describeElement(element, privacy)` returns the privacy-filtered descriptor used for interaction names.
- `getActiveInteractionId(at?)` returns the current correlation candidate.
- `recordReactRender(sample)` is the bridge used by `@leracherry/tracelens-react`.
- `sanitizeTelemetryUrl(value, privacy)` applies the public URL privacy policy.

See [configuration](configuration.md) for every option and [browser instrumentation](../guides/browser-instrumentation.md) for behavior and browser support.
