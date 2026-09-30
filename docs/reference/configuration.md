# Configuration reference

## Browser initialization

| Option             | Type                      | Default                 | Purpose                                   |
| ------------------ | ------------------------- | ----------------------- | ----------------------------------------- |
| `app`              | `string`                  | required                | Stable application identity               |
| `release`          | `string`                  | injected when available | Release used by comparisons and maps      |
| `commit`           | `string`                  | injected when available | Source and build identity                 |
| `buildTimestamp`   | `string`                  | injected when available | Build metadata                            |
| `environment`      | `string`                  | injected Vite mode      | Environment selector                      |
| `sampleRate`       | `number`                  | `1`                     | Session inclusion probability from 0 to 1 |
| `transport`        | `Transport`               | HTTP transport          | Custom delivery implementation            |
| `endpoint`         | `string`                  | `/__tracelens`          | HTTP collector URL                        |
| `flushInterval`    | `number`                  | `1000`                  | Flush interval in milliseconds            |
| `batchSize`        | `number`                  | `20`                    | Maximum events per delivered batch        |
| `privacy`          | `PrivacyOptions`          | restrictive defaults    | URL and element policy                    |
| `tracePropagation` | `TracePropagationOptions` | disabled                | Opt-in `traceparent` propagation          |

Explicit initialization values override Vite-injected metadata.

## Privacy

```ts
privacy: {
  queryParameters: 'allowlist',
  allowedElementAttributes: ['data-tracelens-name', 'role', 'type'],
  url: {
    stripQuery: false,
    allowedQueryParameters: ['page'],
    redactSegments: ['users', 'accounts'],
    sanitize(url) {
      return url.replace(/\/orders\/[^/]+/, '/orders/[redacted]');
    },
  },
}
```

Input values, DOM text, request bodies, and headers are never collected. Query values are dropped unless both `queryParameters: 'allowlist'` and `stripQuery: false` are set.

## Trace propagation

```ts
tracePropagation: {
  allowedOrigins: ['https://api.example.com'],
}
```

Trace propagation is off by default. Headers are added only to allowed HTTP(S) origins and never to the TraceLens collector request.

## Vite metadata

```ts
tracelens({
  release: '1.0.0',
  commit: '7ac841f',
  environment: 'production',
});
```

Without explicit values, the plugin reads the nearest package version, the current Git commit, the build time, and the Vite mode.

## Performance budgets

```yaml
minimumSamples: 20
performance:
  inp:
    p75: 200
  lcp:
    p75: 2500
  cls:
    p75: 0.1
  longFramesPerSession:
    max: 1
routes:
  /checkout:
    inp:
      p75: 150
```

Unknown keys and duplicate YAML keys fail closed. Every configured check must meet `minimumSamples`.
