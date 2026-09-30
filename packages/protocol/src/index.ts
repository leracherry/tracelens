export const TRACE_LENS_VERSION = 1 as const;

export type EventType =
  | 'interaction'
  | 'web-vital'
  | 'long-frame'
  | 'network'
  | 'navigation'
  | 'layout-shift'
  | 'react-render'
  | 'custom-span'
  | 'mark';

export interface ElementDescriptor {
  tagName: string;
  role?: string;
  name?: string;
  selector?: string;
}

export interface InteractionTiming {
  total: number;
  inputDelay: number;
  processingDuration: number;
  presentationDelay: number;
}

export interface InteractionPayload {
  interactionId: string;
  browserInteractionId?: number;
  interactionType: 'click' | 'keydown' | 'pointerdown' | 'custom';
  name: string;
  route: string;
  startTime: number;
  duration: number;
  timing: InteractionTiming;
  target?: ElementDescriptor;
}

export interface WebVitalPayload {
  name: 'INP' | 'LCP' | 'CLS';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  route: string;
}

export interface ScriptContribution {
  source?: string;
  /** Zero-based UTF-16 offset reported by Long Animation Frames. */
  sourceCharPosition?: number;
  originalLocation?: {
    source: string;
    line: number;
    column: number;
    name?: string;
    githubUrl?: string;
  };
  functionName?: string;
  duration: number;
  thirdParty: boolean;
}

export interface LongFramePayload {
  startTime: number;
  duration: number;
  blockingDuration?: number;
  interactionId?: string;
  scripts: ScriptContribution[];
}

export interface NetworkPayload {
  method: string;
  url: string;
  status?: number;
  startTime: number;
  duration: number;
  interactionId?: string;
  transport: 'fetch' | 'xhr';
}

export interface LayoutShiftPayload {
  startTime: number;
  duration: number;
  value: number;
  hadRecentInput: boolean;
  interactionId?: string;
}

export interface NavigationPayload {
  route: string;
  startTime: number;
}

export interface ReactRenderPayload {
  component: string;
  phase: 'mount' | 'update';
  duration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  renderCount: number;
  interactionId?: string;
}

export interface CustomSpanPayload {
  name: string;
  startTime: number;
  duration: number;
  status: 'ok' | 'error';
}

export interface MarkPayload {
  name: string;
  startTime: number;
}

export interface PayloadMap {
  interaction: InteractionPayload;
  'web-vital': WebVitalPayload;
  'long-frame': LongFramePayload;
  'custom-span': CustomSpanPayload;
  mark: MarkPayload;
  network: NetworkPayload;
  navigation: NavigationPayload;
  'layout-shift': LayoutShiftPayload;
  'react-render': ReactRenderPayload;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: number;
}

export interface TraceLensEvent<T extends EventType = EventType> {
  version: typeof TRACE_LENS_VERSION;
  id: string;
  timestamp: number;
  timeOrigin?: number;
  traceContext?: TraceContext;
  sessionId: string;
  app: string;
  release?: string;
  commit?: string;
  buildTimestamp?: string;
  environment?: string;
  type: T;
  payload: PayloadMap[T];
}

export type AnyTraceLensEvent = {
  [T in EventType]: TraceLensEvent<T>;
}[EventType];

export function isTraceLensEvent(value: unknown): value is AnyTraceLensEvent {
  if (!record(value)) return false;
  const event = value as Record<string, unknown>;
  if (
    event.version === TRACE_LENS_VERSION &&
    nonEmptyString(event.id) &&
    nonNegativeNumber(event.timestamp) &&
    nonEmptyString(event.sessionId) &&
    nonEmptyString(event.app) &&
    optionalString(event.release) &&
    optionalString(event.commit) &&
    optionalString(event.buildTimestamp) &&
    optionalString(event.environment) &&
    optionalNonNegativeNumber(event.timeOrigin) &&
    validTraceContext(event.traceContext) &&
    record(event.payload)
  ) {
    return validPayload(event.type, event.payload);
  }
  return false;
}

function validPayload(
  type: unknown,
  payload: Record<string, unknown>,
): boolean {
  switch (type) {
    case 'interaction':
      return (
        nonEmptyString(payload.interactionId) &&
        optionalNonNegativeInteger(payload.browserInteractionId) &&
        ['click', 'keydown', 'pointerdown', 'custom'].includes(
          String(payload.interactionType),
        ) &&
        nonEmptyString(payload.name) &&
        typeof payload.route === 'string' &&
        nonNegativeNumber(payload.startTime) &&
        nonNegativeNumber(payload.duration) &&
        validInteractionTiming(payload.timing) &&
        validElement(payload.target)
      );
    case 'web-vital':
      return (
        ['INP', 'LCP', 'CLS'].includes(String(payload.name)) &&
        nonNegativeNumber(payload.value) &&
        ['good', 'needs-improvement', 'poor'].includes(
          String(payload.rating),
        ) &&
        typeof payload.route === 'string'
      );
    case 'long-frame':
      return (
        nonNegativeNumber(payload.startTime) &&
        nonNegativeNumber(payload.duration) &&
        optionalNonNegativeNumber(payload.blockingDuration) &&
        optionalString(payload.interactionId) &&
        Array.isArray(payload.scripts) &&
        payload.scripts.every(validScript)
      );
    case 'network':
      return (
        nonEmptyString(payload.method) &&
        nonEmptyString(payload.url) &&
        optionalNonNegativeInteger(payload.status) &&
        nonNegativeNumber(payload.startTime) &&
        nonNegativeNumber(payload.duration) &&
        optionalString(payload.interactionId) &&
        ['fetch', 'xhr'].includes(String(payload.transport))
      );
    case 'navigation':
      return (
        typeof payload.route === 'string' &&
        nonNegativeNumber(payload.startTime)
      );
    case 'layout-shift':
      return (
        nonNegativeNumber(payload.startTime) &&
        nonNegativeNumber(payload.duration) &&
        nonNegativeNumber(payload.value) &&
        typeof payload.hadRecentInput === 'boolean' &&
        optionalString(payload.interactionId)
      );
    case 'react-render':
      return (
        nonEmptyString(payload.component) &&
        ['mount', 'update'].includes(String(payload.phase)) &&
        nonNegativeNumber(payload.duration) &&
        nonNegativeNumber(payload.baseDuration) &&
        nonNegativeNumber(payload.startTime) &&
        nonNegativeNumber(payload.commitTime) &&
        positiveInteger(payload.renderCount) &&
        optionalString(payload.interactionId)
      );
    case 'custom-span':
      return (
        nonEmptyString(payload.name) &&
        nonNegativeNumber(payload.startTime) &&
        nonNegativeNumber(payload.duration) &&
        ['ok', 'error'].includes(String(payload.status))
      );
    case 'mark':
      return (
        nonEmptyString(payload.name) && nonNegativeNumber(payload.startTime)
      );
    default:
      return false;
  }
}

function validInteractionTiming(value: unknown): boolean {
  return (
    record(value) &&
    nonNegativeNumber(value.total) &&
    nonNegativeNumber(value.inputDelay) &&
    nonNegativeNumber(value.processingDuration) &&
    nonNegativeNumber(value.presentationDelay)
  );
}

function validElement(value: unknown): boolean {
  return (
    value === undefined ||
    (record(value) &&
      nonEmptyString(value.tagName) &&
      optionalString(value.role) &&
      optionalString(value.name) &&
      optionalString(value.selector))
  );
}

function validScript(value: unknown): boolean {
  return (
    record(value) &&
    optionalString(value.source) &&
    optionalString(value.functionName) &&
    optionalNonNegativeInteger(value.sourceCharPosition) &&
    nonNegativeNumber(value.duration) &&
    typeof value.thirdParty === 'boolean' &&
    validOriginalLocation(value.originalLocation)
  );
}

function validOriginalLocation(value: unknown): boolean {
  return (
    value === undefined ||
    (record(value) &&
      nonEmptyString(value.source) &&
      positiveInteger(value.line) &&
      positiveInteger(value.column) &&
      optionalString(value.name) &&
      optionalString(value.githubUrl))
  );
}

function validTraceContext(value: unknown): boolean {
  return (
    value === undefined ||
    (record(value) &&
      hex(value.traceId, 32) &&
      hex(value.spanId, 16) &&
      (value.parentSpanId === undefined || hex(value.parentSpanId, 16)) &&
      Number.isInteger(value.traceFlags) &&
      Number(value.traceFlags) >= 0 &&
      Number(value.traceFlags) <= 255)
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonNegativeNumber(value: unknown): value is number {
  return finiteNumber(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function optionalNonNegativeNumber(value: unknown): boolean {
  return value === undefined || nonNegativeNumber(value);
}

function optionalNonNegativeInteger(value: unknown): boolean {
  return value === undefined || (Number.isInteger(value) && Number(value) >= 0);
}

function hex(value: unknown, length: number): boolean {
  return (
    typeof value === 'string' &&
    new RegExp(`^[0-9a-f]{${length}}$`, 'i').test(value) &&
    !/^0+$/.test(value)
  );
}
