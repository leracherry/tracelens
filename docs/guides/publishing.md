# Publishing TraceLens

The **Release** GitHub Actions workflow validates the repository, builds nine packages (including `@leracherry/tracelens-otel`), installs their tarballs in a temporary project, tests the bundled Studio, publishes to both registries, and creates a GitHub Release with npm-format tarballs attached.

Since v0.2.1, npm publication uses the account-owned `@leracherry` scope. Publication is ordered deliberately: npm must succeed before GitHub Packages and the GitHub Release are created. Existing versions are skipped, so the workflow can safely resume after a partial registry publication.

Requirements:

- Repository secret `NPM_TOKEN` with publish access to the `@leracherry` npm scope and permission to publish without an interactive OTP.
- Workflow `GITHUB_TOKEN` permissions for `packages: write` and `contents: write`.
- Matching versions in the root and package manifests, CLI version output, and OTLP instrumentation scope, plus release notes at `docs/releases/v<VERSION>.md`. The workflow selects the notes using the root version.

Run locally before publishing:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm docs:check
node scripts/release.mjs npm
node scripts/smoke-release.mjs
```

Then dispatch the Release workflow on `main`. Existing registry versions are skipped so a partially completed publication can be retried. Published versions are immutable: use a new version for code changes after publication.

## Registry names

Both registries use `@leracherry/tracelens-browser`, `@leracherry/tracelens-cli`, and the other documented names. Package imports and dependencies are identical across registries. Repository metadata associates GitHub Packages with this repository.

For public npm installation, no GitHub credentials are needed. If you previously configured the scope for GitHub Packages, switch it back with `npm config set @leracherry:registry https://registry.npmjs.org`.

For GitHub Packages, configure the scope registry and authenticate with a token that has `read:packages` (do not commit tokens):

```bash
npm config set @leracherry:registry https://npm.pkg.github.com
npm login --scope=@leracherry --registry=https://npm.pkg.github.com
npm install @leracherry/tracelens-browser@1.0.0
npx @leracherry/tracelens-cli@1.0.0 studio
```

Use `import { init } from '@leracherry/tracelens-browser'` on either registry. Keep all TraceLens packages on the same version. GitHub package visibility and account permissions govern installation from the mirror.

Build outputs and staging files live under ignored `dist/` directories. No credentials are copied into tarballs.
