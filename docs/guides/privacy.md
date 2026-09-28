# Privacy controls (Phase 16, source development)

These controls are on `main`; they are not included in the published v0.1.0 artifacts.

```ts
init({
  app: 'dashboard',
  privacy: {
    allowedElementAttributes: ['data-tracelens-name', 'role', 'type'],
    url: {
      stripQuery: true,
      redactSegments: ['users', 'email', 'userId'],
      sanitize: (url) => url.replace(/\/orders\/[^/?]+/, '/orders/[redacted]'),
    },
  },
});
```

URL protection runs before queueing network, navigation, interaction, Web Vital, and script-source events. It removes credentials, fragments (including hash routes), queries, and email-shaped path segments by default. `redactSegments` names the path keys whose **following value** is hidden: `/users/123` becomes `/users/[redacted]`. Matching is case-sensitive after percent-decoding. Use a custom sanitizer for other route conventions.

Custom sanitizers receive the sanitized value. Their result is sanitized again. Returning `null`, throwing, malformed encoding, and unsupported URL schemes produce `[redacted]`. This changes telemetry only; application requests are untouched.

Queries can be explicitly allowed with all three settings: `queryParameters: 'allowlist'`, `url.stripQuery: false`, and `url.allowedQueryParameters: ['view']`. Only those query names survive; their values remain visible, so select non-sensitive keys.

Raw DOM text, input values, request bodies, and headers are never collected. Default element attributes are `data-tracelens-name`, `role`, and `type`. `aria-label` and `id` require explicit entries in `allowedElementAttributes`. An empty list drops all attribute-derived names and IDs. Explicit labels and span/component names still need review; arbitrary app metadata is not automatically anonymized.

## Audit captured data

After building the repository:

```bash
pnpm exec tracelens privacy audit
pnpm exec tracelens privacy audit --file trace.json
pnpm exec tracelens privacy audit --endpoint http://127.0.0.1:4173/__tracelens
```

The default source is the local Studio collector. The audit flags email-shaped strings, URL queries/fragments, credentials, and sensitive field names. Reports include event positions and field categories, never the detected values or arbitrary field names. Exit code is 1 for findings or errors and 0 when no heuristic matches are found. This is an inspection aid, not proof that a trace is anonymous or compliant.
