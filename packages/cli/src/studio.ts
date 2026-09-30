import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isTraceLensEvent,
  type AnyTraceLensEvent,
} from '@leracherry/tracelens-protocol';
import { loadSourceMaps } from './source-maps.js';

export interface StudioOptions {
  host: string;
  port: number;
  sourceMaps?: string;
}

export function createStudioServer(
  directory: string,
  resolveEvent: (event: AnyTraceLensEvent) => AnyTraceLensEvent = (event) =>
    event,
) {
  const root = resolve(directory);
  const events: AnyTraceLensEvent[] = [];
  const resolvedEvents = new WeakMap<AnyTraceLensEvent, AnyTraceLensEvent>();
  return createServer(async (request, response) => {
    try {
      const origin = request.headers.origin;
      if (origin && !isLoopbackOrigin(origin)) {
        response
          .writeHead(403)
          .end('Cross-origin access is limited to loopback');
        return;
      }
      if (origin) {
        response.setHeader('access-control-allow-origin', origin);
        response.setHeader('vary', 'Origin');
      }
      response.setHeader('x-content-type-options', 'nosniff');
      response.setHeader('referrer-policy', 'no-referrer');
      response.setHeader('x-frame-options', 'DENY');
      response.setHeader(
        'content-security-policy',
        "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      );
      const pathname = decodeURIComponent(
        new URL(request.url ?? '/', 'http://localhost').pathname,
      );
      if (pathname === '/__tracelens') {
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
          response.end(
            JSON.stringify(
              events.map((event) => {
                let resolved = resolvedEvents.get(event);
                if (!resolved) {
                  resolved = resolveEvent(event);
                  resolvedEvents.set(event, resolved);
                }
                return resolved;
              }),
            ),
          );
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
          !batch.every((event) => isTraceLensEvent(event))
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

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' ||
        url.hostname.endsWith('.localhost') ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '::1' ||
        url.hostname === '[::1]')
    );
  } catch {
    return false;
  }
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
  const server = createStudioServer(
    assets,
    await loadSourceMaps(options.sourceMaps ?? '.tracelens/sourcemaps'),
  );
  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, resolveReady);
  });
  console.log(`TraceLens Studio at http://${options.host}:${options.port}`);
  console.log('Telemetry stays in memory. Press Ctrl+C to stop.');
  return 0;
}
