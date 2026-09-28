import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const directory = await mkdtemp(join(tmpdir(), 'tracelens-release-'));
const artifacts = resolve(root, 'dist/release/npm');
const tarballs = (await readdir(artifacts))
  .filter((file) => file.endsWith('.tgz'))
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
execFileSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `
  for (const name of ['protocol','browser','react','vite','core','storage-file','storage-memory','otel']) await import('@tracelens/' + name);
`,
  ],
  { cwd: directory, stdio: 'inherit' },
);
const cli = join(directory, 'node_modules/@tracelens/cli/dist/index.js');
assert.match(
  execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }),
  /0.1.0/,
);
assert.match(
  execFileSync(
    process.execPath,
    [cli, 'inspect', join(root, 'examples/traces/slow-settings.json')],
    { encoding: 'utf8' },
  ),
  /Save settings/,
);
const server = spawn(process.execPath, [cli, 'studio', '--port', '19473'], {
  cwd: directory,
  stdio: ['ignore', 'pipe', 'inherit'],
});
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
  console.log(
    'Release smoke test passed: nine tarballs, runtime imports, CLI, bundled Studio, collector.',
  );
} finally {
  server.kill();
}
