import { chromium } from 'playwright';
import { assert, startBrowserHarness } from './browser-harness.mjs';

const harness = await startBrowserHarness();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(harness.origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__tracelens));
  await page.evaluate(() => window.__tracelens.start());

  await page.evaluate(async () => {
    window.__tracelens.mark('fixture-ready');
    await window.__tracelens.trace('load-settings', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    await window.__tracelens.xhr('/api/xhr?token=private-value');
  });
  await page.getByRole('button', { name: 'Save settings' }).click();
  await page.waitForFunction(() => window.__clickComplete === true);
  await page.waitForTimeout(500);

  const result = await page.evaluate(async () => {
    const supported = window.__tracelens.supportedEntryTypes;
    const events = await window.__tracelens.stop();
    return {
      events,
      supported,
      restored: window.__tracelens.patchesRestored(),
    };
  });

  const eventsOf = (type) =>
    result.events.filter((event) => event.type === type);
  assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(', ')}`);
  assert(eventsOf('navigation').length === 1, 'Navigation was not captured');
  assert(
    eventsOf('mark').some((event) => event.payload.name === 'fixture-ready'),
    'mark() was not captured',
  );
  assert(
    eventsOf('custom-span').some(
      (event) => event.payload.name === 'load-settings',
    ),
    'trace() was not captured',
  );
  const network = eventsOf('network');
  assert(
    network.some((event) => event.payload.transport === 'fetch'),
    'fetch was not captured',
  );
  assert(
    network.some((event) => event.payload.transport === 'xhr'),
    'XHR was not captured',
  );
  assert(
    network.every((event) => !event.payload.url.includes('?')),
    'Network query strings were not redacted',
  );
  assert(
    harness.requests.includes('/api/click?account=private-value'),
    'Instrumentation changed the application fetch URL',
  );
  assert(
    harness.requests.includes('/api/xhr?token=private-value'),
    'Instrumentation changed the application XHR URL',
  );
  assert(result.restored, 'shutdown() did not restore patched browser APIs');

  if (result.supported.includes('event')) {
    const interaction = eventsOf('interaction').find(
      (event) => event.payload.name === 'Save settings',
    );
    assert(
      interaction,
      'Event Timing is supported but the slow click was not captured',
    );
    assert(
      interaction.payload.duration >= 100,
      'Captured interaction omitted the deliberate blocking work',
    );
    assert(
      network.some(
        (event) =>
          event.payload.interactionId === interaction.payload.interactionId,
      ),
      'Fetch was not correlated to the click interaction',
    );
  }
  if (result.supported.includes('long-animation-frame')) {
    assert(
      eventsOf('long-frame').length > 0,
      'LoAF is supported but no long frame was captured',
    );
  }

  console.log(
    `Browser integration passed: ${result.events.length} events; capabilities: ${result.supported.filter((type) => ['event', 'long-animation-frame', 'largest-contentful-paint', 'layout-shift'].includes(type)).join(', ') || 'basic'}.`,
  );
} finally {
  await browser?.close();
  await harness.close();
}
