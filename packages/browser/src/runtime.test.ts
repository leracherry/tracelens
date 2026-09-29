import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  init,
  mark,
  MemoryTransport,
  shutdown,
  trace,
  type Transport,
} from './index';

beforeEach(() => {
  const fetch = vi.fn(async () => new Response('{}', { status: 202 }));
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('window', { fetch, setInterval, clearInterval });
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('location', {
    href: 'https://app.test/',
    pathname: '/',
    hash: '',
  });
  vi.stubGlobal('PerformanceObserver', undefined);
  vi.stubGlobal(
    'XMLHttpRequest',
    class {
      open() {}
      send() {}
    },
  );
});

afterEach(async () => {
  try {
    await shutdown();
  } catch {
    // Failure tests own their retry behavior.
  }
  vi.unstubAllGlobals();
});

it('serializes concurrent flushes and drains every batch on shutdown', async () => {
  const delivered: AnyTraceLensEvent[] = [];
  const transport: Transport = {
    async send(events) {
      await Promise.resolve();
      delivered.push(...events);
    },
  };
  init({ app: 'test', transport, batchSize: 2, flushInterval: 60_000 });
  for (let index = 0; index < 5; index += 1) mark(`mark-${index}`);
  await shutdown();
  expect(delivered).toHaveLength(6);
  expect(delivered.filter((event) => event.type === 'mark')).toHaveLength(5);
});

it('keeps failed telemetry available for an explicit shutdown retry', async () => {
  const delivered: AnyTraceLensEvent[] = [];
  let attempts = 0;
  const transport: Transport = {
    async send(events) {
      attempts += 1;
      if (attempts === 1) throw new Error('collector unavailable');
      delivered.push(...events);
    },
  };
  init({ app: 'test', transport, flushInterval: 60_000 });
  mark('before-failure');
  await expect(shutdown()).rejects.toThrow('could not deliver');
  await shutdown();
  expect(attempts).toBe(2);
  expect(delivered.map((event) => event.type)).toEqual(['navigation', 'mark']);
});

it('treats non-success collector responses as delivery failures', async () => {
  const request = vi.mocked(globalThis.fetch);
  request.mockResolvedValueOnce(new Response('{}', { status: 503 }));
  init({ app: 'test', endpoint: '/collect', flushInterval: 60_000 });
  await expect(shutdown()).rejects.toThrow('could not deliver');
  request.mockResolvedValueOnce(new Response('{}', { status: 202 }));
  await expect(shutdown()).resolves.toBeUndefined();
});

it('does not enqueue work that completes after shutdown', async () => {
  const transport = new MemoryTransport();
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  init({ app: 'test', transport, flushInterval: 60_000 });
  const span = trace('late-span', () => pending);
  await shutdown();
  finish();
  await span;
  expect(transport.events.some((event) => event.type === 'custom-span')).toBe(
    false,
  );
});

it('rejects invalid runtime configuration before patching browser APIs', () => {
  expect(() => init({ app: '', sampleRate: 1 })).toThrow('app');
  expect(() => init({ app: 'test', sampleRate: 1.1 })).toThrow('sampleRate');
  expect(() => init({ app: 'test', batchSize: 0 })).toThrow('batchSize');
  expect(() => init({ app: 'test', flushInterval: 0 })).toThrow(
    'flushInterval',
  );
});
