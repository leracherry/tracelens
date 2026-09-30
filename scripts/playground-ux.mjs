import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '../apps/playground/dist');
const output = resolve(import.meta.dirname, '../test-results/playground-ux');
await mkdir(output, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/__tracelens' && request.method === 'POST') {
    for await (const _ of request) void _;
    response.writeHead(202).end();
    return;
  }
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
  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  desktop.on('pageerror', (error) => errors.push(error.message));
  desktop.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await desktop.goto(origin, { waitUntil: 'networkidle' });

  const scenarios = [
    ['Slow search', 'Run search'],
    ['Settings save', 'Save settings'],
    ['Slow checkout', 'Place order'],
    ['Layout thrash', 'Recalculate layout'],
    ['Third-party block', 'Load analytics'],
  ];
  for (const [scenario, action] of scenarios) {
    await desktop.getByRole('button', { name: new RegExp(scenario) }).click();
    await desktop.getByRole('button', { name: action }).waitFor();
  }

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

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
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
  await mobile.screenshot({
    path: resolve(output, 'mobile.png'),
    fullPage: true,
  });

  console.log(
    'Playground UX passed: all scenarios are reachable, controls are named, browser errors are absent, and mobile layout is usable.',
  );
} finally {
  await browser?.close();
  server.close();
}
