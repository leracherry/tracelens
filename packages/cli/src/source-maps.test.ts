import {
  mkdtemp,
  mkdir,
  writeFile,
  readdir,
  readFile,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { loadSourceMaps, uploadSourceMaps } from './source-maps.js';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'tracelens-maps-test-'));
  roots.push(root);
  const dist = join(root, 'dist');
  const store = join(root, 'store');
  await mkdir(dist);
  await writeFile(join(dist, 'app.js'), 'run();');
  await writeFile(
    join(dist, 'app.js.map'),
    JSON.stringify({
      version: 3,
      sources: ['src/app.ts'],
      sourcesContent: ['private source'],
      names: [],
      mappings: 'AAAA',
    }),
  );
  return {
    root,
    dist,
    store,
    app: 'app',
    release: '../release',
    urlPrefix: 'https://example.com/assets/',
  };
}
it('imports locally, strips source contents, and resolves only the matching release', async () => {
  const options = await fixture();
  expect(await uploadSourceMaps(options.dist, options)).toBe(1);
  const files = await readdir(options.store);
  expect(files[0]).toMatch(/^[a-f0-9]{64}\.json$/);
  expect(await readFile(join(options.store, files[0]!), 'utf8')).not.toContain(
    'private source',
  );
  const resolver = await loadSourceMaps(options.store);
  const resolved = resolver({
    version: 1,
    id: 'f',
    timestamp: 1,
    sessionId: 's',
    app: 'app',
    release: '../release',
    type: 'long-frame',
    payload: {
      startTime: 0,
      duration: 50,
      scripts: [
        {
          source: 'https://example.com/assets/app.js',
          sourceCharPosition: 0,
          duration: 40,
          thirdParty: false,
        },
      ],
    },
  });
  if (resolved.type !== 'long-frame') throw Error();
  expect(resolved.payload.scripts[0]?.originalLocation?.source).toBe(
    'src/app.ts',
  );
  await expect(uploadSourceMaps(options.dist, options)).rejects.toThrow();
});
it('rejects unsafe URL prefixes, missing scripts, invalid maps, and empty imports', async () => {
  const options = await fixture();
  for (const urlPrefix of [
    'file:///tmp/',
    'https://user:secret@example.com/',
    'https://example.com/?token=x',
  ])
    await expect(
      uploadSourceMaps(options.dist, { ...options, urlPrefix }),
    ).rejects.toThrow();
  await writeFile(join(options.dist, 'app.js.map'), '{}');
  await expect(uploadSourceMaps(options.dist, options)).rejects.toThrow();
  await rm(join(options.dist, 'app.js'));
  await expect(uploadSourceMaps(options.dist, options)).rejects.toThrow();
  await rm(join(options.dist, 'app.js.map'));
  await expect(uploadSourceMaps(options.dist, options)).rejects.toThrow(
    'No adjacent',
  );
});
it('does not follow script symlinks', async () => {
  const options = await fixture();
  await rm(join(options.dist, 'app.js'));
  await writeFile(join(options.root, 'outside.js'), 'private');
  await symlink(join(options.root, 'outside.js'), join(options.dist, 'app.js'));
  await expect(uploadSourceMaps(options.dist, options)).rejects.toThrow(
    'regular file',
  );
});
