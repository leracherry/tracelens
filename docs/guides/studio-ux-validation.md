# Studio UX validation

TraceLens validates the built Studio in Chromium on every pull request and push to `main`. The suite seeds deterministic synthetic telemetry through the real local collector and exercises the same application shipped in the CLI package.

## Covered workflows

The end-to-end suite checks that an engineer can:

- select a slow interaction with the keyboard and inspect timing, React work, network work, and source links;
- filter telemetry to one release and return to the complete dataset;
- open ReleaseScope with the keyboard, inspect regression tables, and change the before/after releases;
- understand collector loading, ready, and offline states without an uncaught browser error;
- use both interaction and release workflows at desktop and phone widths.

Accessibility checks require named navigation and controls, one main landmark, alternative text declarations, unique IDs, visible keyboard focus, exposed pressed/selected state, and usable mobile target sizes. Responsive checks reject document-level horizontal overflow and enforce a single-column interaction layout. Release comparison rows become labeled cards on phones.

## Visual regression

The suite keeps a deterministic desktop ReleaseScope screenshot under `tests/studio/snapshots`. Playwright compares the current built UI with that baseline using a small rendering tolerance. Large layout, spacing, color, or visibility changes fail CI. Semantic and geometry assertions remain the primary guardrails because font rasterization can vary slightly across operating systems.

Failed CI runs upload the latest desktop and mobile diagnostic screenshots for seven days. Review intentional visual changes locally before updating the baseline.

```bash
pnpm build
pnpm test:studio
pnpm test:studio:visual

# Run the complete Studio gate
pnpm quality:studio
```

To accept an intentional visual change:

```bash
pnpm exec playwright test tests/studio/visual.spec.mjs --update-snapshots
```

Inspect the changed PNG in `tests/studio/snapshots` before committing it. UI fixtures must contain synthetic data only.
