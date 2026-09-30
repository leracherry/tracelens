import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  snapshotPathTemplate: 'tests/studio/snapshots/{arg}{ext}',
  use: {
    browserName: 'chromium',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    viewport: { width: 1440, height: 900 },
  },
});
