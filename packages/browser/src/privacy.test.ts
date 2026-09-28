import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeTelemetryUrl } from './privacy';
import { describeElement, init, MemoryTransport, shutdown } from './index';

afterEach(async () => {
  await shutdown();
  vi.unstubAllGlobals();
});

describe('URL privacy', () => {
  it('removes credentials, queries, fragments and encoded email paths', () => {
    expect(
      sanitizeTelemetryUrl(
        'https://user:secret@app.test/users/alice%40example.com?token=secret#private',
      ),
    ).toBe('https://app.test/users/[redacted]');
    expect(
      sanitizeTelemetryUrl('/settings?secret=1#private', {}, undefined, true),
    ).toBe('/settings');
  });
  it('redacts path values and keeps only explicitly permitted query keys', () => {
    expect(
      sanitizeTelemetryUrl(
        'https://app.test/userId/123?view=grid&token=secret',
        {
          queryParameters: 'allowlist',
          url: {
            stripQuery: false,
            allowedQueryParameters: ['view'],
            redactSegments: ['userId'],
          },
        },
      ),
    ).toBe('https://app.test/userId/[redacted]?view=grid');
  });
  it('fails closed for unsafe URLs, malformed encodings, and callbacks', () => {
    for (const value of [
      'data:text/plain,secret',
      'javascript:alert(1)',
      'https://app.test/%zz',
    ])
      expect(sanitizeTelemetryUrl(value)).toBe('[redacted]');
    expect(
      sanitizeTelemetryUrl('/ok', {
        url: {
          sanitize: () => {
            throw new Error('secret');
          },
        },
      }),
    ).toBe('[redacted]');
    expect(
      sanitizeTelemetryUrl('/ok', {
        url: {
          sanitize: () =>
            'https://user:secret@app.test/users/123?token=secret#private',
          redactSegments: ['users'],
        },
      }),
    ).toBe('https://app.test/users/[redacted]');
    expect(sanitizeTelemetryUrl('/ok', { url: { sanitize: () => null } })).toBe(
      '[redacted]',
    );
  });
});

it('excludes text, values, IDs and aria labels by default', () => {
  const element = {
    tagName: 'INPUT',
    textContent: 'private',
    value: 'private',
    getAttribute: (key: string) =>
      ({ id: 'private', 'aria-label': 'private', type: 'text' })[key as 'id'] ??
      null,
  } as unknown as Element;
  expect(describeElement(element)).toEqual({
    tagName: 'input',
    role: undefined,
    name: 'text',
    selector: 'input',
  });
  expect(describeElement(element, { allowedElementAttributes: [] }).name).toBe(
    'input',
  );
});

it('sanitizes queued navigation and fetch events without changing application requests', async () => {
  const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('window', { fetch, setInterval, clearInterval });
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('location', {
    href: 'https://app.test/users/123?token=secret#private',
    pathname: '/users/123',
    hash: '#private',
  });
  vi.stubGlobal('PerformanceObserver', undefined);
  vi.stubGlobal(
    'XMLHttpRequest',
    class {
      open() {}
      send() {}
    },
  );
  const transport = new MemoryTransport();
  init({
    app: 'test',
    transport,
    privacy: { url: { redactSegments: ['users'] } },
  });
  const originalUrl = 'https://app.test/users/123?token=secret';
  await window.fetch(originalUrl);
  await shutdown();
  expect(fetch).toHaveBeenCalledWith(originalUrl, undefined);
  expect(
    transport.events.find((event) => event.type === 'network')?.payload,
  ).toMatchObject({ url: 'https://app.test/users/[redacted]' });
  expect(
    transport.events.find((event) => event.type === 'navigation')?.payload,
  ).toMatchObject({ route: '/users/[redacted]' });
  expect(JSON.stringify(transport.events)).not.toContain('secret');
});
