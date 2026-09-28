import { describe, expect, it, vi } from 'vitest';
import type { TraceLensEvent } from '@leracherry/tracelens-protocol';
import {
  createTraceLensExporter,
  mapTraceLensEvent,
  toOtlpTraceRequest,
} from './index';

const event: TraceLensEvent<'network'> = {
  version: 1,
  id: 'request',
  sessionId: 'session',
  app: 'shop',
  release: '1.0',
  environment: 'test',
  timestamp: 1700000000999,
  timeOrigin: 1700000000000,
  traceContext: {
    traceId: 'a'.repeat(32),
    spanId: 'b'.repeat(16),
    parentSpanId: 'c'.repeat(16),
    traceFlags: 1,
  },
  type: 'network',
  payload: {
    method: 'GET',
    url: 'https://app.test/api',
    status: 500,
    startTime: 100,
    duration: 25,
    transport: 'fetch',
  },
};
describe('OTLP mapping', () => {
  it('preserves context and uses the performance clock, not delivery time', () => {
    expect(mapTraceLensEvent(event)).toMatchObject({
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      parentSpanId: 'c'.repeat(16),
      startTimeUnixNano: '1700000000100000000',
      endTimeUnixNano: '1700000000125000000',
      kind: 3,
      status: { code: 2 },
    });
  });
  it('isolates resources and retains stable IDs on retries of legacy events', () => {
    const legacy = { ...event, traceContext: undefined, timeOrigin: undefined };
    expect(mapTraceLensEvent(legacy).traceId).toBe(
      mapTraceLensEvent(legacy).traceId,
    );
    expect(mapTraceLensEvent(legacy).traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(
      toOtlpTraceRequest([event, { ...event, release: '2.0' }]).resourceSpans,
    ).toHaveLength(2);
  });
  it('emits a valid payload and does not retry partial acceptance or permanent errors', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ partialSuccess: { rejectedSpans: '1' } }),
        ),
      )
      .mockResolvedValueOnce(new Response('', { status: 400 }));
    const onRejected = vi.fn();
    const exporter = createTraceLensExporter({
      endpoint: '/v1/traces',
      fetch,
      onRejected,
    });
    await exporter.send([event]);
    await exporter.send([event]);
    const body = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
    expect(body.resourceSpans[0].scopeSpans[0].spans[0].spanId).toBe(
      'b'.repeat(16),
    );
    expect(onRejected).toHaveBeenCalledTimes(2);
  });
  it('rejects transient failures so the browser transport can retry', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('', { status: 503 }));
    await expect(
      createTraceLensExporter({ endpoint: '/v1/traces', fetch }).send([event]),
    ).rejects.toThrow('503');
    await createTraceLensExporter({ endpoint: '/v1/traces', fetch }).send([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
