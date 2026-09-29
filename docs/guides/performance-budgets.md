# Performance budgets

Performance budgets turn captured release telemetry into a CI-friendly pass or fail result. The CLI feature is on `main`; it is not included in the published v0.3.0 packages. Phase 20 also provides a [GitHub Action](github-action.md) for checks, job summaries, report artifacts, and pull-request comments.

## Configuration

Copy the [example configuration](../../examples/budgets/tracelens.yml) to `tracelens.yml` and adjust it for your application:

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

All thresholds are maximums: lower is better. Durations use milliseconds; CLS is unitless. Unknown configuration keys, duplicate YAML keys, negative/non-finite values, missing checks, and files larger than 256 KiB are rejected.

`minimumSamples` defaults to 1. It applies independently to each metric and route. Long frames use the session count as their sample count. A configured check with too few samples reports `NO DATA` and fails the run, so an empty trace cannot make CI green.

## Check a trace

```bash
tracelens budget check \
  --config tracelens.yml \
  --file trace.json \
  --release 2.14.0 \
  --app billing-dashboard \
  --environment production
```

Omit `--file` to query the local Studio collector at `http://127.0.0.1:4173/__tracelens`, or provide `--endpoint`. If `--release` is omitted, TraceLens selects the release with the newest event after applying app and environment filters. If a selected release contains multiple apps or environments, the command requires the corresponding selector instead of mixing populations.

The command exits 0 only when every configured check passes. Budget failures and insufficient data exit 1. Configuration, input, and connection errors also exit 1 with a `TraceLens:` diagnostic.

Example text output:

```text
Production Performance Budget
Release: 2.14.0 · billing-dashboard · production

PASS     lcp.p75                              2130 ms / 2500 ms  (84 samples)
FAIL     inp.p75 /checkout                    238 ms / 150 ms  (42 samples)

Performance budget failed.
```

## Machine-readable output

Use `--format json` or `--json`:

```bash
tracelens budget check --file trace.json --format json > budget-report.json
```

The stable envelope has `schemaVersion: 1`, overall `passed`, the selected release/app/environment, and ordered checks. Each check includes its scope, metric, threshold, sample count, status, and `actual` when data exists. Status is `pass`, `fail`, or `no-data`.

JSON is written to stdout without terminal colors. Errors go to stderr. The report is still emitted when thresholds fail, followed by exit code 1, which lets CI archive the report before failing the job.

## Interpretation

The current `inp.p75` budget is the p75 of captured TraceLens interaction durations, not the page-level INP algorithm used by CrUX. LCP and CLS budgets use captured final Web Vital samples. Route budgets currently support interaction p75. These results describe the supplied sample and do not establish statistical significance; choose a meaningful `minimumSamples` and compare equivalent traffic populations.

Use the [GitHub Action](github-action.md) to publish the report as a check, a workflow artifact, a job summary, and a deduplicated pull-request comment.
