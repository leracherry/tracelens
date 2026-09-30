import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const version = JSON.parse(await readFile(join(root, 'package.json'))).version;
const directory = await mkdtemp(join(tmpdir(), 'tracelens-release-'));
const artifacts = resolve(root, 'dist/release/npm');
const tarballs = (await readdir(artifacts))
  .filter((file) => file.endsWith(`-${version}.tgz`))
  .map((file) => join(artifacts, file));
assert.equal(tarballs.length, 9);
await writeFile(
  join(directory, 'package.json'),
  '{"private":true,"type":"module"}\n',
);
execFileSync(
  'npm',
  ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs],
  { cwd: directory, stdio: 'inherit' },
);
for (const name of [
  'protocol',
  'browser',
  'react',
  'vite',
  'core',
  'storage-file',
  'storage-memory',
  'otel',
]) {
  const packageDirectory = join(
    directory,
    'node_modules/@leracherry',
    `tracelens-${name}`,
  );
  const manifest = JSON.parse(
    await readFile(join(packageDirectory, 'package.json'), 'utf8'),
  );
  assert.equal(manifest.exports['.'].types, './dist/index.d.ts');
  await readFile(join(packageDirectory, manifest.exports['.'].types));
}
execFileSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `
  for (const name of ['protocol','browser','react','vite','core','storage-file','storage-memory','otel']) await import('@leracherry/tracelens-' + name);
`,
  ],
  { cwd: directory, stdio: 'inherit' },
);
const cli = join(
  directory,
  'node_modules/@leracherry/tracelens-cli/dist/index.js',
);
assert.equal(
  execFileSync(process.execPath, [cli, '--version'], {
    encoding: 'utf8',
  }).trim(),
  `tracelens ${version}`,
);
assert.match(
  execFileSync(
    process.execPath,
    [cli, 'inspect', join(root, 'examples/traces/slow-settings.json')],
    { encoding: 'utf8' },
  ),
  /Save settings/,
);
const maps = join(directory, 'maps');
const store = join(directory, 'store');
await mkdir(maps);
await writeFile(join(maps, 'app.js'), 'run();');
await writeFile(
  join(maps, 'app.js.map'),
  JSON.stringify({
    version: 3,
    sources: ['src/app.ts'],
    names: [],
    mappings: 'AAAA',
  }),
);
execFileSync(
  process.execPath,
  [
    cli,
    'sourcemaps',
    'upload',
    maps,
    '--app',
    'smoke',
    '--release',
    'smoke',
    '--url-prefix',
    'https://example.com/',
    '--store',
    store,
  ],
  { stdio: 'inherit' },
);
const server = spawn(
  process.execPath,
  [cli, 'studio', '--port', '19473', '--store', store],
  {
    cwd: directory,
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);
try {
  await new Promise((ready, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Studio startup timed out')),
      10000,
    );
    server.stdout.once('data', () => {
      clearTimeout(timeout);
      ready();
    });
    server.once('exit', () => {
      clearTimeout(timeout);
      reject(new Error('Studio exited before startup'));
    });
  });
  const origin = 'http://127.0.0.1:19473';
  const html = await (await fetch(origin)).text();
  assert.match(html, /TraceLens Studio/);
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(origin + asset)).status, 200);
  assert.equal(
    (await fetch(origin + '/__tracelens', { method: 'POST', body: '{}' }))
      .status,
    400,
  );
  const event = {
    version: 1,
    id: 'smoke',
    timestamp: 1,
    sessionId: 'smoke',
    app: 'smoke',
    type: 'mark',
    payload: { name: 'ready', startTime: 0 },
  };
  assert.equal(
    (
      await fetch(origin + '/__tracelens', {
        method: 'POST',
        body: JSON.stringify([event]),
      })
    ).status,
    202,
  );
  assert.deepEqual(await (await fetch(origin + '/__tracelens')).json(), [
    event,
  ]);
  const frame = {
    ...event,
    release: 'smoke',
    type: 'long-frame',
    payload: {
      startTime: 0,
      duration: 50,
      scripts: [
        {
          source: 'https://example.com/app.js',
          sourceCharPosition: 0,
          duration: 40,
          thirdParty: false,
        },
      ],
    },
  };
  assert.equal(
    (
      await fetch(origin + '/__tracelens', {
        method: 'POST',
        body: JSON.stringify([frame]),
      })
    ).status,
    202,
  );
  const collected = await (await fetch(origin + '/__tracelens')).json();
  assert.equal(
    collected[1].payload.scripts[0].originalLocation.source,
    'src/app.ts',
  );
  const budgetConfig = join(directory, 'tracelens.yml');
  const budgetTrace = join(directory, 'budget-trace.json');
  await writeFile(
    budgetConfig,
    'performance:\n  longFramesPerSession:\n    max: 1\n',
  );
  await writeFile(budgetTrace, JSON.stringify([frame]));
  assert.match(
    execFileSync(
      process.execPath,
      [cli, 'budget', 'check', '--config', budgetConfig, '--file', budgetTrace],
      { encoding: 'utf8' },
    ),
    /All budgets passed/,
  );
  console.log(
    'Release smoke test passed: nine tarballs, runtime imports, type declarations, CLI, budgets, bundled Studio, collector.',
  );
} finally {
  server.kill();
}
