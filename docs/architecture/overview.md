# Architecture overview

TraceLens is a local-first telemetry pipeline organized around one invariant: events that describe the same user interaction must remain correlatable across browser timing, application work, React commits, network spans, and release analysis.

## System map

```text
┌──────────────────────── Browser application ────────────────────────┐
│                                                                     │
│  Event Timing ─┐                                                    │
│  Long frames ──┤      @leracherry/tracelens-browser                │
│  Web Vitals ───┼──► correlation + privacy boundary ──► transport    │
│  fetch / XHR ──┤                 ▲                                  │
│  custom spans ─┘                 │                                  │
│                    @leracherry/tracelens-react                       │
└───────────────────────────────────┼─────────────────────────────────┘
                                    │ versioned protocol
                  ┌─────────────────┴──────────────────┐
                  ▼                                    ▼
         local Studio collector                 OTLP/HTTP exporter
                  │
         memory / file storage
                  │
          queries + source maps
                  │
        Studio / CLI / GitHub Action
```

## Package responsibilities

| Package               | Responsibility                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `tracelens-protocol`  | Versioned event envelope and payload types.                                                 |
| `tracelens-browser`   | Capture, correlation, sanitization, batching, and transport.                                |
| `tracelens-react`     | Supported React Profiler boundaries and render events.                                      |
| `tracelens-vite`      | Build-time release, commit, environment, and timestamp injection.                           |
| `tracelens-core`      | Trace queries, release comparisons, and source-map resolution.                              |
| `tracelens-storage-*` | In-memory and JSON-file event persistence adapters.                                         |
| `tracelens-otel`      | TraceLens event mapping and OTLP/HTTP JSON export.                                          |
| `tracelens-cli`       | Collector, Studio server, inspection, comparison, privacy, source-map, and budget commands. |
| Repository Action     | Budget orchestration, GitHub Checks, summaries, artifacts, and PR comments.                 |

Packages depend inward toward the protocol and core query layer. The browser SDK does not depend on Studio, storage, the CLI, or a particular backend.

## Event envelope

Every event uses protocol version 1 and carries identity, wall-clock timestamp, session, application, optional release metadata, event type, and a typed payload. Browser events also carry `timeOrigin` for timeline placement and W3C-compatible trace context for export.

The envelope is intentionally flat and append-friendly. Consumers reject unsupported versions rather than guessing at semantics. Package release versions and protocol versions are independent: TraceLens v0.4.0 still emits protocol version 1.

## Correlation model

The browser runtime observes the input lifecycle before Event Timing entries arrive. It creates short-lived candidates for click, pointer, and keyboard input, matches browser entries by type and start time, and gives related work a shared interaction ID. Exact IDs are preferred; timing overlap is a compatibility fallback.

See [interaction correlation](interaction-correlation.md) for the detailed lifecycle and edge cases.

## Privacy boundary

Sanitization happens in the browser before an event enters the queue or transport. The default policy removes credentials, query strings, fragments, email-shaped path segments, DOM text, input values, headers, request bodies, and response bodies. Explicit names and metadata remain the application's responsibility.

This boundary keeps downstream storage and exporters simpler, but it is not a substitute for reviewing deployment-specific labels, custom span names, routes, and consent requirements.

## Collection and analysis

The local CLI collector accepts bounded JSON batches and serves the bundled Studio. Core queries create interaction timelines and release comparisons without coupling capture to a UI framework.

Source maps are uploaded into a release-scoped local store. Resolution uses application, release, generated script URL, and source position so one deployment cannot accidentally resolve against another build's map.

Performance budgets reuse the same event model. The GitHub Action bundles that engine and its dependencies into a self-contained Node action, so consumer workflows do not install TraceLens packages before evaluating an artifact.

## Extension points

- Implement `Transport` to send sanitized events to an existing ingestion path.
- Implement storage adapters around the core query contracts.
- Use `trace()` and `mark()` for application-specific work.
- Map events through `tracelens-otel` when an OpenTelemetry backend is the system of record.

Keep extensions at these boundaries. Patching browser or React internals makes correlation fragile across runtime upgrades and is deliberately outside the design.

## Current trust model

Studio is a loopback-oriented development service with no authentication. It should not be exposed as a public collector. Production ingestion needs authentication, tenancy, rate limits, retention controls, and access policy supplied by the surrounding system.

The GitHub Action reads files selected by the workflow author and writes its report inside `GITHUB_WORKSPACE`. Repository tokens are used only for the optional check and PR comment surfaces; permission failures do not erase the local budget result.
