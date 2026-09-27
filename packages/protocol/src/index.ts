export const TRACE_LENS_VERSION = 1 as const;

export type EventType =
  | 'interaction'
  | 'web-vital'
  | 'long-frame'
  | 'network'
  | 'navigation'
  | 'layout-shift'
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
}

export interface TraceLensEvent<T extends EventType = EventType> {
  version: typeof TRACE_LENS_VERSION;
  id: string;
  timestamp: number;
  sessionId: string;
  app: string;
  release?: string;
  environment?: string;
  type: T;
  payload: PayloadMap[T];
}

export type AnyTraceLensEvent = {
  [T in EventType]: TraceLensEvent<T>;
}[EventType];

export function isTraceLensEvent(value: unknown): value is AnyTraceLensEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    event.version === TRACE_LENS_VERSION &&
    typeof event.id === 'string' &&
    typeof event.timestamp === 'number' &&
    typeof event.sessionId === 'string' &&
    typeof event.app === 'string' &&
    typeof event.type === 'string' &&
    event.payload !== null &&
    typeof event.payload === 'object'
  );
}
