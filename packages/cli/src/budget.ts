import { readFile, stat } from 'node:fs/promises';
import { parseDocument } from 'yaml';
import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';

const MAX_CONFIG_BYTES = 256 * 1024;
const TOP_LEVEL_KEYS = new Set(['performance', 'routes', 'minimumSamples']);
const PERFORMANCE_KEYS = new Set(['inp', 'lcp', 'cls', 'longFramesPerSession']);

export interface BudgetConfig {
  performance?: {
    inp?: { p75: number };
    lcp?: { p75: number };
    cls?: { p75: number };
    longFramesPerSession?: { max: number };
  };
  routes?: Record<string, { inp: { p75: number } }>;
  minimumSamples: number;
}

export interface BudgetCheck {
  scope: 'overall' | 'route';
  route?: string;
  metric: 'inp.p75' | 'lcp.p75' | 'cls.p75' | 'longFramesPerSession';
  actual?: number;
  threshold: number;
  samples: number;
  status: 'pass' | 'fail' | 'no-data';
}

export interface BudgetReport {
  schemaVersion: 1;
  passed: boolean;
  release: string;
  app?: string;
  environment?: string;
  checks: BudgetCheck[];
}

export interface BudgetSelection {
  release?: string;
  app?: string;
  environment?: string;
}

export async function loadBudgetConfig(path: string): Promise<BudgetConfig> {
  const info = await stat(path);
  if (!info.isFile()) throw new Error('Budget config must be a regular file');
  if (info.size > MAX_CONFIG_BYTES)
    throw new Error('Budget config exceeds 256 KiB');
  const source = await readFile(path, 'utf8');
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length)
    throw new Error(`Invalid budget YAML: ${document.errors[0]!.message}`);
  return validateConfig(document.toJS({ maxAliasCount: 20 }));
}

export function validateConfig(input: unknown): BudgetConfig {
  const root = object(input, 'Budget config');
  rejectUnknown(root, TOP_LEVEL_KEYS, 'Budget config');
  const minimumSamples =
    root.minimumSamples === undefined
      ? 1
      : positiveInteger(root.minimumSamples, 'minimumSamples');
  const config: BudgetConfig = { minimumSamples };
  if (root.performance !== undefined) {
    const performance = object(root.performance, 'performance');
    rejectUnknown(performance, PERFORMANCE_KEYS, 'performance');
    config.performance = {};
    for (const metric of ['inp', 'lcp', 'cls'] as const) {
      if (performance[metric] === undefined) continue;
      const value = object(performance[metric], `performance.${metric}`);
      rejectUnknown(value, new Set(['p75']), `performance.${metric}`);
      config.performance[metric] = {
        p75: threshold(value.p75, `performance.${metric}.p75`),
      };
    }
    if (performance.longFramesPerSession !== undefined) {
      const value = object(
        performance.longFramesPerSession,
        'performance.longFramesPerSession',
      );
      rejectUnknown(
        value,
        new Set(['max']),
        'performance.longFramesPerSession',
      );
      config.performance.longFramesPerSession = {
        max: threshold(value.max, 'performance.longFramesPerSession.max'),
      };
    }
  }
  if (root.routes !== undefined) {
    const routes = object(root.routes, 'routes');
    config.routes = {};
    for (const [route, raw] of Object.entries(routes)) {
      if (!route.startsWith('/') || route.length > 2_048)
        throw new Error(`Invalid route budget key: ${route}`);
      const value = object(raw, `routes.${route}`);
      rejectUnknown(value, new Set(['inp']), `routes.${route}`);
      const inp = object(value.inp, `routes.${route}.inp`);
      rejectUnknown(inp, new Set(['p75']), `routes.${route}.inp`);
      config.routes[route] = {
        inp: { p75: threshold(inp.p75, `routes.${route}.inp.p75`) },
      };
    }
  }
  const count =
    Object.keys(config.performance ?? {}).length +
    Object.keys(config.routes ?? {}).length;
  if (!count) throw new Error('Budget config does not define any checks');
  return config;
}

export function evaluateBudgets(
  events: readonly AnyTraceLensEvent[],
  config: BudgetConfig,
  selection: BudgetSelection = {},
): BudgetReport {
  let candidates = events.filter(
    (event) =>
      (!selection.app || event.app === selection.app) &&
      (!selection.environment || event.environment === selection.environment),
  );
  const apps = new Set(candidates.map((event) => event.app));
  if (!selection.app && apps.size > 1)
    throw new Error('Multiple apps found; select one with --app');
  const environmentValues = new Set(
    candidates.map((event) => event.environment ?? ''),
  );
  if (!selection.environment && environmentValues.size > 1)
    throw new Error(
      'Multiple environments found; select one with --environment',
    );
  const releases = new Map<string, number>();
  for (const event of candidates)
    if (event.release)
      releases.set(
        event.release,
        Math.max(releases.get(event.release) ?? -Infinity, event.timestamp),
      );
  const release =
    selection.release ??
    [...releases].sort((left, right) => right[1] - left[1])[0]?.[0];
  if (!release) throw new Error('No release telemetry found');
  candidates = candidates.filter((event) => event.release === release);
  if (!candidates.length) throw new Error(`Release not found: ${release}`);

  const checks: BudgetCheck[] = [];
  const overall = config.performance;
  if (overall?.inp)
    checks.push(
      check(
        'overall',
        'inp.p75',
        interactions(candidates),
        overall.inp.p75,
        config.minimumSamples,
      ),
    );
  if (overall?.lcp)
    checks.push(
      check(
        'overall',
        'lcp.p75',
        vitals(candidates, 'LCP'),
        overall.lcp.p75,
        config.minimumSamples,
      ),
    );
  if (overall?.cls)
    checks.push(
      check(
        'overall',
        'cls.p75',
        vitals(candidates, 'CLS'),
        overall.cls.p75,
        config.minimumSamples,
      ),
    );
  if (overall?.longFramesPerSession) {
    const sessions = new Set(candidates.map((event) => event.sessionId)).size;
    const count = candidates.filter(
      (event) => event.type === 'long-frame',
    ).length;
    checks.push({
      scope: 'overall',
      metric: 'longFramesPerSession',
      actual: sessions ? count / sessions : undefined,
      threshold: overall.longFramesPerSession.max,
      samples: sessions,
      status:
        sessions < config.minimumSamples
          ? 'no-data'
          : count / sessions <= overall.longFramesPerSession.max
            ? 'pass'
            : 'fail',
    });
  }
  for (const [route, budget] of Object.entries(config.routes ?? {})) {
    const values = interactions(candidates, route);
    checks.push({
      ...check(
        'route',
        'inp.p75',
        values,
        budget.inp.p75,
        config.minimumSamples,
      ),
      route,
    });
  }
  return {
    schemaVersion: 1,
    passed: checks.every((result) => result.status === 'pass'),
    release,
    app: selection.app ?? (apps.size === 1 ? [...apps][0] : undefined),
    environment:
      selection.environment ??
      (environmentValues.size === 1
        ? [...environmentValues][0] || undefined
        : undefined),
    checks,
  };
}

export function formatBudgetReport(
  report: BudgetReport,
  options: { color?: boolean } = {},
): string {
  const paint = (code: string, value: string) =>
    options.color ? `\u001b[${code}m${value}\u001b[0m` : value;
  const lines = [
    'Production Performance Budget',
    `Release: ${report.release}${report.app ? ` · ${report.app}` : ''}${report.environment ? ` · ${report.environment}` : ''}`,
    '',
  ];
  for (const result of report.checks) {
    const state =
      result.status === 'pass'
        ? paint('32', 'PASS')
        : result.status === 'fail'
          ? paint('31', 'FAIL')
          : paint('33', 'NO DATA');
    const scope = result.route
      ? `${result.metric} ${result.route}`
      : result.metric;
    const actual =
      result.actual === undefined
        ? '—'
        : formatMetric(result.metric, result.actual);
    lines.push(
      `${state.padEnd(options.color ? state.length + 5 : 8)} ${scope.padEnd(36)} ${actual} / ${formatMetric(result.metric, result.threshold)}  (${result.samples} samples)`,
    );
  }
  lines.push(
    '',
    report.passed ? 'All budgets passed.' : 'Performance budget failed.',
  );
  return lines.join('\n');
}

function interactions(events: readonly AnyTraceLensEvent[], route?: string) {
  return events.flatMap((event) =>
    event.type === 'interaction' &&
    (route === undefined || event.payload.route === route)
      ? [event.payload.duration]
      : [],
  );
}

function vitals(events: readonly AnyTraceLensEvent[], name: 'LCP' | 'CLS') {
  return events.flatMap((event) =>
    event.type === 'web-vital' && event.payload.name === name
      ? [event.payload.value]
      : [],
  );
}

function check(
  scope: BudgetCheck['scope'],
  metric: BudgetCheck['metric'],
  values: number[],
  limit: number,
  minimumSamples: number,
): BudgetCheck {
  const actual = percentile(values, 0.75);
  return {
    scope,
    metric,
    actual,
    threshold: limit,
    samples: values.length,
    status:
      values.length < minimumSamples
        ? 'no-data'
        : actual! <= limit
          ? 'pass'
          : 'fail',
  };
}

function percentile(values: number[], quantile: number) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * quantile) - 1];
}

function formatMetric(metric: BudgetCheck['metric'], value: number) {
  if (metric === 'cls.p75') return value.toFixed(3);
  if (metric === 'longFramesPerSession') return value.toFixed(2);
  return `${Math.round(value)} ms`;
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function rejectUnknown(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
) {
  for (const key of Object.keys(value))
    if (!allowed.has(key)) throw new Error(`Unknown ${path} key: ${key}`);
}

function threshold(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error(`${path} must be a finite non-negative number`);
  return value;
}

function positiveInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 1)
    throw new Error(`${path} must be a positive integer`);
  return value as number;
}
