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

test('release comparison visual contract', async ({ page }) => {
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.locator('.status.ready').waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'Releases' }).click();
  await page.getByText('Interaction deltas', { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('studio-release-desktop.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.08,
    threshold: 0.2,
  });
});
