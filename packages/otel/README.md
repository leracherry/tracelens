# @leracherry/tracelens-otel

OTLP/HTTP JSON trace transport for TraceLens v0.4.0.

## Installation

Install from npm using the command below, or see [GitHub Packages authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md). Both registries use the same package names. Keep all TraceLens packages on matching versions.

```bash
npm install @leracherry/tracelens-otel@0.4.0
```

## Usage

```tsx
import { init } from '@leracherry/tracelens-browser';
import { createTraceLensExporter } from '@leracherry/tracelens-otel';

const transport = createTraceLensExporter({
  endpoint: 'http://127.0.0.1:4318/v1/traces',
});
init({ app: 'dashboard', transport });
```

Create the exporter before init() to capture uninstrumented fetch. This TraceLens transport replaces Studio delivery; it is not an OpenTelemetry SDK SpanExporter. Exports traces, not metrics. Fetch trace propagation is separately opt-in with an exact-origin allowlist; configure Collector CORS for browser clients.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/opentelemetry.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.4.0.md). Licensed MIT.
