# OpenTelemetry

`@tracelens/otel`, introduced in v0.2.0 (Phase 17), maps TraceLens events to OTLP spans and sends OTLP/HTTP JSON to a collector. Install it alongside the matching version of `@tracelens/browser`; see [registry setup and availability](publishing.md).

```ts
import { init } from '@tracelens/browser';
import { createTraceLensExporter } from '@tracelens/otel';

// Create before init() so the exporter captures the uninstrumented fetch.
const exporter = createTraceLensExporter({
  endpoint: 'http://127.0.0.1:4318/v1/traces',
  onRejected: ({ status, rejectedSpans }) => {
    console.warn('Collector rejected telemetry', status, rejectedSpans);
  },
});

init({
  app: 'checkout',
  release: 'development',
  environment: 'local',
  transport: exporter,
  tracePropagation: {
    allowedOrigins: ['http://127.0.0.1:4174'],
  },
  privacy: { url: { redactSegments: ['users'] } },
});
```

This exporter implements the TraceLens `Transport.send()` interface; it is not an OpenTelemetry JavaScript SDK `SpanExporter`. It sends traces only. Web Vitals and marks are zero-duration spans with attributes, not OTLP metrics. Selecting this transport replaces the default Studio transport.

## Collector

Use the checked-in [collector configuration](../../examples/otel/collector.yaml) with your installed OpenTelemetry Collector:

```bash
otelcol --config examples/otel/collector.yaml
```

It accepts OTLP HTTP on port 4318 and writes spans through the debug exporter. The sample binds all interfaces for container compatibility; restrict access or bind `127.0.0.1:4318` when running directly on your machine. Adjust the two explicit CORS origins to match your application. Do not expose an unauthenticated collector publicly.

Trigger an interaction and a fetch to an instrumented backend. Check the collector output for `service.name`, the network CLIENT span, and matching trace IDs in your backend spans. Replace the debug exporter with your destination's exporter to forward data.

## Context and timing

The browser generates random trace/span IDs. Captured interaction IDs tie request, React, and frame spans to the interaction's root context, even when Event Timing arrives later. The context cache is bounded to 1,000 interaction IDs. Backend instrumentation must extract W3C `traceparent` to join the trace.

Fetch propagation is disabled unless `tracePropagation.allowedOrigins` is supplied. Entries are exact origins including scheme and port. Requests in `no-cors` mode and requests with existing `traceparent` or `tracestate` are unchanged. Existing external tracer contexts are not adopted: TraceLens records its own independent network span in that case. XHR is exported but does not propagate headers in this phase. No baggage is sent. Cross-origin APIs must allow `traceparent` through CORS.

Events carry `performance.timeOrigin`, allowing relative start times to be converted to epoch nanoseconds. Older trace files lack this clock anchor and fall back to `timestamp - duration`; their timing is approximate and their spans have independent generated contexts. Custom spans inherit the interaction active at invocation; this is not a general asynchronous context manager.

## Delivery and data handling

The exporter uses a 10-second timeout by default. Network failures and HTTP 429/502/503/504 reject `send()`, allowing the browser queue to retry on a later flush. Permanent HTTP failures and OTLP partial acceptance invoke `onRejected` and are not retried. Keep the callback configured to observe rejected data. The existing browser queue is in-memory and is not a durable delivery system; reloads and shutdown failures can lose data.

SDK privacy sanitization runs before export. Direct callers of `mapTraceLensEvent()` or `toOtlpTraceRequest()` must provide already-sanitized data. Resource attributes include app, release, environment, commit, and build time; payload attributes are explicitly mapped. Do not embed collector secrets in browser JavaScript. Use an appropriate authenticated proxy for production.

Wire format references: [OTLP HTTP/JSON](https://opentelemetry.io/docs/specs/otlp/) and [W3C Trace Context](https://www.w3.org/TR/trace-context/).
