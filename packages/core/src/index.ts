import type {
  AnyTraceLensEvent,
  EventType,
} from '@leracherry/tracelens-protocol';

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
  lcpP75?: number;
  longFrameCount: number;
  longFramesPerSession: number;
}

export interface PerformanceDelta {
  before?: number;
  after?: number;
  absolute?: number;
  percent?: number;
}

export interface ScopePerformanceDelta extends PerformanceDelta {
  key: string;
  route?: string;
  name: string;
}

export interface ComponentPerformanceDelta extends ScopePerformanceDelta {
  beforeRenders: number;
  afterRenders: number;
  renderDelta: number;
}

export interface ReleaseComparison {
  before: ReleaseSummary;
  after: ReleaseSummary;
  metrics: {
    inpP75: PerformanceDelta;
    lcpP75: PerformanceDelta;
    longFramesPerSession: PerformanceDelta;
  };
  routes: ScopePerformanceDelta[];
  interactions: ScopePerformanceDelta[];
  components: ComponentPerformanceDelta[];
  newLongFrames: number;
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
      lcpValues: number[];
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
        lcpValues: [],
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
    if (event.type === 'web-vital' && event.payload.name === 'LCP') {
      group.lcpValues.push(event.payload.value);
    }
    if (event.type === 'long-frame') summary.longFrameCount += 1;
  }

  return [...groups.values()]
    .map(({ summary, sessions, interactionDurations, lcpValues }) => {
      summary.sessionCount = sessions.size;
      summary.inpP75 = percentile(interactionDurations, 0.75);
      summary.lcpP75 = percentile(lcpValues, 0.75);
      summary.longFramesPerSession = sessions.size
        ? summary.longFrameCount / sessions.size
        : 0;
      return summary;
    })
    .sort((a, b) => b.lastSeen - a.lastSeen);
}

export function compareReleases(
  events: readonly AnyTraceLensEvent[],
  beforeRelease: string,
  afterRelease: string,
): ReleaseComparison {
  if (beforeRelease === afterRelease) {
    throw new Error('Release comparison requires two different releases.');
  }
  const summaries = aggregateReleases(events);
  const before = summaries.find((summary) => summary.release === beforeRelease);
  const after = summaries.find((summary) => summary.release === afterRelease);
  if (!before) throw new Error(`Release not found: ${beforeRelease}`);
  if (!after) throw new Error(`Release not found: ${afterRelease}`);

  return {
    before,
    after,
    metrics: {
      inpP75: performanceDelta(before.inpP75, after.inpP75),
      lcpP75: performanceDelta(before.lcpP75, after.lcpP75),
      longFramesPerSession: performanceDelta(
        before.longFramesPerSession,
        after.longFramesPerSession,
      ),
    },
    routes: compareScopes(events, beforeRelease, afterRelease, (event) => {
      if (event.type !== 'interaction') return undefined;
      return { key: event.payload.route, name: event.payload.route };
    }),
    interactions: compareScopes(
      events,
      beforeRelease,
      afterRelease,
      (event) => {
        if (event.type !== 'interaction') return undefined;
        return {
          key: `${event.payload.route}\u0000${event.payload.name}`,
          route: event.payload.route,
          name: event.payload.name,
        };
      },
    ),
    components: compareComponents(events, beforeRelease, afterRelease),
    newLongFrames: Math.max(0, after.longFrameCount - before.longFrameCount),
  };
}

function compareScopes(
  events: readonly AnyTraceLensEvent[],
  beforeRelease: string,
  afterRelease: string,
  identify: (
    event: AnyTraceLensEvent,
  ) => { key: string; route?: string; name: string } | undefined,
): ScopePerformanceDelta[] {
  const scopes = new Map<
    string,
    {
      route?: string;
      name: string;
      before: number[];
      after: number[];
    }
  >();
  for (const event of events) {
    if (event.release !== beforeRelease && event.release !== afterRelease)
      continue;
    const identity = identify(event);
    if (!identity || event.type !== 'interaction') continue;
    let scope = scopes.get(identity.key);
    if (!scope) {
      scope = { ...identity, before: [], after: [] };
      scopes.set(identity.key, scope);
    }
    const values = event.release === beforeRelease ? scope.before : scope.after;
    values.push(event.payload.duration);
  }
  return [...scopes.entries()]
    .map(([key, scope]) => ({
      key,
      route: scope.route,
      name: scope.name,
      ...performanceDelta(
        percentile(scope.before, 0.75),
        percentile(scope.after, 0.75),
      ),
    }))
    .sort(compareRegression);
}

function compareComponents(
  events: readonly AnyTraceLensEvent[],
  beforeRelease: string,
  afterRelease: string,
): ComponentPerformanceDelta[] {
  const components = new Map<
    string,
    {
      before: number[];
      after: number[];
      beforeRenders: number;
      afterRenders: number;
    }
  >();
  for (const event of events) {
    if (
      event.type !== 'react-render' ||
      (event.release !== beforeRelease && event.release !== afterRelease)
    )
      continue;
    let component = components.get(event.payload.component);
    if (!component) {
      component = { before: [], after: [], beforeRenders: 0, afterRenders: 0 };
      components.set(event.payload.component, component);
    }
    if (event.release === beforeRelease) {
      component.before.push(event.payload.duration);
      component.beforeRenders += 1;
    } else {
      component.after.push(event.payload.duration);
      component.afterRenders += 1;
    }
  }
  return [...components.entries()]
    .map(([name, component]) => ({
      key: name,
      name,
      ...performanceDelta(
        percentile(component.before, 0.75),
        percentile(component.after, 0.75),
      ),
      beforeRenders: component.beforeRenders,
      afterRenders: component.afterRenders,
      renderDelta: component.afterRenders - component.beforeRenders,
    }))
    .sort(compareRegression);
}

function performanceDelta(
  before: number | undefined,
  after: number | undefined,
): PerformanceDelta {
  const absolute =
    before === undefined || after === undefined ? undefined : after - before;
  return {
    before,
    after,
    absolute,
    percent:
      absolute === undefined || before === undefined || before === 0
        ? undefined
        : (absolute / before) * 100,
  };
}

function compareRegression(
  left: PerformanceDelta,
  right: PerformanceDelta,
): number {
  const score = (delta: PerformanceDelta) =>
    delta.percent ??
    (delta.before === undefined && delta.after !== undefined
      ? Infinity
      : -Infinity);
  return score(right) - score(left);
}

function percentile(
  values: readonly number[],
  quantile: number,
): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * quantile) - 1];
}
