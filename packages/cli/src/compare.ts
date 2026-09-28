import type {
  PerformanceDelta,
  ReleaseComparison,
} from '@tracelens/core';

const ESCAPE = '\u001B[';

export interface ComparisonFormatOptions {
  color?: boolean;
}

export function formatReleaseComparison(
  comparison: ReleaseComparison,
  options: ComparisonFormatOptions = {},
): string {
  const paint = (value: string, code: number) =>
    options.color ? `${ESCAPE}${code}m${value}${ESCAPE}0m` : value;
  const lines = [
    paint('TraceLens performance diff', 1),
    '',
    `${comparison.before.release} → ${comparison.after.release}`,
    '',
    metricHeader(),
    metricRow('INP p75', comparison.metrics.inpP75, formatMilliseconds),
    metricRow('LCP p75', comparison.metrics.lcpP75, formatMilliseconds),
    metricRow(
      'Long frames/session',
      comparison.metrics.longFramesPerSession,
      (value) => (value === undefined ? '—' : value.toFixed(1)),
    ),
  ];
  const regressions = comparison.interactions.filter(
    (delta) => delta.after !== undefined && (delta.percent ?? 1) > 0,
  );
  lines.push('', paint('Regressions', 90));
  if (!regressions.length) {
    lines.push('No interaction regressions found.');
  } else {
    for (const regression of regressions.slice(0, 10)) {
      lines.push(
        '',
        paint(regression.route ?? '/', 90),
        `${regression.name.padEnd(24)}${formatMilliseconds(regression.before).padStart(10)}${formatMilliseconds(regression.after).padStart(11)}${formatPercent(regression.percent).padStart(10)}`,
      );
    }
  }
  if (comparison.newLongFrames) {
    lines.push(
      '',
      paint(
        `${comparison.newLongFrames} newly introduced long frame${comparison.newLongFrames === 1 ? '' : 's'}`,
        33,
      ),
    );
  }
  return lines.join('\n');
}

function metricHeader(): string {
  return `${''.padEnd(24)}${'BEFORE'.padStart(10)}${'AFTER'.padStart(11)}${'DELTA'.padStart(10)}`;
}

function metricRow(
  label: string,
  delta: PerformanceDelta,
  format: (value: number | undefined) => string,
): string {
  return `${label.padEnd(24)}${format(delta.before).padStart(10)}${format(delta.after).padStart(11)}${formatPercent(delta.percent).padStart(10)}`;
}

function formatMilliseconds(value: number | undefined): string {
  return value === undefined ? '—' : `${Math.round(value)} ms`;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return 'new';
  return `${value >= 0 ? '+' : ''}${Math.round(value)}%`;
}
