import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const budgets = JSON.parse(
  await readFile(
    new URL('../benchmarks/browser-overhead/budgets.json', import.meta.url),
    'utf8',
  ),
);
const result = await build({
  entryPoints: [
    new URL('../packages/browser/src/index.ts', import.meta.url).pathname,
  ],
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  write: false,
});
const bytes = result.outputFiles[0].contents;
const gzipBytes = gzipSync(bytes, { level: 9 }).byteLength;
if (gzipBytes > budgets.browserCoreGzipBytes) {
  throw new Error(
    `Browser bundle is ${gzipBytes} bytes gzip; budget is ${budgets.browserCoreGzipBytes} bytes.`,
  );
}
console.log(
  `Browser bundle passed: ${bytes.byteLength} bytes minified, ${gzipBytes} bytes gzip / ${budgets.browserCoreGzipBytes} byte budget.`,
);
