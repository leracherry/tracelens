import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createStudioServer, isLoopbackOrigin } from './studio';

const servers: ReturnType<typeof createStudioServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

describe('Studio collector security', () => {
  it('recognizes only loopback browser origins', () => {
    expect(isLoopbackOrigin('http://127.0.0.1:4174')).toBe(true);
    expect(isLoopbackOrigin('http://localhost:3000')).toBe(true);
    expect(isLoopbackOrigin('https://preview.localhost')).toBe(true);
    expect(isLoopbackOrigin('http://[::1]:4174')).toBe(true);
    expect(isLoopbackOrigin('https://example.com')).toBe(false);
    expect(isLoopbackOrigin('not a url')).toBe(false);
  });

  it('rejects non-loopback origins and malformed events', async () => {
    const server = createStudioServer(process.cwd());
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const { port } = server.address() as AddressInfo;
    const endpoint = `http://127.0.0.1:${port}/__tracelens`;

    const blocked = await fetch(endpoint, {
      headers: { origin: 'https://example.com' },
    });
    expect(blocked.status).toBe(403);

    const malformed = await fetch(endpoint, {
      method: 'POST',
      headers: {
        origin: 'http://localhost:4174',
        'content-type': 'application/json',
      },
      body: JSON.stringify([
        {
          version: 1,
          id: 'bad',
          timestamp: 1,
          sessionId: 'session',
          app: 'demo',
          type: 'unknown',
          payload: {},
        },
      ]),
    });
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:4174',
    );
    expect(malformed.headers.get('x-frame-options')).toBe('DENY');
    expect(malformed.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'none'",
    );
  });
});
