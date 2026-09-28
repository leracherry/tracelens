import type { AnyTraceLensEvent, TraceContext } from '@tracelens/protocol';

export interface OtlpAttribute {
  key: string;
  value:
    { stringValue: string } | { doubleValue: number } | { boolValue: boolean };
}
export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  flags: number;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
  status: { code: number };
}
export interface OtlpTraceRequest {
  resourceSpans: Array<{
    resource: { attributes: OtlpAttribute[] };
    scopeSpans: Array<{
      scope: { name: string; version: string };
      spans: OtlpSpan[];
    }>;
  }>;
}

const legacyContexts = new WeakMap<AnyTraceLensEvent, TraceContext>();
function contextFor(event: AnyTraceLensEvent): TraceContext {
  const valid = (id: string, length: number) =>
    new RegExp(`^[0-9a-f]{${length}}$`, 'i').test(id) && !/^0+$/.test(id);
  const context = event.traceContext;
  if (
    context &&
    valid(context.traceId, 32) &&
    valid(context.spanId, 16) &&
    (!context.parentSpanId || valid(context.parentSpanId, 16)) &&
    Number.isInteger(context.traceFlags) &&
    context.traceFlags >= 0 &&
    context.traceFlags <= 255
  )
    return context;
  let generated = legacyContexts.get(event);
  if (!generated) {
    generated = {
      traceId: crypto.randomUUID().replaceAll('-', ''),
      spanId: crypto.randomUUID().replaceAll('-', '').slice(0, 16),
      traceFlags: 1,
    };
    legacyContexts.set(event, generated);
  }
  return generated;
}

function attributes(
  values: Record<string, string | number | boolean | undefined>,
): OtlpAttribute[] {
  return Object.entries(values).flatMap(([key, value]) =>
    value === undefined ||
    (typeof value === 'number' && !Number.isFinite(value))
      ? []
      : [
          {
            key,
            value:
              typeof value === 'string'
                ? { stringValue: value }
                : typeof value === 'boolean'
                  ? { boolValue: value }
                  : { doubleValue: value },
          },
        ],
  );
}
function nanos(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0)
    throw new Error('Invalid span timestamp');
  const whole = Math.floor(milliseconds);
  return (
    BigInt(whole) * 1_000_000n +
    BigInt(Math.round((milliseconds - whole) * 1_000_000))
  ).toString();
}

export function mapTraceLensEvent(event: AnyTraceLensEvent): OtlpSpan {
  const payload = event.payload;
  const duration = 'duration' in payload ? Math.max(0, payload.duration) : 0;
  const start =
    event.timeOrigin !== undefined && 'startTime' in payload
      ? event.timeOrigin + payload.startTime
      : event.timestamp - duration;
  const context = contextFor(event);
  const values: Record<string, string | number | boolean | undefined> = {
    'tracelens.event.type': event.type,
    'tracelens.event.id': event.id,
    'session.id': event.sessionId,
    'tracelens.interaction.id':
      'interactionId' in payload ? payload.interactionId : undefined,
    'url.path': 'route' in payload ? payload.route : undefined,
  };
  let name: string = event.type;
  let error = false;
  switch (event.type) {
    case 'interaction':
      name = event.payload.name;
      Object.assign(values, {
        'tracelens.input_delay.ms': event.payload.timing.inputDelay,
        'tracelens.processing.ms': event.payload.timing.processingDuration,
        'tracelens.presentation.ms': event.payload.timing.presentationDelay,
      });
      break;
    case 'network':
      name = event.payload.method;
      Object.assign(values, {
        'http.request.method': event.payload.method,
        'url.full': event.payload.url,
        'http.response.status_code': event.payload.status,
      });
      error = event.payload.status === undefined || event.payload.status >= 400;
      break;
    case 'react-render':
      name = event.payload.component;
      Object.assign(values, {
        'tracelens.react.phase': event.payload.phase,
        'tracelens.react.render_count': event.payload.renderCount,
        'tracelens.react.base_duration.ms': event.payload.baseDuration,
      });
      break;
    case 'custom-span':
      name = event.payload.name;
      error = event.payload.status === 'error';
      break;
    case 'mark':
      name = event.payload.name;
      break;
    case 'web-vital':
      name = event.payload.name;
      values['tracelens.web_vital.value'] = event.payload.value;
      break;
    case 'long-frame':
      values['tracelens.blocking_duration.ms'] = event.payload.blockingDuration;
      break;
    case 'layout-shift':
      values['tracelens.layout_shift.value'] = event.payload.value;
      break;
  }
  return {
    traceId: context.traceId,
    spanId: context.spanId,
    parentSpanId: context.parentSpanId,
    flags: context.traceFlags,
    name,
    kind: event.type === 'network' ? 3 : 1,
    startTimeUnixNano: nanos(start),
    endTimeUnixNano: nanos(start + duration),
    attributes: attributes(values),
    status: { code: error ? 2 : 0 },
  };
}

export function toOtlpTraceRequest(
  events: readonly AnyTraceLensEvent[],
): OtlpTraceRequest {
  const groups = new Map<string, OtlpTraceRequest['resourceSpans'][number]>();
  for (const event of events) {
    const key = JSON.stringify([
      event.app,
      event.release,
      event.environment,
      event.commit,
      event.buildTimestamp,
    ]);
    let group = groups.get(key);
    if (!group) {
      group = {
        resource: {
          attributes: attributes({
            'service.name': event.app,
            'service.version': event.release,
            'deployment.environment.name': event.environment,
            'tracelens.commit': event.commit,
            'tracelens.build_timestamp': event.buildTimestamp,
          }),
        },
        scopeSpans: [
          { scope: { name: '@tracelens/otel', version: '0.2.0' }, spans: [] },
        ],
      };
      groups.set(key, group);
    }
    group.scopeSpans[0]!.spans.push(mapTraceLensEvent(event));
  }
  return { resourceSpans: [...groups.values()] };
}

export interface ExporterOptions {
  endpoint: string;
  headers?: Record<string, string>;
  timeoutMillis?: number;
  fetch?: typeof fetch;
  /** Reports permanently rejected data without retrying accepted spans. */
  onRejected?: (details: {
    status: number;
    rejectedSpans?: string | number;
  }) => void;
}

/** A browser SDK Transport, not an OpenTelemetry SDK SpanExporter. Create before init(). */
export function createTraceLensExporter(options: ExporterOptions) {
  const request = options.fetch ?? globalThis.fetch.bind(globalThis);
  return {
    async send(events: readonly AnyTraceLensEvent[]): Promise<void> {
      if (!events.length) return;
      const response = await request(options.endpoint, {
        method: 'POST',
        headers: { ...options.headers, 'content-type': 'application/json' },
        body: JSON.stringify(toOtlpTraceRequest(events)),
        signal: AbortSignal.timeout(options.timeoutMillis ?? 10_000),
      });
      if ([429, 502, 503, 504].includes(response.status))
        throw new Error(`OTLP retryable HTTP ${response.status}`);
      if (!response.ok) {
        notify({ status: response.status });
        return;
      }
      const text = await response.text();
      if (text) {
        const body = JSON.parse(text) as {
          partialSuccess?: { rejectedSpans?: string | number };
        };
        if (body.partialSuccess)
          notify({
            status: response.status,
            rejectedSpans: body.partialSuccess.rejectedSpans,
          });
      }
    },
  };
  function notify(details: {
    status: number;
    rejectedSpans?: string | number;
  }) {
    try {
      options.onRejected?.(details);
    } catch {
      /* Diagnostics cannot cause duplicate exports. */
    }
  }
}
