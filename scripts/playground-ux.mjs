import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';

const root = resolve(import.meta.dirname, '../apps/playground/dist');
const output = resolve(import.meta.dirname, '../test-results/playground-ux');
await mkdir(output, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    response.writeHead(url.pathname === '/api/checkout' ? 201 : 204, {
      'content-type': 'application/json',
    });
    response.end(
      url.pathname === '/api/checkout' ? '{"orderId":"example"}' : undefined,
    );
    return;
  }
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const path = resolve(root, `.${pathname}`);
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(path)).isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'content-type': types[extname(path)] ?? 'application/octet-stream',
    });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((ready, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', ready);
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No port');
const origin = `http://127.0.0.1:${address.port}`;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const captured = [];
  const context = await browser.newContext();
  await context.route('http://localhost:4173/__tracelens', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') captured.push(...request.postDataJSON());
    await route.fulfill({
      status: request.method() === 'POST' ? 202 : 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  });
  const desktop = await context.newPage();
  await desktop.setViewportSize({
    width: 1440,
    height: 900,
  });
  const errors = [];
  const uncaughtErrors = [];
  desktop.on('pageerror', (error) => {
    errors.push(error.message);
    uncaughtErrors.push(error.message);
  });
  desktop.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await desktop.goto(origin, { waitUntil: 'networkidle' });

  const brand = desktop.getByRole('img', { name: 'tracelens', exact: true });
  await expect(brand).toHaveAttribute('src', '/brand.png');
  await brand.evaluate((image) => image.decode());

  const scenarios = [
    ['Slow search', 'Run search', 'Run slow search', 'filter-search-results'],
    [
      'Settings save',
      'Save settings',
      'Save settings',
      'serialize-settings',
      ['PATCH', '/api/settings', 204],
    ],
    [
      'Slow checkout',
      'Place order',
      'Place order',
      'render-order-confirmation',
      ['POST', '/api/checkout', 201],
    ],
    [
      'Layout thrash',
      'Recalculate layout',
      'Recalculate dashboard layout',
      'layout-thrash',
    ],
    [
      'Third-party block',
      'Load analytics',
      'Load analytics script',
      'third-party.analytics.bootstrap',
    ],
  ];
  const supportsLongFrames = await desktop.evaluate(() =>
    PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'),
  );
  for (const [
    scenario,
    action,
    interactionName,
    spanName,
    network,
  ] of scenarios) {
    const scenarioButton = desktop.getByRole('button', {
      name: scenario,
      exact: true,
    });
    await scenarioButton.click();
    await expect(scenarioButton).toHaveAttribute('aria-pressed', 'true');
    const spacing = await desktop.locator('main').evaluate((workspace) => {
      const { paddingInlineStart, paddingInlineEnd } =
        getComputedStyle(workspace);
      const controls = [
        ...workspace.querySelectorAll('.select-control select'),
      ];
      return {
        paddingInlineStart,
        paddingInlineEnd,
        insets: controls.map(
          (control) => getComputedStyle(control).paddingInlineEnd,
        ),
      };
    });
    assert(
      spacing.paddingInlineStart === spacing.paddingInlineEnd,
      `Asymmetric workspace for ${scenario}`,
    );
    assert(
      spacing.insets.every((inset) => inset === '36px'),
      `Select label crowds the chevron for ${scenario}`,
    );
    const start = captured.length;
    await desktop.getByRole('button', { name: action, exact: true }).click();
    await expect
      .poll(
        () => {
          const events = captured.slice(start);
          const interaction = events.find(
            (event) =>
              event.type === 'interaction' &&
              event.payload.name === interactionName,
          );
          const span = events.find(
            (event) =>
              event.type === 'custom-span' && event.payload.name === spanName,
          );
          const matchingNetwork =
            !network ||
            events.some(
              (event) =>
                event.type === 'network' &&
                event.payload.method === network[0] &&
                new URL(event.payload.url).pathname === network[1] &&
                event.payload.status === network[2],
            );
          const matchingFrame =
            !supportsLongFrames ||
            (span &&
              events.some(
                (event) =>
                  event.type === 'long-frame' &&
                  event.payload.startTime <=
                    span.payload.startTime + span.payload.duration &&
                  event.payload.startTime + event.payload.duration >=
                    span.payload.startTime,
              ));
          return Boolean(
            interaction && span && matchingNetwork && matchingFrame,
          );
        },
        { message: `Expected telemetry from ${scenario}`, timeout: 10_000 },
      )
      .toBe(true);
  }
  await desktop
    .getByRole('button', { name: 'Settings save', exact: true })
    .click();
  await desktop.screenshot({
    path: resolve(output, 'desktop.png'),
    fullPage: true,
  });

  const issues = await desktop.evaluate(() => {
    const problems = [];
    if (document.querySelectorAll('main').length !== 1)
      problems.push('expected one main landmark');
    if (!document.querySelector('nav[aria-label]'))
      problems.push('navigation has no accessible label');
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
    return problems;
  });
  assert(!errors.length, `Playground browser errors: ${errors.join(', ')}`);
  assert(
    !issues.length,
    `Playground accessibility audit: ${issues.join(', ')}`,
  );

  await desktop
    .getByRole('button', { name: 'Slow search', exact: true })
    .click();
  await desktop
    .getByRole('textbox', { name: 'Search query' })
    .fill('no-such-fixture');
  await desktop.getByRole('button', { name: 'Run search' }).click();
  await expect(
    desktop.getByText('No matches. Try a different search query.'),
  ).toBeVisible();
  for (const [scenario, path, action, error, success] of [
    [
      'Settings save',
      '/api/settings',
      'Save settings',
      'Settings could not be saved. Try again.',
      /^Saved ·/,
    ],
    [
      'Slow checkout',
      '/api/checkout',
      'Place order',
      'Order could not be placed. Try again.',
      /^Order confirmed/,
    ],
  ]) {
    const pattern = `**${path}?*`;
    await desktop.getByRole('button', { name: scenario, exact: true }).click();
    let releaseRequest;
    const responseReady = new Promise((resolve) => {
      releaseRequest = resolve;
    });
    await desktop.route(pattern, async (route) => {
      await responseReady;
      await route.fulfill({ status: 503 });
    });
    const button = desktop.getByRole('button', { name: action, exact: true });
    const status = desktop.locator('footer').getByRole('status');
    try {
      await button.click();
      await expect(button).toBeDisabled();
    } finally {
      releaseRequest();
    }
    await expect(status).toContainText(error);
    await expect(button).toBeEnabled();
    await desktop.unroute(pattern);
    await button.click();
    await expect(status).toHaveText(success);
  }

  assert(
    !uncaughtErrors.length,
    `Unexpected Playground error: ${uncaughtErrors.join(', ')}`,
  );

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(origin, { waitUntil: 'networkidle' });
  const overflow = await mobile.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  assert(!overflow, 'Playground has horizontal overflow on mobile');
  const navTarget = await mobile
    .getByRole('button', { name: /Slow search/ })
    .boundingBox();
  assert(
    navTarget && navTarget.height >= 44,
    'Mobile scenario target is too small',
  );
  await mobile.emulateMedia({ colorScheme: 'dark' });
  await expect(
    mobile.getByRole('img', { name: 'tracelens', exact: true }),
  ).toHaveAttribute('src', '/brand-dark.png');
  for (const width of [390, 320]) {
    await mobile.setViewportSize({ width, height: 844 });
    for (const [scenario, action] of scenarios) {
      await mobile.getByRole('button', { name: scenario, exact: true }).click();
      await expect(
        mobile.getByRole('button', { name: action, exact: true }),
      ).toBeVisible();
      const fits = await mobile.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      );
      assert(
        fits,
        `Playground has horizontal overflow in ${scenario} at ${width}px`,
      );
    }
  }
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile
    .getByRole('button', { name: 'Settings save', exact: true })
    .click();
  await mobile.screenshot({
    path: resolve(output, 'mobile.png'),
    fullPage: true,
  });

  console.log(
    'Playground UX passed: all five scenarios emitted telemetry, controls are named, and mobile layout is usable.',
  );
} finally {
  await browser?.close();
  server.close();
}
