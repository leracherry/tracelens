import type { AnyTraceLensEvent } from '@tracelens/protocol';

export interface PrivacyOptions {
  /** Raw DOM text, input values, and headers are never collected. */
  text?: 'drop';
  inputValues?: 'drop';
  headers?: 'allowlist';
  queryParameters?: 'drop' | 'allowlist';
  elementAttributes?: 'allowlist';
  allowedElementAttributes?: Array<
    'data-tracelens-name' | 'aria-label' | 'role' | 'type' | 'id'
  >;
  url?: {
    stripQuery?: boolean;
    allowedQueryParameters?: string[];
    /** Redact the value following these path keys: /users/123 → /users/[redacted]. */
    redactSegments?: string[];
    /** Receives a sanitized URL; return null to suppress its value. */
    sanitize?: (url: string) => string | null;
  };
}

export function sanitizeTelemetryUrl(
  value: string,
  privacy: PrivacyOptions = {},
  base = globalThis.location?.href,
  route = false,
): string {
  const clean = (input: string): string => {
    try {
      const url = new URL(input, base ?? 'https://tracelens.invalid');
      if (!['http:', 'https:'].includes(url.protocol)) return '[redacted]';
      const keys = new Set(privacy.url?.redactSegments ?? []);
      const segments = url.pathname.split('/');
      const decoded = segments.map((segment) => decodeURIComponent(segment));
      url.pathname = segments
        .map((segment, index) =>
          keys.has(decoded[index - 1] ?? '') ||
          /[^/\s]+@[^/\s]+\.[^/\s]+/.test(decoded[index] ?? '')
            ? '[redacted]'
            : segment,
        )
        .join('/');
      url.username = '';
      url.password = '';
      url.hash = '';
      if (
        privacy.queryParameters !== 'allowlist' ||
        privacy.url?.stripQuery !== false
      )
        url.search = '';
      else
        for (const key of [...url.searchParams.keys()]) {
          if (!privacy.url.allowedQueryParameters?.includes(key))
            url.searchParams.delete(key);
        }
      return route
        ? `${url.pathname}${url.search}`
        : `${url.origin}${url.pathname}${url.search}`;
    } catch {
      return '[redacted]';
    }
  };
  const sanitized = clean(value);
  if (!privacy.url?.sanitize || sanitized === '[redacted]') return sanitized;
  try {
    const custom = privacy.url.sanitize(sanitized);
    return typeof custom === 'string' ? clean(custom) : '[redacted]';
  } catch {
    return '[redacted]';
  }
}

export function sanitizeEvent(
  event: AnyTraceLensEvent,
  privacy: PrivacyOptions = {},
): AnyTraceLensEvent {
  switch (event.type) {
    case 'network':
      return {
        ...event,
        payload: {
          ...event.payload,
          url: sanitizeTelemetryUrl(event.payload.url, privacy),
        },
      };
    case 'navigation':
    case 'interaction':
    case 'web-vital':
      return {
        ...event,
        payload: {
          ...event.payload,
          route: sanitizeTelemetryUrl(
            event.payload.route,
            privacy,
            undefined,
            true,
          ),
        },
      } as AnyTraceLensEvent;
    case 'long-frame':
      return {
        ...event,
        payload: {
          ...event.payload,
          scripts: event.payload.scripts.map((script) => ({
            ...script,
            source: script.source
              ? sanitizeTelemetryUrl(script.source, privacy)
              : undefined,
          })),
        },
      };
    default:
      return event;
  }
}
