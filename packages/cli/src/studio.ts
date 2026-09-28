import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnyTraceLensEvent } from '@tracelens/protocol';

export interface StudioOptions {
  host: string;
  port: number;
}

export function createStudioServer(directory: string) {
  const root = resolve(directory);
  const events: AnyTraceLensEvent[] = [];
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url ?? '/', 'http://localhost').pathname,
      );
      if (pathname === '/__tracelens') {
        response.setHeader('access-control-allow-origin', '*');
        response.setHeader('access-control-allow-headers', 'content-type');
        response.setHeader(
          'access-control-allow-methods',
          'GET, POST, OPTIONS',
        );
        if (request.method === 'OPTIONS') {
          response.writeHead(204).end();
          return;
        }
        if (request.method === 'GET') {
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(events));
          return;
        }
        if (request.method !== 'POST') {
          response.writeHead(405).end();
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
          size += Buffer.byteLength(chunk);
          if (size > 1_048_576) {
            response.writeHead(413).end('Telemetry batch exceeds 1 MiB');
            return;
          }
          chunks.push(Buffer.from(chunk));
        }
        const batch: unknown = JSON.parse(
          Buffer.concat(chunks).toString('utf8'),
        );
        if (
          !Array.isArray(batch) ||
          !batch.every(
            (event) =>
              event &&
              event.version === 1 &&
              typeof event.id === 'string' &&
              typeof event.timestamp === 'number' &&
              typeof event.app === 'string' &&
              typeof event.sessionId === 'string' &&
              typeof event.type === 'string' &&
              event.payload &&
              typeof event.payload === 'object',
          )
        ) {
          response.writeHead(400).end('Expected a telemetry event array');
          return;
        }
        events.push(...batch);
        if (events.length > 50_000) events.splice(0, events.length - 50_000);
        response.writeHead(202).end();
        return;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405).end();
        return;
      }
      const path = resolve(
        root,
        `.${pathname === '/' ? '/index.html' : pathname}`,
      );
      if (!path.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      const content = await readFile(path);
      const types: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
      };
      response.setHeader(
        'content-type',
        types[extname(path)] ?? 'application/octet-stream',
      );
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      response
        .writeHead(
          (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 400,
        )
        .end('Unable to handle request');
    }
  });
}

export async function startStudio(options: StudioOptions): Promise<number> {
  const directory = dirname(fileURLToPath(import.meta.url));
  let assets = resolve(directory, '../studio');
  try {
    await readFile(resolve(assets, 'index.html'));
  } catch {
    assets = resolve(directory, '../../../apps/studio/dist');
    await readFile(resolve(assets, 'index.html'));
  }
  const server = createStudioServer(assets);
  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, resolveReady);
  });
  console.log(`TraceLens Studio at http://${options.host}:${options.port}`);
  console.log('Telemetry stays in memory. Press Ctrl+C to stop.');
  return 0;
}
