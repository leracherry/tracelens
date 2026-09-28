# @tracelens/cli

Local Studio and trace tools for TraceLens v0.2.0.

## Installation

See [registry availability and authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md) before installing. npm scope publication is not yet confirmed; the GitHub Packages mirror and source builds are alternatives. Keep all TraceLens packages on matching versions.

```bash
npm install @tracelens/cli@0.2.0
```

## Usage

```bash
npx @tracelens/cli@0.2.0 studio
npx @tracelens/cli@0.2.0 inspect trace.json
npx @tracelens/cli@0.2.0 compare 1.0.0 1.1.0 --file trace.json
npx @tracelens/cli@0.2.0 privacy audit --file trace.json
npx @tracelens/cli@0.2.0 doctor
```

Requires Node.js 22+. Studio is bundled and defaults to http://127.0.0.1:4173. Its collector uses bounded in-memory storage without authentication; do not expose it publicly. Privacy audit is heuristic and exits 1 for findings or errors.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/getting-started.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.2.0.md). Licensed MIT.
