import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import {
  createSourceMapResolver,
  type SourceMapBundle,
} from '@leracherry/tracelens-core';

const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadSourceMaps(
  directory: string,
  options: {
    app: string;
    release: string;
    urlPrefix: string;
    store: string;
    repository?: string;
    commit?: string;
  },
) {
  if (!options.app || !options.release)
    throw new Error('App and release are required');
  const prefix = new URL(options.urlPrefix);
  if (
    !['https:', 'http:'].includes(prefix.protocol) ||
    prefix.username ||
    prefix.password ||
    prefix.search ||
    prefix.hash
  )
    throw new Error(
      'URL prefix must be an HTTP(S) URL without credentials, query, or fragment',
    );
  if (!prefix.pathname.endsWith('/')) prefix.pathname += '/';
  const root = resolve(directory);
  const bundle: SourceMapBundle = {
    version: 1,
    app: options.app,
    release: options.release,
    repository: options.repository,
    commit: options.commit,
    artifacts: [],
  };
  let bytes = 0;
  async function walk(path: string) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await walk(file);
        continue;
      }
      if (!entry.isFile() || !/\.m?js\.map$/.test(entry.name)) continue;
      const script = file.slice(0, -4);
      // Never follow a generated-script symlink, either.
      const { lstat } = await import('node:fs/promises');
      const scriptInfo = await lstat(script);
      if (!scriptInfo.isFile())
        throw new Error('Generated script must be a regular file');
      bytes += (await stat(file)).size + scriptInfo.size;
      if (bytes > MAX_BYTES)
        throw new Error('Source map import exceeds 20 MiB');
      const raw = JSON.parse(await readFile(file, 'utf8'));
      delete raw.sourcesContent;
      const url = new URL(
        relative(root, script).split(/[\\/]/).map(encodeURIComponent).join('/'),
        prefix,
      ).href;
      bundle.artifacts.push({
        url,
        generated: await readFile(script, 'utf8'),
        map: JSON.stringify(raw),
      });
    }
  }
  await walk(root);
  if (!bundle.artifacts.length)
    throw new Error('No adjacent .js.map or .mjs.map files found');
  createSourceMapResolver([bundle]);
  const serialized = JSON.stringify(bundle);
  if (Buffer.byteLength(serialized) > MAX_BYTES)
    throw new Error('Source map bundle exceeds 20 MiB');
  await mkdir(options.store, { recursive: true });
  const key = createHash('sha256')
    .update(JSON.stringify([options.app, options.release]))
    .digest('hex');
  const destination = join(options.store, key + '.json');
  // Release artifacts are immutable: accidental reimports cannot replace maps.
  await writeFile(destination, serialized, { flag: 'wx', mode: 0o600 });
  return bundle.artifacts.length;
}

export async function loadSourceMaps(store: string) {
  const bundles: SourceMapBundle[] = [];
  let bytes = 0;
  try {
    for (const entry of await readdir(store, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) continue;
      const path = join(store, entry.name);
      bytes += (await stat(path)).size;
      if (bytes > MAX_BYTES) throw new Error('Source map store exceeds 20 MiB');
      bundles.push(JSON.parse(await readFile(path, 'utf8')) as SourceMapBundle);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return createSourceMapResolver(bundles);
}
