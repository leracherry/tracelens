import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';
import {
  evaluateBudgets,
  formatBudgetReport,
  loadBudgetConfig,
  validateConfig,
} from './budget.js';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

function event(
  type: AnyTraceLensEvent['type'],
  payload: AnyTraceLensEvent['payload'],
  overrides: Partial<AnyTraceLensEvent> = {},
): AnyTraceLensEvent {
  return {
    version: 1,
    id: Math.random().toString(16),
    timestamp: 10,
    sessionId: 'session',
    app: 'shop',
    release: '2.0.0',
    environment: 'production',
    type,
    payload,
    ...overrides,
  } as AnyTraceLensEvent;
}

const interaction = (duration: number, route = '/checkout') =>
  event('interaction', {
    interactionId: String(duration),
    interactionType: 'click',
    name: 'Buy',
    route,
    startTime: 0,
    duration,
    timing: {
      total: duration,
      inputDelay: 1,
      processingDuration: duration - 2,
      presentationDelay: 1,
    },
  });

describe('performance budgets', () => {
  it('loads strict YAML configuration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tracelens-budget-'));
    roots.push(root);
    const path = join(root, 'tracelens.yml');
    await writeFile(
      path,
      'minimumSamples: 2\nperformance:\n  inp:\n    p75: 200\n  cls:\n    p75: 0.1\nroutes:\n  /checkout:\n    inp:\n      p75: 150\n',
    );
    await expect(loadBudgetConfig(path)).resolves.toEqual({
      minimumSamples: 2,
      performance: { inp: { p75: 200 }, cls: { p75: 0.1 } },
      routes: { '/checkout': { inp: { p75: 150 } } },
    });
  });

  it('evaluates global, vital, frame, and route thresholds', () => {
    const events = [
      interaction(100),
      interaction(240),
      event('web-vital', {
        name: 'LCP',
        value: 2100,
        rating: 'needs-improvement',
        route: '/checkout',
      }),
      event('web-vital', {
        name: 'CLS',
        value: 0.04,
        rating: 'good',
        route: '/checkout',
      }),
      event('long-frame', {
        startTime: 0,
        duration: 80,
        scripts: [],
      }),
    ];
    const report = evaluateBudgets(
      events,
      validateConfig({
        minimumSamples: 1,
        performance: {
          inp: { p75: 200 },
          lcp: { p75: 2500 },
          cls: { p75: 0.1 },
          longFramesPerSession: { max: 1 },
        },
        routes: { '/checkout': { inp: { p75: 250 } } },
      }),
    );
    expect(report.release).toBe('2.0.0');
    expect(report.passed).toBe(false);
    expect(report.checks.map((check) => [check.metric, check.status])).toEqual([
      ['inp.p75', 'fail'],
      ['lcp.p75', 'pass'],
      ['cls.p75', 'pass'],
      ['longFramesPerSession', 'pass'],
      ['inp.p75', 'pass'],
    ]);
  });

  it('selects the newest release and rejects ambiguous populations', () => {
    const older = interaction(100);
    const newer = interaction(120);
    newer.release = '3.0.0';
    newer.timestamp = 20;
    expect(
      evaluateBudgets(
        [older, newer],
        validateConfig({ performance: { inp: { p75: 200 } } }),
      ).release,
    ).toBe('3.0.0');
    const otherApp = { ...newer, app: 'admin' };
    expect(() =>
      evaluateBudgets(
        [newer, otherApp],
        validateConfig({ performance: { inp: { p75: 200 } } }),
      ),
    ).toThrow('Multiple apps');
  });

  it('fails closed when samples are missing or below the minimum', () => {
    const report = evaluateBudgets(
      [interaction(100)],
      validateConfig({
        minimumSamples: 2,
        performance: { inp: { p75: 200 }, lcp: { p75: 2500 } },
      }),
    );
    expect(report.passed).toBe(false);
    expect(report.checks.every((check) => check.status === 'no-data')).toBe(
      true,
    );
    expect(formatBudgetReport(report)).toContain('NO DATA');
  });

  it('rejects unknown keys, invalid thresholds, and empty configs', () => {
    expect(() => validateConfig({})).toThrow('does not define');
    expect(() => validateConfig({ performance: { inp: { p75: -1 } } })).toThrow(
      'non-negative',
    );
    expect(() =>
      validateConfig({ performance: { inp: { p99: 200 } } }),
    ).toThrow('Unknown');
    expect(() =>
      validateConfig({ routes: { checkout: { inp: { p75: 100 } } } }),
    ).toThrow('route');
  });

  it('formats a concise deterministic report', () => {
    const report = evaluateBudgets(
      [interaction(100)],
      validateConfig({ performance: { inp: { p75: 200 } } }),
    );
    expect(formatBudgetReport(report)).toBe(
      'Production Performance Budget\n' +
        'Release: 2.0.0 · shop · production\n\n' +
        'PASS     inp.p75                              100 ms / 200 ms  (1 samples)\n\n' +
        'All budgets passed.',
    );
  });
});
