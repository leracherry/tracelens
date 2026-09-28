import type { AnyTraceLensEvent, EventType } from '@tracelens/protocol';

export interface TraceQuery {
  app?: string;
  sessionId?: string;
  type?: EventType;
  since?: number;
  limit?: number;
}

export interface StorageAdapter {
  append(events: readonly AnyTraceLensEvent[]): Promise<void>;
  query(query?: TraceQuery): Promise<AnyTraceLensEvent[]>;
  clear(): Promise<void>;
}

export interface ReleaseSummary {
  release: string;
  commit?: string;
  buildTimestamp?: string;
  environment?: string;
  firstSeen: number;
  lastSeen: number;
  eventCount: number;
  sessionCount: number;
  interactionCount: number;
  inpP75?: number;
  longFrameCount: number;
  longFramesPerSession: number;
}

export function applyTraceQuery(
  events: readonly AnyTraceLensEvent[],
  query: TraceQuery = {},
): AnyTraceLensEvent[] {
  const filtered = events.filter(
    (event) =>
      (!query.app || event.app === query.app) &&
      (!query.sessionId || event.sessionId === query.sessionId) &&
      (!query.type || event.type === query.type) &&
      (!query.since || event.timestamp >= query.since),
  );
  return filtered.slice(-(query.limit ?? filtered.length));
}

export function aggregateReleases(
  events: readonly AnyTraceLensEvent[],
): ReleaseSummary[] {
  const groups = new Map<
    string,
    {
      summary: ReleaseSummary;
      sessions: Set<string>;
      interactionDurations: number[];
    }
  >();

  for (const event of events) {
    if (!event.release) continue;
    let group = groups.get(event.release);
    if (!group) {
      group = {
        summary: {
          release: event.release,
          commit: event.commit,
          buildTimestamp: event.buildTimestamp,
          environment: event.environment,
          firstSeen: event.timestamp,
          lastSeen: event.timestamp,
          eventCount: 0,
          sessionCount: 0,
          interactionCount: 0,
          longFrameCount: 0,
          longFramesPerSession: 0,
        },
        sessions: new Set(),
        interactionDurations: [],
      };
      groups.set(event.release, group);
    }

    const { summary } = group;
    summary.eventCount += 1;
    summary.firstSeen = Math.min(summary.firstSeen, event.timestamp);
    if (event.timestamp >= summary.lastSeen) {
      summary.lastSeen = event.timestamp;
      summary.commit = event.commit ?? summary.commit;
      summary.buildTimestamp = event.buildTimestamp ?? summary.buildTimestamp;
      summary.environment = event.environment ?? summary.environment;
    }
    group.sessions.add(event.sessionId);
    if (event.type === 'interaction') {
      summary.interactionCount += 1;
      group.interactionDurations.push(event.payload.duration);
    }
    if (event.type === 'long-frame') summary.longFrameCount += 1;
  }

  return [...groups.values()]
    .map(({ summary, sessions, interactionDurations }) => {
      summary.sessionCount = sessions.size;
      summary.inpP75 = percentile(interactionDurations, 0.75);
      summary.longFramesPerSession = sessions.size
        ? summary.longFrameCount / sessions.size
        : 0;
      return summary;
    })
    .sort((a, b) => b.lastSeen - a.lastSeen);
}

function percentile(values: readonly number[], quantile: number) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * quantile) - 1];
}
