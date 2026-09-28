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

  it('accepts React render samples', () => {
    expect(
      isTraceLensEvent({
        version: 1,
        id: 'render-1',
        timestamp: 1,
        sessionId: 'session-1',
        app: 'demo',
        type: 'react-render',
        payload: {
          component: 'Checkout',
          phase: 'update',
          duration: 12,
          baseDuration: 18,
          startTime: 100,
          commitTime: 112,
          renderCount: 2,
          interactionId: 'interaction-1',
        },
      }),
    ).toBe(true);
  });

  it('accepts release build metadata on the event envelope', () => {
    expect(
      isTraceLensEvent({
        version: 1,
        id: 'mark-1',
        timestamp: 1,
        sessionId: 'session-1',
        app: 'demo',
        release: '2.14.0',
        commit: '7ac841f',
        buildTimestamp: '2026-09-27T18:00:00.000Z',
        environment: 'production',
        type: 'mark',
        payload: { name: 'ready', startTime: 0 },
      }),
    ).toBe(true);
  });
});
