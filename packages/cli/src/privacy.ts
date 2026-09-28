import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';

export interface PrivacyFinding {
  eventIndex: number;
  field: string;
  reason: string;
}

/** Heuristic inspection of captured data, not a guarantee of anonymity. */
export function auditPrivacy(
  events: readonly AnyTraceLensEvent[],
): PrivacyFinding[] {
  const findings: PrivacyFinding[] = [];
  const inspect = (
    value: unknown,
    field: string,
    eventIndex: number,
    depth: number,
  ) => {
    if (depth > 20) return;
    if (typeof value === 'string') {
      let decoded = value;
      try {
        decoded = decodeURIComponent(value);
      } catch {
        /* Inspect the original malformed value. */
      }
      if (/[^\s/]+@[^\s/]+\.[^\s/]+/.test(decoded))
        findings.push({ eventIndex, field, reason: 'Potential email address' });
      if (/(?:url|route|source)$/i.test(field) && /[?#]/.test(value))
        findings.push({
          eventIndex,
          field,
          reason: 'URL contains query parameters or fragment',
        });
      if (/https?:\/\/[^/]+:[^/]+@/i.test(value))
        findings.push({ eventIndex, field, reason: 'URL credentials' });
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        const childField = [
          'payload',
          'url',
          'route',
          'source',
          'target',
          'name',
          'scripts',
        ].includes(key)
          ? `${field}.${key}`
          : `${field}.[field]`;
        if (
          /^(authorization|cookie|password|token|inputValue|textContent|innerHTML|headers|body)$/i.test(
            key,
          )
        )
          findings.push({
            eventIndex,
            field: childField,
            reason: 'Sensitive field present',
          });
        inspect(child, childField, eventIndex, depth + 1);
      }
    }
  };
  events.forEach((event, index) => inspect(event, 'event', index, 0));
  return findings;
}

export function formatPrivacyAudit(
  events: readonly AnyTraceLensEvent[],
): string {
  const findings = auditPrivacy(events);
  return [
    'TraceLens privacy audit',
    `${events.length} events inspected; ${findings.length} potential issues`,
    ...findings.map(
      (finding) =>
        `Event ${finding.eventIndex + 1} · ${finding.field}: ${finding.reason}`,
    ),
    'Heuristic checks only. Review application labels, identifiers, and metadata separately. Values are omitted from this report.',
  ].join('\n');
}
