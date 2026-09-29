# Browser support and overhead

TraceLens validates the built browser SDK in Chromium and enforces explicit size and runtime overhead budgets on every pull request and push to `main`.

## What the browser test covers

The integration fixture loads the compiled public package in an actual browser. It verifies:

- navigation, marks, and custom spans;
- real fetch and XMLHttpRequest instrumentation;
- Event Timing and Long Animation Frame capture when Chromium exposes those APIs;
- correlation between a deliberately slow click and its fetch request;
- URL query-string redaction without changing the application's request;
- restoration of patched browser APIs during `shutdown()`.

The assertions are capability-aware. An unsupported performance-entry type is skipped, matching the SDK's runtime behavior, while baseline instrumentation remains required.

Run the test after building:

```bash
pnpm build
pnpm test:browser
```

Install the matching browser once with `pnpm exec playwright install chromium` if Playwright reports that it is missing.

## Enforced budgets

The source of truth is [`benchmarks/browser-overhead/budgets.json`](https://github.com/leracherry/tracelens/blob/main/benchmarks/browser-overhead/budgets.json).

| Measurement                 |       CI ceiling |
| --------------------------- | ---------------: |
| Minified browser core, gzip |           20 KiB |
| Initialization              |            25 ms |
| Added `mark()` cost         |  0.5 ms per call |
| `trace()` cost              |  0.5 ms per call |
| Idle main-thread task time  | 10 ms per second |

The size check bundles the public browser entry and protocol dependency using production minification, then applies maximum gzip compression. The runtime benchmark uses headless Chromium, repeated samples, and medians where applicable. Its ceilings are intentionally broad regression guards, not cross-machine performance claims.

```bash
pnpm size:browser
pnpm bench:browser

# Run all Phase 23 browser checks
pnpm quality:browser
```

Keep benchmark results in context: thermal state, browser version, runner contention, and hardware all affect small timings. Compare changes on the same machine when investigating a regression. See the [benchmark methodology](https://github.com/leracherry/tracelens/tree/main/benchmarks/browser-overhead) for details.
