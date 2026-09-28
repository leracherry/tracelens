import { describe, expect, it } from 'vitest';
import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';
import { MemoryStorage } from './index';

const event: AnyTraceLensEvent = {
  version: 1,
  id: '1',
  timestamp: 1,
  sessionId: 'session',
  app: 'demo',
  type: 'mark',
  payload: { name: 'ready', startTime: 0 },
};

describe('MemoryStorage', () => {
  it('stores and filters events', async () => {
    const storage = new MemoryStorage();
    await storage.append([event]);
    expect(await storage.query({ type: 'mark' })).toEqual([event]);
    expect(await storage.query({ type: 'interaction' })).toEqual([]);
  });
});
