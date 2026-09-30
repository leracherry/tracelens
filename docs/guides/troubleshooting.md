# Troubleshooting

## Studio shows “offline”

- Confirm `tracelens studio` is still running and the port matches the SDK endpoint.
- Use the same loopback hostname consistently. `localhost` and `127.0.0.1` are different origins.
- Studio accepts browser-originated collector traffic only from loopback origins. A page served from a LAN hostname must proxy telemetry through its own origin or use another collector.
- Check the browser Network panel for `/__tracelens` responses.

```bash
curl http://127.0.0.1:4173/__tracelens
```

## No interactions appear

Event Timing reports interactions above the browser's duration threshold. Confirm the SDK is initialized before the interaction, sampling did not exclude the session, and the browser supports the API.

Use a stable name and create an explicit span to verify delivery:

```ts
import { mark, trace } from '@leracherry/tracelens-browser';

mark('debug-ready');
await trace('debug-operation', () => expensiveOperation());
```

## React work is missing

- Initialize `@leracherry/tracelens-browser` before rendering.
- Wrap the relevant tree in `TraceLensProfiler` or `TraceBoundary`.
- Use a profiling-enabled React production build when measuring production.
- Remember that boundaries attribute React commits; they do not inspect component internals or explain why React rendered.

## Long-frame scripts have no source location

- Confirm the event has the same `app`, `release`, and—when configured—`commit` as the imported map bundle.
- Upload adjacent `.js.map` or `.mjs.map` files with the exact generated URL prefix.
- Verify the browser supplied `sourceCharPosition`; some entries expose duration without a position.
- Restart Studio after importing maps.

## A budget reports no data

`minimumSamples` applies independently to each check. Verify the selected release, app, environment, and route exist in the trace. Use JSON output to inspect the selection:

```bash
npx @leracherry/tracelens-cli budget check \
  --file trace.json \
  --config tracelens.yml \
  --format json
```

## The privacy audit reports a finding

Remove sensitive values at the source when possible. Otherwise rename application spans, add URL segment redaction, or suppress the problematic value with a custom sanitizer. The audit is heuristic; a clean result is not a guarantee of anonymization.

## OTLP export retries forever

TraceLens retries delivery after network failures and retryable `429`, `502`, `503`, and `504` responses. Permanent collector rejections are reported through `onRejected` and are not retried. Inspect collector logs, CORS policy, OTLP endpoint path, and authentication headers.

## Diagnose the local project

```bash
npx @leracherry/tracelens-cli doctor
```

The command checks Node.js, browser and React packages, release metadata, and source maps. Warnings describe optional or incomplete setup; failures make the command exit non-zero.
