import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = await json('package.json');
const version = manifest.version;
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Invalid root version: ${String(version)}`);
}

const workspaces = [
  'apps/playground',
  'apps/studio',
  'packages/action',
  'packages/browser',
  'packages/cli',
  'packages/core',
  'packages/otel',
  'packages/protocol',
  'packages/react',
  'packages/storage-file',
  'packages/storage-memory',
  'packages/vite',
];

for (const workspace of workspaces) {
  const current = await json(`${workspace}/package.json`);
  if (current.version !== version) {
    throw new Error(`${workspace} has ${current.version}; expected ${version}`);
  }
}

await readFile(resolve(root, `docs/releases/v${version}.md`));
const otel = await readFile(
  resolve(root, 'packages/otel/src/index.ts'),
  'utf8',
);
if (!otel.includes(`version: '${version}'`)) {
  throw new Error('OTLP instrumentation scope version is out of sync');
}

for (const workspace of workspaces.filter((path) =>
  path.startsWith('packages/'),
)) {
  const readme = await readFile(
    resolve(root, workspace, 'README.md'),
    'utf8',
  ).catch(() => '');
  if (workspace !== 'packages/action' && !readme.includes(`v${version}`)) {
    throw new Error(`${workspace}/README.md is out of sync`);
  }
}

console.log(`Version consistency passed for TraceLens ${version}.`);

async function json(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}
