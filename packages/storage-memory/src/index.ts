import {
  applyTraceQuery,
  type StorageAdapter,
  type TraceQuery,
} from '@leracherry/tracelens-core';
import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';

export class MemoryStorage implements StorageAdapter {
  private events: AnyTraceLensEvent[] = [];

  async append(events: readonly AnyTraceLensEvent[]): Promise<void> {
    this.events.push(...events);
  }

  async query(query?: TraceQuery): Promise<AnyTraceLensEvent[]> {
    return applyTraceQuery(this.events, query);
  }

  async clear(): Promise<void> {
    this.events = [];
  }
}
