# Comparing releases

Capture two application builds with different `release` values in the same running Studio, then open **Releases** and choose **Baseline** and **Candidate**.

The view shows sample counts, INP p75, LCP p75, long frames per session, and deltas for routes, interactions, and React components. **View captures** on an interaction or route opens the matching candidate captures. **Back to comparison** returns to the same row and keeps the selected release pair.

```bash
npx @leracherry/tracelens-cli compare 1.0.0 1.1.0
npx @leracherry/tracelens-cli compare 1.0.0 1.1.0 --file trace.json
npx @leracherry/tracelens-cli compare 1.0.0 1.1.0 --endpoint http://127.0.0.1:4173/__tracelens
```

Release names must match the event envelopes. The default source is the running local Studio collector. Trace files are JSON arrays of events.

## Interpreting comparison results

Percentiles use nearest rank. INP p75 currently aggregates captured interaction durations rather than finalized page-level INP values. LCP uses captured samples. Component duration is p75 per profiler sample, and render counts count samples, not unique application renders across nested profilers.

Studio labels changes within ±5% as **Within threshold** and counts positive changes above 5% as regressions. Candidate-only scopes are **New**, baseline-only scopes are **Removed**, and a zero baseline can leave the percentage unavailable. The CLI lists positive changes. Interpret the deltas as observed changes in the captured sample.

Use comparable traffic, routes, environments, and capture windows. Aggregation currently groups by release name alone, so use distinct release names or prefilter exported events when comparing different apps or environments. The additional long-frame count is the positive difference between the two release totals.
