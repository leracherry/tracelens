# @leracherry/tracelens-cli

Local Studio and trace tools for TraceLens v0.4.0.

## Installation

Install from npm using the command below, or see [GitHub Packages authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md). Both registries use the same package names. Keep all TraceLens packages on matching versions.

```bash
npm install @leracherry/tracelens-cli@0.4.0
```

## Usage

```bash
npx @leracherry/tracelens-cli@0.4.0 studio
npx @leracherry/tracelens-cli@0.4.0 inspect trace.json
npx @leracherry/tracelens-cli@0.4.0 compare 1.0.0 1.1.0 --file trace.json
npx @leracherry/tracelens-cli@0.4.0 privacy audit --file trace.json
npx @leracherry/tracelens-cli@0.4.0 sourcemaps upload ./dist --app dashboard --release 1.0.0 --url-prefix https://app.example/
npx @leracherry/tracelens-cli@0.4.0 budget check --config tracelens.yml --file trace.json --release 1.0.0
npx @leracherry/tracelens-cli@0.4.0 doctor
```

Requires Node.js 22+. Studio is bundled and defaults to http://127.0.0.1:4173. Its collector uses bounded in-memory storage without authentication; do not expose it publicly. Privacy audit is heuristic and exits 1 for findings or errors. Source maps remain local and are matched by app, release, and exact generated URL. Budget checks support strict YAML, fail closed on insufficient data, and emit stable JSON for CI.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/getting-started.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.4.0.md). Licensed MIT.
