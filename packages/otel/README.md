# @tracelens/otel

OTLP/HTTP JSON trace transport for TraceLens v0.2.0.

## Installation

See [registry availability and authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md) before installing. npm scope publication is not yet confirmed; the GitHub Packages mirror and source builds are alternatives. Keep all TraceLens packages on matching versions.

```bash
npm install @tracelens/otel@0.2.0
```

## Usage

```tsx
import { init } from '@tracelens/browser';
import { createTraceLensExporter } from '@tracelens/otel';

const transport = createTraceLensExporter({
  endpoint: 'http://127.0.0.1:4318/v1/traces',
});
init({ app: 'dashboard', transport });
```

Create the exporter before init() to capture uninstrumented fetch. This TraceLens transport replaces Studio delivery; it is not an OpenTelemetry SDK SpanExporter. Exports traces, not metrics. Fetch trace propagation is separately opt-in with an exact-origin allowlist; configure Collector CORS for browser clients.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/opentelemetry.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.2.0.md). Licensed MIT.
