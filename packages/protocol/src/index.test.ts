import { describe, expect, it } from 'vitest';
import { isTraceLensEvent } from './index';

describe('isTraceLensEvent', () => {
  it('accepts a versioned envelope', () => {
    expect(
      isTraceLensEvent({
        version: 1,
        id: 'event-1',
        timestamp: 1,
        sessionId: 'session-1',
        app: 'demo',
        type: 'mark',
        payload: { name: 'ready', startTime: 0 },
      }),
    ).toBe(true);
  });

  it('rejects an unknown version', () => {
    expect(isTraceLensEvent({ version: 2 })).toBe(false);
  });

  it('round-trips correlated network telemetry', () => {
    const event = {
      version: 1,
      id: 'network-1',
      timestamp: 1,
      sessionId: 'session-1',
      app: 'demo',
      type: 'network',
      payload: {
        method: 'PATCH',
        url: 'https://example.com/api/settings',
        status: 204,
        startTime: 20,
        duration: 80,
        interactionId: 'interaction-1',
        transport: 'fetch',
      },
    } as const;

    expect(isTraceLensEvent(JSON.parse(JSON.stringify(event)))).toBe(true);
  });
});
