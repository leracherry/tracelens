import {
  TRACE_LENS_VERSION,
  type AnyTraceLensEvent,
  type ElementDescriptor,
  type EventType,
  type PayloadMap,
  type TraceLensEvent,
  type WebVitalPayload,
} from '@tracelens/protocol';

export interface Transport {
  send(events: readonly AnyTraceLensEvent[]): Promise<void>;
}

export interface InitOptions {
  app: string;
  release?: string;
  environment?: string;
  sampleRate?: number;
  transport?: Transport;
  endpoint?: string;
  flushInterval?: number;
  batchSize?: number;
}

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
    duration: number;
  }>;
}

let runtime: Runtime | undefined;

class HttpTransport implements Transport {
  constructor(private readonly endpoint: string) {}

  async send(events: readonly AnyTraceLensEvent[]): Promise<void> {
    await fetch(this.endpoint, {
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

  constructor(
    private readonly options: Required<
      Pick<InitOptions, 'app' | 'batchSize' | 'flushInterval'>
    > &
      InitOptions,
  ) {}

  start(): void {
    this.observeInteractions();
    this.observeLongFrames();
    this.observeVitals();
    this.timer = window.setInterval(
      () => void this.flush(),
      this.options.flushInterval,
    );
  }

  emit<T extends EventType>(type: T, payload: PayloadMap[T]): void {
    const event: TraceLensEvent<T> = {
      version: TRACE_LENS_VERSION,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      app: this.options.app,
      release: this.options.release,
      environment: this.options.environment,
      type,
      payload,
    };
    this.queue.push(event as AnyTraceLensEvent);
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
    if (this.timer !== undefined) window.clearInterval(this.timer);
    await this.flush();
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
      observer.observe({ type, buffered: true });
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
            ? describeElement(entry.target)
            : undefined;
        this.emit('interaction', {
          interactionId: entry.interactionId,
          interactionType: entry.name as 'click' | 'keydown' | 'pointerdown',
          name: target?.name ?? entry.name,
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
          scripts: (entry.scripts ?? []).map((script) => ({
            source: sanitizeUrl(script.sourceURL),
            functionName: script.sourceFunctionName,
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
      for (const entry of entries as Array<
        PerformanceEntry & { value?: number; hadRecentInput?: boolean }
      >) {
        if (!entry.hadRecentInput) this.cls += entry.value ?? 0;
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
}

export function init(options: InitOptions): () => Promise<void> {
  if (runtime) throw new Error('TraceLens has already been initialized.');
  if (Math.random() > (options.sampleRate ?? 1)) return async () => undefined;
  runtime = new Runtime({
    ...options,
    batchSize: options.batchSize ?? 20,
    flushInterval: options.flushInterval ?? 1_000,
    transport:
      options.transport ??
      new HttpTransport(options.endpoint ?? '/__tracelens'),
  });
  runtime.start();
  return shutdown;
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

export async function trace<T>(
  name: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await fn();
    runtime?.emit('custom-span', {
      name,
      startTime,
      duration: performance.now() - startTime,
      status: 'ok',
    });
    return result;
  } catch (error) {
    runtime?.emit('custom-span', {
      name,
      startTime,
      duration: performance.now() - startTime,
      status: 'error',
    });
    throw error;
  }
}

export function describeElement(element: Element): ElementDescriptor {
  const explicit = element.getAttribute('data-tracelens-name');
  const aria = element.getAttribute('aria-label');
  const role = element.getAttribute('role') ?? undefined;
  const type = element.getAttribute('type');
  const name =
    (explicit ?? aria ?? [role, type].filter(Boolean).join(' ')) ||
    element.tagName.toLowerCase();
  const id = element.id ? `#${CSS.escape(element.id)}` : '';
  return {
    tagName: element.tagName.toLowerCase(),
    role,
    name,
    selector: `${element.tagName.toLowerCase()}${id}`,
  };
}

function sanitizeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, location.href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}
