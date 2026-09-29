# Reliability and lifecycle

TraceLens instrumentation is designed to fail without changing application requests. The browser SDK keeps telemetry delivery separate from fetch and XMLHttpRequest results, serializes outgoing batches, and restores patched APIs during shutdown.

## Delivery behavior

The default HTTP transport treats only successful HTTP responses as delivered. Network errors and non-2xx responses retain the batch for the next interval. Concurrent size-triggered and timer-triggered flushes are serialized, so batches cannot overtake or duplicate one another.

`shutdown()` stops observers, removes event listeners, restores `fetch` and XMLHttpRequest, and drains every queued batch. If delivery still fails, its promise rejects and the queue remains available for an explicit retry:

```ts
const stop = init({
  app: 'dashboard',
  endpoint: 'https://telemetry.example/v1/events',
});

try {
  await stop();
} catch (error) {
  // The collector was unavailable. Retry while the page is still alive.
  await stop();
}
```

The in-memory retry is page-local and intentionally bounded by page lifetime. TraceLens does not persist failed browser batches to IndexedDB or local storage. Applications that need durable delivery should provide a custom `Transport` with an appropriate queue and retention policy.

## Configuration validation

Initialization rejects empty application names, sample rates outside `0`–`1`, non-positive or fractional batch sizes, and non-positive flush intervals before browser APIs are patched. Calling `init()` twice without a successful shutdown is also rejected.

Work that completes after shutdown is not appended to an abandoned queue. Await application work before shutdown when its span must be delivered.

## Privacy invariants

Telemetry URL processing fails closed. It removes credentials, fragments, and query strings by default; recursively encoded email-shaped path segments are redacted; unsafe protocols and malformed encodings become `[redacted]`. An allowlisted query is opt-in, and a custom sanitizer receives an already sanitized URL before its result is sanitized again.

Instrumentation observes the original application request without rewriting its URL. Trace-context headers are injected only for exact origins explicitly listed in `tracePropagation.allowedOrigins`.

These guarantees are covered by unit tests and the [real-browser suite](browser-testing-overhead.md). Review the complete [privacy guide](privacy.md) before production collection.
