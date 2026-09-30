import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createStudioServer } from '../packages/cli/dist/studio.js';
import { createStudioDemoEvents } from '../tests/studio/demo-events.mjs';

const output = resolve(import.meta.dirname, '../test-results/studio-ux');
await mkdir(output, { recursive: true });
const server = createStudioServer(
  resolve(import.meta.dirname, '../apps/studio/dist'),
);
await new Promise((ready, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', ready);
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No Studio port');
const origin = `http://127.0.0.1:${address.port}`;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function auditPage(page, label) {
  const issues = await page.evaluate(() => {
    const problems = [];
    if (document.documentElement.lang !== 'en')
      problems.push('missing lang=en');
    if (!document.title.trim()) problems.push('missing title');
    if (document.querySelectorAll('main').length !== 1)
      problems.push('expected one main landmark');
    if (!document.querySelector('nav[aria-label]'))
      problems.push('navigation has no accessible label');
    if (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
    )
      problems.push('document has horizontal overflow');
    for (const image of document.querySelectorAll('img'))
      if (!image.hasAttribute('alt')) problems.push('image missing alt');
    for (const control of document.querySelectorAll(
      'button, select, a[href]',
    )) {
      const label = control.closest('label');
      const name =
        control.getAttribute('aria-label') ||
        control.getAttribute('aria-labelledby') ||
        label?.textContent ||
        control.textContent;
      if (!name?.trim()) problems.push(`${control.tagName} has no name`);
    }
    const ids = [...document.querySelectorAll('[id]')].map(
      (element) => element.id,
    );
    if (new Set(ids).size !== ids.length) problems.push('duplicate ids');
    return problems;
  });
  assert(
    issues.length === 0,
    `${label} accessibility/layout audit: ${issues.join(', ')}`,
  );
}

async function openPage(browser, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.locator('.status.ready').waitFor({ state: 'attached' });
  assert(errors.length === 0, `Studio browser errors: ${errors.join(', ')}`);
  return page;
}

let browser;
try {
  const seeded = await fetch(`${origin}/__tracelens`, {
    method: 'POST',
    body: JSON.stringify(createStudioDemoEvents()),
  });
  assert(seeded.status === 202, 'Could not seed Studio UX fixture');
  browser = await chromium.launch({ headless: true });

  const desktop = await openPage(browser, { width: 1440, height: 1000 });
  await desktop
    .getByRole('heading', { name: 'See where the frame went.' })
    .waitFor();
  const slowInteraction = desktop
    .getByRole('button', { name: /Save settings.*487 ms/ })
    .first();
  await slowInteraction.focus();
  await desktop.keyboard.press('Enter');
  assert(
    (await slowInteraction.getAttribute('aria-pressed')) === 'true',
    'Keyboard selection did not expose selected state',
  );
  await desktop.getByText('BillingForm', { exact: true }).first().waitFor();
  const sourceLink = desktop.getByRole('link', {
    name: /BillingForm\.tsx:183:9/,
  });
  assert(
    (await sourceLink.getAttribute('rel')) === 'noopener noreferrer',
    'Source link is not safely isolated',
  );
  const focusedOutline = await slowInteraction.evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  );
  assert(focusedOutline !== 'none', 'Keyboard focus is not visibly indicated');

  const releaseFilter = desktop.getByRole('combobox', {
    name: 'Filter by release',
  });
  await releaseFilter.selectOption('2.13.4');
  await desktop.getByText('1 traces', { exact: true }).waitFor();
  await releaseFilter.selectOption('all');

  const releaseButton = desktop.getByRole('button', { name: 'Releases' });
  await releaseButton.focus();
  await desktop.keyboard.press('Enter');
  await desktop
    .getByRole('heading', { name: 'Find the release that changed the frame.' })
    .waitFor();
  await desktop.getByText('Interaction deltas', { exact: true }).waitFor();
  await desktop.getByText(/interaction regression detected/).waitFor();
  const before = desktop.getByRole('combobox', { name: 'Before' });
  await before.selectOption('2.14.0');
  await desktop
    .getByRole('heading', { name: 'Two releases are needed' })
    .waitFor();
  await before.selectOption('2.13.4');
  await desktop.getByText('Interaction deltas', { exact: true }).waitFor();
  await auditPage(desktop, 'desktop');
  await desktop.screenshot({
    path: resolve(output, 'desktop-release.png'),
    fullPage: true,
  });

  const mobile = await openPage(browser, { width: 390, height: 844 });
  const mobileNav = mobile.getByRole('navigation', { name: 'Studio views' });
  assert(await mobileNav.isVisible(), 'Studio navigation is hidden on mobile');
  const navHeight =
    (await mobileNav.getByRole('button', { name: 'Releases' }).boundingBox())
      ?.height ?? 0;
  assert(
    navHeight >= 42,
    `Mobile navigation target is only ${navHeight}px tall`,
  );
  const traceList = await mobile.locator('.trace-list').boundingBox();
  const detail = await mobile.locator('.detail').boundingBox();
  assert(
    traceList && detail && Math.abs(traceList.x - detail.x) < 2,
    'Mobile trace detail is not a single column',
  );
  await mobile.getByRole('button', { name: 'Releases' }).click();
  await mobile.getByText('Interaction deltas', { exact: true }).waitFor();
  const mobileDelta = await mobile
    .locator('.delta-row:not(.delta-header)')
    .first()
    .boundingBox();
  assert(
    mobileDelta &&
      mobileDelta.x >= 0 &&
      mobileDelta.x + mobileDelta.width <= 390,
    'Mobile comparison card is clipped',
  );
  await auditPage(mobile, 'mobile');
  await mobile.screenshot({
    path: resolve(output, 'mobile-release.png'),
    fullPage: true,
  });

  const offline = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await offline.route('**/__tracelens', (route) => route.abort());
  await offline.goto(origin);
  await offline.locator('.status.error').waitFor({ state: 'attached' });
  assert(
    await offline.getByRole('navigation', { name: 'Studio views' }).isVisible(),
    'Offline state hid Studio navigation',
  );

  console.log(
    'Studio UX passed: interaction and release workflows, keyboard state, accessibility, offline status, and responsive layout.',
  );
} finally {
  await browser?.close();
  server.close();
}
