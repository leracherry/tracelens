import { describe, expect, it } from 'vitest';
import type { AnyTraceLensEvent } from '@tracelens/protocol';
import { formatInteractionReport } from './format';

const base = {
  version: 1,
  timestamp: 1,
  sessionId: 'session',
  app: 'playground',
} as const;

const events: AnyTraceLensEvent[] = [
  {
    ...base,
    id: 'interaction-event',
    type: 'interaction',
    payload: {
      interactionId: 'interaction-1',
      interactionType: 'click',
      name: 'Save settings',
      route: '/settings',
      startTime: 10,
      duration: 487,
      timing: {
        total: 487,
        inputDelay: 11,
        processingDuration: 287,
        presentationDelay: 189,
      },
    },
  },
  {
    ...base,
    id: 'network-event',
    type: 'network',
    payload: {
      method: 'PATCH',
      url: 'https://example.test/api/settings',
      status: 204,
      startTime: 100,
      duration: 214,
      interactionId: 'interaction-1',
      transport: 'fetch',
    },
  },
];

describe('formatInteractionReport', () => {
  it('formats timing and contributor details', () => {
    const report = formatInteractionReport(events);
    expect(report).toContain('Save settings  487 ms');
    expect(report).toContain('Processing           287 ms');
    expect(report).toContain('PATCH /api/settings  214 ms');
    expect(report).toContain('HTTP 204');
  });

  it('handles traces without interactions', () => {
    expect(formatInteractionReport([])).toBe(
      'No interaction events found in this trace.',
    );
  });
});
