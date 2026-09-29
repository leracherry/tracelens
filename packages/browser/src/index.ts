import {
  TRACE_LENS_VERSION,
  type AnyTraceLensEvent,
  type ElementDescriptor,
  type EventType,
  type PayloadMap,
  type ReactRenderPayload,
  type TraceLensEvent,
  type WebVitalPayload,
  type TraceContext,
} from '@leracherry/tracelens-protocol';
import { InteractionCorrelator, sanitizeNetworkUrl } from './correlation.js';
import { sanitizeEvent, type PrivacyOptions } from './privacy.js';
import {
  createTraceContext,
  propagateFetchContext,
  type TracePropagationOptions,
} from './trace-context.js';
export type { TracePropagationOptions } from './trace-context.js';
export { sanitizeTelemetryUrl, type PrivacyOptions } from './privacy.js';

export { InteractionCorrelator, sanitizeNetworkUrl } from './correlation.js';

export interface Transport {
  send(events: readonly AnyTraceLensEvent[]): Promise<void>;
}

export interface InitOptions {
  app: string;
  release?: string;
  commit?: string;
  buildTimestamp?: string;
  environment?: string;
  sampleRate?: number;
  transport?: Transport;
  endpoint?: string;
  flushInterval?: number;
  batchSize?: number;
  privacy?: PrivacyOptions;
  tracePropagation?: TracePropagationOptions;
}

export interface BuildMetadata {
  release?: string;
  commit?: string;
  buildTimestamp?: string;
  environment?: string;
}

declare const __TRACELENS_BUILD_METADATA__: BuildMetadata | undefined;

interface EventTimingEntry extends PerformanceEntry {
  processingStart: number;
  processingEnd: number;
  interactionId?: number;
  target?: Node | null;
}

interface LongAnimationFrameEntry extends PerformanceEntry {
  blockingDuration?: number;
  scripts?: Array<{
    sourceURL?: string;
    sourceFunctionName?: string;
    sourceCharPosition?: number;
    duration: number;
  }>;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value?: number;
  hadRecentInput?: boolean;
}

interface XhrMeta {
  method: string;
  url: string;
  startTime?: number;
  interactionId?: string;
}

let runtime: Runtime | undefined;

class HttpTransport implements Transport {
  constructor(
    private readonly endpoint: string,
    private readonly request: typeof fetch,
  ) {}

  async send(events: readonly AnyTraceLensEvent[]): Promise<void> {
    await this.request(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(events),
      keepalive: true,
    });
  }
}

export class MemoryTransport implements Transport {
  readonly events: AnyTraceLensEvent[] = [];

  async send(events: readonly AnyTraceLensEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

class Runtime {
  readonly sessionId = crypto.randomUUID();
  private readonly queue: AnyTraceLensEvent[] = [];
  private readonly observers: PerformanceObserver[] = [];
  private timer: number | undefined;
  private cls = 0;
  private inp = 0;
  private readonly seenBrowserInteractions = new Set<number>();
  private readonly correlator = new InteractionCorrelator();
  private readonly cleanup: Array<() => void> = [];
  private readonly interactionContexts = new Map<string, TraceContext>();

  contextFor(interactionId?: string, root = false): TraceContext {
    if (!interactionId) return createTraceContext();
    let parent = this.interactionContexts.get(interactionId);
    if (!parent) {
      parent = createTraceContext();
      this.interactionContexts.set(interactionId, parent);
      if (this.interactionContexts.size > 1000)
        this.interactionContexts.delete(
          this.interactionContexts.keys().next().value!,
        );
    }
    return root ? parent : createTraceContext(parent);
  }

  constructor(
    private readonly options: Required<
      Pick<InitOptions, 'app' | 'batchSize' | 'flushInterval'>
    > &
      InitOptions,
  ) {}

  start(): void {
    this.captureInputLifecycle();
    this.observeInteractions();
    this.observeLongFrames();
    this.observeVitals();
    this.instrumentFetch();
    this.instrumentXhr();
    this.emit('navigation', {
      route: `${location.pathname}${location.hash}`,
      startTime: 0,
    });
    this.timer = window.setInterval(
      () => void this.flush(),
      this.options.flushInterval,
    );
  }

  emit<T extends EventType>(
    type: T,
    payload: PayloadMap[T],
    traceContext?: TraceContext,
  ): void {
    const interactionId =
      'interactionId' in payload ? payload.interactionId : undefined;
    const event: TraceLensEvent<T> = {
      version: TRACE_LENS_VERSION,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      timeOrigin: performance.timeOrigin,
      traceContext:
        traceContext ?? this.contextFor(interactionId, type === 'interaction'),
      sessionId: this.sessionId,
      app: this.options.app,
      release: this.options.release,
      commit: this.options.commit,
      buildTimestamp: this.options.buildTimestamp,
      environment: this.options.environment,
      type,
      payload,
    };
    this.queue.push(
      sanitizeEvent(event as AnyTraceLensEvent, this.options.privacy),
    );
    if (this.queue.length >= this.options.batchSize) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.options.batchSize);
    try {
      await this.options.transport?.send(batch);
    } catch {
      this.queue.unshift(...batch);
    }
  }

  async stop(): Promise<void> {
    this.observers.forEach((observer) => observer.disconnect());
    this.cleanup.splice(0).forEach((cleanup) => cleanup());
    if (this.timer !== undefined) window.clearInterval(this.timer);
    await this.flush();
  }

  activeInteractionId(at = performance.now()): string | undefined {
    return this.correlator.active(at)?.id;
  }

  private observe(
    type: string,
    callback: (entries: PerformanceEntryList) => void,
  ): void {
    if (!globalThis.PerformanceObserver) return;
    try {
      const observer = new PerformanceObserver((list) =>
        callback(list.getEntries()),
      );
      observer.observe({
        type,
        buffered: true,
        ...(type === 'event' ? { durationThreshold: 16 } : {}),
      });
      this.observers.push(observer);
    } catch {
      // Unsupported browser entry types are intentionally ignored.
    }
  }

  private observeInteractions(): void {
    this.observe('event', (entries) => {
      for (const entry of entries as EventTimingEntry[]) {
        if (
          !['click', 'keydown', 'pointerdown'].includes(entry.name) ||
          entry.duration < 16
        )
          continue;
        if (
          entry.interactionId &&
          this.seenBrowserInteractions.has(entry.interactionId)
        )
          continue;
        if (entry.interactionId)
          this.seenBrowserInteractions.add(entry.interactionId);
        const inputDelay = Math.max(0, entry.processingStart - entry.startTime);
        const processingDuration = Math.max(
          0,
          entry.processingEnd - entry.processingStart,
        );
        const presentationDelay = Math.max(
          0,
          entry.duration - inputDelay - processingDuration,
        );
        const target =
          entry.target instanceof Element
            ? describeElement(entry.target, this.options.privacy)
            : undefined;
        const candidate = this.correlator.match(entry.name, entry.startTime);
        this.emit('interaction', {
          interactionId: candidate?.id ?? crypto.randomUUID(),
          browserInteractionId: entry.interactionId,
          interactionType: entry.name as 'click' | 'keydown' | 'pointerdown',
          name: candidate?.name ?? target?.name ?? entry.name,
          route: `${location.pathname}${location.hash}`,
          startTime: entry.startTime,
          duration: entry.duration,
          timing: {
            total: entry.duration,
            inputDelay,
            processingDuration,
            presentationDelay,
          },
          target,
        });
        if (entry.duration > this.inp) {
          this.inp = entry.duration;
          this.emitVital(
            'INP',
            entry.duration,
            entry.duration <= 200
              ? 'good'
              : entry.duration <= 500
                ? 'needs-improvement'
                : 'poor',
          );
        }
      }
    });
  }

  private observeLongFrames(): void {
    this.observe('long-animation-frame', (entries) => {
      for (const entry of entries as LongAnimationFrameEntry[]) {
        this.emit('long-frame', {
          startTime: entry.startTime,
          duration: entry.duration,
          blockingDuration: entry.blockingDuration,
          interactionId: this.correlator.overlapping(
            entry.startTime,
            entry.duration,
          )?.id,
          scripts: (entry.scripts ?? []).map((script) => ({
            source: script.sourceURL,
            functionName: script.sourceFunctionName,
            sourceCharPosition: script.sourceCharPosition,
            duration: script.duration,
            thirdParty: script.sourceURL
              ? new URL(script.sourceURL, location.href).origin !==
                location.origin
              : false,
          })),
        });
      }
    });
  }

  private observeVitals(): void {
    this.observe('largest-contentful-paint', (entries) => {
      const last = entries.at(-1);
      if (last)
        this.emitVital(
          'LCP',
          last.startTime,
          last.startTime <= 2500
            ? 'good'
            : last.startTime <= 4000
              ? 'needs-improvement'
              : 'poor',
        );
    });
    this.observe('layout-shift', (entries) => {
      for (const entry of entries as LayoutShiftEntry[]) {
        const value = entry.value ?? 0;
        const hadRecentInput = entry.hadRecentInput ?? false;
        if (!hadRecentInput) this.cls += value;
        this.emit('layout-shift', {
          startTime: entry.startTime,
          duration: entry.duration,
          value,
          hadRecentInput,
          interactionId: this.correlator.active(entry.startTime)?.id,
        });
      }
      this.emitVital(
        'CLS',
        this.cls,
        this.cls <= 0.1
          ? 'good'
          : this.cls <= 0.25
            ? 'needs-improvement'
            : 'poor',
      );
    });
  }

  private emitVital(
    name: WebVitalPayload['name'],
    value: number,
    rating: WebVitalPayload['rating'],
  ): void {
    this.emit('web-vital', { name, value, rating, route: location.pathname });
  }

  private captureInputLifecycle(): void {
    const capture = (event: Event) => {
      if (!['click', 'keydown', 'pointerdown'].includes(event.type)) return;
      const target =
        event.target instanceof Element
          ? describeElement(event.target, this.options.privacy)
          : undefined;
      const startTime = performance.now();
      const pointerCandidate =
        event.type === 'click'
          ? this.correlator.match('pointerdown', startTime)
          : undefined;
      this.correlator.add({
        id: pointerCandidate?.id ?? crypto.randomUUID(),
        type: event.type as 'click' | 'keydown' | 'pointerdown',
        name: target?.name ?? event.type,
        startTime,
      });
    };
    document.addEventListener('click', capture, true);
    document.addEventListener('keydown', capture, true);
    document.addEventListener('pointerdown', capture, true);
    this.cleanup.push(() => {
      document.removeEventListener('click', capture, true);
      document.removeEventListener('keydown', capture, true);
      document.removeEventListener('pointerdown', capture, true);
    });
  }

  private instrumentFetch(): void {
    const original = window.fetch;
    const endpoint = sanitizeNetworkUrl(
      this.options.endpoint ?? '/__tracelens',
    );
    const runtime = this;
    window.fetch = async function tracedFetch(
      input: RequestInfo | URL,
      init?: RequestInit,
    ) {
      const rawUrl = input instanceof Request ? input.url : String(input);
      if (sanitizeNetworkUrl(rawUrl) === endpoint)
        return original.call(window, input, init);
      const startTime = performance.now();
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      const interactionId = runtime.correlator.active(startTime)?.id;
      const context = runtime.contextFor(interactionId);
      const tracedInit = propagateFetchContext(
        input,
        init,
        context,
        runtime.options.tracePropagation,
      );
      try {
        const response = await original.call(window, input, tracedInit);
        runtime.emit(
          'network',
          {
            method,
            url: rawUrl,
            status: response.status,
            startTime,
            duration: performance.now() - startTime,
            interactionId,
            transport: 'fetch',
          },
          context,
        );
        return response;
      } catch (error) {
        runtime.emit(
          'network',
          {
            method,
            url: rawUrl,
            startTime,
            duration: performance.now() - startTime,
            interactionId,
            transport: 'fetch',
          },
          context,
        );
        throw error;
      }
    };
    this.cleanup.push(() => {
      window.fetch = original;
    });
  }

  private instrumentXhr(): void {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const metadata = new WeakMap<XMLHttpRequest, XhrMeta>();
    const runtime = this;
    XMLHttpRequest.prototype.open = function tracedOpen(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      metadata.set(this, { method: method.toUpperCase(), url: String(url) });
      return originalOpen.apply(this, [method, url, ...rest] as Parameters<
        XMLHttpRequest['open']
      >);
    } as typeof XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.send = function tracedSend(
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const meta = metadata.get(this);
      if (meta) {
        meta.startTime = performance.now();
        meta.interactionId = runtime.correlator.active(meta.startTime)?.id;
        this.addEventListener(
          'loadend',
          () => {
            runtime.emit('network', {
              method: meta.method,
              url: meta.url,
              status: this.status || undefined,
              startTime: meta.startTime!,
              duration: performance.now() - meta.startTime!,
              interactionId: meta.interactionId,
              transport: 'xhr',
            });
          },
          { once: true },
        );
      }
      return originalSend.call(this, body);
    };
    this.cleanup.push(() => {
      XMLHttpRequest.prototype.open = originalOpen;
      XMLHttpRequest.prototype.send = originalSend;
    });
  }
}

export function init(options: InitOptions): () => Promise<void> {
  if (runtime) throw new Error('TraceLens has already been initialized.');
  if (Math.random() > (options.sampleRate ?? 1)) return async () => undefined;
  const originalFetch = globalThis.fetch.bind(globalThis);
  const metadata = resolveBuildMetadata(options, readInjectedBuildMetadata());
  runtime = new Runtime({
    ...options,
    ...metadata,
    batchSize: options.batchSize ?? 20,
    flushInterval: options.flushInterval ?? 1_000,
    transport:
      options.transport ??
      new HttpTransport(options.endpoint ?? '/__tracelens', originalFetch),
  });
  runtime.start();
  return shutdown;
}

export function resolveBuildMetadata(
  configured: BuildMetadata,
  injected: BuildMetadata = {},
): BuildMetadata {
  return {
    release: configured.release ?? injected.release,
    commit: configured.commit ?? injected.commit,
    buildTimestamp: configured.buildTimestamp ?? injected.buildTimestamp,
    environment: configured.environment ?? injected.environment,
  };
}

function readInjectedBuildMetadata(): BuildMetadata {
  return typeof __TRACELENS_BUILD_METADATA__ === 'undefined'
    ? {}
    : __TRACELENS_BUILD_METADATA__;
}

export async function shutdown(): Promise<void> {
  const active = runtime;
  runtime = undefined;
  await active?.stop();
}

export function mark(name: string): void {
  performance.mark(`tracelens:${name}`);
  runtime?.emit('mark', { name, startTime: performance.now() });
}

export function recordReactRender(
  sample: Omit<ReactRenderPayload, 'interactionId'> & {
    interactionId?: string;
  },
): void {
  runtime?.emit('react-render', {
    ...sample,
    interactionId:
      sample.interactionId ?? runtime.activeInteractionId(sample.commitTime),
  });
}

export function getActiveInteractionId(
  at = performance.now(),
): string | undefined {
  return runtime?.activeInteractionId(at);
}

export async function trace<T>(
  name: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const startTime = performance.now();
  const active = runtime;
  const context = active?.contextFor(active.activeInteractionId(startTime));
  try {
    const result = await fn();
    active?.emit(
      'custom-span',
      {
        name,
        startTime,
        duration: performance.now() - startTime,
        status: 'ok',
      },
      context,
    );
    return result;
  } catch (error) {
    active?.emit(
      'custom-span',
      {
        name,
        startTime,
        duration: performance.now() - startTime,
        status: 'error',
      },
      context,
    );
    throw error;
  }
}

export function describeElement(
  element: Element,
  privacy: PrivacyOptions = {},
): ElementDescriptor {
  const allowed = new Set(
    privacy.allowedElementAttributes ?? ['data-tracelens-name', 'role', 'type'],
  );
  const attribute = (
    name: 'data-tracelens-name' | 'aria-label' | 'role' | 'type' | 'id',
  ) => (allowed.has(name) ? element.getAttribute(name) : null);
  const explicit = attribute('data-tracelens-name');
  const aria = attribute('aria-label');
  const role = attribute('role') ?? undefined;
  const type = attribute('type');
  const name =
    (explicit ?? aria ?? [role, type].filter(Boolean).join(' ')) ||
    element.tagName.toLowerCase();
  const elementId = attribute('id');
  const id = elementId ? `#${CSS.escape(elementId)}` : '';
  return {
    tagName: element.tagName.toLowerCase(),
    role,
    name,
    selector: `${element.tagName.toLowerCase()}${id}`,
  };
}
