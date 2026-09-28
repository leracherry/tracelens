import { describe, expect, it } from 'vitest';
import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';
import { auditPrivacy, formatPrivacyAudit } from './privacy';

const event = (url: string): AnyTraceLensEvent => ({
  version: 1,
  id: '1',
  timestamp: 1,
  sessionId: '1',
  app: 'demo',
  type: 'network',
  payload: {
    url,
    method: 'GET',
    startTime: 0,
    duration: 1,
    transport: 'fetch',
  },
});
describe('privacy audit', () => {
  it('detects encoded PII and URL metadata without echoing it', () => {
    const events = [
      event('https://app.test/users/alice%40example.com?token=private#secret'),
    ];
    expect(auditPrivacy(events)).toHaveLength(2);
    const report = formatPrivacyAudit(events);
    expect(report).toContain('Potential email address');
    expect(report).not.toMatch(/alice|private|secret/);
  });
  it('handles safe and empty traces without claiming a privacy guarantee', () => {
    expect(auditPrivacy([event('https://app.test/users/[redacted]')])).toEqual(
      [],
    );
    expect(formatPrivacyAudit([])).toContain('0 events inspected');
    expect(formatPrivacyAudit([])).toContain('Heuristic checks only');
  });
});
