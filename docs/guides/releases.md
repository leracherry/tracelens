# Comparing releases

Capture two application builds with different `release` values in the same running Studio, then open **Releases** and choose Before and After.

The view shows INP p75, LCP p75, long frames per session, route and interaction durations, and React component durations and sample counts.

```bash
npx @tracelens/cli compare 1.0.0 1.1.0
npx @tracelens/cli compare 1.0.0 1.1.0 --file trace.json
npx @tracelens/cli compare 1.0.0 1.1.0 --endpoint http://127.0.0.1:4173/__tracelens
```

Release names must match the event envelopes. The default source is the running local Studio collector. Trace files are JSON arrays of events.

## Interpreting v0.2.0 results

Percentiles use nearest rank. INP p75 currently aggregates captured interaction durations rather than finalized page-level INP values. LCP uses captured samples. Component duration is p75 per profiler sample, and render counts count samples, not unique application renders across nested profilers.

Studio treats changes within 5% as neutral. The CLI lists positive changes. Neither view estimates statistical significance. A missing baseline or a zero baseline has no finite percentage change. The current display uses `new` for an undefined percentage; inspect both values before interpreting it.

Use comparable traffic, routes, environments, and capture windows. Aggregation currently groups by release name alone, so use distinct release names or prefilter exported events when comparing different apps or environments. The reported number of new long frames is the positive difference in total counts, not source-level identification.
