# Common workflows

TraceLens is easiest to adopt as a sequence of small workflows. Start locally, make the evidence useful, then add release metadata and CI only after the trace answers a real debugging question.

## Debug a slow interaction locally

1. Start Studio with `npx @leracherry/tracelens-cli studio`.
2. Initialize the browser SDK with a loopback collector endpoint.
3. Reproduce one slow action in your application.
4. Select the newest interaction in Studio.
5. Compare input delay, processing, and presentation delay.
6. Follow the longest correlated lane to browser, React, network, layout, or custom work.
7. Import source maps when a long-frame script is the primary contributor.

Use `data-tracelens-name` on important controls and `trace(name, fn)` around domain work. Stable names make local traces, release comparisons, and CI reports describe the same operation.

```ts
import { trace } from '@leracherry/tracelens-browser';

await trace('serialize-settings', () => serializeSettings(model));
```

## Roll out production telemetry safely

1. Review the [privacy defaults](privacy.md).
2. Set an explicit `app`, `release`, and `environment`.
3. Start with a low `sampleRate` and a first-party collector or OTLP endpoint.
4. Allow trace propagation only to trusted origins.
5. Run `tracelens privacy audit` on a synthetic export.
6. Confirm delivery, retry, and shutdown behavior in your application lifecycle.

```ts
init({
  app: 'checkout',
  release: import.meta.env.VITE_RELEASE,
  environment: 'production',
  sampleRate: 0.05,
  endpoint: '/telemetry/tracelens',
  tracePropagation: {
    allowedOrigins: ['https://api.example.com'],
  },
});
```

TraceLens does not provide a hosted ingestion service. Your endpoint must accept a JSON array of protocol events or use the [OpenTelemetry transport](opentelemetry.md).

## Compare two releases

Capture the same named interactions under two release values, then compare them in Studio or the CLI:

```bash
npx @leracherry/tracelens-cli compare 2.13.4 2.14.0 --file trace.json
```

Interpret the result in this order:

1. Confirm both populations use the same app and environment.
2. Check sample counts and route coverage.
3. Look for interaction and component deltas that move together.
4. Inspect newly introduced long frames.
5. Treat the diff as debugging evidence, not statistical proof.

## Gate a pull request

Store a sanitized telemetry fixture or produce one in an earlier job. Define `tracelens.yml`, then run the repository Action with `checks: write` and `pull-requests: write` permissions.

```yaml
- uses: leracherry/tracelens@v1.0.0
  with:
    trace-file: artifacts/tracelens-events.json
    config-file: tracelens.yml
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Begin with `fail-on-budget: false` while establishing representative thresholds. Turn failure on only after the sample and route requirements match the way telemetry is produced.

## Investigate a CI failure

1. Read the job summary for failed and no-data checks.
2. Download the JSON report artifact.
3. Re-run the exact command locally with the same trace and config.
4. Use `inspect` or `compare` to identify the interaction behind the failed aggregate.
5. Adjust application code or the evidence pipeline—not the budget—unless the product requirement changed.

Related guides: [performance budgets](performance-budgets.md), [GitHub Action](github-action.md), [release comparison](releases.md), and [troubleshooting](troubleshooting.md).
