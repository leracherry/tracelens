import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { assert, startBrowserHarness } from './browser-harness.mjs';

const budgets = JSON.parse(
  await readFile(
    new URL('../benchmarks/browser-overhead/budgets.json', import.meta.url),
    'utf8',
  ),
);
const harness = await startBrowserHarness();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(harness.origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__tracelens));

  const result = await page.evaluate(async () => {
    const median = (values) =>
      [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const measure = (operation, count = 2_000) => {
      const samples = [];
      for (let round = 0; round < 7; round += 1) {
        const start = performance.now();
        for (let index = 0; index < count; index += 1) operation(index);
        samples.push((performance.now() - start) / count);
      }
      return median(samples);
    };
    const nativeMark = measure((index) => performance.mark(`native-${index}`));
    performance.clearMarks();
    const initialization = window.__tracelens.start();
    const tracedMark = measure((index) =>
      window.__tracelens.mark(`trace-${index}`),
    );
    performance.clearMarks();
    const traceSamples = [];
    for (let round = 0; round < 5; round += 1) {
      const start = performance.now();
      for (let index = 0; index < 500; index += 1)
        await window.__tracelens.trace('benchmark', () => undefined);
      traceSamples.push((performance.now() - start) / 500);
    }
    return {
      initialization,
      nativeMark,
      tracedMark,
      trace: median(traceSamples),
    };
  });

  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  const taskDuration = async () => {
    const metrics = await session.send('Performance.getMetrics');
    return (
      metrics.metrics.find((metric) => metric.name === 'TaskDuration')?.value ??
      0
    );
  };
  const beforeIdle = await taskDuration();
  const idleSeconds = 1.5;
  await page.waitForTimeout(idleSeconds * 1_000);
  const idleMillisecondsPerSecond =
    (((await taskDuration()) - beforeIdle) * 1_000) / idleSeconds;
  await page.evaluate(() => window.__tracelens.stop());

  const markAdded = Math.max(0, result.tracedMark - result.nativeMark);
  assert(
    result.initialization <= budgets.initializationMilliseconds,
    `Initialization ${result.initialization.toFixed(3)} ms exceeds ${budgets.initializationMilliseconds} ms`,
  );
  assert(
    markAdded <= budgets.markAddedMillisecondsPerCall,
    `mark() added ${markAdded.toFixed(4)} ms/call, exceeding ${budgets.markAddedMillisecondsPerCall} ms`,
  );
  assert(
    result.trace <= budgets.traceMillisecondsPerCall,
    `trace() used ${result.trace.toFixed(4)} ms/call, exceeding ${budgets.traceMillisecondsPerCall} ms`,
  );
  assert(
    idleMillisecondsPerSecond <= budgets.idleTaskMillisecondsPerSecond,
    `Idle task time ${idleMillisecondsPerSecond.toFixed(3)} ms/s exceeds ${budgets.idleTaskMillisecondsPerSecond} ms/s`,
  );
  console.log(
    [
      'Browser overhead passed:',
      `init ${result.initialization.toFixed(3)} ms`,
      `mark +${markAdded.toFixed(4)} ms/call`,
      `trace ${result.trace.toFixed(4)} ms/call`,
      `idle ${idleMillisecondsPerSecond.toFixed(3)} ms/s`,
    ].join(' '),
  );
} finally {
  await browser?.close();
  await harness.close();
}
