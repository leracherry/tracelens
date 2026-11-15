import { resolve } from 'node:path';
import { expect, test } from 'playwright/test';
import { createStudioServer } from '../../packages/cli/dist/studio.js';
import { createStudioDemoEvents } from './demo-events.mjs';

let server;
let origin;

test.beforeAll(async () => {
  server = createStudioServer(
    resolve(import.meta.dirname, '../../apps/studio/dist'),
  );
  await new Promise((ready, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', ready);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No Studio port');
  origin = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${origin}/__tracelens`, {
    method: 'POST',
    body: JSON.stringify(createStudioDemoEvents()),
  });
  expect(response.status).toBe(202);
});

test.afterAll(async () => {
  await new Promise((resolveClose) => server.close(resolveClose));
});

for (const [size, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['tablet', { width: 1024, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  for (const theme of ['light', 'dark']) {
    for (const view of ['Interactions', 'Releases']) {
      test(`${view} in ${theme} on ${size}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(origin);
        await page.locator('.status.ready').waitFor();
        if (theme === 'dark')
          await page
            .getByRole('button', { name: 'Switch to dark mode' })
            .click();
        if (view === 'Releases') {
          await page.getByRole('button', { name: 'Releases' }).click();
          await expect(
            page.getByRole('table', { name: 'Interaction deltas' }),
          ).toBeVisible();
          const [baseline, candidate, arrow] = await Promise.all([
            page.getByRole('combobox', { name: 'Baseline' }).boundingBox(),
            page.getByRole('combobox', { name: 'Candidate' }).boundingBox(),
            page.locator('.compare-arrow').boundingBox(),
          ]);
          expect(Math.abs(baseline.width - candidate.width)).toBeLessThan(1);
          expect(Math.abs(baseline.y - candidate.y)).toBeLessThan(1);
          expect(
            Math.abs(
              arrow.y + arrow.height / 2 - (baseline.y + baseline.height / 2),
            ),
          ).toBeLessThan(1);
          expect(
            Math.abs(
              arrow.x -
                (baseline.x + baseline.width) -
                (candidate.x - arrow.x - arrow.width),
            ),
          ).toBeLessThan(1);
        } else {
          if (size === 'mobile') {
            await page
              .getByRole('button', { name: /Save settings.*487 ms/ })
              .click();
          }
          await expect(
            page.getByRole('heading', { name: 'Save settings' }),
          ).toBeVisible();
          await page
            .getByRole('button', {
              name: 'Browser: Long animation frame, 381 ms',
            })
            .click();
          await expect(page.locator('#timeline-evidence')).toContainText(
            'Start offset 12 ms',
          );
        }
        const spacing = await page.locator('main').evaluate((workspace) => {
          const { paddingInlineStart, paddingInlineEnd } =
            getComputedStyle(workspace);
          return { paddingInlineStart, paddingInlineEnd };
        });
        expect(spacing.paddingInlineStart).toBe(spacing.paddingInlineEnd);
        for (const select of await page
          .locator('.select-trigger:visible')
          .all()) {
          const endInsets = await select.evaluate((element) => ({
            text: getComputedStyle(element).paddingInlineEnd,
            chevron: getComputedStyle(element, '::after').insetInlineEnd,
          }));
          expect(endInsets).toEqual({ text: '36px', chevron: '14px' });
        }
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
        const snapshot =
          view === 'Releases' && theme === 'dark' && size === 'desktop'
            ? 'studio-release-desktop.png'
            : `studio-${view.toLowerCase()}-${size}-${theme}.png`;
        await expect(page).toHaveScreenshot(snapshot, {
          animations: 'disabled',
          maxDiffPixelRatio: 0.08,
          threshold: 0.2,
        });
      });
    }
  }
}
