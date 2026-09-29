# Source maps

Source maps connect long-frame script contributions with original files and line/column locations. This integration was introduced in v0.3.0 (Phase 18).

## Local workflow

Build your application with external source maps, for example Vite's `build: { sourcemap: true }`. Keep the exact generated JavaScript alongside its `.js.map` or `.mjs.map` file.

Build TraceLens from source, then import your application's output:

```bash
pnpm install
pnpm build
pnpm exec tracelens sourcemaps upload /path/to/app/dist \
  --app dashboard --release 2.14.0 \
  --url-prefix https://app.example.com/ \
  --repository https://github.com/owner/repo \
  --commit abcdef1234567890
pnpm exec tracelens studio
```

`upload` imports into a local store; it does not contact a hosted service. The default store is `.tracelens/sourcemaps` relative to the working directory. Pass `--store /path/to/store` to both commands to use a different directory. Restart Studio after importing. The standalone CLI collector resolves locations; the Vite development collector used by `pnpm dev` does not load this store.

Initialize the browser SDK with the same `app` and `release`. A file at `dist/assets/app.js` matches `https://app.example.com/assets/app.js` in this example. URL matching is exact and uses the SDK's sanitized URL; custom URL sanitizers may prevent a match. No basename fallback or remote fetching occurs.

The CLI requires app/release and limits imports and loaded stores to 20 MiB. A second import for the same app/release fails rather than overwriting existing maps. Use a unique release for each build.

## What Studio shows

Select an interaction and inspect **Long animation frames**. Each script lists its original source file, one-based line and column, and duration. Missing maps, unsupported offsets, and unmapped positions show the generated source with “source unresolved”.

The browser records the LoAF `sourceCharPosition` (a zero-based UTF-16 offset). Core converts it using the exact generated JavaScript and resolves the v3 source map. Older traces without this offset remain unresolved; there is no inferred line number.

GitHub links require an explicitly supplied HTTPS GitHub repository and a 7–40 character hexadecimal commit. They are generated only for repository-relative original source paths such as `src/Checkout.tsx`. Absolute paths, parent traversals, and virtual paths such as `webpack://` are displayed but not linked. Configure your map's source paths accordingly; TraceLens does not guess repository roots. When both telemetry and bundle have commits, they must match exactly.

## Privacy and limits

- Original `sourcesContent` is stripped on import. Generated JavaScript and source names remain on disk; treat the store as sensitive. New bundle files use owner-only permissions.
- Maps are never fetched from telemetry URLs. Symlinked map entries and directories are skipped; symlinked generated scripts are rejected.
- Source paths and mapped names become visible in local Studio and its collector response. Do not expose this unauthenticated local server publicly.
- Supports flat v3 maps with encoded mappings, not indexed maps, inline data URLs, remote map uploads, or error-stack parsing.
- Source mapping happens in the local collector, not in the browser or OTLP exporter. It does not increase the browser's map-processing workload.

References: [LoAF script attribution](https://www.w3.org/TR/long-animation-frames/) and [trace-mapping](https://github.com/jridgewell/trace-mapping).
