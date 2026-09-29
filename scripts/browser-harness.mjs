import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

export async function startBrowserHarness() {
  const requests = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    requests.push(url.pathname + url.search);
    if (url.pathname.startsWith('/api/')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"ok":true}');
      return;
    }

    const pathname =
      url.pathname === '/' ? '/tests/browser/fixture.html' : url.pathname;
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('Not a file');
      response.writeHead(200, {
        'content-type':
          contentTypes[extname(file)] ?? 'application/octet-stream',
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });

  await new Promise((ready, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', ready);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  };
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
