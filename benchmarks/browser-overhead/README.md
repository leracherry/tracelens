# Browser SDK overhead

Phase 23 adds repeatable guardrails around TraceLens' browser cost. Run them after `pnpm build`:

```bash
pnpm size:browser
pnpm bench:browser
```

`size:browser` creates a minified, tree-shaken production bundle from the public browser entry point, includes its protocol dependency, compresses it with gzip, and checks the result against `budgets.json`.

`bench:browser` runs the built package in headless Chromium. It measures initialization, the incremental cost of `mark()` over the native Performance API, `trace()` calls, and main-thread task time while idle. It uses medians where repeated samples are meaningful and fails only on deliberately generous regression ceilings. These checks catch large regressions; they are not laboratory-grade benchmarks and should not be used to compare different machines.

The idle budget is normalized per second. Browser startup and page loading happen before the measurement window. Unsupported browser signals are covered separately by capability-aware integration assertions.
