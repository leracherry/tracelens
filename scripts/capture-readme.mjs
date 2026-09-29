import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createStudioServer } from '../packages/cli/dist/studio.js';

const output = resolve(import.meta.dirname, '../docs/assets');
await mkdir(output, { recursive: true });

const events = [];
const add = (release, id, type, payload, session = `session-${release}`) =>
  events.push({
    version: 1,
    id: `${release}-${id}`,
    timestamp:
      Date.parse(
        release === '2.14.0' ? '2026-09-28T18:00:00Z' : '2026-09-20T18:00:00Z',
      ) + events.length,
    sessionId: session,
    app: 'billing-dashboard',
    release,
    commit: release === '2.14.0' ? '7ac841f' : '42bc310',
    environment: 'production',
    type,
    payload,
  });

const interaction = (release, id, name, route, startTime, duration) => {
  const scale = duration / 487;
  add(release, id, 'interaction', {
    interactionId: id,
    interactionType: 'click',
    name,
    route,
    startTime,
    duration,
    timing: {
      total: duration,
      inputDelay: Math.round(11 * scale),
      processingDuration: Math.round(287 * scale),
      presentationDelay:
        duration - Math.round(11 * scale) - Math.round(287 * scale),
    },
    target: { tagName: 'button', name, selector: 'button' },
  });
};

interaction(
  '2.13.4',
  'save-old',
  'Save settings',
  '/settings/profile',
  100,
  183,
);
interaction('2.13.4', 'coupon-old', 'Apply coupon', '/checkout', 700, 302);
interaction(
  '2.13.4',
  'search-old',
  'Search customers',
  '/customers',
  1300,
  148,
);
add('2.13.4', 'lcp', 'web-vital', {
  name: 'LCP',
  value: 1820,
  rating: 'good',
  route: '/settings/profile',
});
add('2.13.4', 'frame', 'long-frame', {
  startTime: 720,
  duration: 82,
  blockingDuration: 32,
  interactionId: 'coupon-old',
  scripts: [],
});
add('2.13.4', 'billing-render', 'react-render', {
  component: 'BillingForm',
  phase: 'update',
  duration: 44,
  baseDuration: 51,
  startTime: 730,
  commitTime: 774,
  renderCount: 1,
  interactionId: 'coupon-old',
});
add('2.13.4', 'price-render', 'react-render', {
  component: 'PriceSummary',
  phase: 'update',
  duration: 20,
  baseDuration: 23,
  startTime: 750,
  commitTime: 770,
  renderCount: 1,
  interactionId: 'coupon-old',
});

interaction(
  '2.14.0',
  'save-settings',
  'Save settings',
  '/settings/profile',
  2100,
  487,
);
interaction('2.14.0', 'coupon-new', 'Apply coupon', '/checkout', 2900, 392);
interaction(
  '2.14.0',
  'search-new',
  'Search customers',
  '/customers',
  3600,
  142,
);
add('2.14.0', 'lcp', 'web-vital', {
  name: 'LCP',
  value: 1910,
  rating: 'good',
  route: '/settings/profile',
});
add('2.14.0', 'frame-save', 'long-frame', {
  startTime: 2112,
  duration: 381,
  blockingDuration: 331,
  interactionId: 'save-settings',
  scripts: [
    {
      source: 'https://app.example/assets/settings.js',
      functionName: 'validateSettings',
      sourceCharPosition: 9183,
      originalLocation: {
        source: 'src/features/settings/BillingForm.tsx',
        line: 183,
        column: 9,
        githubUrl:
          'https://github.com/leracherry/tracelens/blob/214f550/src/features/settings/BillingForm.tsx#L183',
      },
      duration: 287,
      thirdParty: false,
    },
    {
      source: 'https://cdn.example/analytics.js',
      functionName: 'flush',
      duration: 47,
      thirdParty: true,
    },
  ],
});
add('2.14.0', 'settings-request', 'network', {
  method: 'PATCH',
  url: 'https://app.example/api/settings',
  status: 204,
  startTime: 2220,
  duration: 214,
  interactionId: 'save-settings',
  transport: 'fetch',
});
add('2.14.0', 'validation', 'custom-span', {
  name: 'validate-settings',
  startTime: 2130,
  duration: 118,
});
add('2.14.0', 'layout', 'layout-shift', {
  startTime: 2460,
  duration: 8,
  value: 0.03,
  interactionId: 'save-settings',
});
add('2.14.0', 'billing-render', 'react-render', {
  component: 'BillingForm',
  phase: 'update',
  duration: 117,
  baseDuration: 126,
  startTime: 2260,
  commitTime: 2377,
  renderCount: 3,
  interactionId: 'save-settings',
});
add('2.14.0', 'price-render', 'react-render', {
  component: 'PriceSummary',
  phase: 'update',
  duration: 61,
  baseDuration: 64,
  startTime: 2310,
  commitTime: 2371,
  renderCount: 4,
  interactionId: 'save-settings',
});
add('2.14.0', 'validation-render', 'react-render', {
  component: 'ValidationProvider',
  phase: 'update',
  duration: 38,
  baseDuration: 43,
  startTime: 2324,
  commitTime: 2362,
  renderCount: 2,
  interactionId: 'save-settings',
});
add('2.14.0', 'frame-coupon', 'long-frame', {
  startTime: 2930,
  duration: 137,
  blockingDuration: 87,
  interactionId: 'coupon-new',
  scripts: [],
});

const server = createStudioServer(
  resolve(import.meta.dirname, '../apps/studio/dist'),
);
await new Promise((ready, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', ready);
});
const address = server.address();
if (!address || typeof address === 'string')
  throw new Error('Studio did not bind');
const origin = `http://127.0.0.1:${address.port}`;

let browser;
try {
  const response = await fetch(origin + '/__tracelens', {
    method: 'POST',
    body: JSON.stringify(events),
  });
  if (response.status !== 202) throw new Error('Could not seed Studio');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.getByText('Save settings', { exact: true }).first().click();
  await page.screenshot({
    path: resolve(output, 'studio-interaction.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Releases' }).click();
  await page.getByText('Interaction deltas').waitFor();
  await page.screenshot({
    path: resolve(output, 'studio-release-comparison.png'),
    fullPage: true,
  });
  console.log('Captured Studio README screenshots in docs/assets.');
} finally {
  await browser?.close();
  server.close();
}
