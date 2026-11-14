# Studio UX validation

TraceLens validates the built Studio and Playground in Chromium on every pull request and push to `main`. The Studio suite seeds deterministic synthetic telemetry through the real local collector and exercises the same application shipped in the CLI package. The Playground suite runs all five scenarios and inspects the telemetry sent by the browser SDK. It also checks responsive layout, named controls, and browser errors.

## Covered workflows

The end-to-end suite checks that an engineer can:

- select a slow interaction and individual timeline events with the keyboard;
- search captures by action name or route, combine release and route filters, retain the selection through polling, and recover from a collector outage;
- choose baseline and candidate releases, open matching candidate captures, and restore focus and scroll on return;
- use the interaction and release flows from desktop widths down to 320 CSS px;
- run all five Playground actions, verify their interaction, span, or network events in Chromium, and retry settings and checkout after a failed demo request.

Accessibility checks require named navigation and controls, one main landmark, alternative text declarations, unique IDs, visible keyboard focus, exposed pressed/selected state, and usable mobile target sizes. Responsive checks reject document-level horizontal overflow and verify the mobile list-to-inspector flow. Release comparison rows become labeled cards on phones.

Large comparison tables show 25 rows at a time. The suite checks that opening a capture from the second page restores the page and row focus on return. It also checks long identifiers at 320 CSS px.

For a packaged browser check, run `node scripts/release.mjs npm` after building and then `node scripts/smoke-release.mjs --browser`. The smoke test installs the local tarballs, starts the CLI, and follows a regression to a source-linked trace using loopback assets.

## Visual regression

The suite keeps deterministic screenshots for Interactions and Releases at 1440, 1024, and 390 CSS px in both themes under `tests/studio/snapshots`. Playwright compares the current built UI with those baselines using a small rendering tolerance. Large layout, spacing, color, or visibility changes fail CI. Semantic and geometry assertions remain the primary guardrails because font rasterization can vary slightly across operating systems.

Failed CI runs upload the latest desktop and mobile diagnostic screenshots for seven days. Review intentional visual changes locally before updating the baseline.

```bash
pnpm build
pnpm test:studio
pnpm test:playground
pnpm test:studio:visual

# Run the complete Studio gate
pnpm quality:studio
```

To accept an intentional visual change:

```bash
pnpm exec playwright test tests/studio/visual.spec.mjs --update-snapshots
```

Inspect the changed PNG in `tests/studio/snapshots` before committing it. UI fixtures must contain synthetic data only.
