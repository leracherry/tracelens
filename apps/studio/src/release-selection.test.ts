import { describe, expect, it } from 'vitest';
import type { AnyTraceLensEvent } from '@tracelens/protocol';
import { filterByRelease, listReleases } from './release-selection';

function mark(
  release: string | undefined,
  timestamp: number,
  commit?: string,
): AnyTraceLensEvent {
  return {
    version: 1,
    id: `${release}-${timestamp}`,
    timestamp,
    sessionId: 'session-1',
    app: 'demo',
    release,
    commit,
    type: 'mark',
    payload: { name: 'ready', startTime: 0 },
  };
}

describe('release selection', () => {
  const events = [
    mark('2.13.0', 10, 'old'),
    mark(undefined, 30),
    mark('2.14.0', 20, 'new'),
    mark('2.14.0', 25, 'newer'),
  ];

  it('lists each release newest first with its latest metadata', () => {
    expect(listReleases(events)).toEqual([
      expect.objectContaining({ release: '2.14.0', commit: 'newer' }),
      expect.objectContaining({ release: '2.13.0', commit: 'old' }),
    ]);
  });

  it('filters telemetry without dropping the all-releases view', () => {
    expect(filterByRelease(events, '2.13.0')).toHaveLength(1);
    expect(filterByRelease(events, 'all')).toHaveLength(events.length);
  });
});
