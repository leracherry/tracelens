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
});
