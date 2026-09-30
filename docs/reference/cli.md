# CLI reference

The CLI requires Node.js 22 or newer. Commands return `0` on success and `1` for validation errors, failed privacy findings, failed budgets, or operational errors.

## `studio`

```bash
tracelens studio [--host 127.0.0.1] [--port 4173] [--store .tracelens/sourcemaps]
```

Starts the bundled Studio and its bounded in-memory collector. Keep the default loopback host. Browser collector requests are accepted only from loopback origins.

## `inspect`

```bash
tracelens inspect trace.json
```

Prints the slowest captured interaction, timing segments, primary contributor, correlated network work, React renders, and long frames.

## `compare`

```bash
tracelens compare BEFORE AFTER [--file trace.json] [--endpoint URL]
```

Reads a file or the running Studio collector and prints release, route, interaction, component, and long-frame deltas.

## `doctor`

```bash
tracelens doctor
```

Checks the local Node version, package setup, release metadata, and source-map availability.

## `privacy audit`

```bash
tracelens privacy audit [--file trace.json] [--endpoint URL]
```

Reports risky URL credentials, query strings, email-like values, sensitive keys, and unsafe metadata. Findings produce exit code `1`.

## `sourcemaps upload`

```bash
tracelens sourcemaps upload ./dist \
  --app dashboard \
  --release 1.0.0 \
  --url-prefix https://app.example/assets/ \
  [--repository https://github.com/OWNER/REPO] \
  [--commit SHA] \
  [--store .tracelens/sourcemaps]
```

Imports adjacent flat v3 maps into a local, release-scoped store. The command never uploads files to a remote service despite its compatibility-oriented name.

## `budget check`

```bash
tracelens budget check \
  [--config tracelens.yml] \
  [--file trace.json] \
  [--endpoint URL] \
  [--release VERSION] \
  [--app NAME] \
  [--environment NAME] \
  [--format text|json]
```

Failed or insufficient-data checks produce exit code `1`. JSON output follows budget report schema version 1.
