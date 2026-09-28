import type { AnyTraceLensEvent } from '@tracelens/protocol';

export interface ReleaseOption {
  release: string;
  commit?: string;
  environment?: string;
  seenAt: number;
}

export function listReleases(
  events: readonly AnyTraceLensEvent[],
): ReleaseOption[] {
  const latest = new Map<string, ReleaseOption>();
  for (const event of events) {
    if (!event.release) continue;
    const current = latest.get(event.release);
    if (!current || event.timestamp >= current.seenAt) {
      latest.set(event.release, {
        release: event.release,
        commit: event.commit,
        environment: event.environment,
        seenAt: event.timestamp,
      });
    }
  }
  return [...latest.values()].sort((a, b) => b.seenAt - a.seenAt);
}

export function filterByRelease(
  events: readonly AnyTraceLensEvent[],
  release: string,
): AnyTraceLensEvent[] {
  return release === 'all'
    ? [...events]
    : events.filter((event) => event.release === release);
}
