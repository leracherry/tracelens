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
