import { describe, expect, it } from 'vitest';
import type { ReleaseComparison } from '@tracelens/core';
import { formatReleaseComparison } from './compare';

const summary = (release: string) => ({
  release,
  firstSeen: 1,
  lastSeen: 2,
  eventCount: 10,
  sessionCount: 2,
  interactionCount: 4,
  inpP75: release === '2.13.0' ? 200 : 300,
  lcpP75: release === '2.13.0' ? 1_800 : 1_980,
  longFrameCount: release === '2.13.0' ? 1 : 2,
  longFramesPerSession: release === '2.13.0' ? 0.5 : 1,
});

describe('formatReleaseComparison', () => {
  it('prints metric and interaction regressions', () => {
    const comparison: ReleaseComparison = {
      before: summary('2.13.0'),
      after: summary('2.14.0'),
      metrics: {
        inpP75: { before: 200, after: 300, absolute: 100, percent: 50 },
        lcpP75: {
          before: 1_800,
          after: 1_980,
          absolute: 180,
          percent: 10,
        },
        longFramesPerSession: {
          before: 0.5,
          after: 1,
          absolute: 0.5,
          percent: 100,
        },
      },
      routes: [],
      interactions: [
        {
          key: '/settings\u0000Save settings',
          route: '/settings',
          name: 'Save settings',
          before: 200,
          after: 300,
          absolute: 100,
          percent: 50,
        },
      ],
      components: [],
      newLongFrames: 1,
    };

    const output = formatReleaseComparison(comparison);
    expect(output).toContain('2.13.0 → 2.14.0');
    expect(output).toContain('INP p75');
    expect(output).toContain('200 ms');
    expect(output).toContain('+50%');
    expect(output).toContain('/settings');
    expect(output).toContain('1 newly introduced long frame');
  });
});
