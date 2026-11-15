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
      'button, input, select, a[href]',
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
  const fixture = createStudioDemoEvents();
  const seeded = await fetch(`${origin}/__tracelens`, {
    method: 'POST',
    body: JSON.stringify(fixture),
  });
  assert(seeded.status === 202, 'Could not seed Studio UX fixture');
  browser = await chromium.launch({ headless: true });

  const desktop = await openPage(browser, { width: 1440, height: 1000 });
  await desktop
    .getByRole('heading', { name: 'Interactions', exact: true })
    .waitFor();
  const theme = desktop.getByRole('combobox', { name: 'Theme' });
  await theme.focus();
  const themeOutline = await theme.evaluate(
    (element) => getComputedStyle(element.parentElement).outlineStyle,
  );
  assert(
    themeOutline === 'solid',
    'The appearance icon has no keyboard focus ring',
  );
  await theme.selectOption('dark');
  await desktop.waitForFunction(
    () => getComputedStyle(document.documentElement).colorScheme === 'dark',
  );
  await desktop.locator('.theme-icon-dark').waitFor();
  await desktop.reload();
  await desktop.waitForFunction(
    () => getComputedStyle(document.documentElement).colorScheme === 'dark',
  );
  await desktop.emulateMedia({ colorScheme: 'dark' });
  await theme.selectOption('system');
  assert(
    await desktop.locator('html[data-theme="system"]').count(),
    'Studio did not apply the system theme preference',
  );
  await desktop.locator('.theme-icon-system').waitFor();
  await theme.selectOption('light');
  await desktop.waitForFunction(
    () => getComputedStyle(document.documentElement).colorScheme === 'light',
  );

  const slowInteraction = desktop
    .getByRole('button', { name: /Save settings.*487 ms/ })
    .first();
  assert(
    (await slowInteraction.getAttribute('aria-pressed')) === 'true',
    'Studio did not select the slowest capture by default',
  );
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

  for (const timing of ['11 ms', '287 ms', '189 ms']) {
    await desktop
      .locator('.breakdown')
      .getByText(timing, { exact: true })
      .waitFor();
  }
  const frameEvent = desktop.getByRole('button', {
    name: 'Browser: Long animation frame, 381 ms',
  });
  await frameEvent.focus();
  await desktop.keyboard.press('Enter');
  await desktop
    .locator('#timeline-evidence')
    .getByText(/Start offset 12 ms.*Duration 381 ms/)
    .waitFor();
  await desktop
    .locator('#timeline-evidence')
    .getByRole('link', { name: /BillingForm\.tsx:183:9/ })
    .waitFor();
  const requestEvent = desktop.getByRole('button', {
    name: 'Network: PATCH /api/settings, 214 ms',
  });
  await requestEvent.focus();
  await desktop.keyboard.press('Space');
  await desktop
    .locator('#timeline-evidence')
    .getByText(/Start offset 120 ms.*Duration 214 ms/)
    .waitFor();
  await desktop
    .locator('#timeline-evidence')
    .getByText(/HTTP 204/)
    .waitFor();
  await auditPage(desktop, 'desktop interactions');
  await desktop.screenshot({
    path: resolve(output, 'desktop-interactions.png'),
    fullPage: true,
  });

  const releaseFilter = desktop.getByRole('combobox', {
    name: 'Filter by release',
  });
  await releaseFilter.selectOption('2.13.4');
  await desktop
    .locator('.capture-summary')
    .getByText(/1 captured/)
    .waitFor();
  await releaseFilter.selectOption('all');

  const search = desktop.getByRole('searchbox', { name: 'Search captures' });
  await search.fill(' SETTINGS ');
  assert(
    (await desktop.locator('.trace-list .trace').count()) === 2,
    'Search did not normalize the input',
  );
  await search.fill('/settings/profile');
  await releaseFilter.selectOption('2.13.4');
  await desktop
    .locator('.capture-summary')
    .getByText(/1 captured/)
    .waitFor();
  await search.fill('missing');
  await desktop
    .getByRole('heading', { name: 'No matching interactions' })
    .waitFor();
  await search.press('Escape');
  await desktop
    .locator('.capture-summary')
    .getByText(/1 captured/)
    .waitFor();
  await desktop.getByRole('button', { name: 'Clear filters' }).click();

  const releaseButton = desktop.getByRole('button', { name: 'Releases' });
  await releaseButton.focus();
  await desktop.keyboard.press('Enter');
  await desktop
    .getByRole('heading', { name: 'Releases', exact: true })
    .waitFor();
  await desktop.getByText('Interaction deltas', { exact: true }).waitFor();
  await desktop.getByText(/interaction regression detected/).waitFor();
  assert(
    (await releaseFilter.count()) === 0,
    'Interaction release filter is shown in the comparison view',
  );
  const before = desktop.getByRole('combobox', { name: 'Baseline' });
  await before.selectOption('2.14.0');
  await desktop
    .getByRole('heading', { name: 'Choose two different releases' })
    .waitFor();
  await before.selectOption('2.13.4');
  await desktop.getByText('Interaction deltas', { exact: true }).waitFor();
  const interactionTable = desktop.getByRole('table', {
    name: 'Interaction deltas',
  });
  await interactionTable.getByRole('cell', { name: '183 ms' }).waitFor();
  await interactionTable.getByRole('cell', { name: '487 ms' }).waitFor();
  await interactionTable.getByText('+166%', { exact: true }).waitFor();
  const pivot = interactionTable.getByRole('button', {
    name: /View captures for Save settings/,
  });
  await pivot.focus();
  await desktop.keyboard.press('Enter');
  assert(
    (await search.count()) === 0,
    'Candidate scope should display the exact matching capture group',
  );
  const captureHeading = desktop.getByRole('heading', {
    name: 'Release captures',
  });
  await captureHeading.waitFor();
  assert(
    await captureHeading.evaluate(
      (element) => document.activeElement === element,
    ),
    'Capture pivot did not move focus to the new view',
  );
  await desktop
    .getByRole('button', { name: /Save settings.*487 ms/ })
    .waitFor();
  assert(
    !(await desktop
      .getByRole('button', { name: /Save settings.*183 ms/ })
      .count()),
    'Pivot included a baseline capture',
  );
  const returnButton = desktop.getByRole('button', {
    name: 'Back to comparison',
  });
  await returnButton.focus();
  await desktop.keyboard.press('Enter');
  await pivot.waitFor();
  assert(
    await pivot.evaluate((element) => document.activeElement === element),
    'Return did not restore focus to the interaction delta',
  );
  assert(
    (await before.inputValue()) === '2.13.4',
    'Return changed the baseline',
  );
  assert(
    (await desktop
      .getByRole('combobox', { name: 'Candidate' })
      .inputValue()) === '2.14.0',
    'Return changed the candidate',
  );
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
  const mobileRow = mobile.getByRole('button', {
    name: /Save settings.*487 ms/,
  });
  await mobileRow.click();
  const mobileHeading = mobile.getByRole('heading', { name: 'Save settings' });
  await mobileHeading.waitFor();
  assert(
    await mobileHeading.evaluate(
      (element) => document.activeElement === element,
    ),
    'Mobile inspector did not receive focus',
  );
  assert(
    !(await mobileRow.isVisible()),
    'Mobile inspector kept the capture list visible',
  );
  await auditPage(mobile, 'mobile interactions');
  await mobile.screenshot({
    path: resolve(output, 'mobile-interactions.png'),
    fullPage: true,
  });
  await mobile.getByRole('button', { name: 'Back to interactions' }).click();
  assert(
    await mobileRow.evaluate((element) => document.activeElement === element),
    'Back did not restore focus to the capture row',
  );
  await mobile.getByRole('button', { name: 'Releases' }).click();
  await mobile.getByText('Interaction deltas', { exact: true }).waitFor();
  const mobileDelta = await mobile
    .locator('.delta-table tbody tr')
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

  const routePivot = mobile
    .getByRole('table', { name: 'Route deltas' })
    .getByRole('button', { name: 'View captures for /settings/profile' });
  await routePivot.scrollIntoViewIfNeeded();
  const routePosition = (await routePivot.boundingBox()).y;
  await routePivot.click();
  await mobile.getByRole('heading', { name: 'Release captures' }).waitFor();
  await mobile.getByRole('button', { name: /Save settings.*487 ms/ }).click();
  await mobile.getByRole('heading', { name: 'Save settings' }).waitFor();
  await mobile.getByRole('button', { name: 'Back to comparison' }).click();
  await routePivot.waitFor();
  assert(
    await routePivot.evaluate((element) => document.activeElement === element),
    'Mobile return did not restore focus to the route delta',
  );
  assert(
    Math.abs((await routePivot.boundingBox()).y - routePosition) < 4,
    'Mobile return did not restore the comparison scroll position',
  );
  await mobile.setViewportSize({ width: 320, height: 720 });
  await auditPage(mobile, '320px release comparison');

  const newInteraction = fixture.find(
    (event) => event.id === '2.14.0-save-new',
  );
  const request = fixture.find((event) => event.type === 'network');
  const pollutedRequests = [
    { sessionId: 'different-session' },
    { timeOrigin: 2000 },
    { release: '2.13.4' },
  ].map((fields, index) => ({
    ...request,
    ...fields,
    id: `unrelated-request-${index}`,
    payload: { ...request.payload, url: 'https://app.example/unrelated' },
  }));
  const newRoute = {
    ...newInteraction,
    id: 'checkout-capture',
    timeOrigin: 3000,
    payload: {
      ...newInteraction.payload,
      interactionId: 'checkout-capture',
      name: 'Apply coupon',
      route: '/checkout',
      duration: 700,
      timing: {
        ...newInteraction.payload.timing,
        total: 700,
        presentationDelay: 402,
      },
    },
  };
  let captures = fixture.map((event) => ({ ...event, timeOrigin: 1000 }));
  let collectorOffline = false;
  const live = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await live.route('**/__tracelens', (route) =>
    collectorOffline ? route.abort() : route.fulfill({ json: captures }),
  );
  await live.goto(origin);
  const liveRow = live.getByRole('button', { name: /Save settings.*487 ms/ });
  await liveRow.click();
  await live.getByRole('button', { name: /Network: PATCH/ }).click();
  captures = [
    ...captures,
    newRoute,
    ...pollutedRequests.map((event) => ({ timeOrigin: 1000, ...event })),
  ];
  await live.getByRole('button', { name: /Apply coupon.*700 ms/ }).waitFor();
  assert(
    (await liveRow.getAttribute('aria-pressed')) === 'true',
    'Refresh changed the selected interaction',
  );
  assert(
    (await live
      .getByRole('button', { name: /Network: PATCH \/api\/settings/ })
      .getAttribute('aria-pressed')) === 'true',
    'Refresh changed the selected timeline event',
  );
  assert(
    !(await live.getByRole('button', { name: /unrelated/ }).count()),
    'Evidence leaked across sessions, releases, or page time origins',
  );
  collectorOffline = true;
  await live.getByText('Showing the last successful capture.').waitFor();
  assert(
    await liveRow.isVisible(),
    'Collector outage cleared the last capture',
  );
  collectorOffline = false;
  await live.getByRole('button', { name: 'Retry collector' }).click();
  await live.locator('.status.ready').waitFor();
  await live
    .getByRole('combobox', { name: 'Filter by route' })
    .selectOption('/checkout');
  await live.getByRole('heading', { name: 'Apply coupon' }).waitFor();
  await live
    .getByText('No correlated events are available for this capture.')
    .waitFor();
  await live
    .getByRole('combobox', { name: 'Filter by release' })
    .selectOption('2.13.4');
  await live
    .getByRole('heading', { name: 'No matching interactions' })
    .waitFor();
  await live.getByRole('button', { name: 'Clear filters' }).click();
  await live.getByRole('heading', { name: 'Apply coupon' }).waitFor();
  await live.setViewportSize({ width: 320, height: 720 });
  await auditPage(live, '320px interaction list');
  await live.getByRole('button', { name: /Save settings.*487 ms/ }).click();
  await auditPage(live, '320px interaction inspector');

  const baseCapture = fixture.find((event) => event.id === '2.13.4-save-old');
  captures = [
    ...captures,
    {
      ...baseCapture,
      id: 'removed-capture',
      payload: { ...baseCapture.payload, name: 'Removed action' },
    },
    {
      ...newInteraction,
      id: 'another-save',
      payload: { ...newInteraction.payload, duration: 405 },
    },
    {
      ...newInteraction,
      id: 'another-name',
      payload: { ...newInteraction.payload, name: 'Reset settings' },
    },
    {
      ...newInteraction,
      id: 'another-route',
      payload: { ...newInteraction.payload, route: '/admin' },
    },
  ];
  await live.getByRole('button', { name: 'Releases' }).click();
  const liveTable = live.getByRole('table', { name: 'Interaction deltas' });
  const removed = liveTable.getByRole('row', { name: /Removed action/ });
  await removed.getByText('Removed', { exact: true }).waitFor();
  await removed.getByText('No candidate captures').waitFor();
  const livePivot = liveTable.getByRole('button', {
    name: 'View captures for Save settings on /settings/profile',
  });
  await livePivot.click();
  assert(
    (await live.locator('.trace-list .trace').count()) === 2,
    'Grouped pivot did not return exactly the matching candidate captures',
  );
  captures = captures.filter(
    (event) =>
      event.release !== '2.14.0' ||
      event.type !== 'interaction' ||
      event.payload.route !== '/settings/profile',
  );
  await live
    .getByRole('heading', { name: 'No matching candidate captures' })
    .waitFor();
  await live.getByRole('button', { name: 'Back to comparison' }).click();
  const releaseHeading = live.getByRole('heading', {
    name: 'Releases',
    exact: true,
  });
  assert(
    await releaseHeading.evaluate(
      (element) => document.activeElement === element,
    ),
    'A vanished row did not fall back to the comparison heading',
  );
  captures = captures.filter((event) => event.release === '2.13.4');
  await live
    .getByRole('heading', { name: 'Two captured releases are needed' })
    .waitFor();

  captures = [
    ...fixture,
    ...Array.from({ length: 26 }, (_, index) => ({
      ...newInteraction,
      id: `additional-scope-${index}`,
      payload: {
        ...newInteraction.payload,
        name: `Additional action ${index}`,
      },
    })),
  ];
  await live.getByRole('button', { name: 'Next interaction page' }).waitFor();
  assert(
    (await liveTable.locator('tbody tr').count()) === 25,
    'Comparison did not bound the number of visible rows',
  );
  await live.getByRole('button', { name: 'Next interaction page' }).click();
  await live.getByText('Showing 26–27 of 27').waitFor();
  await livePivot.click();
  await live.getByRole('heading', { name: 'Release captures' }).waitFor();
  await live.getByRole('button', { name: 'Back to comparison' }).click();
  await live.getByText('Showing 26–27 of 27').waitFor();
  assert(
    await livePivot.evaluate((element) => document.activeElement === element),
    'Return did not restore focus on the second page',
  );

  const longRelease = 'feature-'.repeat(20) + 'candidate';
  const longRoute = '/workspace/' + 'integration-'.repeat(16);
  const longName = 'Synchronize ' + 'customer-records-'.repeat(12);
  captures = [
    ...fixture,
    {
      ...newInteraction,
      id: 'long-identifiers',
      release: longRelease,
      payload: { ...newInteraction.payload, name: longName, route: longRoute },
    },
  ];
  const longCandidate = live.getByRole('combobox', { name: 'Candidate' });
  await longCandidate
    .locator('option')
    .filter({ hasText: longRelease })
    .waitFor({ state: 'attached' });
  await longCandidate.selectOption(longRelease);
  await liveTable
    .getByRole('rowheader', { name: new RegExp(longName) })
    .waitFor();
  await auditPage(live, '320px comparison with long identifiers');
  await live.getByRole('button', { name: 'Interactions' }).click();
  await live
    .getByRole('combobox', { name: 'Filter by release' })
    .selectOption(longRelease);
  await live
    .getByRole('combobox', { name: 'Filter by route' })
    .selectOption(longRoute);
  await auditPage(live, '320px interaction filters with long identifiers');
  await live.getByRole('button', { name: new RegExp(longName) }).click();
  await auditPage(live, '320px inspector with long identifiers');

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
    'Studio UX passed: filters, evidence, polling, collector recovery, release workflow, and responsive layout.',
  );
} finally {
  await browser?.close();
  server.close();
}
