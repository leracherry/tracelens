import type { BudgetCheck, BudgetReport } from '../../cli/src/budget.js';

export const COMMENT_MARKER = '<!-- tracelens-performance-report -->';

export function reportSummary(report: BudgetReport): string {
  const passed = report.checks.filter(
    (check) => check.status === 'pass',
  ).length;
  const failed = report.checks.filter(
    (check) => check.status === 'fail',
  ).length;
  const noData = report.checks.filter(
    (check) => check.status === 'no-data',
  ).length;
  return `${report.passed ? 'Passed' : 'Failed'}: ${passed} passed, ${failed} failed, ${noData} without enough data`;
}

export function renderMarkdownReport(report: BudgetReport): string {
  const context = [report.app, report.environment].filter(Boolean).join(' · ');
  const lines = [
    `## ${report.passed ? '✅' : '❌'} TraceLens performance budget`,
    '',
    `**Release:** ${escapeMarkdown(report.release)}${context ? ` · ${escapeMarkdown(context)}` : ''}`,
    '',
    '| Result | Scope | Metric | Actual | Budget | Samples |',
    '| :-- | :-- | :-- | --: | --: | --: |',
  ];
  for (const check of report.checks) {
    lines.push(
      `| ${statusLabel(check.status)} | ${escapeCell(check.route ?? 'Overall')} | ${escapeCell(check.metric)} | ${formatMetric(check, check.actual)} | ${formatMetric(check, check.threshold)} | ${check.samples} |`,
    );
  }
  lines.push('', reportSummary(report));
  return lines.join('\n');
}

export function renderPullRequestComment(report: BudgetReport): string {
  return `${COMMENT_MARKER}\n${renderMarkdownReport(report)}\n\n<sub>Updated by TraceLens for this pull request.</sub>`;
}

function statusLabel(status: BudgetCheck['status']): string {
  if (status === 'pass') return '✅ Pass';
  if (status === 'fail') return '❌ Fail';
  return '⚠️ No data';
}

function formatMetric(
  check: Pick<BudgetCheck, 'metric'>,
  value: number | undefined,
): string {
  if (value === undefined) return '—';
  if (check.metric === 'cls.p75') return value.toFixed(3);
  if (check.metric === 'longFramesPerSession') return value.toFixed(2);
  return `${Math.round(value)} ms`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()<>#+.!|\-]/g, '\\$&');
}

function escapeCell(value: string): string {
  return escapeMarkdown(value.replace(/[\r\n]+/g, ' '));
}
