import { describe, expect, it } from 'vitest';
import type { AnyTraceLensEvent } from '@tracelens/protocol';
import { aggregateReleases, compareReleases } from './index';

function event(
  overrides: Partial<AnyTraceLensEvent> &
    Pick<AnyTraceLensEvent, 'type' | 'payload'>,
): AnyTraceLensEvent {
  return {
    version: 1,
    id: crypto.randomUUID(),
    timestamp: 1,
    sessionId: 'session-1',
    app: 'demo',
    release: '2.14.0',
    environment: 'production',
    ...overrides,
  } as AnyTraceLensEvent;
}

describe('aggregateReleases', () => {
  it('summarizes responsiveness and session activity by release', () => {
    const interaction = (duration: number, sessionId = 'session-1') =>
      event({
        sessionId,
        type: 'interaction',
        payload: {
          interactionId: crypto.randomUUID(),
          interactionType: 'click',
          name: 'Save settings',
          route: '/settings',
          startTime: 0,
          duration,
          timing: {
            total: duration,
            inputDelay: 0,
            processingDuration: duration,
            presentationDelay: 0,
          },
        },
      });

    const releases = aggregateReleases([
      interaction(100),
      interaction(200),
      interaction(300, 'session-2'),
      interaction(400, 'session-2'),
      event({
        type: 'long-frame',
        payload: { startTime: 0, duration: 60, scripts: [] },
      }),
      event({
        timestamp: 2,
        commit: '7ac841f',
        buildTimestamp: '2026-09-27T18:00:00.000Z',
        type: 'long-frame',
        payload: { startTime: 100, duration: 70, scripts: [] },
      }),
    ]);

    expect(releases).toEqual([
      expect.objectContaining({
        release: '2.14.0',
        commit: '7ac841f',
        sessionCount: 2,
        interactionCount: 4,
        inpP75: 300,
        longFrameCount: 2,
        longFramesPerSession: 1,
      }),
    ]);
  });

  it('sorts releases by latest event and excludes unversioned events', () => {
    const mark = (release: string | undefined, timestamp: number) =>
      event({
        release,
        timestamp,
        type: 'mark',
        payload: { name: 'ready', startTime: 0 },
      });

    expect(
      aggregateReleases([
        mark('2.13.0', 10),
        mark(undefined, 30),
        mark('2.14.0', 20),
      ]).map((release) => release.release),
    ).toEqual(['2.14.0', '2.13.0']);
  });
});

describe('compareReleases', () => {
  const interaction = (
    release: string,
    route: string,
    name: string,
    duration: number,
  ) =>
    event({
      release,
      type: 'interaction',
      payload: {
        interactionId: crypto.randomUUID(),
        interactionType: 'click',
        name,
        route,
        startTime: 0,
        duration,
        timing: {
          total: duration,
          inputDelay: 0,
          processingDuration: duration,
          presentationDelay: 0,
        },
      },
    });
  const render = (release: string, component: string, duration: number) =>
    event({
      release,
      type: 'react-render',
      payload: {
        component,
        phase: 'update',
        duration,
        baseDuration: duration,
        startTime: 0,
        commitTime: duration,
        renderCount: 1,
      },
    });

  it('calculates metrics and ranks interaction regressions', () => {
    const comparison = compareReleases(
      [
        interaction('2.13.0', '/settings', 'Save settings', 200),
        interaction('2.14.0', '/settings', 'Save settings', 300),
        interaction('2.13.0', '/search', 'Search', 100),
        interaction('2.14.0', '/search', 'Search', 110),
        event({
          release: '2.13.0',
          type: 'web-vital',
          payload: { name: 'LCP', value: 1_800, rating: 'good', route: '/' },
        }),
        event({
          release: '2.14.0',
          type: 'web-vital',
          payload: { name: 'LCP', value: 1_980, rating: 'good', route: '/' },
        }),
      ],
      '2.13.0',
      '2.14.0',
    );

    expect(comparison.metrics.inpP75).toMatchObject({
      before: 200,
      after: 300,
      percent: 50,
    });
    expect(comparison.metrics.lcpP75.percent).toBeCloseTo(10);
    expect(comparison.interactions[0]).toMatchObject({
      route: '/settings',
      name: 'Save settings',
      percent: 50,
    });
  });

  it('reports component duration and render-count deltas', () => {
    const comparison = compareReleases(
      [
        render('2.13.0', 'BillingForm', 40),
        render('2.14.0', 'BillingForm', 60),
        render('2.14.0', 'BillingForm', 80),
      ],
      '2.13.0',
      '2.14.0',
    );

    expect(comparison.components[0]).toMatchObject({
      name: 'BillingForm',
      before: 40,
      after: 80,
      percent: 100,
      beforeRenders: 1,
      afterRenders: 2,
      renderDelta: 1,
    });
  });

  it('rejects missing or identical releases', () => {
    expect(() => compareReleases([], 'same', 'same')).toThrow(
      'two different releases',
    );
    expect(() => compareReleases([], 'missing', 'after')).toThrow(
      'Release not found: missing',
    );
  });
});
