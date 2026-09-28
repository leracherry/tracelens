import { afterEach, expect, it, vi } from 'vitest';
import { createTraceContext, propagateFetchContext } from './trace-context';
import { init, MemoryTransport, shutdown } from './index';

afterEach(async () => {
  await shutdown();
  vi.unstubAllGlobals();
});

it('exports the propagated client span as a child of a later interaction event', async () => {
  const fetch = vi.fn(async () => new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('window', { fetch, setInterval, clearInterval });
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('Element', class {});
  vi.stubGlobal('location', {
    href: 'https://app.test/',
    pathname: '/',
    hash: '',
  });
  vi.stubGlobal(
    'XMLHttpRequest',
    class {
      open() {}
      send() {}
    },
  );
  const callbacks = new Map<
    string,
    (list: { getEntries: () => unknown[] }) => void
  >();
  vi.stubGlobal(
    'PerformanceObserver',
    class {
      constructor(
        private callback: (list: { getEntries: () => unknown[] }) => void,
      ) {}
      observe({ type }: { type: string }) {
        callbacks.set(type, this.callback);
      }
      disconnect() {}
    },
  );
  const transport = new MemoryTransport();
  init({
    app: 'test',
    transport,
    tracePropagation: { allowedOrigins: ['https://app.test'] },
  });
  const startTime = performance.now();
  document.dispatchEvent(new Event('click'));
  await window.fetch('https://app.test/api');
  callbacks.get('event')!({
    getEntries: () => [
      {
        name: 'click',
        startTime,
        duration: 32,
        processingStart: startTime + 1,
        processingEnd: startTime + 20,
        interactionId: 1,
      },
    ],
  });
  callbacks.get('long-animation-frame')!({
    getEntries: () => [
      {
        startTime,
        duration: 80,
        scripts: [
          {
            sourceURL: 'https://app.test/app.js?secret=hidden',
            sourceFunctionName: 'run',
            sourceCharPosition: 12,
            duration: 60,
          },
        ],
      },
    ],
  });
  await shutdown();
  const frame = transport.events.find((event) => event.type === 'long-frame')!;
  expect(frame.payload.scripts[0]?.sourceCharPosition).toBe(12);
  expect(frame.payload.scripts[0]?.source).toBe('https://app.test/app.js');
  const request = transport.events.find((event) => event.type === 'network')!;
  const interaction = transport.events.find(
    (event) => event.type === 'interaction',
  )!;
  expect(request.traceContext?.traceId).toBe(interaction.traceContext?.traceId);
  expect(request.traceContext?.parentSpanId).toBe(
    interaction.traceContext?.spanId,
  );
  const call = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(new Headers(call[1].headers).get('traceparent')).toBe(
    `00-${request.traceContext!.traceId}-${request.traceContext!.spanId}-01`,
  );
});

it('injects context only for explicit origins without mutating the caller headers', () => {
  const root = createTraceContext();
  const child = createTraceContext(root);
  expect(child.traceId).toBe(root.traceId);
  expect(child.parentSpanId).toBe(root.spanId);
  const headers = new Headers({ 'x-demo': 'value' });
  const input = new Request('https://api.test/orders', {
    method: 'POST',
    headers,
    body: 'payload',
  });
  const init = propagateFetchContext(input, undefined, child, {
    allowedOrigins: ['https://api.test'],
  });
  expect(new Headers(init?.headers).get('traceparent')).toBe(
    `00-${child.traceId}-${child.spanId}-01`,
  );
  expect(input.headers.has('traceparent')).toBe(false);
  expect(new Headers(init?.headers).get('x-demo')).toBe('value');
});
it('leaves third parties, no-cors, disabled tracing, and existing contexts untouched', () => {
  const context = createTraceContext();
  const options = { allowedOrigins: ['https://api.test'] };
  const existing = { headers: { traceparent: 'owned-by-another-tracer' } };
  expect(
    propagateFetchContext('https://api.test', existing, context, options),
  ).toBe(existing);
  expect(
    propagateFetchContext('https://api.test', undefined, context),
  ).toBeUndefined();
  expect(
    propagateFetchContext('https://third.test', undefined, context, options),
  ).toBeUndefined();
  const noCors = { mode: 'no-cors' as const };
  expect(
    propagateFetchContext('https://api.test', noCors, context, options),
  ).toBe(noCors);
});
