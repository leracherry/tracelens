# Publishing TraceLens

The **Release** GitHub Actions workflow validates the repository, builds eight packages, installs their tarballs in a temporary project, tests the bundled Studio, publishes both registries, and creates a GitHub Release with npm tarballs attached.

Requirements:

- Repository secret `NPM_TOKEN` with publish access to the `@tracelens` npm scope and permission to publish without an interactive OTP.
- Workflow `GITHUB_TOKEN` permissions for `packages: write` and `contents: write`.
- A version in the root package.json and matching release notes under `docs/releases/` (update the notes path in the workflow for future versions).

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

For GitHub Packages, configure `@leracherry:registry=https://npm.pkg.github.com` in your npm configuration and authenticate with a token that has `read:packages`. Follow the registry's account permissions when installing; npm is the simplest public installation route.

Build outputs and staging files live under ignored `dist/` directories. No credentials are copied into tarballs.
