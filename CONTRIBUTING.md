# Contributing to TraceLens

Focused bug reports, documentation improvements, tests, and code contributions are welcome. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). Discuss substantial changes in an issue before implementing them.

## Local setup

Use Node.js 22 or newer and pnpm 10.17.1 (the version in `package.json`).

```bash
git clone https://github.com/leracherry/tracelens.git
cd tracelens
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

The playground runs at http://127.0.0.1:4174 and Studio at http://127.0.0.1:4173. See the [walkthrough](docs/guides/performance-debugging-walkthrough.md) for controlled scenarios. Studio is unauthenticated and intended for local use.

## Where changes belong

- `packages/protocol`: shared event types and protocol contracts.
- `packages/browser`, `packages/react`, `packages/vite`: collection and application integration.
- `packages/core`, `packages/storage-*`: correlation, queries, and storage.
- `packages/cli`, `apps/studio`: command-line tools, collector, and debugging UI.
- `packages/otel`, `packages/action`: telemetry export and GitHub automation.
- `apps/playground`, `examples`, `docs`: demonstrations and documentation.

Preserve telemetry privacy defaults and backwards compatibility. Use synthetic data in fixtures and reports. Never commit tokens, real user traces, private source maps, or production identifiers.

## Before opening a pull request

Create a branch from `main`, keep changes focused, and add a regression test for behavior changes. Explain the problem, the chosen approach, and how you verified it. Include screenshots for UI changes and update affected guides.

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm docs:build
node scripts/release.mjs npm
node scripts/smoke-release.mjs
```

Use `pnpm exec prettier --write <changed-files>` to fix formatting. CI also verifies that the committed `packages/action/dist/index.cjs` matches the build: include the regenerated bundle when changing Action code or its bundled dependencies. Other `dist` directories are generated and ignored. The release packing and smoke commands above run locally without publishing.

## Product screenshots and demo

Install Playwright Chromium with `pnpm exec playwright install chromium`. Run `pnpm docs:capture` for screenshots, or install FFmpeg and run `pnpm docs:demo` for screenshots plus the GIF tour. FFmpeg must be on `PATH`; it is only needed for the animated capture, not normal builds or tests.

`scripts/capture-readme.mjs` starts a loopback-only collector on an ephemeral port, seeds synthetic telemetry, and uses the built Studio UI. The tour shows the interaction list, Save settings detail, and ReleaseScope, each for three seconds. It writes `docs/assets/studio-*.png` and `docs/assets/studio-demo.gif`; inspect the images before committing. Keep a static alternative for readers who prefer no animation. Update the fixture when the UI changes rather than retouching product screenshots.

## Documentation and releases

Run `pnpm docs:dev` for local documentation preview and `pnpm docs:build` to check links and production output. Keep examples consistent with the published version. Contributors should not publish packages or change versions as part of an unrelated patch; maintainers follow the [publishing guide](docs/guides/publishing.md).
