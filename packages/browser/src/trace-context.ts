import type { TraceContext } from '@tracelens/protocol';

export interface TracePropagationOptions {
  /** Exact HTTP(S) origins, including scheme and port. Disabled by default. */
  allowedOrigins: readonly string[];
}

export function createTraceContext(parent?: TraceContext): TraceContext {
  return {
    traceId: parent?.traceId ?? crypto.randomUUID().replaceAll('-', ''),
    spanId: crypto.randomUUID().replaceAll('-', '').slice(0, 16),
    parentSpanId: parent?.spanId,
    traceFlags: parent?.traceFlags ?? 1,
  };
}

export function propagateFetchContext(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  context: TraceContext,
  options?: TracePropagationOptions,
  base = globalThis.location?.href,
): RequestInit | undefined {
  if (!options) return init;
  try {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(request?.url ?? String(input), base);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !options.allowedOrigins.includes(url.origin) ||
      (init?.mode ?? request?.mode) === 'no-cors'
    )
      return init;
    const headers = new Headers(init?.headers ?? request?.headers);
    // Another tracer owns this request. Do not replace its context or state.
    if (headers.has('traceparent') || headers.has('tracestate')) return init;
    headers.set(
      'traceparent',
      `00-${context.traceId}-${context.spanId}-${context.traceFlags.toString(16).padStart(2, '0')}`,
    );
    return { ...init, headers };
  } catch {
    return init;
  }
}
