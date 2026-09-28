# Publishing TraceLens

The **Release** GitHub Actions workflow validates the repository, builds nine packages (including `@tracelens/otel`), installs their tarballs in a temporary project, tests the bundled Studio, attempts publication to both registries, and creates a GitHub Release with npm-format tarballs attached. v0.2.0 includes Phases 16 and 17.

The previous npm publication authenticated successfully but was rejected under the `@tracelens` scope. A repository secret alone does not grant scope access. Until npm publication is confirmed, use a source build or the GitHub Packages mirror. A successful GitHub Release does not prove npm publication succeeded; the workflow reports npm failures separately.

Requirements:

- Repository secret `NPM_TOKEN` with publish access to the `@tracelens` npm scope and permission to publish without an interactive OTP.
- Workflow `GITHUB_TOKEN` permissions for `packages: write` and `contents: write`.
- Matching versions in the root and package manifests, CLI version output, and OTLP instrumentation scope, plus release notes at `docs/releases/v<VERSION>.md`. The workflow selects the notes using the root version.

Run locally before publishing:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node scripts/release.mjs npm
node scripts/smoke-release.mjs
```

Then dispatch the Release workflow on `main`. Existing registry versions are skipped so a partially completed publication can be retried. Published versions are immutable: use a new version for code changes after publication.

## Registry names

npm packages use `@tracelens/browser`, `@tracelens/cli`, and the other documented names. GitHub Packages requires the owner's namespace, so its mirror uses `@leracherry/tracelens-browser`, `@leracherry/tracelens-cli`, etc. The release script rewrites internal dependency names and compiled imports for the mirror. Repository metadata associates those packages with this repository.

For GitHub Packages, configure the scope registry and authenticate with a token that has `read:packages` (do not commit tokens):

```bash
npm config set @leracherry:registry https://npm.pkg.github.com
npm login --scope=@leracherry --registry=https://npm.pkg.github.com
npm install @leracherry/tracelens-browser@0.2.0
npx @leracherry/tracelens-cli@0.2.0 studio
```

Use mirror import names too, for example `import { init } from '@leracherry/tracelens-browser'`. Keep all TraceLens packages on the same version and registry; don't mix the two namespaces. GitHub package visibility and account permissions govern installation.

Build outputs and staging files live under ignored `dist/` directories. No credentials are copied into tarballs.
